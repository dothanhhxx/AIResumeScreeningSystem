"""
Celery parse task — CV text extraction.
Owner: Person B (stub for Ngày 2; full implementation in Ngày 3)

This module is imported by celery_app.py so Celery can discover the task.
The actual parsing logic (PDF / DOCX parsers) will be wired up on Ngày 3.
"""

import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="app.workers.parse_task.parse_cv_task",
    max_retries=3,
    default_retry_delay=30,
    queue="parse",
)
def parse_cv_task(self, cv_id: int) -> dict:
    """
    Parse the text content of an uploaded CV.

    Args:
        cv_id: Primary key of the CV record to parse.

    Returns:
        A dict with keys ``cv_id`` and ``status``.

    The task:
        1. Downloads the CV file from MinIO.
        2. Dispatches to the correct parser (PDF / DOCX / OCR) based on file_type.
        3. Updates CV.status → PARSED and CV.raw_text in the database.
        4. (Ngày 3) Triggers the downstream extract_task.
    """
    logger.info("[parse_cv_task] Starting for cv_id=%d", cv_id)

    # TODO(Person B, Ngày 3): implement full parsing pipeline
    #   from app.services.parsing import get_parser
    #   from app.services.storage_service import storage_service
    #   import asyncio, app.services.cv_service as cv_service
    #   ... (see Ngày 3 tasks)

    # Stub: mark as placeholder so the queue does not silently discard tasks
    logger.warning(
        "[parse_cv_task] cv_id=%d: parsing not yet implemented (stub). "
        "Full implementation due Ngày 3.",
        cv_id,
    )
    return {"cv_id": cv_id, "status": "stub_not_implemented"}
