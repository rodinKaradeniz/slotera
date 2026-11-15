from datetime import UTC, datetime
from uuid import uuid4

import pytest

from slotera_api.db.models import Booking, BookingStatus, PaymentStatus, Session
from slotera_api.errors import ApiError
from slotera_api.scheduling.impact import review_impact, validate_booking_constraints


def fixtures():
    occurrence = Session(id=uuid4(), service_id=uuid4(), version=1)
    booking = Booking(
        id=uuid4(),
        session_id=occurrence.id,
        status=BookingStatus.CONFIRMED,
        payment_status=PaymentStatus.PAID,
        updated_at=datetime.now(UTC),
    )
    return occurrence, booking


def test_review_is_order_independent_but_invalidated_by_relevant_changes() -> None:
    occurrence, booking = fixtures()
    another, other_booking = fixtures()
    assert review_impact([occurrence, another], [booking, other_booking]) == review_impact(
        [another, occurrence], [other_booking, booking]
    )
    original = review_impact([occurrence], [booking])
    assert original.active_booking_count == original.paid_booking_count == 1
    assert str(booking.id) not in original.revision
    booking.status = BookingStatus.CANCELLED
    changed = review_impact([occurrence], [booking])
    assert changed.revision != original.revision
    assert changed.active_booking_count == changed.paid_booking_count == 0
    assert review_impact([occurrence], [booking]) == changed


def test_capacity_and_service_guards_preserve_booking_history() -> None:
    occurrence, booking = fixtures()
    with pytest.raises(ApiError, match="Capacity"):
        validate_booking_constraints([occurrence], [booking], {"capacity": 0})
    validate_booking_constraints([occurrence], [booking], {"capacity": 1})
    booking.status = BookingStatus.COMPLETED
    with pytest.raises(ApiError, match="service"):
        validate_booking_constraints([occurrence], [booking], {"service_id": uuid4()})
    validate_booking_constraints([occurrence], [booking], {"service_id": occurrence.service_id})
