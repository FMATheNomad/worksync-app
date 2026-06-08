"""
Subscription-based feature gating middleware and utilities.

WHY THIS EXISTS: Implements a feature-access control layer that restricts premium
features (AI Assistant, Excel Export) to users on paid subscription plans. This
approach is chosen over route-level decorators for several reasons.

ARCHITECTURE DECISION — Middleware vs. Decorator:
  - Middleware (Starlette/FastAPI middleware) runs BEFORE route handlers and has
    access to every incoming request. It can inspect the path, headers, and
    request state, making it ideal for cross-cutting concerns like feature gating.
  - We use a CHECK function (check_feature_access) called INSIDE route handlers
    rather than pure middleware. WHY? Because we need access to the authenticated
    user's plan, which is only available after the auth dependency runs (middleware
    executes before dependencies). The check function is called from route handlers
    that already have the authenticated user.
  - Alternative: A full ASGI middleware could decode the JWT and check the plan
    on every request, but that would duplicate the auth dependency's work and
    couple the middleware to JWT internals. The current approach keeps separation
    of concerns.

EDGE CASE — Race Condition on Plan Change:
  - When a user upgrades/downgrades, the plan change takes effect on their NEXT
    token refresh (because the plan is embedded in the JWT access token). For
    instant enforcement, the billing webhook could force token refresh. However,
    the 30-minute token lifetime is an acceptable window for most SaaS applications.
"""

from fastapi import Request, HTTPException, status

from app.utils.constants import SUBSCRIPTION_PLANS

# Maps premium feature keys to their API route prefixes.
# WHY a dictionary: Makes it easy to audit which routes are premium-gated.
# Adding a new premium feature = one line in this dict + one check_feature_access call.
PREMIUM_FEATURE_ROUTES: dict[str, str] = {
    "ai_assistant": "/api/v1/ai",
    "export_excel": "/api/v1/export",
}


def check_feature_access(plan: str, feature: str) -> None:
    """
    Verifies that the given plan includes the requested feature.

    WHY raises HTTPException (not returns bool): Consistent error handling pattern.
    Route handlers that call this function don't need an `if not allowed: raise`
    boilerplate — the exception propagates to FastAPI's exception handler automatically.

    The plan string comes from the JWT access token (embedded at login/refresh time),
    so it reflects the user's plan at the time their current token was issued.
    This means there's a window between plan change and enforcement (max 30 min
    or until token refresh).

    SECURITY: This check runs SERVER-SIDE. The frontend may hide premium UI elements
    based on plan, but the real enforcement happens here. Never trust client-side gating.
    """
    plan_features = SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS["free"]).get("features", [])
    if feature not in plan_features:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Feature '{feature}' is not available on your {plan} plan. Please upgrade.",
        )
