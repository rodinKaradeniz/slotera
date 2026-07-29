"""Add tenant-scoped booking ledger.

Revision ID: 20260729_0008
Revises: 20260729_0007
Create Date: 2026-07-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260729_0008"
down_revision: str | None = "20260729_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

booking_status = postgresql.ENUM(
    "pending",
    "confirmed",
    "completed",
    "cancelled",
    "noshow",
    name="booking_status",
    create_type=False,
)
payment_status = postgresql.ENUM(
    "paid", "pending", "refunded", "free", "overdue", name="payment_status", create_type=False
)


def upgrade() -> None:
    booking_status.create(op.get_bind(), checkfirst=True)
    payment_status.create(op.get_bind(), checkfirst=True)
    op.create_unique_constraint("uq_clients_workspace_id_id", "clients", ["workspace_id", "id"])
    op.create_unique_constraint("uq_sessions_workspace_id_id", "sessions", ["workspace_id", "id"])
    op.create_table(
        "bookings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("status", booking_status, nullable=False),
        sa.Column("payment_status", payment_status, nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("notes", sa.String(2000), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("amount_cents >= 0", name="amount_nonnegative"),
        sa.CheckConstraint("char_length(currency) = 3", name="currency_iso_length"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "client_id"],
            ["clients.workspace_id", "clients.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id", "session_id"],
            ["sessions.workspace_id", "sessions.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bookings_workspace_id", "bookings", ["workspace_id"])
    op.create_index("ix_bookings_client_id", "bookings", ["client_id"])
    op.create_index("ix_bookings_session_id", "bookings", ["session_id"])
    op.execute("ALTER TABLE bookings ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE bookings FORCE ROW LEVEL SECURITY")
    for operation, clause in (("select", "USING"), ("insert", "WITH CHECK"), ("delete", "USING")):
        policy = f"CREATE POLICY bookings_{operation} ON bookings FOR {operation.upper()}"
        op.execute(
            f"{policy} TO slotera_app "
            f"{clause} (workspace_id = public.slotera_current_workspace_id())"
        )
    op.execute(
        "CREATE POLICY bookings_update ON bookings FOR UPDATE TO slotera_app "
        "USING (workspace_id = public.slotera_current_workspace_id()) "
        "WITH CHECK (workspace_id = public.slotera_current_workspace_id())"
    )


def downgrade() -> None:
    op.drop_table("bookings")
    op.drop_constraint("uq_sessions_workspace_id_id", "sessions", type_="unique")
    op.drop_constraint("uq_clients_workspace_id_id", "clients", type_="unique")
    payment_status.drop(op.get_bind(), checkfirst=True)
    booking_status.drop(op.get_bind(), checkfirst=True)
