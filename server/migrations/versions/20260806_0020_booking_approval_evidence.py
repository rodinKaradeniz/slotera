"""Add service confirmation policy and immutable booking evidence.

Revision ID: 20260806_0020
Revises: 20260802_0019
Create Date: 2026-08-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260806_0020"
down_revision: str | None = "20260802_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

confirmation_policy = postgresql.ENUM(
    "automatic",
    "operator_approval",
    name="confirmation_policy",
    create_type=False,
)
booking_approval_status = postgresql.ENUM(
    "not_required",
    "pending",
    "approved",
    "declined",
    name="booking_approval_status",
    create_type=False,
)
session_origin = postgresql.ENUM(
    "operator",
    "public_open",
    name="session_origin",
    create_type=False,
)
booking_origin = postgresql.ENUM(
    "operator",
    "public",
    name="booking_origin",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    confirmation_policy.create(bind, checkfirst=True)
    booking_approval_status.create(bind, checkfirst=True)
    session_origin.create(bind, checkfirst=True)
    booking_origin.create(bind, checkfirst=True)

    op.add_column(
        "services",
        sa.Column(
            "confirmation_policy",
            confirmation_policy,
            server_default="automatic",
            nullable=False,
        ),
    )
    op.add_column(
        "sessions",
        sa.Column("origin", session_origin, server_default="operator", nullable=False),
    )
    op.create_check_constraint(
        "ck_sessions_public_open_origin",
        "sessions",
        "origin <> 'public_open' OR (series_id IS NULL AND capacity = 1)",
    )

    op.add_column(
        "bookings",
        sa.Column("origin", booking_origin, server_default="operator", nullable=False),
    )
    op.add_column(
        "bookings",
        sa.Column(
            "confirmation_policy_snapshot",
            confirmation_policy,
            server_default="automatic",
            nullable=False,
        ),
    )
    op.add_column(
        "bookings",
        sa.Column(
            "approval_status",
            booking_approval_status,
            server_default="not_required",
            nullable=False,
        ),
    )
    op.add_column(
        "bookings", sa.Column("payment_received_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("bookings", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bookings", sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "bookings", sa.Column("customer_first_name", sa.String(80), nullable=True)
    )
    op.add_column("bookings", sa.Column("customer_last_name", sa.String(80), nullable=True))
    op.add_column("bookings", sa.Column("customer_email", sa.String(320), nullable=True))
    op.add_column("bookings", sa.Column("customer_phone", sa.String(40), nullable=True))
    op.add_column("bookings", sa.Column("customer_company", sa.String(160), nullable=True))
    op.add_column(
        "bookings",
        sa.Column("provider_terms_snapshot", sa.Text(), server_default="", nullable=False),
    )
    op.add_column(
        "bookings",
        sa.Column(
            "platform_terms_version", sa.String(80), server_default="", nullable=False
        ),
    )
    op.add_column(
        "bookings", sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "bookings",
        sa.Column(
            "manual_payment_instructions_snapshot",
            sa.Text(),
            server_default="",
            nullable=False,
        ),
    )

    op.execute(
        """
        UPDATE bookings AS booking
        SET customer_first_name = client.name,
            customer_last_name = '',
            customer_email = client.email,
            customer_phone = client.phone,
            customer_company = client.company,
            manual_payment_instructions_snapshot = CASE
              WHEN booking.payment_method = 'manual'
              THEN payment_settings.manual_payment_instructions
              ELSE ''
            END
        FROM clients AS client,
             workspace_payment_settings AS payment_settings
        WHERE client.workspace_id = booking.workspace_id
          AND client.id = booking.client_id
          AND payment_settings.workspace_id = booking.workspace_id
        """
    )
    for column in ("customer_first_name", "customer_last_name", "customer_email"):
        op.alter_column("bookings", column, nullable=False, server_default="")

    op.create_check_constraint(
        "ck_bookings_customer_email_normalized",
        "bookings",
        "customer_email = lower(btrim(customer_email))",
    )
    op.create_check_constraint(
        "ck_bookings_confirmation_gate",
        "bookings",
        "status NOT IN ('confirmed', 'completed', 'noshow') OR "
        "(payment_status IN ('paid', 'free') "
        "AND approval_status IN ('not_required', 'approved'))",
    )
    op.create_check_constraint(
        "ck_bookings_approval_policy",
        "bookings",
        "(confirmation_policy_snapshot = 'automatic' "
        "AND approval_status = 'not_required') OR "
        "(confirmation_policy_snapshot = 'operator_approval' "
        "AND approval_status <> 'not_required')",
    )
    op.create_check_constraint(
        "ck_bookings_declined_cancelled",
        "bookings",
        "approval_status <> 'declined' OR status = 'cancelled'",
    )
    op.create_check_constraint(
        "ck_bookings_public_terms_evidence",
        "bookings",
        "origin <> 'public' OR terms_accepted_at IS NOT NULL",
    )


def downgrade() -> None:
    for constraint in (
        "ck_bookings_public_terms_evidence",
        "ck_bookings_declined_cancelled",
        "ck_bookings_approval_policy",
        "ck_bookings_confirmation_gate",
        "ck_bookings_customer_email_normalized",
    ):
        op.drop_constraint(constraint, "bookings", type_="check")
    for column in (
        "manual_payment_instructions_snapshot",
        "terms_accepted_at",
        "platform_terms_version",
        "provider_terms_snapshot",
        "customer_company",
        "customer_phone",
        "customer_email",
        "customer_last_name",
        "customer_first_name",
        "declined_at",
        "approved_at",
        "payment_received_at",
        "approval_status",
        "confirmation_policy_snapshot",
        "origin",
    ):
        op.drop_column("bookings", column)
    op.drop_constraint("ck_sessions_public_open_origin", "sessions", type_="check")
    op.drop_column("sessions", "origin")
    op.drop_column("services", "confirmation_policy")

    booking_origin.drop(op.get_bind(), checkfirst=True)
    session_origin.drop(op.get_bind(), checkfirst=True)
    booking_approval_status.drop(op.get_bind(), checkfirst=True)
    confirmation_policy.drop(op.get_bind(), checkfirst=True)
