"""Two paid tiers with a trial: Essentials and Professional, monthly or yearly.

- `workspaces.plan` becomes `essentials | professional` (free→essentials, pro→professional).
- `billing_interval` (`monthly | yearly`), `trial_ends_at` (30 days from creation) and
  `paid_through` record what Slotera staff invoiced by hand. Nothing locks a workspace
  automatically; suspension stays a separate, manual superadmin command.
- `slotera_platform_set_workspace_billing` replaces `slotera_platform_set_workspace_plan`
  and audits every field it changes.

Revision ID: 20261011_0029
Revises: 20261010_0028
Create Date: 2026-10-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261011_0029"
down_revision: str | None = "20261010_0028"
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

_BILLING_RETURNS = """
    billing_interval text,
    trial_ends_at timestamptz,
    paid_through date,
"""
_BILLING_SELECT = """
      w.billing_interval::text,
      w.trial_ends_at,
      w.paid_through,
"""

# Same shape as 20261009_0025, optionally with the billing fields after `plan`.
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
    plan text,{billing}
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
      w.plan::text,{billing}
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


def _create_read_functions(*, include_billing: bool) -> None:
    returns = _RETURNS.format(billing=_BILLING_RETURNS.rstrip() if include_billing else "")
    select = _SELECT.format(billing=_BILLING_SELECT.rstrip() if include_billing else "")
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


def _create_overview(*, tiers: bool) -> None:
    if tiers:
        plan_columns = """
          workspaces_essentials integer,
          workspaces_professional integer,
          workspaces_on_trial integer,"""
        plan_counts = """
            (SELECT count(*) FROM public.workspaces WHERE plan = 'essentials')::integer,
            (SELECT count(*) FROM public.workspaces WHERE plan = 'professional')::integer,
            (SELECT count(*) FROM public.workspaces
               WHERE paid_through IS NULL
                 AND trial_ends_at > statement_timestamp())::integer,"""
    else:
        plan_columns = """
          workspaces_free integer,
          workspaces_pro integer,"""
        plan_counts = """
            (SELECT count(*) FROM public.workspaces WHERE plan = 'free')::integer,
            (SELECT count(*) FROM public.workspaces WHERE plan = 'pro')::integer,"""
    op.execute(
        f"""
        CREATE FUNCTION public.slotera_platform_overview(p_actor_user_id uuid)
        RETURNS TABLE (
          workspaces_total integer,
          workspaces_active integer,
          workspaces_suspended integer,{plan_columns}
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
               WHERE operational_status::text = 'suspended')::integer,{plan_counts}
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


_SET_PLAN_SIGNATURE = "public.slotera_platform_set_workspace_plan(uuid, uuid, text, uuid)"
_SET_BILLING_SIGNATURE = (
    "public.slotera_platform_set_workspace_billing(uuid, uuid, text, text, timestamptz, date, uuid)"
)


def _create_set_plan(*, plans: tuple[str, str]) -> None:
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
          IF p_plan NOT IN ('{plans[0]}', '{plans[1]}') THEN
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
    _protect(_SET_PLAN_SIGNATURE)


