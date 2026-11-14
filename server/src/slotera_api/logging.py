import json
import logging
from datetime import UTC, datetime
from typing import Any

from slotera_api.request_context import operation_context


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": ("server_error" if record.levelno >= logging.ERROR else "server_event")
            if record.name.startswith("uvicorn.")
            else record.getMessage(),
        }
        context = operation_context.get()
        if context:
            payload.update(
                request_id=context.request_id,
                operation_id=context.operation_id,
                actor_id=context.actor_id,
                workspace_id=context.workspace_id,
            )
        for field in (
            "request_id",
            "method",
            "path",
            "status_code",
            "duration_ms",
            "actor_id",
            "workspace_id",
            "operation_id",
            "provider_status",
            "resource_type",
            "resource_id",
            "message_id",
            "attempt",
            "error_code",
            "db_query_count",
            "db_duration_ms",
            "db_acquire_ms",
        ):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        if record.exc_info:
            # Exception strings can contain SQL parameters or provider response bodies.
            payload["exception_type"] = (
                record.exc_info[0].__name__ if record.exc_info[0] else "Unknown"
            )
            import traceback

            payload["frames"] = [
                {
                    "file": frame.filename.rsplit("/", 1)[-1],
                    "line": frame.lineno,
                    "function": frame.name,
                }
                for frame in traceback.extract_tb(record.exc_info[2])
            ]
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str) -> None:
    logger = logging.getLogger("slotera")
    logger.handlers.clear()
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.setLevel(level)
    logger.propagate = False
    # Raw access logs contain URLs (including private feed tokens). The ASGI
    # middleware already records route templates and safe request diagnostics.
    logging.getLogger("uvicorn.access").disabled = True
    server_errors = logging.getLogger("uvicorn.error")
    server_errors.handlers.clear()
    server_errors.addHandler(handler)
    server_errors.propagate = False
