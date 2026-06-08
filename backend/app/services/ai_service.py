"""
AI service — DeepSeek API integration for report generation and analytics.

WHY THIS EXISTS: Provides an abstraction layer over the DeepSeek API so that
route handlers don't deal with HTTP clients, streaming, or message formatting.
Also handles conversation persistence for audit trail and context building.

DEEPSEEK API INTEGRATION:
  - Uses DeepSeek's OpenAI-compatible API (api.deepseek.com/v1/chat/completions).
  - Supports both streaming (SSE via async generator) and non-streaming responses.
  - Temperature=0.7 for balanced creativity/determinism. For analytics queries
    that need factual accuracy, consider lowering to 0.3-0.5.
  - max_tokens=2048 limits response length to prevent runaway generation and
    control costs.

STREAMING ARCHITECTURE:
  _call_deepseek_stream() uses httpx's async streaming (async with client.stream).
  Each SSE "data:" line is parsed, the content delta is extracted, and yielded
  to the caller. The route handler wraps this in an EventSourceResponse (SSE
  protocol) for the frontend to consume with EventSource API.

  WHY streaming: AI generation can take 5-30 seconds. Without streaming, the
  user sees a loading spinner for the entire duration. With streaming, they see
  text appear word-by-word, improving perceived performance dramatically.

CONTEXT BUILDING FOR ANALYTICS:
  analytics_query() fetches real-time database statistics (total employees, today's
  attendance, late count, monthly expenses, reports submitted) and injects them
  into the system prompt as context data. This enables the AI to answer questions
  like "How many people are late today?" with actual data.

  WHY not let the AI generate SQL: Allowing an LLM to write and execute arbitrary
  SQL is a security risk (prompt injection could lead to data exfiltration).
  Instead, we pre-fetch structured context data and let the AI analyze it.
  This is less flexible but completely safe.

  TRADE-OFF: The context data is a snapshot at query time. If the query is complex
  and the AI asks "what about yesterday?", the context doesn't include yesterday's
  data. For production, we could expand the context window or let the AI request
  specific data through function calling.

CONVERSATION PERSISTENCE:
  Every user message and AI response is saved via _save_conversation(). This
  enables the frontend's conversation history feature. context_type distinguishes
  "report" vs "analytics" conversations for filtered history views.

PRICING CONSIDERATIONS:
  Every call costs money (DeepSeek is API-priced). The gating middleware
  (check_feature_access) ensures only Pro/Enterprise users can access this feature.
  In production, add usage tracking and hard rate limits per user per day.
"""

import json
from typing import AsyncGenerator
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.ai_conversation import AIConversation
from app.models.attendance import Attendance
from app.models.expense import Expense
from app.models.report import DailyReport
from app.models.user import User
from app.utils.helpers import get_current_date

# System prompts are in Indonesian because the application targets Indonesian users.
# Separating prompts from code would be ideal for i18n, but for an MVP this is acceptable.

REPORT_SYSTEM_PROMPT = """Anda adalah asisten AI untuk membantu karyawan menulis laporan harian kerja. 
Bantu karyawan membuat laporan harian yang profesional, terstruktur, dan informatif berdasarkan input yang diberikan.
Gunakan bahasa Indonesia yang baik dan benar.
Format laporan harus mencakup:
1. Ringkasan kegiatan hari ini
2. Pencapaian utama
3. Kendala yang dihadapi (jika ada)
4. Rencana untuk hari berikutnya"""

ANALYTICS_SYSTEM_PROMPT = """Anda adalah asisten AI analitik untuk manajer/admin. 
Analisis data kehadiran, pengeluaran, dan laporan harian berdasarkan data yang diberikan.
Berikan wawasan yang actionable dan rekomendasi berbasis data.
Gunakan bahasa Indonesia yang baik dan benar."""


