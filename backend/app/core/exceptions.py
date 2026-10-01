"""
Shared exception hierarchy for the entire application.
Owner: Person A

Usage:
    from app.core.exceptions import NotFoundError, PermissionDeniedError

    raise NotFoundError("CV", cv_id)
"""

from typing import Any


# ── Base ────────────────────────────────────────────────────
class AppError(Exception):
    """Root exception for all application-level errors."""

    status_code: int = 500
    detail: str = "Internal server error"

    def __init__(self, detail: str | None = None, **kwargs: Any) -> None:
        self.detail = detail or self.__class__.detail
        self.extra = kwargs
        super().__init__(self.detail)


# ── 400 Bad Request ─────────────────────────────────────────
class BadRequestError(AppError):
    status_code = 400
    detail = "Bad request"


class ValidationError(BadRequestError):
    detail = "Validation error"


# ── 401 Unauthorized ────────────────────────────────────────
class UnauthorizedError(AppError):
    status_code = 401
    detail = "Not authenticated"


class InvalidCredentialsError(UnauthorizedError):
    detail = "Invalid email or password"


class TokenExpiredError(UnauthorizedError):
    detail = "Token has expired"


class InvalidTokenError(UnauthorizedError):
    detail = "Invalid token"


# ── 403 Forbidden ───────────────────────────────────────────
class PermissionDeniedError(AppError):
    status_code = 403
    detail = "Permission denied"


# ── 404 Not Found ───────────────────────────────────────────
class NotFoundError(AppError):
    status_code = 404
    detail = "Resource not found"

    def __init__(self, resource: str = "Resource", resource_id: Any = None) -> None:
        detail = f"{resource} not found"
        if resource_id is not None:
            detail = f"{resource} with id={resource_id} not found"
        super().__init__(detail=detail)


# ── 409 Conflict ────────────────────────────────────────────
class ConflictError(AppError):
    status_code = 409
    detail = "Resource already exists"


class DuplicateError(ConflictError):
    def __init__(self, field: str = "resource", value: Any = None) -> None:
        detail = f"{field} already exists"
        if value is not None:
            detail = f"{field} '{value}' already exists"
        super().__init__(detail=detail)


# ── 422 Unprocessable ──────────────────────────────────────
class FileProcessingError(AppError):
    status_code = 422
    detail = "File could not be processed"


class UnsupportedFileTypeError(FileProcessingError):
    def __init__(self, file_type: str = "unknown") -> None:
        super().__init__(detail=f"Unsupported file type: {file_type}. Allowed: pdf, docx")


# ── 503 Service Unavailable ────────────────────────────────
class ExternalServiceError(AppError):
    status_code = 503
    detail = "External service unavailable"


class AIServiceError(ExternalServiceError):
    detail = "AI service is currently unavailable"


class StorageServiceError(ExternalServiceError):
    detail = "Storage service is currently unavailable"
