"""Add transaction-safe booking command idempotency.

Revision ID: 20260731_0014
Revises: 20260730_0013
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260731_0014"
down_revision: str | None = "20260730_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _rls(table: str) -> None:
    predicate = "workspace_id = public.slotera_current_workspace_id()"
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    for operation, clause in (("select", "USING"), ("insert", "WITH CHECK")):
        op.execute(
            f"CREATE POLICY {table}_{operation} ON {table} FOR {operation.upper()} "
            f"TO slotera_app {clause} ({predicate})"
        )


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_bookings_workspace_id_id", "bookings", ["workspace_id", "id"]
    )
    op.create_table(
        "booking_command_idempotency",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("command", sa.String(length=64), nullable=False),
        sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "booking_id"],
            ["bookings.workspace_id", "bookings.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workspace_id",
            "actor_user_id",
            "idempotency_key",
            name="uq_booking_command_idempotency_actor_key",
        ),
    )
    op.create_index(
        "ix_booking_command_idempotency_workspace_id",
        "booking_command_idempotency",
        ["workspace_id"],
    )
    op.create_index(
        "ix_booking_command_idempotency_actor_user_id",
        "booking_command_idempotency",
        ["actor_user_id"],
    )
    _rls("booking_command_idempotency")


def downgrade() -> None:
    op.drop_table("booking_command_idempotency")
    op.drop_constraint("uq_bookings_workspace_id_id", "bookings", type_="unique")
