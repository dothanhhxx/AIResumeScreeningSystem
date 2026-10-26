"""
CV Pydantic schemas — request / response models for the CV pipeline.
Owner: Person B

These schemas are used by app/api/cvs.py and app/services/cv_service.py.
They intentionally do NOT import from app.models to avoid circular imports;
the CV model lives in app/models/cv.py (owned by Person A).
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.cv import CVStatus


# ── Base ────────────────────────────────────────────────────────────────────
class CVBase(BaseModel):
    """Shared fields present in both request and response schemas."""
    model_config = ConfigDict(from_attributes=True)

    candidate_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Full name of the candidate",
        examples=["Nguyen Van A"],
    )
    candidate_email: str | None = Field(
        default=None,
        max_length=255,
        description="Optional candidate email address",
        examples=["nguyenvana@example.com"],
    )


# ── Upload request (multipart/form-data) ─────────────────────────────────────
class CVUploadRequest(BaseModel):
    """
    Form fields accompanying a single-file CV upload.
    The actual file is sent as an UploadFile in the route, not in this schema.
    """
    candidate_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Candidate's full name",
    )
    candidate_email: str | None = Field(
        default=None,
        max_length=255,
        description="Candidate's email (optional)",
    )

    @field_validator("candidate_email", mode="before")
    @classmethod
    def empty_string_to_none(cls, v: Any) -> str | None:
        """Treat empty strings as None for optional email field."""
        if isinstance(v, str) and v.strip() == "":
            return None
        return v


# ── Response schemas ─────────────────────────────────────────────────────────
class CVResponse(CVBase):
    """
    Full CV representation returned by the API.
    Maps directly to the CV ORM model.
    """
    id: int
    file_name: str = Field(description="Original filename of the uploaded CV")
    file_url: str = Field(description="MinIO storage path (object key)")
    file_size: int = Field(description="File size in bytes")
    file_type: str = Field(description="Detected file type: pdf, docx")
    status: CVStatus = Field(description="Current processing status")
    raw_text: str | None = Field(
        default=None,
        description="Extracted plain text (set after parsing completes)",
    )
    structured_data: str | None = Field(
        default=None,
        description="JSON blob of AI-extracted structured fields",
    )
    uploaded_by: int | None = Field(
        default=None,
        description="User ID of the uploader",
    )
    created_at: datetime
    updated_at: datetime


class CVSummaryResponse(BaseModel):
    """
    Lightweight CV representation used in paginated list responses.
    Excludes heavy text fields to keep payloads small.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    candidate_name: str
    candidate_email: str | None
    file_name: str
    file_type: str
    file_size: int
    status: CVStatus
    uploaded_by: int | None
    created_at: datetime


# ── Batch upload ──────────────────────────────────────────────────────────────
class CVBatchUploadResponse(BaseModel):
    """
    Response returned after a batch (multi-file) CV upload.

    Contains a summary of how many files succeeded / failed together with
    per-file details for client-side error handling.
    """
    total: int = Field(description="Total number of files submitted")
    succeeded: int = Field(description="Number of successfully queued CVs")
    failed: int = Field(description="Number of files that could not be processed")
    results: list["CVBatchItemResult"] = Field(
        description="Per-file processing result",
    )


class CVBatchItemResult(BaseModel):
    """Result for a single file within a batch upload."""
    file_name: str
    success: bool
    cv_id: int | None = Field(
        default=None,
        description="Assigned CV ID if the upload succeeded",
    )
    error: str | None = Field(
        default=None,
        description="Error message if the upload failed",
    )


# ── Status update (internal) ─────────────────────────────────────────────────
class CVStatusUpdate(BaseModel):
    """Used internally by Celery tasks to patch CV status."""
    status: CVStatus
    raw_text: str | None = None
    structured_data: str | None = None
