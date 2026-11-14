"""Repeatable repository-read benchmark; requires a migrated disposable *_perf database.

Run from server: SLOTERA_ENV_FILE='' .venv/bin/python scripts/benchmark_reads.py
Fixtures are kept out of the normal showcase and contain no deliverable email addresses.
"""

import asyncio
import json
import logging
import platform
from statistics import median
from time import perf_counter
from uuid import uuid4

from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert, select, text

from slotera_api.bookings.repository import BookingsRepository
from slotera_api.database import Database
from slotera_api.db.models import (
    Booking,
    Client,
    Service,
    Session,
    User,
    Workspace,
    WorkspaceMembership,
)
from slotera_api.main import create_app
from slotera_api.request_context import OperationContext, operation_context

DATABASE_NAME = "slotera_architecture_perf"


def copied(item: object) -> dict[str, object]:
    table = item.__table__  # type: ignore[attr-defined]
    return {column.name: getattr(item, column.name) for column in table.columns}


async def run() -> None:
    owner = Database(
        f"postgresql+asyncpg://slotera_owner:slotera_owner_local@localhost:55432/{DATABASE_NAME}"
    )
    application = Database(
        f"postgresql+asyncpg://slotera_app:slotera_app_local@localhost:55432/{DATABASE_NAME}"
    )
    scopes = []
    emails = []
    try:
        async with owner.transaction() as session:
            workspace = (await session.scalars(select(Workspace))).first()
            user = (await session.scalars(select(User).where(User.platform_role.is_(None)))).first()
            service = (await session.scalars(select(Service))).first()
            occurrence = (await session.scalars(select(Session))).first()
            booking = (await session.scalars(select(Booking))).first()
            assert workspace and user and service and occurrence and booking, (
                "Migrate showcase data first"
            )
            for number in (1, 2):
                wid, uid, sid, occurrence_id = uuid4(), uuid4(), uuid4(), uuid4()
                scopes.append(wid)
                emails.append(f"bench-owner-{uid}@example.com")
                await session.execute(
                    insert(User),
                    [{**copied(user), "id": uid, "email": f"bench-owner-{uid}@example.com"}],
                )
                await session.execute(
                    insert(Workspace),
                    [
                        {
                            **copied(workspace),
                            "id": wid,
                            "slug": f"benchmark-{wid}",
                            "name": f"Benchmark {number}",
                        }
                    ],
                )
                await session.execute(
                    insert(WorkspaceMembership),
                    [
                        {
                            "id": uuid4(),
                            "user_id": uid,
                            "workspace_id": wid,
                            "role": "operator_admin",
                        }
                    ],
                )
                await session.execute(
                    insert(Service), [{**copied(service), "id": sid, "workspace_id": wid}]
                )
                await session.execute(
                    insert(Session),
                    [
                        {
                            **copied(occurrence),
                            "id": occurrence_id,
                            "workspace_id": wid,
                            "calendar_owner_id": uid,
                            "series_id": None,
                            "service_id": sid,
                            "capacity": 10000,
                        }
                    ],
                )
                clients = [uuid4() for _ in range(1000)]
                await session.execute(
                    insert(Client),
                    [
                        {
                            "id": cid,
                            "workspace_id": wid,
                            "name": f"Benchmark client {index:04}",
                            "email": f"bench-{index}@example.invalid",
                        }
                        for index, cid in enumerate(clients)
                    ],
                )
                prototype = copied(booking)
                await session.execute(
                    insert(Booking),
                    [
                        {
                            **prototype,
                            "id": uuid4(),
                            "workspace_id": wid,
                            "session_id": occurrence_id,
                            "client_id": clients[index % 1000],
                            "reference": f"BENCH-{index:05}",
                            "customer_email": "benchmark@example.invalid",
                            "delivery_email_override": None,
                        }
                        for index in range(10000)
                    ],
                )
        async with owner.transaction() as session:
            for table in ("users", "workspaces", "services", "sessions", "clients", "bookings"):
                await session.execute(text(f"ANALYZE public.{table}"))
        semaphore = asyncio.Semaphore(5)
        measurements = []

        async def read(index: int) -> None:
            async with semaphore:
                context = OperationContext(str(uuid4()))
                token = operation_context.set(context)
                try:
                    start = perf_counter()
                    result = await BookingsRepository(application).list_summaries(
                        scopes[index % 2], limit=25, offset=0
                    )
                    elapsed = (perf_counter() - start) * 1000
                    assert len(result[0]) == 25 and result[1] == 10000
                    measurements.append(
                        {
                            "ms": elapsed,
                            "queries": context.db_query_count,
                            "db_ms": context.db_duration_ms,
                            "acquire_ms": context.db_acquire_ms,
                            "response_bytes": len(json.dumps(result, default=str).encode()),
                        }
                    )
                finally:
                    operation_context.reset(token)

        # Warm up connections and query plans before the recorded concurrent workload.
        await asyncio.gather(*(read(index) for index in range(5)))
        measurements.clear()
        await asyncio.gather(*(read(index) for index in range(100)))
        timings = sorted(item["ms"] for item in measurements)
        async with application.tenant_transaction(scopes[0]) as session:
            plan = (
                await session.execute(
                    text(
                        "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id FROM bookings "
                        "WHERE workspace_id=:workspace ORDER BY created_at DESC, id LIMIT 25"
                    ),
                    {"workspace": scopes[0]},
                )
            ).scalar_one()
        http_measurements: list[dict[str, object]] = []
        http_queries: list[int] = []
        app = create_app(database=application)

        class RequestMetrics(logging.Handler):
            def emit(self, record: logging.LogRecord) -> None:
                if getattr(record, "path", "") == "/bookings/summaries":
                    http_queries.append(record.db_query_count)

        metrics = RequestMetrics()
        logging.getLogger("slotera.http").addHandler(metrics)
        clients = [
            AsyncClient(transport=ASGITransport(app=app), base_url="http://test") for _ in range(5)
        ]
        try:
            for index, client in enumerate(clients):
                login = await client.post(
                    "/auth/login",
                    headers={"Origin": "http://localhost:3344"},
                    json={"email": emails[index % 2], "password": "slotera-local-only"},
                )
                assert login.status_code == 200, login.text

            async def http_read(index: int) -> None:
                # One sequential reader per verified session; five readers run concurrently.
                client = clients[index]
                for turn in range(21):
                    start = perf_counter()
                    response = await client.get(
                        "/bookings/summaries",
                        params={"limit": 25, "offset": 0 if turn % 2 == 0 else 9975},
                    )
                    elapsed = (perf_counter() - start) * 1000
                    assert response.status_code == 200, response.text
                    payload = response.json()
                    assert len(payload["items"]) == 25 and payload["total"] == 10000
                    if turn:
                        http_measurements.append({"ms": elapsed, "bytes": len(response.content)})

            await asyncio.gather(*(http_read(index) for index in range(5)))
        finally:
            for client in clients:
                await client.aclose()
            logging.getLogger("slotera.http").removeHandler(metrics)
        http_timings = sorted(float(item["ms"]) for item in http_measurements)
        report = {
            "hardware": platform.platform(),
            "processor": platform.machine(),
            "python": platform.python_version(),
            "workspaces": 2,
            "clients_per_workspace": 1000,
            "bookings_per_workspace": 10000,
            "concurrency": 5,
            "reads": 100,
            "p50_ms": round(median(timings), 2),
            "p95_ms": round(timings[94], 2),
            "queries_per_read": sorted({item["queries"] for item in measurements}),
            "response_bytes": max(item["response_bytes"] for item in measurements),
            "ledger_plan": plan,
            "level": "repository and authenticated ASGI HTTP; browser checked separately",
            "http": {
                "reads": len(http_measurements),
                "concurrency": 5,
                "p50_ms": round(median(http_timings), 2),
                "p95_ms": round(http_timings[94], 2),
                "queries_per_read": sorted(set(http_queries)),
                "max_response_bytes": max(item["bytes"] for item in http_measurements),
            },
            "fixture_statistics": "ANALYZE after bulk insert",
            "pass": timings[94] < 500 and http_timings[94] < 500,
        }
        print(json.dumps(report, indent=2, default=str))
        if not report["pass"]:
            raise SystemExit("Read latency exceeds the local performance gate")
    finally:
        await application.dispose()
        await owner.dispose()


if __name__ == "__main__":
    asyncio.run(run())
