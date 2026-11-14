# Architecture bundle — developer verification

## Start and reset

Schema changes require a reset of disposable local data. Stop the application first.

```sh
./scripts/reset-db
./scripts/dev --api
```

Open `http://localhost:3344`; sign in with `hello@slotera.io` / `slotera-local-only`.
The default `./scripts/dev` remains the mock demo. Never reset a production database.

## Bounded reads

- Sidebar → Bookings: expand a status; its page loads and full counts remain visible.
- Bookings → search/select service → Export: CSV contains every matching record.
- Click a booking: Form answers, Emails and Send booking details appear on its detail page.
- Sidebar → Clients → search → Export: matching clients and their complete statistics export.
- Sidebar → Forms or Packages → filter → click a card: editing data loads only on opening.
- Sidebar → Calendar → next week/month: only the visible interval loads, in workspace time.
- Calendar → group session → Attendance: page through attendees; bulk marking affects this page.

The small seed has fewer than 25 records per screen, so next-page controls are disabled.
Large paging/export boundaries are covered by PostgreSQL tests and the isolated benchmark.

## Cache and recovery

- Open Clients → Forms → Clients within 30 seconds: the client read is reused.
- Save a client, service, form or package: affected lists and counts refresh.
- Switch away and back to the browser tab: the session and visible reads refresh.
- Leave an editor open → stop API → return to the tab: the draft remains; retry after restart.
- Sign out in a second tab: private views and their in-memory caches clear in both tabs.
- Settings → Account → EN/TR/DE: preference persists; operator navbar has no language toggle.

Catalog/settings reads stay fresh for five minutes; operational reads for 30 seconds.
Inactive cache entries expire after five minutes. There is no polling or persisted query cache.

## Competing edits

- Open Forms → Session intake in two tabs; save a description change in the first.
- Save a different draft in the second: a stale-edit warning appears and the draft remains.
- Click Review latest version → Load latest version: explicitly replace the old draft.
- Repeat with a client or service; repeat across Settings → Business Profile and Branding.
- Staff: Superadmin → Workspaces → workspace → Billing; an older revision cannot save.
- Booking → Emails → address correction: an older reviewed address cannot replace a newer one.

Continue deferring live third-party delivery checks to the final integration-verification stage.

## Implementation and evidence

The bundle implements bounded operator/platform reads, joined booking summaries/details,
streamed exports, visible Calendar ranges, shared in-memory query/session ownership,
reviewed edit revisions, a build-selected fixture boundary, and request/database/worker tracing.
Settings sections share the business-profile revision; staff billing has a separate revision.
Booking locks, command idempotency, financial/form snapshots and tenant RLS remain enforced.

Verification results and limitations are recorded in HISTORY and the performance report.
Production builds use `npm run build -- --webpack`: Turbopack previously stalled in the agent
sandbox. Builds run in temporary copies excluding real environment files, with the same source,
lockfile and installed dependencies. Live delivery and deployment are not part of these checks.

## Repeat the isolated performance check

This command deletes only the dedicated benchmark database, never the normal showcase.

```sh
docker exec slotera-db-1 psql -U slotera_owner -d postgres -v ON_ERROR_STOP=1 \
  -c 'DROP DATABASE IF EXISTS slotera_architecture_perf WITH (FORCE)' \
  -c 'CREATE DATABASE slotera_architecture_perf OWNER slotera_owner'
cd server
SLOTERA_ENV_FILE='' \
SLOTERA_MIGRATION_DATABASE_URL='postgresql+asyncpg://slotera_owner:slotera_owner_local@localhost:55432/slotera_architecture_perf' \
.venv/bin/alembic upgrade head
SLOTERA_ENV_FILE='' .venv/bin/python scripts/benchmark_reads.py > /tmp/slotera-performance.json
```

The script seeds two synthetic workspaces with 1,000 clients and 10,000 bookings each,
updates PostgreSQL statistics, and measures warm repository and authenticated HTTP reads
with five concurrent readers. It records hardware, response sizes, SQL counts and a PostgreSQL
execution plan, and exits unsuccessfully if p95 exceeds 500 ms. HTTP measurements use ASGI
transport; production browser behavior is checked separately. No comparable pre-change
production measurement exists, so a numerical before/after improvement is not claimed.

The automatic postbuild fixture guard verifies API exclusion and mock retention. The saved
scale report passes at 129.63 ms authenticated HTTP p95, eight SQL statements per request,
and a maximum 13,291-byte response; this is a local measurement, not a hosted-service SLA.
