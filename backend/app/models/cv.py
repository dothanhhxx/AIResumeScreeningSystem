"""
CV (Resume) model — stores uploaded resume metadata.
Owner: Person A  (Person B uses this for upload/parse pipeline)
"""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CVStatus(str, enum.Enum):
    """Lifecycle status of a CV."""
    UPLOADED = "uploaded"       # File received, not yet parsed
    PARSING = "parsing"         # Celery task running
    PARSED = "parsed"           # Text extracted successfully
    EXTRACTING = "extracting"   # AI extracting structured fields
    EXTRACTED = "extracted"     # Structured data ready
    SCORING = "scoring"         # AI scoring in progress
    SCORED = "scored"           # Final score assigned
    ERROR = "error"             # Processing failed


class CV(Base):
    __tablename__ = "cvs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    candidate_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    candidate_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_url: Mapped[str] = mapped_column(String(1000), nullable=False)          # MinIO path
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)               # bytes
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)            # pdf / docx

    status: Mapped[CVStatus] = mapped_column(Enum(CVStatus), default=CVStatus.UPLOADED, nullable=False, index=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)             # Parsed plaintext
    structured_data: Mapped[str | None] = mapped_column(Text, nullable=True)      # JSON blob from AI

    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # ── Relationships ───────────────────────────────────────
    match_results = relationship("MatchResult", back_populates="cv", lazy="selectin")

    def __repr__(self) -> str:
        return f"<CV {self.candidate_name} status={self.status.value}>"
