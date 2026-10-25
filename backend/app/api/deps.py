"""
Shared FastAPI dependencies.
Owner: Person A

Usage:
    from app.api.deps import get_db, get_current_user, require_roles

    @router.get("/items")
    async def list_items(
        db: AsyncSession = Depends(get_db),
        user: User = Depends(get_current_user),
    ): ...

    @router.delete("/items/{id}", dependencies=[Depends(require_roles(UserRole.ADMIN))])
    async def delete_item(...): ...
"""

from collections.abc import AsyncGenerator, Callable, Coroutine
from typing import Any

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.exceptions import InvalidTokenError, PermissionDeniedError, UnauthorizedError
from app.core.security import decode_access_token
from app.models.user import User, UserRole
from app.services import auth_service

# auto_error=False → we raise our own UnauthorizedError (consistent JSON error body)
bearer_scheme = HTTPBearer(auto_error=False)


# ── DB session ──────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Async DB session; commits on success, rolls back on error."""
    async for session in get_session():
        yield session


# ── Current user ────────────────────────────────────────────
async def _user_from_credentials(
    credentials: HTTPAuthorizationCredentials | None,
    db: AsyncSession,
) -> User | None:
    if credentials is None:
        return None
    payload = decode_access_token(credentials.credentials)
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise InvalidTokenError() from exc

    user = await auth_service.get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise InvalidTokenError("User not found or inactive")
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Require a valid `Authorization: Bearer <token>` header."""
    user = await _user_from_credentials(credentials, db)
    if user is None:
        raise UnauthorizedError()
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Like get_current_user but returns None when no token is sent."""
    return await _user_from_credentials(credentials, db)


# Short alias used by other modules (e.g. app/api/jobs.py)
get_user = get_current_user


# ── Role-based access ───────────────────────────────────────
def require_roles(*roles: UserRole) -> Callable[..., Coroutine[Any, Any, User]]:
    """Dependency factory: allow only users whose role is in `roles`."""

    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise PermissionDeniedError()
        return user

    return checker
