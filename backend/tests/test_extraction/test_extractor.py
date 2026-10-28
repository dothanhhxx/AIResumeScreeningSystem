"""extract_cv_info tests with a fake LLM — no network calls, no quota used."""

import pytest

from app.core.exceptions import FileProcessingError
from app.llm import BaseLLM
from app.services.extraction.extractor import MAX_CV_CHARS, extract_cv_info
from app.services.extraction.schemas import CVExtraction


class FakeLLM(BaseLLM):
    def __init__(self, result: CVExtraction) -> None:
        super().__init__(model="fake", embedding_model="fake", embedding_dim=3)
        self.result = result
        self.calls = []

    async def generate(self, prompt, schema):
        self.calls.append((prompt, schema))
        return self.result

    async def embed(self, text):
        return [0.0, 0.0, 0.0]


async def test_returns_llm_result_and_requests_cv_schema():
    expected = CVExtraction(skills=["Python", "FastAPI"], years_of_experience=2)
    llm = FakeLLM(expected)

    result = await extract_cv_info("Backend developer, Python, FastAPI", llm=llm)

    assert result == expected
    prompt, schema = llm.calls[0]
    assert schema is CVExtraction
    assert "Backend developer, Python, FastAPI" in prompt


async def test_pii_is_masked_before_sending_to_llm():
    llm = FakeLLM(CVExtraction())
    raw_text = "Nguyễn Văn A\nEmail: a@gmail.com | SĐT: 0912345678\nSkills: Python"

    await extract_cv_info(raw_text, candidate_name="Nguyễn Văn A", llm=llm)

    prompt, _ = llm.calls[0]
    for secret in ["Nguyễn Văn A", "a@gmail.com", "0912345678"]:
        assert secret not in prompt
    assert "Skills: Python" in prompt


async def test_long_text_is_truncated():
    llm = FakeLLM(CVExtraction())

    await extract_cv_info("x" * (MAX_CV_CHARS + 500), llm=llm)

    prompt, _ = llm.calls[0]
    assert "x" * MAX_CV_CHARS in prompt
    assert "x" * (MAX_CV_CHARS + 1) not in prompt


@pytest.mark.parametrize("raw_text", [None, "", "   \n  "])
async def test_empty_text_is_rejected_without_calling_llm(raw_text):
    llm = FakeLLM(CVExtraction())

    with pytest.raises(FileProcessingError):
        await extract_cv_info(raw_text, llm=llm)
    assert llm.calls == []
