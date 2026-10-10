from typing import Any

import sentry_sdk

from slotera_api.config import Settings


def init_sentry(settings: Settings) -> None:
    """Report errors and sampled request timings to Sentry when a DSN is configured.

    Personal data stays out: no default PII (cookies, IPs, users), no request bodies, no
    query strings (search terms), no calendar-feed tokens and no local variables in stack
    frames. Health checks are never traced, which keeps the free plan's span quota for
    real traffic.
    """
    if not settings.sentry_dsn:
        return

    def sample(context: dict[str, Any]) -> float:
        path = str((context.get("asgi_scope") or {}).get("path", ""))
        return 0.0 if path.startswith("/health") else settings.sentry_traces_sample_rate

    def scrub(event: Any, _hint: Any) -> Any:
        request = event.get("request")
        if isinstance(request, dict):
            request.pop("query_string", None)
            url = request.get("url")
            if isinstance(url, str) and "/calendar/feed/" in url:
                request["url"] = url.split("/calendar/feed/")[0] + "/calendar/feed/[token].ics"
        return event

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        release=settings.release,
        traces_sampler=sample,
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size="never",
        before_send=scrub,
        before_send_transaction=scrub,
    )
