# Deployment and live-release guide

Slotera runs on **one Hetzner Cloud server** with Docker Compose. That is enough for the
MVP and keeps operations to one machine, one compose file and one backup job (rule 0 in
[`RULES.md`](RULES.md)). Move to managed services only when load or uptime needs it.

This guide does not mean the app is ready for real customer data. Complete the
[live-release gate](#live-release-gate) first.

## What runs where

Everything is defined in [`deploy/compose.yaml`](../deploy/compose.yaml):

| Service | Purpose | Public |
|---|---|---|
| `caddy` | HTTPS (automatic certificates) and reverse proxy | ports 80/443 |
| `web-demo` | Portfolio demo, `NEXT_PUBLIC_DATA_SOURCE=mock` | `www.` |
| `web-app` | Real app, `NEXT_PUBLIC_DATA_SOURCE=api` | `app.` |
| `api` | FastAPI (`/health/ready` health check) | `api.` |
| `migrate` | `alembic upgrade head`, once per deploy; the API, worker, jobs and backups wait for it | — |
| `worker` | Transactional email outbox (one replica; claims work with `SKIP LOCKED`) | — |
| `maintenance` | `slotera-maintenance` every 15 minutes: auth clean-up, booking reminders, recurring-series top-up | — |
| `db` | PostgreSQL 17; the API uses the restricted `slotera_app` role | — |
| `backup` | Nightly `pg_dump`, 14 days kept, mirrored to a Hetzner Storage Box | — |

The demo and the app are two images because `NEXT_PUBLIC_*` values are compiled in. The
demo never receives an API URL, so the mock/API boundary holds. The API, worker,
maintenance and migrate services share one server image (`server/Dockerfile`).

Use sibling origins. The session cookie stays host-only on `api.`. The readable CSRF
cookie uses the parent domain (`SLOTERA_CSRF_COOKIE_DOMAIN=.slotera.app`) so `app.` can
send the token. Do not put the API behind a path proxy.

## First deployment

1. **Server:** create a Hetzner Cloud server (Ubuntu LTS; CX22 or larger is fine to
   start). Install Docker Engine with the compose plugin. Allow only ports 22, 80 and 443
   in the Hetzner firewall, and use SSH keys only.
2. **DNS:** point `www.`, `app.` and `api.` at the server (A and AAAA records).
3. **Code:** clone the repository on the server.
4. **Settings:** `cp deploy/.env.example deploy/.env` and fill it in. Generate both
   database passwords with `openssl rand -hex 32`. The production configuration refuses
   to start with local credentials, a console email provider, a missing CSRF cookie
   domain, or a non-HTTPS web URL.
5. **Off-box backups:** order a Hetzner Storage Box (in a different location from the
   server). Put an SSH key at `deploy/backup/ssh/id_ed25519` (git-ignored), add its
   public half to the Storage Box, and set `STORAGE_BOX=uXXXXX@uXXXXX.your-storagebox.de`.
   Then fill in the Sentry values ([Monitoring](#monitoring-sentry)). Leave
   `SLOTERA_SIGNUP_OPEN=false` for the invite-only pilot; it is also compiled into the app
   image, so rebuild `web-app` after changing it. Set `SUPPORT_EMAIL`.
6. **Start:** from the repository root, run:

   ```sh
   RELEASE=$(git rev-parse --short HEAD) \
     docker compose -f deploy/compose.yaml --env-file deploy/.env up -d --build
   ```

   On first start the database volume runs `deploy/postgres/init`, which creates the
   restricted `slotera_app` role. Then `migrate` builds the schema.
7. **Smoke test:** from any machine with the repository, run the read-only check, then
   the manual flows in the live-release gate:

   ```sh
   cd server && uv run slotera-smoke --api https://api.slotera.app \
     --app https://app.slotera.app --demo https://www.slotera.app --workspace <slug>
   ```

Never run the demo seed in production; the server rejects it by design.

## Releasing

```sh
git pull
RELEASE=$(git rev-parse --short HEAD) \
  docker compose -f deploy/compose.yaml --env-file deploy/.env up -d --build
```

Migrations run before the new API starts. Every migration has a tested downgrade, but
prefer additive migrations so the previous release can still run against the new schema.

**Rollback:** images are tagged with `RELEASE`, so redeploy the previous tag without
rebuilding:

```sh
RELEASE=<previous-sha> docker compose -f deploy/compose.yaml --env-file deploy/.env up -d
```

If the rollback crosses a migration, first run
`docker compose -f deploy/compose.yaml --env-file deploy/.env run --rm migrate alembic downgrade <revision>`.

**Maintenance window:** set `MAINTENANCE_MODE=1` in `deploy/.env` and run
`up -d web-demo web-app`. Every page then returns the maintenance page with HTTP 503 and
`Retry-After`. Set it back to `0` afterwards.

## Backups and restore

- `backup` writes `slotera-<timestamp>.dump` daily (`pg_dump --format=custom`), deletes
  local dumps older than 14 days, and mirrors the folder to the Storage Box.
- **Restore drill:** do this before launch and then every quarter. It takes a few
  minutes:

  ```sh
  docker compose -f deploy/compose.yaml --env-file deploy/.env exec backup sh -c '
    f=$(ls -t /backups/*.dump | head -1)
    createdb restore_drill && pg_restore --dbname=restore_drill "$f" &&
    psql -d restore_drill -tAc "select version_num from alembic_version" &&
    dropdb restore_drill'
  ```

- **Real restore:** stop `api`, `worker` and `maintenance`. Drop and recreate the
  `slotera` database, then `pg_restore` the chosen dump into it and start the services
  again. Losing up to a day of data is the current trade-off. Add WAL archiving only if
  that stops being acceptable.

## Monitoring (Sentry)

Errors go to Merulio's Sentry organisation (EU region, free Developer plan). There are two
projects: `slotera-api` (Python: API, email worker, maintenance job) and `slotera-web`
(Next.js: the real app's browser, server and proxy). Each is off while its DSN is empty,
and the demo image never gets a DSN.

| `deploy/.env` | Value |
|---|---|
| `SLOTERA_SENTRY_DSN` | `slotera-api` project → Settings → Client Keys (DSN) |
| `SENTRY_WEB_DSN` | `slotera-web` project → Settings → Client Keys (DSN); compiled into the app image |
| `SENTRY_ORG` | the organisation slug (Settings → General) |
| `SENTRY_WEB_PROJECT` | `slotera-web` |
| `SENTRY_AUTH_TOKEN` | an organisation token (Settings → Auth Tokens); used only at build time, as a BuildKit secret, to upload source maps |

`RELEASE` doubles as the Sentry release, so an error names the deploy that caused it. The
API tags each event with `request_id`, the same value as the `X-Request-ID` header and
the JSON logs.

**Personal data:** no default PII, request bodies or stack-frame variables are sent, and
every URL loses its query string and fragment (manage tokens, reset tokens, search
terms). Session Replay is deliberately not installed. An exception message can still
contain an email address; the privacy policy says so.

**Free plan limits:** traces are sampled at 10% (`SLOTERA_SENTRY_TRACES_SAMPLE_RATE` for the
API) and health checks are never traced. Set one Sentry uptime monitor on
`https://api.…/health/ready` in the Sentry web UI if the plan includes it; otherwise use a
free external uptime checker. Alerts go to the one plan user by email.

## Live-release gate

Complete and record each item before telling real operators about `app.`:

1. **Restore drill:** a backup has been restored from the Storage Box (not only from the
   server) and checked.
2. **Clean install:** the stack was started from an empty volume with the real
   `deploy/.env`. The API connects only as `slotera_app`.
3. **Email:** Resend has a verified sending domain (SPF, DKIM, DMARC). Activation, reset,
   booking confirmation and reminder emails were received on real inboxes.
4. **Monitoring:** both Sentry DSNs are set and a test error from each project has
   arrived. An uptime check watches `https://api.…/health/ready` and both web hosts (a 503
   from the maintenance page counts as down). Error alerts reach a named person, and logs
   are kept for at least 14 days (`docker compose logs` or a log shipper).
5. **Legal:** the ICO data protection fee is paid for Merulio Ltd. The draft [Terms](../web/src/content/legal/terms.md),
   [Privacy Policy](../web/src/content/legal/privacy.md) and
   [DPA](../web/src/content/legal/dpa.md) have been reviewed by a solicitor, the
   bracketed items are filled in, and Merulio Ltd is incorporated. Client export and
   erasure are on each client's page.
6. **Smoke test on the real domains:** `slotera-smoke` passes; then by hand: login; reset;
   a pilot application promoted to a workspace and its activation email; onboarding; a
   public booking with its `.ics` attachment; manage link, reschedule and cancel; the
   calendar feed in a real calendar app; suspension; and email worker delivery.
7. **CI and ownership:** GitHub Actions is green for the release commit, and a rollback
   owner is named.

Card payments (Stripe Connect), calendar integrations and package credits are outside
this launch. They wait for Merulio's incorporation. Do not enable a card-payment UI until
verified payment webhooks exist.
