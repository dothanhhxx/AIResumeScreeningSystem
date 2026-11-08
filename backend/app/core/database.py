"""
Async SQLAlchemy engine + session factory.

Usage:
    from app.core.database import get_session

    async def my_endpoint(session: AsyncSession = Depends(get_session)):
        ...

Celery workers call `asyncio.run()` once per task, so they must not reuse the
API's pooled engine (its connections are bound to another event loop). They use
`create_worker_session_factory()` instead, which opens an engine without a pool.
"""

from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import event, inspect, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import settings


def _engine_kwargs(url: str) -> dict[str, Any]:
    if url.startswith("sqlite"):
        # SQLite: one file shared by the API and background tasks
        return {"connect_args": {"check_same_thread": False, "timeout": 30}}
    return {"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20}


def _enable_sqlite_foreign_keys(engine: AsyncEngine) -> None:
    if not engine.url.drivername.startswith("sqlite"):
        return

    @event.listens_for(engine.sync_engine, "connect")
    def _set_pragma(dbapi_connection, _record) -> None:  # pragma: no cover - driver hook
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


# ── Engine ──────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    **_engine_kwargs(settings.DATABASE_URL),
)
_enable_sqlite_foreign_keys(engine)

# ── Session factory ─────────────────────────────────────────
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def create_worker_session_factory() -> async_sessionmaker[AsyncSession]:
    """Session factory for code running under a fresh event loop (Celery tasks)."""
    kwargs: dict[str, Any] = {"poolclass": NullPool}
    if settings.IS_SQLITE:
        kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30}
    worker_engine = create_async_engine(settings.DATABASE_URL, **kwargs)
    _enable_sqlite_foreign_keys(worker_engine)
    return async_sessionmaker(worker_engine, class_=AsyncSession, expire_on_commit=False)


# ── Base class for all ORM models ───────────────────────────
class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy models."""
    pass


async def create_all_tables() -> None:
    """Create every table from the ORM metadata (SQLite dev mode / tests)."""
    import app.models  # noqa: F401  — registers all models on Base.metadata

    def _sync_create_and_upgrade(sync_conn) -> None:
        Base.metadata.create_all(sync_conn)
        inspector = inspect(sync_conn)
        if "jobs" in inspector.get_table_names():
            cols = {c["name"] for c in inspector.get_columns("jobs")}
            if "scoring_weights" not in cols:
                sync_conn.execute(text("ALTER TABLE jobs ADD COLUMN scoring_weights TEXT"))

    async with engine.begin() as conn:
        await conn.run_sync(_sync_create_and_upgrade)


# ── Dependency ──────────────────────────────────────────────
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a DB session and auto-closes it."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
