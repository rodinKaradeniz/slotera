from hashlib import sha256

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from slotera_api.auth.passwords import create_password_hasher
from slotera_api.config import get_migration_settings, get_settings
from slotera_api.database import Database
from slotera_api.main import create_app

LOCAL_DEMO_PASSWORD = "slotera-local-only"


async def _set_demo_password(owner: Database) -> None:
    password_hash = create_password_hasher().hash(LOCAL_DEMO_PASSWORD)
    async with owner.transaction() as session:
        await session.execute(
            text(
                """
                UPDATE users
                SET password_hash = :password_hash
                WHERE email IN ('hello@slotera.app', 'admin@slotera.app')
                """
            ),
            {"password_hash": password_hash},
        )


@pytest.mark.integration
async def test_real_login_session_and_logout_are_revocable() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)

    try:
        await _set_demo_password(owner)

        app = create_app(database=application)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            login = await client.post(
                "/auth/login",
                headers={"Origin": "http://localhost:3344"},
                json={
                    "email": "HELLO@SLOTERA.APP",
                    "password": LOCAL_DEMO_PASSWORD,
                    "rememberMe": True,
                },
            )
            current = await client.get("/auth/session")
            csrf_token = client.cookies["slotera_csrf"]
            logout = await client.post(
                "/auth/logout",
                headers={
                    "Origin": "http://localhost:3344",
                    "X-CSRF-Token": csrf_token,
                },
            )
            after_logout = await client.get("/auth/session")

        assert login.status_code == 200
        assert login.json()["user"]["email"] == "hello@slotera.app"
        assert login.json()["user"]["role"] == "operator_admin"
        assert login.json()["workspace"]["slug"] == "lena"
        assert current.status_code == 200
        assert logout.status_code == 204
        assert after_logout.status_code == 401
    finally:
        await application.dispose()
        await owner.dispose()


@pytest.mark.integration
async def test_login_never_persists_raw_session_or_csrf_tokens() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)

    try:
        await _set_demo_password(owner)
        app = create_app(database=application)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/auth/login",
                headers={"Origin": "http://localhost:3344"},
                json={
                    "email": "hello@slotera.app",
                    "password": LOCAL_DEMO_PASSWORD,
                },
            )
            session_token = client.cookies["slotera_session"]
            csrf_token = client.cookies["slotera_csrf"]

        async with owner.transaction() as session:
            stored = (
                await session.execute(
                    text(
                        """
                        SELECT token_hash, csrf_token_hash
                        FROM auth_sessions
                        WHERE token_hash = :token_hash
                        """
                    ),
                    {"token_hash": sha256(session_token.encode()).digest()},
                )
            ).mappings().one()

        assert response.status_code == 200
        assert stored["token_hash"] == sha256(session_token.encode()).digest()
        assert stored["csrf_token_hash"] == sha256(csrf_token.encode()).digest()
        assert session_token.encode() not in stored["token_hash"]
        assert csrf_token.encode() not in stored["csrf_token_hash"]
    finally:
        await application.dispose()
        await owner.dispose()


@pytest.mark.integration
async def test_unknown_email_and_wrong_password_share_one_failure_contract() -> None:
    database = Database(get_settings().database_url)

    try:
        app = create_app(database=database)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            unknown = await client.post(
                "/auth/login",
                headers={"Origin": "http://localhost:3344"},
                json={"email": "missing@example.com", "password": "wrong"},
            )
            wrong = await client.post(
                "/auth/login",
                headers={"Origin": "http://localhost:3344"},
                json={"email": "hello@slotera.app", "password": "wrong"},
            )
    finally:
        await database.dispose()

    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["error"]["code"] == "invalid_credentials"
    assert wrong.json()["error"]["code"] == "invalid_credentials"
    assert unknown.json()["error"]["message"] == wrong.json()["error"]["message"]


@pytest.mark.integration
async def test_superadmin_session_has_no_synthetic_workspace() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)

    try:
        await _set_demo_password(owner)
        app = create_app(database=application)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/auth/login",
                headers={"Origin": "http://localhost:3344"},
                json={
                    "email": "admin@slotera.app",
                    "password": LOCAL_DEMO_PASSWORD,
                },
            )
    finally:
        await application.dispose()
        await owner.dispose()

    assert response.status_code == 200
    assert response.json()["user"]["role"] == "superadmin"
    assert response.json()["workspace"] is None


@pytest.mark.integration
async def test_expired_session_cookie_is_rejected() -> None:
    owner = Database(get_migration_settings().migration_database_url)
    application = Database(get_settings().database_url)

    try:
        await _set_demo_password(owner)
        app = create_app(database=application)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            login = await client.post(
                "/auth/login",
                headers={"Origin": "http://localhost:3344"},
                json={
                    "email": "hello@slotera.app",
                    "password": LOCAL_DEMO_PASSWORD,
                },
            )
            token_hash = sha256(client.cookies["slotera_session"].encode()).digest()
            async with owner.transaction() as session:
                await session.execute(
                    text(
                        """
                        UPDATE auth_sessions
                        SET created_at = statement_timestamp() - interval '2 days',
                            expires_at = statement_timestamp() - interval '1 day'
                        WHERE token_hash = :token_hash
                        """
                    ),
                    {"token_hash": token_hash},
                )
            expired = await client.get("/auth/session")
    finally:
        await application.dispose()
        await owner.dispose()

    assert login.status_code == 200
    assert expired.status_code == 401
    assert expired.json()["error"]["code"] == "authentication_required"
