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

from app.core.database import async_session_factory
from app.core.exceptions import StorageServiceError
from app.models.cv import CV, CVStatus
from app.services.parsing import parse_document
from app.services.storage_service import storage_service
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _trigger_downstream_extract(cv_id: int) -> None:
    """
    Attempt to enqueue the downstream extract_task owned by Person C.

    Uses dynamic discovery so parse_cv_task succeeds even when extract_task
    is still being developed by Person C.
    """
    task_name = "app.workers.extract_task.extract_info_task"
    try:
        celery_app.send_task(task_name, args=[cv_id], queue="extract")
        logger.info("[parse_cv_task] Triggered downstream task '%s' for cv_id=%d.", task_name, cv_id)
    except Exception as exc:
        logger.warning(
            "[parse_cv_task] Downstream extract task '%s' could not be enqueued (Person C): %s",
            task_name,
            exc,
        )


async def _process_cv_parsing(cv_id: int) -> dict[str, Any]:
    """
    Async implementation of the parsing workflow:
      DB fetch → MinIO download → parsing factory → DB update → trigger downstream.
    """
    async with async_session_factory() as db:
        # 1. Fetch CV from database
        result = await db.execute(select(CV).where(CV.id == cv_id))
        cv = result.scalar_one_or_none()
        if cv is None:
            logger.error("[parse_cv_task] CV with id=%d not found in database.", cv_id)
            return {"cv_id": cv_id, "status": "not_found", "error": f"CV {cv_id} not found"}

        # 2. Update status to PARSING
        cv.status = CVStatus.PARSING
        await db.commit()
        await db.refresh(cv)
        logger.info("[parse_cv_task] CV %d status set to PARSING.", cv_id)

        try:
            # 3. Download raw file from MinIO
            file_bytes = storage_service.download_file(cv.file_url)
            logger.info("[parse_cv_task] Downloaded %d bytes from '%s'.", len(file_bytes), cv.file_url)

            # 4. Extract text using the parsing factory
            extracted_text = parse_document(
                content=file_bytes,
                file_type=cv.file_type,
                enable_ocr=True,
            )

            # 5. Save parsed text and update status to PARSED
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
        return asyncio.run(_process_cv_parsing(cv_id))
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
