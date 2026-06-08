"""
Attendance routes — check-in, check-out, listing, and summary.

WHY THIS EXISTS: Manages the core time-tracking feature. These endpoints handle
GPS-verified check-in/check-out with duplicate prevention and role-based filtering.

DUPLICATE CHECK-IN PREVENTION:
  Before allowing check-in, we query for an existing attendance record for
  today (get_today_attendance). If one exists, we return 409 Conflict.
  
  WHY application-level (not DB constraint): A unique constraint on (user_id, date)
  would require a functional index on func.date(check_in_time), which is
  database-specific and harder to manage. The application-level check is
  simpler and sufficient for preventing double check-ins.
  
  RACE CONDITION: If two simultaneous check-in requests arrive for the same
  user, both might pass the "no existing record" check before either writes.
  The second write will succeed, creating two records. Mitigation options:
    1. DB-level unique constraint on (user_id, date_trunc('day', check_in_time)).
    2. Pessimistic lock (SELECT FOR UPDATE) on today's attendance check.
  For an MVP, the last-write-wins behavior is acceptable — the user sees
  their latest check-in time, which is the more accurate one.

CHECK-OUT AUTHORIZATION:
  Can only check out if:
    1. A check-in record exists for today (404 if not).
    2. Check-out hasn't already been performed (409 if already checked out).
  
  This ensures the check-in → check-out workflow is followed. There's no
  "forgot to check in" recovery path — the employee must contact an admin.

AUTHORIZATION BOUNDARIES:
  - check-in and check-out: Self-service. user_id is always current_user.id.
    An employee cannot check in or out on behalf of another user.
  - GET / (list): Admins can see all users' attendances. Employees only see
    their own. This is enforced by overriding user_id to current_user.id for
    non-admin users.
  - GET /summary: Available to authenticated users. Shows aggregate counts
    (present/late/absent) for all active employees.

FUTURE ENHANCEMENTS:
  - Geofencing: Validate that check-in GPS coordinates are within a configured
    radius of the office location (see ABSENSI_CONSTANTS.RADIUS_LIMIT_METERS).
  - Selfie verification: Server-side validation that the selfie matches the
    employee's profile photo.
"""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.attendance import (
    AttendanceCheckOut,
    AttendanceCreate,
    AttendanceListResponse,
    AttendanceResponse,
    AttendanceSummaryResponse,
)
from app.models.user import User
from app.services import attendance_service

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.post("/check-in", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
async def check_in(
    request: AttendanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Records a check-in with GPS coordinates and optional selfie.
    
    Prevents duplicate check-ins for the same day. The status (present/late)
    is determined server-side based on the current time vs. late cutoff.
    
    Returns 409 Conflict if already checked in today.
    """
    existing = await attendance_service.get_today_attendance(db, current_user.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already checked in today",
        )
    return await attendance_service.check_in(db, current_user.id, request)


@router.post("/check-out", response_model=AttendanceResponse)
async def check_out(
    request: AttendanceCheckOut,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Records check-out for today's attendance.
    
    Returns 404 if no check-in found for today.
    Returns 409 if already checked out.
    """
    attendance = await attendance_service.get_today_attendance(db, current_user.id)
    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No check-in record found for today",
        )
    if attendance.check_out_time:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already checked out today",
        )
    return await attendance_service.check_out(db, current_user.id, request)


@router.get("/", response_model=AttendanceListResponse)
async def list_attendances(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    user_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lists attendance records with optional date range and user filters.
    
    Authorization: Admins see all; employees only see their own records.
    The user_id query parameter is ignored for non-admin users.
    """
    if current_user.role != "admin":
        user_id = current_user.id
    return await attendance_service.get_attendances(
        db, user_id=user_id, start_date=start_date, end_date=end_date
    )


@router.get("/summary", response_model=AttendanceSummaryResponse)
async def attendance_summary(
    query_date: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns daily attendance summary (present, late, absent counts).
    
    Absent is calculated as total_active_employees - present - late.
    Available to all authenticated users (both admin and employee roles).
    """
    return await attendance_service.get_attendance_summary(
        db, target_date=query_date
    )
