"""
Billing service — Polar.sh integration for subscription management.

WHY THIS EXISTS: Manages the entire subscription lifecycle through Polar.sh's API
and webhooks. Polar.sh is the payment processing partner; this service translates
Polar's subscription events into user model updates.

SUBSCRIPTION STATE MACHINE:
  User signs up → subscription_status=inactive, plan=free
  User clicks "Upgrade" → create_checkout_session → Polar.sh checkout page
  User pays → Polar.sh sends webhook: subscription.created → subscription.active
    → user.status=active, user.plan=pro/enterprise, max_employees updated
  Payment fails → Polar.sh sends: subscription.updated (status=past_due)
    → user.status=past_due (grace period)
  User cancels → Polar.sh sends: subscription.canceled
    → user.status=canceled, plan=free, max_employees=5

  REFUND/EXPIRATION: Not yet handled. Polar.sh would send additional events
  that we'd need to handle in _handle_subscription_updated.

POLLAR.SH INTEGRATION:
  - Uses the polar_sdk Python package for API calls.
  - Customer creation: Each user gets a Polar.sh customer record linked by
    user.email. If a customer already exists (from a previous checkout attempt),
    we reuse it. This prevents duplicate customer records per user.
  - Checkout sessions: Created with a price_id (defined in Polar.sh dashboard)
    and a success_url for post-payment redirect. No cancel_url is set because
    Polar.sh's hosted checkout page handles cancellation internally.

WEBHOOK VERIFICATION:
  handle_webhook verifies the Polar.sh signature using standardwebhooks library.
  This proves the webhook genuinely came from Polar.sh (not a malicious actor).
  SECURITY: The endpoint must NOT require authentication (the webhook caller
  doesn't have a session token). Instead, it relies entirely on the
  polar-signature header for authenticity.

  WHY standardwebhooks (not manual HMAC): standardwebhooks (the library from
  Svix/Standard Webhooks) handles edge cases like timestamp tolerance and
  signature scheme evolution. It's the same verification mechanism used by
  Stripe, GitHub, and others for their webhooks.

ASYNC POLAR.SD CALLS:
  polar_sdk uses synchronous HTTP under the hood. We wrap all calls in
  asyncio.to_thread to avoid blocking the event loop. This is a common pattern
  when using sync SDKs in async FastAPI applications.

EDGE CASES:
  - Missing customer: If a subscription event arrives for a customer_id we
    don't have in our DB, we log and return (no crash). This could happen if
    the webhook arrives before polar_customer_id is saved, or for a deleted user.
  - Unknown event type: handle_webhook ignores unhandled event types. Polar.sh
    sends many event types; we only process the ones relevant to subscription
    state transitions.
  - race conditions: If two webhooks arrive simultaneously (e.g., subscription.active
    and subscription.updated), the last write wins. This is acceptable because
    both handlers set consistent state for the given event data.
"""

import asyncio
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import SubscriptionPlan, SubscriptionStatus, User
from app.utils.constants import SUBSCRIPTION_PLANS


async def create_checkout_session(
    db: AsyncSession,
    user: User,
    price_id: str,
    success_url: str,
) -> str:
    """
    Creates a Polar.sh checkout session and returns the hosted checkout URL.
    
    Steps:
      1. Look up existing Polar.sh customer for this user (by polar_customer_id).
      2. If no customer exists, create one via Polar SDK.
      3. Create a checkout session with the specified price_id.
      4. Return the checkout URL (user is redirected to Polar.sh).
    
    WHY reuse existing customer: Prevents duplicate Polar.sh customer records.
    Polar.sh allows multiple customers with the same email, but we want a 1:1
    mapping between our users and Polar.sh customers for clean webhook matching.
    """
    try:
        from polar_sdk import Polar

        polar = Polar(access_token=settings.polar_access_token)

        customer = None
        if user.polar_customer_id:
            try:
                customer = await asyncio.to_thread(polar.customers.get, id=user.polar_customer_id)
            except Exception:
                customer = None

        if not customer:
            customer = await asyncio.to_thread(
                polar.customers.create,
                request={
                    "email": user.email,
                    "name": user.name,
                    "organization_id": settings.polar_organization_id,
                }
            )
            user.polar_customer_id = customer.id
            await db.flush()

        checkout = await asyncio.to_thread(
            polar.checkouts.create,
            request={
                "customer_id": customer.id,
                "price_id": price_id,
                "success_url": success_url,
                "organization_id": settings.polar_organization_id,
            }
        )
        return checkout.url
    except Exception as e:
        raise Exception(f"Failed to create checkout session: {str(e)}")


async def handle_webhook(
    db: AsyncSession,
    payload: dict,
    signature: str,
) -> None:
    """
    Processes incoming Polar.sh webhooks.
    
    SECURITY: Verifies the polar-signature header BEFORE processing any event.
    If verification fails, we raise 401 immediately — no event data is trusted.
    
    The payload is the raw Polar.sh event object. We route to specific handlers
    based on event type (subscription.created, .active, .canceled, .updated).
    """
    try:
        import standardwebhooks
        wh = standardwebhooks.Webhooks(settings.polar_webhook_secret)
        wh.verify(payload, {"polar-signature": signature})
    except Exception:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    event_type = payload.get("type", "")
    data = payload.get("data", {})

    if event_type == "subscription.created":
        await _handle_subscription_created(db, data)
    elif event_type == "subscription.active":
        await _handle_subscription_active(db, data)
    elif event_type == "subscription.canceled":
        await _handle_subscription_canceled(db, data)
    elif event_type == "subscription.updated":
        await _handle_subscription_updated(db, data)


