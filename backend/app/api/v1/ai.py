"""
AI Assistant routes — report generation and analytics with streaming support.

WHY THIS EXISTS: Provides AI-powered features (report generation, analytics) to
Pro/Enterprise users. Supports both regular JSON responses and Server-Sent Events
(SSE) streaming for real-time AI output.

STREAMING SSE ARCHITECTURE:
  - Endpoints ending in /stream use SSE (text/event-stream).
  - The route handler creates an async generator that yields chunks from the
    DeepSeek API as they arrive.
  - sse_starlette's EventSourceResponse wraps the generator into proper SSE format.
  - Frontend consumes with EventSource API (or fetch with ReadableStream).

  WHY SSE over WebSocket:
    - SSE is simpler (one-directional, server→client).
    - Works over standard HTTP (no upgrade needed, passes through proxies).
    - Automatic reconnection built into EventSource API.
    - WebSocket would be overkill for append-only AI output.

  WHY not use WebTransport/HTTP3:
    Not widely supported enough for a production SaaS app.

FEATURE GATING:
  All AI endpoints call check_feature_access(current_user.subscription_plan.value, "ai_assistant")
  before processing. This raises 403 Forbidden if the user is on the Free plan.

  WHY check inside the route (not middleware):
    The current user's plan is resolved by the get_current_user dependency.
    Middleware runs before dependencies, so it doesn't have access to the
    authenticated user's plan. An alternative would be to decode the JWT in
    middleware, but that would duplicate the auth logic.

  GATE LOCATION: The check_feature_access call is the FIRST thing after auth
  dependencies, before any processing or API calls. This saves a DeepSeek API
  call if the user isn't authorized.

CONVERSATION HISTORY:
  GET /conversations returns the user's past AI interactions, filtered by
  context_type (report vs analytics). This enables the frontend to show
  conversation history per feature area. Limited to 200 max per request
  to prevent large payloads.
"""

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
    """Non-streaming report generation. Returns full report text."""
    check_feature_access(current_user.subscription_plan.value, "ai_assistant")
    result = await ai_service.generate_report(db, current_user.id, request.user_message)
    return AIReportResponse(report_content=result)


@router.post("/analytics", response_model=AIAnalyticsResponse)
async def analytics_query(
    request: AIAnalyticsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Non-streaming analytics query. Returns full analysis text."""
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
    """
    Returns conversation history for the current user.
    
    Optional context_type filter: "report" or "analytics".
    Limit controls max entries (1-200, default 50).
    Not feature-gated — all users can view their conversation history.
    """
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
    """
    Streaming report generation via SSE.
    
    The event_generator yields "chunk" events (each containing a portion of
    the generated text) followed by a "done" event to signal completion.
    
    The frontend uses EventSource to consume:
      event: chunk
      data: "text portion..."
      
      event: done
      data: ""
    """
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
    """Streaming analytics query via SSE."""
    check_feature_access(current_user.subscription_plan.value, "ai_assistant")

    async def event_generator():
        async for chunk in ai_service.analytics_query_stream(db, current_user, request.question):
            yield {"event": "chunk", "data": chunk}
        yield {"event": "done", "data": ""}

    return EventSourceResponse(event_generator())
