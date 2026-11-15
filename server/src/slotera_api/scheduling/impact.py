"""Deterministic review facts for session commands, without exposing client identities."""

import hashlib
import json
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from slotera_api.db.models import Booking, PaymentStatus, Session, SessionStatus
from slotera_api.errors import ApiError
from slotera_api.session_capacity import CAPACITY_CONSUMING_STATUSES


@dataclass(frozen=True)
class SessionImpact:
    session_count: int
    active_booking_count: int
    paid_booking_count: int
    revision: str


def review_impact(occurrences: Sequence[Session], bookings: Sequence[Booking]) -> SessionImpact:
    """Include all reviewed booking states so moves and terminal transitions invalidate review."""
    facts = {
        "sessions": sorted((str(item.id), item.version) for item in occurrences),
        "bookings": sorted(
            (
                str(item.id),
                str(item.session_id),
                item.status.value,
                item.payment_status.value,
                item.updated_at.isoformat(),
                item.delivery_email_override,
            )
            for item in bookings
        ),
    }
    active = [item for item in bookings if item.status in CAPACITY_CONSUMING_STATUSES]
    return SessionImpact(
        sum(item.status != SessionStatus.CANCELLED for item in occurrences),
        len(active),
        sum(item.payment_status == PaymentStatus.PAID for item in active),
        hashlib.sha256(json.dumps(facts, sort_keys=True).encode()).hexdigest(),
    )


def validate_booking_constraints(
    occurrences: Sequence[Session],
    bookings: Sequence[Booking],
    changes: dict[str, Any],
) -> None:
    occupied = Counter(
        item.session_id for item in bookings if item.status in CAPACITY_CONSUMING_STATUSES
    )
    historical = {item.session_id for item in bookings}
    for occurrence in occurrences:
        if "capacity" in changes and changes["capacity"] < occupied[occurrence.id]:
            raise ApiError(
                status_code=409,
                code="session_capacity_in_use",
                message="Capacity cannot be lower than the active booking count",
            )
        if (
            "service_id" in changes
            and changes["service_id"] != occurrence.service_id
            and occurrence.id in historical
        ):
            raise ApiError(
                status_code=409,
                code="session_service_in_use",
                message="A session with bookings cannot change its service",
            )
