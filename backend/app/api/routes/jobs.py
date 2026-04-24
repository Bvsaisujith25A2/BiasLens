from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import require_current_user
from app.dependencies import get_job_service, get_repository
from app.db.repository import AnalysisRepository
from app.schemas.jobs import CancelJobResponse, JobStartRequest, JobStartResponse, JobStatusResponse
from app.services.job_service import JobService

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/start", response_model=JobStartResponse)
async def start_job(
    payload: JobStartRequest,
    current_user: dict = Depends(require_current_user),
    job_service: JobService = Depends(get_job_service),
) -> JobStartResponse:
    record = await job_service.start_job(user_id=current_user["id"], request=payload)
    return JobStartResponse(
        job_id=record["id"],
        status=record["status"],
        created_at=record["created_at"],
        estimated_duration_seconds=900,
    )


@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job_status(
    job_id: str,
    current_user: dict = Depends(require_current_user),
    repo: AnalysisRepository = Depends(get_repository),
) -> JobStatusResponse:
    record = repo.get_job(job_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if record.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    return JobStatusResponse(
        job_id=record["id"],
        status=record["status"],
        progress=record.get("progress"),
        current_step=record.get("current_step"),
        created_at=record.get("created_at") or datetime.utcnow(),
        updated_at=record.get("updated_at") or datetime.utcnow(),
        completed_at=record.get("completed_at"),
        error_message=record.get("error_message"),
        results=record.get("results"),
    )


@router.post("/{job_id}/cancel", response_model=CancelJobResponse)
def cancel_job(
    job_id: str,
    current_user: dict = Depends(require_current_user),
    repo: AnalysisRepository = Depends(get_repository),
) -> CancelJobResponse:
    record = repo.get_job(job_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if record.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    success = repo.cancel_job(job_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to cancel job")
    return CancelJobResponse(success=True)
