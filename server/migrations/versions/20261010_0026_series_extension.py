"""List recurring series whose materialised horizon needs topping up.

The maintenance job extends each listed series under its own tenant context; this
function only crosses tenants to find them, and returns identifiers alone.

Revision ID: 20261010_0026
Revises: 20261009_0025
Create Date: 2026-10-10
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261010_0026"
down_revision: str | None = "20261009_0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION public.slotera_series_due_extension(p_horizon_days integer)
        RETURNS TABLE (workspace_id uuid, series_id uuid)
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          SELECT series.workspace_id, series.id
          FROM public.session_series AS series
          WHERE series.horizon_through
                < (statement_timestamp() AT TIME ZONE series.timezone)::date + p_horizon_days
            AND (series.ends_on IS NULL OR series.horizon_through < series.ends_on)
          ORDER BY series.horizon_through
          LIMIT 500
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION public.slotera_series_due_extension(integer) FROM PUBLIC")
    op.execute(
        "GRANT EXECUTE ON FUNCTION public.slotera_series_due_extension(integer) TO slotera_app"
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION public.slotera_series_due_extension(integer)")