async def _call_deepseek_stream(
    messages: list[dict],
    model: str = None,
) -> AsyncGenerator[str, None]:
    """
    Streams response chunks from DeepSeek API using SSE.

    WHY httpx async streaming: Non-blocking I/O is essential for SSE. Each chunk
    is yielded as it arrives, allowing the EventSourceResponse to push it to
    the frontend immediately.

    EDGE CASE — API key not configured:
      Instead of crashing, we yield an error message. This is consistent with
      the app's philosophy of graceful degradation for optional services.

    EDGE CASE — Non-200 response:
      DeepSeek may return 4xx/5xx for various reasons (rate limited, overloaded).
      We read the error body and yield it to the user rather than returning a
      generic 500 error.
    """
    model = model or settings.deepseek_model
    api_key = settings.deepseek_api_key
    if not api_key:
        yield "DeepSeek API key not configured. Please set DEEPSEEK_API_KEY in your environment."
        return

    import httpx

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            "https://api.deepseek.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "stream": True,
                "max_tokens": 2048,
                "temperature": 0.7,
            },
        ) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                yield f"Error: AI service returned status {response.status_code}: {error_text.decode()}"
                return

            full_content = ""
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        delta = data.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue


async def _call_deepseek(messages: list[dict], model: str = None) -> str:
    """
    Non-streaming DeepSeek API call. Returns the full response text.
    Used for non-SSE endpoints (regular report generation, analytics queries).
    """
    model = model or settings.deepseek_model
    api_key = settings.deepseek_api_key
    if not api_key:
        return "DeepSeek API key not configured. Please set DEEPSEEK_API_KEY in your environment."

    import httpx

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "stream": False,
                "max_tokens": 2048,
                "temperature": 0.7,
            },
        )
        if response.status_code != 200:
            return f"Error: AI service returned status {response.status_code}"
        data = response.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content", "")


async def _save_conversation(
    db: AsyncSession, user_id: UUID, role: str, content: str, context_type: str | None = None
) -> AIConversation:
    """
    Persists a single AI conversation message.
    Called before AND after each AI interaction to preserve the full dialog.
    """
    conv = AIConversation(
        user_id=user_id,
        role=role,
        content=content,
        context_type=context_type,
    )
    db.add(conv)
    await db.flush()
    return conv


async def generate_report(db: AsyncSession, user_id: UUID, user_message: str) -> str:
    """
    Generates a daily report using the AI. Non-streaming version.
    Saves both the user's input and the AI's response as conversation history.
    """
    await _save_conversation(db, user_id, "user", user_message, "report")
    messages = [
        {"role": "system", "content": REPORT_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
    result = await _call_deepseek(messages)
    await _save_conversation(db, user_id, "assistant", result, "report")
    return result


async def generate_report_stream(
    db: AsyncSession, user_id: UUID, user_message: str
) -> AsyncGenerator[str, None]:
    """
    Streaming version of generate_report. Used by the SSE endpoint.
    Accumulates the full response before saving (to avoid saving partial content).
    """
    await _save_conversation(db, user_id, "user", user_message, "report")
    messages = [
        {"role": "system", "content": REPORT_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
    full_response = ""
    async for chunk in _call_deepseek_stream(messages):
        full_response += chunk
        yield chunk
    await _save_conversation(db, user_id, "assistant", full_response, "report")


async def analytics_query(db: AsyncSession, user: User, question: str) -> str:
    """
    Answers analytics questions by injecting real-time database context into
    the system prompt.

    WHY pre-fetch context (not let AI query DB): Security. An AI that can write
    SQL could be prompt-injected to exfiltrate data. By controlling exactly what
    data the AI sees, we limit the blast radius of any successful injection.

    The context data includes: total employees, today's attendance count, late
    count, monthly expenses total, and reports submitted today. This covers the
    most common manager questions.
    """
    await _save_conversation(db, user.id, "user", question, "analytics")

    today = get_current_date()
    context_data = {}

    total_users = await db.execute(select(func.count()).select_from(User).where(User.is_active == True))
    context_data["total_employees"] = total_users.scalar() or 0

    today_attendance = await db.execute(
        select(func.count()).where(func.date(Attendance.check_in_time) == today)
    )
    context_data["today_attendance"] = today_attendance.scalar() or 0

    late_attendance = await db.execute(
        select(func.count()).where(
            func.date(Attendance.check_in_time) == today,
            Attendance.status == "late",
        )
    )
    context_data["today_late"] = late_attendance.scalar() or 0

    this_month_expenses = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            func.extract("month", Expense.date) == today.month,
            func.extract("year", Expense.date) == today.year,
        )
    )
    context_data["this_month_expenses"] = float(this_month_expenses.scalar() or 0)

    today_reports = await db.execute(
        select(func.count()).where(func.date(DailyReport.created_at) == today)
    )
    context_data["today_reports_submitted"] = today_reports.scalar() or 0

    system_prompt = f"{ANALYTICS_SYSTEM_PROMPT}\n\nData konteks hari ini ({today}):\n{json.dumps(context_data, indent=2, default=str)}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": question},
    ]
    result = await _call_deepseek(messages)
    await _save_conversation(db, user.id, "assistant", result, "analytics")
    return result


