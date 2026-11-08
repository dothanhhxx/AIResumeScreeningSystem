"""Tests for JD file upload and structured field extraction (/api/v1/jobs/extract-file)."""

from conftest import DOCX_MIME, make_docx

from app.core.exceptions import AIServiceError
from app.llm.base import BaseLLM
from app.schemas.job import JobExtractionLLM
from app.services.jd_extractor import extract_jd_from_text

SAMPLE_JD_EN = [
    "JOB DESCRIPTION",
    "Job Title: Senior Python Backend Engineer",
    "Department: Platform Engineering",
    "Location: Hanoi / Remote",
    "ABOUT THE ROLE",
    "Design, build, and scale FastAPI microservices for our recruitment platform.",
    "Collaborate with product managers and data scientists on matching pipelines.",
    "REQUIREMENTS",
    "- Minimum 4 years of experience in backend software development.",
    "- Bachelor's degree in Computer Science or Software Engineering.",
    "- Strong proficiency in Python, FastAPI, PostgreSQL, Docker, and Redis.",
    "REQUIRED SKILLS",
    "Python, FastAPI, PostgreSQL, Docker, Redis, Kubernetes",
]

SAMPLE_JD_VI = [
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


async def test_extract_job_from_docx_and_save_after_editing(client, admin_headers):
    files = {"file": ("JD_Senior_Backend_Engineer.docx", make_docx(SAMPLE_JD_EN), DOCX_MIME)}
    response = await client.post("/api/v1/jobs/extract-file", files=files, headers=admin_headers)
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert data["title"] == "Senior Python Backend Engineer"
    assert data["department"] == "Platform Engineering"
    assert data["location"] == "Hanoi / Remote"
    assert "FastAPI microservices" in data["description"]
    assert "4 years of experience" in data["requirements"]
    assert {"Python", "FastAPI", "PostgreSQL", "Docker", "Redis", "Kubernetes"} <= set(data["required_skills"])
    assert data["experience_years"] == 4
    assert data["education_level"] == "Bachelor's degree"
    assert data["file_name"] == "JD_Senior_Backend_Engineer.docx"

    # Extracting a file must NOT create a job in the database until the user saves
    list_before = (await client.get("/api/v1/jobs", headers=admin_headers)).json()["data"]
    assert list_before["total"] == 0

    # User edits the pre-filled fields and saves the final JD
    create_payload = {
        "title": f"{data['title']} (Edited)",
        "department": data["department"],
        "location": data["location"],
        "description": data["description"],
        "requirements": data["requirements"],
        "required_skills": data["required_skills"],
        "experience_years": 5,
        "education_level": data["education_level"],
    }
    created = await client.post("/api/v1/jobs", json=create_payload, headers=admin_headers)
    assert created.status_code == 201, created.text
    saved = created.json()["data"]
    assert saved["title"] == "Senior Python Backend Engineer (Edited)"
    assert saved["experience_years"] == 5


async def test_extract_vietnamese_jd_file(client, admin_headers):
    files = {"file": ("JD_Data_Analyst_2026.docx", make_docx(SAMPLE_JD_VI), DOCX_MIME)}
    response = await client.post("/api/v1/jobs/extract-file", files=files, headers=admin_headers)
    assert response.status_code == 200, response.text

    data = response.json()["data"]
    assert data["title"] == "Chuyên viên Phân tích Dữ liệu (Data Analyst)"
    assert data["department"] == "Sản phẩm & Dữ liệu"
    assert data["location"] == "Hà Nội"
    assert "báo cáo BI" in data["description"]
    assert {"SQL", "Python", "Power BI", "Tableau"} <= set(data["required_skills"])
    assert data["experience_years"] == 2
    assert data["education_level"] == "Bachelor's degree"


async def test_extract_job_rejects_unsupported_or_empty_file(client, admin_headers):
    unsupported = await client.post(
        "/api/v1/jobs/extract-file",
        files={"file": ("notes.txt", b"plain text", "text/plain")},
        headers=admin_headers,
    )
    assert unsupported.status_code == 422

    empty = await client.post(
        "/api/v1/jobs/extract-file",
        files={"file": ("empty.pdf", b"", "application/pdf")},
        headers=admin_headers,
    )
    assert empty.status_code == 400


async def test_extract_jd_llm_and_fallback():
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

    res = await extract_jd_from_text("Raw JD text", filename="jd.pdf", llm=FakeLLM())
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

    fallback_res = await extract_jd_from_text(
        "\n".join(SAMPLE_JD_EN),
        filename="jd_fallback.docx",
        llm=FailingLLM(),
        allow_fallback=True,
    )
    assert fallback_res.extraction_source == "heuristic"
    assert fallback_res.title == "Senior Python Backend Engineer"
    assert fallback_res.experience_years == 4
