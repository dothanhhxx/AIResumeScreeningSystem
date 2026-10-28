"""
CV information extractor — raw CV text -> structured `CVExtraction` via the LLM.
Owner: Person C

Usage:
    from app.services.extraction import extract_cv_info

    data = await extract_cv_info(cv.raw_text, candidate_name=cv.candidate_name)
    cv.structured_data = data.model_dump_json()
"""

from datetime import date

from app.core.exceptions import FileProcessingError
from app.llm import BaseLLM, get_llm
from app.services.extraction.pii_stripper import strip_pii
from app.services.extraction.prompts import build_extraction_prompt
from app.services.extraction.schemas import CVExtraction

# Real CVs are rarely longer than ~15k characters; the rest is usually OCR noise. Keeps free-tier token usage low.
MAX_CV_CHARS = 20_000


# TODO(Person C, day 3): app/workers/extract_task.py calls this, saves result.model_dump_json() to
#                        CV.structured_data and sets CV.status = EXTRACTED (ERROR on AIServiceError).
#                        Needs app/workers/celery_app.py from Person B first.
async def extract_cv_info(
    raw_text: str | None,
    candidate_name: str | None = None,
    llm: BaseLLM | None = None,
) -> CVExtraction:
    """Mask PII, build the prompt and ask the LLM for structured CV data. Does not touch the database."""
    if not raw_text or not raw_text.strip():
        raise FileProcessingError("CV has no extractable text")

    # Strip before truncating so a cut can never split a PII token and leak part of it
    known_names = [candidate_name] if candidate_name else None
    safe_text = strip_pii(raw_text, known_names=known_names)[:MAX_CV_CHARS]

    prompt = build_extraction_prompt(safe_text, today=date.today().strftime("%Y-%m"))
    return await (llm or get_llm()).generate(prompt, CVExtraction)
