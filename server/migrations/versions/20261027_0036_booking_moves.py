"""Tell a client when their provider moves their booking to another session.

The outbox allows one email per kind per booking, which is right for the client's own
single reschedule but would silently drop a second move by the operator. This adds an
`event_key` to the uniqueness (empty for every existing event kind) and a function that
queues the client's "booking moved" email with a fresh key.

`slotera_booking_notify_client_moved(booking, manage_url)`:
- queues one `booking_rescheduled` email to the client's address, with a manage link;
- does not notify the operator, who made the change themselves;
- runs in the caller's tenant transaction and reads only that workspace's booking.

Revision ID: 20261027_0036
Revises: 20261027_0035
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261027_0036"
down_revision: str | None = "20261027_0035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SIGNATURE = "public.slotera_booking_notify_client_moved(uuid, text)"


def upgrade() -> None:
    op.add_column(
        "email_outbox",
        sa.Column("event_key", sa.Text(), server_default=sa.text("''"), nullable=False),
    )
    op.drop_constraint("uq_email_outbox_booking_event", "email_outbox", type_="unique")
    op.create_unique_constraint(
        "uq_email_outbox_booking_event",
        "email_outbox",
        ["kind", "related_booking_id", "event_key"],
    )
    op.execute(
        """
        CREATE FUNCTION public.slotera_booking_notify_client_moved(
          p_booking_id uuid,
          p_manage_url text
        )
        RETURNS boolean
        LANGUAGE plpgsql VOLATILE SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          current_workspace_id uuid := public.slotera_current_workspace_id();
          target record;
        BEGIN
          IF current_workspace_id IS NULL THEN
            RETURN false;
          END IF;

          SELECT
            booking.id,
            booking.reference,
            booking.customer_email,
            booking.approval_status::text AS approval_status,
            booking.payment_status::text AS payment_status,
            booking.payment_method,
            booking.amount_cents,
            booking.currency,
            booking.payment_due_at,
            booking.manual_payment_instructions_snapshot,
            booking.status::text AS booking_status,
            scheduled_session.start_at,
            scheduled_session.end_at,
            scheduled_session.location_type::text AS location_type,
            scheduled_session.location,
            scheduled_session.address,
            service.name AS service_name,
            service.cancellation_rule,
            service.meeting_url,
            workspace.timezone,
            profile.display_name AS provider_name
          INTO target
          FROM public.bookings AS booking
          JOIN public.sessions AS scheduled_session
            ON scheduled_session.workspace_id = booking.workspace_id
           AND scheduled_session.id = booking.session_id
          JOIN public.services AS service
            ON service.workspace_id = scheduled_session.workspace_id
           AND service.id = scheduled_session.service_id
          JOIN public.workspaces AS workspace ON workspace.id = booking.workspace_id
          JOIN public.workspace_business_profiles AS profile
            ON profile.workspace_id = booking.workspace_id
          WHERE booking.workspace_id = current_workspace_id
            AND booking.id = p_booking_id;

          IF NOT FOUND OR target.customer_email = ''
             OR target.booking_status NOT IN ('pending', 'confirmed') THEN
            RETURN false;
          END IF;

          INSERT INTO public.email_outbox (
            id, kind, recipient_email, subject, text_body, template_data,
            related_booking_id, event_key
          ) VALUES (
            gen_random_uuid(), 'booking_rescheduled', target.customer_email,
            '[template:booking_rescheduled]',
            '[template:booking_rescheduled]',
            jsonb_build_object(
              'reference', target.reference,
              'serviceName', target.service_name,
              'providerName', target.provider_name,
              'startsAt', target.start_at,
              'endsAt', target.end_at,
              'timezone', target.timezone,
              'paymentMethod', target.payment_method,
              'paymentStatus', target.payment_status,
              'approvalStatus', target.approval_status,
              'amountCents', target.amount_cents,
              'currency', target.currency,
              'paymentDueAt', target.payment_due_at,
              'manualPaymentInstructions', target.manual_payment_instructions_snapshot,
              'cancellationRule', target.cancellation_rule,
              'manageUrl', p_manage_url,
              'locationType', target.location_type,
              'location', target.location,
              'address', target.address,
              'meetingUrl', CASE
                WHEN target.booking_status = 'confirmed' THEN target.meeting_url
              END
            ),
            target.id,
            gen_random_uuid()::text
          );
          RETURN true;
        END
        $$
        """
    )
    op.execute(f"REVOKE ALL ON FUNCTION {_SIGNATURE} FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {_SIGNATURE} TO slotera_app")


def downgrade() -> None:
    op.execute(f"DROP FUNCTION {_SIGNATURE}")
    op.execute("DELETE FROM email_outbox WHERE event_key <> ''")
    op.drop_constraint("uq_email_outbox_booking_event", "email_outbox", type_="unique")
    op.create_unique_constraint(
        "uq_email_outbox_booking_event", "email_outbox", ["kind", "related_booking_id"]
    )
    op.drop_column("email_outbox", "event_key")
