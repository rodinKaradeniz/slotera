"""Request diagnostics span the complete ASGI response, including streamed exports."""

import logging
from hashlib import sha256
from time import perf_counter
from uuid import uuid4

import sentry_sdk
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from slotera_api.request_context import OperationContext, operation_context

logger = logging.getLogger("slotera.http")


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request = Request(scope)
        request_id = str(uuid4())
        request.state.request_id = request_id
        key = request.headers.get("idempotency-key")
        context = OperationContext(
            request_id,
            operation_id=request_id,
            idempotency_digest=sha256(key.encode()).hexdigest() if key else None,
        )
        request.state.operation_context = context
        token = operation_context.set(context)
        started = perf_counter()
        status = 500

        async def traced_send(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                headers = [
                    (name, value)
                    for name, value in message.get("headers", [])
                    if name.lower() != b"x-request-id"
                ]
                message = {**message, "headers": [*headers, (b"x-request-id", request_id.encode())]}
            await send(message)

        try:
            with sentry_sdk.isolation_scope() as sentry_scope:
                sentry_scope.set_tag("request_id", request_id)
                await self.app(scope, receive, traced_send)
        finally:
            elapsed = round((perf_counter() - started) * 1000, 2)
            log = logger.warning if elapsed >= 500 else logger.info
            log(
                "request_completed",
                extra={
                    "request_id": request_id,
                    "operation_id": context.operation_id,
                    "method": request.method,
                    "path": getattr(scope.get("route"), "path", "<unmatched>"),
                    "actor_id": context.actor_id,
                    "workspace_id": context.workspace_id,
                    "db_query_count": context.db_query_count,
                    "db_duration_ms": round(context.db_duration_ms, 2),
                    "db_acquire_ms": round(context.db_acquire_ms, 2),
                    "status_code": status,
                    "error_code": getattr(request.state, "error_code", None)
                    or ("internal_error" if status == 500 else None),
                    "duration_ms": elapsed,
                },
            )
            operation_context.reset(token)
