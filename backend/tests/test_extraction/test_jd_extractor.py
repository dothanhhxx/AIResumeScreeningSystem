"""Unit tests for JD file and text extraction (heuristic + LLM fallback)."""

import io

import pytest
from conftest import make_docx
from fastapi import UploadFile
from starlette.datastructures import Headers

from app.core.exceptions import AIServiceError, BadRequestError, UnsupportedFileTypeError
from app.llm import BaseLLM
from app.schemas.job import JobExtractionLLM
from app.services.jd_extractor import (
    extract_jd_from_text,
    extract_job_from_file,
    heuristic_extract_jd,
)

SAMPLE_EN = [
    "JOB DESCRIPTION",
    "Job Title: Senior Python Backend Engineer",
    "Department: Platform Engineering",
    "Location: Hanoi / Remote",
    "ABOUT THE ROLE",
    "Design, build, and scale FastAPI microservices for our recruitment platform.",
    "REQUIREMENTS",
    "- Minimum 4 years of experience in backend software development.",
    "- Bachelor's degree in Computer Science or Software Engineering.",
    "- Strong proficiency in Python, FastAPI, PostgreSQL, Docker, and Redis.",
    "REQUIRED SKILLS",
    "Python, FastAPI, PostgreSQL, Docker, Redis, Kubernetes",
]

SAMPLE_VI = [
    "MÔ TẢ CÔNG VIỆC",
    "Vị trí tuyển dụng: Chuyên viên Phân tích Dữ liệu (Data Analyst)",
    "Phòng ban: Sản phẩm & Dữ liệu",
    "Địa điểm làm việc: Hà Nội",
    "MÔ TẢ CÔNG VIỆC",
    "Xây dựng hệ thống báo cáo BI và phân tích hành vi người dùng.",
    "YÊU CẦU ỨNG VIÊN",
    "- Tối thiểu 2 năm kinh nghiệm ở vị trí Data Analyst.",
    "- Tốt nghiệp Đại học chuyên ngành Khoa học máy tính, Toán tin hoặc Kinh tế.",
    "- Thành thạo SQL, Python, Power BI và Tableau.",
]


def test_heuristic_extracts_english_jd_fields():
    result = heuristic_extract_jd("\n".join(SAMPLE_EN), filename="JD_Senior_Backend.docx")
    assert result.title == "Senior Python Backend Engineer"
    assert result.department == "Platform Engineering"
    assert result.location == "Hanoi / Remote"
    assert result.description is not None and "FastAPI microservices" in result.description
    assert result.requirements is not None and "4 years of experience" in result.requirements
    assert {"Python", "FastAPI", "PostgreSQL", "Docker", "Redis", "Kubernetes"} <= set(result.required_skills)
    assert result.experience_years == 4
    assert result.education_level == "Bachelor's degree"


def test_heuristic_extracts_vietnamese_jd_fields():
    result = heuristic_extract_jd("\n".join(SAMPLE_VI), filename="JD_Data_Analyst.docx")
    assert result.title == "Chuyên viên Phân tích Dữ liệu (Data Analyst)"
    assert result.department == "Sản phẩm & Dữ liệu"
    assert result.location == "Hà Nội"
    assert result.description is not None and "báo cáo BI" in result.description
    assert {"SQL", "Python", "Power BI", "Tableau"} <= set(result.required_skills)
    assert result.experience_years == 2
    assert result.education_level == "Bachelor's degree"


def _drive(coro):
    """Drive a self-contained coroutine without opening OS loopback sockets in sandboxed Windows."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    finally:
        coro.close()
    raise RuntimeError("Coroutine yielded unexpectedly")


class InMemoryUploadFile(UploadFile):
    async def read(self, size: int = -1) -> bytes:
        return self.file.read(size)


def test_extract_job_from_docx_upload_file():
    docx_bytes = make_docx(SAMPLE_EN)
    upload_file = InMemoryUploadFile(
        filename="JD_Senior_Backend_Engineer.docx",
        file=io.BytesIO(docx_bytes),
        headers=Headers(
            {"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
        ),
    )
    extracted = _drive(extract_job_from_file(upload_file, llm=None))
    assert extracted.title == "Senior Python Backend Engineer"
    assert extracted.department == "Platform Engineering"
    assert extracted.location == "Hanoi / Remote"
    assert extracted.experience_years == 4
    assert extracted.education_level == "Bachelor's degree"
    assert extracted.file_name == "JD_Senior_Backend_Engineer.docx"
    assert extracted.extraction_source == "heuristic"


def test_extract_job_from_file_rejects_invalid_and_empty_files():
    bad_file = InMemoryUploadFile(
        filename="notes.txt",
        file=io.BytesIO(b"hello"),
        headers=Headers({"content-type": "text/plain"}),
    )
    with pytest.raises(UnsupportedFileTypeError):
        _drive(extract_job_from_file(bad_file))

    empty_file = InMemoryUploadFile(
        filename="empty.pdf",
        file=io.BytesIO(b""),
        headers=Headers({"content-type": "application/pdf"}),
    )
    with pytest.raises(BadRequestError):
        _drive(extract_job_from_file(empty_file))


def test_extract_jd_llm_and_heuristic_fallback():
    class FakeLLM(BaseLLM):
        def __init__(self) -> None:
            super().__init__(model="fake-gemini", embedding_model="fake", embedding_dim=3)

        async def generate(self, prompt: str, schema: type[JobExtractionLLM]) -> JobExtractionLLM:
            return schema(
                title="AI Research Engineer",
                department="R&D",
                location="Ho Chi Minh City",
                description="Build LLM agents and RAG pipelines.",
                requirements="Master's degree and 3+ years experience.",
                required_skills=["Python", "PyTorch", "LLM"],
                experience_years=3,
                education_level="Master's degree",
            )

        async def embed(self, text: str) -> list[float]:
            return [0.0, 0.0, 0.0]

    res = _drive(extract_jd_from_text("Raw JD text", filename="jd.pdf", llm=FakeLLM()))
    assert res.title == "AI Research Engineer"
    assert res.extraction_source == "fake-gemini"
    assert res.required_skills == ["Python", "PyTorch", "LLM"]

    class FailingLLM(BaseLLM):
        def __init__(self) -> None:
            super().__init__(model="failing-gemini", embedding_model="fake", embedding_dim=3)

        async def generate(self, prompt: str, schema: type[JobExtractionLLM]) -> JobExtractionLLM:
            raise AIServiceError("Quota exceeded")

        async def embed(self, text: str) -> list[float]:
            return [0.0, 0.0, 0.0]

    fallback_res = _drive(
        extract_jd_from_text(
            "\n".join(SAMPLE_EN),
            filename="jd_fallback.docx",
            llm=FailingLLM(),
            allow_fallback=True,
        )
    )
    assert fallback_res.extraction_source == "heuristic"
    assert fallback_res.title == "Senior Python Backend Engineer"
    assert fallback_res.experience_years == 4
