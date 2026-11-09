"""
Job Description (JD) file parser and structured field extractor.

Extracts draft JD fields (`title`, `department`, `location`, `description`,
`requirements`, `required_skills`, `experience_years`, `education_level`) from
an uploaded PDF or DOCX document so recruiters can review and edit before saving.
"""

import logging
import mimetypes
import re

from fastapi import UploadFile

from app.config import settings
from app.core.exceptions import (
    AIServiceError,
    BadRequestError,
    FileProcessingError,
    UnsupportedFileTypeError,
)
from app.llm import BaseLLM, get_llm_or_none
from app.schemas.job import JobExtractionLLM, JobExtractionRead
from app.services.matching.skills import dedupe_skills, find_skills_in_text
from app.services.parsing import parse_document
from app.services.storage_service import ALLOWED_CONTENT_TYPES

logger = logging.getLogger(__name__)

MAX_JD_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_JD_CHARS = 20_000
HEURISTIC_SOURCE = "heuristic"

JD_EXTRACTION_PROMPT = """You are an expert HR and recruitment assistant that extracts
structured Job Description (JD) fields from a document.

The document below may be written in English, Vietnamese, or a mix of both.
Extract the following fields strictly from the provided text:
- title: The job title / role name (e.g., "Senior Python Backend Engineer",
  "Chuyên viên Phân tích Dữ liệu"). Keep the original language of the title.
- department: The department or team name if mentioned (e.g., "Engineering",
  "Product", "Phòng Kỹ thuật"). Null if not stated.
- location: The work location or work arrangement if mentioned (e.g.,
  "Hanoi / Remote", "Ho Chi Minh City", "Hà Nội"). Null if not stated.
- description: The role overview and key responsibilities / duties. Preserve
  bullet points or clear paragraph breaks in the original language.
- requirements: Candidate qualifications, experience, educational and
  additional requirements. Preserve bullet points in the original language.
- required_skills: List of concrete technical, domain, or professional skills
  required for the role (e.g., ["Python", "FastAPI", "PostgreSQL", "Docker"]).
  List each skill once using concise canonical names.
- experience_years: Minimum required years of experience as an integer
  (e.g., 3 for "3+ years" or "3-5 years"). Null if not mentioned.
- education_level: Required education level if mentioned (e.g.,
  "Bachelor's degree", "Master's degree", "Cử nhân Đại học"). Null if not mentioned.

Rules:
- Only extract facts present in the document. Do not invent requirements.
- Ensure `description` is populated with the main body of the job description
  if there is no explicit "Description" heading.

Job Description Document:
\"\"\"
{jd_text}
\"\"\"
"""

_SECTION_PATTERNS: dict[str, re.Pattern[str]] = {
    "description": re.compile(
        r"^(?:job\s*description|role\s*description|description|about\s*the\s*role|about\s* the\s*job|"
        r"role\s*overview|overview|position\s*summary|summary|what\s*you\s*will\s*do|what\s*you'?ll\s*do|"
        r"responsibilities|key\s*responsibilities|main\s*responsibilities|duties|duties\s*(?:&|and)\s*responsibilities|"
        r"mô\s*tả\s*công\s*việc|mo\s*ta\s*cong\s*viec|trách\s*nhiệm.*|nhiệm\s*vụ.*|công\s*việc\s*chính.*|"
        r"về\s*vị\s*trí\s*này|chi\s*tiết\s*công\s*việc)$",
        re.IGNORECASE,
    ),
    "requirements": re.compile(
        r"^(?:requirements?|job\s*requirements?|qualifications?|minimum\s*qualifications?|"
        r"preferred\s*qualifications?|what\s*we\s*look\s*for|what\s*you\s*bring|who\s*you\s*are|"
        r"must\s*have|candidate\s*profile|experience\s*(?:&|and)\s*qualifications?|"
        r"yêu\s*cầu.*|yeu\s*cau.*|tiêu\s*chí.*|điều\s*kiện\s*ứng\s*tuyển.*|hồ\s*sơ\s*yêu\s*cầu.*)$",
        re.IGNORECASE,
    ),
    "skills": re.compile(
        r"^(?:required\s*skills?|technical\s*skills?|skills?|core\s*skills?|key\s*skills?|"
        r"tech\s*stack|core\s*competencies|technologies|tools?\s*(?:&|and)\s*technologies|"
        r"kỹ\s*năng.*|ky\s*nang.*|công\s*nghệ\s*yêu\s*cầu.*)$",
        re.IGNORECASE,
    ),
    "benefits": re.compile(
        r"^(?:benefits?|what\s*we\s*offer|perks|compensation|compensation\s*(?:&|and)\s*benefits?|"
        r"why\s*join\s*us|quyền\s*lợi.*|quyen\s*loi.*|chế\s*độ.*|phúc\s*lợi.*|đãi\s*ngộ.*)$",
        re.IGNORECASE,
    ),
}

