"""Add platform plans, persisted inquiries, and the platform overview.

- `workspaces.plan` (`free | pro`): changed only through an audited superadmin command.
  No subscription state machine: Free is the trial, Pro is invoiced manually until
  Stripe Billing exists.
- `platform_inquiries`: contact-form submissions. Global (not tenant) data, reachable only
  through the fixed functions below; the runtime role has no table privileges.
- `slotera_platform_overview`: aggregate counts for the superadmin home.

Revision ID: 20261009_0025
Revises: 20261009_0024
Create Date: 2026-10-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261009_0025"
down_revision: str | None = "20261009_0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _protect(signature: str) -> None:
    op.execute(f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {signature} TO slotera_app")


_SUPERADMIN_CHECK = """
          IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor_user_id AND platform_role::text = 'superadmin'
          ) THEN
            RETURN 'actor_not_superadmin';
          END IF;
"""

_RETURNS = """
    id uuid,
    name text,
    slug text,
    owner_name text,
    owner_email text,
    created_at timestamptz,
    currency text,
    timezone text,
    operational_status text,
    plan text,
    services_count integer,
    clients_count integer,
    bookings_count integer,
    sessions_count integer
"""

_SELECT = """
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
      w.plan::text,
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
      FROM public.services AS service WHERE service.workspace_id = w.id
    ) AS service_facts
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS clients_count
      FROM public.clients AS client WHERE client.workspace_id = w.id
    ) AS client_facts
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS bookings_count
      FROM public.bookings AS booking WHERE booking.workspace_id = w.id
    ) AS booking_facts
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS sessions_count
      FROM public.sessions AS session_item WHERE session_item.workspace_id = w.id
    ) AS session_facts
