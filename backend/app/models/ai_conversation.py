"""
AI Conversation model — persists chat messages between users and the DeepSeek AI.

WHY THIS EXISTS: Every interaction with the AI assistant (report generation, analytics
queries) is stored as a conversation history. This enables:
  1. The user to review past AI responses.
  2. Context-aware follow-up questions (the AI can reference prior answers).
  3. Audit trail for AI usage and billing metering.

STORAGE STRATEGY:
  - Each message is a separate row (role + content). This is a simple message-store
    pattern rather than storing the entire conversation as a JSON blob. WHY?
    Individual rows allow SQL queries like "how many AI calls did user X make this month?"
    without parsing JSON. The trade-off is more rows per conversation, but at the
    expected scale (10-50 messages per user per day), this is negligible.
  - No conversation grouping ID: We don't group messages into "sessions". Each message
    is independently addressable. Frontend groups messages by context_type + proximity
    in time. This avoids the complexity of managing session lifecycle.

CONTEXT TYPES:
  - "report": Messages related to daily report generation.
  - "analytics": Messages related to data analytics queries.
  - NULL: Legacy messages or uncategorized (future compatibility).
  
  context_type enables the frontend to filter conversation history by feature area.

SECURITY NOTE:
  conversation content includes user-provided data AND AI responses, which may include
  sensitive business information. Access is scoped to the owning user via user_id FK.
  There is no cross-user conversation visibility.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id"), nullable=False
    )
    # "user" or "assistant" — mirrors the OpenAI/DeepSeek message role convention.
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    # The actual message text. Stored as Text to support long messages.
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Optional categorization: "report" | "analytics" | null
    context_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="ai_conversations")
