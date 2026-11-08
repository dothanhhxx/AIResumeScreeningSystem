"""Job description endpoints."""

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_roles
from app.models.audit_log import AuditAction
from app.models.job import JobStatus
from app.models.user import User, UserRole
from app.schemas.common import ApiResponse, PaginatedResponse
from app.schemas.job import JobCreate, JobExtractionRead, JobRead, JobUpdate
from app.services import audit_service, jd_extractor, job_service

router = APIRouter(prefix="/jobs", tags=["Jobs"])

JobListResponse = ApiResponse[PaginatedResponse[JobRead]]
JobResponse = ApiResponse[JobRead]
JobExtractionResponse = ApiResponse[JobExtractionRead]
_writer = require_roles(UserRole.ADMIN, UserRole.RECRUITER)


@router.post("/extract-file", response_model=JobExtractionResponse, status_code=status.HTTP_200_OK)
async def extract_job_from_file(
    file: UploadFile = File(..., description="Job description file (PDF or DOCX, max 10 MB)"),
    current_user: User = Depends(_writer),
) -> JobExtractionResponse:
    """Parse an uploaded PDF/DOCX JD file and return extracted draft fields without saving."""
    extracted = await jd_extractor.extract_job_from_file(file)
    return JobExtractionResponse(
        message="Job description extracted from file. Review and edit before saving.",
        data=extracted,
    )


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_writer),
) -> JobResponse:
    job = await job_service.create_job(db, payload, created_by=current_user.id)
    await audit_service.record(
        db, AuditAction.JOB_CREATE, user=current_user, resource_type="job", resource_id=job.id,
        detail={"title": job.title}, request=request,
    )
    return JobResponse(message="Job created.", data=job)


@router.get("", response_model=JobListResponse)
async def list_jobs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: JobStatus | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobListResponse:
    result = await job_service.list_jobs(
        db,
        page=page,
        page_size=page_size,
        status=status_filter,
    )
    return JobListResponse(data=result)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobResponse:
    job = await job_service.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    return JobResponse(data=job)


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: int,
    payload: JobUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_writer),
) -> JobResponse:
    job = await job_service.update_job(db, job_id, current_user, payload)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    await audit_service.record(
        db, AuditAction.JOB_UPDATE, user=current_user, resource_type="job", resource_id=job.id,
        detail={"fields": sorted(payload.model_fields_set)}, request=request,
    )
    return JobResponse(message="Job updated.", data=job)


@router.delete("/{job_id}", response_model=JobResponse)
async def archive_job(
    job_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_writer),
) -> JobResponse:
    job = await job_service.archive_job(db, job_id, current_user)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    await audit_service.record(
        db, AuditAction.JOB_DELETE, user=current_user, resource_type="job", resource_id=job.id,
        detail={"archived": True}, request=request,
    )
    return JobResponse(message="Job archived.", data=job)
