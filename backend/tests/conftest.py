"""
Shared pytest fixtures.
Owner: Person A

The whole stack runs offline: SQLite file DB, local file storage, inline pipeline
and the heuristic AI engine — no Docker, Redis, MinIO or Gemini key needed.
Environment variables are set before `app` is imported so `settings` picks them up.
"""

import asyncio
import io
import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="resume-tests-"))
os.environ.update(
    {
        "DATABASE_URL": f"sqlite+aiosqlite:///{(_TMP / 'test.db').as_posix()}",
        "STORAGE_BACKEND": "local",
        "LOCAL_STORAGE_DIR": str(_TMP / "storage"),
        "PIPELINE_MODE": "inline",
        "LLM_PROVIDER": "heuristic",
        "GEMINI_API_KEY": "",
        "DEBUG": "false",
        "SEED_DEFAULT_USERS": "false",
    }
)

import httpx  # noqa: E402
import pytest  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.workers.dispatch import inline_runner  # noqa: E402

ADMIN = {"email": "admin@example.com", "password": "Admin12345", "full_name": "Admin User"}


@pytest.fixture
async def db_schema():
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture
async def client(db_schema):
    inline_runner.start()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        yield http
    await inline_runner.stop()


async def drain_pipeline() -> None:
    """Wait until queued inline tasks (and the tasks they enqueue) have finished."""
    for _ in range(200):
        await asyncio.sleep(0.02)
        queue = inline_runner._queue
        if queue is None:
            return
        if queue.empty() and getattr(queue, "_unfinished_tasks", 0) == 0:
            await asyncio.sleep(0.05)
            if queue.empty() and getattr(queue, "_unfinished_tasks", 0) == 0:
                return
        await inline_runner.join()
    raise AssertionError("pipeline did not finish")


@pytest.fixture
async def admin_headers(client) -> dict[str, str]:
    response = await client.post("/api/v1/auth/register", json=ADMIN)
    assert response.status_code == 201, response.text
    login = await client.post("/api/v1/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    token = login.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def make_docx(paragraphs: list[str]) -> bytes:
    import docx

    document = docx.Document()
    for text in paragraphs:
        document.add_paragraph(text)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

STRONG_CV = [
    "Nguyen Van Strong",
    "Email: strong@example.com | Phone: 0912345678",
    "Address: 12 Fake Street, Hanoi",
    "SUMMARY",
    "Backend engineer focused on Python APIs and data platforms.",
    "SKILLS",
    "Python, FastAPI, PostgreSQL, Docker, Redis, Celery, Git",
    "WORK EXPERIENCE",
    "Senior Backend Developer at Acme Corp | 01/2019 - present",
    "Built FastAPI microservices on PostgreSQL and Docker serving 2M requests per day.",
    "Backend Developer at Beta Soft | 06/2016 - 12/2018",
    "Developed Django REST APIs and Celery workers with Redis.",
    "EDUCATION",
    "Hanoi University of Science and Technology",
    "Bachelor of Computer Science, 2016",
]

WEAK_CV = [
    "Tran Thi Weak",
    "SUMMARY",
    "Graphic designer who enjoys branding work.",
    "SKILLS",
    "Photoshop, Figma, Illustrator",
    "WORK EXPERIENCE",
    "Junior Designer at Pixel Studio | 2023 - present",
    "Designed social media banners.",
    "EDUCATION",
    "Hanoi College of Arts, College diploma in Graphic Design, 2022",
]


async def upload(client, headers, name: str, paragraphs: list[str], filename: str | None = None):
    files = {"file": (filename or f"{name}.docx", make_docx(paragraphs), DOCX_MIME)}
    return await client.post("/api/v1/cvs/upload", data={"candidate_name": name}, files=files, headers=headers)
