from uuid import uuid4

import pytest
from pydantic import ValidationError

from slotera_api.schemas.bookings import OperatorBookingCreate


def test_new_client_booking_contract() -> None:
    value = OperatorBookingCreate.model_validate(
        {
            "newClient": {"name": "Ada", "email": "ADA@example.com"},
            "sessionId": str(uuid4()),
            "auditReason": "Consultant booking",
            "language": "de",
            "sendEmail": False,
        }
    )
    assert value.new_client is not None
    assert value.new_client.email == "ada@example.com"
    assert value.client_id is None
    assert value.send_email is False


@pytest.mark.parametrize(
    "clients",
    [
        {},
        {
            "clientId": str(uuid4()),
            "newClient": {
                "name": "Ada",
                "email": "ada@example.com",
            },
        },
    ],
)
def test_exactly_one_client_source(clients: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        OperatorBookingCreate.model_validate(
            {
                **clients,
                "sessionId": str(uuid4()),
                "auditReason": "Consultant booking",
            }
        )
