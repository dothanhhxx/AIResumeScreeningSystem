"""Offline heuristic extractor + extract_cv fallback tests. Owner: Person C"""

from datetime import date

from app.core.exceptions import AIServiceError
from app.llm import BaseLLM
from app.services.extraction import extract_cv, heuristic_extract, strip_pii
from app.services.extraction.pii_stripper import ADDRESS_TOKEN

CV_VI = """NGUYỄN VĂN A
Ngày sinh: 01/02/1998
Địa chỉ: 123 Nguyễn Trãi, Thanh Xuân, Hà Nội
MỤC TIÊU NGHỀ NGHIỆP
Trở thành kỹ sư backend giỏi.
KỸ NĂNG
Python, Django, ReactJS, Postgres, Docker
KINH NGHIỆM LÀM VIỆC
Backend Developer tại Công ty ABC | 03/2020 - nay
Phát triển API với Django và PostgreSQL.
Intern tại Công ty XYZ | 06/2019 - 12/2019
HỌC VẤN
Đại học Bách Khoa Hà Nội
Kỹ sư Công nghệ thông tin, 2020, GPA: 3.2/4
CHỨNG CHỈ
AWS Certified Cloud Practitioner
NGOẠI NGỮ
IELTS 7.0
"""


def test_heuristic_extracts_vietnamese_cv():
    result = heuristic_extract(CV_VI, today=date(2026, 11, 1))
    assert {"Python", "Django", "React", "PostgreSQL", "Docker"} <= set(result.skills)
    # 03/2020 → 11/2026 plus 06/2019 → 12/2019 ≈ 7.3 years
    assert 7.0 <= result.years_of_experience <= 7.5
    assert result.experiences[0].title == "Backend Developer"
    assert result.experiences[0].end_date == "present"
    assert result.education[0].degree == "Bachelor"
    assert result.education[0].graduation_year == 2020
    assert result.education[0].gpa == "3.2/4"
    assert result.certifications == ["AWS Certified Cloud Practitioner"]
    assert result.languages[0] == "English"


def test_dob_is_not_counted_as_experience():
    result = heuristic_extract("Ngày sinh: 01/02/1998\nSkills: Python", today=date(2026, 1, 1))
    assert result.years_of_experience is None


def test_labelled_addresses_are_masked():
    text = strip_pii("Địa chỉ: 123 Nguyễn Trãi, Hà Nội\nAddress - 5 Main St\nSkills: Python")
    assert "Nguyễn Trãi" not in text and "Main St" not in text
    assert text.count(ADDRESS_TOKEN) == 2
    assert "Skills: Python" in text


class BrokenLLM(BaseLLM):
    def __init__(self) -> None:
        super().__init__(model="broken", embedding_model="broken", embedding_dim=3)

    async def generate(self, prompt, schema):
        raise AIServiceError("503")

    async def embed(self, text):
        raise AIServiceError("503")


async def test_extract_cv_falls_back_to_heuristic_on_llm_error():
    extraction, source = await extract_cv(CV_VI, candidate_name="Nguyễn Văn A", llm=BrokenLLM())
    assert source == "heuristic"
    assert "Python" in extraction.skills


async def test_extract_cv_without_fallback_raises():
    try:
        await extract_cv(CV_VI, llm=BrokenLLM(), allow_fallback=False)
    except AIServiceError:
        return
    raise AssertionError("expected AIServiceError")
