"""Let client erasure scrub that client's booking emails from the global outbox.

The runtime role has no outbox privileges, so erasure calls this fixed function. It acts
only on bookings of the current tenant (`app.current_workspace_id`): unsent emails are
deleted, and sent ones keep their row (it stops duplicate reminders) with every personal
field blanked.

Revision ID: 20261010_0028
Revises: 20261010_0027
Create Date: 2026-10-10
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261010_0028"
down_revision: str | None = "20261010_0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SIGNATURE = "public.slotera_client_erase_outbox(uuid)"


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION public.slotera_client_erase_outbox(p_client_id uuid)
        RETURNS integer
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          tenant uuid := public.slotera_current_workspace_id();
          affected integer;
        BEGIN
          IF tenant IS NULL THEN
            RETURN 0;
          END IF;
          WITH client_bookings AS (
            SELECT booking.id FROM public.bookings AS booking
            WHERE booking.workspace_id = tenant AND booking.client_id = p_client_id
          ),
          removed AS (
            DELETE FROM public.email_outbox AS outbox
            USING client_bookings
            WHERE outbox.related_booking_id = client_bookings.id AND outbox.sent_at IS NULL
            RETURNING 1
          ),
          redacted AS (
            UPDATE public.email_outbox AS outbox
            SET recipient_email = 'erased@invalid', subject = '[erased]', text_body = '',
                template_data = '{}'::jsonb, last_error = NULL
            FROM client_bookings
            WHERE outbox.related_booking_id = client_bookings.id
              AND outbox.sent_at IS NOT NULL
            RETURNING 1
          )
          SELECT (SELECT count(*) FROM removed) + (SELECT count(*) FROM redacted)
          INTO affected;
          RETURN affected;
        END
        $$
        """
    )
    op.execute(f"REVOKE ALL ON FUNCTION {_SIGNATURE} FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {_SIGNATURE} TO slotera_app")


def downgrade() -> None:
    op.execute(f"DROP FUNCTION {_SIGNATURE}")
