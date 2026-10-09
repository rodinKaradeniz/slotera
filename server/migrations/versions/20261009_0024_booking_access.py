"""Add customer booking access links, self-serve changes, and reminders.

- `booking_access_tokens`: hashed, expiring, revocable links to one booking.
- `availability_policies.customer_change_notice_hours`: how late customers may still
  cancel or reschedule themselves; `bookings.customer_rescheduled_at`: one reschedule.
- `slotera_booking_emit_event` gains a manage URL and the `reminder`, `rescheduled`,
  and `cancelled` events (one email of each kind per booking, as before).
- `slotera_public_booking_access`: resolves a token to its booking, cross-tenant.
- `slotera_booking_due_reminders`: confirmed bookings starting soon with no reminder.

Revision ID: 20261009_0024
Revises: 20261009_0023
Create Date: 2026-10-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261009_0024"
down_revision: str | None = "20261009_0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _protect(signature: str) -> None:
    op.execute(f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {signature} TO slotera_app")


def _enable_tenant_rls(table_name: str) -> None:
    op.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY")
    for operation, clause in (
        ("select", "USING"),
        ("insert", "WITH CHECK"),
        ("delete", "USING"),
    ):
        op.execute(
            f"CREATE POLICY {table_name}_{operation} ON {table_name} "
            f"FOR {operation.upper()} TO slotera_app "
            f"{clause} (workspace_id = public.slotera_current_workspace_id())"
        )
    op.execute(
        f"CREATE POLICY {table_name}_update ON {table_name} FOR UPDATE TO slotera_app "
        "USING (workspace_id = public.slotera_current_workspace_id()) "
        "WITH CHECK (workspace_id = public.slotera_current_workspace_id())"
    )


_EMIT_BODY = """
        DECLARE
          current_workspace_id uuid := public.slotera_current_workspace_id();
          target record;
          recipient_user_id uuid;
          notification_kind_value public.notification_kind;
          email_kind text;
          notification_payload jsonb;
        BEGIN
          IF current_workspace_id IS NULL OR p_event NOT IN (
            'received', 'confirmed', 'reminder', 'rescheduled', 'cancelled'
          ) THEN
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
          IF (p_event = 'received' AND target.booking_status <> 'pending')
             OR (p_event IN ('confirmed', 'reminder') AND target.booking_status <> 'confirmed')
             OR (p_event = 'rescheduled'
                 AND target.booking_status NOT IN ('pending', 'confirmed'))
             OR (p_event = 'cancelled' AND target.booking_status <> 'cancelled') THEN
            RETURN false;
          END IF;

          email_kind := 'booking_' || p_event;
          notification_kind_value := CASE p_event
            WHEN 'received' THEN 'booking_pending'::public.notification_kind
            WHEN 'confirmed' THEN 'booking_confirmed'::public.notification_kind
            WHEN 'rescheduled' THEN 'reschedule_requested'::public.notification_kind
            WHEN 'cancelled' THEN 'booking_cancelled'::public.notification_kind
            ELSE NULL
          END;

          -- Reminders go to the customer only; every other event also tells the operator.
          IF notification_kind_value IS NOT NULL THEN
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
            notification_payload := CASE p_event
              WHEN 'received' THEN jsonb_build_object(
                'approvalStatus', target.approval_status,
                'paymentStatus', target.payment_status,
                'amountCents', target.amount_cents,
                'currency', target.currency,
                'startsAt', target.start_at
              )
              WHEN 'rescheduled' THEN jsonb_build_object('requestedFor', target.start_at)
              ELSE jsonb_build_object('startsAt', target.start_at)
            END;
            INSERT INTO public.notifications (
              id, workspace_id, recipient_user_id, kind, payload,
              resource_type, resource_id
            ) VALUES (
              gen_random_uuid(), current_workspace_id, recipient_user_id,
              notification_kind_value, notification_payload, 'booking', target.id
            )
            ON CONFLICT ON CONSTRAINT uq_notifications_resource_event DO NOTHING;
          END IF;

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
              'cancellationRule', target.cancellation_rule,
              'manageUrl', p_manage_url
            ),
            target.id
          )
          ON CONFLICT ON CONSTRAINT uq_email_outbox_booking_event DO NOTHING;
          RETURN true;
        END
