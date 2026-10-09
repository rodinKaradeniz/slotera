"""Slotera's platform plans (how operators pay Slotera). See docs/PRODUCT.md → Pricing.

The tiers share every feature; only the monthly price and the cut on card payments
differ. The cut is charged as a Stripe Connect application fee once card payments
exist; until then these values are displayed, and snapshotted onto payments later.
"""

from dataclasses import dataclass
from typing import Literal

PlanId = Literal["free", "pro"]


@dataclass(frozen=True)
class Plan:
    id: PlanId
    name: str
    monthly_price_cents: int
    currency: str
    card_fee_bps: int


PLANS: dict[PlanId, Plan] = {
    "free": Plan("free", "Free", 0, "EUR", 300),
    "pro": Plan("pro", "Pro", 1900, "EUR", 100),
}
