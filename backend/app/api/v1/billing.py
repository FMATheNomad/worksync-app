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
    checkout_url = await billing_service.create_checkout_session(
        db, current_user, request.price_id, request.success_url
    )
    return BillingResponse(checkout_url=checkout_url)


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    payload = await request.json()
    signature = request.headers.get("polar-signature", "")
    await billing_service.handle_webhook(db, payload, signature)
    return {"status": "ok"}


@router.get("/plans")
async def list_plans():
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
