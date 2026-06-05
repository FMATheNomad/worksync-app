import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    employee = "employee"


class SubscriptionPlan(str, enum.Enum):
    free = "free"
    pro = "pro"
    enterprise = "enterprise"


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    past_due = "past_due"
    canceled = "canceled"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.employee, nullable=False
    )
    jabatan: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    subscription_plan: Mapped[SubscriptionPlan] = mapped_column(
        Enum(SubscriptionPlan), default=SubscriptionPlan.free, nullable=False
    )
    subscription_status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus),
        default=SubscriptionStatus.inactive,
        nullable=False,
    )
    polar_subscription_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True
    )
    polar_customer_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    max_employees: Mapped[int] = mapped_column(Integer, default=5)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    attendances = relationship(
        "Attendance", back_populates="user", cascade="all, delete-orphan"
    )
    expenses = relationship(
        "Expense", back_populates="user", cascade="all, delete-orphan"
    )
    reports = relationship(
        "DailyReport", back_populates="user", cascade="all, delete-orphan"
    )
    ai_conversations = relationship(
        "AIConversation", back_populates="user", cascade="all, delete-orphan"
    )
