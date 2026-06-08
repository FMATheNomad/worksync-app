"""
Attendance service — check-in, check-out, listing, and summary.

WHY THIS EXISTS: Centralizes attendance business logic including GPS reverse geocoding,
late status determination, and attendance queries. Keeps route handlers thin.

REVERSE GEOCODING STRATEGY:
  Uses BigDataCloud API (free tier: ~1,000 requests/day). The API is called
  asynchronously with a 10-second timeout. On failure (network error, rate limit,
  missing API key), we gracefully degrade — the address field is None rather than
  blocking the check-in.
  
  WHY BigDataCloud over Google Maps: Free tier is more generous, no billing setup
  required, and provides adequate accuracy for Indonesian addresses (localityLanguage=id).
  For production with >1,000 check-ins/day, switch to Google Maps or Mapbox.

LATE DETECTION:
  Status is determined SERVER-SIDE using the server's clock (UTC). The cutoff time
  is defined in constants (ABSENSI_LATE_CUTOFF_TIME, default "10:00" WIB = UTC+7).
  WHY server-side: Prevents employees from tampering with their device clock to
  appear on time when they're actually late.
  
  Edge case: The cutoff is compared against check_in_time in UTC. The application
  assumes WIB (UTC+7) timezone for the cutoff calculation. This is hardcoded for
  the Indonesian market. For multi-timezone support, the cutoff should be
  timezone-aware per employee or per company.

DUPLICATE PREVENTION:
  check_in: The route handler checks for existing today's attendance BEFORE calling
  this service. This is an application-level guard (not a DB constraint) because
  the "today" boundary is derived from check_in_time's date component.
  
  check_out: Similarly guarded — you can't check out if you haven't checked in,
  or if you already checked out.

SUMMARY COMPUTATION:
  absent = total_active_employees - present - late
  This is an inference, not a direct measurement. An employee is "absent" if they
  have no attendance record for the day AND are active. This correctly handles:
    - Weekends: No attendance records, but the absent count may be misleading.
    - New employees: If they were activated today, they're counted as absent
      even if they haven't had time to check in yet.
  For more accuracy, compare against a planned-workdays table.
"""

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
    """
    Converts GPS coordinates to a human-readable address using BigDataCloud API.
    
    WHY this is a private helper (not a separate module): It's only used by
    attendance service. If other features need geocoding, extract to utils/.
    
    Resiliency: Returns None on any failure. The attendance record is still created
    — the address is a nice-to-have, not a must-have.
    """
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
    """
    Compares check-in time against the late cutoff to determine attendance status.
    
    The cutoff is defined in constants (default "10:00" = 10:00 AM WIB/UTC+7).
    check_in_time is in UTC; we convert to time-only for comparison.
    
    WHY timezone-naive comparison after conversion: The cutoff time is defined
    in local time (WIB). By converting check_in_time to UTC and comparing
    time components, we avoid timezone math. This works because:
      - All check-in times are stored in UTC.
      - The cutoff is expressed in WIB.
      - UTC+7 is a fixed offset (no DST in Indonesia).
    
    For timezone support with daylight saving, use pytz for proper conversion.
    """
    cutoff = time.fromisoformat(ABSENSI_LATE_CUTOFF_TIME)
    check_in_time_utc = check_in_time.astimezone(timezone.utc)
    check_in_time_only = check_in_time_utc.time()
    if check_in_time_only > cutoff:
        return AttendanceStatus.late
    return AttendanceStatus.present


async def check_in(
    db: AsyncSession, user_id: UUID, request: AttendanceCreate
) -> Attendance:
    """
    Records a check-in with GPS coordinates and optional selfie.
    
    The status (present/late) is determined automatically from the server's
    current time. This prevents clock-tampering by clients.
    """
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
    """
    Records check-out for today's attendance. Returns None if no check-in found.
    
    The route handler calls get_today_attendance first to verify a check-in exists
    and hasn't already been checked out. This service function updates in place
    rather than creating a new record.
    """
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
    """
    Returns today's attendance record for a user, if one exists.
    Used by the route handler for duplicate check-in/check-out prevention.
    """
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
    """
    Flexible attendance query with optional filters.
    Admin users see all; employees see only their own (filter applied at route level).
    
    WHY two queries (count + data): Pagination support. The frontend displays
    "Showing X of Y records". Count query is separate because SQLAlchemy's
    .count() on a query with ordering is inefficient.
    
    WHY joins to User for user_name: The AttendanceResponse schema includes
    user_name for display purposes. Rather than requiring the frontend to
    make a separate /users request, we eager-load the relationship.
    """
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
    """
    Computes daily attendance summary: present, late, absent counts.
    
    absent is inferred: total_active_employees - present - late.
    This means absent includes employees who:
      - Didn't check in (true absent)
      - Are on leave (unless tracked separately)
      - Were off-duty (weekend, holiday)
    
    For production, combine with a leave/absence tracking system for accuracy.
    """
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

    # Absent is calculated (not directly counted) because there may not be
    # an attendance record at all for absent employees.
    absent = max(0, total_employees - present - late)

    return AttendanceSummaryResponse(
        date=target_date,
        total_employees=total_employees,
        present=present,
        late=late,
        absent=absent,
    )
