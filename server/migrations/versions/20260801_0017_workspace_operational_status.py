"""Add audited workspace suspension and authentication enforcement.

Revision ID: 20260801_0017
Revises: 20260731_0016
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260801_0017"
down_revision: str | None = "20260731_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


workspace_operational_status = postgresql.ENUM(
    "active",
    "suspended",
    name="workspace_operational_status",
    create_type=False,
)

_PLATFORM_RETURNS = """
    id uuid,
    name text,
    slug text,
    owner_name text,
    owner_email text,
    created_at timestamptz,
    currency text,
    timezone text,
    operational_status text,
    services_count integer,
    clients_count integer,
    bookings_count integer,
    sessions_count integer
"""

_PLATFORM_SELECT = """
    SELECT
      w.id,
      w.name::text,
      w.slug::text,
      owner.owner_name,
      owner.owner_email,
      w.created_at,
      w.currency::text,
      w.timezone::text,
      w.operational_status::text,
      service_facts.services_count,
      client_facts.clients_count,
      booking_facts.bookings_count,
      session_facts.sessions_count
    FROM public.workspaces AS w
    LEFT JOIN LATERAL (
      SELECT
        concat_ws(' ', u.first_names, u.last_name)::text AS owner_name,
        u.email::text AS owner_email
      FROM public.workspace_memberships AS membership
      JOIN public.users AS u ON u.id = membership.user_id
      WHERE membership.workspace_id = w.id
      ORDER BY membership.created_at, membership.id
      LIMIT 1
    ) AS owner ON true
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS services_count
      FROM public.services AS service
      WHERE service.workspace_id = w.id
    ) AS service_facts
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS clients_count
      FROM public.clients AS client
      WHERE client.workspace_id = w.id
    ) AS client_facts
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS bookings_count
      FROM public.bookings AS booking
      WHERE booking.workspace_id = w.id
    ) AS booking_facts
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS sessions_count
      FROM public.sessions AS session_item
      WHERE session_item.workspace_id = w.id
    ) AS session_facts
"""

_LEGACY_PLATFORM_RETURNS = """
    id uuid,
    name text,
    slug text,
    owner_name text,
    owner_email text,
    created_at timestamptz,
    currency text,
    timezone text,
    services_count integer,
    clients_count integer,
    bookings_count integer,
    sessions_count integer
