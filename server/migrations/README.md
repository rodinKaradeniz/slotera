# Migrations

Alembic migrations run with `SLOTERA_MIGRATION_DATABASE_URL`, which belongs to the
database owner. The API itself uses `SLOTERA_DATABASE_URL` and the restricted
`slotera_app` role.

Create revisions only after importing the corresponding model modules in
`migrations/env.py`, so Alembic can see their metadata.
