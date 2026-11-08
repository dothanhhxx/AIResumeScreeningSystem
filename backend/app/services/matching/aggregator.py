"""
Score aggregator — combines rule, semantic and LLM scores into one explainable result.
Owner: Person C

    overall = Σ weight_i · score_i / Σ weight_i     over the engines that ran

Weights come from settings (SCORE_WEIGHT_RULE / _SEMANTIC / _LLM). When the LLM
is unavailable only rule + semantic are used and the result records that in
`details.sources`, so the UI can show provenance honestly.
"""

import logging
from dataclasses import dataclass, field

from app.config import settings
from app.core.exceptions import AIServiceError
from app.llm import BaseLLM
from app.schemas.job import ScoringWeights
from app.schemas.matching import EvidenceItem, LLMScoreOutput, MatchDetails
from app.services.extraction.schemas import CVExtraction
from app.services.matching.llm_scorer import score_with_llm
from app.services.matching.rule_scorer import JobProfile, RuleScore, combine_category_scores, score_rules
from app.services.matching.semantic_scorer import semantic_score

logger = logging.getLogger(__name__)

ENGINE_VERSION = "hybrid-v1"
HEURISTIC = "heuristic"


@dataclass
class AggregatedScore:
    overall_score: float
    skill_score: float | None
    experience_score: float | None
    education_score: float | None
    rule_score: float
    semantic_score: float | None
    llm_score: float | None
    matched_skills: list[str]
    missing_skills: list[str]
    explanation: str
    details: MatchDetails
    model_name: str
    model_version: str = ENGINE_VERSION
    warnings: list[str] = field(default_factory=list)


def _avg(*values: float | None) -> float | None:
    present = [v for v in values if v is not None]
    return round(sum(present) / len(present), 1) if present else None


def _template_texts(job: JobProfile, rule: RuleScore) -> tuple[list[str], list[str], list[str], str]:
    strengths: list[str] = []
    gaps: list[str] = []
    questions: list[str] = []

    if rule.matched_skills:
        strengths.append("Covers required skills: " + ", ".join(rule.matched_skills[:6]))
    if rule.candidate_years is not None:
        if job.experience_years and rule.candidate_years >= job.experience_years:
            strengths.append(f"About {rule.candidate_years:g} years of experience (JD asks {job.experience_years}+)")
        elif job.experience_years:
            gaps.append(f"About {rule.candidate_years:g} years of experience vs {job.experience_years}+ required")
    if rule.missing_skills:
        gaps.append("No CV evidence for: " + ", ".join(rule.missing_skills[:6]))
        for skill in rule.missing_skills[:2]:
            questions.append(f"Can you describe any hands-on experience you have with {skill}?")
    if rule.education_score is not None and rule.education_score < 100:
        gaps.append(f"Education may not meet the requirement ({job.education_level})")
    questions.append(f"Which project best shows your fit for the {job.title} role, and what was your part in it?")
    if len(questions) < 3:
        questions.append("What would you need to learn first to be productive in this role?")

    coverage = (
        f"{len(rule.matched_skills)}/{len(rule.matched_skills) + len(rule.missing_skills)} required skills found"
        if rule.matched_skills or rule.missing_skills
        else "no explicit skill list in the JD"
    )
    years = "unknown experience"
    if rule.candidate_years is not None:
        years = f"{rule.candidate_years:g} years of experience"
    explanation = (
        f"Rule-based assessment: {coverage}, {years}. "
        "Scores were produced offline without an LLM; verify the evidence before deciding."
    )
    return strengths, gaps, questions[:3], explanation


def _is_custom_engine_weights(custom: ScoringWeights | None) -> bool:
    if custom is None:
        return False
    return (
        abs(custom.rule - 40.0) > 0.05
        or abs(custom.semantic - 20.0) > 0.05
        or abs(custom.llm - 40.0) > 0.05
    )


def _is_custom_category_weights(custom: ScoringWeights | None) -> bool:
    if custom is None:
        return False
    return (
        abs(custom.skill - 60.0) > 0.05
        or abs(custom.experience - 25.0) > 0.05
        or abs(custom.education - 15.0) > 0.05
    )


def _weights(has_semantic: bool, has_llm: bool, custom: ScoringWeights | None = None) -> dict[str, float]:
    if custom is not None and _is_custom_engine_weights(custom):
        r_w = custom.rule / 100.0
        s_w = custom.semantic / 100.0
        l_w = custom.llm / 100.0
    else:
        r_w = settings.SCORE_WEIGHT_RULE
        s_w = settings.SCORE_WEIGHT_SEMANTIC
        l_w = settings.SCORE_WEIGHT_LLM

    weights = {"rule": r_w}
    if has_semantic:
        weights["semantic"] = s_w
    if has_llm:
        weights["llm"] = l_w
    total = sum(weights.values())
    if total <= 0:
        weights = {"rule": 1.0}
        total = 1.0
    return {k: round(v / total, 3) for k, v in weights.items()}


