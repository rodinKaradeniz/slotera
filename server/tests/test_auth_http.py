from datetime import UTC, datetime, timedelta
from uuid import uuid4

from httpx import ASGITransport, AsyncClient

from slotera_api.auth.service import AuthResult, AuthSession, InvalidCredentials
from slotera_api.config import Settings
from slotera_api.main import create_app


class StubDatabase:
    async def healthcheck(self) -> None:
        pass

    async def dispose(self) -> None:
        pass


class StubAuthService:
    def __init__(self) -> None:
        self.login_calls = 0
        self.revoke_calls = 0
        self.session_token = "raw-session-token"
        self.csrf_token = "raw-csrf-token"
        self.session = AuthSession(
            session_id=uuid4(),
            user_id=uuid4(),
            email="hello@slotera.app",
            title="Dr.",
            first_names="Lena Maria",
            last_name="Hartmann",
            role="operator_admin",
            workspace_id=uuid4(),
            workspace_name="Hartmann Strategy",
            workspace_slug="lena",
            csrf_token_hash=b"csrf-hash",
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )

    async def login(
        self,
        *,
        email: str,
        password: str,
        remember_me: bool,
        workspace_id: str | None,
        client_key: str,
    ) -> AuthResult:
        self.login_calls += 1
        if password == "wrong":
            raise InvalidCredentials
        return AuthResult(
            session=self.session,
            session_token=self.session_token,
            csrf_token=self.csrf_token,
        )

    async def authenticate(self, session_token: str) -> AuthSession | None:
        return self.session if session_token == self.session_token else None

    def csrf_matches(self, session: AuthSession, csrf_token: str) -> bool:
        return session is self.session and csrf_token == self.csrf_token

    async def revoke(self, session_token: str) -> None:
        if session_token == self.session_token:
            self.revoke_calls += 1

    async def request_password_reset(self, *, email: str, client_key: str) -> None:
        pass

    async def consume_password_reset(self, *, token: str, new_password: str) -> None:
        pass


async def test_login_sets_http_only_session_and_readable_csrf_cookies() -> None:
    auth = StubAuthService()
    app = create_app(database=StubDatabase(), auth_service=auth)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/auth/login",
            headers={"Origin": "http://localhost:3344"},
            json={
                "email": " Hello@Slotera.App ",
                "password": "correct",
                "rememberMe": True,
            },
        )

    cookies = response.headers.get_list("set-cookie")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json()["user"]["role"] == "operator_admin"
    assert response.json()["workspace"]["slug"] == "lena"
    assert any(
        "slotera_session=raw-session-token" in cookie
        and "HttpOnly" in cookie
        and "SameSite=lax" in cookie
        for cookie in cookies
    )
    assert any(
        "slotera_csrf=raw-csrf-token" in cookie and "HttpOnly" not in cookie for cookie in cookies
    )


async def test_login_rejects_missing_origin_before_checking_credentials() -> None:
    auth = StubAuthService()
    app = create_app(database=StubDatabase(), auth_service=auth)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/login",
            json={"email": "hello@slotera.app", "password": "correct"},
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "untrusted_origin"
    assert auth.login_calls == 0


async def test_invalid_login_is_generic_and_sets_no_credentials() -> None:
    auth = StubAuthService()
    app = create_app(database=StubDatabase(), auth_service=auth)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/login",
            headers={"Origin": "http://localhost:3344"},
            json={"email": "hello@slotera.app", "password": "wrong"},
        )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"
    assert "set-cookie" not in response.headers


async def test_current_session_rejects_a_missing_cookie() -> None:
    app = create_app(database=StubDatabase(), auth_service=StubAuthService())

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/auth/session")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_required"


async def test_current_session_returns_no_store_profile() -> None:
    auth = StubAuthService()
    app = create_app(database=StubDatabase(), auth_service=auth)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set("slotera_session", auth.session_token)
        response = await client.get("/auth/session")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"


async def test_logout_requires_session_bound_csrf_before_revoking() -> None:
    auth = StubAuthService()
    app = create_app(database=StubDatabase(), auth_service=auth)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set("slotera_session", auth.session_token)
        client.cookies.set("slotera_csrf", auth.csrf_token)
        response = await client.post(
            "/auth/logout",
            headers={
                "Origin": "http://localhost:3344",
                "X-CSRF-Token": "different-token",
            },
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf_validation_failed"
    assert auth.revoke_calls == 0


async def test_logout_revokes_and_clears_both_cookies() -> None:
    auth = StubAuthService()
    app = create_app(database=StubDatabase(), auth_service=auth)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set("slotera_session", auth.session_token)
        client.cookies.set("slotera_csrf", auth.csrf_token)
        response = await client.post(
            "/auth/logout",
            headers={
                "Origin": "http://localhost:3344",
                "X-CSRF-Token": auth.csrf_token,
            },
        )

    cookies = response.headers.get_list("set-cookie")
    assert response.status_code == 204
    assert auth.revoke_calls == 1
    assert sum("Max-Age=0" in cookie for cookie in cookies) == 2


async def test_production_login_cookies_are_secure() -> None:
    settings = Settings(
        environment="production",
        database_url="postgresql+asyncpg://app:secret@db/slotera",
        cors_origins=["https://app.slotera.app"],
        csrf_cookie_domain=".slotera.app",
        public_web_base_url="https://app.slotera.app",
        email_provider="resend",
        resend_api_key="test-only-resend-key",
    )
    app = create_app(
        settings=settings,
        database=StubDatabase(),
        auth_service=StubAuthService(),
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="https://api.slotera.app"
    ) as client:
        response = await client.post(
            "/auth/login",
            headers={"Origin": "https://app.slotera.app"},
            json={"email": "hello@slotera.app", "password": "correct"},
        )

    assert all("Secure" in cookie for cookie in response.headers.get_list("set-cookie"))
