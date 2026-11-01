"""
Semantic scorer — cosine similarity between CV and JD embeddings.
Owner: Person C

Embeddings live as JSON on cvs.embedding / jobs.embedding (portable across
Postgres and SQLite; at this project's scale a Python cosine is fast enough, so
pgvector is not required). Raw cosine is mapped to 0-100 with a per-model
calibration because different embedding models have different similarity ranges.
"""

from app.services.extraction.schemas import CVExtraction
from app.services.matching.embeddings import HASHING_MODEL, cosine_similarity
from app.services.matching.rule_scorer import JobProfile

# (cosine treated as 0, cosine treated as 100)
_CALIBRATION: dict[str, tuple[float, float]] = {
    HASHING_MODEL: (0.02, 0.45),
}
_DEFAULT_CALIBRATION = (0.45, 0.85)  # Gemini / modern dense embeddings


def cv_profile_text(cv: CVExtraction) -> str:
    """PII-free text representation of a CV used for embedding."""
    lines: list[str] = []
    if cv.summary:
        lines.append(cv.summary)
    if cv.skills:
        lines.append("Skills: " + ", ".join(cv.skills))
    for exp in cv.experiences:
        lines.append(" ".join(filter(None, [exp.title, exp.company, exp.description])))
    for edu in cv.education:
        lines.append(" ".join(filter(None, [edu.degree, edu.field_of_study, edu.institution])))
    if cv.certifications:
        lines.append("Certifications: " + ", ".join(cv.certifications))
    return "\n".join(lines)


def job_profile_text(job: JobProfile) -> str:
    return job.full_text


def semantic_score(cv_vector: list[float], job_vector: list[float], model: str) -> float:
    low, high = _CALIBRATION.get(model, _DEFAULT_CALIBRATION)
    cosine = cosine_similarity(cv_vector, job_vector)
    scaled = (cosine - low) / (high - low) * 100
    return round(max(0.0, min(100.0, scaled)), 1)
