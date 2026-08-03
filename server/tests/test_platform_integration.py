from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import DEMO_SEED, import_demo_seed

DEMO_PASSWORD = "slotera-local-only"


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login",
        headers={"Origin": "http://localhost:3344"},
        json={"email": email, "password": DEMO_PASSWORD},
    )
    assert response.status_code == 200


def _csrf_headers(client: AsyncClient) -> dict[str, str]:
    csrf_token = client.cookies.get("slotera_csrf")
    assert csrf_token is not None
    return {"Origin": "http://localhost:3344", "X-CSRF-Token": csrf_token}


@pytest.mark.integration
async def test_superadmin_workspace_reads_are_private_and_display_safe() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as anonymous:
            denied = await anonymous.get("/platform/workspaces")
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as operator:
            await _login(operator, "hello@slotera.app")
            forbidden = await operator.get("/platform/workspaces")
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as superadmin:
            await _login(superadmin, "admin@slotera.app")
            directory = await superadmin.get("/platform/workspaces")
            detail = await superadmin.get(f"/platform/workspaces/{DEMO_SEED.workspace.id}")
    finally:
        await application.dispose()
        await owner.dispose()

    assert denied.status_code == 401
    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "platform_superadmin_required"
    assert directory.status_code == 200
    assert directory.headers["Cache-Control"] == "no-store"
    assert len(directory.json()["items"]) >= 1
    item = next(
        item for item in directory.json()["items"] if item["id"] == str(DEMO_SEED.workspace.id)
    )
    assert item["id"] == str(DEMO_SEED.workspace.id)
    assert item["name"] == "Hartmann Strategy"
    assert item["slug"] == "lena"
    assert item["ownerName"] == "Lena Maria Hartmann"
    assert item["ownerEmail"] == "hello@slotera.app"
    assert item["operationalStatus"] == "active"
    assert item["createdAt"] == "2025-09-01T10:00:00Z"
    assert all(
        isinstance(item[key], int)
        for key in ("servicesCount", "clientsCount", "bookingsCount", "sessionsCount")
    )
    assert detail.status_code == 200
    assert detail.json()["currency"] == "EUR"
    assert detail.json()["timezone"] == "Europe/Berlin"
    assert "notes" not in detail.json()


@pytest.mark.integration
async def test_superadmin_can_provision_a_workspace_without_global_table_access() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    suffix = uuid4().hex
    workspace_id: str | None = None
    payload = {
        "name": "North Star Coaching",
        "slug": f"north-star-{suffix}",
        "ownerFirstNames": "Noor",
        "ownerLastName": "Kaya",
        "ownerEmail": f"noor-{suffix}@northstar.example",
        "timezone": "Europe/Istanbul",
    }
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        app = create_app(database=application)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as operator:
            await _login(operator, "hello@slotera.app")
            forbidden = await operator.post(
                "/platform/workspaces",
                headers=_csrf_headers(operator),
                json=payload,
            )
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as superadmin:
            await _login(superadmin, "admin@slotera.app")
            csrf_rejected = await superadmin.post(
                "/platform/workspaces",
                headers={"Origin": "http://localhost:3344"},
                json=payload,
            )
            created = await superadmin.post(
                "/platform/workspaces",
                headers=_csrf_headers(superadmin),
                json=payload,
            )
            duplicate_slug = await superadmin.post(
                "/platform/workspaces",
                headers=_csrf_headers(superadmin),
                json=payload,
            )
            duplicate_email = await superadmin.post(
                "/platform/workspaces",
                headers=_csrf_headers(superadmin),
                json={**payload, "slug": f"north-star-follow-up-{suffix}"},
            )
            directory = await superadmin.get("/platform/workspaces")
        workspace_id = created.json()["id"] if created.status_code == 201 else None
        async with application.engine.connect() as connection:
            with pytest.raises(ProgrammingError):
                await connection.execute(text("SELECT email FROM public.users LIMIT 1"))
        async with owner.transaction() as session:
            provisioned_state = (
                (
                    await session.execute(
                        text(
                            """
                        SELECT
                          user_item.password_hash,
                          profile.email AS profile_email,
                          audit.action,
                          audit.actor_user_id
                        FROM public.users AS user_item
                        JOIN public.workspace_memberships AS membership
                          ON membership.user_id = user_item.id
                        JOIN public.workspace_business_profiles AS profile
                          ON profile.workspace_id = membership.workspace_id
                        JOIN public.audit_events AS audit
                          ON audit.workspace_id = membership.workspace_id
                        WHERE membership.workspace_id = :workspace_id
                          AND user_item.email = :owner_email
                        """
                        ),
                        {"workspace_id": workspace_id, "owner_email": payload["ownerEmail"]},
                    )
                )
                .mappings()
                .one()
            )
    finally:
        if workspace_id is not None:
            async with owner.transaction() as session:
                await session.execute(
                    text("DELETE FROM public.workspaces WHERE id = :workspace_id"),
                    {"workspace_id": workspace_id},
                )
                await session.execute(
                    text("DELETE FROM public.users WHERE email = :owner_email"),
                    {"owner_email": payload["ownerEmail"]},
                )
        await application.dispose()
        await owner.dispose()

    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "platform_superadmin_required"
    assert csrf_rejected.status_code == 403
    assert csrf_rejected.json()["error"]["code"] == "csrf_validation_failed"
    assert created.status_code == 201
    created_item = created.json()
    assert created_item["name"] == payload["name"]
    assert created_item["slug"] == payload["slug"]
    assert created_item["ownerName"] == "Noor Kaya"
    assert created_item["ownerEmail"] == payload["ownerEmail"]
    assert created_item["currency"] == "EUR"
    assert created_item["timezone"] == payload["timezone"]
    assert created_item["operationalStatus"] == "active"
    assert created_item["servicesCount"] == 0
    assert created_item["clientsCount"] == 0
    assert created_item["bookingsCount"] == 0
    assert created_item["sessionsCount"] == 0
    assert duplicate_slug.status_code == 409
    assert duplicate_slug.json()["error"]["code"] == "workspace_slug_taken"
    assert duplicate_email.status_code == 409
    assert duplicate_email.json()["error"]["code"] == "workspace_owner_email_taken"
    assert [item["id"] for item in directory.json()["items"]].count(created_item["id"]) == 1
    assert provisioned_state == {
        "password_hash": None,
        "profile_email": payload["ownerEmail"],
        "action": "platform.workspace_provisioned",
        "actor_user_id": DEMO_SEED.superadmin.id,
    }


