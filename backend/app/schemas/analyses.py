from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.common import JobStatus


class AnalysisHistoryItem(BaseModel):
    id: str
    name: str
    dataset_name: str
    status: JobStatus
    fairness_score: Optional[float] = None
    diversity_score: Optional[float] = None
    total_samples: int = 0
    bias_warnings: int = 0
    created_at: datetime
    completed_at: Optional[datetime] = None


class AnalysisHistoryResponse(BaseModel):
    analyses: list[AnalysisHistoryItem]
    total: int
    page: int
    per_page: int
