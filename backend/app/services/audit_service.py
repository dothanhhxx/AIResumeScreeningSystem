"""
Audit log service — append-only record of who did what.
Owner: Person A

Usage (inside an endpoint, before the request's session commits):
    await audit_service.record(db, AuditAction.JOB_CREATE, user=current_user,
                               resource_type="job", resource_id=job.id, request=request)

Recording never raises: an audit failure is logged instead of failing the user's action.
"""

import json
import logging
from typing import Any

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditAction, AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogRead
from app.schemas.common import PaginatedResponse

logger = logging.getLogger(__name__)


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45]
    return request.client.host[:45] if request.client else None


async def record(
    db: AsyncSession,
    action: AuditAction,
    *,
    user: User | None = None,
    user_id: int | None = None,
    resource_type: str | None = None,
    resource_id: int | None = None,
    detail: dict[str, Any] | None = None,
    request: Request | None = None,
    commit: bool = True,
) -> None:
    try:
        db.add(
            AuditLog(
                user_id=user.id if user is not None else user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                detail=json.dumps(detail, ensure_ascii=False, default=str) if detail else None,
                ip_address=_client_ip(request),
            )
        )
        if commit:
            await db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Failed to write audit log for %s", action)
        await db.rollback()


async def list_logs(
    db: AsyncSession,
    *,
    page: int,
    page_size: int,
    action: AuditAction | None = None,
    user_id: int | None = None,
    resource_type: str | None = None,
) -> PaginatedResponse[AuditLogRead]:
    filters = []
    if action is not None:
        filters.append(AuditLog.action == action)
    if user_id is not None:
        filters.append(AuditLog.user_id == user_id)
    if resource_type:
        filters.append(AuditLog.resource_type == resource_type)

    total = await db.scalar(select(func.count(AuditLog.id)).where(*filters)) or 0
    rows = (
        await db.execute(
            select(AuditLog, User.email)
            .outerjoin(User, User.id == AuditLog.user_id)
            .where(*filters)
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    items: list[AuditLogRead] = []
    for log, email in rows:
        detail: Any = log.detail
        if detail:
            try:
                detail = json.loads(detail)
            except json.JSONDecodeError:
                pass
        items.append(
            AuditLogRead(
                id=log.id,
                user_id=log.user_id,
                user_email=email,
                action=log.action,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                detail=detail,
                ip_address=log.ip_address,
                created_at=log.created_at,
            )
        )
    return PaginatedResponse[AuditLogRead].create(items, total, page, page_size)
