"""
Auth business logic — register, authenticate, issue tokens.
Owner: Person A
"""

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import DuplicateError, InvalidCredentialsError, PermissionDeniedError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.auth import RegisterRequest, TokenResponse, UserRead


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    return await session.scalar(select(User).where(User.email == email.strip().lower()))


async def get_user_by_id(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def count_users(session: AsyncSession) -> int:
    return await session.scalar(select(func.count(User.id))) or 0


async def register_user(
    session: AsyncSession,
    payload: RegisterRequest,
    current_user: User | None,
) -> User:
    """
    Accounts are created by admins only. Bootstrap exception: when the users
    table is empty, the first registration is allowed and becomes ADMIN.
    """
    if await count_users(session) == 0:
        role = UserRole.ADMIN
    elif current_user is None or current_user.role != UserRole.ADMIN:
        raise PermissionDeniedError("Only admins can create accounts")
    else:
        role = payload.role

    if await get_user_by_email(session, payload.email) is not None:
        raise DuplicateError("email", payload.email)

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=role,
        is_active=True,
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:
        # Concurrent register with the same email
        await session.rollback()
        raise DuplicateError("email", payload.email) from exc
    await session.refresh(user)
    return user


async def authenticate(session: AsyncSession, email: str, password: str) -> User:
    """Return the user for valid credentials; same error for unknown email / wrong password / inactive."""
    user = await get_user_by_email(session, email)
    if user is None or not verify_password(password, user.hashed_password) or not user.is_active:
        raise InvalidCredentialsError()
    return user


def issue_token(user: User) -> TokenResponse:
    token = create_access_token(subject=user.id, extra_claims={"role": user.role.value})
    return TokenResponse(
        access_token=token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserRead.model_validate(user),
    )
