"""Add operator session action items.

Revision ID: 20260729_0011
Revises: 20260729_0010
Create Date: 2026-07-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260729_0011"
down_revision: str | None = "20260729_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

action_item_status = postgresql.ENUM(
    "todo", "done", name="session_action_item_status", create_type=False
)


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    predicate = "workspace_id = public.slotera_current_workspace_id()"
    for operation, clause in (
        ("select", "USING"),
        ("insert", "WITH CHECK"),
        ("delete", "USING"),
    ):
        op.execute(
            f"CREATE POLICY {table}_{operation} ON {table} "
            f"FOR {operation.upper()} TO slotera_app {clause} ({predicate})"
        )
    op.execute(
        f"CREATE POLICY {table}_update ON {table} FOR UPDATE TO slotera_app "
        f"USING ({predicate}) WITH CHECK ({predicate})"
    )


def upgrade() -> None:
    action_item_status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "session_action_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("status", action_item_status, server_default="todo", nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("client_visible", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "session_id"],
            ["sessions.workspace_id", "sessions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_session_action_items_workspace_id", "session_action_items", ["workspace_id"]
    )
    op.create_index("ix_session_action_items_session_id", "session_action_items", ["session_id"])
    _rls("session_action_items")


def downgrade() -> None:
    op.drop_table("session_action_items")
    action_item_status.drop(op.get_bind(), checkfirst=True)
