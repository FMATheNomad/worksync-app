from fastapi import APIRouter, Depends, HTTPException, Query, status
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.middleware import check_feature_access
from app.schemas.ai import AIAnalyticsRequest, AIReportRequest, AIReportResponse, AIAnalyticsResponse
from app.models.user import User
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


@router.post("/generate-report", response_model=AIReportResponse)
async def generate_report(
    request: AIReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_feature_access(current_user.subscription_plan.value, "ai_assistant")
    result = await ai_service.generate_report(db, current_user.id, request.user_message)
    return AIReportResponse(report_content=result)


@router.post("/analytics", response_model=AIAnalyticsResponse)
async def analytics_query(
    request: AIAnalyticsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_feature_access(current_user.subscription_plan.value, "ai_assistant")
    answer = await ai_service.analytics_query(db, current_user, request.question)
    return AIAnalyticsResponse(answer=answer)


@router.get("/conversations")
async def list_conversations(
    context_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversations = await ai_service.get_conversations(
        db, current_user.id, context_type=context_type, limit=limit
    )
    return {"conversations": conversations, "total": len(conversations)}


@router.post("/generate-report/stream")
async def generate_report_stream(
    request: AIReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_feature_access(current_user.subscription_plan.value, "ai_assistant")

    async def event_generator():
        async for chunk in ai_service.generate_report_stream(db, current_user.id, request.user_message):
            yield {"event": "chunk", "data": chunk}
        yield {"event": "done", "data": ""}

    return EventSourceResponse(event_generator())


@router.post("/analytics/stream")
async def analytics_query_stream(
    request: AIAnalyticsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_feature_access(current_user.subscription_plan.value, "ai_assistant")

    async def event_generator():
        async for chunk in ai_service.analytics_query_stream(db, current_user, request.question):
            yield {"event": "chunk", "data": chunk}
        yield {"event": "done", "data": ""}

    return EventSourceResponse(event_generator())
