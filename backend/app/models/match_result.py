"""
MatchResult model — AI-generated score when a CV is matched against a JD.
Owner: Person A  (Person C writes to this from AI engine)
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MatchResult(Base):
    __tablename__ = "match_results"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    cv_id: Mapped[int] = mapped_column(ForeignKey("cvs.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)

    overall_score: Mapped[float] = mapped_column(Float, nullable=False)                # 0.0 – 100.0
    skill_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    experience_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    education_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)               # LLM reasoning
    matched_skills: Mapped[str | None] = mapped_column(Text, nullable=True)            # JSON list
    missing_skills: Mapped[str | None] = mapped_column(Text, nullable=True)            # JSON list

    model_name: Mapped[str | None] = mapped_column(String(100), nullable=True)         # e.g. "gpt-4o"
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)

    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)                   # Rank within this job

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # ── Relationships ───────────────────────────────────────
    cv = relationship("CV", back_populates="match_results")
    job = relationship("Job", back_populates="match_results")
    decision = relationship("Decision", back_populates="match_result", uselist=False, lazy="selectin")

    def __repr__(self) -> str:
        return f"<MatchResult cv={self.cv_id} job={self.job_id} score={self.overall_score}>"
