import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.auth.passwords import create_password_hasher
from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app
from slotera_api.seed import import_demo_seed

DEMO_EMAIL = "hello@slotera.app"
DEMO_PASSWORD = "slotera-local-only"
NEW_PASSWORD = "a-brand-new-password"
ORIGIN = "http://localhost:3344"


async def _login(client: AsyncClient, password: str) -> int:
    response = await client.post(
        "/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": DEMO_EMAIL, "password": password},
    )
    return response.status_code


def _csrf(client: AsyncClient) -> dict[str, str]:
    token = client.cookies.get("slotera_csrf")
    assert token is not None
    return {"Origin": ORIGIN, "X-CSRF-Token": token}


@pytest.mark.integration
async def test_password_change_reverifies_and_signs_out_other_sessions() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)
    try:
        await import_demo_seed(owner, demo_password=DEMO_PASSWORD)
        async with owner.transaction() as session:
            await session.execute(text("DELETE FROM request_rate_limits"))
        app = create_app(database=application)
        transport = ASGITransport(app=app)
        async with (
            AsyncClient(transport=transport, base_url="http://test") as this_device,
            AsyncClient(transport=transport, base_url="http://test") as other_device,
            AsyncClient(transport=transport, base_url="http://test") as fresh,
        ):
            assert await _login(this_device, DEMO_PASSWORD) == 200
            assert await _login(other_device, DEMO_PASSWORD) == 200
            no_csrf = await this_device.post(
                "/auth/password/change",
                headers={"Origin": ORIGIN},
                json={"currentPassword": DEMO_PASSWORD, "newPassword": NEW_PASSWORD},
            )
            wrong_current = await this_device.post(
                "/auth/password/change",
                headers=_csrf(this_device),
                json={"currentPassword": "not-the-password", "newPassword": NEW_PASSWORD},
            )
            changed = await this_device.post(
                "/auth/password/change",
                headers=_csrf(this_device),
                json={"currentPassword": DEMO_PASSWORD, "newPassword": NEW_PASSWORD},
            )
            this_after = await this_device.get("/auth/session")
            other_after = await other_device.get("/auth/session")
            old_login = await _login(fresh, DEMO_PASSWORD)
            new_login = await _login(fresh, NEW_PASSWORD)
    finally:
        async with owner.transaction() as session:
            await session.execute(
                text("UPDATE users SET password_hash = :hash WHERE email = :email"),
                {"hash": create_password_hasher().hash(DEMO_PASSWORD), "email": DEMO_EMAIL},
            )
            await session.execute(text("DELETE FROM request_rate_limits"))
        await application.dispose()
        await owner.dispose()

    assert no_csrf.status_code == 403
    assert wrong_current.status_code == 400
    assert wrong_current.json()["error"]["code"] == "current_password_incorrect"
    assert changed.status_code == 204
    assert this_after.status_code == 200
    assert other_after.status_code == 401
    assert old_login == 401
    assert new_login == 200
