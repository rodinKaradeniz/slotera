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
cookie uses the parent domain (`SLOTERA_CSRF_COOKIE_DOMAIN=.slotera.io`) so `app.` can
send the token. Do not put the API behind a path proxy. The bare domain (`ROOT_HOST`)
only redirects to `www.`.

**Each container gets only its own settings.** `deploy/.env` fills the `${...}` values in
the compose file; no container receives the whole file. Caddy sees only the host names
and `ACME_EMAIL`. The API, worker and maintenance job see the app database role, email
and Sentry settings, but never the owner password, the Sentry auth token or the Storage
Box login. Only `migrate` gets the owner connection. A new setting must be added to its
service in `compose.yaml` as well as to `deploy/.env.example`.

**Security headers** are set by Caddy on every host: HSTS (one year, no preload),
`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY` and a
`Permissions-Policy`; the API also sends `X-Robots-Tag: noindex`. There is no
Content-Security-Policy yet ([`TODO.md`](TODO.md)).

## First deployment

1. **Server:** create a Hetzner Cloud server (Ubuntu LTS; CX22 or larger is fine to
   start). Install Docker Engine with the compose plugin. Allow only ports 22, 80 and 443
   in the Hetzner firewall, and use SSH keys only.
2. **DNS:** point the bare domain (`slotera.io`), `www.`, `app.` and `api.` at the
   server (A and AAAA records).
3. **Code:** clone the repository on the server.
4. **Settings:** `cp deploy/.env.example deploy/.env` and fill it in. Generate both
   database passwords with `openssl rand -hex 32`, and run `chmod 600 deploy/.env`. Keep
   the real values in a password manager too; the file is the only other copy. The
   production configuration refuses
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
   cd server && uv run slotera-smoke --api https://api.slotera.io \
     --app https://app.slotera.io --demo https://www.slotera.io --workspace <slug>
   ```

8. **Email check:** send one message through Resend with the production settings:

   ```sh
   docker compose -f deploy/compose.yaml --env-file deploy/.env run --rm worker \
     slotera-send-test-email --to you@example.com
   ```

   It prints the Resend message id, or the status and error category (401: bad key,
   403: sending domain not verified, 422: rejected address or field). The superadmin
   overview also shows how many emails are waiting or failing, with the latest error.

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
  minutes. The script restores the newest dump into a scratch `restore_drill` database,
  prints the migration version and the workspace, client and booking counts, then drops
  it, even on failure. Production data is not touched.

  ```sh
  # newest dump on the server
  docker compose -f deploy/compose.yaml --env-file deploy/.env exec backup restore-drill.sh
  # first copy the dumps back from the Storage Box (proves the off-box copy works)
  docker compose -f deploy/compose.yaml --env-file deploy/.env exec backup \
    restore-drill.sh --from-storage-box
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
API) and health checks are never traced. Alerts go to the one plan user by email.

## Uptime

Sentry only sees errors; it cannot notice that the server is down. Use a free external
monitor (UptimeRobot or Better Stack's free tier), checking every 5 minutes and emailing
you on failure:

| Check | Expect |
|---|---|
| `https://api.slotera.io/health/ready` | 200 (fails when the database is unreachable) |
| `https://app.slotera.io/login` | 200 |
| `https://www.slotera.io/` | 200 |

During a maintenance window the web hosts return 503, so pause the web checks first.

## Live-release gate

Complete and record each item before telling real operators about `app.`:

1. **Restore drill:** a backup has been restored from the Storage Box (not only from the
   server) and checked.
2. **Clean install:** the stack was started from an empty volume with the real
   `deploy/.env`. The API connects only as `slotera_app`.
3. **Email:** Resend has a verified sending domain (SPF, DKIM, DMARC) matching
   `SLOTERA_EMAIL_FROM_ADDRESS`, and `slotera-send-test-email` succeeds. Activation, reset,
   booking confirmation and reminder emails were received on real inboxes.
4. **Monitoring:** both Sentry DSNs are set and a test error from each project has
   arrived. The [uptime](#uptime) checks are set up and a test alert has arrived. Error alerts reach a named person, and logs
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
