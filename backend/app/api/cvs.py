"""
CV upload & management API router.
Owner: Person B

Endpoints:
    POST   /api/v1/cvs/upload        — Upload a single CV (multipart)
    POST   /api/v1/cvs/upload/batch  — Upload multiple CVs (multipart)
    GET    /api/v1/cvs               — List CVs (paginated, filterable)
    GET    /api/v1/cvs/{cv_id}       — Get a single CV by ID
    DELETE /api/v1/cvs/{cv_id}       — Delete a CV (admin or owner)
    GET    /api/v1/cvs/{cv_id}/url   — Get a presigned download URL

Note:
    Person A mounts this router in app/main.py:
        from app.api import cvs
        api_router.include_router(cvs.router)
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_roles
from app.core.exceptions import AppError
from app.models.cv import CVStatus
from app.models.user import User, UserRole
from app.schemas.common import ApiResponse, PaginatedResponse
from app.schemas.cv import (
    CVBatchUploadResponse,
    CVResponse,
    CVSummaryResponse,
)
from app.services import cv_service
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cvs", tags=["CVs"])


# ── Helper ───────────────────────────────────────────────────────────────────

def _enqueue_parse_task(cv_id: int) -> None:
    """
    Enqueue a Celery parse task for the given CV.

    Import is deferred to avoid importing Celery at module load time
    (which would fail if Redis is not available during testing).
    """
    try:
        from app.workers.parse_task import parse_cv_task  # noqa: PLC0415

        parse_cv_task.apply_async(args=[cv_id], queue="parse")
        logger.info("Enqueued parse_cv_task for CV %d.", cv_id)
    except Exception as exc:  # noqa: BLE001
        # Non-fatal: log and continue — status remains UPLOADED, can be retried
        logger.warning("Failed to enqueue parse task for CV %d: %s", cv_id, exc)


# ── Single upload ─────────────────────────────────────────────────────────────

@router.post(
    "/upload",
    response_model=ApiResponse[CVResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload a single CV",
    description=(
        "Upload one PDF or DOCX resume. The file is stored in MinIO and a "
        "background Celery task is enqueued to extract the text."
    ),
)
async def upload_cv(
    candidate_name: str = Form(..., description="Candidate's full name"),
    candidate_email: str | None = Form(default=None, description="Candidate's email (optional)"),
    file: UploadFile = File(..., description="CV file (PDF or DOCX, max 10 MB)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[CVResponse]:
    """Upload a single CV file and enqueue it for parsing."""
    try:
        cv = await cv_service.create_cv(
            db,
            file,
            candidate_name=candidate_name,
            candidate_email=candidate_email or None,
            uploader_id=current_user.id,
        )
    except AppError:
        raise
    except Exception as exc:
        logger.exception("Unexpected error during CV upload.")
        raise HTTPException(status_code=500, detail="CV upload failed.") from exc

    # Enqueue parsing task (fire-and-forget, non-blocking)
    await asyncio.get_event_loop().run_in_executor(None, _enqueue_parse_task, cv.id)

    return ApiResponse(
        message="CV uploaded and queued for parsing.",
        data=CVResponse.model_validate(cv),
    )


# ── Batch upload ──────────────────────────────────────────────────────────────

@router.post(
    "/upload/batch",
    response_model=ApiResponse[CVBatchUploadResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload multiple CVs",
    description=(
        "Upload up to 20 CV files in one request. Files are processed "
        "independently — failures do not abort the entire batch."
    ),
)
async def upload_cv_batch(
    candidate_name: str = Form(..., description="Candidate's full name (applies to all files)"),
    candidate_email: str | None = Form(default=None),
    files: list[UploadFile] = File(..., description="List of CV files (PDF/DOCX, max 10 MB each)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[CVBatchUploadResponse]:
    """Upload multiple CV files in a single request."""
    if len(files) > 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 20 files per batch upload.",
        )

    results = await cv_service.create_cv_batch(
        db,
        files,
        candidate_name=candidate_name,
        candidate_email=candidate_email or None,
        uploader_id=current_user.id,
    )

    # Enqueue parse tasks for all successful uploads
    for item in results:
        if item.success and item.cv_id is not None:
            await asyncio.get_event_loop().run_in_executor(
                None, _enqueue_parse_task, item.cv_id
            )

    succeeded = sum(1 for r in results if r.success)
    response_data = CVBatchUploadResponse(
        total=len(files),
        succeeded=succeeded,
        failed=len(files) - succeeded,
        results=results,
    )
    return ApiResponse(
        message=f"Batch upload complete: {succeeded}/{len(files)} succeeded.",
        data=response_data,
    )


# ── List CVs ──────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=ApiResponse[PaginatedResponse[CVSummaryResponse]],
    summary="List CVs",
    description=(
        "Return a paginated list of CVs. Admins see all CVs; regular users "
        "see only their own uploads. Optionally filter by status."
    ),
)
async def list_cvs(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    status_filter: CVStatus | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[PaginatedResponse[CVSummaryResponse]]:
    """List CVs with pagination and optional status filter."""
    # Admins see all; regular users see only their own
    uploader_filter: int | None = None
    if current_user.role not in (UserRole.ADMIN, UserRole.RECRUITER):
        uploader_filter = current_user.id

    cvs, total = await cv_service.list_cvs(
        db,
        page=page,
        page_size=page_size,
        status=status_filter,
        uploaded_by=uploader_filter,
    )

    items = [CVSummaryResponse.model_validate(cv) for cv in cvs]
    paginated = PaginatedResponse.create(
        items=items, total=total, page=page, page_size=page_size
    )
    return ApiResponse(data=paginated)


# ── Get single CV ─────────────────────────────────────────────────────────────

@router.get(
    "/{cv_id}",
    response_model=ApiResponse[CVResponse],
    summary="Get CV by ID",
)
async def get_cv(
    cv_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[CVResponse]:
    """Retrieve detailed information about a specific CV."""
    cv = await cv_service.get_cv(db, cv_id)

    # Non-admin users may only view their own CVs
    if (
        current_user.role not in (UserRole.ADMIN, UserRole.RECRUITER)
        and cv.uploaded_by != current_user.id
    ):
        from app.core.exceptions import PermissionDeniedError  # noqa: PLC0415

        raise PermissionDeniedError()

    return ApiResponse(data=CVResponse.model_validate(cv))


# ── Delete CV ─────────────────────────────────────────────────────────────────

@router.delete(
    "/{cv_id}",
    response_model=ApiResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Delete a CV",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.RECRUITER))],
)
async def delete_cv(
    cv_id: int,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """Delete a CV record and its associated file from MinIO (admin/recruiter only)."""
    await cv_service.delete_cv(db, cv_id)
    return ApiResponse(message=f"CV {cv_id} deleted successfully.", data=None)


# ── Presigned download URL ────────────────────────────────────────────────────

@router.get(
    "/{cv_id}/url",
    response_model=ApiResponse[dict],
    summary="Get presigned download URL",
    description="Generate a time-limited presigned URL to download the CV file directly from MinIO.",
)
async def get_cv_download_url(
    cv_id: int,
    expires_in: int = Query(default=3600, ge=60, le=86400, description="URL validity in seconds"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[dict]:
    """Return a presigned GET URL for the CV's stored file."""
    cv = await cv_service.get_cv(db, cv_id)

    # Access control: non-admin users can only download their own CVs
    if (
        current_user.role not in (UserRole.ADMIN, UserRole.RECRUITER)
        and cv.uploaded_by != current_user.id
    ):
        from app.core.exceptions import PermissionDeniedError  # noqa: PLC0415

        raise PermissionDeniedError()

    url = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: storage_service.get_presigned_url(cv.file_url, expires_in=expires_in),
    )
    return ApiResponse(
        message="Presigned URL generated.",
        data={"url": url, "expires_in": expires_in},
    )
