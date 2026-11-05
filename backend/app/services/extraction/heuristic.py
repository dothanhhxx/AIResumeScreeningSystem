"""
Offline heuristic CV extractor — rule-based fallback for when the LLM is unavailable.
Owner: Person C

Produces the same `CVExtraction` schema as the Gemini extractor, using section
headings, a skill dictionary and date-range parsing. Less accurate than the LLM,
but deterministic, free and private (nothing leaves the server).
"""

import re
from datetime import date

from app.services.extraction.schemas import CVExtraction, Education, WorkExperience
from app.services.matching.skills import dedupe_skills, find_skills_in_text

_SECTION_PATTERNS: dict[str, re.Pattern[str]] = {
    "summary": re.compile(r"^(summary|profile|about me|objective|career objective|mục tiêu.*|giới thiệu.*|tóm tắt.*)$"),
    "experience": re.compile(
        r"^(work experience|experience|employment history|professional experience|kinh nghiệm.*)$"
    ),
    "education": re.compile(r"^(education|academic background|học vấn|trình độ học vấn|education & training)$"),
    "skills": re.compile(r"^(skills|technical skills|kỹ năng.*|ky nang.*|core competencies|technologies)$"),
    "projects": re.compile(r"^(projects|personal projects|dự án.*)$"),
    "certifications": re.compile(r"^(certifications?|certificates?|chứng chỉ.*|awards?.*|giải thưởng.*)$"),
    "languages": re.compile(r"^(languages?|ngoại ngữ|ngôn ngữ)$"),
}

_PRESENT = r"(?:present|now|current|nay|hiện tại|hien tai)"
_MONTH_YEAR = r"(?:(?P<{p}m>\d{{1,2}})\s*[/.\-]\s*)?(?P<{p}y>(?:19|20)\d{{2}})"
_RANGE_RE = re.compile(
    _MONTH_YEAR.format(p="s")
    + r"\s*(?:-|–|—|to|đến|~)\s*(?:"
    + _MONTH_YEAR.format(p="e")
    + r"|(?P<present>"
    + _PRESENT
    + r"))",
    re.IGNORECASE,
)
_YEARS_STATED_RE = re.compile(
    r"(\d+(?:[.,]\d)?)\+?\s*(?:years?|yrs?|năm)\s*(?:of\s*)?(?:experience|kinh nghiệm|exp)", re.IGNORECASE
)

_DEGREES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(ph\.?d|doctor of|doctorate|tiến sĩ)\b", re.IGNORECASE), "PhD"),
    (re.compile(r"\b(master|m\.?sc|mba|m\.?eng|thạc sĩ)\b", re.IGNORECASE), "Master"),
    (re.compile(r"\b(bachelor|b\.?sc|b\.?eng|b\.?a\.|cử nhân|kỹ sư|engineer'?s degree|đại học|university)\b",
                re.IGNORECASE), "Bachelor"),
    (re.compile(r"\b(college|associate|cao đẳng)\b", re.IGNORECASE), "College"),
]
_INSTITUTION_RE = re.compile(r"(university|đại học|học viện|institute|academy|college|cao đẳng|school)", re.IGNORECASE)
_FIELD_RE = re.compile(
    r"(?:major(?:ing)?\s*(?:in|:)|chuyên ngành\s*:?|ngành\s*:?|degree in|bachelor of|master of|in)\s+"
    r"([A-Za-zÀ-ỹ&\s]{3,60})",
    re.IGNORECASE,
)
_GPA_RE = re.compile(r"\b(?:gpa|cpa|điểm trung bình)\s*:?\s*(\d(?:[.,]\d{1,2})?\s*(?:/\s*\d+(?:[.,]\d)?)?)", re.IGNORECASE)

