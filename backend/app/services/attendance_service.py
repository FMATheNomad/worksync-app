from datetime import date, datetime, time, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.attendance import Attendance, AttendanceStatus
from app.models.user import User
from app.schemas.attendance import (
    AttendanceCheckOut,
    AttendanceCreate,
    AttendanceListResponse,
    AttendanceResponse,
    AttendanceSummaryResponse,
)
from app.utils.constants import ABSENSI_LATE_CUTOFF_TIME
from app.utils.helpers import get_current_date


async def _reverse_geocode(lat: float, lng: float) -> str | None:
    if not settings.bigdatacloud_api_key:
        return None
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.bigdatacloud.net/data/reverse-geocode-client",
                params={"latitude": lat, "longitude": lng, "localityLanguage": "id"},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                parts = []
                if data.get("city"):
                    parts.append(data["city"])
                if data.get("locality"):
                    parts.append(data["locality"])
                if data.get("street"):
                    parts.append(data["street"])
                return ", ".join(parts) if parts else None
    except Exception:
        return None
    return None


def _determine_status(check_in_time: datetime) -> AttendanceStatus:
    cutoff = time.fromisoformat(ABSENSI_LATE_CUTOFF_TIME)
    check_in_time_utc = check_in_time.astimezone(timezone.utc)
    check_in_time_only = check_in_time_utc.time()
    if check_in_time_only > cutoff:
        return AttendanceStatus.late
    return AttendanceStatus.present


async def check_in(
    db: AsyncSession, user_id: UUID, request: AttendanceCreate
) -> Attendance:
    now = datetime.now(timezone.utc)
    address = await _reverse_geocode(request.lat, request.lng)
    status = _determine_status(now)

    attendance = Attendance(
        user_id=user_id,
        check_in_time=now,
        check_in_lat=request.lat,
        check_in_lng=request.lng,
        check_in_address=address,
        selfie_url=request.selfie_url,
        status=status,
    )
    db.add(attendance)
    await db.flush()
    await db.refresh(attendance)
    return attendance


async def check_out(
    db: AsyncSession, user_id: UUID, request: AttendanceCheckOut
) -> Attendance | None:
    today = get_current_date()
    result = await db.execute(
        select(Attendance).where(
            Attendance.user_id == user_id,
            func.date(Attendance.check_in_time) == today,
        )
    )
    attendance = result.scalar_one_or_none()
    if not attendance:
        return None

    now = datetime.now(timezone.utc)
    address = await _reverse_geocode(request.lat, request.lng)

    attendance.check_out_time = now
    attendance.check_out_lat = request.lat
    attendance.check_out_lng = request.lng
    attendance.check_out_address = address

    await db.flush()
    await db.refresh(attendance)
    return attendance


async def get_today_attendance(db: AsyncSession, user_id: UUID) -> Attendance | None:
    today = get_current_date()
    result = await db.execute(
        select(Attendance).where(
            Attendance.user_id == user_id,
            func.date(Attendance.check_in_time) == today,
        )
    )
    return result.scalar_one_or_none()


async def get_attendances(
    db: AsyncSession,
    user_id: UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> AttendanceListResponse:
    query = select(Attendance)

    if user_id:
        query = query.where(Attendance.user_id == user_id)
    if start_date:
        query = query.where(func.date(Attendance.check_in_time) >= start_date)
    if end_date:
        query = query.where(func.date(Attendance.check_in_time) <= end_date)

    count_query = select(func.count()).select_from(Attendance)
    if user_id:
        count_query = count_query.where(Attendance.user_id == user_id)
    if start_date:
        count_query = count_query.where(func.date(Attendance.check_in_time) >= start_date)
    if end_date:
        count_query = count_query.where(func.date(Attendance.check_in_time) <= end_date)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Attendance.check_in_time.desc())
    result = await db.execute(query)
    attendances = result.scalars().all()

    response_items = []
    for att in attendances:
        item = AttendanceResponse.model_validate(att)
        if att.user:
            item.user_name = att.user.name
        response_items.append(item)

    return AttendanceListResponse(attendances=response_items, total=total)


async def get_attendance_summary(
    db: AsyncSession, target_date: date | None = None
) -> AttendanceSummaryResponse:
    if target_date is None:
        target_date = get_current_date()

    total_result = await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True)
    )
    total_employees = total_result.scalar() or 0

    present_result = await db.execute(
        select(func.count()).where(
            func.date(Attendance.check_in_time) == target_date,
            Attendance.status == AttendanceStatus.present,
        )
    )
    present = present_result.scalar() or 0

    late_result = await db.execute(
        select(func.count()).where(
            func.date(Attendance.check_in_time) == target_date,
            Attendance.status == AttendanceStatus.late,
        )
    )
    late = late_result.scalar() or 0

    absent = max(0, total_employees - present - late)

    return AttendanceSummaryResponse(
        date=target_date,
        total_employees=total_employees,
        present=present,
        late=late,
        absent=absent,
    )
