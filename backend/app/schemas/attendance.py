"""
Pydantic schemas for attendance API request/response models.

WHY THESE EXIST: Define the contract between backend and frontend for attendance
data. Pydantic models provide automatic validation, serialization, and OpenAPI
schema generation.

FIELD DESIGN CHOICES:
  - lat/lng are plain floats (not Decimal): GPS coordinates from the browser's
    Geolocation API are Float64. Using Decimal would require unnecessary conversion
    and provide no practical benefit at building-level GPS precision.
  - selfie_url is Optional[str] (not required): Selfie verification is encouraged
    but not mandatory for check-in. Some employees may prefer to skip this step.
  - Response schemas use `model_config = {"from_attributes": True}`: This tells
    Pydantic to read attributes from ORM model objects directly, avoiding the
    need for manual mapping in every service function.
  - user_name is Optional[str] in AttendanceResponse: Not stored in the attendances
    table. It's populated at query time by joining with the users table (see
    attendance_service.get_attendances). It's Optional because the join could
    theoretically fail (orphaned record).

WHY separate Create and Response schemas:
  Separation of concerns. Create schemas define what the client can send;
  Response schemas define what the server returns. They often diverge:
  - Create schemas omit server-generated fields (id, status, created_at).
  - Response schemas include computed fields (user_name).
"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AttendanceCreate(BaseModel):
    """Request body for check-in. Requires GPS coordinates."""
    lat: float
    lng: float
    # Optional Cloudinary URL of the employee's selfie.
    # If not provided, check-in still proceeds without photo verification.
    selfie_url: Optional[str] = None


class AttendanceCheckOut(BaseModel):
    """Request body for check-out. Requires GPS coordinates of check-out location."""
    lat: float
    lng: float


class AttendanceResponse(BaseModel):
    """
    Full attendance record returned to the client.
    
    model_config = {"from_attributes": True} enables ORM mode — Pydantic reads
    attribute names directly from SQLAlchemy model instances.
    
    user_name is populated at query time from the user relationship. It's Optional
    because the relationship might be None in edge cases (e.g., user deleted).
    """
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
    """
    Paginated attendance list wrapper.
    
    total allows the frontend to show "Showing X of Y records".
    In the future, this will support actual pagination (skip/limit).
    """
    attendances: list[AttendanceResponse]
    total: int


class AttendanceSummaryResponse(BaseModel):
    """
    Daily attendance summary for the admin dashboard.
    
    absent is computed as total_employees - present - late.
    All fields are counts, not percentages — frontend calculates percentages.
    """
    date: date
    total_employees: int
    present: int
    late: int
    absent: int
