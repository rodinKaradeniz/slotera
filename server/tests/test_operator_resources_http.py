from datetime import UTC, datetime, timedelta
from uuid import uuid4

from httpx import ASGITransport, AsyncClient

from slotera_api.auth.service import AuthResult, AuthSession
from slotera_api.main import create_app


class StubDatabase:
    async def healthcheck(self) -> None:
        pass

    async def dispose(self) -> None:
        pass


class StubAuthService:
    def __init__(self, *, role: str = "operator_admin") -> None:
        workspace_id = uuid4() if role == "operator_admin" else None
        self.session_token = "session-token"
        self.csrf_token = "csrf-token"
        self.session = AuthSession(
            session_id=uuid4(),
            user_id=uuid4(),
            email="operator@example.com",
            title=None,
            first_names="Test",
            last_name="Operator",
            role=role,  # type: ignore[arg-type]
            workspace_id=workspace_id,
            workspace_name="Test Workspace" if workspace_id else None,
            workspace_slug="test-workspace" if workspace_id else None,
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
        pass

    async def request_password_reset(self, *, email: str, client_key: str) -> None:
        pass

    async def consume_password_reset(self, *, token: str, new_password: str) -> None:
        pass


async def test_operator_resources_require_a_session() -> None:
    app = create_app(database=StubDatabase(), auth_service=StubAuthService())

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        settings = await client.get("/settings/business")
        services = await client.get("/services")
        notifications = await client.get("/notifications")

    assert settings.status_code == 401
    assert settings.json()["error"]["code"] == "authentication_required"
    assert services.status_code == 401
    assert notifications.status_code == 401


async def test_superadmin_cannot_enter_an_operator_workspace_resource() -> None:
    auth = StubAuthService(role="superadmin")
    app = create_app(database=StubDatabase(), auth_service=auth)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set("slotera_session", auth.session_token)
        response = await client.get("/services")
        notifications = await client.get("/notifications")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "operator_workspace_required"
    assert notifications.status_code == 403
    assert notifications.json()["error"]["code"] == "operator_workspace_required"


async def test_service_mutation_requires_session_bound_csrf() -> None:
    auth = StubAuthService()
    app = create_app(database=StubDatabase(), auth_service=auth)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set("slotera_session", auth.session_token)
        client.cookies.set("slotera_csrf", auth.csrf_token)
        response = await client.post(
            "/services",
            headers={"Origin": "http://localhost:3344"},
            json={},
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf_validation_failed"


async def test_marking_notifications_read_requires_session_bound_csrf() -> None:
    auth = StubAuthService()
    app = create_app(database=StubDatabase(), auth_service=auth)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set("slotera_session", auth.session_token)
        client.cookies.set("slotera_csrf", auth.csrf_token)
        response = await client.post(
            "/notifications/mark-all-read",
            headers={"Origin": "http://localhost:3344"},
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf_validation_failed"
