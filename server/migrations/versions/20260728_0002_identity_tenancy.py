"""Add identity and tenant persistence with row-level security.

Revision ID: 20260728_0002
Revises: 20260726_0001
Create Date: 2026-07-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260728_0002"
down_revision: str | None = "20260726_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

platform_role = postgresql.ENUM("superadmin", name="platform_role", create_type=False)
membership_role = postgresql.ENUM(
    "operator_admin", name="membership_role", create_type=False
)


def upgrade() -> None:
    platform_role.create(op.get_bind(), checkfirst=True)
    membership_role.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("title", sa.String(length=32), nullable=True),
        sa.Column("first_names", sa.String(length=160), nullable=False),
        sa.Column("last_name", sa.String(length=160), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("platform_role", platform_role, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("email = lower(btrim(email))", name="ck_users_email_normalized"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )

    op.create_table(
        "workspaces",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="EUR", nullable=False),
        sa.Column(
            "timezone", sa.String(length=64), server_default="Europe/Berlin", nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", name="ck_workspaces_slug_format"
        ),
        sa.CheckConstraint(
            "char_length(currency) = 3", name="ck_workspaces_currency_iso_length"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workspaces")),
        sa.UniqueConstraint("slug", name=op.f("uq_workspaces_slug")),
    )

    op.create_table(
        "workspace_memberships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "role", membership_role, server_default="operator_admin", nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_workspace_memberships_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_workspace_memberships_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workspace_memberships")),
        sa.UniqueConstraint(
            "workspace_id", "user_id", name=op.f("uq_workspace_memberships_workspace_id")
        ),
    )
    op.create_index(
        op.f("ix_workspace_memberships_user_id"),
        "workspace_memberships",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_workspace_memberships_workspace_id"),
        "workspace_memberships",
        ["workspace_id"],
        unique=False,
    )

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("active_workspace_id", sa.Uuid(), nullable=True),
        sa.Column("token_hash", sa.LargeBinary(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "octet_length(token_hash) = 32", name="ck_auth_sessions_token_hash_sha256"
        ),
        sa.ForeignKeyConstraint(
            ["active_workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_auth_sessions_active_workspace_id_workspaces"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_auth_sessions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_auth_sessions")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_auth_sessions_token_hash")),
    )
    op.create_index(
        op.f("ix_auth_sessions_active_workspace_id"),
        "auth_sessions",
        ["active_workspace_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_auth_sessions_expires_at"),
        "auth_sessions",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_auth_sessions_user_id"), "auth_sessions", ["user_id"], unique=False
    )

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "octet_length(token_hash) = 32",
            name="ck_password_reset_tokens_token_hash_sha256",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_password_reset_tokens_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_password_reset_tokens")),
        sa.UniqueConstraint(
            "token_hash", name=op.f("uq_password_reset_tokens_token_hash")
        ),
    )
    op.create_index(
        op.f("ix_password_reset_tokens_expires_at"),
        "password_reset_tokens",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_password_reset_tokens_user_id"),
        "password_reset_tokens",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "workspace_slug_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column(
            "retired_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_workspace_slug_history_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workspace_slug_history")),
        sa.UniqueConstraint("slug", name=op.f("uq_workspace_slug_history_slug")),
    )
    op.create_index(
        op.f("ix_workspace_slug_history_workspace_id"),
        "workspace_slug_history",
        ["workspace_id"],
        unique=False,
    )

    op.create_table(
        "reserved_workspace_slugs",
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("reason", sa.String(length=160), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'",
            name="ck_reserved_workspace_slugs_slug_format",
        ),
        sa.PrimaryKeyConstraint("slug", name=op.f("pk_reserved_workspace_slugs")),
    )

    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("resource_type", sa.String(length=80), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=True),
        sa.Column(
            "details",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name=op.f("fk_audit_events_actor_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_audit_events_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_events")),
    )
    op.create_index(
        op.f("ix_audit_events_action"), "audit_events", ["action"], unique=False
    )
    op.create_index(
        op.f("ix_audit_events_actor_user_id"),
        "audit_events",
        ["actor_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_audit_events_occurred_at"),
        "audit_events",
        ["occurred_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_audit_events_workspace_id"),
        "audit_events",
        ["workspace_id"],
        unique=False,
    )

    op.execute(
        """
        CREATE FUNCTION public.slotera_current_workspace_id()
        RETURNS uuid
        LANGUAGE sql
        STABLE
        PARALLEL SAFE
        AS $$
          SELECT NULLIF(pg_catalog.current_setting('app.current_workspace_id', true), '')::uuid
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION public.slotera_current_workspace_id() FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION public.slotera_current_workspace_id() TO slotera_app")

    for table_name in (
        "workspaces",
        "workspace_memberships",
        "workspace_slug_history",
        "audit_events",
    ):
        op.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY")

    op.execute(
        """
        CREATE POLICY workspaces_select ON workspaces FOR SELECT TO slotera_app
        USING (id = public.slotera_current_workspace_id())
        """
    )
    op.execute(
        """
        CREATE POLICY workspaces_insert ON workspaces FOR INSERT TO slotera_app
        WITH CHECK (id = public.slotera_current_workspace_id())
        """
    )
    op.execute(
        """
        CREATE POLICY workspaces_update ON workspaces FOR UPDATE TO slotera_app
        USING (id = public.slotera_current_workspace_id())
        WITH CHECK (id = public.slotera_current_workspace_id())
        """
    )

    for table_name in ("workspace_memberships",):
        op.execute(
            f"""
            CREATE POLICY {table_name}_select ON {table_name} FOR SELECT TO slotera_app
            USING (workspace_id = public.slotera_current_workspace_id())
            """
        )
        op.execute(
            f"""
            CREATE POLICY {table_name}_insert ON {table_name} FOR INSERT TO slotera_app
            WITH CHECK (workspace_id = public.slotera_current_workspace_id())
            """
        )
        op.execute(
            f"""
            CREATE POLICY {table_name}_update ON {table_name} FOR UPDATE TO slotera_app
            USING (workspace_id = public.slotera_current_workspace_id())
            WITH CHECK (workspace_id = public.slotera_current_workspace_id())
            """
        )
        op.execute(
            f"""
            CREATE POLICY {table_name}_delete ON {table_name} FOR DELETE TO slotera_app
            USING (workspace_id = public.slotera_current_workspace_id())
            """
        )

    for table_name in ("workspace_slug_history", "audit_events"):
        op.execute(
            f"""
            CREATE POLICY {table_name}_select ON {table_name} FOR SELECT TO slotera_app
            USING (workspace_id = public.slotera_current_workspace_id())
            """
        )
        op.execute(
            f"""
            CREATE POLICY {table_name}_insert ON {table_name} FOR INSERT TO slotera_app
            WITH CHECK (workspace_id = public.slotera_current_workspace_id())
            """
        )

    op.execute(
        "REVOKE ALL PRIVILEGES ON users, auth_sessions, password_reset_tokens FROM slotera_app"
    )
    op.execute(
        "REVOKE INSERT, UPDATE, DELETE ON reserved_workspace_slugs FROM slotera_app"
    )


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("reserved_workspace_slugs")
    op.drop_table("workspace_slug_history")
    op.drop_table("password_reset_tokens")
    op.drop_table("auth_sessions")
    op.drop_table("workspace_memberships")
    op.drop_table("workspaces")
    op.drop_table("users")
    op.execute("DROP FUNCTION public.slotera_current_workspace_id()")
    membership_role.drop(op.get_bind(), checkfirst=True)
    platform_role.drop(op.get_bind(), checkfirst=True)
