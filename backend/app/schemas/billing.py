from typing import Any

from pydantic import BaseModel


class CreateCheckoutRequest(BaseModel):
    price_id: str
    success_url: str


class BillingResponse(BaseModel):
    checkout_url: str


class SubscriptionResponse(BaseModel):
    plan: str
    status: str
    features: list[str]


class WebhookPayload(BaseModel):
    raw: dict[str, Any]


class SubscriptionPlanInfo(BaseModel):
    name: str
    max_employees: int
    features: list[str]
