"""
LLM scorer — asks the LLM for sub-scores, evidence, strengths, gaps and interview questions.
Owner: Person C
"""

from app.llm import BaseLLM
from app.schemas.matching import LLMScoreOutput
from app.services.extraction.schemas import CVExtraction
from app.services.matching.prompts import build_scoring_prompt
from app.services.matching.rule_scorer import JobProfile


async def score_with_llm(job: JobProfile, cv: CVExtraction, cv_text: str, llm: BaseLLM) -> LLMScoreOutput:
    """`cv_text` must already be PII-stripped. Raises AIServiceError on LLM failure."""
    prompt = build_scoring_prompt(job.full_text, cv.model_dump_json(indent=1), cv_text)
    return await llm.generate(prompt, LLMScoreOutput)
