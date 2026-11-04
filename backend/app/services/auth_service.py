"""
Auth business logic — register, authenticate, issue tokens.
Owner: Person A
"""

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import BadRequestError, DuplicateError, InvalidCredentialsError, PermissionDeniedError
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
    Create a new user account. Self-registration is closed:
    - When the users table is empty, the first registration becomes ADMIN (initial setup).
    - After that, only an authenticated admin can create accounts, and picks the role.
    """
    if await count_users(session) == 0:
        role = UserRole.ADMIN
    elif current_user is None or current_user.role != UserRole.ADMIN:
        raise PermissionDeniedError("Accounts are created by an administrator.")
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


async def change_password(session: AsyncSession, user: User, current_password: str, new_password: str) -> None:
    """
    Replace the signed-in user's password.

    A wrong current password is a 400, not a 401: the session itself is valid,
    and the frontend signs people out on 401.
    """
    if not verify_password(current_password, user.hashed_password):
        raise BadRequestError("Current password is incorrect.")
    if current_password == new_password:
        raise BadRequestError("Choose a password you have not used for this account.")
    user.hashed_password = hash_password(new_password)
    await session.commit()
