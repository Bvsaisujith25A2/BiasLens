from functools import lru_cache

from app.core.config import get_settings
from app.db.repository import AnalysisRepository
from app.services.colab_service import ColabService
from app.services.job_service import JobService
from app.services.s3_service import S3Service


@lru_cache
def get_repository() -> AnalysisRepository:
    return AnalysisRepository()


@lru_cache
def get_s3_service() -> S3Service:
    settings = get_settings()
    return S3Service(settings)


@lru_cache
def get_colab_service() -> ColabService:
    settings = get_settings()
    return ColabService(settings)


def get_job_service() -> JobService:
    settings = get_settings()
    return JobService(
        repo=get_repository(),
        colab_service=get_colab_service(),
        backend_public_url=settings.backend_public_url,
    )
