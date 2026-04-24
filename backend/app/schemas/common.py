from typing import Literal, Optional

from pydantic import BaseModel, Field


JobStatus = Literal["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]
RiskLevel = Literal["low", "medium", "high"]


class WarningItem(BaseModel):
    type: str
    message: str
    severity: Literal["critical", "warning", "info"] = "warning"


class BiasDetectionItem(BaseModel):
    id: str
    image_url: str
    label: str
    caption: str
    severity: Literal["high", "medium", "low"]
    confidence: float = Field(ge=0, le=1)


class ClassImbalanceItem(BaseModel):
    name: str
    value: int
    percentage: float


class SourceVariabilityItem(BaseModel):
    source: str
    count: int
    percentage: float


class JobResults(BaseModel):
    fairness_score: float = Field(ge=0, le=100)
    diversity_score: float = Field(ge=0, le=100)
    total_samples: int = Field(ge=0)
    analyzed_samples: int = Field(ge=0)
    class_imbalance: list[ClassImbalanceItem] = Field(default_factory=list)
    source_variability: list[SourceVariabilityItem] = Field(default_factory=list)
    bias_detections: list[BiasDetectionItem] = Field(default_factory=list)
    warnings: list[WarningItem] = Field(default_factory=list)
    bias_risk: Optional[RiskLevel] = None
