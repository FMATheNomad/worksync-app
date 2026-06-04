from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.report import ReportCreate, ReportListResponse, ReportResponse, ReportUpdate
from app.models.user import User
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["Daily Reports"])


@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    request: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await report_service.create_report(db, current_user.id, request)


@router.get("/", response_model=ReportListResponse)
async def list_reports(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    user_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        user_id = current_user.id
    return await report_service.list_reports(
        db,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        status=status_filter,
        page=page,
        size=size,
    )


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = await report_service.get_report(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    if current_user.role != "admin" and report.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this report",
        )
    return report


@router.put("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: UUID,
    request: ReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = await report_service.get_report(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    if current_user.role != "admin" and report.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this report",
        )
    return await report_service.update_report(db, report_id, request)
