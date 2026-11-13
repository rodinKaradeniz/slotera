# ruff: noqa: E501
"""Persist language preferences and snapshot email language at enqueue time."""

from collections.abc import Sequence

from alembic import op

revision: str = "20261113_0039"
down_revision: str | None = "20261113_0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN preferred_language varchar(2) NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en','tr','de'))"
    )
    op.execute(
        "ALTER TABLE bookings ADD COLUMN language varchar(2) NOT NULL DEFAULT 'en' CHECK (language IN ('en','tr','de'))"
    )
    op.execute("""
        CREATE FUNCTION public.slotera_auth_preferences(p_token_hash bytea, p_language text DEFAULT NULL)
        RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
        SET search_path = pg_catalog, public AS $$
        DECLARE actor uuid; result text;
        BEGIN
          SELECT s.user_id INTO actor FROM public.slotera_auth_session(p_token_hash) s;
          IF actor IS NULL THEN RETURN NULL; END IF;
          IF p_language IS NOT NULL THEN
            IF p_language NOT IN ('en','tr','de') THEN RAISE EXCEPTION 'invalid_language'; END IF;
            UPDATE public.users SET preferred_language = p_language WHERE id = actor;
          END IF;
          SELECT preferred_language INTO result FROM public.users WHERE id = actor;
          RETURN result;
        END $$
    """)
    op.execute("REVOKE ALL ON FUNCTION public.slotera_auth_preferences(bytea, text) FROM PUBLIC")
    op.execute(
        "GRANT EXECUTE ON FUNCTION public.slotera_auth_preferences(bytea, text) TO slotera_app"
    )
    op.execute("""
        CREATE FUNCTION public.slotera_email_snapshot_language() RETURNS trigger
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
        DECLARE chosen text := 'en'; url text; first_name text; expiry timestamptz;
        BEGIN
          IF NEW.kind = 'account_activation' THEN
            SELECT u.first_names, t.expires_at, u.preferred_language INTO first_name, expiry, chosen
              FROM public.password_reset_tokens t JOIN public.users u ON u.id = t.user_id
              WHERE t.id = NEW.related_password_reset_token_id;
            url := substring(NEW.text_body from 'https?://[^[:space:]]+');
            IF url ~ '[?&]lang=(en|tr|de)(&|$)' THEN
              chosen := substring(url from '[?&]lang=(en|tr|de)');
            END IF;
            NEW.template_data := coalesce(NEW.template_data, '{}'::jsonb) || jsonb_build_object(
              'resetUrl', url, 'firstName', first_name, 'expiresAt', expiry);
          ELSIF NEW.kind LIKE 'operator_booking_%' THEN
            SELECT u.preferred_language INTO chosen FROM public.users u
              WHERE u.email = NEW.recipient_email;
          ELSIF NEW.related_booking_id IS NOT NULL THEN
            SELECT b.language INTO chosen FROM public.bookings b WHERE b.id = NEW.related_booking_id;
          END IF;
          NEW.template_data := coalesce(NEW.template_data, '{}'::jsonb)
            || jsonb_build_object('language', coalesce(chosen, 'en'));
          RETURN NEW;
        END $$
    """)
    op.execute("REVOKE ALL ON FUNCTION public.slotera_email_snapshot_language() FROM PUBLIC")
    op.execute(
        "CREATE TRIGGER email_snapshot_language BEFORE INSERT ON email_outbox FOR EACH ROW EXECUTE FUNCTION public.slotera_email_snapshot_language()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER email_snapshot_language ON email_outbox")
    op.execute("DROP FUNCTION public.slotera_email_snapshot_language()")
    op.execute("DROP FUNCTION public.slotera_auth_preferences(bytea, text)")
    op.drop_column("bookings", "language")
    op.drop_column("users", "preferred_language")
