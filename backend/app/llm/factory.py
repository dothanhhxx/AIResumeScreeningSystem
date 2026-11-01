"""
LLM factory — picks the provider from settings.
Owner: Person C
"""

import logging
from functools import lru_cache

from app.config import settings
from app.core.exceptions import AIServiceError
from app.llm.base import BaseLLM

logger = logging.getLogger(__name__)


@lru_cache
def get_llm() -> BaseLLM:
    """Singleton factory — cached after first call."""
    provider = settings.LLM_PROVIDER.lower()

    if provider == "gemini":
        from app.llm.gemini import GeminiLLM

        return GeminiLLM(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL,
            embedding_model=settings.GEMINI_EMBEDDING_MODEL,
            embedding_dim=settings.EMBEDDING_DIM,
        )

    # Add more providers here (subclass BaseLLM), e.g. "openai" -> app/llm/openai.py
    raise ValueError(f"Unsupported LLM_PROVIDER: {settings.LLM_PROVIDER}")


def get_llm_or_none() -> BaseLLM | None:
    """The configured LLM, or None when running offline (LLM_PROVIDER=heuristic or no API key)."""
    if settings.LLM_PROVIDER.lower() == "heuristic":
        return None
    try:
        return get_llm()
    except (AIServiceError, ValueError) as exc:
        logger.warning("LLM unavailable, using heuristic engines: %s", exc)
        return None
