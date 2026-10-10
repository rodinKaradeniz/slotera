"""Add private calendar-feed links for operators.

`calendar_feed_tokens` holds the SHA-256 of each operator's subscribe link (one live link
per operator; creating a new one revokes the old). Calendar apps fetch the feed without
a session, so `slotera_calendar_feed_resolve` maps a token hash to its workspace, the one
cross-tenant read; the feed itself is read inside that workspace's tenant transaction.
Suspended workspaces stop serving their feed.

Revision ID: 20261011_0031
Revises: 20261011_0030
Create Date: 2026-10-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261011_0031"
down_revision: str | None = "20261011_0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "calendar_feed_tokens"
_RESOLVE = "public.slotera_calendar_feed_resolve(bytea)"


def upgrade() -> None:
    op.create_table(
        _TABLE,
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_calendar_feed_tokens_token_hash"),
        sa.CheckConstraint("octet_length(token_hash) = 32", name="ck_calendar_feed_token_hash"),
    )
    op.create_index("ix_calendar_feed_tokens_owner", _TABLE, ["workspace_id", "user_id"])
    op.execute(f"ALTER TABLE {_TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {_TABLE} FORCE ROW LEVEL SECURITY")
    for operation, clause in (("select", "USING"), ("insert", "WITH CHECK"), ("delete", "USING")):
        op.execute(
            f"CREATE POLICY {_TABLE}_{operation} ON {_TABLE} "
            f"FOR {operation.upper()} TO slotera_app "
            f"{clause} (workspace_id = public.slotera_current_workspace_id())"
        )
    op.execute(
        f"CREATE POLICY {_TABLE}_update ON {_TABLE} FOR UPDATE TO slotera_app "
        "USING (workspace_id = public.slotera_current_workspace_id()) "
        "WITH CHECK (workspace_id = public.slotera_current_workspace_id())"
    )
    op.execute(
        """
        CREATE FUNCTION public.slotera_calendar_feed_resolve(p_token_hash bytea)
        RETURNS TABLE (workspace_id uuid, user_id uuid)
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          SELECT feed.workspace_id, feed.user_id
          FROM public.calendar_feed_tokens AS feed
          JOIN public.workspaces AS workspace ON workspace.id = feed.workspace_id
          WHERE feed.token_hash = p_token_hash
            AND feed.revoked_at IS NULL
            AND workspace.operational_status::text = 'active'
        $$
        """
    )
    op.execute(f"REVOKE ALL ON FUNCTION {_RESOLVE} FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {_RESOLVE} TO slotera_app")


def downgrade() -> None:
    op.execute(f"DROP FUNCTION {_RESOLVE}")
    op.drop_table(_TABLE)
