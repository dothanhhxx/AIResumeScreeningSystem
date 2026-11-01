"""
Audit log API — admins only.
Owner: Person A

    GET /api/v1/audit?page=&page_size=&action=&user_id=&resource_type=
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.audit_log import AuditAction
from app.models.user import UserRole
from app.schemas.audit import AuditLogRead
from app.schemas.common import ApiResponse, PaginatedResponse
from app.services import audit_service

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get(
    "",
    response_model=ApiResponse[PaginatedResponse[AuditLogRead]],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def list_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    action: AuditAction | None = Query(default=None),
    user_id: int | None = Query(default=None),
    resource_type: str | None = Query(default=None, max_length=50),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[PaginatedResponse[AuditLogRead]]:
    logs = await audit_service.list_logs(
        db, page=page, page_size=page_size, action=action, user_id=user_id, resource_type=resource_type
    )
    return ApiResponse(data=logs)
