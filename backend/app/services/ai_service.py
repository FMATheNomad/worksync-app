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


async def _call_deepseek(messages: list[dict], model: str = None) -> str:
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
    return await _save_conversation(db, user_id, role, content, context_type)
