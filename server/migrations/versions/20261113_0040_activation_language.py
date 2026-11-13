"""Adopt the activation language only when an account gets its first password."""
from collections.abc import Sequence

from alembic import op

revision: str = "20261113_0040"
down_revision: str | None = "20261113_0039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE FUNCTION public.slotera_activation_language() RETURNS trigger
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
        DECLARE chosen text;
        BEGIN
          SELECT email.template_data->>'language' INTO chosen
            FROM public.email_outbox email JOIN public.password_reset_tokens token
              ON token.id = email.related_password_reset_token_id
            WHERE token.user_id = NEW.id AND token.used_at IS NULL
              AND token.revoked_at IS NULL AND token.expires_at > statement_timestamp()
            ORDER BY token.created_at DESC LIMIT 1;
          IF chosen IN ('en','tr','de') THEN
            NEW.preferred_language := chosen;
          END IF;
          RETURN NEW;
        END $$
    """)
    op.execute("REVOKE ALL ON FUNCTION public.slotera_activation_language() FROM PUBLIC")
    op.execute("""
        CREATE TRIGGER activation_language BEFORE UPDATE OF password_hash ON users
        FOR EACH ROW WHEN (OLD.password_hash IS NULL AND NEW.password_hash IS NOT NULL)
        EXECUTE FUNCTION public.slotera_activation_language()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS activation_language ON users")
    op.execute("DROP TRIGGER IF EXISTS activation_language ON password_reset_tokens")
    op.execute("DROP FUNCTION public.slotera_activation_language()")
