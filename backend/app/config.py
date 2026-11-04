"""
Application settings — powered by pydantic-settings.

Usage:
    from app.config import settings
    print(settings.DATABASE_URL)
"""

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator

# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8-sig",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ─────────────────────────────────────────────────
    APP_NAME: str = "AI Resume Screening System"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # ── Database ────────────────────────────────────────────
    POSTGRES_USER: str = "resume_user"
    POSTGRES_PASSWORD: str = "resume_pass"
    POSTGRES_DB: str = "resume_screening"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432

    # Optional full override, e.g. "sqlite+aiosqlite:///./dev.db" for running without Docker.
    # When empty the URL is built from the POSTGRES_* values above.
    DATABASE_URL_OVERRIDE: str = Field(default="", validation_alias="DATABASE_URL")

    @property
    def DATABASE_URL(self) -> str:
        if self.DATABASE_URL_OVERRIDE:
            return self.DATABASE_URL_OVERRIDE
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Sync URL for Alembic migrations."""
        if self.DATABASE_URL_OVERRIDE:
            return self.DATABASE_URL_OVERRIDE.replace("+asyncpg", "+psycopg").replace("+aiosqlite", "")
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def IS_SQLITE(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    # Create tables on startup (handy for SQLite / tests). Postgres deployments use Alembic.
    AUTO_CREATE_TABLES: bool = False

    # ── Redis ───────────────────────────────────────────────
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    # ── MinIO ───────────────────────────────────────────────
    MINIO_ROOT_USER: str = "minioadmin"
    MINIO_ROOT_PASSWORD: str = "minioadmin"
    MINIO_HOST: str = "localhost"
    MINIO_PORT: int = 9000
    MINIO_BUCKET_NAME: str = "resumes"

    # "minio" (S3 compatible, used in Docker) or "local" (files under LOCAL_STORAGE_DIR)
    STORAGE_BACKEND: str = "minio"
    LOCAL_STORAGE_DIR: str = "./storage"

    # ── Pipeline ────────────────────────────────────────────
    # "celery" → parse / extract / score run on Celery workers (needs Redis).
    # "inline" → the same steps run as background asyncio tasks inside the API process.
    PIPELINE_MODE: str = "celery"

    @property
    def MINIO_ENDPOINT(self) -> str:
        return f"{self.MINIO_HOST}:{self.MINIO_PORT}"

    # ── Auth / JWT ──────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # ── LLM / AI Engine (Person C) ──────────────────────────
    # "gemini" or "heuristic" (offline, no API key). Add a provider by subclassing BaseLLM
    # in app/llm/ and adding a branch in app/llm/factory.py.
    LLM_PROVIDER: str = "gemini"
    # Free key from https://aistudio.google.com/apikey — put it in .env, never commit it.
    GEMINI_API_KEY: str = ""
    # "gemini-flash-latest" is an alias that follows Google's current free-tier Flash model.
    GEMINI_MODEL: str = "gemini-flash-latest"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    # Embeddings are stored as JSON on cvs.embedding / jobs.embedding (see migration 0002).
    EMBEDDING_DIM: int = 768
    # When the LLM is unavailable (no key / quota / outage) fall back to the offline
    # heuristic extractor and scorer instead of marking the CV as ERROR.
    LLM_FALLBACK_TO_HEURISTIC: bool = True

    # ── Scoring weights (normalised at runtime) ─────────────
    SCORE_WEIGHT_RULE: float = 0.4
    SCORE_WEIGHT_SEMANTIC: float = 0.2
    SCORE_WEIGHT_LLM: float = 0.4

    # ── CORS ────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [origin.strip() for origin in v.split(",")]
        return v


@lru_cache
def get_settings() -> Settings:
    """Singleton factory — cached after first call."""
    return Settings()


settings = get_settings()
