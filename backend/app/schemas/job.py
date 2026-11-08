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


def _normalize_pct_triplet(a: float, b: float, c: float, label: str) -> tuple[float, float, float]:
    total = a + b + c
    if total <= 0:
        raise ValueError(f"Total {label} weight must be greater than 0.")
    if abs(total - 100.0) <= 0.05:
        return round(a, 1), round(b, 1), round(c, 1)
    ra = round(a / total * 100.0, 1)
    rb = round(b / total * 100.0, 1)
    rc = round(100.0 - ra - rb, 1)
    if rc < 0:
        rc = 0.0
    return ra, rb, rc


class ScoringWeights(AppBaseModel):
    """Percentage weights (0–100) for scoring categories and engines."""

    skill: float = Field(default=60.0, ge=0.0, le=100.0)
    experience: float = Field(default=25.0, ge=0.0, le=100.0)
    education: float = Field(default=15.0, ge=0.0, le=100.0)
    rule: float = Field(default=40.0, ge=0.0, le=100.0)
    semantic: float = Field(default=20.0, ge=0.0, le=100.0)
    llm: float = Field(default=40.0, ge=0.0, le=100.0)

    @model_validator(mode="after")
    def validate_and_normalize_totals(self) -> "ScoringWeights":
        cat_sum = self.skill + self.experience + self.education
        if 0 < cat_sum <= 1.05:
            self.skill *= 100.0
            self.experience *= 100.0
            self.education *= 100.0
        self.skill, self.experience, self.education = _normalize_pct_triplet(
            self.skill, self.experience, self.education, "category (skill/experience/education)"
        )

        eng_sum = self.rule + self.semantic + self.llm
        if 0 < eng_sum <= 1.05:
            self.rule *= 100.0
            self.semantic *= 100.0
            self.llm *= 100.0
        self.rule, self.semantic, self.llm = _normalize_pct_triplet(
            self.rule, self.semantic, self.llm, "engine (rule/semantic/llm)"
        )
        return self


def parse_scoring_weights(value: Any) -> ScoringWeights:
    """Parse stored JSON or dict into a validated ScoringWeights instance."""
    if value is None:
        return ScoringWeights()
    if isinstance(value, ScoringWeights):
        return value
    if isinstance(value, dict):
        return ScoringWeights.model_validate(value)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return ScoringWeights()
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            return ScoringWeights()
        if isinstance(parsed, dict):
            try:
                return ScoringWeights.model_validate(parsed)
            except ValueError:
                return ScoringWeights()
    return ScoringWeights()


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
    scoring_weights: ScoringWeights | None = None

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
    scoring_weights: ScoringWeights | None = None
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
    scoring_weights: ScoringWeights = Field(default_factory=ScoringWeights)
    status: JobStatus
    created_by: int | None
    created_at: datetime
    updated_at: datetime

    @field_validator("scoring_weights", mode="before")
    @classmethod
    def parse_stored_weights(cls, value: Any) -> ScoringWeights:
        return parse_scoring_weights(value)

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


class JobExtractionLLM(AppBaseModel):
    """Structured JD fields extracted from an uploaded PDF/DOCX document."""

    title: str | None = None
    department: str | None = None
    location: str | None = None
    description: str | None = None
    requirements: str | None = None
    required_skills: list[str] = Field(default_factory=list)
    experience_years: int | None = Field(default=None, ge=0)
    education_level: str | None = None

    @field_validator("title", "department", "location")
    @classmethod
    def normalize_short_text(cls, value: str | None) -> str | None:
        cleaned = _clean_optional_text(value)
        return cleaned[:255] if cleaned else None

    @field_validator("education_level")
    @classmethod
    def normalize_education(cls, value: str | None) -> str | None:
        cleaned = _clean_optional_text(value)
        return cleaned[:100] if cleaned else None

    @field_validator("description", "requirements")
    @classmethod
    def normalize_long_text(cls, value: str | None) -> str | None:
        return _clean_optional_text(value)

    @field_validator("required_skills", mode="before")
    @classmethod
    def normalize_skill_list(cls, value: Any) -> list[str]:
        if not value or not isinstance(value, list):
            return []
        result: list[str] = []
        for item in value:
            if isinstance(item, str) and item.strip():
                result.append(item.strip())
        return result


class JobExtractionRead(JobExtractionLLM):
    """Extracted JD draft returned to the client for review before saving."""

    file_name: str
    extraction_source: str = "heuristic"

