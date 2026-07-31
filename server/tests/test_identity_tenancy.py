from slotera_api.db.models import TENANT_TABLES, Base
from slotera_api.identity import hash_opaque_token, normalize_email
from slotera_api.seed import DEMO_SEED


def test_every_declared_tenant_table_carries_workspace_identity() -> None:
    tables = Base.metadata.tables

    assert {
        "audit_events",
        "workspace_memberships",
        "workspace_slug_history",
        "workspaces",
        "workspace_business_profiles",
            "workspace_locations",
            "services",
            "clients",
            "bookings",
            "booking_command_idempotency",
            "form_templates",
            "form_template_services",
            "client_notes",
            "session_action_items",
            "notifications",
        "availability_policies",
        "availability_windows",
        "availability_blackouts",
        "session_series",
        "sessions",
    } == TENANT_TABLES
    assert tables.keys() >= TENANT_TABLES
    for table_name in TENANT_TABLES - {"workspaces"}:
        assert "workspace_id" in tables[table_name].columns


def test_email_normalisation_is_stable_and_case_insensitive() -> None:
    assert normalize_email("  Hello@Slotera.App ") == "hello@slotera.app"
    assert normalize_email("HELLO@SLOTERA.APP") == "hello@slotera.app"


def test_opaque_tokens_are_stored_as_fixed_length_hashes() -> None:
    first = hash_opaque_token("a secret token")
    second = hash_opaque_token("a secret token")

    assert first == second
    assert len(first) == 32
    assert b"secret" not in first
    assert first != hash_opaque_token("a different token")


def test_demo_seed_matches_the_frontend_identity_fixture() -> None:
    assert DEMO_SEED.workspace.name == "Hartmann Strategy"
    assert DEMO_SEED.workspace.slug == "lena"
    assert DEMO_SEED.workspace.currency == "EUR"
    assert DEMO_SEED.workspace.timezone == "Europe/Berlin"
    assert DEMO_SEED.operator.email == "hello@slotera.app"
    assert DEMO_SEED.operator_membership.role == "operator_admin"
    assert DEMO_SEED.superadmin.email == "admin@slotera.app"
    assert DEMO_SEED.superadmin.platform_role == "superadmin"
