"""
Tests for SHA-256 deduplication logic in cv_service.
Owner: Person B
"""

import hashlib

from app.services.cv_service import _build_object_key, _compute_sha256


def test_compute_sha256():
    sample_data = b"Resume content for candidate Nguyen Van B"
    expected = hashlib.sha256(sample_data).hexdigest()
    assert _compute_sha256(sample_data) == expected


def test_build_object_key_includes_hash():
    file_type = "application/pdf"
    candidate = "John Doe"
    digest = "a1b2c3d4e5f67890abcdef1234567890"

    key = _build_object_key(file_type, candidate, file_hash=digest)
    assert key.startswith("resumes/a1b2c3d4e5f67890_john_doe.pdf")
    assert key.endswith(".pdf")


def test_build_object_key_safe_filename():
    file_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    candidate = "Trần Văn A / Special & Characters"
    digest = "9876543210fedcba"

    key = _build_object_key(file_type, candidate, file_hash=digest)
    assert key.startswith("resumes/9876543210fedcba_")
    assert key.endswith(".docx")
    assert "/" not in key.replace("resumes/", "")
