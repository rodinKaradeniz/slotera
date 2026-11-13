# ruff: noqa: E501
"""Preserve booking-owned questions independently of editable form templates."""

from collections.abc import Sequence

from alembic import op

revision: str = "20261113_0037"
down_revision: str | None = "20261027_0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    statements = """
        CREATE TABLE booking_form_snapshots (
            id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            booking_id uuid NOT NULL, form_template_id uuid NOT NULL,
            name varchar(160) NOT NULL, description varchar(1000) NOT NULL,
            fields jsonb NOT NULL, required_before_payment boolean NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            FOREIGN KEY (workspace_id, booking_id) REFERENCES bookings(workspace_id, id) ON DELETE CASCADE,
            UNIQUE(workspace_id, booking_id, form_template_id)
        );
        CREATE INDEX ix_booking_form_snapshots_workspace_id ON booking_form_snapshots(workspace_id);
        ALTER TABLE booking_form_snapshots ENABLE ROW LEVEL SECURITY;
        ALTER TABLE booking_form_snapshots FORCE ROW LEVEL SECURITY;
        CREATE POLICY booking_form_snapshots_tenant ON booking_form_snapshots TO slotera_app
            USING (workspace_id = public.slotera_current_workspace_id())
            WITH CHECK (workspace_id = public.slotera_current_workspace_id());
    """
    for statement in statements.split(";"):
        if statement.strip():
            op.execute(statement)


def downgrade() -> None:
    op.drop_table("booking_form_snapshots")
