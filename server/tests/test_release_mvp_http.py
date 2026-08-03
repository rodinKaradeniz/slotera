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
    def __init__(self) -> None:
        self.session_token = "session-token"
        self.csrf_token = "csrf-token"
        self.session = AuthSession(
            session_id=uuid4(),
            user_id=uuid4(),
            email="hello@slotera.app",
            title=None,
            first_names="Lena",
            last_name="Hartmann",
            role="operator_admin",
            workspace_id=uuid4(),
            workspace_name="Hartmann Strategy",
            workspace_slug="lena",
            csrf_token_hash=b"csrf",
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )
        self.reset_requests: list[str] = []
        self.consumed_tokens: list[tuple[str, str]] = []

    async def login(
        self,
        *,
        email: str,
        password: str,
        remember_me: bool,
        workspace_id: object,
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
        self.reset_requests.append(email)

    async def consume_password_reset(self, *, token: str, new_password: str) -> None:
        self.consumed_tokens.append((token, new_password))


async def test_password_reset_request_is_generic_and_no_store() -> None:
    auth = StubAuthService()
    app = create_app(database=StubDatabase(), auth_service=auth)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/password-reset/request",
            headers={"Origin": "http://localhost:3344"},
            json={"email": " Owner@Example.com "},
        )

    assert response.status_code == 202
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json() == {"accepted": True}
    assert auth.reset_requests == ["owner@example.com"]


async def test_password_reset_consume_rejects_short_password_before_service() -> None:
    auth = StubAuthService()
    app = create_app(database=StubDatabase(), auth_service=auth)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/password-reset/consume",
            headers={"Origin": "http://localhost:3344"},
            json={"token": "opaque-token", "newPassword": "short"},
        )

    assert response.status_code == 422
    assert auth.consumed_tokens == []


async def test_release_mvp_operation_ids_are_stable() -> None:
    app = create_app(database=StubDatabase(), auth_service=StubAuthService())
    operations = {
        operation["operationId"]
        for path in app.openapi()["paths"].values()
        for operation in path.values()
        if isinstance(operation, dict) and "operationId" in operation
    }

    assert {
        "requestPasswordReset",
        "consumePasswordReset",
        "getPaymentSettings",
        "updatePaymentSettings",
        "getPublicWorkspace",
        "listPublicServices",
        "listPublicServiceForms",
        "listPublicAvailability",
        "createPublicBooking",
    } <= operations
