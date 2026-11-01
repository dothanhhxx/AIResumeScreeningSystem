"""
Celery score task — score one CV against one JD and persist the MatchResult.
Owner: Person C

Queued by POST /matching/run (one task per CV). Status flow for the CV:
SCORING → SCORED (or back to EXTRACTED on failure, so it can be re-run).
"""

import asyncio
import json
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.database import async_session_factory, create_worker_session_factory
from app.llm import get_llm_or_none
from app.llm.factory import get_llm
from app.models.cv import CV, CVStatus
from app.models.job import Job
from app.models.match_result import MatchResult
from app.services.extraction import strip_pii
from app.services.extraction.schemas import CVExtraction
from app.services.matching import aggregate_scores
from app.services.matching.embeddings import (
    HASHING_MODEL,
    dump_embedding,
    embed_text,
    hashing_embedding,
    load_embedding,
)
from app.services.matching.semantic_scorer import cv_profile_text, job_profile_text
from app.services.matching_service import job_profile, recompute_ranks
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


async def process_scoring(
    job_id: int,
    cv_id: int,
    session_factory: async_sessionmaker[AsyncSession] | None = None,
) -> dict[str, Any]:
    factory = session_factory or async_session_factory
    async with factory() as db:
        job = await db.get(Job, job_id)
        cv = await db.get(CV, cv_id)
        if job is None or cv is None:
            return {"job_id": job_id, "cv_id": cv_id, "status": "not_found"}
        if not cv.structured_data:
            cv.status = CVStatus.ERROR if cv.status == CVStatus.SCORING else cv.status
            await db.commit()
            return {"job_id": job_id, "cv_id": cv_id, "status": "not_extracted"}

        try:
            extraction = CVExtraction.model_validate_json(cv.structured_data)
            profile = job_profile(job)
            llm = get_llm_or_none()
            safe_text = strip_pii(cv.raw_text or "", known_names=[cv.candidate_name])

            # Embeddings: both sides must come from the same model
            cv_emb = load_embedding(cv.embedding)
            job_emb = load_embedding(job.embedding)
            if cv_emb is None:
                vector, model = await embed_text(cv_profile_text(extraction), llm)
                cv.embedding = dump_embedding(vector, model)
                cv_emb = (vector, model)
            if job_emb is None or job_emb[1] != cv_emb[1]:
                vector, model = await embed_text(job_profile_text(profile), llm)
                if model != cv_emb[1]:  # LLM embedding failed for one side → compare hashing vectors
                    cv_emb = (hashing_embedding(cv_profile_text(extraction)), HASHING_MODEL)
                    vector, model = hashing_embedding(job_profile_text(profile)), HASHING_MODEL
                else:
                    job.embedding = dump_embedding(vector, model)
                job_emb = (vector, model)

            score = await aggregate_scores(
                profile,
                extraction,
                safe_text,
                llm=llm,
                cv_vector=cv_emb[0],
                job_vector=job_emb[0],
                embedding_model=cv_emb[1],
            )

            result = await db.scalar(
                select(MatchResult).where(MatchResult.cv_id == cv_id, MatchResult.job_id == job_id)
            )
            if result is None:
                result = MatchResult(cv_id=cv_id, job_id=job_id, overall_score=0)
                db.add(result)
            result.overall_score = score.overall_score
            result.skill_score = score.skill_score
            result.experience_score = score.experience_score
            result.education_score = score.education_score
            result.rule_score = score.rule_score
            result.semantic_score = score.semantic_score
            result.llm_score = score.llm_score
            result.matched_skills = json.dumps(score.matched_skills, ensure_ascii=False)
            result.missing_skills = json.dumps(score.missing_skills, ensure_ascii=False)
            result.explanation = score.explanation
            result.details = score.details.model_dump_json()
            result.model_name = score.model_name
            result.model_version = score.model_version

            cv.status = CVStatus.SCORED
            await db.flush()
            await recompute_ranks(db, job_id)
            await db.commit()
            logger.info("[score] CV %d × job %d → %.1f (%s)", cv_id, job_id, score.overall_score, score.model_name)
            return {"job_id": job_id, "cv_id": cv_id, "status": "scored", "overall_score": score.overall_score}
        except Exception as exc:
            logger.exception("[score] CV %d × job %d failed", cv_id, job_id)
            await db.rollback()
            cv = await db.get(CV, cv_id)
            if cv is not None:
                cv.status = CVStatus.EXTRACTED
                cv.error_message = f"Scoring failed: {exc}"[:2000]
                await db.commit()
            return {"job_id": job_id, "cv_id": cv_id, "status": "error", "error": str(exc)}


@celery_app.task(name="app.workers.score_task.score_match_task", queue="score")
def score_match_task(job_id: int, cv_id: int) -> dict[str, Any]:
    get_llm.cache_clear()  # the Gemini client must not outlive the event loop of a previous task
    return asyncio.run(process_scoring(job_id, cv_id, create_worker_session_factory()))
