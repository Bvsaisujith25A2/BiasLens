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

        await self._attempt_trigger(record)

        return self.repo.get_job(job_id)

    def _build_trigger_payload(self, record: dict[str, Any]) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "job_id": record["id"],
            "s3_object_uri": record["s3_object_uri"],
            "dataset_name": record.get("dataset_name"),
            "analysis_options": record.get("analysis_options") or {},
        }
        if self.backend_public_url:
            payload["callback_url"] = f"{self.backend_public_url}/api/v1/webhooks/colab/job-status"
        return payload

    async def _attempt_trigger(self, record: dict[str, Any]) -> bool:
        accepted = await self.colab_service.trigger_analysis(self._build_trigger_payload(record))

        if accepted:
            self.repo.update_job(
                record["id"],
                {
                    "status": "PROCESSING",
                    "progress": max(int(record.get("progress") or 0), 10),
                    "current_step": "Delegated to ML worker",
                    "error_message": None,
                    "updated_at": datetime.now(timezone.utc),
                },
            )
            return True

        # Keep the job resumable while worker is offline.
        self.repo.update_job(
            record["id"],
            {
                "status": "PENDING",
                "current_step": "Waiting for ML worker to come online",
                "updated_at": datetime.now(timezone.utc),
            },
        )
        return False

    async def retry_retriable_jobs(self, limit: int = 25, processing_stale_after_seconds: int = 300) -> int:
        retriable = self.repo.list_retriable_jobs(
            limit=limit,
            processing_stale_after_seconds=processing_stale_after_seconds,
        )

        resumed = 0
        for record in retriable:
            accepted = await self._attempt_trigger(record)
            if accepted:
                resumed += 1

        return resumed

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
