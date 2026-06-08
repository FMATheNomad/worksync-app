"""
Expense model — records employee business expenses with receipt photos.

WHY THIS EXISTS: Enables employees to log business expenses (travel, supplies, meals)
with photo receipts. The photo_url links to Cloudinary for permanent storage and audit.
This model is deliberately simple (no approval workflow) to keep the MVP lean. An
approval state machine (pending -> approved -> reimbursed) would be the next logical
extension.

FIELD DESIGN NOTES:
  - amount (Float): Stored as a float for simplicity. For accounting-grade precision
    (avoiding floating-point rounding errors), this should be migrated to DECIMAL(12,2).
    Float is acceptable for an MVP where amounts are informational, not financial-accounting.
  - category (String, not Enum): Categories are user-defined free text rather than
    constrained to an enum. WHY? Organizations have diverse expense categories that
    change over time. An enum would require database migrations for every category change.
    The frontend provides a predefined list as UX guidance, but the backend accepts any string.
  - date (Date, not DateTime): Expenses are tracked by day, not by exact time.
    The Date type prevents ambiguity around midnight boundaries and makes daily-summary
    queries simpler (no date() function needed).
  - photo_url (Optional): Not all expenses need a receipt photo (e.g., small amounts).
    The frontend enforces a 5MB limit and accepts jpeg/png/webp (see frontend constants).

RELATIONSHIP CASCADE:
  The user relationship follows the User model's cascade="all, delete-orphan".
  When a user is deleted, all their expense records are removed.
"""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Text
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id"), nullable=False
    )
    # Item name (e.g., "Taxi to client meeting", "Office supplies").
    # User-provided, not normalized — free text for maximum flexibility.
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Monetary amount. Float is used for simplicity; see field design notes above.
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    # Free-text category. Frontend suggests common categories but any string is accepted.
    category: Mapped[str] = mapped_column(String(255), nullable=False)
    # Cloudinary URL of the receipt photo. Null if no photo was uploaded.
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Optional user-provided notes about the expense.
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # The calendar date this expense occurred (not the date it was entered).
    # Using Date (not DateTime) simplifies daily expense reports.
    date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="expenses")
