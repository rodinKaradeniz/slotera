#!/bin/sh
# Runs once, when the database volume is first created. Mirrors
# server/docker/postgres/init/001_application_role.sql with a real password.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$SLOTERA_APP_DB_PASSWORD" <<'SQL'
CREATE ROLE slotera_app LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT CONNECT ON DATABASE slotera TO slotera_app;
GRANT USAGE ON SCHEMA public TO slotera_app;
ALTER DEFAULT PRIVILEGES FOR ROLE slotera_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO slotera_app;
ALTER DEFAULT PRIVILEGES FOR ROLE slotera_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO slotera_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
