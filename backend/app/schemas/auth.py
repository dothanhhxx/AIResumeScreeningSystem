"""
Auth request / response schemas.
Owner: Person A
"""

from datetime import datetime

# pyrefly: ignore [missing-import]
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import UserRole
from app.schemas.common import AppBaseModel


def _normalize_email(value: object) -> object:
    return value.strip().lower() if isinstance(value, str) else value


# ── Requests ────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    """POST /api/v1/auth/register body."""
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=255)
    role: UserRole = UserRole.RECRUITER

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: object) -> object:
        return _normalize_email(v)

    @field_validator("full_name")
    @classmethod
    def strip_full_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("full_name must not be blank")
        return cleaned


class LoginRequest(BaseModel):
    """POST /api/v1/auth/login body."""
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: object) -> object:
        return _normalize_email(v)


# ── Responses ───────────────────────────────────────────────
class UserRead(AppBaseModel):
    """Public user info — never exposes hashed_password."""
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    """Returned on successful login."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Token lifetime in seconds")
    user: UserRead