_LANGUAGE_RE = re.compile(
    r"\b(english|tiếng anh|japanese|tiếng nhật|korean|tiếng hàn|chinese|tiếng trung|french|tiếng pháp|"
    r"german|tiếng đức|ielts\s*\d(?:\.\d)?|toeic\s*\d{3}|toefl\s*\d{2,3}|jlpt\s*n[1-5]|topik\s*\d|hsk\s*\d)\b",
    re.IGNORECASE,
)
_LANGUAGE_NAMES = {
    "tiếng anh": "English", "english": "English", "tiếng nhật": "Japanese", "japanese": "Japanese",
    "tiếng hàn": "Korean", "korean": "Korean", "tiếng trung": "Chinese", "chinese": "Chinese",
    "tiếng pháp": "French", "french": "French", "tiếng đức": "German", "german": "German",
}
_CERT_RE = re.compile(
    r"(certified|certificate|certification|chứng chỉ|aws certified|pmp|scrum master|ccna|ocp|azure fundamentals)",
    re.IGNORECASE,
)


def _split_sections(text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {"header": []}
    current = "header"
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        heading = re.sub(r"[:#*•\-–_|]+", " ", line).strip().lower()
        heading = re.sub(r"\s+", " ", heading)
        matched = next(
            (name for name, pattern in _SECTION_PATTERNS.items() if len(heading) <= 40 and pattern.match(heading)),
            None,
        )
        if matched:
            current = matched
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line)
    return sections


def _month_index(year: str, month: str | None, default_month: int) -> int:
    m = int(month) if month and 1 <= int(month) <= 12 else default_month
    return int(year) * 12 + (m - 1)


def _format(year: str, month: str | None) -> str:
    if month and 1 <= int(month) <= 12:
        return f"{year}-{int(month):02d}"
    return year


def _parse_experiences(lines: list[str], today: date) -> tuple[list[WorkExperience], float | None]:
    experiences: list[WorkExperience] = []
    intervals: list[tuple[int, int]] = []
    now_index = today.year * 12 + today.month - 1

    for i, line in enumerate(lines):
        match = _RANGE_RE.search(line)
        if not match:
            continue
        start = _month_index(match["sy"], match["sm"], 1)
        if match["present"]:
            end, end_label = now_index, "present"
        else:
            end, end_label = _month_index(match["ey"], match["em"], 12), _format(match["ey"], match["em"])
        if end < start or start > now_index:
            continue
        intervals.append((start, min(end, now_index)))

        title = _RANGE_RE.sub("", line).strip(" |,-–—:()")
        if len(title) < 3 and i > 0:
            title = lines[i - 1]
        parts = [p.strip() for p in re.split(r"\s+(?:at|tại|@)\s+|\s*[|,–—]\s*", title) if p.strip()]
        description = lines[i + 1] if i + 1 < len(lines) and not _RANGE_RE.search(lines[i + 1]) else None
        experiences.append(
            WorkExperience(
                title=(parts[0] if parts else title or "Experience")[:120],
                company=parts[1][:120] if len(parts) > 1 else None,
                start_date=_format(match["sy"], match["sm"]),
                end_date=end_label,
                description=description[:300] if description else None,
            )
        )

    if not intervals:
        return experiences, None

    # Merge overlapping periods so they count once
    intervals.sort()
    merged = [list(intervals[0])]
    for start, end in intervals[1:]:
        if start <= merged[-1][1] + 1:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    months = sum(end - start + 1 for start, end in merged)
    return experiences, round(months / 12, 1)


def _parse_education(lines: list[str]) -> list[Education]:
    if not lines:
        return []
    block = "\n".join(lines)
    degree = next((label for pattern, label in _DEGREES if pattern.search(block)), None)
    institution = next((line for line in lines if _INSTITUTION_RE.search(line)), None)
    years = [int(y) for y in re.findall(r"\b((?:19|20)\d{2})\b", block)]
    field_match = _FIELD_RE.search(block)
    gpa_match = _GPA_RE.search(block)
    if not (degree or institution):
        return []
    return [
        Education(
            institution=_RANGE_RE.sub("", institution).strip(" |,-–—:")[:150] if institution else None,
            degree=degree,
            field_of_study=field_match.group(1).strip().split("\n")[0][:80] if field_match else None,
            graduation_year=max(years) if years else None,
            gpa=gpa_match.group(1).replace(" ", "") if gpa_match else None,
        )
    ]


