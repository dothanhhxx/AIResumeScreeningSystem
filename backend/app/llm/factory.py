"""
LLM factory — picks the provider from settings.
Owner: Person C
"""

from functools import lru_cache

from app.config import settings
from app.llm.base import BaseLLM


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

    raise ValueError(f"Unsupported LLM_PROVIDER: {settings.LLM_PROVIDER}")
