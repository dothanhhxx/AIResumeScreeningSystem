"""
System info — read-only view of how the AI engine is configured.

    GET /api/v1/system/info

Shown on the Settings page so every role can see which engine produced scores.
Never returns secrets: only whether an API key is configured, not the key.
"""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.config import settings
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.matching.aggregator import ENGINE_VERSION

router = APIRouter(prefix="/system", tags=["System"])


class SystemInfo(BaseModel):
    app_version: str
    engine_version: str
    llm_provider: str
    llm_active: bool
    llm_model: str | None
    embedding_model: str | None
    fallback_to_heuristic: bool
    score_weights: dict[str, float]
    pipeline_mode: str
    storage_backend: str
    session_minutes: int


@router.get("/info", response_model=ApiResponse[SystemInfo])
async def system_info(request: Request, _: User = Depends(get_current_user)) -> ApiResponse[SystemInfo]:
    provider = settings.LLM_PROVIDER.lower()
    uses_gemini = provider == "gemini"
    return ApiResponse(
        data=SystemInfo(
            app_version=request.app.version,
            engine_version=ENGINE_VERSION,
            llm_provider=provider,
            llm_active=uses_gemini and bool(settings.GEMINI_API_KEY),
            llm_model=settings.GEMINI_MODEL if uses_gemini else None,
            embedding_model=settings.GEMINI_EMBEDDING_MODEL if uses_gemini else None,
            fallback_to_heuristic=settings.LLM_FALLBACK_TO_HEURISTIC,
            score_weights={
                "rule": settings.SCORE_WEIGHT_RULE,
                "semantic": settings.SCORE_WEIGHT_SEMANTIC,
                "llm": settings.SCORE_WEIGHT_LLM,
            },
            pipeline_mode=settings.PIPELINE_MODE,
            storage_backend=settings.STORAGE_BACKEND,
            session_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        )
    )
