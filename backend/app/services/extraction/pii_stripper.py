"""
PII stripper — masks personal data before CV text is sent to the LLM.
Owner: Person C

The Gemini free tier may use prompts to improve Google's products,
so contact details must never leave our system.

Usage:
    from app.services.extraction.pii_stripper import strip_pii

    safe_text = strip_pii(cv.raw_text, known_names=[cv.candidate_name])
"""

import re

EMAIL_TOKEN = "[EMAIL]"
PHONE_TOKEN = "[PHONE]"
URL_TOKEN = "[URL]"
DOB_TOKEN = "[DOB]"
NAME_TOKEN = "[NAME]"

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")

# Any http(s) / www link, plus bare linkedin/github/facebook profile paths
_URL_RE = re.compile(
    r"(?:https?://|www\.)\S+"
    r"|(?:linkedin\.com|github\.com|facebook\.com|fb\.com)/\S+",
    re.IGNORECASE,
)

# Candidate phone: starts with "+", "0" or "(" and is followed by digits/separators.
# Digit count is checked in _mask_phone so year ranges like "2019 - 2023" are left alone.
_PHONE_RE = re.compile(r"(?<![\w+])(?:\+|\(\+?|0)[\d\s().\-]{7,}\d")

_DOB_LABEL = r"(?:ngày\s*sinh|năm\s*sinh|sinh\s*ngày|date\s*of\s*birth|d\.?o\.?b\.?|birthday)"
_DATE = r"\d{1,2}\s*[/.\-]\s*\d{1,2}\s*[/.\-]\s*\d{2,4}"
_DOB_RE = re.compile(rf"({_DOB_LABEL}\s*[:\-]?\s*){_DATE}", re.IGNORECASE)


def _mask_phone(match: re.Match[str]) -> str:
    raw = match.group(0)
    digits = sum(ch.isdigit() for ch in raw)
    if raw.lstrip("(").startswith(("+", "0")) and 9 <= digits <= 15:
        return PHONE_TOKEN
    return raw


def strip_pii(text: str, known_names: list[str] | None = None) -> str:
    """Replace emails, URLs, phone numbers, dates of birth and known names with placeholder tokens."""
    if not text:
        return text

    # Emails and URLs first so their digits are not mistaken for phone numbers
    text = _EMAIL_RE.sub(EMAIL_TOKEN, text)
    text = _URL_RE.sub(URL_TOKEN, text)
    text = _DOB_RE.sub(lambda m: m.group(1) + DOB_TOKEN, text)
    text = _PHONE_RE.sub(_mask_phone, text)

    for name in known_names or []:
        name = name.strip()
        if name:
            text = re.sub(re.escape(name), NAME_TOKEN, text, flags=re.IGNORECASE)

    return text