async def _handle_subscription_created(db: AsyncSession, data: dict) -> None:
    """
    Fired when a subscription is initially created (before payment confirmation).
    We simply record the polar_subscription_id on the user record.
    The plan upgrade happens on subscription.active (after payment).
    """
    customer_id = data.get("customer_id")
    subscription_id = data.get("id")
    if not customer_id:
        return
    result = await db.execute(
        select(User).where(User.polar_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()
    if user:
        user.polar_subscription_id = subscription_id
        await db.flush()


async def _handle_subscription_active(db: AsyncSession, data: dict) -> None:
    """
    Fired when payment succeeds and subscription becomes active.
    This is the main "upgrade" event:
      - Sets plan to the purchased product name (e.g., "pro", "enterprise").
      - Sets status to active.
      - Updates max_employees based on the plan config.
    
    WHY read product name from webhook data: Polar.sh includes the product
    details in the event. We normalize to lowercase for matching against
    our SubscriptionPlan enum.
    """
    customer_id = data.get("customer_id")
    subscription_id = data.get("id")
    product_data = data.get("product", {}) or data.get("plan", {})
    plan_name = product_data.get("name", "free").lower()
    if not customer_id:
        return
    result = await db.execute(
        select(User).where(User.polar_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()
    if user:
        user.subscription_plan = plan_name
        user.subscription_status = SubscriptionStatus.active
        user.polar_subscription_id = subscription_id
        plan_config = SUBSCRIPTION_PLANS.get(plan_name, SUBSCRIPTION_PLANS["free"])
        user.max_employees = plan_config["max_employees"]
        await db.flush()


async def _handle_subscription_canceled(db: AsyncSession, data: dict) -> None:
    """
    Fired when subscription is canceled.
    Reverts user to free plan with limited max_employees.
    """
    customer_id = data.get("customer_id")
    if not customer_id:
        return
    result = await db.execute(
        select(User).where(User.polar_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()
    if user:
        user.subscription_status = SubscriptionStatus.canceled
        user.subscription_plan = SubscriptionPlan.free
        user.max_employees = SUBSCRIPTION_PLANS["free"]["max_employees"]
        await db.flush()


async def _handle_subscription_updated(db: AsyncSession, data: dict) -> None:
    """
    Handles subscription updates including past_due, reactivation, and status changes.
    
    Maps Polar.sh subscription statuses to our SubscriptionStatus enum:
      past_due → past_due (grace period before downgrade)
      active → active (reactivation after past_due)
      canceled → canceled (with plan revert to free)
    """
    customer_id = data.get("customer_id")
    subscription_status = data.get("status", "")
    product_data = data.get("product", {}) or data.get("plan", {})
    plan_name = product_data.get("name", "free").lower()
    if not customer_id:
        return
    result = await db.execute(
        select(User).where(User.polar_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()
    if user:
        if subscription_status == "past_due":
            user.subscription_status = SubscriptionStatus.past_due
        elif subscription_status == "active":
            user.subscription_status = SubscriptionStatus.active
            user.subscription_plan = plan_name
        elif subscription_status == "canceled":
            user.subscription_status = SubscriptionStatus.canceled
            user.subscription_plan = SubscriptionPlan.free
        plan_config = SUBSCRIPTION_PLANS.get(plan_name, SUBSCRIPTION_PLANS["free"])
        user.max_employees = plan_config["max_employees"]
        await db.flush()


async def get_user_subscription(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_customer(db: AsyncSession, user: User) -> str | None:
    """
    Creates a Polar.sh customer record for a user.
    Called during user registration to pre-link the user with Polar.sh.
    Returns the Polar.sh customer ID, or None on failure.
    
    Edge case: If Polar.sh is down during registration, we still create the
    user account without a customer ID. The customer will be created on first
    checkout attempt (in create_checkout_session).
    """
    try:
        from polar_sdk import Polar
        polar = Polar(access_token=settings.polar_access_token)
        customer = await asyncio.to_thread(
            polar.customers.create,
            request={
                "email": user.email,
                "name": user.name,
                "organization_id": settings.polar_organization_id,
            }
        )
        user.polar_customer_id = customer.id
        await db.flush()
        return customer.id
    except Exception:
        return None


async def list_available_plans() -> list[dict]:
    """
    Returns the available subscription plans with features and limits.
    Used by the frontend pricing page and the /billing/plans endpoint.
    This reads from SUBSCRIPTION_PLANS in utils/constants.py, which is the
    single source of truth for plan definitions.
    """
    plans = []
    for plan_name, plan_config in SUBSCRIPTION_PLANS.items():
        plans.append({
            "name": plan_name,
            "max_employees": plan_config["max_employees"],
            "features": plan_config["features"],
        })
    return plans
