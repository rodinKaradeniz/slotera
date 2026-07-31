"""Allow booking-idempotency cleanup with a deleted booking.

Revision ID: 20260731_0015
Revises: 20260731_0014
Create Date: 2026-07-31
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260731_0015"
down_revision: str | None = "20260731_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "fk_booking_command_idempotency_workspace_id_bookings",
        "booking_command_idempotency",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "fk_booking_command_idempotency_workspace_id_bookings",
        "booking_command_idempotency",
        "bookings",
        ["workspace_id", "booking_id"],
        ["workspace_id", "id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_booking_command_idempotency_workspace_id_bookings",
        "booking_command_idempotency",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "fk_booking_command_idempotency_workspace_id_bookings",
        "booking_command_idempotency",
        "bookings",
        ["workspace_id", "booking_id"],
        ["workspace_id", "id"],
        ondelete="RESTRICT",
    )
