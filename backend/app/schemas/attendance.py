from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AttendanceCreate(BaseModel):
    lat: float
    lng: float
    selfie_url: Optional[str] = None


class AttendanceCheckOut(BaseModel):
    lat: float
    lng: float


class AttendanceResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_name: Optional[str] = None
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    check_in_lat: float
    check_in_lng: float
    check_in_address: Optional[str] = None
    check_out_lat: Optional[float] = None
    check_out_lng: Optional[float] = None
    check_out_address: Optional[str] = None
    selfie_url: Optional[str] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AttendanceListResponse(BaseModel):
    attendances: list[AttendanceResponse]
    total: int


class AttendanceSummaryResponse(BaseModel):
    date: date
    total_employees: int
    present: int
    late: int
    absent: int
