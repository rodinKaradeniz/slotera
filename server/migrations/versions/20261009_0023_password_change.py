"""Add a session-bound password change capability.

Revision ID: 20261009_0023
Revises: 20261009_0022
Create Date: 2026-10-09
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261009_0023"
down_revision: str | None = "20261009_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SIGNATURE = "public.slotera_auth_change_password(bytea, text)"


def upgrade() -> None:
    # The user is derived from a live session token, never passed in, so the runtime
    # role can only change the password of whoever holds that session. The current
    # password is verified in the application before this is called.
    op.execute(
        """
        CREATE FUNCTION public.slotera_auth_change_password(
          p_session_token_hash bytea,
          p_password_hash text
        )
        RETURNS text
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          current_session public.auth_sessions%ROWTYPE;
        BEGIN
          SELECT * INTO current_session
          FROM public.auth_sessions
          WHERE token_hash = p_session_token_hash
            AND revoked_at IS NULL
            AND expires_at > statement_timestamp()
          FOR UPDATE;
          IF NOT FOUND THEN
            RETURN 'session_invalid';
          END IF;

          UPDATE public.users
          SET password_hash = p_password_hash,
              updated_at = statement_timestamp()
          WHERE id = current_session.user_id;

          -- Every other device is signed out; this one stays signed in.
          UPDATE public.auth_sessions
          SET revoked_at = statement_timestamp()
          WHERE user_id = current_session.user_id
            AND id <> current_session.id
            AND revoked_at IS NULL;

          UPDATE public.password_reset_tokens
          SET revoked_at = statement_timestamp()
          WHERE user_id = current_session.user_id
            AND used_at IS NULL
            AND revoked_at IS NULL;

          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          )
          SELECT
            gen_random_uuid(), membership.workspace_id, current_session.user_id,
            'auth.password_changed', 'user', current_session.user_id, '{}'::jsonb
          FROM public.workspace_memberships AS membership
          WHERE membership.user_id = current_session.user_id;

          RETURN 'changed';
        END
        $$
        """
    )
    op.execute(f"REVOKE ALL ON FUNCTION {_SIGNATURE} FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {_SIGNATURE} TO slotera_app")


def downgrade() -> None:
    op.execute(f"DROP FUNCTION {_SIGNATURE}")
