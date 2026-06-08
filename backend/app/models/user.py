"""
User model — the central entity for all relationships in the system.

WHY THIS EXISTS: Every feature (attendance, expense, report, AI conversation) is
owned by a User. The subscription fields control feature access across the entire
application. This model is the single source of truth for who a user is, what they
can do, and what plan they're on.

SUBSCRIPTION LIFECYCLE:
  1. User signs up -> subscription_plan=free, subscription_status=inactive
  2. User starts checkout -> polar_customer_id assigned
  3. Payment succeeds -> webhook sets status=active, plan=pro/enterprise
  4. Payment fails -> webhook sets status=past_due
  5. User cancels -> webhook sets status=canceled, plan=free
  See billing_service.py for the webhook handlers that drive these transitions.

FIELD DESIGN NOTES:
  - id is UUID (not auto-increment int): Prevents user enumeration via sequential IDs.
    Also enables client-side ID generation for offline-capable features.
  - polar_subscription_id is unique: Aligns with Polar.sh's data model where each
    subscription has a unique ID. The UNIQUE constraint prevents accidental duplicate
    webhook processing from creating multiple subscription records for one user.
  - max_employees controls team size limits per plan. Admin users of paid plans can
    invite up to this many employees. This is enforced at the employee-invite endpoint.
  - created_at/updated_at use timezone-aware UTC: All timestamps in the system use
    timezone-aware datetime. This prevents timezone-related bugs when displaying times
    across different locales. The DB stores UTC; conversion to local time happens
    on the frontend.

CASCADE STRATEGY:
  All relationships use `cascade="all, delete-orphan"`. Deleting a user removes all
  their attendances, expenses, reports, and AI conversations. This is intentional for
  GDPR-style data deletion requests. The trade-off is that accidental user deletion
  is irreversible — consider adding soft-delete if that becomes a risk.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    """
    Access control levels.
    admin    = Full system access: monitoring, employee management, billing, analytics.
    employee = Self-service access: attendance, expenses, reports, AI assistant.
    """
    admin = "admin"
    employee = "employee"


class SubscriptionPlan(str, enum.Enum):
    """
    Defines available feature tiers. Used in JWT tokens for fast authorization.
    See SUBSCRIPTION_PLANS in utils/constants.py for per-plan feature mapping.
    """
    free = "free"
    pro = "pro"
    enterprise = "enterprise"


class SubscriptionStatus(str, enum.Enum):
    """
    Mirrors Polar.sh's subscription states for local enforcement.
      active   = Payment is current. All plan features available.
      inactive = No active subscription (new users, or after cancel without payment).
      past_due = Payment failed. Grace period before downgrade.
      canceled = User initiated cancellation. Plan reverts to free.
    """
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
    # Only the bcrypt hash is stored. Raw passwords are never logged or persisted.
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.employee, nullable=False
    )
    # "jabatan" = position/job title in Indonesian. Stored as free text (no enum)
    # because organizations have arbitrary job titles.
    jabatan: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Soft-disable flag. When False, get_current_user rejects the user with 403.
    # This is more graceful than deleting the user (preserves their data).
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    subscription_plan: Mapped[SubscriptionPlan] = mapped_column(
        Enum(SubscriptionPlan), default=SubscriptionPlan.free, nullable=False
    )
    # New users start as inactive until Polar.sh confirms payment (if upgrading).
    subscription_status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus),
        default=SubscriptionStatus.inactive,
        nullable=False,
    )
    # Polar.sh subscription ID. Unique to prevent double-processing of webhooks.
    polar_subscription_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True
    )
    # Polar.sh customer ID. Not unique because in theory a user could have multiple
    # customers in Polar (though our code reuses one customer per user).
    polar_customer_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    # Maximum number of employees this user (admin) can manage.
    # Updated by billing webhooks when plan changes. Default 5 = Free plan limit.
    max_employees: Mapped[int] = mapped_column(Integer, default=5)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- Relationships ---
    # All cascades set to "all, delete-orphan" for GDPR compliance (right to erasure).
    # If the trend toward data minimization continues, we may need to add a soft-delete
    # pattern instead. For now, deletion cascades ensure no orphaned records.
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
