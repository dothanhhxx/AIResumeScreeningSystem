"""
User management — administrators only.

    GET    /api/v1/users            list accounts with activity (?search=&role=&active=)
    PATCH  /api/v1/users/{id}       edit name/email, change role, lock/unlock, reset password
    DELETE /api/v1/users/{id}       delete an account that has no hiring activity

New accounts are created with POST /api/v1/auth/register (admin token required).
"""

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.audit_log import AuditAction
from app.models.user import User, UserRole
from app.schemas.common import ApiResponse
from app.schemas.user import ManagedUser, UserUpdate
from app.services import audit_service, user_service

router = APIRouter(prefix="/users", tags=["Users"])
_admin = require_roles(UserRole.ADMIN)


@router.get("", response_model=ApiResponse[list[ManagedUser]])
async def list_users(
    search: str | None = Query(default=None, max_length=100),
    role: UserRole | None = Query(default=None),
    active: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
) -> ApiResponse[list[ManagedUser]]:
    return ApiResponse(data=await user_service.list_users(db, search=search, role=role, active=active))


@router.patch("/{user_id}", response_model=ApiResponse[ManagedUser])
async def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(_admin),
) -> ApiResponse[ManagedUser]:
    user, changed = await user_service.update_user(db, actor, user_id, payload)
    if changed:
        await audit_service.record(
            db, AuditAction.USER_UPDATE, user=actor, resource_type="user", resource_id=user.id,
            detail={"email": user.email, "changed": changed, "role": user.role.value, "active": user.is_active},
            request=request,
        )
    return ApiResponse(message="User updated.", data=await user_service.get_managed_user(db, user.id))


@router.delete("/{user_id}", response_model=ApiResponse[None])
async def delete_user(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(_admin),
) -> ApiResponse[None]:
    email, full_name, role = await user_service.delete_user(db, actor, user_id)
    await audit_service.record(
        db, AuditAction.USER_DELETE, user=actor, resource_type="user", resource_id=user_id,
        detail={"email": email, "full_name": full_name, "role": role},
        request=request,
    )
    return ApiResponse(message="User deleted.", data=None)
