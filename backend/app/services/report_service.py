from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import DailyReport
from app.schemas.report import ReportCreate, ReportListResponse, ReportResponse, ReportUpdate
from app.utils.helpers import get_current_date


async def create_report(db: AsyncSession, user_id: UUID, request: ReportCreate) -> DailyReport:
    report = DailyReport(
        user_id=user_id,
        content=request.content,
        status=request.status or "draft",
        date=request.date or get_current_date(),
        is_ai_generated=request.is_ai_generated or False,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return report


async def list_reports(
    db: AsyncSession,
    user_id: UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    status: str | None = None,
    page: int = 1,
    size: int = 20,
) -> ReportListResponse:
    query = select(DailyReport)

    if user_id:
        query = query.where(DailyReport.user_id == user_id)
    if start_date:
        query = query.where(DailyReport.date >= start_date)
    if end_date:
        query = query.where(DailyReport.date <= end_date)
    if status:
        query = query.where(DailyReport.status == status)

    count_query = select(func.count()).select_from(DailyReport)
    if user_id:
        count_query = count_query.where(DailyReport.user_id == user_id)
    if start_date:
        count_query = count_query.where(DailyReport.date >= start_date)
    if end_date:
        count_query = count_query.where(DailyReport.date <= end_date)
    if status:
        count_query = count_query.where(DailyReport.status == status)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(DailyReport.date.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    reports = result.scalars().all()

    return ReportListResponse(
        reports=[ReportResponse.model_validate(r) for r in reports],
        total=total,
    )


async def get_report(db: AsyncSession, report_id: UUID) -> DailyReport | None:
    result = await db.execute(select(DailyReport).where(DailyReport.id == report_id))
    return result.scalar_one_or_none()


async def update_report(db: AsyncSession, report_id: UUID, request: ReportUpdate) -> DailyReport | None:
    result = await db.execute(select(DailyReport).where(DailyReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        return None

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(report, field, value)

    await db.flush()
    await db.refresh(report)
    return report
