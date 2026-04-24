from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_name: str = "BiasLens Orchestration API"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"
    debug: bool = False

    cors_origins: str = "http://localhost:3000"

    aws_region: str = "us-east-1"
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_session_token: Optional[str] = None
    s3_bucket_name: Optional[str] = None
    s3_key_prefix: str = "datasets"
    presigned_expiry_seconds: int = 900

    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_service_role_key: Optional[str] = None

    colab_trigger_url: Optional[str] = None
    colab_shared_secret: Optional[str] = None
    colab_request_timeout_seconds: int = 20
    backend_public_url: Optional[str] = None
    worker_retry_loop_enabled: bool = True
    worker_retry_interval_seconds: int = 30
    worker_retry_batch_size: int = 25
    worker_processing_stale_after_seconds: int = 1200

    default_user_id: str = "demo-user"
    default_user_email: str = "demo@biaslens.ai"
    default_user_name: str = "BiasLens Demo User"
    default_user_role: str = "researcher"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