def upgrade() -> None:
    op.drop_constraint("ck_workspaces_plan", "workspaces", type_="check")
    op.execute(
        "UPDATE workspaces SET plan = CASE plan WHEN 'pro' THEN 'professional' "
        "ELSE 'essentials' END"
    )
    op.alter_column("workspaces", "plan", server_default=sa.text("'essentials'"))
    op.create_check_constraint(
        "ck_workspaces_plan", "workspaces", "plan IN ('essentials', 'professional')"
    )
    op.add_column(
        "workspaces",
        sa.Column(
            "billing_interval", sa.String(16), server_default=sa.text("'monthly'"), nullable=False
        ),
    )
    op.create_check_constraint(
        "ck_workspaces_billing_interval", "workspaces", "billing_interval IN ('monthly', 'yearly')"
    )
    op.add_column("workspaces", sa.Column("trial_ends_at", sa.DateTime(timezone=True)))
    op.execute("UPDATE workspaces SET trial_ends_at = created_at + interval '30 days'")
    op.alter_column(
        "workspaces",
        "trial_ends_at",
        nullable=False,
        server_default=sa.text("now() + interval '30 days'"),
    )
    op.add_column("workspaces", sa.Column("paid_through", sa.Date(), nullable=True))

    op.execute(f"DROP FUNCTION {_SET_PLAN_SIGNATURE}")
    op.execute(
        f"""
        CREATE FUNCTION public.slotera_platform_set_workspace_billing(
          p_workspace_id uuid,
          p_actor_user_id uuid,
          p_plan text,
          p_billing_interval text,
          p_trial_ends_at timestamptz,
          p_paid_through date,
          p_audit_event_id uuid
        )
        RETURNS text
        LANGUAGE plpgsql VOLATILE SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          current public.workspaces%ROWTYPE;
        BEGIN
          {_SUPERADMIN_CHECK}
          IF p_plan NOT IN ('essentials', 'professional') THEN
            RETURN 'invalid_plan';
          END IF;
          IF p_billing_interval NOT IN ('monthly', 'yearly') THEN
            RETURN 'invalid_billing_interval';
          END IF;
          SELECT * INTO current FROM public.workspaces
          WHERE id = p_workspace_id FOR UPDATE;
          IF NOT FOUND THEN
            RETURN 'workspace_not_found';
          END IF;
          IF current.plan = p_plan
             AND current.billing_interval = p_billing_interval
             AND current.trial_ends_at = p_trial_ends_at
             AND current.paid_through IS NOT DISTINCT FROM p_paid_through THEN
            RETURN 'unchanged';
          END IF;
          UPDATE public.workspaces
          SET plan = p_plan,
              plan_changed_at = CASE WHEN plan <> p_plan
                                     THEN statement_timestamp() ELSE plan_changed_at END,
              billing_interval = p_billing_interval,
              trial_ends_at = p_trial_ends_at,
              paid_through = p_paid_through,
              updated_at = statement_timestamp()
          WHERE id = p_workspace_id;
          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          ) VALUES (
            p_audit_event_id, p_workspace_id, p_actor_user_id,
            'platform.workspace_billing_changed', 'workspace', p_workspace_id,
            jsonb_build_object(
              'from', jsonb_build_object(
                'plan', current.plan, 'billingInterval', current.billing_interval,
                'trialEndsAt', current.trial_ends_at, 'paidThrough', current.paid_through
              ),
              'to', jsonb_build_object(
                'plan', p_plan, 'billingInterval', p_billing_interval,
                'trialEndsAt', p_trial_ends_at, 'paidThrough', p_paid_through
              )
            )
          );
          RETURN 'updated';
        END
        $$
        """
    )
    _protect(_SET_BILLING_SIGNATURE)

    _drop_read_functions()
    _create_read_functions(include_billing=True)
    op.execute("DROP FUNCTION public.slotera_platform_overview(uuid)")
    _create_overview(tiers=True)


def downgrade() -> None:
    op.execute("DROP FUNCTION public.slotera_platform_overview(uuid)")
    _drop_read_functions()
    op.execute(f"DROP FUNCTION {_SET_BILLING_SIGNATURE}")
    op.drop_column("workspaces", "paid_through")
    op.drop_column("workspaces", "trial_ends_at")
    op.drop_constraint("ck_workspaces_billing_interval", "workspaces", type_="check")
    op.drop_column("workspaces", "billing_interval")
    op.drop_constraint("ck_workspaces_plan", "workspaces", type_="check")
    op.execute(
        "UPDATE workspaces SET plan = CASE plan WHEN 'professional' THEN 'pro' ELSE 'free' END"
    )
    op.alter_column("workspaces", "plan", server_default=sa.text("'free'"))
    op.create_check_constraint("ck_workspaces_plan", "workspaces", "plan IN ('free', 'pro')")
    _create_set_plan(plans=("free", "pro"))
    _create_read_functions(include_billing=False)
    _create_overview(tiers=False)
