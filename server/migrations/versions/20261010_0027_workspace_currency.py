"""Default workspaces to GBP and let sign-up and provisioning choose the currency.

Each workspace keeps one client-payment currency (bookings and payments snapshot it).
The allowed list is deliberately short; add a currency here when a real tenant needs it.
Workspaces without bookings move to GBP, since nothing has been charged in them yet.

Revision ID: 20261010_0027
Revises: 20261010_0026
Create Date: 2026-10-10
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261010_0027"
down_revision: str | None = "20261010_0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CURRENCIES = ("GBP", "EUR", "USD")

_CORE_ARGS = "uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text"
_PROVISION_ARGS = "uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text"
_SIGNUP_ARGS = "uuid, uuid, uuid, uuid, text, text, text, text, text, text"


def _protect(signature: str, *, grant: bool) -> None:
    op.execute(f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC")
    if grant:
        op.execute(f"GRANT EXECUTE ON FUNCTION {signature} TO slotera_app")


def _drop_functions(*, with_currency: bool) -> None:
    extra = ", text" if with_currency else ""
    op.execute(f"DROP FUNCTION public.slotera_auth_self_signup({_SIGNUP_ARGS}{extra})")
    op.execute(
        f"DROP FUNCTION public.slotera_platform_provision_workspace({_PROVISION_ARGS}{extra})"
    )
    op.execute(f"DROP FUNCTION public.slotera_workspace_create_with_owner({_CORE_ARGS}{extra})")


def _create_functions(*, with_currency: bool) -> None:
    """Create the three workspace-creation functions, with or without `p_currency`."""
    param = ",\n          p_currency text" if with_currency else ""
    currency_value = "p_currency" if with_currency else "'EUR'"
    passed = ", p_currency" if with_currency else ""
    extra = ", text" if with_currency else ""
    op.execute(
        f"""
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
          p_timezone text{param}
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
          VALUES (p_workspace_id, p_name, p_slug, {currency_value}, p_timezone);
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
            p_audit_action, 'workspace', p_workspace_id, '{{}}'::jsonb
          );
          RETURN 'created';
        END
        $$
        """
    )
    _protect(f"public.slotera_workspace_create_with_owner({_CORE_ARGS}{extra})", grant=False)

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
          p_timezone text{param}
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
            p_owner_first_names, p_owner_last_name, p_owner_email, p_timezone{passed}
          );
        END
        $$
        """
    )
    _protect(f"public.slotera_platform_provision_workspace({_PROVISION_ARGS}{extra})", grant=True)

    op.execute(
        f"""
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
          p_timezone text{param}
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
            p_owner_first_names, p_owner_last_name, p_owner_email, p_timezone{passed}
          );
        END
        $$
        """
    )
    _protect(f"public.slotera_auth_self_signup({_SIGNUP_ARGS}{extra})", grant=True)


def upgrade() -> None:
    allowed = ", ".join(f"'{code}'" for code in CURRENCIES)
    op.execute(
        f"""
        UPDATE workspaces SET currency = 'GBP'
        WHERE currency NOT IN ({allowed})
           OR NOT EXISTS (SELECT 1 FROM bookings WHERE bookings.workspace_id = workspaces.id)
        """
    )
    op.execute("ALTER TABLE workspaces ALTER COLUMN currency SET DEFAULT 'GBP'")
    op.create_check_constraint(
        "ck_workspaces_currency_supported", "workspaces", f"currency IN ({allowed})"
    )
    _drop_functions(with_currency=False)
    _create_functions(with_currency=True)


def downgrade() -> None:
    _drop_functions(with_currency=True)
    _create_functions(with_currency=False)
    op.drop_constraint("ck_workspaces_currency_supported", "workspaces", type_="check")
    op.execute("ALTER TABLE workspaces ALTER COLUMN currency SET DEFAULT 'EUR'")
