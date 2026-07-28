from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response

from slotera_api.main import create_app


class StubDatabase:
    def __init__(self, *, available: bool = True) -> None:
        self.available = available
        self.healthcheck_calls = 0

    async def healthcheck(self) -> None:
        self.healthcheck_calls += 1
        if not self.available:
            raise ConnectionError("database unavailable")

    async def dispose(self) -> None:
        pass


async def get(app: FastAPI, path: str) -> Response:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        return await client.get(path)


async def test_liveness_does_not_depend_on_postgres() -> None:
    database = StubDatabase(available=False)

    response = await get(create_app(database=database), "/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert database.healthcheck_calls == 0


async def test_readiness_reports_a_healthy_database() -> None:
    database = StubDatabase()

    response = await get(create_app(database=database), "/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "checks": {"database": "ok"}}
    assert database.healthcheck_calls == 1


async def test_readiness_fails_closed_when_database_is_unavailable() -> None:
    database = StubDatabase(available=False)

    response = await get(create_app(database=database), "/health/ready")

    payload = response.json()
    assert response.status_code == 503
    assert payload["error"]["code"] == "service_unavailable"
    assert payload["error"]["message"] == "Database readiness check failed"
    assert payload["error"]["requestId"] == response.headers["X-Request-ID"]