_LABEL_PATTERNS: dict[str, re.Pattern[str]] = {
    "title": re.compile(
        r"^(?:job\s*title|position\s*title|role\s*title|title|position|role|"
        r"chức\s*danh(?:\s*công\s*việc)?|vị\s*trí(?:\s*tuyển\s*dụng)?)\s*[:\-–]\s*(.+)$",
        re.IGNORECASE,
    ),
    "department": re.compile(
        r"^(?:department|team|division|business\s*unit|practice|"
        r"phòng\s*ban|bộ\s*phận|khối|nhóm)\s*[:\-–]\s*(.+)$",
        re.IGNORECASE,
    ),
    "location": re.compile(
        r"^(?:location|work\s*location|office\s*location|workplace|based\s*in|city|"
        r"địa\s*điểm(?:\s*làm\s*việc)?|nơi\s*làm\s*việc|khu\s*vực)\s*[:\-–]\s*(.+)$",
        re.IGNORECASE,
    ),
    "experience": re.compile(
        r"^(?:experience(?:\s*required)?|years?\s*of\s*experience|minimum\s*experience|"
        r"kinh\s*nghiệm(?:\s*yêu\s*cầu)?|số\s*năm\s*kinh\s*nghiệm)\s*[:\-–]\s*(.+)$",
        re.IGNORECASE,
    ),
    "education": re.compile(
        r"^(?:education(?:\s*level)?|academic\s*qualification|degree|"
        r"trình\s*độ(?:\s*học\s*vấn)?|học\s*vấn|bằng\s*cấp)\s*[:\-–]\s*(.+)$",
        re.IGNORECASE,
    ),
    "skills": re.compile(
        r"^(?:required\s*skills?|technical\s*skills?|skills?\s*required|key\s*skills?|tech\s*stack|"
        r"kỹ\s*năng(?:\s*bắt\s*buộc|\s*yêu\s*cầu)?)\s*[:\-–]\s*(.+)$",
        re.IGNORECASE,
    ),
}

_IGNORE_TITLE_HEADERS = {
    "job description",
    "mô tả công việc",
    "mo ta cong viec",
    "thông báo tuyển dụng",
    "thong bao tuyen dung",
    "tuyển dụng",
    "tuyen dung",
    "we are hiring",
    "hiring",
    "career opportunity",
    "job opening",
    "position description",
    "jd",
}

_EXPERIENCE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(
        r"(?:at\s+least|minimum(?:\s+of)?|min\.?|tối\s+thiểu|ít\s+nhất|trên|từ)\s*"
        r"(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years?|yrs?|năm)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(\d{1,2})\s*(?:\+|(?:\s*[-–tođến]+\s*\d{1,2}))?\s*(?:years?|yrs?|năm)\s*"
        r"(?:of\s+)?(?:experience|kinh\s*nghiệm|exp|làm\s*việc)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:experience|kinh\s*nghiệm)\s*[:\-–]?\s*(\d{1,2})\s*"
        r"(?:\+|(?:\s*[-–]\s*\d{1,2}))?\s*(?:years?|yrs?|năm)?",
        re.IGNORECASE,
    ),
]