def _parse_languages(text: str) -> list[str]:
    found: list[str] = []
    for match in _LANGUAGE_RE.finditer(text):
        token = match.group(1).strip()
        name = _LANGUAGE_NAMES.get(token.lower())
        label = name or re.sub(r"\s+", " ", token).upper()
        if label not in found:
            found.append(label)
    # "IELTS 7.0" implies English
    if any(item.startswith(("IELTS", "TOEIC", "TOEFL")) for item in found) and "English" not in found:
        found.insert(0, "English")
    return found


def heuristic_extract(text: str, today: date | None = None) -> CVExtraction:
    """Rule-based extraction of skills, experience, education, certifications and languages."""
    today = today or date.today()
    sections = _split_sections(text)

    skill_text = "\n".join(sections.get("skills", []))
    skills = find_skills_in_text(skill_text) if skill_text else []
    skills = dedupe_skills(skills + find_skills_in_text(text))

    experience_lines = sections.get("experience") or sections.get("header", [])
    experiences, computed_years = _parse_experiences(experience_lines, today)

    stated = [float(m.replace(",", ".")) for m in _YEARS_STATED_RE.findall(text)]
    years = computed_years
    if stated and (years is None or max(stated) > years):
        years = max(stated)

    education = _parse_education(sections.get("education", []))

    cert_lines = sections.get("certifications", [])
    certifications = [line[:150] for line in cert_lines if len(line) > 2][:10]
    if not certifications:
        certifications = [line[:150] for line in text.splitlines() if _CERT_RE.search(line)][:10]

    summary_lines = sections.get("summary", [])
    summary = " ".join(summary_lines)[:400] or None

    return CVExtraction(
        summary=summary,
        skills=skills[:60],
        years_of_experience=years,
        experiences=experiences[:15],
        education=education,
        certifications=certifications,
        languages=_parse_languages(text),
    )


_EMAIL_EXTRACT_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_LABELLED_NAME_RE = re.compile(
    r"^(?:full\s*name|candidate\s*name|candidate|name|họ\s*và\s*tên|họ\s*tên|ứng\s*viên)\s*[:\-–]\s*(.+)$",
    re.IGNORECASE,
)
_IGNORE_HEADER_WORDS = {
    "curriculum vitae",
    "resume",
    "cv",
    "sơ yếu lý lịch",
    "so yeu ly lich",
    "hồ sơ ứng tuyển",
    "ho so ung tuyen",
    "personal information",
    "thông tin cá nhân",
    "contact",
    "liên hệ",
}
_ROLE_KEYWORDS_RE = re.compile(
    r"\b(engineer|developer|analyst|designer|manager|architect|specialist|intern|consultant|"
    r"director|lead|officer|administrator|programmer|scientist|tester|qa|devops|fullstack|"
    r"frontend|backend|data|product|project|marketing|sales|hr|recruiter|kỹ sư|lập trình viên|"
    r"chuyên viên|nhân viên| thực tập sinh|quản lý|analysist|senior|junior|fresher)\b",
    re.IGNORECASE,
)
# Lines that are postal addresses / locations (e.g. "Thanh Xuân, Hà Nội"), never a person's name.
_ADDRESS_RE = re.compile(
    r"(hà nội|ha noi|hanoi|hồ chí minh|ho chi minh|tp\.?\s*hcm|sài gòn|đà nẵng|da nang|hải phòng|cần thơ|"
    r"việt nam|vietnam|quận|huyện|phường|thành phố|tỉnh|đường|\b(?:street|district|ward|city|province)\b)",
    re.IGNORECASE,
)


