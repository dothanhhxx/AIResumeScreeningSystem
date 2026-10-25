"""Job description endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_user
from app.models.job import JobStatus
from app.models.user import User
from app.schemas.common import ApiResponse, PaginatedResponse
from app.schemas.job import JobCreate, JobRead, JobUpdate
from app.services import job_service

router = APIRouter(prefix="/jobs", tags=["Jobs"])

JobListResponse = ApiResponse[PaginatedResponse[JobRead]]
JobResponse = ApiResponse[JobRead]


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_user),
) -> JobResponse:
    job = job_service.create_job(db, payload, created_by=current_user.id)
    return JobResponse(message="Job created.", data=job)


@router.get("", response_model=JobListResponse)
def list_jobs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: JobStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_user),
) -> JobListResponse:
    result = job_service.list_jobs(
        db,
        created_by=current_user.id,
        page=page,
        page_size=page_size,
        status=status_filter,
    )
    return JobListResponse(data=result)


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_user),
) -> JobResponse:
    job = job_service.get_job(db, job_id, created_by=current_user.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    return JobResponse(data=job)


@router.patch("/{job_id}", response_model=JobResponse)
def update_job(
    job_id: int,
    payload: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_user),
) -> JobResponse:
    job = job_service.update_job(db, job_id, current_user.id, payload)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    return JobResponse(message="Job updated.", data=job)


@router.delete("/{job_id}", response_model=JobResponse)
def archive_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_user),
) -> JobResponse:
    job = job_service.archive_job(db, job_id, created_by=current_user.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    return JobResponse(message="Job archived.", data=job)
