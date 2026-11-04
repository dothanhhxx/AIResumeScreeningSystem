"""
Matching API — trigger scoring, read rankings, record recruiter decisions.
Owner: Person D

    POST /api/v1/matching/run                         queue scoring of CVs against a JD
    GET  /api/v1/matching/jobs/{job_id}/results       ranked candidates (+ ?decision_status=)
    GET  /api/v1/matching/results/{result_id}         one result with evidence
    PUT  /api/v1/matching/results/{result_id}/decision  recruiter decision + optional score override
    GET  /api/v1/matching/history                     screening history (paginated, filterable)
"""

import asyncio

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_roles
from app.models.audit_log import AuditAction
from app.models.decision import DecisionStatus
from app.models.user import User, UserRole
from app.schemas.common import ApiResponse, PaginatedResponse
from app.schemas.matching import (
    DecisionRead,
    DecisionUpsert,
    HistoryItem,
    JobRanking,
    MatchRequest,
    MatchRunResponse,
    RankedMatch,
)
from app.services import audit_service, matching_service
from app.workers.dispatch import enqueue_score

router = APIRouter(prefix="/matching", tags=["Matching"])


@router.post("/run", response_model=ApiResponse[MatchRunResponse], status_code=status.HTTP_202_ACCEPTED)
async def run_matching(
    payload: MatchRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.RECRUITER)),
) -> ApiResponse[MatchRunResponse]:
    job = await matching_service.get_job_or_404(db, payload.job_id)
    run = await matching_service.start_matching(db, job, payload.cv_ids)
    for cv_id in run.cv_ids:
        await asyncio.to_thread(enqueue_score, job.id, cv_id)
    await audit_service.record(
        db,
        AuditAction.MATCH_RUN,
        user=current_user,
        resource_type="job",
        resource_id=job.id,
        detail={"queued": run.queued, "skipped": run.skipped},
        request=request,
    )
    message = f"Scoring {run.queued} CV(s) in the background." if run.queued else "No CVs are ready for matching."
    return ApiResponse(message=message, data=run)


@router.get("/jobs/{job_id}/results", response_model=ApiResponse[JobRanking])
async def get_job_ranking(
    job_id: int,
    decision_status: DecisionStatus | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[JobRanking]:
    job = await matching_service.get_job_or_404(db, job_id)
    return ApiResponse(data=await matching_service.get_ranking(db, job, decision_status))


@router.get("/results/{result_id}", response_model=ApiResponse[RankedMatch])
async def get_match_result(
    result_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[RankedMatch]:
    result, cv = await matching_service.get_result(db, result_id)
    ranked = matching_service.to_ranked(result, cv)
    await audit_service.record(
        db, AuditAction.MATCH_VIEW, user=current_user, resource_type="match_result", resource_id=result.id,
        request=request,
    )
    return ApiResponse(data=ranked)


@router.put("/results/{result_id}/decision", response_model=ApiResponse[DecisionRead])
async def save_decision(
    result_id: int,
    payload: DecisionUpsert,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.RECRUITER)),
) -> ApiResponse[DecisionRead]:
    result, _ = await matching_service.get_result(db, result_id)
    decision, created = await matching_service.upsert_decision(db, result, payload, current_user)
    await audit_service.record(
        db,
        AuditAction.DECISION_CREATE if created else AuditAction.DECISION_UPDATE,
        user=current_user,
        resource_type="match_result",
        resource_id=result.id,
        detail={
            "status": payload.status.value,
            "score_override": payload.score_override,
            "ai_score": result.overall_score,
            "reason": payload.reason,
        },
        request=request,
    )
    return ApiResponse(message="Decision saved.", data=DecisionRead.model_validate(decision))


@router.get("/history", response_model=ApiResponse[PaginatedResponse[HistoryItem]])
async def screening_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    job_id: int | None = Query(default=None),
    decision_status: DecisionStatus | None = Query(default=None),
    search: str | None = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ApiResponse[PaginatedResponse[HistoryItem]]:
    """Company-shared: every signed-in role can read the screening history."""
    history = await matching_service.list_history(
        db, page=page, page_size=page_size, job_id=job_id, decision_status=decision_status, search=search
    )
    return ApiResponse(data=history)
