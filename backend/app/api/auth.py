"""
Auth endpoints — register, login, current user.
Owner: Person A
"""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, get_optional_user
from app.models.audit_log import AuditAction
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserRead
from app.schemas.common import ApiResponse
from app.services import audit_service, auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=ApiResponse[UserRead], status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> ApiResponse[UserRead]:
    """Admin creates an account. The very first account (empty DB) needs no token and becomes admin."""
    user = await auth_service.register_user(db, payload, current_user)
    await audit_service.record(
        db, AuditAction.REGISTER, user_id=current_user.id if current_user else user.id,
        resource_type="user", resource_id=user.id, detail={"email": user.email, "role": user.role.value},
        request=request,
    )
    return ApiResponse(message="User registered.", data=UserRead.model_validate(user))


@router.post("/login", response_model=ApiResponse[TokenResponse])
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[TokenResponse]:
    user = await auth_service.authenticate(db, payload.email, payload.password)
    await audit_service.record(db, AuditAction.LOGIN, user=user, resource_type="user", resource_id=user.id,
                               request=request)
    return ApiResponse(message="Login successful.", data=auth_service.issue_token(user))


@router.get("/me", response_model=ApiResponse[UserRead])
async def me(current_user: User = Depends(get_current_user)) -> ApiResponse[UserRead]:
    return ApiResponse(data=UserRead.model_validate(current_user))
