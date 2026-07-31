"""Add persisted group-session booking attendance.

Revision ID: 20260731_0016
Revises: 20260731_0015
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260731_0016"
down_revision: str | None = "20260731_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

booking_attendance = postgresql.ENUM(
    "present",
    "late",
    "absent",
    name="booking_attendance",
    create_type=False,
)


def upgrade() -> None:
    booking_attendance.create(op.get_bind(), checkfirst=True)
    op.add_column("bookings", sa.Column("attendance", booking_attendance, nullable=True))


def downgrade() -> None:
    op.drop_column("bookings", "attendance")
    booking_attendance.drop(op.get_bind(), checkfirst=True)
