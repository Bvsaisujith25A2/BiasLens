import asyncio
import contextlib
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.dependencies import get_job_service

settings = get_settings()
logger = logging.getLogger(__name__)


async def _retry_worker_loop() -> None:
    interval = max(5, settings.worker_retry_interval_seconds)

    while True:
        try:
            resumed = await get_job_service().retry_retriable_jobs(
                limit=settings.worker_retry_batch_size,
                processing_stale_after_seconds=settings.worker_processing_stale_after_seconds,
            )
            if resumed:
                logger.info("Resumed %s analysis job(s) by re-triggering worker", resumed)
        except Exception:
            logger.exception("Worker retry loop iteration failed")

        await asyncio.sleep(interval)

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
)


@app.on_event("startup")
async def startup_retry_loop() -> None:
    if not settings.worker_retry_loop_enabled:
        return

    app.state.worker_retry_task = asyncio.create_task(_retry_worker_loop())
    logger.info("Worker retry loop started (interval=%ss)", max(5, settings.worker_retry_interval_seconds))


@app.on_event("shutdown")
async def shutdown_retry_loop() -> None:
    task = getattr(app.state, "worker_retry_task", None)
    if task is None:
        return

    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "BiasLens orchestration API running"}


app.include_router(api_router, prefix=settings.api_v1_prefix)
