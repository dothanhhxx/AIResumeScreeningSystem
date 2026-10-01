"""
AuditLog model — immutable log of user actions for compliance.
Owner: Person A
"""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AuditAction(str, enum.Enum):
    """Trackable actions in the system."""
    # Auth
    LOGIN = "login"
    LOGOUT = "logout"
    REGISTER = "register"
    # CV
    CV_UPLOAD = "cv_upload"
    CV_DELETE = "cv_delete"
    CV_VIEW = "cv_view"
    # Job
    JOB_CREATE = "job_create"
    JOB_UPDATE = "job_update"
    JOB_DELETE = "job_delete"
    # Matching
    MATCH_RUN = "match_run"
    MATCH_VIEW = "match_view"
    # Decision
    DECISION_CREATE = "decision_create"
    DECISION_UPDATE = "decision_update"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction), nullable=False, index=True)
    resource_type: Mapped[str | None] = mapped_column(String(50), nullable=True)     # "cv", "job", etc.
    resource_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)                  # JSON extra info
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)        # IPv4/IPv6

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # ── Relationships ───────────────────────────────────────
    user = relationship("User", back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<AuditLog user={self.user_id} action={self.action.value}>"
