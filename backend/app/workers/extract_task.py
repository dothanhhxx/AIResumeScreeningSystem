"""
Celery extract task — raw_text → structured CVExtraction + CV embedding.
Owner: Person C

Triggered by parse_cv_task (Person B) once a CV is PARSED.
Status flow: PARSED → EXTRACTING → EXTRACTED (or SCORING → SCORED when linked to a target JD).
"""

import asyncio
import json
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.database import async_session_factory, create_worker_session_factory
from app.llm import get_llm_or_none
from app.llm.factory import get_llm
from app.models.cv import CV, CVStatus
from app.services.extraction import extract_cv
from app.services.matching.embeddings import dump_embedding, embed_text
from app.services.matching.semantic_scorer import cv_profile_text
from app.workers.celery_app import celery_app
from app.workers.dispatch import enqueue_score, pop_target_job

logger = logging.getLogger(__name__)


def _existing_target_job_id(structured_data: str | None) -> int | None:
    if not structured_data:
        return None
    try:
        parsed = json.loads(structured_data)
        if isinstance(parsed, dict) and isinstance(parsed.get("target_job_id"), int):
            return parsed["target_job_id"]
    except json.JSONDecodeError:
        return None
    return None


async def process_extraction(
    cv_id: int,
    session_factory: async_sessionmaker[AsyncSession] | None = None,
) -> dict[str, Any]:
    factory = session_factory or async_session_factory
    async with factory() as db:
        cv = await db.get(CV, cv_id)
        if cv is None:
            return {"cv_id": cv_id, "status": "not_found"}
        if not cv.raw_text:
            cv.status = CVStatus.ERROR
            cv.error_message = "No parsed text to extract from."
            await db.commit()
            return {"cv_id": cv_id, "status": "error", "error": cv.error_message}

        target_job_id = pop_target_job(cv_id) or _existing_target_job_id(cv.structured_data)

        cv.status = CVStatus.EXTRACTING
        cv.error_message = None
        await db.commit()

        try:
            llm = get_llm_or_none()
            extraction, source = await extract_cv(cv.raw_text, candidate_name=cv.candidate_name, llm=llm)
            vector, model = await embed_text(cv_profile_text(extraction), llm)

            data = extraction.model_dump()
            data["extraction_source"] = source
            if target_job_id is not None:
                data["target_job_id"] = target_job_id

            cv.structured_data = json.dumps(data, ensure_ascii=False)
            cv.embedding = dump_embedding(vector, model)

            if target_job_id is not None:
                cv.status = CVStatus.SCORING
                await db.commit()
                enqueue_score(target_job_id, cv_id)
                logger.info(
                    "[extract] CV %d extracted with %s (%d skills) and auto-queued for job %d.",
                    cv_id,
                    source,
                    len(extraction.skills),
                    target_job_id,
                )
                return {
                    "cv_id": cv_id,
                    "status": "scoring",
                    "source": source,
                    "job_id": target_job_id,
                }

            cv.status = CVStatus.EXTRACTED
            await db.commit()
            logger.info("[extract] CV %d extracted with %s (%d skills).", cv_id, source, len(extraction.skills))
            return {"cv_id": cv_id, "status": "extracted", "source": source}
        except Exception as exc:
            logger.exception("[extract] CV %d failed", cv_id)
            cv.status = CVStatus.ERROR
            cv.error_message = f"Extraction failed: {exc}"[:2000]
            await db.commit()
            return {"cv_id": cv_id, "status": "error", "error": str(exc)}


@celery_app.task(name="app.workers.extract_task.extract_info_task", queue="extract")
def extract_info_task(cv_id: int) -> dict[str, Any]:
    get_llm.cache_clear()  # the Gemini client must not outlive the event loop of a previous task
    return asyncio.run(process_extraction(cv_id, create_worker_session_factory()))
