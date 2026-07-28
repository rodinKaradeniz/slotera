"""Add structured operator notifications.

Revision ID: 20260728_0005
Revises: 20260728_0004
Create Date: 2026-07-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260728_0005"
down_revision: str | None = "20260728_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

notification_kind = postgresql.ENUM(
    "booking_confirmed",
    "payment_pending",
    "session_starting",
    "reschedule_requested",
    name="notification_kind",
    create_type=False,
)


def upgrade() -> None:
    notification_kind.create(op.get_bind(), checkfirst=True)

    op.execute(
        """
        CREATE FUNCTION public.slotera_current_user_id()
        RETURNS uuid
        LANGUAGE sql
        STABLE
        PARALLEL SAFE
        AS $$
          SELECT NULLIF(pg_catalog.current_setting('app.current_user_id', true), '')::uuid
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION public.slotera_current_user_id() FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION public.slotera_current_user_id() TO slotera_app")

    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("recipient_user_id", sa.Uuid(), nullable=False),
        sa.Column("kind", notification_kind, nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("resource_type", sa.String(length=80), nullable=True),
        sa.Column("resource_id", sa.Uuid(), nullable=True),
        sa.Column(
            "occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["workspace_id", "recipient_user_id"],
            ["workspace_memberships.workspace_id", "workspace_memberships.user_id"],
            name=op.f("fk_notifications_workspace_id_workspace_memberships"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notifications")),
    )
    op.create_index(
        "ix_notifications_principal_occurred_at",
        "notifications",
        ["workspace_id", "recipient_user_id", "occurred_at"],
        unique=False,
    )
    op.create_index(
        "ix_notifications_principal_unread",
        "notifications",
        ["workspace_id", "recipient_user_id"],
        unique=False,
        postgresql_where=sa.text("read_at IS NULL"),
    )

    op.execute("ALTER TABLE notifications ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE notifications FORCE ROW LEVEL SECURITY")
    principal_check = """
      workspace_id = public.slotera_current_workspace_id()
      AND recipient_user_id = public.slotera_current_user_id()
    """
    op.execute(
        f"""
        CREATE POLICY notifications_select ON notifications FOR SELECT TO slotera_app
        USING ({principal_check})
        """
    )
    op.execute(
        f"""
        CREATE POLICY notifications_update ON notifications FOR UPDATE TO slotera_app
        USING ({principal_check})
        WITH CHECK ({principal_check})
        """
    )

    op.execute("REVOKE INSERT, UPDATE, DELETE ON notifications FROM slotera_app")
    op.execute("GRANT UPDATE (read_at) ON notifications TO slotera_app")


def downgrade() -> None:
    op.drop_table("notifications")
    op.execute("DROP FUNCTION public.slotera_current_user_id()")
    notification_kind.drop(op.get_bind(), checkfirst=True)
