from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from hashlib import sha256
from time import perf_counter
from typing import Any, Protocol
from uuid import UUID

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from slotera_api.request_context import operation_context


class DatabaseLifecycle(Protocol):
    async def healthcheck(self) -> None: ...

    async def dispose(self) -> None: ...


class Database:
    def __init__(self, database_url: str) -> None:
        self.engine: AsyncEngine = create_async_engine(
            database_url,
            pool_pre_ping=True,
            pool_recycle=300,
        )

        @event.listens_for(self.engine.sync_engine, "before_cursor_execute")
        def before_execute(
            conn: Any,
            cursor: Any,
            statement: Any,
            parameters: Any,
            execution_context: Any,
            executemany: Any,
        ) -> None:
            execution_context.slotera_started_at = perf_counter()
            context = operation_context.get()
            if context:
                context.db_query_count += 1

        @event.listens_for(self.engine.sync_engine, "after_cursor_execute")
        def after_execute(
            conn: Any,
            cursor: Any,
            statement: Any,
            parameters: Any,
            execution_context: Any,
            executemany: Any,
        ) -> None:
            context = operation_context.get()
            if context:
                context.db_duration_ms += (
                    perf_counter() - execution_context.slotera_started_at
                ) * 1000

        @event.listens_for(self.engine.sync_engine, "handle_error")
        def failed_execute(error_context: Any) -> None:
            context = operation_context.get()
            started = getattr(error_context.execution_context, "slotera_started_at", None)
            if context and started is not None:
                context.db_duration_ms += (perf_counter() - started) * 1000

        self.session_factory = async_sessionmaker(
            bind=self.engine,
            expire_on_commit=False,
        )

    async def healthcheck(self) -> None:
        async with self.engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[AsyncSession]:
        async with self.session_factory() as session, session.begin():
            started = perf_counter()
            await session.connection()
            context = operation_context.get()
            if context:
                context.db_acquire_ms += (perf_counter() - started) * 1000
            if context:
                await session.execute(
                    text(
                        "SELECT set_config('app.request_id', :request_id, true), "
                        "set_config('app.operation_id', :operation_id, true)"
                    ),
                    {
                        "request_id": context.request_id,
                        "operation_id": context.operation_id or context.request_id,
                    },
                )
            yield session

    @asynccontextmanager
    async def tenant_transaction(
        self, workspace_id: UUID, *, repeatable_read: bool = False
    ) -> AsyncIterator[AsyncSession]:
        async with self.session_factory() as session, session.begin():
            started = perf_counter()
            await session.connection()
            context = operation_context.get()
            if context:
                context.workspace_id = str(workspace_id)
                if context.idempotency_digest and not context.actor_id:
                    context.operation_id = sha256(
                        f"{workspace_id}:{context.idempotency_digest}".encode()
                    ).hexdigest()
                context.db_acquire_ms += (perf_counter() - started) * 1000
            if repeatable_read:
                await session.execute(
                    text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
                )
            await session.execute(
                text("SELECT set_config('app.current_workspace_id', :workspace_id, true)"),
                {"workspace_id": str(workspace_id)},
            )
            if context:
                await session.execute(
                    text(
                        "SELECT set_config('app.request_id', :request_id, true), "
                        "set_config('app.operation_id', :operation_id, true)"
                    ),
                    {
                        "request_id": context.request_id,
                        "operation_id": context.operation_id or context.request_id,
                    },
                )
            yield session

    @asynccontextmanager
    async def principal_transaction(
        self, workspace_id: UUID, user_id: UUID
    ) -> AsyncIterator[AsyncSession]:
        async with self.session_factory() as session, session.begin():
            started = perf_counter()
            await session.connection()
            context = operation_context.get()
            if context:
                context.db_acquire_ms += (perf_counter() - started) * 1000
            await session.execute(
                text(
                    """
                    SELECT
                      set_config('app.current_workspace_id', :workspace_id, true),
                      set_config('app.current_user_id', :user_id, true)
                    """
                ),
                {"workspace_id": str(workspace_id), "user_id": str(user_id)},
            )
            if context:
                await session.execute(
                    text(
                        "SELECT set_config('app.request_id', :request_id, true), "
                        "set_config('app.operation_id', :operation_id, true)"
                    ),
                    {
                        "request_id": context.request_id,
                        "operation_id": context.operation_id or context.request_id,
                    },
                )
            yield session

    async def dispose(self) -> None:
        await self.engine.dispose()
