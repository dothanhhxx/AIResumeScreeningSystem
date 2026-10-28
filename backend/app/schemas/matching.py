"""
Request / response schemas for CV ↔ JD matching.
Owner: Person C  (Person D uses MatchRequest / MatchResultRead in app/api/matching.py and the ranking UI)
"""

import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import AppBaseModel


class LLMScoreOutput(BaseModel):
    """Response schema the LLM must follow when scoring one CV against one JD (used by llm_scorer.py)."""

    skill_score: float = Field(ge=0, le=100, description="How well the candidate's skills cover the JD, 0-100")
    experience_score: float = Field(ge=0, le=100, description="Fit of years and type of experience, 0-100")
    education_score: float = Field(ge=0, le=100, description="Fit of degree and field of study, 0-100")
    matched_skills: list[str] = Field(default_factory=list, description="JD skills the candidate clearly has")
    missing_skills: list[str] = Field(default_factory=list, description="JD skills not found in the CV")
    explanation: str = Field(description="2-4 sentences justifying the scores with evidence from the CV")


# TODO(Person C + D): agree whether matching runs synchronously or as a Celery job
#                     (then add run_id / status fields to the response), see docs/integration.md.
class MatchRequest(AppBaseModel):
    """Body for POST /matching — score CVs against one JD."""

    job_id: int
    cv_ids: list[int] | None = Field(default=None, description="CVs to score; null = every EXTRACTED CV")


# TODO(Person A + C): MatchResult has no columns for the rule / semantic / LLM sub-scores.
#                     Decide whether aggregator.py only fills skill/experience/education_score
#                     or Person A adds extra columns (+ migration), then expose them here.
class MatchResultRead(AppBaseModel):
    """One scored CV for a JD, as shown in the ranking UI. Scores are 0-100."""

    id: int
    cv_id: int
    job_id: int
    overall_score: float
    skill_score: float | None
    experience_score: float | None
    education_score: float | None
    matched_skills: list[str]
    missing_skills: list[str]
    explanation: str | None
    model_name: str | None
    model_version: str | None
    rank: int | None
    created_at: datetime

    @field_validator("matched_skills", "missing_skills", mode="before")
    @classmethod
    def parse_stored_skills(cls, value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError("Stored skills must contain valid JSON.") from exc
            if parsed is None or isinstance(parsed, list):
                return parsed or []
        raise ValueError("Stored skills must be a JSON list of strings.")
