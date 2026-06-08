"""
Attendance model — tracks employee check-in/check-out with GPS data.

WHY THIS EXISTS: Core time-tracking feature. Each attendance record captures the
employee's physical location at check-in and check-out, along with a selfie for
identity verification. The status field (present/late/absent) is determined server-side
by comparing check-in time against the configured late cutoff.

GPS COORDINATE PRECISION:
  - Stored as Float (IEEE 754 double-precision, ~15 decimal digits).
  - Latitude ranges [-90, 90], longitude [-180, 180].
  - Float64 provides ~1.1mm precision at the equator — far more than needed for
    building-level accuracy (±5m is typical for consumer GPS).
  - WHY Float and not DECIMAL(10,7): Performance. Float arithmetic is faster in
    SQLite, and the tiny precision loss (<1mm) is irrelevant for geofencing.
  - For geofencing (radius checks), we compute Haversine distance in the service layer.
    The radius is defined in constants as RADIUS_LIMIT_METERS.

STATUS DETERMINATION:
  Status is determined in attendance_service._determine_status() by comparing
  check_in_time with ABSENSI_LATE_CUTOFF_TIME (default "10:00"). This is done
  SERVER-SIDE (not client-side) because:
    1. The client's clock may be wrong or manipulated.
    2. The server's UTC time is the authoritative source.
    3. Prevents employees from changing their device time to avoid "late" status.
  The cutoff time uses Asia/Jakarta timezone (WIB = UTC+7) because the application
  is designed for Indonesian businesses.

DUPLICATE PREVENTION:
  Enforced at the route level (api/v1/attendance.py) by checking for existing
  today's attendance before allowing check-in. There is NO unique constraint on
  (user_id, date) because the date is derived from check_in_time (which includes
  time component). The route-level check is sufficient for preventing duplicates
  within the same request. For race conditions (two simultaneous check-ins), the
  last write wins — acceptable for this use case.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AttendanceStatus(str, enum.Enum):
    present = "present"
    late = "late"
    absent = "absent"


class Attendance(Base):
    __tablename__ = "attendances"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id"), nullable=False
    )
    check_in_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    check_out_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # GPS coordinates at check-in. These are the employee's claimed position.
    # We trust the client's GPS but record it for audit purposes. In a real-world
    # deployment, you might cross-reference with Wi-Fi SSID or IP geolocation.
    check_in_lat: Mapped[float] = mapped_column(Float, nullable=False)
    check_in_lng: Mapped[float] = mapped_column(Float, nullable=False)
    # Reverse-geocoded address (from BigDataCloud API). Nullable because:
    # 1. The API key may not be configured.
    # 2. The API call may fail (network error, rate limiting).
    # 3. The coordinates might not resolve to a street address (ocean, wilderness).
    check_in_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Optional: Some employees may only check in (e.g., end of day forgot to check out).
    # The system allows check_out to be NULL and still considers the record valid.
    check_out_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    check_out_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    check_out_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Selfie URL (Cloudinary). Provides visual confirmation that the person checking in
    # is actually the employee. Not a substitute for biometric authentication,
    # but adds a deterrent against buddy punching.
    selfie_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[AttendanceStatus] = mapped_column(
        Enum(AttendanceStatus), default=AttendanceStatus.present, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="attendances")