"""


def upgrade() -> None:
    op.execute("ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'booking_cancelled'")

    op.add_column(
        "availability_policies",
        sa.Column(
            "customer_change_notice_hours",
            sa.Integer(),
            server_default=sa.text("24"),
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "ck_availability_policies_customer_change_notice",
        "availability_policies",
        "customer_change_notice_hours BETWEEN 0 AND 720",
    )
    op.add_column(
        "bookings",
        sa.Column("customer_rescheduled_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "booking_access_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "booking_id"],
            ["bookings.workspace_id", "bookings.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_booking_access_tokens_token_hash"),
        sa.CheckConstraint("octet_length(token_hash) = 32", name="ck_booking_access_token_hash"),
    )
    op.create_index(
        "ix_booking_access_tokens_booking", "booking_access_tokens", ["workspace_id", "booking_id"]
    )
    _enable_tenant_rls("booking_access_tokens")

    op.execute("DROP FUNCTION public.slotera_booking_emit_event(uuid, text)")
    op.execute(
        f"""
        CREATE FUNCTION public.slotera_booking_emit_event(
          p_booking_id uuid,
          p_event text,
          p_manage_url text DEFAULT NULL
        )
        RETURNS boolean
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $${_EMIT_BODY}$$
        """
    )
    _protect("public.slotera_booking_emit_event(uuid, text, text)")

    # Token -> booking is the one cross-tenant read customer access needs; everything
    # after it runs inside the booking's own tenant transaction.
    op.execute(
        """
        CREATE FUNCTION public.slotera_public_booking_access(p_token_hash bytea)
        RETURNS TABLE (workspace_id uuid, booking_id uuid)
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          SELECT token.workspace_id, token.booking_id
          FROM public.booking_access_tokens AS token
          JOIN public.workspaces AS workspace ON workspace.id = token.workspace_id
          WHERE token.token_hash = p_token_hash
            AND token.revoked_at IS NULL
            AND token.expires_at > statement_timestamp()
            AND workspace.operational_status::text = 'active'
        $$
        """
    )
    _protect("public.slotera_public_booking_access(bytea)")

    op.execute(
        """
        CREATE FUNCTION public.slotera_booking_due_reminders(p_within interval)
        RETURNS TABLE (workspace_id uuid, booking_id uuid, ends_at timestamptz)
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          SELECT booking.workspace_id, booking.id, scheduled_session.end_at
          FROM public.bookings AS booking
          JOIN public.sessions AS scheduled_session
            ON scheduled_session.workspace_id = booking.workspace_id
           AND scheduled_session.id = booking.session_id
          WHERE booking.status::text = 'confirmed'
            AND booking.customer_email <> ''
            AND scheduled_session.start_at > statement_timestamp()
            AND scheduled_session.start_at <= statement_timestamp() + p_within
            AND NOT EXISTS (
              SELECT 1 FROM public.email_outbox AS outbox
              WHERE outbox.related_booking_id = booking.id
                AND outbox.kind = 'booking_reminder'
            )
          ORDER BY scheduled_session.start_at
          LIMIT 500
        $$
        """
    )
    _protect("public.slotera_booking_due_reminders(interval)")


def downgrade() -> None:
    op.execute("DROP FUNCTION public.slotera_booking_due_reminders(interval)")
    op.execute("DROP FUNCTION public.slotera_public_booking_access(bytea)")
    op.execute("DROP FUNCTION public.slotera_booking_emit_event(uuid, text, text)")
    # Restore the two-argument signature callers used before this revision. The
    # added enum value stays (PostgreSQL cannot drop enum values), which is harmless.
    op.execute(
        f"""
        CREATE FUNCTION public.slotera_booking_emit_event(p_booking_id uuid, p_event text)
        RETURNS boolean
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $${_EMIT_BODY.replace("p_manage_url", "NULL::text")}$$
        """
    )
    _protect("public.slotera_booking_emit_event(uuid, text)")
    op.drop_table("booking_access_tokens")
    op.drop_column("bookings", "customer_rescheduled_at")
    op.drop_constraint(
        "ck_availability_policies_customer_change_notice", "availability_policies", type_="check"
    )
    op.drop_column("availability_policies", "customer_change_notice_hours")
