"""
Billing routes — checkout, subscription info, plans, and webhook receiver.

WHY THIS EXISTS: Exposes subscription management endpoints for the frontend
and a webhook endpoint for Polar.sh to notify us of payment events.

WEBHOOK ENDPOINT SECURITY:
  The /webhook endpoint does NOT require authentication (no get_current_user
  dependency). WHY? Because Polar.sh doesn't have a session token — it sends
  webhooks with a cryptographic signature (polar-signature header) instead.
  
  SECURITY MODEL:
    The webhook's authenticity is verified by the standardwebhooks library
    using the POLAR_WEBHOOK_SECRET. This is an HMAC-based verification that
    proves the request came from Polar.sh and hasn't been tampered with.
    
    WHY this is safe without auth:
      1. The webhook secret is only known to us and Polar.sh.
      2. The signature covers the entire request body.
      3. standardwebhooks also checks timestamp tolerance (prevents replay attacks).
    
    If we required auth, Polar.sh would need a way to obtain a session token,
    which defeats the purpose of webhook-based architecture.

WHY WEBHOOK vs. POLLING:
  Webhooks provide real-time subscription state updates without polling overhead.
  Polar.sh sends events as they happen (payment succeeded, canceled, updated).
  If the webhook endpoint is down, Polar.sh retries with exponential backoff
  for up to 3 days, ensuring eventual consistency.

PRICE ID DESIGN:
  The create-checkout endpoint accepts a price_id string that comes from the
  frontend (defined in Polar.sh dashboard). The backend doesn't validate that
  the price_id matches a specific plan — Polar.sh's API validates it. This
  decoupling means we can change prices on Polar.sh without code changes.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.billing import (
    BillingResponse,
    CreateCheckoutRequest,
    SubscriptionResponse,
    SubscriptionPlanInfo,
)
from app.models.user import User
from app.services import billing_service
from app.utils.constants import SUBSCRIPTION_PLANS

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.post("/create-checkout", response_model=BillingResponse)
async def create_checkout(
    request: CreateCheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Creates a Polar.sh checkout session for subscription upgrade.
    
    Auth required. Returns the Polar.sh hosted checkout URL.
    The user is redirected to this URL for payment processing.
    
    price_id must match a Polar.sh price ID from the dashboard.
    success_url is where the user returns after successful payment.
    """
    checkout_url = await billing_service.create_checkout_session(
        db, current_user, request.price_id, request.success_url
    )
    return BillingResponse(checkout_url=checkout_url)


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the current user's subscription details.
    
    The features list is derived from the plan constants, not from Polar.sh.
    This means the frontend always has the latest feature definitions even
    if Polar.sh is temporarily unreachable.
    """
    features = SUBSCRIPTION_PLANS.get(current_user.subscription_plan.value, {}).get("features", [])
    return SubscriptionResponse(
        plan=current_user.subscription_plan.value,
        status=current_user.subscription_status.value,
        features=features,
    )


@router.post("/webhook")
async def webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receives Polar.sh subscription webhooks.
    
    NO AUTH REQUIRED — security relies on HMAC signature verification in
    billing_service.handle_webhook. See module docstring for rationale.
    
    Polar.sh sends events for: subscription.created, .active, .canceled, .updated.
    Unhandled event types are silently ignored.
    """
    payload = await request.json()
    signature = request.headers.get("polar-signature", "")
    await billing_service.handle_webhook(db, payload, signature)
    return {"status": "ok"}


@router.get("/plans")
async def list_plans():
    """
    Returns all available subscription plans with features and limits.
    
    No auth required — the landing page shows plans before login.
    Reads from SUBSCRIPTION_PLANS in utils/constants.py.
    """
    plans = []
    for plan_name, plan_config in SUBSCRIPTION_PLANS.items():
        plans.append(
            SubscriptionPlanInfo(
                name=plan_name,
                max_employees=plan_config["max_employees"],
                features=plan_config["features"],
            )
        )
    return {"plans": plans}