_EDUCATION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(ph\.?d|doctorate|doctor\s+of|tiến\s+sĩ)\b", re.IGNORECASE), "PhD"),
    (
        re.compile(r"\b(master'?s?(?:\s+degree)?|m\.?sc|mba|m\.?eng|thạc\s+sĩ|cao\s+học)\b", re.IGNORECASE),
        "Master's degree",
    ),
    (
        re.compile(
            r"\b(bachelor'?s?(?:\s+degree)?|b\.?sc|b\.?eng|b\.?a\.|bs\b|ba\b|"
            r"cử\s+nhân|kỹ\s+sư|tốt\s+nghiệp\s+đại\s+học|bằng\s+đại\s+học|đại\s+học)\b",
            re.IGNORECASE,
        ),
        "Bachelor's degree",
    ),
    (
        re.compile(r"\b(associate'?s?(?:\s+degree)?|college\s+diploma|cao\s+đẳng)\b", re.IGNORECASE),
        "Associate / College degree",
    ),
]

_LOCATION_FALLBACK_RE = re.compile(
    r"\b(Hanoi|Hà\s*Nội|Ha\s*Noi|Ho\s*Chi\s*Minh(?:\s*City)?|TP\.?\s*HCM|TP\.?\s*Hồ\s*Chí\s*Minh|"
    r"Da\s*Nang|Đà\s*Nẵng|Hai\s*Phong|Hải\s*Phòng|Can\s*Tho|Cần\s*Thơ|Remote|Hybrid|On-site|"
    r"Làm\s*việc\s*từ\s*xa|Từ\s*xa|Vietnam|Việt\s*Nam)\b",
    re.IGNORECASE,
)


def _detect_jd_file_ext(file: UploadFile) -> str:
    content_type = (file.content_type or "").lower().strip()
    if content_type in ALLOWED_CONTENT_TYPES:
        return ALLOWED_CONTENT_TYPES[content_type]

    filename = (file.filename or "").lower().strip()
    if filename.endswith(".pdf"):
        return "pdf"
    if filename.endswith(".docx"):
        return "docx"
    if filename.endswith(".doc"):
        return "doc"

    guessed, _ = mimetypes.guess_type(filename)
    if guessed and guessed in ALLOWED_CONTENT_TYPES:
        return ALLOWED_CONTENT_TYPES[guessed]

    raise UnsupportedFileTypeError(file.content_type or (file.filename or "unknown"))


def _infer_title_from_filename(filename: str | None) -> str | None:
    if not filename:
        return None
    stem = re.sub(r"\.(pdf|docx|doc)$", "", filename.strip(), flags=re.IGNORECASE)
    stem = re.sub(
        r"^(?:jd|job[\s_-]*description|mo[\s_-]*ta[\s_-]*cong[\s_-]*viec)[\s_.\-:]*",
        "",
        stem,
        flags=re.IGNORECASE,
    )
    stem = re.sub(r"[\s_.\-]+(?:jd|final|draft|v\d+|20\d{2})$", "", stem, flags=re.IGNORECASE)
    stem = re.sub(r"[_\-]+", " ", stem)
    stem = re.sub(r"\s+", " ", stem).strip(" -–—|_.")
    return stem[:255] if len(stem) >= 3 else None


def _clean_heading_candidate(line: str) -> str:
    cleaned = re.sub(r"^[\dIVX]+[\.\)]\s*", "", line.strip())
    cleaned = re.sub(r"[:#*•\-–_|]+", " ", cleaned).strip().lower()
    return re.sub(r"\s+", " ", cleaned)


def _extract_experience_years(text: str) -> int | None:
    for pattern in _EXPERIENCE_PATTERNS:
        match = pattern.search(text)
        if match:
            try:
                years = int(match.group(1))
                if 0 <= years <= 40:
                    return years
            except ValueError:
                continue
    return None


def _extract_education_level(text: str) -> str | None:
    for pattern, canonical in _EDUCATION_PATTERNS:
        if pattern.search(text):
            return canonical
    return None


def _parse_explicit_skill_tokens(raw_skills_lines: list[str]) -> list[str]:
    tokens: list[str] = []
    for line in raw_skills_lines:
        cleaned_line = re.sub(r"^[•\-*▪◦]+\s*", "", line.strip())
        # If line has a category prefix like "Backend: Python, FastAPI", keep the right side
        if ":" in cleaned_line and len(cleaned_line.split(":", 1)[0]) <= 30:
            cleaned_line = cleaned_line.split(":", 1)[1].strip()
        parts = re.split(r"[,;|•/]+|\s+and\s+|\s+và\s+", cleaned_line)
        for part in parts:
            candidate = part.strip(" .:;()-–—•*")
            if 2 <= len(candidate) <= 40 and len(candidate.split()) <= 4:
                tokens.append(candidate)
    return tokens


