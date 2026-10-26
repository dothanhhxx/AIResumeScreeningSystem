from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.schemas.matching import LLMScoreOutput, MatchRequest, MatchResultRead


def stored_match_result(**overrides) -> SimpleNamespace:
    """Mimics a MatchResult ORM row, where skills are stored as JSON text."""
    values = {
        "id": 1,
        "cv_id": 10,
        "job_id": 20,
        "overall_score": 82.5,
        "skill_score": 90.0,
        "experience_score": 75.0,
        "education_score": None,
        "explanation": "Strong Python background.",
        "matched_skills": '["Python", "FastAPI"]',
        "missing_skills": '["Kubernetes"]',
        "model_name": "gemini-flash-latest",
        "model_version": None,
        "rank": 1,
        "created_at": datetime(2026, 10, 26, tzinfo=timezone.utc),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_match_result_read_parses_stored_skill_json():
    result = MatchResultRead.model_validate(stored_match_result())

    assert result.matched_skills == ["Python", "FastAPI"]
    assert result.missing_skills == ["Kubernetes"]
    assert result.education_score is None


@pytest.mark.parametrize("stored", [None, "null", "[]"])
def test_match_result_read_treats_missing_skills_as_empty_list(stored):
    result = MatchResultRead.model_validate(stored_match_result(matched_skills=stored, missing_skills=stored))

    assert result.matched_skills == []
    assert result.missing_skills == []


@pytest.mark.parametrize("stored", ["not json", '{"a": 1}'])
def test_match_result_read_rejects_invalid_skill_json(stored):
    with pytest.raises(ValidationError):
        MatchResultRead.model_validate(stored_match_result(matched_skills=stored))


def test_llm_score_output_rejects_scores_outside_0_100():
    valid = {"skill_score": 80, "experience_score": 70, "education_score": 60, "explanation": "ok"}
    assert LLMScoreOutput(**valid).matched_skills == []

    for field in ["skill_score", "experience_score", "education_score"]:
        for bad in [-1, 101]:
            with pytest.raises(ValidationError):
                LLMScoreOutput(**{**valid, field: bad})


def test_match_request_scores_all_cvs_by_default():
    assert MatchRequest(job_id=1).cv_ids is None
    assert MatchRequest(job_id=1, cv_ids=[1, 2]).cv_ids == [1, 2]
