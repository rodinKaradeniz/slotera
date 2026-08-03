"""Add distributed auth throttling, password activation, and email outbox.

Revision ID: 20260802_0018
Revises: 20260801_0017
Create Date: 2026-08-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260802_0018"
down_revision: str | None = "20260801_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _protect_function(signature: str) -> None:
    op.execute(f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {signature} TO slotera_app")


def upgrade() -> None:
    op.create_table(
        "request_rate_limits",
        sa.Column("scope", sa.String(64), nullable=False),
        sa.Column("key_hash", sa.LargeBinary(), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.CheckConstraint("octet_length(key_hash) = 32", name="key_hash_sha256"),
        sa.CheckConstraint("request_count > 0", name="request_count_positive"),
        sa.PrimaryKeyConstraint("scope", "key_hash"),
    )
    op.create_index(
        "ix_request_rate_limits_window_started_at",
        "request_rate_limits",
        ["window_started_at"],
    )

    op.create_table(
        "email_outbox",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(80), nullable=False),
        sa.Column("recipient_email", sa.String(320), nullable=False),
        sa.Column("subject", sa.String(300), nullable=False),
        sa.Column("text_body", sa.Text(), nullable=False),
        sa.Column("related_password_reset_token_id", sa.Uuid(), nullable=True),
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "available_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider_message_id", sa.String(255), nullable=True),
        sa.Column("last_error", sa.String(1000), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("attempt_count >= 0", name="attempt_count_nonnegative"),
        sa.ForeignKeyConstraint(
            ["related_password_reset_token_id"],
            ["password_reset_tokens.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_email_outbox_pending",
        "email_outbox",
        ["available_at", "created_at"],
        postgresql_where=sa.text("sent_at IS NULL"),
    )

    op.execute("REVOKE ALL PRIVILEGES ON request_rate_limits, email_outbox FROM slotera_app")

    op.execute(
        """
        CREATE FUNCTION public.slotera_rate_limit_consume(
          p_scope text,
          p_key_hash bytea,
          p_limit integer,
          p_window_seconds integer
        )
        RETURNS boolean
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          current_count integer;
        BEGIN
          IF p_scope = '' OR octet_length(p_key_hash) <> 32
             OR p_limit < 1 OR p_window_seconds < 1 THEN
            RETURN false;
          END IF;

          INSERT INTO public.request_rate_limits (
            scope, key_hash, window_started_at, request_count
          )
          VALUES (p_scope, p_key_hash, statement_timestamp(), 1)
          ON CONFLICT (scope, key_hash) DO UPDATE
          SET window_started_at = CASE
                WHEN public.request_rate_limits.window_started_at
                     <= statement_timestamp() - make_interval(secs => p_window_seconds)
                THEN statement_timestamp()
                ELSE public.request_rate_limits.window_started_at
              END,
              request_count = CASE
                WHEN public.request_rate_limits.window_started_at
                     <= statement_timestamp() - make_interval(secs => p_window_seconds)
                THEN 1
                ELSE public.request_rate_limits.request_count + 1
              END
          RETURNING request_count INTO current_count;

          RETURN current_count <= p_limit;
        END
        $$
        """
    )

    op.execute(
        """
        CREATE FUNCTION public.slotera_auth_request_password_reset(
          p_token_id uuid,
          p_outbox_id uuid,
          p_email text,
          p_token_hash bytea,
          p_expires_at timestamptz,
          p_reset_url text
        )
        RETURNS boolean
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          target_user public.users%ROWTYPE;
        BEGIN
          IF octet_length(p_token_hash) <> 32
             OR p_expires_at <= statement_timestamp()
             OR char_length(p_reset_url) > 4000 THEN
            RETURN false;
          END IF;

          SELECT * INTO target_user
          FROM public.users
          WHERE email = lower(btrim(p_email));

          IF NOT FOUND THEN
            RETURN false;
          END IF;

          UPDATE public.password_reset_tokens
          SET revoked_at = statement_timestamp()
          WHERE user_id = target_user.id
            AND used_at IS NULL
            AND revoked_at IS NULL;

          INSERT INTO public.password_reset_tokens (
            id, user_id, token_hash, expires_at
          ) VALUES (
            p_token_id, target_user.id, p_token_hash, p_expires_at
          );

          INSERT INTO public.email_outbox (
            id,
            kind,
            recipient_email,
            subject,
            text_body,
            related_password_reset_token_id
          ) VALUES (
            p_outbox_id,
            'account_activation',
            target_user.email,
            'Activate or reset your Slotera account',
            concat(
              'Hello ', target_user.first_names, E',\n\n',
              'Use this one-time link to activate or reset your Slotera account:\n',
              p_reset_url,
              E'\n\nThis link expires at ',
              to_char(p_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC'),
              '. If you did not request it, ignore this email.'
            ),
            p_token_id
          );
          RETURN true;
        END
        $$
        """
    )

    op.execute(
        """
        CREATE FUNCTION public.slotera_auth_consume_password_reset(
          p_token_hash bytea,
          p_password_hash text
        )
        RETURNS text
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          reset_row public.password_reset_tokens%ROWTYPE;
        BEGIN
          SELECT * INTO reset_row
          FROM public.password_reset_tokens
          WHERE token_hash = p_token_hash
          FOR UPDATE;

          IF NOT FOUND
             OR reset_row.used_at IS NOT NULL
             OR reset_row.revoked_at IS NOT NULL
             OR reset_row.expires_at <= statement_timestamp() THEN
            RETURN 'invalid_or_expired';
          END IF;

          UPDATE public.users
          SET password_hash = p_password_hash,
              updated_at = statement_timestamp()
          WHERE id = reset_row.user_id;

          UPDATE public.password_reset_tokens
          SET used_at = statement_timestamp()
          WHERE id = reset_row.id;

          UPDATE public.password_reset_tokens
          SET revoked_at = statement_timestamp()
          WHERE user_id = reset_row.user_id
            AND id <> reset_row.id
            AND used_at IS NULL
            AND revoked_at IS NULL;

          UPDATE public.auth_sessions
          SET revoked_at = statement_timestamp()
          WHERE user_id = reset_row.user_id
            AND revoked_at IS NULL;

          UPDATE public.email_outbox
          SET text_body = '[credential consumed]',
              last_error = CASE
                WHEN sent_at IS NULL THEN 'credential consumed before delivery'
                ELSE last_error
              END,
              sent_at = COALESCE(sent_at, statement_timestamp())
          WHERE related_password_reset_token_id = reset_row.id
            AND sent_at IS NULL;

          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          )
          SELECT
            gen_random_uuid(),
            membership.workspace_id,
            reset_row.user_id,
            'auth.password_set',
            'user',
            reset_row.user_id,
            '{}'::jsonb
          FROM public.workspace_memberships AS membership
          WHERE membership.user_id = reset_row.user_id;

          RETURN 'consumed';
        END
        $$
        """
    )

    op.execute(
        """
        CREATE FUNCTION public.slotera_email_claim()
        RETURNS TABLE (
          id uuid,
          recipient_email text,
          subject text,
          text_body text,
          attempt_count integer
        )
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
          RETURNING
            item.id,
            item.recipient_email::text,
            item.subject::text,
            item.text_body,
            item.attempt_count;
        END
        $$
        """
    )

    op.execute(
        """
        CREATE FUNCTION public.slotera_email_mark_sent(
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

    op.execute(
        """
        CREATE FUNCTION public.slotera_email_mark_failed(p_id uuid, p_error text)
        RETURNS boolean
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        BEGIN
          UPDATE public.email_outbox
          SET claimed_at = NULL,
              last_error = left(p_error, 1000),
              available_at = statement_timestamp()
                + make_interval(secs => LEAST(3600, 30 * power(2, attempt_count)::integer))
          WHERE id = p_id AND sent_at IS NULL;
          RETURN FOUND;
        END
        $$
        """
    )

    op.execute(
        """
        CREATE FUNCTION public.slotera_auth_maintenance()
        RETURNS integer
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          affected integer := 0;
          row_count integer;
        BEGIN
          DELETE FROM public.auth_sessions
          WHERE expires_at < statement_timestamp() - interval '7 days'
             OR revoked_at < statement_timestamp() - interval '30 days';
          GET DIAGNOSTICS row_count = ROW_COUNT;
          affected := affected + row_count;

          DELETE FROM public.password_reset_tokens
          WHERE expires_at < statement_timestamp() - interval '7 days'
             OR used_at < statement_timestamp() - interval '30 days'
             OR revoked_at < statement_timestamp() - interval '30 days';
          GET DIAGNOSTICS row_count = ROW_COUNT;
          affected := affected + row_count;

          DELETE FROM public.request_rate_limits
          WHERE window_started_at < statement_timestamp() - interval '2 days';
          GET DIAGNOSTICS row_count = ROW_COUNT;
          affected := affected + row_count;

          DELETE FROM public.email_outbox
          WHERE sent_at < statement_timestamp() - interval '30 days';
          GET DIAGNOSTICS row_count = ROW_COUNT;
          RETURN affected + row_count;
        END
        $$
        """
    )

    for signature in (
        "public.slotera_rate_limit_consume(text, bytea, integer, integer)",
        "public.slotera_auth_request_password_reset(uuid, uuid, text, bytea, timestamptz, text)",
        "public.slotera_auth_consume_password_reset(bytea, text)",
        "public.slotera_email_claim()",
        "public.slotera_email_mark_sent(uuid, text)",
        "public.slotera_email_mark_failed(uuid, text)",
        "public.slotera_auth_maintenance()",
    ):
        _protect_function(signature)


def downgrade() -> None:
    for signature in (
        "public.slotera_auth_maintenance()",
        "public.slotera_email_mark_failed(uuid, text)",
        "public.slotera_email_mark_sent(uuid, text)",
        "public.slotera_email_claim()",
        "public.slotera_auth_consume_password_reset(bytea, text)",
        "public.slotera_auth_request_password_reset(uuid, uuid, text, bytea, timestamptz, text)",
        "public.slotera_rate_limit_consume(text, bytea, integer, integer)",
    ):
        op.execute(f"DROP FUNCTION {signature}")
    op.drop_table("email_outbox")
    op.drop_table("request_rate_limits")
