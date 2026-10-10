"""Slotera's platform plans (how operators pay Slotera). See docs/PRODUCT.md → Pricing.

Two paid tiers share every core feature. Professional costs more per month but takes a
smaller cut of card payments, and adds no Slotera branding on client pages (WhatsApp
later). Yearly billing costs ten months ("2 months free"). Every workspace starts with a
trial; until Stripe Billing exists, Slotera staff invoice by hand and record the plan,
interval and paid-through date in the superadmin area.

The cut is charged as a Stripe Connect application fee once card payments exist; until
then these values are displayed, and snapshotted onto payments later. Stripe's own
processing fee is separate and paid by the operator.
"""

from dataclasses import dataclass
from typing import Literal

PlanId = Literal["essentials", "professional"]
BillingInterval = Literal["monthly", "yearly"]

TRIAL_DAYS = 30


@dataclass(frozen=True)
class Plan:
    id: PlanId
    name: str
    monthly_price_cents: int
    yearly_price_cents: int
    currency: str
    card_fee_bps: int


PLANS: dict[PlanId, Plan] = {
    "essentials": Plan("essentials", "Essentials", 1900, 19000, "GBP", 200),
    "professional": Plan("professional", "Professional", 3900, 39000, "GBP", 100),
}


def shows_platform_branding(plan: str) -> bool:
    """Client-facing pages say "Powered by Slotera" except on Professional."""
    return plan != "professional"
