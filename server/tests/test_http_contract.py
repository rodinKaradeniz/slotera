from httpx import ASGITransport, AsyncClient

from slotera_api.main import create_app


class StubDatabase:
    async def healthcheck(self) -> None:
        pass

    async def dispose(self) -> None:
        pass


async def test_unknown_route_uses_the_shared_error_contract() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app(database=StubDatabase())),
        base_url="http://test",
    ) as client:
        response = await client.get("/missing")

    payload = response.json()
    assert response.status_code == 404
    assert payload == {
        "error": {
            "code": "not_found",
            "message": "Not Found",
            "requestId": response.headers["X-Request-ID"],
        }
    }


async def test_request_ids_are_generated_per_request() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app(database=StubDatabase())),
        base_url="http://test",
    ) as client:
        first = await client.get("/health/live")
        second = await client.get("/health/live")

    assert first.headers["X-Request-ID"]
    assert second.headers["X-Request-ID"]
    assert first.headers["X-Request-ID"] != second.headers["X-Request-ID"]


async def test_unhandled_error_keeps_the_safe_error_contract() -> None:
    app = create_app(database=StubDatabase())

    async def explode() -> None:
        raise RuntimeError("sensitive implementation detail")

    app.add_api_route("/explode", explode)
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        response = await client.get("/explode")

    payload = response.json()
    assert response.status_code == 500
    assert payload["error"]["code"] == "internal_error"
    assert payload["error"]["message"] == "An unexpected error occurred"
    assert "sensitive implementation detail" not in response.text
    assert payload["error"]["requestId"] == response.headers["X-Request-ID"]


async def test_openapi_exposes_stable_health_operation_ids() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=create_app(database=StubDatabase())),
        base_url="http://test",
    ) as client:
        response = await client.get("/openapi.json")

    document = response.json()
    assert document["paths"]["/health/live"]["get"]["operationId"] == "getLiveness"
    assert document["paths"]["/health/ready"]["get"]["operationId"] == "getReadiness"
    assert document["paths"]["/auth/login"]["post"]["operationId"] == "login"
    assert (
        document["paths"]["/auth/session"]["get"]["operationId"]
        == "getCurrentSession"
    )
    assert document["paths"]["/auth/logout"]["post"]["operationId"] == "logout"
