from slotera_api.db.models import TENANT_TABLES, Base
from slotera_api.identity import hash_opaque_token, normalize_email
from slotera_api.seed import DEMO_SEED
from slotera_api.workspace_data import EXPORTED_TABLES, NOT_EXPORTED_TABLES


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
        "public_booking_idempotency",
        "booking_form_responses",
        "booking_access_tokens",
        "calendar_feed_tokens",
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
        "workspace_payment_settings",
    } == TENANT_TABLES
    assert tables.keys() >= TENANT_TABLES
    for table_name in TENANT_TABLES - {"workspaces"}:
        assert "workspace_id" in tables[table_name].columns


def test_email_normalisation_is_stable_and_case_insensitive() -> None:
    assert normalize_email("  Hello@Slotera.IO ") == "hello@slotera.io"
    assert normalize_email("HELLO@SLOTERA.IO") == "hello@slotera.io"


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
    assert DEMO_SEED.workspace.currency == "GBP"
    assert DEMO_SEED.workspace.timezone == "Europe/Berlin"
    assert DEMO_SEED.operator.email == "hello@slotera.io"
    assert DEMO_SEED.operator_membership.role == "operator_admin"
    assert DEMO_SEED.superadmin.email == "admin@slotera.io"
    assert DEMO_SEED.superadmin.platform_role == "superadmin"


def test_every_tenant_table_is_either_exported_or_deliberately_left_out() -> None:
    exported = set(EXPORTED_TABLES)
    assert len(exported) == len(EXPORTED_TABLES)
    assert not exported & NOT_EXPORTED_TABLES
    assert exported | NOT_EXPORTED_TABLES == TENANT_TABLES
