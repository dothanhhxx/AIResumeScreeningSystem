"""Admin user-management schemas."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import UserRole
from app.schemas.common import AppBaseModel


class ManagedUser(AppBaseModel):
    """A user as an administrator sees it: account fields plus hiring activity."""

    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None
    jobs_created: int = 0
    cvs_uploaded: int = 0
    decisions_made: int = 0

    @property
    def has_activity(self) -> bool:
        return bool(self.jobs_created or self.cvs_uploaded or self.decisions_made)


class UserUpdate(BaseModel):
    """PATCH /api/v1/users/{id}: only the fields that are sent change."""

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=72)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("full_name")
    @classmethod
    def strip_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("full_name must not be blank")
        return cleaned


class RegistrationStatus(BaseModel):
    """Whether the public sign-up form is open (only before the first account exists)."""

    open: bool
