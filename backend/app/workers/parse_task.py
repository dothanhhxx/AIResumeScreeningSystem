"""
Celery parse task — CV text extraction pipeline.
Owner: Person B (Ngày 3)

Responsibilities:
  1. Downloads CV file from MinIO storage.
  2. Dispatches to the parsing factory (PDF, DOCX, OCR) based on cv.file_type.
  3. Updates CV.status → PARSED and stores extracted text in CV.raw_text.
  4. Triggers downstream extract_task (Person C's task) via Celery.
  5. Implements retries and error reporting if extraction fails.
"""

import asyncio
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.database import async_session_factory, create_worker_session_factory
from app.core.exceptions import StorageServiceError
from app.models.cv import CV, CVStatus
from app.services.cv_service import read_cv_file
from app.services.parsing import parse_document
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _trigger_downstream_extract(cv_id: int) -> None:
    """Enqueue Person C's extract_info_task (Celery or inline, see app/workers/dispatch.py)."""
    from app.workers.dispatch import enqueue_extract  # noqa: PLC0415

    try:
        enqueue_extract(cv_id)
        logger.info("[parse_cv_task] Triggered extract_info_task for cv_id=%d.", cv_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[parse_cv_task] extract_info_task could not be enqueued for cv_id=%d: %s", cv_id, exc)


async def _process_cv_parsing(
    cv_id: int,
    session_factory: async_sessionmaker[AsyncSession] | None = None,
) -> dict[str, Any]:
    """
    Async implementation of the parsing workflow:
      DB fetch → storage download → parsing factory → DB update → trigger downstream.

    Output contract for Person C (raw_text): plain UTF-8 text normalised by
    parsing.base.clean_text — LF line endings, single spaces, at most one blank
    line between blocks, pages simply concatenated, no markup.
    """
    factory = session_factory or async_session_factory
    async with factory() as db:
        # 1. Fetch CV from database
        result = await db.execute(select(CV).where(CV.id == cv_id))
        cv = result.scalar_one_or_none()
        if cv is None:
            logger.error("[parse_cv_task] CV with id=%d not found in database.", cv_id)
            return {"cv_id": cv_id, "status": "not_found", "error": f"CV {cv_id} not found"}

        # 2. Update status to PARSING
        cv.status = CVStatus.PARSING
        cv.error_message = None
        await db.commit()
        await db.refresh(cv)
        logger.info("[parse_cv_task] CV %d status set to PARSING.", cv_id)

        try:
            # 3. Load the original file (database copy first, then object storage)
            file_bytes = await read_cv_file(db, cv)
            logger.info("[parse_cv_task] Downloaded %d bytes from '%s'.", len(file_bytes), cv.file_url)

            # 4. Extract text using the parsing factory
            extracted_text = await asyncio.to_thread(
                parse_document,
                content=file_bytes,
                file_type=cv.file_type,
                enable_ocr=True,
            )

            # 5. Scan candidate identity (name & email) from raw text and save parsed text
            from app.services.extraction.heuristic import (  # noqa: PLC0415
                extract_candidate_identity,
                infer_name_from_filename,
            )

            detected_name, detected_email = extract_candidate_identity(extracted_text)
            current_name = getattr(cv, "candidate_name", None)
            file_name = getattr(cv, "file_name", None)
            if detected_name and (
                not isinstance(current_name, str)
                or not current_name.strip()
                or current_name == infer_name_from_filename(file_name if isinstance(file_name, str) else None)
            ):
                cv.candidate_name = detected_name
            current_email = getattr(cv, "candidate_email", None)
            if detected_email and (not isinstance(current_email, str) or not current_email.strip()):
                cv.candidate_email = detected_email

            cv.raw_text = extracted_text
            cv.status = CVStatus.PARSED
            await db.commit()
            await db.refresh(cv)

            logger.info(
                "[parse_cv_task] CV %d successfully parsed (%d characters extracted). Status → PARSED.",
                cv_id,
                len(extracted_text),
            )

            # 6. Trigger downstream extract_task (Celery chain)
            _trigger_downstream_extract(cv_id)

            return {
                "cv_id": cv_id,
                "status": "parsed",
                "char_count": len(extracted_text),
            }

        except Exception as exc:
            # Mark CV as ERROR on parsing failure
            logger.exception("[parse_cv_task] Error parsing CV %d: %s", cv_id, exc)
            cv.status = CVStatus.ERROR
            cv.error_message = f"Parsing failed: {exc}"[:2000]
            await db.commit()
            raise


@celery_app.task(
    bind=True,
    name="app.workers.parse_task.parse_cv_task",
    max_retries=3,
    default_retry_delay=30,
    queue="parse",
)
def parse_cv_task(self, cv_id: int) -> dict[str, Any]:
    """
    Celery task entrypoint to parse the text of an uploaded CV.

    Args:
        cv_id: Primary key of the CV record to parse.

    Returns:
        Dict with keys ``cv_id`` and ``status``.
    """
    logger.info("[parse_cv_task] Starting task execution for cv_id=%d (retry #%d).", cv_id, self.request.retries)

    try:
        # Run async parsing pipeline in synchronous Celery task worker
        return asyncio.run(_process_cv_parsing(cv_id, create_worker_session_factory()))
    except (StorageServiceError, ConnectionError) as transient_exc:
        logger.warning(
            "[parse_cv_task] Transient error processing cv_id=%d: %s. Scheduling retry.",
            cv_id,
            transient_exc,
        )
        raise self.retry(exc=transient_exc)
    except Exception as exc:
        logger.error("[parse_cv_task] Permanent failure for cv_id=%d: %s", cv_id, exc)
        return {"cv_id": cv_id, "status": "error", "error": str(exc)}
