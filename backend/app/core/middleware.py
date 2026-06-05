from fastapi import Request, HTTPException, status

from app.utils.constants import SUBSCRIPTION_PLANS

PREMIUM_FEATURE_ROUTES: dict[str, str] = {
    "ai_assistant": "/api/v1/ai",
    "export_excel": "/api/v1/export",
}


def check_feature_access(plan: str, feature: str) -> None:
    plan_features = SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS["free"]).get("features", [])
    if feature not in plan_features:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Feature '{feature}' is not available on your {plan} plan. Please upgrade.",
        )