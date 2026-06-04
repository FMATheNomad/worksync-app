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
    return await attendance_service.get_attendance_summary(
        db, target_date=query_date
    )
