"""
Decision model — recruiter's final decision on a match result.
Owner: Person A
"""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DecisionStatus(str, enum.Enum):
    """Human decision after reviewing AI score."""
    PENDING = "pending"
    SHORTLISTED = "shortlisted"
    INTERVIEW = "interview"
    REJECTED = "rejected"
    HIRED = "hired"


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    match_result_id: Mapped[int] = mapped_column(
        ForeignKey("match_results.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[DecisionStatus] = mapped_column(
        Enum(DecisionStatus), default=DecisionStatus.PENDING, nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # ── Relationships ───────────────────────────────────────
    match_result = relationship("MatchResult", back_populates="decision")

    def __repr__(self) -> str:
        return f"<Decision match={self.match_result_id} status={self.status.value}>"