def heuristic_extract_jd(text: str, filename: str | None = None) -> JobExtractionLLM:
    """Deterministic rule-based JD field extractor for English and Vietnamese documents."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    labelled: dict[str, str] = {}
    labelled_skills: list[str] = []
    sections: dict[str, list[str]] = {"header": []}
    current_section = "header"

    for line in lines:
        # 1. Check explicit `Field: Value` labels near the top or inside sections
        matched_label = False
        if current_section == "header" or len(line) <= 140:
            for field_name, pattern in _LABEL_PATTERNS.items():
                m = pattern.match(line)
                if m:
                    val = m.group(1).strip(" |,-–—:•*")
                    if val:
                        if field_name == "skills":
                            labelled_skills.append(val)
                        elif field_name not in labelled:
                            labelled[field_name] = val
                        matched_label = True
                        break
        if matched_label:
            continue

        # 2. Check section headings
        heading = _clean_heading_candidate(line)
        matched_section = next(
            (name for name, pat in _SECTION_PATTERNS.items() if len(heading) <= 55 and pat.match(heading)),
            None,
        )
        if matched_section:
            current_section = matched_section
            sections.setdefault(current_section, [])
            continue

        sections.setdefault(current_section, []).append(line)

    # ── Title ────────────────────────────────────────────────────────────────
    title: str | None = labelled.get("title")
    header_lines = sections.get("header", [])
    used_header_idx: int | None = None

    if not title:
        for idx, line in enumerate(header_lines[:8]):
            cleaned = re.sub(r"^[#*•\-–—]+\s*", "", line).strip()
            cleaned = re.sub(
                r"^(?:job\s*description|mô\s*tả\s*công\s*việc|tuyển\s*dụng|we\s*are\s*hiring|hiring)\s*[:\-–|]\s*",
                "",
                cleaned,
                flags=re.IGNORECASE,
            ).strip()
            lower = cleaned.lower().strip(" :.-–—!")
            if not cleaned or lower in _IGNORE_TITLE_HEADERS:
                continue
            if len(cleaned) <= 120 and not cleaned.endswith("."):
                title = cleaned
                used_header_idx = idx
                break

    if not title:
        title = _infer_title_from_filename(filename)

    # ── Department & Location ────────────────────────────────────────────────
    department: str | None = labelled.get("department")
    location: str | None = labelled.get("location")

    if not location:
        header_block = "\n".join(header_lines[:10])
        loc_matches = list(dict.fromkeys(m.group(1) for m in _LOCATION_FALLBACK_RE.finditer(header_block)))
        if loc_matches:
            location = " / ".join(loc_matches[:2])

    # ── Description & Requirements ───────────────────────────────────────────
    remaining_header = [
        line
        for idx, line in enumerate(header_lines)
        if idx != used_header_idx and line.lower().strip(" :.-–—!") not in _IGNORE_TITLE_HEADERS
    ]

    desc_lines = sections.get("description", [])
    req_lines = sections.get("requirements", [])
    skill_section_lines = sections.get("skills", [])
    benefit_lines = sections.get("benefits", [])

    if desc_lines:
        combined_desc = remaining_header + desc_lines
    elif req_lines or skill_section_lines:
        combined_desc = remaining_header
    else:
        combined_desc = remaining_header

    if benefit_lines and combined_desc:
        combined_desc = combined_desc + [""] + benefit_lines

    description = "\n".join(combined_desc).strip() or None
    requirements = "\n".join(req_lines).strip() or None

    if not description:
        # Ensure description is always populated if the file has text
        description = "\n".join(lines).strip() or None

    # ── Required Skills ──────────────────────────────────────────────────────
    skills_from_dict = find_skills_in_text(
        "\n".join(labelled_skills + skill_section_lines + req_lines)
    )
    all_dict_skills = dedupe_skills(skills_from_dict + find_skills_in_text(text))
    explicit_tokens = _parse_explicit_skill_tokens(labelled_skills + skill_section_lines)
    required_skills = dedupe_skills(all_dict_skills + explicit_tokens)[:30]

    # ── Experience Years ─────────────────────────────────────────────────────
    experience_years: int | None = None
    if "experience" in labelled:
        experience_years = _extract_experience_years(labelled["experience"])
        if experience_years is None:
            num_match = re.search(r"\b(\d{1,2})\b", labelled["experience"])
            if num_match:
                val = int(num_match.group(1))
                if 0 <= val <= 40:
                    experience_years = val
    if experience_years is None:
        experience_years = _extract_experience_years("\n".join(req_lines + skill_section_lines))
    if experience_years is None:
        experience_years = _extract_experience_years(text)

    # ── Education Level ──────────────────────────────────────────────────────
    education_level: str | None = None
    if "education" in labelled:
        education_level = _extract_education_level(labelled["education"]) or labelled["education"][:100]
    if not education_level:
        education_level = _extract_education_level("\n".join(req_lines)) or _extract_education_level(text)

    return JobExtractionLLM(
        title=title,
        department=department,
        location=location,
        description=description,
        requirements=requirements,
        required_skills=required_skills,
        experience_years=experience_years,
        education_level=education_level,
    )


async def extract_jd_from_text(
    raw_text: str | None,
    *,
    filename: str | None = None,
    llm: BaseLLM | None = None,
    allow_fallback: bool | None = None,
) -> JobExtractionRead:
    """Extract structured JD fields using the configured LLM with deterministic heuristic fallback."""
    if not raw_text or not raw_text.strip():
        raise FileProcessingError("Job description file has no extractable text.")

    allow_fallback = settings.LLM_FALLBACK_TO_HEURISTIC if allow_fallback is None else allow_fallback
    clipped_text = raw_text.strip()[:MAX_JD_CHARS]
    heuristic_result = heuristic_extract_jd(clipped_text, filename=filename)

    resolved_llm = llm or get_llm_or_none()
    if resolved_llm is not None:
        try:
            prompt = JD_EXTRACTION_PROMPT.format(jd_text=clipped_text)
            llm_result = await resolved_llm.generate(prompt, JobExtractionLLM)
            merged_skills = dedupe_skills(llm_result.required_skills or heuristic_result.required_skills)
            return JobExtractionRead(
                title=llm_result.title or heuristic_result.title,
                department=llm_result.department or heuristic_result.department,
                location=llm_result.location or heuristic_result.location,
                description=llm_result.description or heuristic_result.description,
                requirements=llm_result.requirements or heuristic_result.requirements,
                required_skills=merged_skills,
                experience_years=(
                    llm_result.experience_years
                    if llm_result.experience_years is not None
                    else heuristic_result.experience_years
                ),
                education_level=llm_result.education_level or heuristic_result.education_level,
                file_name=filename or "job-description",
                extraction_source=resolved_llm.model,
            )
        except AIServiceError as exc:
            if not allow_fallback:
                raise
            logger.warning("LLM JD extraction failed, using heuristic fallback: %s", exc)
    elif not allow_fallback:
        raise AIServiceError("No LLM configured and heuristic fallback is disabled")

    return JobExtractionRead(
        **heuristic_result.model_dump(),
        file_name=filename or "job-description",
        extraction_source=HEURISTIC_SOURCE,
    )


async def extract_job_from_file(
    file: UploadFile,
    *,
    llm: BaseLLM | None = None,
) -> JobExtractionRead:
    """Validate an uploaded PDF/DOCX JD file, parse its text, and extract draft JD fields."""
    file_ext = _detect_jd_file_ext(file)
    raw_stream = getattr(file, "file", None)
    if raw_stream is not None and hasattr(raw_stream, "read"):
        file_bytes = raw_stream.read()
    else:
        file_bytes = await file.read()

    if not file_bytes:
        raise BadRequestError("Uploaded file is empty.")
    if len(file_bytes) > MAX_JD_FILE_SIZE_BYTES:
        raise BadRequestError(
            f"File size {len(file_bytes)} bytes exceeds limit of {MAX_JD_FILE_SIZE_BYTES} bytes."
        )

    raw_text = parse_document(
        file_bytes,
        file_ext,
        enable_ocr=True,
    )
    return await extract_jd_from_text(
        raw_text,
        filename=file.filename or f"job-description.{file_ext}",
        llm=llm,
    )
