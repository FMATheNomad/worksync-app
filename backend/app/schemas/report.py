from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ReportCreate(BaseModel):
    content: str
    status: Optional[str] = "draft"
    date: Optional[date] = None
    is_ai_generated: Optional[bool] = False


class ReportUpdate(BaseModel):
    content: Optional[str] = None
    status: Optional[str] = None


class ReportResponse(BaseModel):
    id: UUID
    user_id: UUID
    content: str
    status: str
    date: date
    is_ai_generated: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReportListResponse(BaseModel):
    reports: list[ReportResponse]
    total: int
