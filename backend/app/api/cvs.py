"""
CV upload & management API router.
Company-shared model: every signed-in user can read every CV; only
admins/recruiters can upload or reprocess, and only an admin or the uploader can delete.
Owner: Person B

Endpoints:
    POST   /api/v1/cvs/upload        — Upload a single CV (multipart)
    POST   /api/v1/cvs/upload/batch  — Upload multiple CVs (multipart)
    GET    /api/v1/cvs               — List CVs (paginated, filterable)
    GET    /api/v1/cvs/{cv_id}       — Get a single CV by ID
    DELETE /api/v1/cvs/{cv_id}       — Delete a CV (admin, or the recruiter who uploaded it)
    GET    /api/v1/cvs/{cv_id}/url   — Get a presigned download URL (MinIO only)
    GET    /api/v1/cvs/{cv_id}/file  — Download the original file (any storage backend)
    POST   /api/v1/cvs/{cv_id}/reprocess — Re-run parse → extract for a CV
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_roles
from app.core.exceptions import AppError, PermissionDeniedError
from app.models.audit_log import AuditAction
from app.models.cv import CV, CVStatus
from app.models.user import User, UserRole
from app.schemas.common import ApiResponse, PaginatedResponse
from app.schemas.cv import (
    CVBatchUploadResponse,
    CVResponse,
    CVSummaryResponse,
)
from app.services import audit_service, cv_service
from app.services.storage_service import ALLOWED_CONTENT_TYPES, storage_service
from app.workers.dispatch import enqueue_parse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cvs", tags=["CVs"])


# ── Helper ───────────────────────────────────────────────────────────────────

def _enqueue_parse_task(cv_id: int) -> None:
    """Queue parsing (Celery or inline, see app/workers/dispatch.py). Non-fatal on failure."""
    try:
        enqueue_parse(cv_id)
        logger.info("Enqueued parse task for CV %d.", cv_id)
    except Exception as exc:  # noqa: BLE001
        # Non-fatal: status remains UPLOADED and the CV can be reprocessed later
        logger.warning("Failed to enqueue parse task for CV %d: %s", cv_id, exc)


def _ensure_can_delete(cv: CV, user: User) -> None:
    if user.role != UserRole.ADMIN and cv.uploaded_by != user.id:
        raise PermissionDeniedError("Only the uploader or an admin can delete this CV")


_writer = require_roles(UserRole.ADMIN, UserRole.RECRUITER)


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
    request: Request,
    candidate_name: str = Form(..., description="Candidate's full name"),
    candidate_email: str | None = Form(default=None, description="Candidate's email (optional)"),
    file: UploadFile = File(..., description="CV file (PDF or DOCX, max 10 MB)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_writer),
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

    await audit_service.record(
        db, AuditAction.CV_UPLOAD, user=current_user, resource_type="cv", resource_id=cv.id,
        detail={"file_name": cv.file_name, "file_size": cv.file_size}, request=request,
    )
    # Enqueue parsing task (fire-and-forget, non-blocking)
    await asyncio.to_thread(_enqueue_parse_task, cv.id)

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
    current_user: User = Depends(_writer),
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
            await audit_service.record(
                db, AuditAction.CV_UPLOAD, user=current_user, resource_type="cv", resource_id=item.cv_id,
                detail={"file_name": item.file_name, "batch": True},
            )
            await asyncio.to_thread(_enqueue_parse_task, item.cv_id)

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
        "Return a paginated list of the company's CVs (visible to every role). "
        "Optionally filter by status."
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
    cvs, total = await cv_service.list_cvs(
        db,
        page=page,
        page_size=page_size,
        status=status_filter,
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
    return ApiResponse(data=CVResponse.model_validate(cv))


# ── Delete CV ─────────────────────────────────────────────────────────────────

@router.delete(
    "/{cv_id}",
    response_model=ApiResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Delete a CV",
)
async def delete_cv(
    cv_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_writer),
) -> ApiResponse[None]:
    """Delete a CV record and its associated file from storage (admin or uploader only)."""
    _ensure_can_delete(await cv_service.get_cv(db, cv_id), current_user)
    await cv_service.delete_cv(db, cv_id)
    await audit_service.record(
        db, AuditAction.CV_DELETE, user=current_user, resource_type="cv", resource_id=cv_id, request=request
    )
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
    url = await asyncio.to_thread(storage_service.get_presigned_url, cv.file_url, expires_in)
    return ApiResponse(
        message="Presigned URL generated.",
        data={"url": url, "expires_in": expires_in},
    )


# ── Download original file ────────────────────────────────────────────────────

_MIME_BY_EXT = {ext: mime for mime, ext in ALLOWED_CONTENT_TYPES.items()}


@router.get("/{cv_id}/file", summary="Download the original CV file")
async def download_cv_file(
    cv_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    cv = await cv_service.get_cv(db, cv_id)
    content = await asyncio.to_thread(storage_service.download_file, cv.file_url)
    await audit_service.record(
        db, AuditAction.CV_VIEW, user=current_user, resource_type="cv", resource_id=cv.id, request=request
    )
    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in cv.file_name) or f"cv_{cv.id}"
    return Response(
        content=content,
        media_type=_MIME_BY_EXT.get(cv.file_type, "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


# ── Reprocess ─────────────────────────────────────────────────────────────────

@router.post(
    "/{cv_id}/reprocess",
    response_model=ApiResponse[CVResponse],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Re-run parsing and extraction",
)
async def reprocess_cv(
    cv_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_writer),
) -> ApiResponse[CVResponse]:
    cv = await cv_service.get_cv(db, cv_id)
    cv.status = CVStatus.UPLOADED
    cv.error_message = None
    await db.commit()
    await db.refresh(cv)
    await asyncio.to_thread(_enqueue_parse_task, cv.id)
    return ApiResponse(message="CV queued for reprocessing.", data=CVResponse.model_validate(cv))
