"""
Dashboard API — recruiter overview numbers.
Owner: Person D

    GET /api/v1/dashboard/summary
    GET /api/v1/dashboard/analytics
"""

import json
from collections import Counter
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.cv import CV, CVStatus
from app.models.decision import Decision, DecisionStatus
from app.models.job import Job, JobStatus
from app.models.match_result import MatchResult
from app.models.user import User
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

PROCESSING = (CVStatus.UPLOADED, CVStatus.PARSING, CVStatus.PARSED, CVStatus.EXTRACTING, CVStatus.SCORING)


class RecentJob(BaseModel):
    id: int
    title: str
    department: str | None
    location: str | None
    status: JobStatus
    candidates: int
    updated_at: datetime


class QueueItem(BaseModel):
    result_id: int
    job_id: int
    job_title: str
    cv_id: int
    candidate_name: str
    score: float
    matched_skills: list[str]


class DashboardSummary(BaseModel):
    active_jobs: int
    total_jobs: int
    total_cvs: int
    processing_cvs: int
    error_cvs: int
    scored_matches: int
    needs_review: int
    shortlisted: int
    cv_status_counts: dict[str, int]
    recent_jobs: list[RecentJob]
    review_queue: list[QueueItem]


def _skills(stored: str | None) -> list[str]:
    try:
        value = json.loads(stored) if stored else []
    except json.JSONDecodeError:
        return []
    return [str(s) for s in value][:6] if isinstance(value, list) else []


@router.get("/summary", response_model=ApiResponse[DashboardSummary])
async def summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[DashboardSummary]:
    # Company-shared model: every role sees the same company-wide numbers.
    job_filter: list = []
    job_ids = select(Job.id)

    total_jobs = await db.scalar(select(func.count(Job.id)).where(*job_filter)) or 0
    active_jobs = await db.scalar(select(func.count(Job.id)).where(*job_filter, Job.status == JobStatus.ACTIVE)) or 0

    status_rows = (await db.execute(select(CV.status, func.count(CV.id)).group_by(CV.status))).all()
    cv_counts = {s.value: 0 for s in CVStatus}
    for cv_status, count in status_rows:
        cv_counts[cv_status.value] = count

    match_scope = MatchResult.job_id.in_(job_ids)
    scored = await db.scalar(select(func.count(MatchResult.id)).where(match_scope)) or 0
    needs_review = (
        await db.scalar(
            select(func.count(MatchResult.id))
            .outerjoin(Decision, Decision.match_result_id == MatchResult.id)
            .where(match_scope, (Decision.id.is_(None)) | (Decision.status == DecisionStatus.PENDING))
        )
        or 0
    )
    shortlisted = (
        await db.scalar(
            select(func.count(Decision.id))
            .join(MatchResult, MatchResult.id == Decision.match_result_id)
            .where(match_scope, Decision.status.in_([DecisionStatus.SHORTLISTED, DecisionStatus.INTERVIEW]))
        )
        or 0
    )

    candidate_counts = (
        select(MatchResult.job_id, func.count(MatchResult.id).label("n")).group_by(MatchResult.job_id).subquery()
    )
    recent_rows = (
        await db.execute(
            select(Job, func.coalesce(candidate_counts.c.n, 0))
            .outerjoin(candidate_counts, candidate_counts.c.job_id == Job.id)
            .where(*job_filter, Job.status != JobStatus.ARCHIVED)
            .order_by(Job.updated_at.desc(), Job.id.desc())
            .limit(5)
        )
    ).all()

    queue_rows = (
        await db.execute(
            select(MatchResult, Job.title, CV.candidate_name, Decision.score_override)
            .join(Job, Job.id == MatchResult.job_id)
            .join(CV, CV.id == MatchResult.cv_id)
            .outerjoin(Decision, Decision.match_result_id == MatchResult.id)
            .where(match_scope, (Decision.id.is_(None)) | (Decision.status == DecisionStatus.PENDING))
            .order_by(func.coalesce(Decision.score_override, MatchResult.overall_score).desc())
            .limit(5)
        )
    ).all()

    return ApiResponse(
        data=DashboardSummary(
            active_jobs=active_jobs,
            total_jobs=total_jobs,
            total_cvs=sum(cv_counts.values()),
            processing_cvs=sum(cv_counts[s.value] for s in PROCESSING),
            error_cvs=cv_counts[CVStatus.ERROR.value],
            scored_matches=scored,
            needs_review=needs_review,
            shortlisted=shortlisted,
            cv_status_counts=cv_counts,
            recent_jobs=[
                RecentJob(
                    id=job.id,
                    title=job.title,
                    department=job.department,
                    location=job.location,
                    status=job.status,
                    candidates=count,
                    updated_at=job.updated_at,
                )
                for job, count in recent_rows
            ],
            review_queue=[
                QueueItem(
                    result_id=result.id,
                    job_id=result.job_id,
                    job_title=title,
                    cv_id=result.cv_id,
                    candidate_name=name,
                    score=override if override is not None else result.overall_score,
                    matched_skills=_skills(result.matched_skills),
                )
                for result, title, name, override in queue_rows
            ],
        )
    )


# ── Analytics ───────────────────────────────────────────────
#   GET /api/v1/dashboard/analytics?days=14
#
# Company-wide numbers for the Analytics page. Aggregation happens in Python on
# compact rows so it behaves the same on SQLite (dev/tests) and PostgreSQL.

