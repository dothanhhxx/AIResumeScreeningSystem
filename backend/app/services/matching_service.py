"""
Matching service — DB side of scoring: start runs, persist results, rankings, decisions.
Owner: Person D (API) / Person C (scoring engine in app/services/matching/)
"""

import json
import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.cv import CV, CVStatus
from app.models.decision import Decision, DecisionStatus
from app.models.job import Job
from app.models.match_result import MatchResult
from app.models.user import User, UserRole
from app.schemas.matching import (
    CandidateBrief,
    DecisionRead,
    DecisionUpsert,
    JobRanking,
    MatchDetails,
    MatchResultRead,
    MatchRunResponse,
    RankedMatch,
)
from app.services.matching.rule_scorer import JobProfile

logger = logging.getLogger(__name__)

READY_STATUSES = (CVStatus.EXTRACTED, CVStatus.SCORED, CVStatus.SCORING)


# ── Helpers ─────────────────────────────────────────────────
def job_profile(job: Job) -> JobProfile:
    skills: list[str] = []
    if job.required_skills:
        try:
            parsed = json.loads(job.required_skills)
            if isinstance(parsed, list):
                skills = [str(s) for s in parsed if str(s).strip()]
        except json.JSONDecodeError:
            skills = [s.strip() for s in job.required_skills.split(",") if s.strip()]
    return JobProfile(
        title=job.title,
        description=job.description,
        requirements=job.requirements,
        required_skills=skills,
        experience_years=job.experience_years,
        education_level=job.education_level,
    )


def effective_score(result: MatchResult) -> float:
    if result.decision is not None and result.decision.score_override is not None:
        return result.decision.score_override
    return result.overall_score


def _structured(cv: CV) -> dict:
    if not cv.structured_data:
        return {}
    try:
        data = json.loads(cv.structured_data)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def to_ranked(result: MatchResult, cv: CV) -> RankedMatch:
    base = MatchResultRead.model_validate(result).model_dump()
    details = MatchDetails()
    if result.details:
        try:
            details = MatchDetails.model_validate_json(result.details)
        except ValueError:
            logger.warning("MatchResult %d has invalid details JSON", result.id)
    data = _structured(cv)
    return RankedMatch(
        **base,
        effective_score=effective_score(result),
        candidate=CandidateBrief(
            cv_id=cv.id,
            candidate_name=cv.candidate_name,
            candidate_email=cv.candidate_email,
            file_name=cv.file_name,
            status=cv.status,
            skills=[str(s) for s in data.get("skills", [])][:30],
            years_of_experience=data.get("years_of_experience"),
        ),
        decision=DecisionRead.model_validate(result.decision) if result.decision else None,
        details=details,
    )


async def get_job_for_user(db: AsyncSession, job_id: int, user: User) -> Job:
    job = await db.get(Job, job_id)
    if job is None:
        raise NotFoundError("Job", job_id)
    if user.role != UserRole.ADMIN and job.created_by != user.id:
        raise NotFoundError("Job", job_id)
    return job


async def recompute_ranks(db: AsyncSession, job_id: int) -> None:
    results = (
        await db.scalars(
            select(MatchResult).where(MatchResult.job_id == job_id).options(selectinload(MatchResult.decision))
        )
    ).all()
    ordered = sorted(results, key=lambda r: (-effective_score(r), r.id))
    for index, result in enumerate(ordered, start=1):
        result.rank = index


# ── Run matching ────────────────────────────────────────────
async def start_matching(db: AsyncSession, job: Job, cv_ids: list[int] | None) -> MatchRunResponse:
    """Mark the selected CVs as SCORING. The caller enqueues one score task per returned id."""
    query = select(CV)
    if cv_ids is not None:
        query = query.where(CV.id.in_(cv_ids))
    cvs = (await db.scalars(query)).all()

    ready = [cv for cv in cvs if cv.status in READY_STATUSES and cv.structured_data]
    ready_ids = {cv.id for cv in ready}
    skipped = sorted({cv.id for cv in cvs} - ready_ids)
    if cv_ids is not None:
        skipped = sorted(set(skipped) | (set(cv_ids) - {cv.id for cv in cvs}))

    for cv in ready:
        cv.status = CVStatus.SCORING
    await db.commit()
    return MatchRunResponse(job_id=job.id, queued=len(ready), cv_ids=sorted(ready_ids), skipped=skipped)


# ── Rankings ────────────────────────────────────────────────
async def get_ranking(
    db: AsyncSession,
    job: Job,
    decision_status: DecisionStatus | None = None,
) -> JobRanking:
    rows = (
        await db.execute(
            select(MatchResult, CV)
            .join(CV, CV.id == MatchResult.cv_id)
            .where(MatchResult.job_id == job.id)
            .options(selectinload(MatchResult.decision))
        )
    ).all()
    ranked = [to_ranked(result, cv) for result, cv in rows]
    ranked.sort(key=lambda r: (-r.effective_score, r.id))
    for index, item in enumerate(ranked, start=1):
        item.rank = index

    if decision_status is not None:
        ranked = [
            r
            for r in ranked
            if (r.decision.status if r.decision else DecisionStatus.PENDING) == decision_status
        ]

    pending = await db.scalar(select(func.count(CV.id)).where(CV.status == CVStatus.SCORING)) or 0
    return JobRanking(job_id=job.id, job_title=job.title, total=len(ranked), pending_cvs=pending, items=ranked)


async def get_result_for_user(db: AsyncSession, result_id: int, user: User) -> tuple[MatchResult, CV]:
    result = await db.scalar(
        select(MatchResult).where(MatchResult.id == result_id).options(selectinload(MatchResult.decision))
    )
    if result is None:
        raise NotFoundError("Match result", result_id)
    await get_job_for_user(db, result.job_id, user)
    cv = await db.get(CV, result.cv_id)
    if cv is None:
        raise NotFoundError("CV", result.cv_id)
    return result, cv


# ── Decisions ───────────────────────────────────────────────
async def upsert_decision(
    db: AsyncSession, result: MatchResult, payload: DecisionUpsert, user: User
) -> tuple[Decision, bool]:
    """Create or update the recruiter decision. Returns (decision, created)."""
    if user.role == UserRole.VIEWER:
        raise PermissionDeniedError("Viewers cannot record decisions")
    decision = result.decision
    created = decision is None
    if decision is None:
        decision = Decision(match_result_id=result.id)
        db.add(decision)
        result.decision = decision
    decision.status = payload.status
    decision.reason = payload.reason
    decision.note = payload.note
    decision.score_override = payload.score_override
    decision.decided_by = user.id
    await db.flush()
    await recompute_ranks(db, result.job_id)
    await db.commit()
    await db.refresh(decision)
    return decision, created
