"""
Password hashing (bcrypt) + JWT access tokens (python-jose).
Owner: Person A

Usage:
    from app.core.security import hash_password, verify_password, create_access_token

    hashed = hash_password("secret123")
    token = create_access_token(subject=user.id, extra_claims={"role": user.role.value})
    payload = decode_access_token(token)   # raises TokenExpiredError / InvalidTokenError
"""

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import ExpiredSignatureError, JWTError, jwt

from app.config import settings
from app.core.exceptions import InvalidTokenError, TokenExpiredError, ValidationError

# bcrypt only uses the first 72 bytes of a password — reject longer ones instead of silently truncating
BCRYPT_MAX_BYTES = 72


# ── Password hashing ────────────────────────────────────────
def hash_password(password: str) -> str:
    """Return a bcrypt hash (salt included) for storing in users.hashed_password."""
    raw = password.encode("utf-8")
    if len(raw) > BCRYPT_MAX_BYTES:
        raise ValidationError(f"Password must be at most {BCRYPT_MAX_BYTES} bytes")
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time check of a plain password against a stored bcrypt hash."""
    raw = plain_password.encode("utf-8")
    if len(raw) > BCRYPT_MAX_BYTES:
        return False
    try:
        return bcrypt.checkpw(raw, hashed_password.encode("utf-8"))
    except ValueError:
        # Malformed hash stored in DB
        return False


# ── JWT ─────────────────────────────────────────────────────
def create_access_token(
    subject: str | int,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Create a signed access token. `sub` holds the user id as a string."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload: dict[str, Any] = {
        **(extra_claims or {}),
        "sub": str(subject),
        "iat": now,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Verify signature + expiry and return the payload."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except ExpiredSignatureError as exc:
        raise TokenExpiredError() from exc
    except JWTError as exc:
        raise InvalidTokenError() from exc

    if payload.get("type") != "access" or not payload.get("sub"):
        raise InvalidTokenError()
    return payload
