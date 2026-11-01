"""Rule / semantic / aggregator tests — offline, no LLM calls. Owner: Person C"""

from app.core.exceptions import AIServiceError
from app.llm import BaseLLM
from app.schemas.matching import LLMScoreOutput
from app.services.extraction.schemas import CVExtraction, Education
from app.services.matching import JobProfile, aggregate_scores, score_rules
from app.services.matching.embeddings import HASHING_MODEL, cosine_similarity, hashing_embedding
from app.services.matching.semantic_scorer import semantic_score
from app.services.matching.skills import dedupe_skills, find_skills_in_text, normalize_skill

JOB = JobProfile(
    title="Backend Engineer",
    description="Build Python services",
    required_skills=["Python", "ReactJS", "Postgres", "Kubernetes"],
    experience_years=3,
    education_level="Bachelor's degree",
)
CV = CVExtraction(
    skills=["python", "React", "PostgreSQL"],
    years_of_experience=4,
    education=[Education(degree="Bachelor", field_of_study="Computer Science")],
)


def test_skill_aliases_normalise():
    assert normalize_skill("ReactJS") == normalize_skill("react.js") == "React"
    assert normalize_skill("postgres") == "PostgreSQL"
    assert dedupe_skills(["k8s", "Kubernetes", "Golang", "go"]) == ["Kubernetes", "Go"]


def test_find_skills_in_text_avoids_ambiguous_words():
    found = find_skills_in_text("I will go to the node meeting. Built APIs with FastAPI and C++ on AWS.")
    assert {"FastAPI", "C++", "AWS"} <= set(found)
    assert "Go" not in found and "Node.js" not in found


def test_rule_scorer_matches_aliases_and_reports_evidence():
    result = score_rules(JOB, CV, "Built REST APIs in Python 3 with Postgres.")
    assert result.matched_skills == ["Python", "React", "PostgreSQL"]
    assert result.missing_skills == ["Kubernetes"]
    assert result.skill_score == 75.0
    assert result.experience_score == 100.0
    assert result.education_score == 100.0
    evidence = {e.requirement: e for e in result.evidence}
    assert evidence["Python"].status == "found"
    assert evidence["Kubernetes"].status == "not_found"


def test_rule_scorer_penalises_missing_experience_and_degree():
    junior = CVExtraction(skills=["Python"], years_of_experience=1, education=[Education(degree="College")])
    result = score_rules(JOB, junior)
    assert result.experience_score < 40
    assert result.education_score == 60.0
    assert result.rule_score < 50


def test_semantic_score_is_higher_for_related_text():
    job_vec = hashing_embedding("Python backend engineer FastAPI PostgreSQL Docker")
    near = hashing_embedding("Backend developer using Python, FastAPI and PostgreSQL in Docker")
    far = hashing_embedding("Graphic designer Photoshop Illustrator branding")
    assert cosine_similarity(job_vec, near) > cosine_similarity(job_vec, far)
    assert semantic_score(near, job_vec, HASHING_MODEL) > semantic_score(far, job_vec, HASHING_MODEL)


class ScoringLLM(BaseLLM):
    def __init__(self, fail: bool = False) -> None:
        super().__init__(model="fake-llm", embedding_model="fake-embed", embedding_dim=3)
        self.fail = fail

    async def generate(self, prompt, schema):
        if self.fail:
            raise AIServiceError("quota exceeded")
        assert schema is LLMScoreOutput
        return LLMScoreOutput(
            skill_score=80, experience_score=90, education_score=100, overall_score=88,
            strengths=["Solid Python"], gaps=["No Kubernetes"], interview_questions=["Q1", "Q2", "Q3"],
            explanation="Good fit.",
        )

    async def embed(self, text):
        return [1.0, 0.0, 0.0]


async def test_aggregator_combines_engines_with_weights():
    vec = hashing_embedding("python backend")
    result = await aggregate_scores(
        JOB, CV, "Python", llm=ScoringLLM(), cv_vector=vec, job_vector=vec, embedding_model=HASHING_MODEL
    )
    assert result.llm_score == 88 and result.semantic_score == 100.0
    assert set(result.details.weights) == {"rule", "semantic", "llm"}
    assert abs(sum(result.details.weights.values()) - 1) < 0.01
    assert result.model_name == "fake-llm"
    assert result.details.strengths == ["Solid Python"]
    assert result.explanation == "Good fit."


async def test_aggregator_falls_back_when_llm_fails():
    result = await aggregate_scores(JOB, CV, "Python", llm=ScoringLLM(fail=True))
    assert result.llm_score is None
    assert result.model_name == "heuristic"
    assert result.details.weights == {"rule": 1.0}
    assert result.overall_score == result.rule_score
    assert result.warnings and result.details.interview_questions