"""

_LEGACY_PLATFORM_SELECT = _PLATFORM_SELECT.replace("      w.operational_status::text,\n", "")


def _create_platform_read_functions(*, include_status: bool) -> None:
    returns = _PLATFORM_RETURNS if include_status else _LEGACY_PLATFORM_RETURNS
    select = _PLATFORM_SELECT if include_status else _LEGACY_PLATFORM_SELECT
    op.execute(
        f"""
        CREATE FUNCTION public.slotera_platform_list_workspaces(
          p_limit integer DEFAULT 100,
          p_offset integer DEFAULT 0
        )
        RETURNS TABLE ({returns})
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          {select}
          ORDER BY w.created_at DESC, w.id DESC
          LIMIT LEAST(GREATEST(p_limit, 1), 200)
          OFFSET GREATEST(p_offset, 0)
        $$;
        """
    )
    op.execute(
        f"""
        CREATE FUNCTION public.slotera_platform_get_workspace(p_workspace_id uuid)
        RETURNS TABLE ({returns})
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          {select}
          WHERE w.id = p_workspace_id
        $$;
        """
    )
    for signature in (
        "public.slotera_platform_list_workspaces(integer, integer)",
        "public.slotera_platform_get_workspace(uuid)",
    ):
        op.execute(f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC")
        op.execute(f"GRANT EXECUTE ON FUNCTION {signature} TO slotera_app")


def _create_auth_functions(*, enforce_workspace_status: bool) -> None:
    status_return = (
        "          workspace_operational_status text,\n" if enforce_workspace_status else ""
    )
    status_select = "            w.operational_status::text,\n" if enforce_workspace_status else ""
    active_membership_check = (
        "\n                AND EXISTS (\n"
        "                  SELECT 1 FROM public.workspaces AS w\n"
        "                  WHERE w.id = p_workspace_id\n"
        "                    AND w.operational_status::text = 'active'\n"
        "                )"
        if enforce_workspace_status
        else ""
    )
    active_session_check = (
        "\n                AND w.operational_status::text = 'active'"
        if enforce_workspace_status
        else ""
    )

    op.execute(
        f"""
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
{status_return}          membership_role text
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
{status_select}            m.role::text
          FROM public.users AS u
          LEFT JOIN public.workspace_memberships AS m ON m.user_id = u.id
          LEFT JOIN public.workspaces AS w ON w.id = m.workspace_id
          WHERE u.email = lower(btrim(p_email))
          ORDER BY m.created_at NULLS FIRST
        $$
        """
    )
    op.execute(
        f"""
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
                AND m.role::text = 'operator_admin'{active_membership_check}
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
        f"""
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
                AND m.role::text = 'operator_admin'{active_session_check}
              )
            )
        $$
        """
    )
    for signature in (
        "public.slotera_auth_login_identity(text)",
        "public.slotera_auth_create_session(uuid, uuid, uuid, bytea, bytea, timestamptz)",
        "public.slotera_auth_session(bytea)",
    ):
        op.execute(f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC")
        op.execute(f"GRANT EXECUTE ON FUNCTION {signature} TO slotera_app")


def upgrade() -> None:
    workspace_operational_status.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "workspaces",
        sa.Column(
            "operational_status",
            workspace_operational_status,
            server_default="active",
            nullable=False,
        ),
    )

    op.execute("DROP FUNCTION public.slotera_platform_get_workspace(uuid)")
    op.execute("DROP FUNCTION public.slotera_platform_list_workspaces(integer, integer)")
    _create_platform_read_functions(include_status=True)

    op.execute("DROP FUNCTION public.slotera_auth_session(bytea)")
    op.execute(
        "DROP FUNCTION public.slotera_auth_create_session"
        "(uuid, uuid, uuid, bytea, bytea, timestamptz)"
    )
    op.execute("DROP FUNCTION public.slotera_auth_login_identity(text)")
    _create_auth_functions(enforce_workspace_status=True)

    op.execute(
        """
        CREATE FUNCTION public.slotera_platform_set_workspace_operational_status(
          p_workspace_id uuid,
          p_actor_user_id uuid,
          p_operational_status text,
          p_audit_event_id uuid
        )
        RETURNS text
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          current_status text;
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM public.users
            WHERE id = p_actor_user_id
              AND platform_role::text = 'superadmin'
          ) THEN
            RETURN 'actor_not_superadmin';
          END IF;

          IF p_operational_status NOT IN ('active', 'suspended') THEN
            RETURN 'invalid_status';
          END IF;

          SELECT operational_status::text
          INTO current_status
          FROM public.workspaces
          WHERE id = p_workspace_id
          FOR UPDATE;

          IF NOT FOUND THEN
            RETURN 'workspace_not_found';
          END IF;

          IF current_status = p_operational_status THEN
            RETURN 'unchanged';
          END IF;

          UPDATE public.workspaces
          SET operational_status = p_operational_status::public.workspace_operational_status,
              updated_at = statement_timestamp()
          WHERE id = p_workspace_id;

          IF p_operational_status = 'suspended' THEN
            UPDATE public.auth_sessions
            SET revoked_at = statement_timestamp()
            WHERE active_workspace_id = p_workspace_id
              AND revoked_at IS NULL;
          END IF;

          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          )
          VALUES (
            p_audit_event_id,
            p_workspace_id,
            p_actor_user_id,
            CASE p_operational_status
              WHEN 'suspended' THEN 'platform.workspace_suspended'
              ELSE 'platform.workspace_reactivated'
            END,
            'workspace',
            p_workspace_id,
            '{}'::jsonb
          );

          RETURN 'updated';
        END
        $$
        """
    )
    signature = "public.slotera_platform_set_workspace_operational_status(uuid, uuid, text, uuid)"
    op.execute(f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {signature} TO slotera_app")
    op.execute("REVOKE UPDATE ON public.workspaces FROM slotera_app")


def downgrade() -> None:
    op.execute(
        "DROP FUNCTION public.slotera_platform_set_workspace_operational_status"
        "(uuid, uuid, text, uuid)"
    )

    op.execute("DROP FUNCTION public.slotera_auth_session(bytea)")
    op.execute(
        "DROP FUNCTION public.slotera_auth_create_session"
        "(uuid, uuid, uuid, bytea, bytea, timestamptz)"
    )
    op.execute("DROP FUNCTION public.slotera_auth_login_identity(text)")
    _create_auth_functions(enforce_workspace_status=False)

    op.execute("DROP FUNCTION public.slotera_platform_get_workspace(uuid)")
    op.execute("DROP FUNCTION public.slotera_platform_list_workspaces(integer, integer)")
    _create_platform_read_functions(include_status=False)

    op.execute("GRANT UPDATE ON public.workspaces TO slotera_app")
    op.drop_column("workspaces", "operational_status")
    workspace_operational_status.drop(op.get_bind(), checkfirst=True)
