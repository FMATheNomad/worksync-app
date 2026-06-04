from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from typing import Any

PREMIUM_FEATURES: dict[str, list[str]] = {
    "free": [
        "ai_assistant",
        "export_excel",
    ],
    "pro": [
        "ai_assistant",
        "export_excel",
        "unlimited_employees",
        "priority_support",
    ],
    "enterprise": [
        "ai_assistant",
        "export_excel",
        "unlimited_employees",
        "priority_support",
        "custom_branding",
    ],
}

PREMIUM_FEATURE_ROUTES: dict[str, str] = {
    "ai_assistant": "/api/v1/ai",
    "export_excel": "/api/v1/export",
    "unlimited_employees": "/api/v1/users",
    "priority_support": "/api/v1/support",
    "custom_branding": "/api/v1/branding",
}


class SubscriptionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any) -> Any:
        if request.url.path.startswith("/api/v1/ai"):
            plan = request.state.user_plan if hasattr(request.state, "user_plan") else "free"
            if "ai_assistant" not in PREMIUM_FEATURES.get(plan, []):
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "detail": "Your current plan does not include AI assistant. Please upgrade to Pro or Enterprise."
                    },
                )

        if request.url.path.startswith("/api/v1/export"):
            plan = request.state.user_plan if hasattr(request.state, "user_plan") else "free"
            if "export_excel" not in PREMIUM_FEATURES.get(plan, []):
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "detail": "Your current plan does not include Excel export. Please upgrade to Pro or Enterprise."
                    },
                )

        response = await call_next(request)
        return response


def check_feature_access(plan: str, feature: str) -> None:
    if feature not in PREMIUM_FEATURES.get(plan, []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Feature '{feature}' is not available on your {plan} plan. Please upgrade.",
        )
