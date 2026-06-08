"""
Pydantic schemas for billing/subscription API.

WHY THESE EXIST: Define the API contract for Polar.sh integration. The schemas
are minimal because most billing logic is handled by Polar.sh's hosted checkout
page — the backend only needs to create checkout sessions and relay webhook
events.

DESIGN CHOICES:
  - CreateCheckoutRequest.price_id is a raw string: Polar.sh uses price IDs
    (like "price_xxx") to identify which product/price to charge. The mapping
    from "pro" plan to "price_pro_monthly" is done on the frontend for flexibility.
  - BillingResponse.checkout_url is the Polar.sh-hosted URL: Users are redirected
    here for payment. After success, Polar.sh redirects back to success_url.
    The frontend handles the redirect flow, not the backend.
  - SubscriptionResponse.features comes from constants, not Polar.sh: The plan
    name is stored in the DB, and features are derived locally. This means
    feature definitions don't depend on Polar.sh availability.
  - WebhookPayload.raw accepts dict[str, Any]: Polar.sh sends variable payload
    structures. Using a generic dict avoids validation errors from evolving
    Polar.sh webhook schemas. Validation happens in billing_service.handle_webhook
    via standardwebhooks signature verification.
"""

from typing import Any

from pydantic import BaseModel


class CreateCheckoutRequest(BaseModel):
    """
    Request to create a Polar.sh checkout session.
    
    price_id: Polar.sh price identifier (e.g., "price_pro_monthly").
    success_url: Where to redirect after successful payment.
    """
    price_id: str
    success_url: str


class BillingResponse(BaseModel):
    """Response containing the Polar.sh hosted checkout URL."""
    checkout_url: str


class SubscriptionResponse(BaseModel):
    """
    Current user's subscription details.
    plan and status come from the user model (updated by webhooks).
    features are derived from SUBSCRIPTION_PLANS constants.
    """
    plan: str
    status: str
    features: list[str]


class WebhookPayload(BaseModel):
    """
    Raw Polar.sh webhook payload wrapper.
    Generic dict to handle evolving Polar.sh event schemas.
    """
    raw: dict[str, Any]


class SubscriptionPlanInfo(BaseModel):
    """
    Plan definition for the /plans endpoint.
    Used by the frontend pricing page to display plan options.
    """
    name: str
    max_employees: int
    features: list[str]
