"""Add a narrow platform workspace provisioning capability.

Revision ID: 20260730_0013
Revises: 20260730_0012
Create Date: 2026-07-30
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260730_0013"
down_revision: str | None = "20260730_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION public.slotera_platform_provision_workspace(
          p_workspace_id uuid,
          p_owner_user_id uuid,
          p_membership_id uuid,
          p_audit_event_id uuid,
          p_actor_user_id uuid,
          p_name text,
          p_slug text,
          p_owner_first_names text,
          p_owner_last_name text,
          p_owner_email text,
          p_timezone text
        )
        RETURNS text
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
          normalized_owner_email text := lower(btrim(p_owner_email));
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM public.users
            WHERE id = p_actor_user_id
              AND platform_role::text = 'superadmin'
          ) THEN
            RETURN 'actor_not_superadmin';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM public.reserved_workspace_slugs
            WHERE slug = p_slug
          ) THEN
            RETURN 'workspace_slug_reserved';
          END IF;

          IF EXISTS (SELECT 1 FROM public.workspaces WHERE slug = p_slug) THEN
            RETURN 'workspace_slug_taken';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM public.users
            WHERE email = normalized_owner_email
          ) THEN
            RETURN 'workspace_owner_email_taken';
          END IF;

          INSERT INTO public.workspaces (id, name, slug, currency, timezone)
          VALUES (p_workspace_id, p_name, p_slug, 'EUR', p_timezone);

          INSERT INTO public.users (
            id, email, first_names, last_name, password_hash, platform_role
          )
          VALUES (
            p_owner_user_id,
            normalized_owner_email,
            p_owner_first_names,
            p_owner_last_name,
            NULL,
            NULL
          );

          INSERT INTO public.workspace_memberships (id, workspace_id, user_id, role)
          VALUES (p_membership_id, p_workspace_id, p_owner_user_id, 'operator_admin');

          INSERT INTO public.workspace_business_profiles (
            workspace_id, display_name, bio, email, phone, address, booking_page_enabled
          )
          VALUES (
            p_workspace_id,
            p_name,
            '',
            normalized_owner_email,
            '',
            '',
            true
          );

          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          )
          VALUES (
            p_audit_event_id,
            p_workspace_id,
            p_actor_user_id,
            'platform.workspace_provisioned',
            'workspace',
            p_workspace_id,
            '{}'::jsonb
          );

          RETURN 'created';
        END
        $$;
        """
    )
    op.execute(
        "REVOKE ALL ON FUNCTION public.slotera_platform_provision_workspace("
        "uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text) FROM PUBLIC"
    )
    op.execute(
        "GRANT EXECUTE ON FUNCTION public.slotera_platform_provision_workspace("
        "uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text) TO slotera_app"
    )


def downgrade() -> None:
    op.execute(
        "DROP FUNCTION public.slotera_platform_provision_workspace("
        "uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text)"
    )
