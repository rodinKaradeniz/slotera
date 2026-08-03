"""Add operator client notes.

Revision ID: 20260729_0010
Revises: 20260729_0009
Create Date: 2026-07-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260729_0010"
down_revision: str | None = "20260729_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


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
    op.create_table(
        "client_notes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("body", sa.String(20000), nullable=False),
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
            ["workspace_id", "client_id"],
            ["clients.workspace_id", "clients.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_client_notes_workspace_id", "client_notes", ["workspace_id"])
    op.create_index("ix_client_notes_client_id", "client_notes", ["client_id"])
    _rls("client_notes")


def downgrade() -> None:
    op.drop_table("client_notes")
