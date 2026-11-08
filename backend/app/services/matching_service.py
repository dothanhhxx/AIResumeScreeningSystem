"""
Matching service — DB side of scoring: start runs, persist results, rankings, decisions.
Owner: Person D (API) / Person C (scoring engine in app/services/matching/)
"""

import json
import logging

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.cv import CV, CVStatus
from app.models.decision import Decision, DecisionStatus
from app.models.job import Job
from app.models.match_result import MatchResult
from app.models.user import User, UserRole
from app.schemas.common import PaginatedResponse
from app.schemas.job import ScoringWeights, parse_scoring_weights
from app.schemas.matching import (
    CandidateBrief,
    DecisionRead,
    DecisionUpsert,
    HistoryItem,
    JobRanking,
    MatchDetails,
    MatchResultRead,
    MatchRunResponse,
    RankedMatch,
)
from app.services.matching.aggregator import recalculate_with_weights
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
        scoring_weights=parse_scoring_weights(job.scoring_weights),
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
    if not details.category_weights:
        cw = details.custom_weights or ScoringWeights()
        details.category_weights = {
            "skill": round(cw.skill / 100.0, 3),
            "experience": round(cw.experience / 100.0, 3),
            "education": round(cw.education / 100.0, 3),
        }
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


async def get_job_or_404(db: AsyncSession, job_id: int) -> Job:
    """JDs are company-shared, so any signed-in user may read one; write gates live on the endpoints."""
    job = await db.get(Job, job_id)
    if job is None:
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
    return JobRanking(
        job_id=job.id,
        job_title=job.title,
        scoring_weights=parse_scoring_weights(job.scoring_weights),
        total=len(ranked),
        pending_cvs=pending,
        items=ranked,
    )


def _apply_weights_to_result(
    result: MatchResult,
    weights: ScoringWeights,
    *,
    is_custom_cv: bool,
) -> None:
    details = MatchDetails()
    if result.details:
        try:
            details = MatchDetails.model_validate_json(result.details)
        except ValueError:
            pass
    new_rule, new_overall, eng_w, cat_w = recalculate_with_weights(
        result.skill_score,
        result.experience_score,
        result.education_score,
        result.semantic_score,
        result.llm_score,
        weights,
    )
    result.rule_score = new_rule
    result.overall_score = new_overall
    details.weights = eng_w
    details.category_weights = cat_w
    details.custom_weights = weights if is_custom_cv else None
    result.details = details.model_dump_json()


async def recalculate_job_scores(
    db: AsyncSession,
    job: Job,
    *,
    reset_cv_overrides: bool = False,
) -> None:
    """Recalculate all MatchResult rows for *job* using its current scoring_weights."""
    weights = parse_scoring_weights(job.scoring_weights)
    results = (
        await db.scalars(
            select(MatchResult).where(MatchResult.job_id == job.id).options(selectinload(MatchResult.decision))
        )
    ).all()
    if not results:
        return
    for res in results:
        if not reset_cv_overrides and res.details:
            try:
                parsed = MatchDetails.model_validate_json(res.details)
                if parsed.custom_weights is not None:
                    continue
            except ValueError:
                pass
        _apply_weights_to_result(res, weights, is_custom_cv=False)
    await db.flush()
    await recompute_ranks(db, job.id)


async def update_job_weights(
    db: AsyncSession,
    job: Job,
    weights: ScoringWeights,
    user: User,
    *,
    reset_cv_overrides: bool = True,
) -> JobRanking:
    """Update a JD's scoring weights, recalculate all scored CVs, and return updated ranking."""
    if user.role == UserRole.VIEWER:
        raise PermissionDeniedError("Viewers cannot modify scoring weights")
    job.scoring_weights = weights.model_dump_json()
    await recalculate_job_scores(db, job, reset_cv_overrides=reset_cv_overrides)
    await db.commit()
    await db.refresh(job)
    return await get_ranking(db, job)


async def update_result_weights(
    db: AsyncSession,
    result: MatchResult,
    cv: CV,
    weights: ScoringWeights | None,
    user: User,
) -> RankedMatch:
    """Update or reset per-CV custom scoring weights and recompute ranks for the job."""
    if user.role == UserRole.VIEWER:
        raise PermissionDeniedError("Viewers cannot modify scoring weights")
    job = await get_job_or_404(db, result.job_id)
    if weights is None:
        effective = parse_scoring_weights(job.scoring_weights)
        _apply_weights_to_result(result, effective, is_custom_cv=False)
    else:
        _apply_weights_to_result(result, weights, is_custom_cv=True)
    await db.flush()
    await recompute_ranks(db, result.job_id)
    await db.commit()
    await db.refresh(result)
    return to_ranked(result, cv)


async def get_result(db: AsyncSession, result_id: int) -> tuple[MatchResult, CV]:
    result = await db.scalar(
        select(MatchResult).where(MatchResult.id == result_id).options(selectinload(MatchResult.decision))
    )
    if result is None:
        raise NotFoundError("Match result", result_id)
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


# ── Screening history ───────────────────────────────────────
async def list_history(
    db: AsyncSession,
    *,
    page: int,
    page_size: int,
    job_id: int | None = None,
    decision_status: DecisionStatus | None = None,
    search: str | None = None,
) -> PaginatedResponse[HistoryItem]:
    """Every scored CV/JD pair, newest activity first (a decision counts as activity)."""
    decider = aliased(User)
    activity = func.coalesce(Decision.updated_at, MatchResult.updated_at, MatchResult.created_at)

    filters = []
    if job_id is not None:
        filters.append(MatchResult.job_id == job_id)
    if decision_status == DecisionStatus.PENDING:
        filters.append(or_(Decision.id.is_(None), Decision.status == DecisionStatus.PENDING))
    elif decision_status is not None:
        filters.append(Decision.status == decision_status)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(or_(CV.candidate_name.ilike(pattern), Job.title.ilike(pattern)))

    base = (
        select(MatchResult, Decision, Job.title, CV.candidate_name, decider.full_name)
        .join(Job, Job.id == MatchResult.job_id)
        .join(CV, CV.id == MatchResult.cv_id)
        .outerjoin(Decision, Decision.match_result_id == MatchResult.id)
        .outerjoin(decider, decider.id == Decision.decided_by)
        .where(*filters)
    )
    total = await db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = (
        await db.execute(
            base.order_by(activity.desc(), MatchResult.id.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).all()

    items = [
        HistoryItem(
            result_id=result.id,
            job_id=result.job_id,
            job_title=job_title,
            cv_id=result.cv_id,
            candidate_name=candidate_name,
            ai_score=result.overall_score,
            effective_score=(
                decision.score_override
                if decision is not None and decision.score_override is not None
                else result.overall_score
            ),
            decision_status=decision.status if decision is not None else DecisionStatus.PENDING,
            decision_reason=decision.reason if decision is not None else None,
            decided_by_name=decider_name,
            decided_at=decision.updated_at if decision is not None else None,
            scored_at=result.updated_at or result.created_at,
            model_name=result.model_name,
        )
        for result, decision, job_title, candidate_name, decider_name in rows
    ]
    return PaginatedResponse[HistoryItem].create(items, total, page, page_size)
