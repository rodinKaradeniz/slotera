"""Add operator form templates.

Revision ID: 20260729_0009
Revises: 20260729_0008
Create Date: 2026-07-29
"""
# ruff: noqa: E501
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260729_0009"
down_revision: str | None = "20260729_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None
form_status = postgresql.ENUM("active", "inactive", name="form_status", create_type=False)


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    for operation, clause in (("select", "USING"), ("insert", "WITH CHECK"), ("delete", "USING")):
        op.execute(f"CREATE POLICY {table}_{operation} ON {table} FOR {operation.upper()} TO slotera_app {clause} (workspace_id = public.slotera_current_workspace_id())")
    op.execute(f"CREATE POLICY {table}_update ON {table} FOR UPDATE TO slotera_app USING (workspace_id = public.slotera_current_workspace_id()) WITH CHECK (workspace_id = public.slotera_current_workspace_id())")


def upgrade() -> None:
    form_status.create(op.get_bind(), checkfirst=True)
    op.create_table("form_templates", sa.Column("id", sa.Uuid(), nullable=False), sa.Column("workspace_id", sa.Uuid(), nullable=False), sa.Column("name", sa.String(160), nullable=False), sa.Column("description", sa.String(1000), server_default="", nullable=False), sa.Column("status", form_status, nullable=False), sa.Column("fields", postgresql.JSONB(), nullable=False), sa.Column("required_before_payment", sa.Boolean(), server_default=sa.text("true"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"), sa.UniqueConstraint("workspace_id", "id", name="uq_form_templates_workspace_id_id"))
    op.create_index("ix_form_templates_workspace_id", "form_templates", ["workspace_id"])
    op.create_table("form_template_services", sa.Column("workspace_id", sa.Uuid(), nullable=False), sa.Column("form_template_id", sa.Uuid(), nullable=False), sa.Column("service_id", sa.Uuid(), nullable=False), sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["workspace_id", "form_template_id"], ["form_templates.workspace_id", "form_templates.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["workspace_id", "service_id"], ["services.workspace_id", "services.id"], ondelete="RESTRICT"), sa.PrimaryKeyConstraint("workspace_id", "form_template_id", "service_id"))
    _rls("form_templates")
    _rls("form_template_services")


def downgrade() -> None:
    op.drop_table("form_template_services")
    op.drop_table("form_templates")
    form_status.drop(op.get_bind(), checkfirst=True)
