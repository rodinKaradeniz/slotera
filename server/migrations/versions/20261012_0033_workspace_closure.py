"""Operators can close their workspace; its data is deleted 30 days later.

- `workspaces.closure_requested_at`: set when the owner closes the workspace.
- `slotera_workspace_request_closure`: the workspace's operator sets it, suspends the
  workspace (booking page offline, every session revoked) and audits it.
- `slotera_platform_cancel_workspace_closure`: superadmin undo within the 30 days; clears
  it and reactivates the workspace.
- `slotera_workspace_purge_closed`: run by the maintenance job. Deletes workspaces that are
  still suspended 30 days after closure, children first (sessions and bookings reference
  each other with RESTRICT), then their queued emails, then users left with no workspace
  and no platform role.
- The platform workspace read functions return `closure_requested_at`.

Revision ID: 20261012_0033
Revises: 20261012_0032
Create Date: 2026-10-12
"""

import importlib.util
from collections.abc import Sequence
from pathlib import Path
from types import ModuleType

import sqlalchemy as sa
from alembic import op

revision: str = "20261012_0033"
down_revision: str | None = "20261012_0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_REQUEST_SIGNATURE = "public.slotera_workspace_request_closure(uuid, uuid, uuid)"
_CANCEL_SIGNATURE = "public.slotera_platform_cancel_workspace_closure(uuid, uuid, uuid)"
_PURGE_SIGNATURE = "public.slotera_workspace_purge_closed(integer)"


def _migration_0029() -> ModuleType:
    path = Path(__file__).with_name("20261011_0029_plan_tiers.py")
    spec = importlib.util.spec_from_file_location("slotera_migration_0029", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _create_read_functions(*, include_closure: bool) -> None:
    module = _migration_0029()
    if include_closure:
        module._BILLING_RETURNS += "    closure_requested_at timestamptz,\n"
        module._BILLING_SELECT += "      w.closure_requested_at,\n"
    module._drop_read_functions()
    module._create_read_functions(include_billing=True)


def upgrade() -> None:
    op.add_column(
        "workspaces",
        sa.Column("closure_requested_at", sa.DateTime(timezone=True), nullable=True),
    )
    _create_read_functions(include_closure=True)
    protect = _migration_0029()._protect

    op.execute(
        """
        CREATE FUNCTION public.slotera_workspace_request_closure(
          p_workspace_id uuid,
          p_actor_user_id uuid,
          p_audit_event_id uuid
        )
        RETURNS text
        LANGUAGE plpgsql VOLATILE SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM public.workspace_memberships
            WHERE workspace_id = p_workspace_id
              AND user_id = p_actor_user_id
              AND role::text = 'operator_admin'
          ) THEN
            RETURN 'actor_not_operator';
          END IF;

          UPDATE public.workspaces
          SET closure_requested_at = statement_timestamp(),
              operational_status = 'suspended',
              updated_at = statement_timestamp()
          WHERE id = p_workspace_id AND closure_requested_at IS NULL;
          IF NOT FOUND THEN
            RETURN 'already_closing';
          END IF;

          UPDATE public.auth_sessions
          SET revoked_at = statement_timestamp()
          WHERE active_workspace_id = p_workspace_id AND revoked_at IS NULL;

          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          )
          VALUES (
            p_audit_event_id, p_workspace_id, p_actor_user_id,
            'workspace.closure_requested', 'workspace', p_workspace_id, '{}'::jsonb
          );
          RETURN 'closing';
        END
        $$
        """
    )
    protect(_REQUEST_SIGNATURE)

    op.execute(
        f"""
        CREATE FUNCTION public.slotera_platform_cancel_workspace_closure(
          p_workspace_id uuid,
          p_actor_user_id uuid,
          p_audit_event_id uuid
        )
        RETURNS text
        LANGUAGE plpgsql VOLATILE SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        BEGIN
          {_migration_0029()._SUPERADMIN_CHECK}
          UPDATE public.workspaces
          SET closure_requested_at = NULL,
              operational_status = 'active',
              updated_at = statement_timestamp()
          WHERE id = p_workspace_id AND closure_requested_at IS NOT NULL;
          IF NOT FOUND THEN
            RETURN 'not_closing';
          END IF;

          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          )
          VALUES (
            p_audit_event_id, p_workspace_id, p_actor_user_id,
            'platform.workspace_closure_cancelled', 'workspace', p_workspace_id, '{{}}'::jsonb
          );
          RETURN 'cancelled';
        END
        $$
        """
    )
    protect(_CANCEL_SIGNATURE)

    op.execute(
        """
        CREATE FUNCTION public.slotera_workspace_purge_closed(p_after_days integer DEFAULT 30)
        RETURNS integer
        LANGUAGE plpgsql VOLATILE SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          target uuid;
          purged integer := 0;
          member_ids uuid[];
        BEGIN
          FOR target IN
            SELECT id FROM public.workspaces
            WHERE closure_requested_at IS NOT NULL
              AND operational_status::text = 'suspended'
              AND closure_requested_at
                < statement_timestamp() - make_interval(days => GREATEST(p_after_days, 1))
            FOR UPDATE SKIP LOCKED
          LOOP
            SELECT coalesce(array_agg(user_id), '{}') INTO member_ids
            FROM public.workspace_memberships WHERE workspace_id = target;

            DELETE FROM public.email_outbox
            WHERE sent_at IS NULL
              AND related_booking_id IN (
                SELECT id FROM public.bookings WHERE workspace_id = target
              );
            DELETE FROM public.booking_command_idempotency WHERE workspace_id = target;
            DELETE FROM public.bookings WHERE workspace_id = target;
            DELETE FROM public.sessions WHERE workspace_id = target;
            DELETE FROM public.form_template_services WHERE workspace_id = target;
            DELETE FROM public.workspaces WHERE id = target;

            DELETE FROM public.users AS u
            WHERE u.id = ANY (member_ids)
              AND u.platform_role IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM public.workspace_memberships AS m WHERE m.user_id = u.id
              );
            purged := purged + 1;
          END LOOP;
          RETURN purged;
        END
        $$
        """
    )
    op.execute(f"REVOKE ALL ON FUNCTION {_PURGE_SIGNATURE} FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {_PURGE_SIGNATURE} TO slotera_app")


def downgrade() -> None:
    op.execute(f"DROP FUNCTION {_PURGE_SIGNATURE}")
    op.execute(f"DROP FUNCTION {_CANCEL_SIGNATURE}")
    op.execute(f"DROP FUNCTION {_REQUEST_SIGNATURE}")
    _create_read_functions(include_closure=False)
    op.drop_column("workspaces", "closure_requested_at")
