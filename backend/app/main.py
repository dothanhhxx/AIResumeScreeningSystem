"""
AI Resume Screening System — FastAPI application entry point.
Owner: Person A (thêm router)

Only Person A registers routers here. Every API router is mounted under /api/v1.
"""

from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth
from app.config import settings
from app.core.database import engine
from app.core.exceptions import AppError
from app.schemas.common import ApiErrorResponse, HealthResponse

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # startup
    yield
    # shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Exception handlers ──────────────────────────────────────
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Turn any AppError subclass into the shared ApiErrorResponse body."""
    body = ApiErrorResponse(message=exc.detail, detail=exc.__class__.__name__)
    headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
    return JSONResponse(status_code=exc.status_code, content=body.model_dump(), headers=headers)


# ── Routers ─────────────────────────────────────────────────
api_router = APIRouter(prefix=API_PREFIX)
api_router.include_router(auth.router)
# TODO(integration): app/api/jobs.py (Person D) is written against a sync `Session`,
# while get_db yields an AsyncSession — mount it once it is ported to async:
#   from app.api import jobs; api_router.include_router(jobs.router)
app.include_router(api_router)


# ── Health check ────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    return HealthResponse(
        status="ok",
        version="0.1.0",
        environment=settings.APP_ENV,
    )
