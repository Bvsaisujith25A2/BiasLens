from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    role: Literal["admin", "researcher"]
    organization: Optional[str] = None
    created_at: datetime


class UpdateUserProfileRequest(BaseModel):
    name: Optional[str] = None
    organization: Optional[str] = None
