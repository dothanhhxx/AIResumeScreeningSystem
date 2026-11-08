"""Rule / semantic / aggregator tests — offline, no LLM calls. Owner: Person C"""

from app.core.exceptions import AIServiceError
from app.llm import BaseLLM
from app.schemas.job import ScoringWeights
from app.schemas.matching import LLMScoreOutput
from app.services.extraction.schemas import CVExtraction, Education
from app.services.matching import JobProfile, aggregate_scores, recalculate_with_weights, score_rules
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


def test_custom_scoring_weights_adjust_rule_and_overall_score():
    # Candidate has 75 skill_score, 100 experience_score, 100 education_score
    default_res = score_rules(JOB, CV, "Built REST APIs in Python 3 with Postgres.")
    assert default_res.rule_score == 85.0  # 0.6*75 + 0.25*100 + 0.15*100 = 85.0

    # Weight 100% on skills -> rule_score should be 75.0
    skill_heavy_job = JobProfile(
        title=JOB.title,
        description=JOB.description,
        required_skills=JOB.required_skills,
        experience_years=JOB.experience_years,
        education_level=JOB.education_level,
        scoring_weights=ScoringWeights(skill=100, experience=0, education=0),
    )
    skill_res = score_rules(skill_heavy_job, CV, "Built REST APIs in Python 3 with Postgres.")
    assert skill_res.rule_score == 75.0

    # Recalculate with experience-heavy weights (20% skill, 60% experience, 20% education)
    new_rule, new_overall, eng_w, cat_w = recalculate_with_weights(
        75.0,
        100.0,
        100.0,
        80.0,
        None,
        ScoringWeights(skill=20, experience=60, education=20, rule=70, semantic=30, llm=0),
    )
    assert new_rule == 95.0  # 0.2*75 + 0.6*100 + 0.2*100
    assert cat_w == {"skill": 0.2, "experience": 0.6, "education": 0.2}
    assert eng_w == {"rule": 0.7, "semantic": 0.3}
    assert new_overall == 90.5  # 0.7*95 + 0.3*80 = 66.5 + 24.0 = 90.5


def test_db_persistence_of_job_and_cv_scoring_weights(tmp_path):
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session

    from app.core.database import Base
    from app.models.cv import CV, CVStatus
    from app.models.job import Job, JobStatus
    from app.models.match_result import MatchResult
    from app.schemas.job import JobCreate, JobRead, parse_scoring_weights
    from app.schemas.matching import MatchDetails
    from app.services.matching_service import _apply_weights_to_result, job_profile, to_ranked

    db_file = tmp_path / "verify_weights.db"
    eng = create_engine(f"sqlite:///{db_file.as_posix()}")
    Base.metadata.create_all(eng)

    with Session(eng) as session:
        payload = JobCreate(
            title="AI Engineer Verification",
            department="R&D",
            location="Hanoi",
            description="Build LLM pipelines",
            required_skills=["Python", "PyTorch", "FastAPI", "Docker"],
            experience_years=4,
            education_level="Master's degree",
            scoring_weights=ScoringWeights(
                skill=70, experience=20, education=10, rule=50, semantic=20, llm=30
            ),
        )
        new_job = Job(
            title=payload.title,
            department=payload.department,
            location=payload.location,
            description=payload.description,
            required_skills='["Python", "PyTorch", "FastAPI", "Docker"]',
            experience_years=payload.experience_years,
            education_level=payload.education_level,
            scoring_weights=payload.scoring_weights.model_dump_json() if payload.scoring_weights else None,
            status=JobStatus.ACTIVE,
        )
        session.add(new_job)
        session.commit()
        session.refresh(new_job)

        saved_job = session.scalar(select(Job).where(Job.id == new_job.id))
        read_back = JobRead.model_validate(saved_job)
        assert read_back.scoring_weights.skill == 70.0
        assert read_back.scoring_weights.experience == 20.0
        assert read_back.scoring_weights.education == 10.0

        cv_ext = CVExtraction(
            skills=["Python", "PyTorch", "FastAPI"],
            years_of_experience=4,
            education=[Education(degree="Bachelor")],
        )
        prof = job_profile(saved_job)
        r_score = score_rules(prof, cv_ext, "Python PyTorch FastAPI")
        assert r_score.rule_score == 78.5

        dummy_cv = CV(
            candidate_name="Test Candidate",
            file_name="cv.pdf",
            file_url="local/cv.pdf",
            file_size=1024,
            file_type="pdf",
            status=CVStatus.SCORED,
            structured_data=cv_ext.model_dump_json(),
        )
        session.add(dummy_cv)
        session.commit()
        session.refresh(dummy_cv)

        mr = MatchResult(
            cv_id=dummy_cv.id,
            job_id=saved_job.id,
            overall_score=r_score.rule_score,
            skill_score=r_score.skill_score,
            experience_score=r_score.experience_score,
            education_score=r_score.education_score,
            rule_score=r_score.rule_score,
            semantic_score=80.0,
            llm_score=None,
            matched_skills='["Python", "PyTorch", "FastAPI"]',
            missing_skills='["Docker"]',
            details=MatchDetails(
                weights={"rule": 0.714, "semantic": 0.286},
                category_weights={"skill": 0.7, "experience": 0.2, "education": 0.1},
            ).model_dump_json(),
        )
        session.add(mr)
        session.commit()
        session.refresh(mr)

        # Apply per-CV custom weights and persist to DB
        cv_custom = ScoringWeights(skill=20, experience=70, education=10, rule=50, semantic=50, llm=0)
        _apply_weights_to_result(mr, cv_custom, is_custom_cv=True)
        session.commit()
        session.refresh(mr)

        ranked_custom = to_ranked(mr, dummy_cv)
        assert ranked_custom.rule_score == 91.0
        assert ranked_custom.overall_score == 85.5
        assert ranked_custom.details.custom_weights is not None
        assert ranked_custom.details.custom_weights.experience == 70.0

        # Reset CV back to JD weights and persist to DB
        _apply_weights_to_result(mr, parse_scoring_weights(saved_job.scoring_weights), is_custom_cv=False)
        session.commit()
        session.refresh(mr)

        ranked_reset = to_ranked(mr, dummy_cv)
        assert ranked_reset.rule_score == 78.5
        assert ranked_reset.details.custom_weights is None


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
