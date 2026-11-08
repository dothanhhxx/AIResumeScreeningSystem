"""Business operations for job descriptions.

Company-shared model: every signed-in user can read every JD. Only the
creator or an admin may edit or archive one.
"""

import json

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PermissionDeniedError
from app.models.job import Job, JobStatus
from app.models.user import User, UserRole
from app.schemas.common import PaginatedResponse
from app.schemas.job import JobCreate, JobRead, JobUpdate, ScoringWeights
from app.services.matching_service import recalculate_job_scores


def _encode_skills(skills: list[str] | None) -> str | None:
    if skills is None:
        return None
    return json.dumps(skills, ensure_ascii=False)


def _encode_weights(weights: ScoringWeights | None) -> str | None:
    if weights is None:
        return None
    return weights.model_dump_json()


async def create_job(
    db: AsyncSession,
    payload: JobCreate,
    created_by: int,
) -> JobRead:
    """Create a draft owned by the authenticated recruiter."""
    values = payload.model_dump()
    values["required_skills"] = _encode_skills(payload.required_skills)
    values["scoring_weights"] = _encode_weights(payload.scoring_weights)
    job = Job(**values, created_by=created_by, status=JobStatus.DRAFT)
    try:
        db.add(job)
        await db.commit()
        await db.refresh(job)
    except Exception:
        await db.rollback()
        raise
    return JobRead.model_validate(job)


def ensure_can_modify(job: Job, user: User) -> None:
    """Raise 403 unless *user* is an admin or created *job*."""
    if user.role != UserRole.ADMIN and job.created_by != user.id:
        raise PermissionDeniedError("Only the JD's creator or an admin can modify it")


async def list_jobs(
    db: AsyncSession,
    page: int,
    page_size: int,
    status: JobStatus | None = None,
) -> PaginatedResponse[JobRead]:
    """Return the company's jobs in stable, newest-first order."""
    filters = []
    if status is not None:
        filters.append(Job.status == status)

    total = await db.scalar(select(func.count(Job.id)).where(*filters)) or 0
    statement = (
        select(Job)
        .where(*filters)
        .order_by(Job.created_at.desc(), Job.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.scalars(statement)
    jobs = result.all()
    items = [JobRead.model_validate(job) for job in jobs]
    return PaginatedResponse[JobRead].create(items, total, page, page_size)


async def get_job(db: AsyncSession, job_id: int) -> JobRead | None:
    """Fetch any JD by id."""
    job = await db.get(Job, job_id)
    return JobRead.model_validate(job) if job is not None else None


async def update_job(
    db: AsyncSession,
    job_id: int,
    user: User,
    payload: JobUpdate,
) -> JobRead | None:
    """Apply only supplied fields to a JD the user may modify."""
    job = await db.get(Job, job_id)
    if job is None:
        return None
    ensure_can_modify(job, user)

    values = payload.model_dump(exclude_unset=True)
    if "required_skills" in values:
        values["required_skills"] = _encode_skills(values["required_skills"])
    weights_changed = "scoring_weights" in values
    if weights_changed:
        values["scoring_weights"] = _encode_weights(payload.scoring_weights)
    for field_name, value in values.items():
        setattr(job, field_name, value)
    if values.keys() & {"title", "description", "requirements", "required_skills"}:
        job.embedding = None  # recomputed by the next scoring run
    if weights_changed:
        await recalculate_job_scores(db, job, reset_cv_overrides=False)

    try:
        await db.commit()
        await db.refresh(job)
    except Exception:
        await db.rollback()
        raise
    return JobRead.model_validate(job)


async def archive_job(
    db: AsyncSession,
    job_id: int,
    user: User,
) -> JobRead | None:
    """Archive instead of deleting so historical match results remain linked."""
    job = await db.get(Job, job_id)
    if job is None:
        return None
    ensure_can_modify(job, user)
    job.status = JobStatus.ARCHIVED
    try:
        await db.commit()
        await db.refresh(job)
    except Exception:
        await db.rollback()
        raise
    return JobRead.model_validate(job)
