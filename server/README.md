# Slotera API

Local FastAPI backend for Slotera. The portfolio/demo frontend remains mock-backed while
this service is developed independently.

## Prerequisites

- Python 3.13
- [uv](https://docs.astral.sh/uv/)
- Docker with Compose

## Setup

From the repository root, the recommended path is:

```bash
./scripts/dev
./scripts/dev --api  # opt the frontend into the implemented local operator API bundle
```

This synchronizes backend and frontend dependencies, starts and waits for PostgreSQL,
applies pending migrations, imports the idempotent seed, and runs the API, transactional
email worker, and frontend. Use `./scripts/dev --prepare-only` to stop after preparation.
Ctrl-C stops the application processes but leaves PostgreSQL and its persistent volume
running.

The preparation path also runs `npm run generate:api` in `web/`. That command exports
FastAPI's OpenAPI document to `web/src/api/generated/openapi.json` and regenerates the
TypeScript transport declarations beside it. Generated types are consumed only by the
frontend API/service boundary.

The equivalent backend-only commands are:

```bash
cp .env.example .env
uv sync
docker compose up -d db
uv run alembic upgrade head
uv run slotera-seed
uv run uvicorn slotera_api.main:app --reload --port 8000
uv run slotera-email-worker  # local console output includes sensitive one-time links
```

The API documentation is available at `http://localhost:8000/docs`. Liveness is exposed
at `/health/live`; readiness, including PostgreSQL connectivity, is at `/health/ready`.
The local PostgreSQL service binds to `127.0.0.1:55432` to avoid colliding with other
projects that use the default host port.

Alembic creates and owns the `alembic_version` table in the same database. `alembic
upgrade head` compares that recorded revision with the migration graph and applies only
newer revisions, providing the same core migration-history mechanism as Flyway's schema
history table.

`slotera-seed` is local/test-only and idempotently imports the Hartmann Strategy operator
workspace, business profile, saved locations, services, platform superadmin, and reserved
workspace slugs, plus the workspace's default weekday availability. It uses the
migration-owner connection because the runtime role is deliberately unable to read or
write global identity tables directly. Both seeded users receive the local password
`slotera-local-only` unless `SLOTERA_DEMO_SEED_PASSWORD` overrides it.

## Implemented HTTP resources

The database stores users, opaque-session/CSRF and password-reset token hashes, workspaces,
memberships, workspace slug history/reservations, business profiles, saved locations,
services, and append-only audit events. Seeded passwords use Argon2id; raw passwords and
raw session/CSRF credentials are never stored.

- `POST /auth/login` — requires an exact configured `Origin`; issues the HttpOnly session
  cookie and readable session-bound CSRF cookie;
- `GET /auth/session` — returns the current user/role/workspace with `Cache-Control:
  no-store`;
- `POST /auth/logout` — requires the session cookie, CSRF cookie, matching
  `X-CSRF-Token`, and trusted Origin; revokes the database session before clearing cookies.
- `POST /auth/password-reset/request` and `/consume` — generic, PostgreSQL-rate-limited
  reset/activation flow with hashed expiring credentials and session revocation.
- `GET/PATCH /settings/business` — reads and updates the authenticated operator's
  workspace profile; workspace currency and slug are read-only.
- `GET/PATCH /settings/payments` — configures workspace-wide offline payment instructions,
  provider booking terms, and gross-inclusive `none | fixed` tax treatment.
- `GET/POST /settings/locations` and `PATCH/DELETE /settings/locations/{id}` — manages
  structured saved locations.
- `GET/POST /services` and `GET/PATCH/DELETE /services/{id}` — manages operator services;
  list filters are `search`, `active`, and `locationType`, and currency is inherited from
  the workspace rather than accepted in service input.
- `GET /notifications` — returns the verified operator's structured notification events
  plus the total unread count;
- `POST /notifications/mark-all-read` — acknowledges that operator's unread events and
  requires the normal Origin/session-bound CSRF checks.
- `GET/POST /platform/workspaces` plus item `GET` — exposes display-safe workspace facts
  and audited initial provisioning only to a platform superadmin.
- `POST /platform/workspaces/{id}/suspend` and `/reactivate` — changes only operational
  access state; suspension revokes existing operator sessions and blocks new ones while
  retaining tenant data and leaving subscription/payment state untouched.
- `GET/PUT /availability` — reads or atomically replaces workspace timezone, weekly
  windows, slot/buffer/notice policy, and blackout ranges.
- `GET/POST /sessions` and `GET/PATCH /sessions/{id}` — manages one-off and recurring
  materialised sessions; patches choose `scope=this` or `scope=this_and_following`.
- `/public/workspaces/{slug}` catalog/forms/availability reads and `POST .../bookings` —
  allow-listed capacity-one open-mode booking with free/manual state, server tax/form
  snapshots, rate limiting, exact-Origin validation, and idempotency.

All operator mutations use the same Origin and session-bound CSRF checks as logout.
Superadmin sessions do not implicitly enter an operator workspace. Authenticated resource
responses are `no-store`, and service notes remain operator-only; the public catalog is a
separate explicit allow-list.

`slotera-email-worker` claims outbox rows with `FOR UPDATE SKIP LOCKED`, retries failures
with bounded backoff, and redacts delivered credential-bearing bodies. The `console`
provider is local/test-only and prints activation URLs to sensitive local logs. Production
configuration requires `SLOTERA_EMAIL_PROVIDER=resend`, an API key, HTTPS public web URL,
and the existing production cookie settings. Run `slotera-maintenance` periodically to
remove stale sessions, reset tokens, rate-limit buckets, and delivered outbox rows.

## Identity and tenancy boundary

Cookies are non-Secure only in local/test HTTP environments. Production makes both
cookies Secure and requires `SLOTERA_CSRF_COOKIE_DOMAIN` (planned value `.slotera.app`) so
the `app.` sibling can read the CSRF cookie while the API-host session cookie stays
HttpOnly and host-only.

Tenant work must use `Database.tenant_transaction(workspace_id)`, which applies the
workspace id transaction-locally on the same PostgreSQL connection. Forced RLS then
scopes workspaces, memberships, slug history, audit events, business profiles, saved
locations, and services. `Database.transaction()`
is for non-tenant infrastructure/identity repositories; it does not bypass RLS when used
through the restricted application role. User-targeted resources use
`Database.principal_transaction(workspace_id, user_id)` so RLS can enforce both scopes.
PostgreSQL statement pooling is unsupported
because it would break this transaction-local context contract.

The runtime database role still has no table privilege on users, sessions, or reset
tokens and cannot update the workspace root table directly. It receives `EXECUTE` on
fixed-search-path auth functions and narrow platform projection/provisioning/status
capabilities rather than a generic global-table or RLS bypass. Authenticated
Operator-resource dependencies layer role/workspace enforcement over the authenticated and
CSRF-protected request contexts. Notifications are membership-backed and the runtime role
can update only their `read_at` column—not payloads, recipients, or resource references.

## Checks

```bash
uv run pytest
uv run pytest -m integration
uv run ruff check .
uv run mypy
```

The integration test expects the local Compose database to be running. Migrations use the
owner connection; the application and readiness check use the restricted application
role.