def _category_weights_dict(custom: ScoringWeights | None = None) -> dict[str, float]:
    w = custom or ScoringWeights()
    return {
        "skill": round(w.skill / 100.0, 3),
        "experience": round(w.experience / 100.0, 3),
        "education": round(w.education / 100.0, 3),
    }


def recalculate_with_weights(
    skill_score: float | None,
    experience_score: float | None,
    education_score: float | None,
    semantic_score_val: float | None,
    llm_score_val: float | None,
    weights: ScoringWeights,
) -> tuple[float, float, dict[str, float], dict[str, float]]:
    """Recompute (rule_score, overall_score, engine_weights, category_weights) from sub-scores."""
    new_rule = combine_category_scores(skill_score, experience_score, education_score, weights)
    eng_weights = _weights(semantic_score_val is not None, llm_score_val is not None, weights)
    cat_weights = _category_weights_dict(weights)

    overall = eng_weights["rule"] * new_rule
    if semantic_score_val is not None:
        overall += eng_weights["semantic"] * semantic_score_val
    if llm_score_val is not None:
        effective_llm = (
            round(0.5 * llm_score_val + 0.5 * new_rule, 1)
            if _is_custom_category_weights(weights)
            else llm_score_val
        )
        overall += eng_weights["llm"] * effective_llm

    return new_rule, round(overall, 1), eng_weights, cat_weights


async def aggregate_scores(
    job: JobProfile,
    cv: CVExtraction,
    cv_text: str,
    *,
    llm: BaseLLM | None,
    cv_vector: list[float] | None = None,
    job_vector: list[float] | None = None,
    embedding_model: str | None = None,
) -> AggregatedScore:
    """Run every available engine for one CV ↔ JD pair. `cv_text` must be PII-stripped."""
    warnings: list[str] = []
    rule = score_rules(job, cv, cv_text)

    sem: float | None = None
    if cv_vector and job_vector and embedding_model:
        sem = semantic_score(cv_vector, job_vector, embedding_model)

    llm_out: LLMScoreOutput | None = None
    if llm is not None:
        try:
            llm_out = await score_with_llm(job, cv, cv_text, llm)
        except AIServiceError as exc:
            logger.warning("LLM scoring failed, using rule + semantic only: %s", exc)
            warnings.append(f"LLM scoring unavailable: {exc}")

    llm_score: float | None = None
    if llm_out is not None:
        cat_llm = combine_category_scores(
            llm_out.skill_score,
            llm_out.experience_score,
            llm_out.education_score,
            job.scoring_weights,
        )
        if llm_out.overall_score is None:
            llm_score = cat_llm
        elif _is_custom_category_weights(job.scoring_weights):
            llm_score = round(0.5 * llm_out.overall_score + 0.5 * cat_llm, 1)
        else:
            llm_score = llm_out.overall_score

    weights = _weights(sem is not None, llm_score is not None, job.scoring_weights)
    cat_weights = _category_weights_dict(job.scoring_weights)
    overall = weights["rule"] * rule.rule_score
    if sem is not None:
        overall += weights["semantic"] * sem
    if llm_score is not None:
        overall += weights["llm"] * llm_score

    strengths, gaps, questions, template_explanation = _template_texts(job, rule)
    evidence = [EvidenceItem(**e.to_dict()) for e in rule.evidence]
    if llm_out is not None:
        skill_score = _avg(rule.skill_score, llm_out.skill_score)
        experience_score = _avg(rule.experience_score, llm_out.experience_score)
        education_score = _avg(rule.education_score, llm_out.education_score)
        strengths = llm_out.strengths or strengths
        gaps = llm_out.gaps or gaps
        questions = llm_out.interview_questions or questions
        explanation = llm_out.explanation
        # Keep deterministic evidence for JD skills; add LLM evidence for other requirements
        known = {e.requirement.lower() for e in evidence}
        evidence += [e for e in llm_out.evidence if e.requirement.lower() not in known]
        matched = rule.matched_skills or llm_out.matched_skills
        missing = rule.missing_skills or llm_out.missing_skills
        model_name = llm.model if llm else HEURISTIC
    else:
        skill_score, experience_score, education_score = rule.skill_score, rule.experience_score, rule.education_score
        explanation = template_explanation
        matched, missing = rule.matched_skills, rule.missing_skills
        model_name = HEURISTIC

    details = MatchDetails(
        strengths=strengths,
        gaps=gaps,
        interview_questions=questions,
        evidence=evidence,
        weights=weights,
        category_weights=cat_weights,
        sources={
            "rule": "rule_scorer",
            "semantic": embedding_model or "none",
            "llm": model_name if llm_out is not None else "none",
        },
    )
    return AggregatedScore(
        overall_score=round(overall, 1),
        skill_score=skill_score,
        experience_score=experience_score,
        education_score=education_score,
        rule_score=rule.rule_score,
        semantic_score=sem,
        llm_score=llm_score,
        matched_skills=matched,
        missing_skills=missing,
        explanation=explanation,
        details=details,
        model_name=model_name,
        warnings=warnings,
    )
