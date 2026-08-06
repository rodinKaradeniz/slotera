"""Add provider-neutral booking email and operator notification events.

Revision ID: 20260806_0021
Revises: 20260806_0020
Create Date: 2026-08-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260806_0021"
down_revision: str | None = "20260806_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _replace_notification_kind(*, include_booking_pending: bool) -> None:
    values = [
        "booking_confirmed",
        "payment_pending",
        "session_starting",
        "reschedule_requested",
    ]
    if include_booking_pending:
        values.insert(0, "booking_pending")
    op.execute("ALTER TABLE notifications ALTER COLUMN kind TYPE text USING kind::text")
    op.execute("DROP TYPE notification_kind")
    enum = postgresql.ENUM(*values, name="notification_kind", create_type=False)
    enum.create(op.get_bind())
    op.execute(
        "ALTER TABLE notifications ALTER COLUMN kind TYPE notification_kind "
        "USING kind::notification_kind"
    )


def _protect_function(signature: str) -> None:
    op.execute(f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {signature} TO slotera_app")


def _create_claim_function(*, include_template_data: bool) -> None:
    op.execute("DROP FUNCTION public.slotera_email_claim()")
    if include_template_data:
        returned = """
          id uuid,
          kind text,
          recipient_email text,
          subject text,
          text_body text,
          template_data jsonb,
          attempt_count integer
        """
        columns = """
            item.id,
            item.kind::text,
            item.recipient_email::text,
            item.subject::text,
            item.text_body,
            item.template_data,
            item.attempt_count
        """
    else:
        returned = """
          id uuid,
          recipient_email text,
          subject text,
          text_body text,
          attempt_count integer
        """
        columns = """
            item.id,
            item.recipient_email::text,
            item.subject::text,
            item.text_body,
            item.attempt_count
        """
    op.execute(
        f"""
        CREATE FUNCTION public.slotera_email_claim()
        RETURNS TABLE ({returned})
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        BEGIN
          RETURN QUERY
          WITH candidate AS (
            SELECT item.id
            FROM public.email_outbox AS item
            WHERE item.sent_at IS NULL
              AND item.available_at <= statement_timestamp()
              AND (
                item.claimed_at IS NULL
                OR item.claimed_at < statement_timestamp() - interval '5 minutes'
              )
              AND item.attempt_count < 10
            ORDER BY item.created_at, item.id
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          UPDATE public.email_outbox AS item
          SET claimed_at = statement_timestamp(),
              attempt_count = item.attempt_count + 1
          FROM candidate
          WHERE item.id = candidate.id
          RETURNING {columns};
        END
        $$
        """
    )
    _protect_function("public.slotera_email_claim()")


def upgrade() -> None:
    _replace_notification_kind(include_booking_pending=True)
    op.execute("UPDATE notifications SET payload = payload - 'clientName' - 'serviceName'")
    op.create_unique_constraint(
        "uq_notifications_resource_event",
        "notifications",
        ["workspace_id", "recipient_user_id", "kind", "resource_type", "resource_id"],
    )

    op.add_column(
        "email_outbox",
        sa.Column(
            "template_data",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column("email_outbox", sa.Column("related_booking_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_email_outbox_related_booking_id_bookings",
        "email_outbox",
        "bookings",
        ["related_booking_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_unique_constraint(
        "uq_email_outbox_booking_event",
        "email_outbox",
        ["kind", "related_booking_id"],
    )

    _create_claim_function(include_template_data=True)
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.slotera_email_mark_sent(
          p_id uuid,
          p_provider_message_id text
        )
        RETURNS boolean
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        BEGIN
          UPDATE public.email_outbox
          SET sent_at = statement_timestamp(),
              provider_message_id = p_provider_message_id,
              claimed_at = NULL,
              last_error = NULL,
              text_body = '[delivered]',
              template_data = '{}'::jsonb
          WHERE id = p_id AND sent_at IS NULL;
          RETURN FOUND;
        END
        $$
        """
    )
    _protect_function("public.slotera_email_mark_sent(uuid, text)")

    op.execute(
        """
        CREATE FUNCTION public.slotera_booking_emit_event(
          p_booking_id uuid,
          p_event text
        )
        RETURNS boolean
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          current_workspace_id uuid := public.slotera_current_workspace_id();
          target record;
          recipient_user_id uuid;
          notification_kind_value public.notification_kind;
          email_kind text;
          notification_payload jsonb;
        BEGIN
          IF current_workspace_id IS NULL OR p_event NOT IN ('received', 'confirmed') THEN
            RETURN false;
          END IF;

          SELECT
            booking.id,
            booking.workspace_id,
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
            service.name AS service_name,
            service.cancellation_rule,
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

          IF NOT FOUND OR target.customer_email = '' THEN
            RETURN false;
          END IF;
          IF p_event = 'received' AND target.booking_status <> 'pending' THEN
            RETURN false;
          END IF;
          IF p_event = 'confirmed' AND target.booking_status <> 'confirmed' THEN
            RETURN false;
          END IF;

          SELECT membership.user_id
          INTO recipient_user_id
          FROM public.workspace_memberships AS membership
          WHERE membership.workspace_id = current_workspace_id
            AND membership.role::text = 'operator_admin'
          ORDER BY membership.created_at, membership.id
          LIMIT 1;
          IF recipient_user_id IS NULL THEN
            RETURN false;
          END IF;

          IF p_event = 'received' THEN
            notification_kind_value := 'booking_pending';
            email_kind := 'booking_received';
            notification_payload := jsonb_build_object(
              'approvalStatus', target.approval_status,
              'paymentStatus', target.payment_status,
              'amountCents', target.amount_cents,
              'currency', target.currency,
              'startsAt', target.start_at
            );
          ELSE
            notification_kind_value := 'booking_confirmed';
            email_kind := 'booking_confirmed';
            notification_payload := jsonb_build_object('startsAt', target.start_at);
          END IF;

          INSERT INTO public.notifications (
            id, workspace_id, recipient_user_id, kind, payload,
            resource_type, resource_id
          ) VALUES (
            gen_random_uuid(), current_workspace_id, recipient_user_id,
            notification_kind_value, notification_payload, 'booking', target.id
          )
          ON CONFLICT ON CONSTRAINT uq_notifications_resource_event DO NOTHING;

          INSERT INTO public.email_outbox (
            id, kind, recipient_email, subject, text_body, template_data,
            related_booking_id
          ) VALUES (
            gen_random_uuid(), email_kind, target.customer_email,
            concat('[template:', email_kind, ']'),
            concat('[template:', email_kind, ']'),
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
              'cancellationRule', target.cancellation_rule
            ),
            target.id
          )
          ON CONFLICT ON CONSTRAINT uq_email_outbox_booking_event DO NOTHING;
          RETURN true;
        END
        $$
        """
    )
    _protect_function("public.slotera_booking_emit_event(uuid, text)")


def downgrade() -> None:
    op.execute("DROP FUNCTION public.slotera_booking_emit_event(uuid, text)")
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.slotera_email_mark_sent(
          p_id uuid,
          p_provider_message_id text
        )
        RETURNS boolean
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        BEGIN
          UPDATE public.email_outbox
          SET sent_at = statement_timestamp(),
              provider_message_id = p_provider_message_id,
              claimed_at = NULL,
              last_error = NULL,
              text_body = '[delivered]'
          WHERE id = p_id AND sent_at IS NULL;
          RETURN FOUND;
        END
        $$
        """
    )
    _protect_function("public.slotera_email_mark_sent(uuid, text)")
    _create_claim_function(include_template_data=False)

    op.drop_constraint("uq_email_outbox_booking_event", "email_outbox", type_="unique")
    op.drop_constraint(
        "fk_email_outbox_related_booking_id_bookings", "email_outbox", type_="foreignkey"
    )
    op.drop_column("email_outbox", "related_booking_id")
    op.drop_column("email_outbox", "template_data")

    op.drop_constraint("uq_notifications_resource_event", "notifications", type_="unique")
    op.execute("DELETE FROM notifications WHERE kind::text = 'booking_pending'")
    _replace_notification_kind(include_booking_pending=False)
