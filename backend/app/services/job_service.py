"""Business operations for recruiter-owned job descriptions."""

import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus
from app.schemas.common import PaginatedResponse
from app.schemas.job import JobCreate, JobRead, JobUpdate


def _encode_skills(skills: list[str] | None) -> str | None:
    if skills is None:
        return None
    return json.dumps(skills, ensure_ascii=False)


def create_job(db: Session, payload: JobCreate, created_by: int) -> JobRead:
    """Create a draft owned by the authenticated recruiter."""
    values = payload.model_dump()
    values["required_skills"] = _encode_skills(payload.required_skills)
    job = Job(**values, created_by=created_by, status=JobStatus.DRAFT)
    try:
        db.add(job)
        db.commit()
        db.refresh(job)
    except Exception:
        db.rollback()
        raise
    return JobRead.model_validate(job)


def list_jobs(
    db: Session,
    created_by: int,
    page: int,
    page_size: int,
    status: JobStatus | None = None,
) -> PaginatedResponse[JobRead]:
    """Return one recruiter's jobs in stable, newest-first order."""
    filters = [Job.created_by == created_by]
    if status is not None:
        filters.append(Job.status == status)

    total = db.scalar(select(func.count(Job.id)).where(*filters)) or 0
    statement = (
        select(Job)
        .where(*filters)
        .order_by(Job.created_at.desc(), Job.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    jobs = db.scalars(statement).all()
    items = [JobRead.model_validate(job) for job in jobs]
    return PaginatedResponse[JobRead].create(items, total, page, page_size)


def get_job(db: Session, job_id: int, created_by: int) -> JobRead | None:
    """Fetch a JD only when it belongs to the authenticated recruiter."""
    statement = select(Job).where(Job.id == job_id, Job.created_by == created_by)
    job = db.scalar(statement)
    return JobRead.model_validate(job) if job is not None else None


def update_job(
    db: Session,
    job_id: int,
    created_by: int,
    payload: JobUpdate,
) -> JobRead | None:
    """Apply only supplied fields to a recruiter-owned JD."""
    statement = select(Job).where(Job.id == job_id, Job.created_by == created_by)
    job = db.scalar(statement)
    if job is None:
        return None

    values = payload.model_dump(exclude_unset=True)
    if "required_skills" in values:
        values["required_skills"] = _encode_skills(values["required_skills"])
    for field_name, value in values.items():
        setattr(job, field_name, value)

    try:
        db.commit()
        db.refresh(job)
    except Exception:
        db.rollback()
        raise
    return JobRead.model_validate(job)


def archive_job(db: Session, job_id: int, created_by: int) -> JobRead | None:
    """Archive instead of deleting so historical match results remain linked."""
    statement = select(Job).where(Job.id == job_id, Job.created_by == created_by)
    job = db.scalar(statement)
    if job is None:
        return None
    job.status = JobStatus.ARCHIVED
    try:
        db.commit()
        db.refresh(job)
    except Exception:
        db.rollback()
        raise
    return JobRead.model_validate(job)
