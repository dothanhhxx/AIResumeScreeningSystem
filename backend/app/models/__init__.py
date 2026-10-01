"""
Models package — import all models here so Alembic can auto-detect them.

Usage:
    from app.models import User, CV, Job, MatchResult, Decision, AuditLog
"""

from app.models.audit_log import AuditAction, AuditLog
from app.models.cv import CV, CVStatus
from app.models.decision import Decision, DecisionStatus
from app.models.job import Job, JobStatus
from app.models.match_result import MatchResult
from app.models.user import User, UserRole

__all__ = [
    "User",
    "UserRole",
    "CV",
    "CVStatus",
    "Job",
    "JobStatus",
    "MatchResult",
    "Decision",
    "DecisionStatus",
    "AuditLog",
    "AuditAction",
]
