"""
Dashboard API — recruiter overview numbers.
Owner: Person D

    GET /api/v1/dashboard/summary
"""

import json
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.cv import CV, CVStatus
from app.models.decision import Decision, DecisionStatus
from app.models.job import Job, JobStatus
from app.models.match_result import MatchResult
from app.models.user import User, UserRole
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
    job_filter = [] if current_user.role == UserRole.ADMIN else [Job.created_by == current_user.id]
    job_ids = select(Job.id).where(*job_filter)

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
            select(MatchResult, Job.title, CV.candidate_name)
            .join(Job, Job.id == MatchResult.job_id)
            .join(CV, CV.id == MatchResult.cv_id)
            .outerjoin(Decision, Decision.match_result_id == MatchResult.id)
            .where(match_scope, (Decision.id.is_(None)) | (Decision.status == DecisionStatus.PENDING))
            .order_by(MatchResult.overall_score.desc())
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
                    score=result.overall_score,
                    matched_skills=_skills(result.matched_skills),
                )
                for result, title, name in queue_rows
            ],
        )
    )
