"""Email the operator when a client books, cancels or reschedules.

`slotera_booking_notify_operator(booking, event, admin_url)` queues one email to the
workspace owner, for the client-initiated events `new`, `cancelled` and `rescheduled`.
The application calls it only from the public booking and manage-link paths, so the
operator's own changes never email them. The outbox's per-booking uniqueness on `kind`
keeps it to one email per event per booking. It runs in the caller's tenant transaction
and reads only that workspace's booking.

Revision ID: 20261012_0034
Revises: 20261012_0033
Create Date: 2026-10-12
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261012_0034"
down_revision: str | None = "20261012_0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SIGNATURE = "public.slotera_booking_notify_operator(uuid, text, text)"


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION public.slotera_booking_notify_operator(
          p_booking_id uuid,
          p_event text,
          p_admin_url text
        )
        RETURNS boolean
        LANGUAGE plpgsql VOLATILE SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          current_workspace_id uuid := public.slotera_current_workspace_id();
          target record;
          owner_email text;
        BEGIN
          IF current_workspace_id IS NULL
             OR p_event NOT IN ('new', 'cancelled', 'rescheduled') THEN
            RETURN false;
          END IF;

          SELECT
            booking.id,
            booking.reference,
            concat_ws(' ', nullif(booking.customer_first_name, ''),
                      nullif(booking.customer_last_name, '')) AS client_name,
            booking.status::text AS booking_status,
            booking.approval_status::text AS approval_status,
            booking.payment_status::text AS payment_status,
            scheduled_session.start_at,
            service.name AS service_name,
            workspace.timezone
          INTO target
          FROM public.bookings AS booking
          JOIN public.sessions AS scheduled_session
            ON scheduled_session.workspace_id = booking.workspace_id
           AND scheduled_session.id = booking.session_id
          JOIN public.services AS service
            ON service.workspace_id = scheduled_session.workspace_id
           AND service.id = scheduled_session.service_id
          JOIN public.workspaces AS workspace ON workspace.id = booking.workspace_id
          WHERE booking.workspace_id = current_workspace_id
            AND booking.id = p_booking_id;
          IF NOT FOUND THEN
            RETURN false;
          END IF;

          SELECT u.email::text INTO owner_email
          FROM public.workspace_memberships AS membership
          JOIN public.users AS u ON u.id = membership.user_id
          WHERE membership.workspace_id = current_workspace_id
            AND membership.role::text = 'operator_admin'
          ORDER BY membership.created_at, membership.id
          LIMIT 1;
          IF owner_email IS NULL THEN
            RETURN false;
          END IF;

          INSERT INTO public.email_outbox (
            id, kind, recipient_email, subject, text_body, template_data,
            related_booking_id
          ) VALUES (
            gen_random_uuid(),
            'operator_booking_' || p_event,
            owner_email,
            concat('[template:operator_booking_', p_event, ']'),
            concat('[template:operator_booking_', p_event, ']'),
            jsonb_build_object(
              'reference', target.reference,
              'serviceName', target.service_name,
              'clientName', target.client_name,
              'startsAt', target.start_at,
              'timezone', target.timezone,
              'bookingStatus', target.booking_status,
              'approvalStatus', target.approval_status,
              'paymentStatus', target.payment_status,
              'adminUrl', p_admin_url
            ),
            target.id
          )
          ON CONFLICT ON CONSTRAINT uq_email_outbox_booking_event DO NOTHING;
          RETURN true;
        END
        $$
        """
    )
    op.execute(f"REVOKE ALL ON FUNCTION {_SIGNATURE} FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {_SIGNATURE} TO slotera_app")


def downgrade() -> None:
    op.execute(
        "DELETE FROM email_outbox WHERE kind LIKE 'operator\\_booking\\_%' AND sent_at IS NULL"
    )
    op.execute(f"DROP FUNCTION {_SIGNATURE}")
