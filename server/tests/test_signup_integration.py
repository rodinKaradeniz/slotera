from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import import_demo_seed

ORIGIN = {"Origin": "http://localhost:3344"}


@pytest.mark.integration
async def test_self_signup_creates_an_activation_pending_workspace_without_enumeration() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    suffix = uuid4().hex
    payload = {
        "workspaceName": "Quiet Harbour Coaching",
        "slug": f"quiet-harbour-{suffix}",
        "firstNames": "Ada",
        "lastName": "Yilmaz",
        "email": f"ada-{suffix}@harbour.example",
        "timezone": "Europe/Berlin",
        "currency": "EUR",
    }
    try:
        await import_demo_seed(owner, demo_password="slotera-local-only")
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
        app = create_app(database=application)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            before = await client.get(
                "/auth/signup/slug-availability", params={"slug": payload["slug"]}
            )
            no_origin = await client.post("/auth/signup", json=payload)
            created = await client.post("/auth/signup", headers=ORIGIN, json=payload)
            after = await client.get(
                "/auth/signup/slug-availability", params={"slug": payload["slug"]}
            )
            reserved = await client.get("/auth/signup/slug-availability", params={"slug": "lena"})
            taken_slug = await client.post(
                "/auth/signup",
                headers=ORIGIN,
                json={**payload, "email": f"other-{suffix}@harbour.example"},
            )
            # Same email, new slug: the same generic answer, no second workspace.
            repeat_email = await client.post(
                "/auth/signup",
                headers=ORIGIN,
                json={**payload, "slug": f"quiet-harbour-two-{suffix}"},
            )
        async with owner.transaction() as session:
            state = (
                (
                    await session.execute(
                        text(
                            """
                            SELECT
                              user_item.password_hash,
                              membership.role::text AS role,
                              workspace.currency,
                              audit.action,
                              audit.actor_user_id = user_item.id AS self_actor,
                              profile.onboarding_completed_at,
                              (SELECT count(*) FROM workspace_payment_settings AS payment
                                WHERE payment.workspace_id = workspace.id) AS payment_rows,
                              (SELECT count(*) FROM availability_policies AS policy
                                WHERE policy.workspace_id = workspace.id) AS availability_rows,
                              (SELECT count(*) FROM workspaces AS other
                                WHERE other.slug = :second_slug) AS second_workspaces,
                              (SELECT count(*) FROM email_outbox AS outbox
                                WHERE outbox.recipient_email = user_item.email
                                  AND outbox.kind = 'account_activation') AS activation_emails
                            FROM workspaces AS workspace
                            JOIN workspace_memberships AS membership
                              ON membership.workspace_id = workspace.id
                            JOIN users AS user_item ON user_item.id = membership.user_id
                            JOIN workspace_business_profiles AS profile
                              ON profile.workspace_id = workspace.id
                            JOIN audit_events AS audit ON audit.workspace_id = workspace.id
                            WHERE workspace.slug = :slug
                            """
                        ),
                        {
                            "slug": payload["slug"],
                            "second_slug": f"quiet-harbour-two-{suffix}",
                        },
                    )
                )
                .mappings()
                .one()
            )
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text("DELETE FROM workspaces WHERE slug = :slug"), {"slug": payload["slug"]}
            )
            await session.execute(
                text("DELETE FROM email_outbox WHERE recipient_email = :email"),
                {"email": payload["email"]},
            )
            await session.execute(
                text(
                    "DELETE FROM password_reset_tokens WHERE user_id IN "
                    "(SELECT id FROM users WHERE email = :email)"
                ),
                {"email": payload["email"]},
            )
            await session.execute(
                text("DELETE FROM users WHERE email = :email"), {"email": payload["email"]}
            )
            await session.execute(text("DELETE FROM request_rate_limits"))
        await application.dispose()
        await owner.dispose()

    assert before.json() == {"slug": payload["slug"], "available": True}
    assert no_origin.status_code == 403
    assert created.status_code == 202
    assert after.json()["available"] is False
    assert reserved.json()["available"] is False
    assert taken_slug.status_code == 409
    assert taken_slug.json()["error"]["code"] == "workspace_slug_unavailable"
    assert repeat_email.status_code == 202
    assert repeat_email.json() == created.json()
    assert state == {
        "password_hash": None,
        "role": "operator_admin",
        "currency": "EUR",
        "action": "auth.workspace_signup",
        "self_actor": True,
        "onboarding_completed_at": None,
        "payment_rows": 1,
        "availability_rows": 1,
        "second_workspaces": 0,
        "activation_emails": 2,
    }
