"""
Rule-based scorer — deterministic skill / experience / education fit.
Owner: Person C

Every score is 0-100. Also produces per-requirement *evidence*: for each JD
skill, the CV line that mentions it (or "not_found"), so recruiters can verify.
"""

import re
from dataclasses import dataclass, field

from app.schemas.job import ScoringWeights
from app.services.extraction.schemas import CVExtraction
from app.services.matching.skills import SKILL_ALIASES, dedupe_skills, find_skills_in_text, normalize_skill, skill_key

# Default sub-score weights inside the rule score (60% skill, 25% experience, 15% education)
W_SKILL, W_EXPERIENCE, W_EDUCATION = 0.6, 0.25, 0.15

EDUCATION_LEVELS: list[tuple[int, re.Pattern[str]]] = [
    (4, re.compile(r"ph\.?d|doctor|doctorate|tiến sĩ", re.IGNORECASE)),
    (3, re.compile(r"master|m\.?sc|mba|m\.?eng|thạc sĩ|postgraduate", re.IGNORECASE)),
    (2, re.compile(r"bachelor|b\.?sc|b\.?eng|university|đại học|cử nhân|kỹ sư|engineer|degree", re.IGNORECASE)),
    (1, re.compile(r"college|associate|cao đẳng|diploma|vocational|trung cấp", re.IGNORECASE)),
    (0, re.compile(r"high school|none|any|không yêu cầu|thpt", re.IGNORECASE)),
]


@dataclass
class JobProfile:
    """The parts of a Job the scorers need (decoupled from the ORM model)."""

    title: str
    description: str
    requirements: str | None = None
    required_skills: list[str] = field(default_factory=list)
    experience_years: int | None = None
    education_level: str | None = None
    scoring_weights: ScoringWeights = field(default_factory=ScoringWeights)

    @property
    def full_text(self) -> str:
        parts = [self.title, self.description, self.requirements or ""]
        if self.required_skills:
            parts.append("Skills: " + ", ".join(self.required_skills))
        return "\n".join(p for p in parts if p)

    def effective_skills(self) -> list[str]:
        """Explicit JD skills, else the known skills mentioned in the JD text."""
        if self.required_skills:
            return dedupe_skills(self.required_skills)
        return find_skills_in_text(f"{self.requirements or ''}\n{self.description}")[:15]


@dataclass
class Evidence:
    requirement: str
    category: str  # "skill" | "experience" | "education"
    status: str  # "found" | "unclear" | "not_found"
    quote: str | None = None

    def to_dict(self) -> dict[str, str | None]:
        return {"requirement": self.requirement, "category": self.category, "status": self.status, "quote": self.quote}


@dataclass
class RuleScore:
    skill_score: float | None
    experience_score: float | None
    education_score: float | None
    rule_score: float
    matched_skills: list[str]
    missing_skills: list[str]
    evidence: list[Evidence]
    candidate_years: float | None
    candidate_education_level: int | None


def education_level(text: str | None) -> int | None:
    if not text:
        return None
    for level, pattern in EDUCATION_LEVELS:
        if pattern.search(text):
            return level
    return None


def _aliases(skill: str) -> list[str]:
    canonical = normalize_skill(skill)
    return [canonical, *SKILL_ALIASES.get(canonical, [])]


def _find_quote(skill: str, lines: list[str]) -> str | None:
    patterns = [
        re.compile(rf"(?<![\w+#.]){re.escape(alias)}(?![\w+#])", re.IGNORECASE)
        for alias in _aliases(skill)
        if len(alias) > 1 or alias in ("C", "R")
    ]
    for line in lines:
        if any(p.search(line) for p in patterns):
            return line.strip()[:220]
    return None


