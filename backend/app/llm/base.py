"""
LLM abstraction layer — every provider implements this interface.
Owner: Person C

Usage:
    from app.llm import get_llm

    llm = get_llm()
    result = await llm.generate(prompt, CVExtraction)
    vector = await llm.embed(text)
"""

from abc import ABC, abstractmethod
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class BaseLLM(ABC):
    """Provider-agnostic interface so we can switch away from Gemini if the free quota runs out."""

    provider: str = "base"

    def __init__(self, model: str, embedding_model: str, embedding_dim: int) -> None:
        self.model = model
        self.embedding_model = embedding_model
        self.embedding_dim = embedding_dim

    @abstractmethod
    async def generate(self, prompt: str, schema: type[T]) -> T:
        """Send a prompt and return the response parsed into `schema`."""

    @abstractmethod
    async def embed(self, text: str) -> list[float]:
        """Return an embedding vector of length `embedding_dim`."""
