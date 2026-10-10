from httpx import ASGITransport, AsyncClient

from slotera_api.config import Settings
from slotera_api.database import Database
from slotera_api.main import create_app


async def test_signup_is_refused_while_closed() -> None:
    settings = Settings(signup_open=False)
    app = create_app(settings=settings, database=Database(settings.database_url))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/signup",
            headers={"Origin": "http://localhost:3344"},
            json={
                "firstNames": "Ada",
                "lastName": "Lovelace",
                "email": "ada@example.com",
                "workspaceName": "Ada Coaching",
                "slug": "ada-coaching",
            },
        )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "signup_closed"
