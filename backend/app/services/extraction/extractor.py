"""
CV information extractor — raw CV text -> structured `CVExtraction` via the LLM.
Owner: Person C

Usage:
    from app.services.extraction import extract_cv_info

    data = await extract_cv_info(cv.raw_text, candidate_name=cv.candidate_name)
    cv.structured_data = data.model_dump_json()
"""

import logging
from datetime import date

from app.config import settings
from app.core.exceptions import AIServiceError, FileProcessingError
from app.llm import BaseLLM, get_llm, get_llm_or_none
from app.services.extraction.heuristic import heuristic_extract
from app.services.extraction.pii_stripper import strip_pii
from app.services.extraction.prompts import build_extraction_prompt
from app.services.extraction.schemas import CVExtraction

logger = logging.getLogger(__name__)

HEURISTIC_SOURCE = "heuristic"

# Real CVs are rarely longer than ~15k characters; the rest is usually OCR noise. Keeps free-tier token usage low.
MAX_CV_CHARS = 20_000


async def extract_cv_info(
    raw_text: str | None,
    candidate_name: str | None = None,
    llm: BaseLLM | None = None,
) -> CVExtraction:
    """Mask PII, build the prompt and ask the LLM for structured CV data. Does not touch the database."""
    safe_text = _prepare_text(raw_text, candidate_name)
    prompt = build_extraction_prompt(safe_text, today=date.today().strftime("%Y-%m"))
    return await (llm or get_llm()).generate(prompt, CVExtraction)


def _prepare_text(raw_text: str | None, candidate_name: str | None) -> str:
    if not raw_text or not raw_text.strip():
        raise FileProcessingError("CV has no extractable text")
    # Strip before truncating so a cut can never split a PII token and leak part of it
    known_names = [candidate_name] if candidate_name else None
    return strip_pii(raw_text, known_names=known_names)[:MAX_CV_CHARS]


async def extract_cv(
    raw_text: str | None,
    candidate_name: str | None = None,
    llm: BaseLLM | None = None,
    allow_fallback: bool | None = None,
) -> tuple[CVExtraction, str]:
    """
    Extraction used by the pipeline: LLM first, heuristic fallback.

    Returns (extraction, source) where source is the LLM model name or "heuristic".
    """
    allow_fallback = settings.LLM_FALLBACK_TO_HEURISTIC if allow_fallback is None else allow_fallback
    safe_text = _prepare_text(raw_text, candidate_name)
    llm = llm or get_llm_or_none()

    if llm is not None:
        try:
            return await extract_cv_info(raw_text, candidate_name=candidate_name, llm=llm), llm.model
        except AIServiceError as exc:
            if not allow_fallback:
                raise
            logger.warning("LLM extraction failed, using heuristic extractor: %s", exc)
    elif not allow_fallback:
        raise AIServiceError("No LLM configured and heuristic fallback is disabled")

    return heuristic_extract(safe_text), HEURISTIC_SOURCE
