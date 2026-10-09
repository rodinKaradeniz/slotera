"""Add self-serve operator sign-up and onboarding completion.

The workspace-plus-owner inserts that platform provisioning already performs move
into one internal function (no runtime grant). Superadmin provisioning and the new
public sign-up capability both call it, so the two paths cannot drift apart.

Revision ID: 20261009_0022
Revises: 20260806_0021
Create Date: 2026-10-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261009_0022"
down_revision: str | None = "20260806_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_PROVISION_SIGNATURE = (
    "public.slotera_platform_provision_workspace("
    "uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text)"
)
_SIGNUP_SIGNATURE = (
    "public.slotera_auth_self_signup(uuid, uuid, uuid, uuid, text, text, text, text, text, text)"
)
_CREATE_SIGNATURE = (
    "public.slotera_workspace_create_with_owner("
    "uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text)"
)

# Original 0013 body, kept verbatim for downgrade.
_ORIGINAL_PROVISION_BODY = """
        DECLARE
          normalized_owner_email text := lower(btrim(p_owner_email));
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor_user_id AND platform_role::text = 'superadmin'
          ) THEN
            RETURN 'actor_not_superadmin';
          END IF;
          IF EXISTS (SELECT 1 FROM public.reserved_workspace_slugs WHERE slug = p_slug) THEN
            RETURN 'workspace_slug_reserved';
          END IF;
          IF EXISTS (SELECT 1 FROM public.workspaces WHERE slug = p_slug) THEN
            RETURN 'workspace_slug_taken';
          END IF;
          IF EXISTS (SELECT 1 FROM public.users WHERE email = normalized_owner_email) THEN
            RETURN 'workspace_owner_email_taken';
          END IF;
          INSERT INTO public.workspaces (id, name, slug, currency, timezone)
          VALUES (p_workspace_id, p_name, p_slug, 'EUR', p_timezone);
          INSERT INTO public.users (
            id, email, first_names, last_name, password_hash, platform_role
          ) VALUES (
            p_owner_user_id, normalized_owner_email, p_owner_first_names,
            p_owner_last_name, NULL, NULL
          );
          INSERT INTO public.workspace_memberships (id, workspace_id, user_id, role)
          VALUES (p_membership_id, p_workspace_id, p_owner_user_id, 'operator_admin');
          INSERT INTO public.workspace_business_profiles (
            workspace_id, display_name, bio, email, phone, address, booking_page_enabled
          ) VALUES (
            p_workspace_id, p_name, '', normalized_owner_email, '', '', true
          );
          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          ) VALUES (
            p_audit_event_id, p_workspace_id, p_actor_user_id,
            'platform.workspace_provisioned', 'workspace', p_workspace_id, '{}'::jsonb
          );
          RETURN 'created';
        END
