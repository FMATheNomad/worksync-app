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
    plans = []
    for plan_name, plan_config in SUBSCRIPTION_PLANS.items():
        plans.append({
            "name": plan_name,
            "max_employees": plan_config["max_employees"],
            "features": plan_config["features"],
        })
    return plans