def _strip_trailing_role(segment: str) -> str:
    """'Đỗ Thanh Hải Data Analyst' → 'Đỗ Thanh Hải' (name and job title often share one header line)."""
    match = _ROLE_KEYWORDS_RE.search(segment)
    if match and match.start() > 0:
        return segment[: match.start()].strip()
    return segment


def _normalize_person_name(raw: str) -> str:
    cleaned = re.sub(r"\s+", " ", raw.strip(" |,-–—:•*#()[]{}")).strip()
    if cleaned.isupper():
        return " ".join(word.capitalize() for word in cleaned.split())
    return cleaned


def infer_name_from_filename(file_name: str | None) -> str:
    """Derive a readable fallback candidate name from a resume filename."""
    if not file_name:
        return "Candidate"
    stem = re.sub(r"\.(pdf|docx)$", "", file_name.strip(), flags=re.IGNORECASE)
    stem = re.sub(r"^(?:cv|resume|ho[\s_-]*so|ung[\s_-]*vien)[\s_.\-0-9]*", "", stem, flags=re.IGNORECASE)
    stem = re.sub(r"[\s_.\-]+(?:cv|resume|senior|junior|mid|intern|final|v\d+)$", "", stem, flags=re.IGNORECASE)
    # "CV Data Analyst - Đỗ Thanh Hải": keep the part that is not a job title
    stem = stem.replace("_", " ")
    parts = [p.strip() for p in re.split(r"\s+[-–|]\s+", stem) if p.strip()]
    if len(parts) > 1:
        names = [p for p in parts if not _ROLE_KEYWORDS_RE.search(p)]
        if names:
            stem = names[-1]
    stem = re.sub(r"[_\-.]+", " ", stem)
    stem = re.sub(r"\b\d+\b", " ", stem)
    stem = re.sub(r"\s+", " ", stem).strip()
    if not stem:
        return "Candidate"
    return _normalize_person_name(stem)[:255]


def extract_candidate_identity(raw_text: str | None) -> tuple[str | None, str | None]:
    """
    Scan raw CV text locally to extract (candidate_name, candidate_email).
    Runs before PII stripping so contact metadata can be recorded on the CV record.
    """
    if not raw_text or not raw_text.strip():
        return None, None

    email_match = _EMAIL_EXTRACT_RE.search(raw_text)
    detected_email = email_match.group(0).strip().lower() if email_match else None

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    detected_name: str | None = None

    # 1. Check explicit "Name: ..." / "Họ và tên: ..." labels in the first 25 lines
    for line in lines[:25]:
        label_match = _LABELLED_NAME_RE.match(line)
        if label_match:
            candidate = re.split(r"[|•,;]", label_match.group(1))[0].strip()
            if 2 <= len(candidate) <= 80 and not any(ch.isdigit() for ch in candidate):
                detected_name = _normalize_person_name(candidate)
                break

    # 2. Otherwise inspect the top header lines of the CV
    if not detected_name:
        for line in lines[:10]:
            first_segment = re.split(r"\s+[|•–—]\s+", line)[0].strip()
            lower = first_segment.lower()
            if lower in _IGNORE_HEADER_WORDS:
                continue
            if any(pattern.match(lower) for pattern in _SECTION_PATTERNS.values()):
                continue
            if "@" in first_segment or "http" in lower or "www." in lower:
                continue
            if any(ch.isdigit() for ch in first_segment):
                continue
            if "," in first_segment or _ADDRESS_RE.search(first_segment):
                continue
            first_segment = _strip_trailing_role(first_segment)
            if not first_segment or _ROLE_KEYWORDS_RE.search(first_segment):
                continue
            words = [w for w in first_segment.split() if w.isalpha() or "-" in w or "'" in w]
            if 2 <= len(words) <= 6 and 3 <= len(first_segment) <= 65:
                detected_name = _normalize_person_name(first_segment)
                break

    return detected_name, detected_email