async def analytics_query_stream(
    db: AsyncSession, user: User, question: str
) -> AsyncGenerator[str, None]:
    """
    Streaming version of analytics_query.
    Same security and context-building approach, but streams the response.
    """
    await _save_conversation(db, user.id, "user", question, "analytics")

    today = get_current_date()
    context_data = {}

    total_users = await db.execute(select(func.count()).select_from(User).where(User.is_active == True))
    context_data["total_employees"] = total_users.scalar() or 0

    today_attendance = await db.execute(
        select(func.count()).where(func.date(Attendance.check_in_time) == today)
    )
    context_data["today_attendance"] = today_attendance.scalar() or 0

    late_attendance = await db.execute(
        select(func.count()).where(
            func.date(Attendance.check_in_time) == today,
            Attendance.status == "late",
        )
    )
    context_data["today_late"] = late_attendance.scalar() or 0

    this_month_expenses = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            func.extract("month", Expense.date) == today.month,
            func.extract("year", Expense.date) == today.year,
        )
    )
    context_data["this_month_expenses"] = float(this_month_expenses.scalar() or 0)

    today_reports = await db.execute(
        select(func.count()).where(func.date(DailyReport.created_at) == today)
    )
    context_data["today_reports_submitted"] = today_reports.scalar() or 0

    system_prompt = f"{ANALYTICS_SYSTEM_PROMPT}\n\nData konteks hari ini ({today}):\n{json.dumps(context_data, indent=2, default=str)}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": question},
    ]
    full_response = ""
    async for chunk in _call_deepseek_stream(messages):
        full_response += chunk
        yield chunk
    await _save_conversation(db, user.id, "assistant", full_response, "analytics")


async def get_conversations(
    db: AsyncSession,
    user_id: UUID,
    context_type: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """
    Returns conversation history for a user, ordered by creation time.
    Optional context_type filter separates "report" from "analytics" conversations.
    Limited to 50 by default, max 200 (controlled at route level).
    """
    query = (
        select(AIConversation)
        .where(AIConversation.user_id == user_id)
        .order_by(AIConversation.created_at.desc())
    )
    if context_type:
        query = query.where(AIConversation.context_type == context_type)
    query = query.limit(limit)
    result = await db.execute(query)
    conversations = result.scalars().all()

    # Reversed so oldest messages come first (natural conversation order).
    return [
        {
            "id": str(c.id),
            "role": c.role,
            "content": c.content,
            "context_type": c.context_type,
            "created_at": c.created_at.isoformat(),
        }
        for c in reversed(conversations)
    ]


async def save_conversation(
    db: AsyncSession,
    user_id: UUID,
    role: str,
    content: str,
    context_type: str | None = None,
) -> AIConversation:
    """Public API for saving a single conversation entry."""
    return await _save_conversation(db, user_id, role, content, context_type)
