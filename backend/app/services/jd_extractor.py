"""Backward-compatible re-export of JD extraction service from app.services.extraction."""

from app.services.extraction.jd_extractor import (
    HEURISTIC_SOURCE,
    JD_EXTRACTION_PROMPT,
    MAX_JD_CHARS,
    MAX_JD_FILE_SIZE_BYTES,
    extract_jd_from_text,
    extract_job_from_file,
    heuristic_extract_jd,
)

__all__ = [
    "HEURISTIC_SOURCE",
    "JD_EXTRACTION_PROMPT",
    "MAX_JD_CHARS",
    "MAX_JD_FILE_SIZE_BYTES",
    "extract_jd_from_text",
    "extract_job_from_file",
    "heuristic_extract_jd",
]