@pytest.mark.integration
async def test_superadmin_workspace_suspension_revokes_access_and_is_audited_once() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        async with owner.transaction() as session:
            await session.execute(
                text(
                    """
                    UPDATE public.workspaces
                    SET operational_status = 'active'
                    WHERE id = :workspace_id
                    """
                ),
                {"workspace_id": DEMO_SEED.workspace.id},
            )
            await session.execute(
                text(
                    """
                    DELETE FROM public.audit_events
                    WHERE workspace_id = :workspace_id
                      AND action IN (
                        'platform.workspace_suspended',
                        'platform.workspace_reactivated'
                      )
                    """
                ),
                {"workspace_id": DEMO_SEED.workspace.id},
            )

        app = create_app(database=application)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as operator:
            await _login(operator, "hello@slotera.app")
            operator_forbidden = await operator.post(
                f"/platform/workspaces/{DEMO_SEED.workspace.id}/suspend",
                headers=_csrf_headers(operator),
            )

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as superadmin:
                await _login(superadmin, "admin@slotera.app")
                csrf_rejected = await superadmin.post(
                    f"/platform/workspaces/{DEMO_SEED.workspace.id}/suspend",
                    headers={"Origin": "http://localhost:3344"},
                )
                suspended = await superadmin.post(
                    f"/platform/workspaces/{DEMO_SEED.workspace.id}/suspend",
                    headers=_csrf_headers(superadmin),
                )
                suspended_retry = await superadmin.post(
                    f"/platform/workspaces/{DEMO_SEED.workspace.id}/suspend",
                    headers=_csrf_headers(superadmin),
                )

                revoked_session = await operator.get("/auth/session")
                blocked_login = await operator.post(
                    "/auth/login",
                    headers={"Origin": "http://localhost:3344"},
                    json={
                        "email": "hello@slotera.app",
                        "password": DEMO_PASSWORD,
                    },
                )

                reactivated = await superadmin.post(
                    f"/platform/workspaces/{DEMO_SEED.workspace.id}/reactivate",
                    headers=_csrf_headers(superadmin),
                )
                reactivated_retry = await superadmin.post(
                    f"/platform/workspaces/{DEMO_SEED.workspace.id}/reactivate",
                    headers=_csrf_headers(superadmin),
                )
                detail = await superadmin.get(f"/platform/workspaces/{DEMO_SEED.workspace.id}")

            restored_login = await operator.post(
                "/auth/login",
                headers={"Origin": "http://localhost:3344"},
                json={
                    "email": "hello@slotera.app",
                    "password": DEMO_PASSWORD,
                },
            )

        async with owner.transaction() as session:
            audit_actions = list(
                await session.scalars(
                    text(
                        """
                        SELECT action
                        FROM public.audit_events
                        WHERE workspace_id = :workspace_id
                          AND action IN (
                            'platform.workspace_suspended',
                            'platform.workspace_reactivated'
                          )
                        ORDER BY occurred_at, id
                        """
                    ),
                    {"workspace_id": DEMO_SEED.workspace.id},
                )
            )

        with pytest.raises(ProgrammingError):
            async with application.tenant_transaction(DEMO_SEED.workspace.id) as session:
                await session.execute(
                    text(
                        """
                        UPDATE public.workspaces
                        SET operational_status = 'suspended'
                        WHERE id = :workspace_id
                        """
                    ),
                    {"workspace_id": DEMO_SEED.workspace.id},
                )
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text(
                    """
                    UPDATE public.workspaces
                    SET operational_status = 'active'
                    WHERE id = :workspace_id
                    """
                ),
                {"workspace_id": DEMO_SEED.workspace.id},
            )
        await application.dispose()
        await owner.dispose()

    assert operator_forbidden.status_code == 403
    assert operator_forbidden.json()["error"]["code"] == "platform_superadmin_required"
    assert csrf_rejected.status_code == 403
    assert csrf_rejected.json()["error"]["code"] == "csrf_validation_failed"
    assert suspended.status_code == 200
    assert suspended.json()["operationalStatus"] == "suspended"
    assert suspended_retry.status_code == 200
    assert suspended_retry.json()["operationalStatus"] == "suspended"
    assert revoked_session.status_code == 401
    assert blocked_login.status_code == 403
    assert blocked_login.json()["error"]["code"] == "account_unavailable"
    assert reactivated.status_code == 200
    assert reactivated.json()["operationalStatus"] == "active"
    assert reactivated_retry.status_code == 200
    assert reactivated_retry.json()["operationalStatus"] == "active"
    assert detail.json()["operationalStatus"] == "active"
    assert restored_login.status_code == 200
    assert audit_actions == [
        "platform.workspace_suspended",
        "platform.workspace_reactivated",
    ]
