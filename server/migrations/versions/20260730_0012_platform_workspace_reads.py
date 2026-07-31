"""Add narrow platform workspace read projections.

Revision ID: 20260730_0012
Revises: 20260729_0011
Create Date: 2026-07-30
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260730_0012"
down_revision: str | None = "20260729_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_RETURNS = """
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


def upgrade() -> None:
    op.execute(
        f"""
        CREATE FUNCTION public.slotera_platform_list_workspaces(
          p_limit integer DEFAULT 100,
          p_offset integer DEFAULT 0
        )
        RETURNS TABLE ({_RETURNS})
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          {_SELECT}
          ORDER BY w.created_at DESC, w.id DESC
          LIMIT LEAST(GREATEST(p_limit, 1), 200)
          OFFSET GREATEST(p_offset, 0)
        $$;
        """
    )
    op.execute(
        f"""
        CREATE FUNCTION public.slotera_platform_get_workspace(p_workspace_id uuid)
        RETURNS TABLE ({_RETURNS})
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          {_SELECT}
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


def downgrade() -> None:
    op.execute("DROP FUNCTION public.slotera_platform_get_workspace(uuid)")
    op.execute("DROP FUNCTION public.slotera_platform_list_workspaces(integer, integer)")
