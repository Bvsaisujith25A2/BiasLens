from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.db.repository import AnalysisRepository
from app.schemas.jobs import ColabJobStatusWebhook, JobStartRequest
from app.services.colab_service import ColabService


class JobService:
    def __init__(self, repo: AnalysisRepository, colab_service: ColabService, backend_public_url: str | None = None):
        self.repo = repo
        self.colab_service = colab_service
        self.backend_public_url = backend_public_url

    async def start_job(self, user_id: str, request: JobStartRequest) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        job_id = str(uuid4())
        record = {
            "id": job_id,
            "user_id": user_id,
            "name": f"Analysis {job_id[:8]}",
            "dataset_name": request.dataset_name or "Uploaded Dataset",
            "s3_object_uri": request.s3_object_uri,
            "status": "PENDING",
            "progress": 0,
            "current_step": "Queued for processing",
            "error_message": None,
            "results": None,
            "analysis_options": request.analysis_options.model_dump(),
            "created_at": now,
            "updated_at": now,
            "completed_at": None,
        }
        self.repo.create_job(record)

        trigger_payload: dict[str, Any] = {
            "job_id": job_id,
            "s3_object_uri": request.s3_object_uri,
            "dataset_name": request.dataset_name,
            "analysis_options": request.analysis_options.model_dump(),
        }
        if self.backend_public_url:
            trigger_payload["callback_url"] = f"{self.backend_public_url}/api/v1/webhooks/colab/job-status"

        accepted = await self.colab_service.trigger_analysis(trigger_payload)

        if accepted:
            self.repo.update_job(
                job_id,
                {
                    "status": "PROCESSING",
                    "progress": 10,
                    "current_step": "Delegated to ML worker",
                    "updated_at": datetime.now(timezone.utc),
                },
            )

        return self.repo.get_job(job_id)

    def apply_worker_update(self, webhook: ColabJobStatusWebhook) -> dict[str, Any] | None:
        patch: dict[str, Any] = {
            "status": webhook.status,
            "progress": webhook.progress,
            "current_step": webhook.current_step,
            "error_message": webhook.error_message,
            "updated_at": datetime.now(timezone.utc),
        }
        if webhook.results is not None:
            patch["results"] = webhook.results.model_dump()

        if webhook.status in ("COMPLETED", "FAILED", "CANCELLED"):
            patch["completed_at"] = datetime.now(timezone.utc)

        return self.repo.update_job(webhook.job_id, patch)
