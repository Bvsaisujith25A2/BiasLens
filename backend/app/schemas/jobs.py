from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import JobResults, JobStatus


class AnalysisOptions(BaseModel):
    check_class_imbalance: bool = True
    check_source_variability: bool = True
    detect_hidden_bias: bool = True


class JobStartRequest(BaseModel):
    s3_object_uri: str
    dataset_name: Optional[str] = None
    analysis_options: AnalysisOptions = Field(default_factory=AnalysisOptions)


class JobStartResponse(BaseModel):
    job_id: str
    status: JobStatus
    created_at: datetime
    estimated_duration_seconds: int = 900


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: Optional[int] = None
    current_step: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    results: Optional[JobResults] = None


class ColabJobStatusWebhook(BaseModel):
    job_id: str
    status: JobStatus
    progress: Optional[int] = None
    current_step: Optional[str] = None
    error_message: Optional[str] = None
    results: Optional[JobResults] = None


class CancelJobResponse(BaseModel):
    success: bool
