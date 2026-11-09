"""
AI Resume Screening System — FastAPI application entry point.
Owner: Person A (thêm router)

Only Person A registers routers here. Every API router is mounted under /api/v1.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import API_V1_PREFIX, api_router
from app.core.config import settings
from app.core.database import async_session_factory, create_all_tables, engine
from app.core.exceptions import AppError
from app.schemas.common import ApiErrorResponse, HealthResponse
from app.services import auth_service
from app.workers.dispatch import inline_runner

API_PREFIX = API_V1_PREFIX

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(levelname)s %(name)s: %(message)s",
)
for noisy in ("sqlalchemy.engine", "httpx", "botocore", "urllib3", "multipart", "aiosqlite", "watchfiles"):
    logging.getLogger(noisy).setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    if settings.AUTO_CREATE_TABLES or settings.IS_SQLITE:
        await create_all_tables()
    if settings.SEED_DEFAULT_USERS:
        try:
            async with async_session_factory() as session:
                await auth_service.seed_default_users(session)
            logger.info("Default accounts (admin@talentlens.ai, recruiter@talentlens.ai) verified.")
        except Exception as exc:
            logger.warning("Could not seed default users on startup: %s", exc)
    inline_runner.start()
    if settings.PIPELINE_MODE.lower() == "inline":
        logger.info("Pipeline mode: inline (background asyncio consumer)")
    else:
        logger.info("Pipeline mode: celery (with inline fallback ready)")
    yield
    await inline_runner.stop()
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
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


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Ensure unexpected 500 errors still go through CORSMiddleware with a clear JSON message."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    body = ApiErrorResponse(
        message=f"Server error: {exc}",
        detail=exc.__class__.__name__,
    )
    return JSONResponse(status_code=500, content=body.model_dump())


# ── Routers ─────────────────────────────────────────────────
app.include_router(api_router)


# ── Health check ────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    return HealthResponse(
        status="ok",
        version="1.0.0",
        environment=settings.APP_ENV,
    )