"""


def _create_read_functions(*, include_plan: bool) -> None:
    returns = _RETURNS if include_plan else _RETURNS.replace("    plan text,\n", "")
    select = _SELECT if include_plan else _SELECT.replace("      w.plan::text,\n", "")
    op.execute(
        f"""
        CREATE FUNCTION public.slotera_platform_list_workspaces(
          p_limit integer DEFAULT 100,
          p_offset integer DEFAULT 0
        )
        RETURNS TABLE ({returns})
        LANGUAGE sql STABLE SECURITY DEFINER
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
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          {select}
          WHERE w.id = p_workspace_id
        $$;
        """
    )
    _protect("public.slotera_platform_list_workspaces(integer, integer)")
    _protect("public.slotera_platform_get_workspace(uuid)")


def _drop_read_functions() -> None:
    op.execute("DROP FUNCTION public.slotera_platform_list_workspaces(integer, integer)")
    op.execute("DROP FUNCTION public.slotera_platform_get_workspace(uuid)")


def upgrade() -> None:
    op.add_column(
        "workspaces",
        sa.Column("plan", sa.String(16), server_default=sa.text("'free'"), nullable=False),
    )
    op.add_column(
        "workspaces", sa.Column("plan_changed_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_check_constraint("ck_workspaces_plan", "workspaces", "plan IN ('free', 'pro')")
    _drop_read_functions()
    _create_read_functions(include_plan=True)

    op.execute(
        f"""
        CREATE FUNCTION public.slotera_platform_set_workspace_plan(
          p_workspace_id uuid,
          p_actor_user_id uuid,
          p_plan text,
          p_audit_event_id uuid
        )
        RETURNS text
        LANGUAGE plpgsql VOLATILE SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          current_plan text;
        BEGIN
          {_SUPERADMIN_CHECK}
          IF p_plan NOT IN ('free', 'pro') THEN
            RETURN 'invalid_plan';
          END IF;
          SELECT plan INTO current_plan FROM public.workspaces
          WHERE id = p_workspace_id FOR UPDATE;
          IF NOT FOUND THEN
            RETURN 'workspace_not_found';
          END IF;
          IF current_plan = p_plan THEN
            RETURN 'unchanged';
          END IF;
          UPDATE public.workspaces
          SET plan = p_plan, plan_changed_at = statement_timestamp(),
              updated_at = statement_timestamp()
          WHERE id = p_workspace_id;
          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          ) VALUES (
            p_audit_event_id, p_workspace_id, p_actor_user_id, 'platform.workspace_plan_changed',
            'workspace', p_workspace_id, jsonb_build_object('from', current_plan, 'to', p_plan)
          );
          RETURN 'updated';
        END
        $$
        """
    )
    _protect("public.slotera_platform_set_workspace_plan(uuid, uuid, text, uuid)")

    op.create_table(
        "platform_inquiries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("company", sa.String(160), nullable=True),
        sa.Column("reason", sa.String(32), nullable=False),
        sa.Column("message", sa.String(4000), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute("REVOKE ALL ON TABLE platform_inquiries FROM slotera_app")

    op.execute(
        """
        CREATE FUNCTION public.slotera_public_create_inquiry(
          p_id uuid, p_name text, p_email text, p_company text, p_reason text, p_message text
        )
        RETURNS boolean
        LANGUAGE sql VOLATILE SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          INSERT INTO public.platform_inquiries (id, name, email, company, reason, message)
          VALUES (p_id, p_name, lower(btrim(p_email)), NULLIF(btrim(p_company), ''),
                  p_reason, p_message)
          RETURNING true
        $$
        """
    )
    _protect("public.slotera_public_create_inquiry(uuid, text, text, text, text, text)")

    op.execute(
        """
        CREATE FUNCTION public.slotera_platform_list_inquiries(p_actor_user_id uuid)
        RETURNS TABLE (
          id uuid, name text, email text, company text, reason text, message text,
          created_at timestamptz, read_at timestamptz
        )
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          SELECT i.id, i.name::text, i.email::text, i.company::text, i.reason::text,
                 i.message::text, i.created_at, i.read_at
          FROM public.platform_inquiries AS i
          WHERE EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor_user_id AND platform_role::text = 'superadmin'
          )
          ORDER BY i.created_at DESC
          LIMIT 500
        $$
        """
    )
    _protect("public.slotera_platform_list_inquiries(uuid)")

    op.execute(
        f"""
        CREATE FUNCTION public.slotera_platform_mark_inquiry_read(
          p_actor_user_id uuid, p_inquiry_id uuid, p_read boolean
        )
        RETURNS text
        LANGUAGE plpgsql VOLATILE SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        BEGIN
          {_SUPERADMIN_CHECK}
          UPDATE public.platform_inquiries
          SET read_at = CASE WHEN p_read THEN COALESCE(read_at, statement_timestamp()) END
          WHERE id = p_inquiry_id;
          RETURN CASE WHEN FOUND THEN 'updated' ELSE 'inquiry_not_found' END;
        END
        $$
        """
    )
    _protect("public.slotera_platform_mark_inquiry_read(uuid, uuid, boolean)")

    op.execute(
        """
        CREATE FUNCTION public.slotera_platform_overview(p_actor_user_id uuid)
        RETURNS TABLE (
          workspaces_total integer,
          workspaces_active integer,
          workspaces_suspended integer,
          workspaces_free integer,
          workspaces_pro integer,
          signups_30d integer,
          bookings_30d integer,
          inquiries_unread integer
        )
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          SELECT
            (SELECT count(*) FROM public.workspaces)::integer,
            (SELECT count(*) FROM public.workspaces
               WHERE operational_status::text = 'active')::integer,
            (SELECT count(*) FROM public.workspaces
               WHERE operational_status::text = 'suspended')::integer,
            (SELECT count(*) FROM public.workspaces WHERE plan = 'free')::integer,
            (SELECT count(*) FROM public.workspaces WHERE plan = 'pro')::integer,
            (SELECT count(*) FROM public.workspaces
               WHERE created_at > statement_timestamp() - interval '30 days')::integer,
            (SELECT count(*) FROM public.bookings
               WHERE created_at > statement_timestamp() - interval '30 days')::integer,
            (SELECT count(*) FROM public.platform_inquiries WHERE read_at IS NULL)::integer
          WHERE EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor_user_id AND platform_role::text = 'superadmin'
          )
        $$
        """
    )
    _protect("public.slotera_platform_overview(uuid)")


def downgrade() -> None:
    op.execute("DROP FUNCTION public.slotera_platform_overview(uuid)")
    op.execute("DROP FUNCTION public.slotera_platform_mark_inquiry_read(uuid, uuid, boolean)")
    op.execute("DROP FUNCTION public.slotera_platform_list_inquiries(uuid)")
    op.execute(
        "DROP FUNCTION public.slotera_public_create_inquiry(uuid, text, text, text, text, text)"
    )
    op.drop_table("platform_inquiries")
    op.execute("DROP FUNCTION public.slotera_platform_set_workspace_plan(uuid, uuid, text, uuid)")
    _drop_read_functions()
    _create_read_functions(include_plan=False)
    op.drop_constraint("ck_workspaces_plan", "workspaces", type_="check")
    op.drop_column("workspaces", "plan_changed_at")
    op.drop_column("workspaces", "plan")
