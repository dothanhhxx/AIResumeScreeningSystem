"""
Audit log schemas.
Owner: Person A
"""

from datetime import datetime
from typing import Any

from app.models.audit_log import AuditAction
from app.schemas.common import AppBaseModel


class AuditLogRead(AppBaseModel):
    id: int
    user_id: int | None
    user_email: str | None = None
    action: AuditAction
    resource_type: str | None
    resource_id: int | None
    detail: dict[str, Any] | str | None
    ip_address: str | None
    created_at: datetime
