"""
Shared Pydantic schemas used across the entire application.
Owner: Person A

Contains:
  - Standard API response wrappers
  - Pagination schemas
  - Health-check response
  - Error response schema
"""

from datetime import datetime
from typing import Any, Generic, TypeVar

# pyrefly: ignore [missing-import]
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


# ── Base model with ORM mode ───────────────────────────────
class AppBaseModel(BaseModel):
    """Base model for all schemas — enables from_attributes (ORM mode)."""
    model_config = ConfigDict(from_attributes=True)


# ── Standard API response ──────────────────────────────────
class ApiResponse(BaseModel, Generic[T]):
    """Unified API response wrapper."""
    success: bool = True
    message: str = "OK"
    data: T | None = None


class ApiErrorResponse(BaseModel):
    """Error response body."""
    success: bool = False
    message: str
    detail: str | None = None
    errors: list[dict[str, Any]] | None = None


# ── Pagination ─────────────────────────────────────────────
class PaginationParams(BaseModel):
    """Query parameters for paginated endpoints."""
    page: int = Field(default=1, ge=1, description="Page number (1-based)")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response."""
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def create(cls, items: list[T], total: int, page: int, page_size: int) -> "PaginatedResponse[T]":
        total_pages = (total + page_size - 1) // page_size  # ceil division
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )


# ── ID reference ────────────────────────────────────────────
class IdResponse(BaseModel):
    """Returned when creating a resource."""
    id: int


# ── Timestamps mixin ───────────────────────────────────────
class TimestampMixin(BaseModel):
    """Mixin for created_at / updated_at fields."""
    created_at: datetime
    updated_at: datetime | None = None


# ── Health check ────────────────────────────────────────────
class HealthResponse(BaseModel):
    """GET /health response."""
    status: str = "ok"
    version: str = "0.1.0"
    environment: str = "development"
