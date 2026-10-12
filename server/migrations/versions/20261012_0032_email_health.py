"""Email delivery health on the superadmin overview.

`slotera_platform_overview` gains three columns about the email outbox:
- `emails_pending`: messages not sent yet (queued or waiting to retry);
- `emails_failing`: unsent messages that have failed at least once;
- `email_last_error`: the newest such failure. The worker stores only the exception
  class plus a provider's status and error category there, never message content.

Revision ID: 20261012_0032
Revises: 20261011_0031
Create Date: 2026-10-12
"""

import importlib.util
from collections.abc import Sequence
from pathlib import Path
from types import ModuleType

from alembic import op

revision: str = "20261012_0032"
down_revision: str | None = "20261011_0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SIGNATURE = "public.slotera_platform_overview(uuid)"


def _migration_0029() -> ModuleType:
    path = Path(__file__).with_name("20261011_0029_plan_tiers.py")
    spec = importlib.util.spec_from_file_location("slotera_migration_0029", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def upgrade() -> None:
    op.execute(f"DROP FUNCTION {_SIGNATURE}")
    op.execute(
        """
        CREATE FUNCTION public.slotera_platform_overview(p_actor_user_id uuid)
        RETURNS TABLE (
          workspaces_total integer,
          workspaces_active integer,
          workspaces_suspended integer,
          workspaces_essentials integer,
          workspaces_professional integer,
          workspaces_on_trial integer,
          signups_30d integer,
          bookings_30d integer,
          inquiries_unread integer,
          emails_pending integer,
          emails_failing integer,
          email_last_error text
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
            (SELECT count(*) FROM public.workspaces WHERE plan = 'essentials')::integer,
            (SELECT count(*) FROM public.workspaces WHERE plan = 'professional')::integer,
            (SELECT count(*) FROM public.workspaces
               WHERE paid_through IS NULL
                 AND trial_ends_at > statement_timestamp())::integer,
            (SELECT count(*) FROM public.workspaces
               WHERE created_at > statement_timestamp() - interval '30 days')::integer,
            (SELECT count(*) FROM public.bookings
               WHERE created_at > statement_timestamp() - interval '30 days')::integer,
            (SELECT count(*) FROM public.platform_inquiries WHERE read_at IS NULL)::integer,
            (SELECT count(*) FROM public.email_outbox WHERE sent_at IS NULL)::integer,
            (SELECT count(*) FROM public.email_outbox
               WHERE sent_at IS NULL AND last_error IS NOT NULL)::integer,
            (SELECT last_error FROM public.email_outbox
               WHERE sent_at IS NULL AND last_error IS NOT NULL
               ORDER BY available_at DESC LIMIT 1)
          WHERE EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor_user_id AND platform_role::text = 'superadmin'
          )
        $$
        """
    )
    _migration_0029()._protect(_SIGNATURE)


def downgrade() -> None:
    op.execute(f"DROP FUNCTION {_SIGNATURE}")
    _migration_0029()._create_overview(tiers=True)
