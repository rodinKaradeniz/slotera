"""Request-local, value-free diagnostic context shared with database instrumentation."""

from contextvars import ContextVar
from dataclasses import dataclass


@dataclass
class OperationContext:
    request_id: str
    operation_id: str | None = None
    idempotency_digest: str | None = None
    actor_id: str | None = None
    workspace_id: str | None = None
    db_query_count: int = 0
    db_duration_ms: float = 0
    db_acquire_ms: float = 0


operation_context: ContextVar[OperationContext | None] = ContextVar(
    "operation_context", default=None
)
