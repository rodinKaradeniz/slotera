# Local pre-production migrations

Exactly two revisions remain until the first production release:

- `0001_initial_schema.py`: complete PostgreSQL schema, constraints, RLS, capabilities and ACLs.
- `0002_showcase_data.py`: one-time local test data through the shared `slotera_api.seed` implementation.

Edit these in place; do not append revisions yet. From the repository root, stop the stack,
run `./scripts/reset-db`, then `./scripts/dev --api`. Reset deletes only the local Compose
`slotera` database. Regular startup applies migrations without reseeding existing records.
The explicit seed CLI remains available for tests/repair.

The baseline restores explicit permissions independently of previously configured default
grants. Migrations use `slotera_owner`; the application still uses restricted `slotera_app`.
Run integration tests against a separate disposable database, never the developer's
showcase database. Compare ORM metadata with `alembic check` after schema changes.

Before production, freeze a schema/system-data baseline without showcase users/data and
switch to incremental, immutable revisions. The current showcase revision rejects production.