HIGH_SCORE = 75.0
MID_SCORE = 50.0
POSITIVE_DECISIONS = (DecisionStatus.SHORTLISTED, DecisionStatus.INTERVIEW, DecisionStatus.HIRED)


class ScoreBucket(BaseModel):
    start: int
    end: int
    count: int


class JobAnalytics(BaseModel):
    id: int
    title: str
    status: JobStatus
    candidates: int
    average_score: float | None
    top_score: float | None
    advanced: int  # shortlisted + interview + hired


class SkillGap(BaseModel):
    skill: str
    candidates: int


class ActivityDay(BaseModel):
    date: str  # ISO date, UTC
    cvs_uploaded: int
    matches_scored: int
    decisions_made: int


class AnalyticsSummary(BaseModel):
    total_jobs: int
    total_cvs: int
    scored_matches: int
    decided_matches: int
    average_score: float | None
    score_bands: dict[str, int]  # high / mid / low, same bands as the UI
    score_distribution: list[ScoreBucket]
    decision_funnel: dict[str, int]  # every DecisionStatus; no decision counts as pending
    cv_status_counts: dict[str, int]
    jobs: list[JobAnalytics]
    top_missing_skills: list[SkillGap]
    activity: list[ActivityDay]


def _effective(score: float, override: float | None) -> float:
    return override if override is not None else score


def _day(value: datetime | None) -> str | None:
    return value.date().isoformat() if value is not None else None


@router.get("/analytics", response_model=ApiResponse[AnalyticsSummary])
async def analytics(
    days: int = Query(default=14, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[AnalyticsSummary]:
    rows = (
        await db.execute(
            select(
                MatchResult.job_id,
                MatchResult.overall_score,
                MatchResult.missing_skills,
                MatchResult.updated_at,
                Decision.status,
                Decision.score_override,
                Decision.updated_at,
            ).outerjoin(Decision, Decision.match_result_id == MatchResult.id)
        )
    ).all()

    jobs = (await db.execute(select(Job.id, Job.title, Job.status).order_by(Job.updated_at.desc()))).all()
    cv_rows = (await db.execute(select(CV.status, CV.created_at))).all()

    scores = [_effective(r[1], r[5]) for r in rows]
    bands = {
        "high": sum(1 for s in scores if s >= HIGH_SCORE),
        "mid": sum(1 for s in scores if MID_SCORE <= s < HIGH_SCORE),
        "low": sum(1 for s in scores if s < MID_SCORE),
    }
    distribution = [
        ScoreBucket(start=b, end=b + 10, count=sum(1 for s in scores if b <= s < b + 10 or (b == 90 and s == 100)))
        for b in range(0, 100, 10)
    ]

    funnel = {s.value: 0 for s in DecisionStatus}
    for r in rows:
        funnel[(r[4] or DecisionStatus.PENDING).value] += 1

    per_job: dict[int, list[tuple[float, DecisionStatus | None]]] = {}
    for r in rows:
        per_job.setdefault(r[0], []).append((_effective(r[1], r[5]), r[4]))
    job_stats = []
    for job_id, title, status in jobs:
        entries = per_job.get(job_id, [])
        job_scores = [e[0] for e in entries]
        job_stats.append(
            JobAnalytics(
                id=job_id,
                title=title,
                status=status,
                candidates=len(entries),
                average_score=round(sum(job_scores) / len(job_scores), 1) if job_scores else None,
                top_score=round(max(job_scores), 1) if job_scores else None,
                advanced=sum(1 for e in entries if e[1] in POSITIVE_DECISIONS),
            )
        )

    gaps: Counter[str] = Counter()
    for r in rows:
        if not r[2]:
            continue
        try:
            skills = json.loads(r[2])
        except json.JSONDecodeError:
            continue
        if isinstance(skills, list):
            gaps.update({str(s).strip() for s in skills if str(s).strip()})

    today = date.today()
    window = [(today - timedelta(days=offset)).isoformat() for offset in range(days - 1, -1, -1)]
    uploaded = Counter(_day(r[1]) for r in cv_rows)
    scored = Counter(_day(r[3]) for r in rows)
    decided = Counter(_day(r[6]) for r in rows if r[4] is not None and r[4] != DecisionStatus.PENDING)

    cv_counts = {s.value: 0 for s in CVStatus}
    for status, _ in cv_rows:
        cv_counts[status.value] += 1

    return ApiResponse(
        data=AnalyticsSummary(
            total_jobs=len(jobs),
            total_cvs=len(cv_rows),
            scored_matches=len(rows),
            decided_matches=sum(v for k, v in funnel.items() if k != DecisionStatus.PENDING.value),
            average_score=round(sum(scores) / len(scores), 1) if scores else None,
            score_bands=bands,
            score_distribution=distribution,
            decision_funnel=funnel,
            cv_status_counts=cv_counts,
            jobs=job_stats,
            top_missing_skills=[SkillGap(skill=s, candidates=n) for s, n in gaps.most_common(8)],
            activity=[
                ActivityDay(date=d, cvs_uploaded=uploaded[d], matches_scored=scored[d], decisions_made=decided[d])
                for d in window
            ],
        )
    )
