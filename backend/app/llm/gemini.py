"""
Google Gemini implementation (Google AI Studio API key, free tier).
Owner: Person C
"""

import asyncio
import math
from collections.abc import Awaitable, Callable
from typing import TypeVar

import httpx
from google import genai
from google.genai import errors, types
from pydantic import ValidationError as PydanticValidationError

from app.core.exceptions import AIServiceError
from app.llm.base import BaseLLM, T

R = TypeVar("R")

# 429 = free-tier rate limit, 500/502/503 = Gemini overloaded / temporary failure.
# 504 is not retried: Gemini returns it when our own timeout_seconds deadline expires,
# so retrying would just wait the full timeout again on every attempt.
RETRYABLE_STATUS_CODES = {429, 500, 502, 503}


class GeminiLLM(BaseLLM):
    provider = "gemini"

    def __init__(
        self,
        api_key: str | None,
        model: str,
        embedding_model: str,
        embedding_dim: int,
        max_retries: int = 3,
        retry_base_delay: float = 2.0,
        timeout_seconds: float = 60.0,
        client: genai.Client | None = None,
    ) -> None:
        super().__init__(model=model, embedding_model=embedding_model, embedding_dim=embedding_dim)
        if client is None:
            if not api_key:
                raise AIServiceError("GEMINI_API_KEY is not set")
            client = genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(
                    timeout=int(timeout_seconds * 1000),  # milliseconds
                    # Disable the SDK's own retry (5 attempts, waits up to 60s): stacked under
                    # _call_with_retry it made a single 503 block for several minutes.
                    retry_options=types.HttpRetryOptions(attempts=1),
                ),
            )
        self._client = client
        self._max_retries = max_retries
        self._retry_base_delay = retry_base_delay

    async def generate(self, prompt: str, schema: type[T]) -> T:
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=schema.model_json_schema(),
            temperature=0,
        )
        response = await self._call_with_retry(
            lambda: self._client.aio.models.generate_content(model=self.model, contents=prompt, config=config)
        )
        if not response.text:
            raise AIServiceError("Gemini returned an empty response")
        try:
            return schema.model_validate_json(response.text)
        except PydanticValidationError as exc:
            raise AIServiceError(f"Gemini response does not match {schema.__name__}") from exc

    # TODO(Person A): the vectors returned here need a pgvector column, Vector(settings.EMBEDDING_DIM),
    #                 on the CV and Job models (+ Alembic migration) before semantic_scorer.py can store them.
    async def embed(self, text: str) -> list[float]:
        config = types.EmbedContentConfig(output_dimensionality=self.embedding_dim)
        response = await self._call_with_retry(
            lambda: self._client.aio.models.embed_content(model=self.embedding_model, contents=text, config=config)
        )
        values = response.embeddings[0].values if response.embeddings else None
        if not values:
            raise AIServiceError("Gemini returned an empty embedding")
        # Truncated Gemini embeddings are not unit length — normalise so cosine distance works in pgvector
        norm = math.sqrt(sum(v * v for v in values))
        return [v / norm for v in values] if norm else values

    async def _call_with_retry(self, make_request: Callable[[], Awaitable[R]]) -> R:
        for attempt in range(self._max_retries + 1):
            try:
                return await make_request()
            except errors.APIError as exc:
                if exc.code not in RETRYABLE_STATUS_CODES or attempt == self._max_retries:
                    raise AIServiceError(f"Gemini API error {exc.code}: {exc.message}") from exc
                await asyncio.sleep(self._retry_base_delay * 2**attempt)
            except httpx.TransportError as exc:
                # Timeouts / network failures: not retried, a timeout already cost timeout_seconds
                raise AIServiceError(f"Gemini request failed: {type(exc).__name__}") from exc
        raise AssertionError("unreachable")
