"""
Auth endpoints — register, login, current user, change password.
Owner: Person A
"""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, get_optional_user
from app.models.audit_log import AuditAction
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RegisterRequest, TokenResponse, UserRead
from app.schemas.common import ApiResponse
from app.schemas.user import RegistrationStatus
from app.services import audit_service, auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=ApiResponse[UserRead], status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> ApiResponse[UserRead]:
    """Admin creates an account. The very first account (empty DB) needs no token and becomes admin.
    Self-registration is closed afterwards (403)."""
    user = await auth_service.register_user(db, payload, current_user)
    await audit_service.record(
        db, AuditAction.REGISTER, user_id=current_user.id if current_user else user.id,
        resource_type="user", resource_id=user.id, detail={"email": user.email, "role": user.role.value},
        request=request,
    )
    return ApiResponse(message="User registered.", data=UserRead.model_validate(user))


@router.get("/registration", response_model=ApiResponse[RegistrationStatus])
async def registration_status(db: AsyncSession = Depends(get_db)) -> ApiResponse[RegistrationStatus]:
    """Public sign-up is open only for initial setup, before the first (admin) account exists."""
    return ApiResponse(data=RegistrationStatus(open=await auth_service.count_users(db) == 0))


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


@router.put("/password", response_model=ApiResponse[None])
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[None]:
    await auth_service.change_password(db, current_user, payload.current_password, payload.new_password)
    await audit_service.record(
        db, AuditAction.PASSWORD_CHANGE, user=current_user, resource_type="user", resource_id=current_user.id,
        request=request,
    )
    return ApiResponse(message="Password updated.", data=None)