"""


def _protect(signature: str, *, grant: bool) -> None:
    op.execute(f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC")
    if grant:
        op.execute(f"GRANT EXECUTE ON FUNCTION {signature} TO slotera_app")


def upgrade() -> None:
    op.add_column(
        "workspace_business_profiles",
        sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Workspaces that already exist were set up by hand; never send them to onboarding.
    op.execute(
        "UPDATE workspace_business_profiles SET onboarding_completed_at = statement_timestamp()"
    )
    # Provisioning never created an availability policy, so /availability 404ed for
    # provisioned workspaces. New workspaces now get one; backfill the existing ones.
    op.execute(
        """
        INSERT INTO availability_policies (workspace_id)
        SELECT workspace.id FROM workspaces AS workspace
        WHERE NOT EXISTS (
          SELECT 1 FROM availability_policies AS policy
          WHERE policy.workspace_id = workspace.id
        )
        """
    )

    op.execute(
        """
        CREATE FUNCTION public.slotera_workspace_create_with_owner(
          p_workspace_id uuid,
          p_owner_user_id uuid,
          p_membership_id uuid,
          p_audit_event_id uuid,
          p_actor_user_id uuid,
          p_audit_action text,
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
          IF EXISTS (SELECT 1 FROM public.reserved_workspace_slugs WHERE slug = p_slug) THEN
            RETURN 'workspace_slug_reserved';
          END IF;
          IF EXISTS (SELECT 1 FROM public.workspaces WHERE slug = p_slug) THEN
            RETURN 'workspace_slug_taken';
          END IF;
          IF EXISTS (SELECT 1 FROM public.users WHERE email = normalized_owner_email) THEN
            RETURN 'workspace_owner_email_taken';
          END IF;

          INSERT INTO public.workspaces (id, name, slug, currency, timezone)
          VALUES (p_workspace_id, p_name, p_slug, 'EUR', p_timezone);
          INSERT INTO public.users (
            id, email, first_names, last_name, password_hash, platform_role
          ) VALUES (
            p_owner_user_id, normalized_owner_email, p_owner_first_names,
            p_owner_last_name, NULL, NULL
          );
          INSERT INTO public.workspace_memberships (id, workspace_id, user_id, role)
          VALUES (p_membership_id, p_workspace_id, p_owner_user_id, 'operator_admin');
          INSERT INTO public.workspace_business_profiles (
            workspace_id, display_name, bio, email, phone, address, booking_page_enabled
          ) VALUES (
            p_workspace_id, p_name, '', normalized_owner_email, '', '', true
          );
          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          ) VALUES (
            p_audit_event_id, p_workspace_id, p_actor_user_id,
            p_audit_action, 'workspace', p_workspace_id, '{}'::jsonb
          );
          RETURN 'created';
        END
        $$
        """
    )
    # Internal only: callable from the owner-defined capabilities below, never
    # directly by the runtime role.
    _protect(_CREATE_SIGNATURE, grant=False)

    op.execute(f"DROP FUNCTION {_PROVISION_SIGNATURE}")
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
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor_user_id AND platform_role::text = 'superadmin'
          ) THEN
            RETURN 'actor_not_superadmin';
          END IF;
          RETURN public.slotera_workspace_create_with_owner(
            p_workspace_id, p_owner_user_id, p_membership_id, p_audit_event_id,
            p_actor_user_id, 'platform.workspace_provisioned', p_name, p_slug,
            p_owner_first_names, p_owner_last_name, p_owner_email, p_timezone
          );
        END
        $$
        """
    )
    _protect(_PROVISION_SIGNATURE, grant=True)

    op.execute(
        """
        CREATE FUNCTION public.slotera_auth_self_signup(
          p_workspace_id uuid,
          p_owner_user_id uuid,
          p_membership_id uuid,
          p_audit_event_id uuid,
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
        BEGIN
          -- The new owner is the actor of their own sign-up.
          RETURN public.slotera_workspace_create_with_owner(
            p_workspace_id, p_owner_user_id, p_membership_id, p_audit_event_id,
            p_owner_user_id, 'auth.workspace_signup', p_name, p_slug,
            p_owner_first_names, p_owner_last_name, p_owner_email, p_timezone
          );
        END
        $$
        """
    )
    _protect(_SIGNUP_SIGNATURE, grant=True)

    op.execute(
        """
        CREATE FUNCTION public.slotera_auth_slug_available(p_slug text)
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
          SELECT NOT EXISTS (SELECT 1 FROM public.reserved_workspace_slugs WHERE slug = p_slug)
             AND NOT EXISTS (SELECT 1 FROM public.workspaces WHERE slug = p_slug)
        $$
        """
    )
    _protect("public.slotera_auth_slug_available(text)", grant=True)


def downgrade() -> None:
    op.execute("DROP FUNCTION public.slotera_auth_slug_available(text)")
    op.execute(f"DROP FUNCTION {_SIGNUP_SIGNATURE}")
    op.execute(f"DROP FUNCTION {_PROVISION_SIGNATURE}")
    op.execute(
        f"""
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
        AS $${_ORIGINAL_PROVISION_BODY}$$
        """
    )
    _protect(_PROVISION_SIGNATURE, grant=True)
    op.execute(f"DROP FUNCTION {_CREATE_SIGNATURE}")
    op.drop_column("workspace_business_profiles", "onboarding_completed_at")
