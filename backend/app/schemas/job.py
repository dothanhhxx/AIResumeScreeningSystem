"""Request and response schemas for job descriptions."""

import json
from datetime import datetime
from typing import Any

from pydantic import Field, field_validator, model_validator

from app.models.job import JobStatus
from app.schemas.common import AppBaseModel


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _clean_required_text(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("This field must not be blank.")
    return cleaned


def _clean_skills(value: list[str] | None) -> list[str] | None:
    if value is None:
        return None
    cleaned = [skill.strip() for skill in value]
    if any(not skill for skill in cleaned):
        raise ValueError("Skills must not be blank.")
    return cleaned


class JobCreate(AppBaseModel):
    """Fields accepted when creating a draft JD."""

    title: str = Field(min_length=1, max_length=255)
    department: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    description: str = Field(min_length=1)
    requirements: str | None = None
    required_skills: list[str] | None = None
    experience_years: int | None = Field(default=None, ge=0)
    education_level: str | None = Field(default=None, max_length=100)

    @field_validator("title", "description")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        return _clean_required_text(value)

    @field_validator("department", "location", "requirements", "education_level")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return _clean_optional_text(value)

    @field_validator("required_skills")
    @classmethod
    def validate_skills(cls, value: list[str] | None) -> list[str] | None:
        return _clean_skills(value)


class JobUpdate(AppBaseModel):
    """Partial update fields; omitted values remain unchanged."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    department: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, min_length=1)
    requirements: str | None = None
    required_skills: list[str] | None = None
    experience_years: int | None = Field(default=None, ge=0)
    education_level: str | None = Field(default=None, max_length=100)
    status: JobStatus | None = None

    @field_validator("title", "description")
    @classmethod
    def validate_required_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_required_text(value)

    @field_validator("department", "location", "requirements", "education_level")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return _clean_optional_text(value)

    @field_validator("required_skills")
    @classmethod
    def validate_skills(cls, value: list[str] | None) -> list[str] | None:
        return _clean_skills(value)

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "JobUpdate":
        for field_name in ("title", "description", "status"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null.")
        return self


class JobRead(AppBaseModel):
    """Public JD representation; skills are exposed as a list, not raw JSON."""

    id: int
    title: str
    department: str | None
    location: str | None
    description: str
    requirements: str | None
    required_skills: list[str] | None
    experience_years: int | None
    education_level: str | None
    status: JobStatus
    created_by: int | None
    created_at: datetime
    updated_at: datetime

    @field_validator("required_skills", mode="before")
    @classmethod
    def parse_stored_skills(cls, value: Any) -> list[str] | None:
        if value is None or isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError("Stored required_skills must contain valid JSON.") from exc
            if parsed is None or isinstance(parsed, list):
                return parsed
        raise ValueError("Stored required_skills must be a JSON list of strings.")
