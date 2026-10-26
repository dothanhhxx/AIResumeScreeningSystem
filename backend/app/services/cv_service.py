"""
CV service — business logic for the CV upload/parse pipeline.
Owner: Person B

Responsibilities:
  - Validate uploaded files (type, size)
  - Generate deterministic object keys for MinIO
  - Coordinate with storage_service to persist files
  - Create / update CV records in the database
  - Enqueue Celery parse tasks

Public API (used by app/api/cvs.py):
    create_cv(db, file, *, candidate_name, candidate_email, uploader_id) -> CV
    create_cv_batch(db, files, *, candidate_name, uploader_id) -> list[result]
    get_cv(db, cv_id) -> CV
    list_cvs(db, *, page, page_size, status, uploaded_by) -> (list[CV], int)
    update_cv_status(db, cv_id, status, *, raw_text, structured_data) -> CV
    delete_cv(db, cv_id) -> None
"""

import hashlib
import logging
import mimetypes
import uuid
from typing import IO

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, UnsupportedFileTypeError
from app.models.cv import CV, CVStatus
from app.schemas.cv import CVBatchItemResult, CVStatusUpdate
from app.services.storage_service import ALLOWED_CONTENT_TYPES, storage_service

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


# ── Helpers ──────────────────────────────────────────────────────────────────

def _detect_content_type(file: UploadFile) -> str:
    """
    Determine MIME type from the upload's declared content_type, falling back
    to mimetypes based on the filename.

    Returns a key from ALLOWED_CONTENT_TYPES or raises UnsupportedFileTypeError.
    """
    content_type = file.content_type or ""
    if content_type in ALLOWED_CONTENT_TYPES:
        return content_type

    # Fallback: guess from filename extension
    guessed, _ = mimetypes.guess_type(file.filename or "")
    if guessed and guessed in ALLOWED_CONTENT_TYPES:
        return guessed

    raise UnsupportedFileTypeError(content_type or (file.filename or "unknown"))


def _build_object_key(file_type: str, candidate_name: str) -> str:
    """
    Build a unique MinIO object key.

    Pattern: ``resumes/<uuid4>_<safe_name>.<ext>``
    """
    safe_name = "".join(
        c if c.isalnum() or c in "-_" else "_"
        for c in candidate_name.lower().replace(" ", "_")
    )
    unique_id = uuid.uuid4().hex[:12]
    extension = ALLOWED_CONTENT_TYPES[file_type]
    return f"resumes/{unique_id}_{safe_name}.{extension}"


def _compute_sha256(data: bytes) -> str:
    """Return the hex SHA-256 digest of *data* (used for deduplication later)."""
    return hashlib.sha256(data).hexdigest()


# ── Service functions ─────────────────────────────────────────────────────────

async def create_cv(
    db: AsyncSession,
    file: UploadFile,
    *,
    candidate_name: str,
    candidate_email: str | None = None,
    uploader_id: int | None = None,
) -> CV:
    """
    Process a single CV upload:

    1. Validate file type and size.
    2. Upload raw bytes to MinIO.
    3. Persist a CV record with status=UPLOADED.
    4. (Celery parse task is enqueued by the API layer, not here, to keep
       this function unit-testable without a running broker.)

    Args:
        db:              Async SQLAlchemy session.
        file:            FastAPI UploadFile from multipart form.
        candidate_name:  Candidate's full name.
        candidate_email: Optional email address.
        uploader_id:     ID of the authenticated user performing the upload.

    Returns:
        The newly created CV ORM instance.

    Raises:
        UnsupportedFileTypeError: For non-PDF/DOCX uploads.
        BadRequestError:          If the file exceeds MAX_FILE_SIZE_BYTES.
        StorageServiceError:      If MinIO upload fails.
    """
    from app.core.exceptions import BadRequestError  # local import to avoid circular

    content_type = _detect_content_type(file)
    file_ext = ALLOWED_CONTENT_TYPES[content_type]

    # Read file into memory
    file_bytes: bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise BadRequestError(
            f"File size {len(file_bytes)} bytes exceeds limit of {MAX_FILE_SIZE_BYTES} bytes."
        )

    object_key = _build_object_key(content_type, candidate_name)

    # Upload to MinIO (sync call — small files, acceptable in async context)
    storage_service.upload_file(
        file_bytes=file_bytes,
        object_key=object_key,
        content_type=content_type,
    )

    # Persist CV record
    cv = CV(
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        file_name=file.filename or f"upload.{file_ext}",
        file_url=object_key,
        file_size=len(file_bytes),
        file_type=file_ext,
        status=CVStatus.UPLOADED,
        uploaded_by=uploader_id,
    )
    db.add(cv)
    await db.commit()
    await db.refresh(cv)

    logger.info(
        "CV created: id=%d candidate='%s' key='%s'",
        cv.id,
        cv.candidate_name,
        object_key,
    )
    return cv


