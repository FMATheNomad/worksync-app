import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AttendanceStatus(str, enum.Enum):
    present = "present"
    late = "late"
    absent = "absent"


class Attendance(Base):
    __tablename__ = "attendances"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    check_in_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    check_out_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    check_in_lat: Mapped[float] = mapped_column(Float, nullable=False)
    check_in_lng: Mapped[float] = mapped_column(Float, nullable=False)
    check_in_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    check_out_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    check_out_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    check_out_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    selfie_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[AttendanceStatus] = mapped_column(
        Enum(AttendanceStatus), default=AttendanceStatus.present, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="attendances")
