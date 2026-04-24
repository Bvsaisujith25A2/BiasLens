from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import require_colab_secret
from app.dependencies import get_job_service
from app.schemas.jobs import ColabJobStatusWebhook
from app.services.job_service import JobService

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/colab/job-status", dependencies=[Depends(require_colab_secret)])
def colab_job_status_callback(
    payload: ColabJobStatusWebhook,
    job_service: JobService = Depends(get_job_service),
) -> dict[str, bool]:
    updated = job_service.apply_worker_update(payload)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return {"success": True}
