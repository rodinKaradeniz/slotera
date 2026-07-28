# Slotera API

Local FastAPI backend for Slotera. The portfolio/demo frontend remains mock-backed while
this service is developed independently.

## Prerequisites

- Python 3.13
- [uv](https://docs.astral.sh/uv/)
- Docker with Compose

## Setup

```bash
cp .env.example .env
uv sync
docker compose up -d db
uv run alembic upgrade head
uv run slotera-seed
uv run uvicorn slotera_api.main:app --reload --port 8000
```

The API documentation is available at `http://localhost:8000/docs`. Liveness is exposed
at `/health/live`; readiness, including PostgreSQL connectivity, is at `/health/ready`.
The local PostgreSQL service binds to `127.0.0.1:55432` to avoid colliding with other
projects that use the default host port.

`slotera-seed` is local/test-only and idempotently imports the Hartmann Strategy operator
workspace plus the seeded platform superadmin and reserved workspace slugs. It uses the
migration-owner connection because the runtime role is deliberately unable to read or
write global identity tables directly. Both seeded users receive the local password
`slotera-local-only` unless `SLOTERA_DEMO_SEED_PASSWORD` overrides it.

## Identity and tenancy boundary

The database stores users, opaque-session/CSRF and password-reset token hashes, workspaces,
memberships, workspace slug history/reservations, and append-only audit events. Seeded
passwords use Argon2id; raw passwords and raw session/CSRF credentials are never stored.

The implemented HTTP resources are:

- `POST /auth/login` — requires an exact configured `Origin`; issues the HttpOnly session
  cookie and readable session-bound CSRF cookie;
- `GET /auth/session` — returns the current user/role/workspace with `Cache-Control:
  no-store`;
- `POST /auth/logout` — requires the session cookie, CSRF cookie, matching
  `X-CSRF-Token`, and trusted Origin; revokes the database session before clearing cookies.

Cookies are non-Secure only in local/test HTTP environments. Production makes both
cookies Secure and requires `SLOTERA_CSRF_COOKIE_DOMAIN` (planned value `.slotera.app`) so
the `app.` sibling can read the CSRF cookie while the API-host session cookie stays
HttpOnly and host-only.

Tenant work must use `Database.tenant_transaction(workspace_id)`, which applies the
workspace id transaction-locally on the same PostgreSQL connection. Forced RLS then
scopes workspaces, memberships, slug history, and audit events. `Database.transaction()`
is for non-tenant infrastructure/identity repositories; it does not bypass RLS when used
through the restricted application role. PostgreSQL statement pooling is unsupported
because it would break this transaction-local context contract.

The runtime database role still has no table privilege on users, sessions, or reset
tokens. It receives `EXECUTE` only on four fixed-search-path functions for login identity
lookup, validated session creation, active-session lookup, and revocation. Authenticated
and CSRF-protected FastAPI dependencies are the entry points for future resource routers.

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
