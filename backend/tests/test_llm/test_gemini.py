"""GeminiLLM tests with a fake client — no network calls, no quota used."""

import math
from types import SimpleNamespace

import httpx
import pytest
from google.genai import errors
from pydantic import BaseModel

from app.core.exceptions import AIServiceError
from app.llm import gemini as gemini_module
from app.llm.gemini import GeminiLLM


class Person(BaseModel):
    name: str
    age: int


class FakeModels:
    """Stands in for `client.aio.models`; each call pops the next queued result or raises it."""

    def __init__(self, results):
        self.results = list(results)
        self.calls = []

    async def _next(self, **kwargs):
        self.calls.append(kwargs)
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result

    async def generate_content(self, **kwargs):
        return await self._next(**kwargs)

    async def embed_content(self, **kwargs):
        return await self._next(**kwargs)


def make_llm(*results) -> tuple[GeminiLLM, FakeModels]:
    models = FakeModels(results)
    client = SimpleNamespace(aio=SimpleNamespace(models=models))
    llm = GeminiLLM(
        api_key=None,
        model="test-model",
        embedding_model="test-embedding",
        embedding_dim=3,
        retry_base_delay=0,
        client=client,
    )
    return llm, models


def api_error(code: int) -> errors.APIError:
    return errors.APIError(code, {"error": {"message": f"error {code}", "status": "X"}})


def text_response(text: str | None):
    return SimpleNamespace(text=text)


async def test_generate_parses_json_into_schema():
    llm, models = make_llm(text_response('{"name": "A", "age": 30}'))

    result = await llm.generate("prompt", Person)

    assert result == Person(name="A", age=30)
    call = models.calls[0]
    assert call["model"] == "test-model"
    assert call["config"].response_mime_type == "application/json"
    assert call["config"].response_json_schema == Person.model_json_schema()


async def test_generate_retries_on_rate_limit_then_succeeds():
    llm, models = make_llm(api_error(429), api_error(503), text_response('{"name": "A", "age": 1}'))

    assert await llm.generate("prompt", Person) == Person(name="A", age=1)
    assert len(models.calls) == 3


async def test_generate_gives_up_after_max_retries():
    llm, models = make_llm(*[api_error(429)] * 4)

    with pytest.raises(AIServiceError):
        await llm.generate("prompt", Person)
    assert len(models.calls) == 4


async def test_generate_does_not_retry_client_errors():
    llm, models = make_llm(api_error(400))

    with pytest.raises(AIServiceError):
        await llm.generate("prompt", Person)
    assert len(models.calls) == 1


@pytest.mark.parametrize("text", [None, "", '{"name": "A"}', "not json"])
async def test_generate_rejects_empty_or_invalid_response(text):
    llm, _ = make_llm(text_response(text))

    with pytest.raises(AIServiceError):
        await llm.generate("prompt", Person)


async def test_embed_returns_normalised_vector():
    response = SimpleNamespace(embeddings=[SimpleNamespace(values=[3.0, 0.0, 4.0])])
    llm, models = make_llm(response)

    vector = await llm.embed("text")

    assert vector == pytest.approx([0.6, 0.0, 0.8])
    assert math.isclose(sum(v * v for v in vector), 1.0)
    assert models.calls[0]["config"].output_dimensionality == 3


async def test_embed_rejects_empty_response():
    llm, _ = make_llm(SimpleNamespace(embeddings=[]))

    with pytest.raises(AIServiceError):
        await llm.embed("text")


def test_requires_api_key_without_client():
    with pytest.raises(AIServiceError):
        GeminiLLM(api_key="", model="m", embedding_model="e", embedding_dim=3)


async def test_timeout_is_not_retried_and_wrapped():
    llm, models = make_llm(httpx.ReadTimeout("timed out"))

    with pytest.raises(AIServiceError):
        await llm.generate("prompt", Person)
    assert len(models.calls) == 1


def test_real_client_has_timeout_and_sdk_retry_disabled(monkeypatch):
    captured = {}
    monkeypatch.setattr(gemini_module.genai, "Client", lambda **kwargs: captured.update(kwargs))

    GeminiLLM(api_key="key", model="m", embedding_model="e", embedding_dim=3, timeout_seconds=30)

    http_options = captured["http_options"]
    assert captured["api_key"] == "key"
    assert http_options.timeout == 30_000
    assert http_options.retry_options.attempts == 1


async def test_deadline_exceeded_is_not_retried():
    llm, models = make_llm(api_error(504))

    with pytest.raises(AIServiceError):
        await llm.generate("prompt", Person)
    assert len(models.calls) == 1