def _skill_part(
    job_skills: list[str], cv: CVExtraction, cv_lines: list[str]
) -> tuple[float | None, list[str], list[str], list[Evidence]]:
    if not job_skills:
        return None, [], [], []

    cv_keys = {skill_key(s) for s in cv.skills}
    matched: list[str] = []
    missing: list[str] = []
    evidence: list[Evidence] = []
    for skill in job_skills:
        quote = _find_quote(skill, cv_lines)
        listed = skill_key(skill) in cv_keys
        if listed or quote:
            matched.append(skill)
            evidence.append(Evidence(skill, "skill", "found" if quote else "unclear", quote))
        else:
            missing.append(skill)
            evidence.append(Evidence(skill, "skill", "not_found", None))

    score = 100.0 * len(matched) / len(job_skills)
    return round(score, 1), matched, missing, evidence


def _experience_part(required: int | None, years: float | None) -> tuple[float | None, Evidence | None]:
    if not required:
        if years is None:
            return None, None
        return 100.0, None
    label = f"{required}+ years of experience"
    if years is None:
        return 30.0, Evidence(label, "experience", "unclear", "Total experience could not be determined from the CV.")
    ratio = years / required
    score = 100.0 if ratio >= 1 else max(0.0, 100.0 * ratio**1.2)
    status = "found" if ratio >= 1 else ("unclear" if ratio >= 0.5 else "not_found")
    return round(score, 1), Evidence(label, "experience", status, f"About {years:g} years of professional experience.")


def _education_part(required_text: str | None, cv: CVExtraction) -> tuple[float | None, int | None, Evidence | None]:
    cv_levels = [education_level(" ".join(filter(None, [e.degree, e.institution]))) for e in cv.education]
    cv_level = max((lvl for lvl in cv_levels if lvl is not None), default=None)
    required = education_level(required_text)
    if required is None or required == 0:
        return (None if required is None else 100.0), cv_level, None

    degree = next((e for e in cv.education if e.degree), None)
    quote = (
        " · ".join(filter(None, [degree.degree, degree.field_of_study, degree.institution])) if degree else None
    )
    if cv_level is None:
        return 40.0, cv_level, Evidence(required_text or "", "education", "unclear", quote)
    gap = required - cv_level
    score = 100.0 if gap <= 0 else (60.0 if gap == 1 else 25.0)
    status = "found" if gap <= 0 else ("unclear" if gap == 1 else "not_found")
    return score, cv_level, Evidence(required_text or "", "education", status, quote)


def combine_category_scores(
    skill_score: float | None,
    experience_score: float | None,
    education_score: float | None,
    weights: ScoringWeights | None = None,
) -> float:
    w = weights or ScoringWeights()
    parts = [
        (skill_score, w.skill / 100.0),
        (experience_score, w.experience / 100.0),
        (education_score, w.education / 100.0),
    ]
    available = [(s, weight) for s, weight in parts if s is not None and weight > 0]
    if available:
        total_weight = sum(weight for _, weight in available)
        return round(sum(s * weight for s, weight in available) / total_weight, 1)
    present = [s for s, _ in parts if s is not None]
    if present:
        return round(sum(present) / len(present), 1)
    return 50.0  # nothing to compare against — neutral


def score_rules(job: JobProfile, cv: CVExtraction, cv_text: str = "") -> RuleScore:
    cv_lines = [line for line in (cv_text or "").splitlines() if line.strip()]
    cv_lines += [s for s in cv.skills]
    cv_lines += [" ".join(filter(None, [e.title, e.company, e.description])) for e in cv.experiences]

    skill_score, matched, missing, evidence = _skill_part(job.effective_skills(), cv, cv_lines)
    experience_score, exp_evidence = _experience_part(job.experience_years, cv.years_of_experience)
    education_score, cv_level, edu_evidence = _education_part(job.education_level, cv)
    evidence += [e for e in (exp_evidence, edu_evidence) if e is not None]

    rule = combine_category_scores(skill_score, experience_score, education_score, job.scoring_weights)

    return RuleScore(
        skill_score=skill_score,
        experience_score=experience_score,
        education_score=education_score,
        rule_score=rule,
        matched_skills=matched,
        missing_skills=missing,
        evidence=evidence,
        candidate_years=cv.years_of_experience,
        candidate_education_level=cv_level,
    )
