"""Opt-in Sentry reporting with request secrets removed before transmission."""

from typing import Any, cast
from urllib.parse import urlsplit, urlunsplit

import sentry_sdk
from sentry_sdk.types import Event, Hint

from slotera_api.calendar_feed import redact_feed_path
from slotera_api.config import Settings


def _safe_url(value: str) -> str:
    try:
        parts = urlsplit(value)
        return urlunsplit(
            (parts.scheme, parts.netloc.rsplit("@", 1)[-1], redact_feed_path(parts.path), "", "")
        )
    except ValueError:
        return "[redacted]"


def _scrub_payload(event: dict[str, Any]) -> dict[str, Any]:
    request = event.get("request")
    if isinstance(request, dict):
        for key in ("data", "cookies", "headers", "query_string", "env"):
            request.pop(key, None)
        if isinstance(request.get("url"), str):
            request["url"] = _safe_url(request["url"])
    event.pop("user", None)
    for crumb in event.get("breadcrumbs", {}).get("values", []):
        data = crumb.get("data", {})
        for key in list(data):
            if key in {"url", "from", "to", "http.url"} and isinstance(data[key], str):
                data[key] = _safe_url(data[key])
            elif key not in {"method", "status_code"}:
                data.pop(key, None)
        crumb.pop("message", None)
    for value in event.get("exception", {}).get("values", []):
        value["value"] = "[redacted]"
        for frame in value.get("stacktrace", {}).get("frames", []):
            frame.pop("vars", None)
    for span in event.get("spans", []):
        span.pop("description", None)
        span.pop("data", None)
    return event


def _scrub_event(event: Event, hint: Hint) -> Event:
    return cast(Event, _scrub_payload(cast(dict[str, Any], event)))


def init_sentry(settings: Settings) -> None:
    if not settings.sentry_dsn:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        release=settings.release,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size="never",
        before_send=_scrub_event,
        before_send_transaction=_scrub_event,
    )
