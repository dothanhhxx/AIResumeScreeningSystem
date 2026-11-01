"""
Request / response schemas for CV ↔ JD matching.
Owner: Person C  (Person D uses MatchRequest / MatchResultRead in app/api/matching.py and the ranking UI)

Contract (agreed C ↔ D):
  - Matching is asynchronous: POST /matching/run queues one score task per CV and
    returns a MatchRunResponse; the UI polls GET /matching/jobs/{job_id}/results.
  - All scores are 0-100. overall_score = weighted mix of rule / semantic / LLM scores
    (weights in `details.weights`). effective_score = recruiter override if set, else overall.
  - Ranking order: effective_score desc; `rank` is 1-based within a job.
"""

import json
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.models.cv import CVStatus
from app.models.decision import DecisionStatus
from app.schemas.common import AppBaseModel

EvidenceStatus = Literal["found", "unclear", "not_found"]


def _parse_json_list(value: Any) -> list[Any]:
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


class EvidenceItem(BaseModel):
    """One JD requirement and the CV evidence for it."""

    requirement: str = Field(description="JD requirement, e.g. 'Python' or '3+ years of experience'")
    category: str = Field(default="skill", description="skill | experience | education | other")
    status: EvidenceStatus = Field(description="found = clear CV evidence, unclear = partial, not_found = none")
    quote: str | None = Field(default=None, description="Short verbatim quote from the CV, if any")


class LLMScoreOutput(BaseModel):
    """Response schema the LLM must follow when scoring one CV against one JD (used by llm_scorer.py)."""

    skill_score: float = Field(ge=0, le=100, description="How well the candidate's skills cover the JD, 0-100")
    experience_score: float = Field(ge=0, le=100, description="Fit of years and type of experience, 0-100")
    education_score: float = Field(ge=0, le=100, description="Fit of degree and field of study, 0-100")
    overall_score: float | None = Field(default=None, ge=0, le=100, description="Overall fit for the role, 0-100")
    matched_skills: list[str] = Field(default_factory=list, description="JD skills the candidate clearly has")
    missing_skills: list[str] = Field(default_factory=list, description="JD skills not found in the CV")
    evidence: list[EvidenceItem] = Field(default_factory=list, description="Evidence per important JD requirement")
    strengths: list[str] = Field(default_factory=list, description="2-4 job-relevant strengths")
    gaps: list[str] = Field(default_factory=list, description="2-4 gaps or points to verify")
    interview_questions: list[str] = Field(default_factory=list, description="3 questions to verify the gaps")
    explanation: str = Field(description="2-4 sentences justifying the scores with evidence from the CV")


class MatchRequest(AppBaseModel):
    """Body for POST /matching/run — score CVs against one JD."""

    job_id: int
    cv_ids: list[int] | None = Field(default=None, description="CVs to score; null = every CV ready for matching")


class MatchRunResponse(BaseModel):
    """Returned by POST /matching/run. Scoring continues in the background."""

    job_id: int
    queued: int
    cv_ids: list[int]
    skipped: list[int] = Field(default_factory=list, description="Requested CVs that are not extracted yet")


class MatchDetails(BaseModel):
    """Parsed `MatchResult.details` JSON."""

    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    interview_questions: list[str] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    weights: dict[str, float] = Field(default_factory=dict)
    sources: dict[str, str] = Field(default_factory=dict, description="Which engine produced each part")


class DecisionRead(AppBaseModel):
    id: int
    status: DecisionStatus
    reason: str | None
    note: str | None
    score_override: float | None
    decided_by: int | None
    updated_at: datetime


class DecisionUpsert(BaseModel):
    """Body for PUT /matching/results/{id}/decision — the recruiter's override + decision."""

    status: DecisionStatus
    reason: str | None = Field(default=None, max_length=500)
    note: str | None = Field(default=None, max_length=5000)
    score_override: float | None = Field(default=None, ge=0, le=100)

    @field_validator("reason", "note")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class CandidateBrief(BaseModel):
    """Candidate info shown next to a score. Identity can be hidden in the UI."""

    cv_id: int
    candidate_name: str
    candidate_email: str | None
    file_name: str
    status: CVStatus
    skills: list[str] = Field(default_factory=list)
    years_of_experience: float | None = None


class MatchResultRead(AppBaseModel):
    """One scored CV for a JD, as shown in the ranking UI. Scores are 0-100."""

    id: int
    cv_id: int
    job_id: int
    overall_score: float
    skill_score: float | None
    experience_score: float | None
    education_score: float | None
    rule_score: float | None = None
    semantic_score: float | None = None
    llm_score: float | None = None
    matched_skills: list[str]
    missing_skills: list[str]
    explanation: str | None
    model_name: str | None
    model_version: str | None
    rank: int | None
    created_at: datetime
    updated_at: datetime | None = None

    @field_validator("matched_skills", "missing_skills", mode="before")
    @classmethod
    def parse_stored_skills(cls, value: Any) -> list[str]:
        return _parse_json_list(value)


class RankedMatch(MatchResultRead):
    """Ranking row: score + candidate + recruiter decision + evidence details."""

    effective_score: float
    candidate: CandidateBrief
    decision: DecisionRead | None = None
    details: MatchDetails = Field(default_factory=MatchDetails)


class JobRanking(BaseModel):
    job_id: int
    job_title: str
    total: int
    pending_cvs: int = Field(description="CVs still being scored for this job")
    items: list[RankedMatch]
