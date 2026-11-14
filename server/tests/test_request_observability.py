import json
import logging
from unittest.mock import patch

from slotera_api.config import Settings
from slotera_api.logging import JsonFormatter
from slotera_api.observability import _scrub_payload, init_sentry
from slotera_api.request_context import OperationContext, operation_context


def test_request_context_and_exception_values_are_safe() -> None:
    context = OperationContext("request-1", actor_id="user-1", workspace_id="workspace-1")
    token = operation_context.set(context)
    try:
        try:
            raise ValueError("secret@example.com token=secret")
        except ValueError:
            import sys

            record = logging.LogRecord(
                "slotera", logging.ERROR, __file__, 1, "query_failed", (), sys.exc_info()
            )
            record.message_id = "message-1"
            output = JsonFormatter().format(record)
        assert "secret" not in output
        payload = json.loads(output)
        assert payload["request_id"] == "request-1"
        assert payload["workspace_id"] == "workspace-1"
        assert payload["message_id"] == "message-1"
        assert payload["exception_type"] == "ValueError"
    finally:
        operation_context.reset(token)
    assert operation_context.get() is None


def test_sentry_stays_opt_in_and_scrubs_request_credentials() -> None:
    with patch("sentry_sdk.init") as initialize:
        init_sentry(Settings(_env_file=None, sentry_dsn=None))
        initialize.assert_not_called()
    output = _scrub_payload(
        {
            "request": {
                "url": "https://app.test/calendar/feed/secret.ics?token=secret",
                "headers": {"cookie": "secret"},
                "data": "secret",
            },
            "user": {"email": "secret@example.com"},
        }
    )
    assert "secret" not in json.dumps(output)
    assert output["request"]["url"] == "https://app.test/calendar/feed/[token].ics"


async def test_concurrent_contexts_never_share_actor_or_workspace() -> None:
    import asyncio

    async def operation(index: int) -> dict[str, object]:
        token = operation_context.set(
            OperationContext(
                f"request-{index}", actor_id=f"actor-{index}", workspace_id=f"workspace-{index}"
            )
        )
        try:
            await asyncio.sleep(0)
            record = logging.LogRecord("slotera", logging.INFO, __file__, 1, "read", (), None)
            return json.loads(JsonFormatter().format(record))
        finally:
            operation_context.reset(token)

    rows = await asyncio.gather(*(operation(index) for index in range(10)))
    for index, row in enumerate(rows):
        assert row["request_id"] == f"request-{index}"
        assert row["actor_id"] == f"actor-{index}"
        assert row["workspace_id"] == f"workspace-{index}"
    assert operation_context.get() is None


async def test_browser_edit_preflight_accepts_only_the_reviewed_headers() -> None:
    from httpx import ASGITransport, AsyncClient

    from slotera_api.main import create_app

    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://test"
    ) as client:
        response = await client.options(
            "/forms/00000000-0000-0000-0000-000000000000",
            headers={
                "Origin": "http://localhost:3344",
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": (
                    "content-type,x-csrf-token,if-match,x-series-version"
                ),
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:3344"
        rejected = await client.options(
            "/forms/example",
            headers={
                "Origin": "https://untrusted.example",
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "if-match",
            },
        )
        assert rejected.status_code == 400
        assert "access-control-allow-origin" not in rejected.headers


async def test_request_metrics_include_streamed_response_work() -> None:
    import asyncio

    from fastapi.responses import StreamingResponse
    from httpx import ASGITransport, AsyncClient

    from slotera_api.main import create_app

    app = create_app()

    @app.get("/test-stream")
    async def stream() -> StreamingResponse:
        async def body():
            yield "first"
            await asyncio.sleep(0.02)
            context = operation_context.get()
            assert context is not None
            context.db_query_count += 1
            yield "last"

        return StreamingResponse(body())

    with patch("slotera_api.middleware.logger.info") as logged:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/test-stream")
    assert response.text == "firstlast"
    metrics = logged.call_args.kwargs["extra"]
    assert metrics["db_query_count"] == 1
    assert metrics["duration_ms"] >= 20
    assert metrics["request_id"] == response.headers["x-request-id"]
    assert operation_context.get() is None


def test_server_fallback_logs_cannot_expose_urls_or_exception_values() -> None:
    from slotera_api.logging import configure_logging

    configure_logging("INFO")
    assert logging.getLogger("uvicorn.access").disabled
    record = logging.LogRecord(
        "uvicorn.error",
        logging.ERROR,
        __file__,
        1,
        "Failure with token=%s and email=%s",
        ("secret", "private@example.com"),
        None,
    )
    output = JsonFormatter().format(record)
    assert "secret" not in output and "private@example.com" not in output
    assert json.loads(output)["message"] == "server_error"
    assert isinstance(logging.getLogger("uvicorn.error").handlers[0].formatter, JsonFormatter)
