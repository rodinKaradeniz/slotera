"""Add the narrow HTTP authentication database boundary.

Revision ID: 20260728_0003
Revises: 20260728_0002
Create Date: 2026-07-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260728_0003"
down_revision: str | None = "20260728_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("auth_sessions", sa.Column("csrf_token_hash", sa.LargeBinary()))
    op.execute("DELETE FROM auth_sessions")
    op.alter_column("auth_sessions", "csrf_token_hash", nullable=False)
    op.create_check_constraint(
        op.f("ck_auth_sessions_csrf_token_hash_sha256"),
        "auth_sessions",
        "octet_length(csrf_token_hash) = 32",
    )
    op.create_check_constraint(
        op.f("ck_auth_sessions_expires_after_creation"),
        "auth_sessions",
        "expires_at > created_at",
    )

    op.execute(
        """
        CREATE FUNCTION public.slotera_auth_login_identity(p_email text)
        RETURNS TABLE (
          user_id uuid,
          email text,
          title text,
          first_names text,
          last_name text,
          password_hash text,
          platform_role text,
          workspace_id uuid,
          workspace_name text,
          workspace_slug text,
          membership_role text
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog
        AS $$
          SELECT
            u.id,
            u.email::text,
            u.title::text,
            u.first_names::text,
            u.last_name::text,
            u.password_hash::text,
            u.platform_role::text,
            m.workspace_id,
            w.name::text,
            w.slug::text,
            m.role::text
          FROM public.users AS u
          LEFT JOIN public.workspace_memberships AS m ON m.user_id = u.id
          LEFT JOIN public.workspaces AS w ON w.id = m.workspace_id
          WHERE u.email = lower(btrim(p_email))
          ORDER BY m.created_at NULLS FIRST
        $$
        """
    )

    op.execute(
        """
        CREATE FUNCTION public.slotera_auth_create_session(
          p_session_id uuid,
          p_user_id uuid,
          p_workspace_id uuid,
          p_token_hash bytea,
          p_csrf_token_hash bytea,
          p_expires_at timestamptz
        )
        RETURNS boolean
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog
        AS $$
        DECLARE
          identity_is_valid boolean;
        BEGIN
          SELECT CASE
            WHEN u.platform_role::text = 'superadmin' THEN p_workspace_id IS NULL
            WHEN u.platform_role IS NULL AND p_workspace_id IS NOT NULL THEN EXISTS (
              SELECT 1
              FROM public.workspace_memberships AS m
              WHERE m.user_id = u.id
                AND m.workspace_id = p_workspace_id
                AND m.role::text = 'operator_admin'
            )
            ELSE false
          END
          INTO identity_is_valid
          FROM public.users AS u
          WHERE u.id = p_user_id;

          IF identity_is_valid IS NOT TRUE OR p_expires_at <= statement_timestamp() THEN
            RETURN false;
          END IF;

          INSERT INTO public.auth_sessions (
            id,
            user_id,
            active_workspace_id,
            token_hash,
            csrf_token_hash,
            expires_at
          )
          VALUES (
            p_session_id,
            p_user_id,
            p_workspace_id,
            p_token_hash,
            p_csrf_token_hash,
            p_expires_at
          );
          RETURN true;
        END
        $$
        """
    )

    op.execute(
        """
        CREATE FUNCTION public.slotera_auth_session(p_token_hash bytea)
        RETURNS TABLE (
          session_id uuid,
          user_id uuid,
          email text,
          title text,
          first_names text,
          last_name text,
          role text,
          workspace_id uuid,
          workspace_name text,
          workspace_slug text,
          csrf_token_hash bytea,
          expires_at timestamptz
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog
        AS $$
          SELECT
            s.id,
            u.id,
            u.email::text,
            u.title::text,
            u.first_names::text,
            u.last_name::text,
            COALESCE(u.platform_role::text, m.role::text),
            s.active_workspace_id,
            w.name::text,
            w.slug::text,
            s.csrf_token_hash,
            s.expires_at
          FROM public.auth_sessions AS s
          JOIN public.users AS u ON u.id = s.user_id
          LEFT JOIN public.workspace_memberships AS m
            ON m.user_id = s.user_id
           AND m.workspace_id = s.active_workspace_id
          LEFT JOIN public.workspaces AS w ON w.id = s.active_workspace_id
          WHERE s.token_hash = p_token_hash
            AND s.revoked_at IS NULL
            AND s.expires_at > statement_timestamp()
            AND (
              (u.platform_role::text = 'superadmin' AND s.active_workspace_id IS NULL)
              OR (
                u.platform_role IS NULL
                AND s.active_workspace_id IS NOT NULL
                AND m.role::text = 'operator_admin'
              )
            )
        $$
        """
    )

    op.execute(
        """
        CREATE FUNCTION public.slotera_auth_revoke_session(p_token_hash bytea)
        RETURNS boolean
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog
        AS $$
        BEGIN
          UPDATE public.auth_sessions
          SET revoked_at = statement_timestamp()
          WHERE token_hash = p_token_hash
            AND revoked_at IS NULL;
          RETURN FOUND;
        END
        $$
        """
    )

    for signature in (
        "public.slotera_auth_login_identity(text)",
        "public.slotera_auth_create_session(uuid, uuid, uuid, bytea, bytea, timestamptz)",
        "public.slotera_auth_session(bytea)",
        "public.slotera_auth_revoke_session(bytea)",
    ):
        op.execute(f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC")
        op.execute(f"GRANT EXECUTE ON FUNCTION {signature} TO slotera_app")


def downgrade() -> None:
    op.execute("DROP FUNCTION public.slotera_auth_revoke_session(bytea)")
    op.execute("DROP FUNCTION public.slotera_auth_session(bytea)")
    op.execute(
        "DROP FUNCTION public.slotera_auth_create_session"
        "(uuid, uuid, uuid, bytea, bytea, timestamptz)"
    )
    op.execute("DROP FUNCTION public.slotera_auth_login_identity(text)")
    op.drop_constraint(
        op.f("ck_auth_sessions_expires_after_creation"),
        "auth_sessions",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_auth_sessions_csrf_token_hash_sha256"),
        "auth_sessions",
        type_="check",
    )
    op.drop_column("auth_sessions", "csrf_token_hash")