async def create_cv_batch(
    db: AsyncSession,
    files: list[UploadFile],
    *,
    candidate_name: str,
    candidate_email: str | None = None,
    uploader_id: int | None = None,
) -> list[CVBatchItemResult]:
    """
    Upload multiple CV files in a single request.

    Each file is processed independently; failures do not abort the batch.

    Returns:
        A list of CVBatchItemResult — one entry per submitted file.
    """
    results: list[CVBatchItemResult] = []
    for file in files:
        try:
            cv = await create_cv(
                db,
                file,
                candidate_name=candidate_name,
                candidate_email=candidate_email,
                uploader_id=uploader_id,
            )
            results.append(
                CVBatchItemResult(
                    file_name=file.filename or "unknown",
                    success=True,
                    cv_id=cv.id,
                )
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Batch upload failed for '%s': %s", file.filename, exc)
            results.append(
                CVBatchItemResult(
                    file_name=file.filename or "unknown",
                    success=False,
                    error=str(exc),
                )
            )
    return results


async def get_cv(db: AsyncSession, cv_id: int) -> CV:
    """
    Fetch a single CV by primary key.

    Raises:
        NotFoundError: if no CV with *cv_id* exists.
    """
    cv = await db.get(CV, cv_id)
    if cv is None:
        raise NotFoundError("CV", cv_id)
    return cv


async def list_cvs(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 20,
    status: CVStatus | None = None,
    uploaded_by: int | None = None,
) -> tuple[list[CV], int]:
    """
    Return a paginated list of CVs with optional filters.

    Args:
        db:          Async SQLAlchemy session.
        page:        1-based page number.
        page_size:   Number of items per page (max 100).
        status:      Filter by CVStatus if provided.
        uploaded_by: Filter by uploader user ID if provided.

    Returns:
        A tuple of (cv_list, total_count).
    """
    query = select(CV)
    count_query = select(func.count()).select_from(CV)

    if status is not None:
        query = query.where(CV.status == status)
        count_query = count_query.where(CV.status == status)

    if uploaded_by is not None:
        query = query.where(CV.uploaded_by == uploaded_by)
        count_query = count_query.where(CV.uploaded_by == uploaded_by)

    total: int = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size).order_by(CV.created_at.desc()))
    cvs = list(result.scalars().all())

    return cvs, total


async def update_cv_status(
    db: AsyncSession,
    cv_id: int,
    update: CVStatusUpdate,
) -> CV:
    """
    Update CV status and optionally set raw_text / structured_data.

    Called by Celery task callbacks to report parse/extract/score results.

    Raises:
        NotFoundError: if *cv_id* does not exist.
    """
    cv = await get_cv(db, cv_id)
    cv.status = update.status
    if update.raw_text is not None:
        cv.raw_text = update.raw_text
    if update.structured_data is not None:
        cv.structured_data = update.structured_data
    await db.commit()
    await db.refresh(cv)
    logger.info("CV %d status updated → %s", cv_id, update.status.value)
    return cv


async def delete_cv(db: AsyncSession, cv_id: int) -> None:
    """
    Delete a CV record and its associated MinIO file.

    Raises:
        NotFoundError: if *cv_id* does not exist.
    """
    cv = await get_cv(db, cv_id)
    # Remove file from storage
    try:
        storage_service.delete_file(cv.file_url)
    except Exception as exc:  # noqa: BLE001
        # Log but do not abort — the DB record should still be removed
        logger.warning("MinIO delete failed for '%s': %s", cv.file_url, exc)

    await db.delete(cv)
    await db.commit()
    logger.info("CV %d deleted.", cv_id)
