"""Add tenant-scoped clients.

Revision ID: 20260729_0007
Revises: 20260728_0006
Create Date: 2026-07-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260729_0007"
down_revision: str | None = "20260728_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "clients",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("company", sa.String(length=160), nullable=True),
        sa.Column("role", sa.String(length=160), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("vat_id", sa.String(length=80), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "email = lower(btrim(email))", name=op.f("ck_clients_email_normalized")
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_clients")),
        sa.UniqueConstraint("workspace_id", "email", name=op.f("uq_clients_workspace_id_email")),
    )
    op.create_index(op.f("ix_clients_workspace_id"), "clients", ["workspace_id"], unique=False)
    op.create_index(
        op.f("ix_clients_workspace_id_name"),
        "clients",
        ["workspace_id", "name"],
        unique=False,
    )
    op.execute("ALTER TABLE clients ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE clients FORCE ROW LEVEL SECURITY")
    for operation, clause in (
        ("select", "USING"),
        ("insert", "WITH CHECK"),
        ("update", "USING"),
        ("delete", "USING"),
    ):
        if operation == "update":
            op.execute(
                """
                CREATE POLICY clients_update ON clients FOR UPDATE TO slotera_app
                USING (workspace_id = public.slotera_current_workspace_id())
                WITH CHECK (workspace_id = public.slotera_current_workspace_id())
                """
            )
        else:
            op.execute(
                f"""
                CREATE POLICY clients_{operation} ON clients FOR {operation.upper()} TO slotera_app
                {clause} (workspace_id = public.slotera_current_workspace_id())
                """
            )


def downgrade() -> None:
    op.drop_table("clients")
