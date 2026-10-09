# Deployment and live-release guide

This is a deployment guide, not a claim that the API is already safe to launch with real
customer data. The product has two intentionally separate release paths.

## Recommended topology

| Surface | Recommended host | Domain | Data source |
|---|---|---|---|
| Portfolio/demo | Vercel | `www.slotera.app` | `mock` |
| Live web app | Vercel | `app.slotera.app` | `api` |
| API | Railway | `api.slotera.app` | FastAPI + PostgreSQL |
| Transactional email worker | Railway worker service | no public domain | shared PostgreSQL outbox |
| Scheduled maintenance | Railway cron service | no public domain | shared PostgreSQL |

This shape preserves the deliberate mock/API boundary: the public portfolio demo never
receives a production API URL or real-auth configuration. Vercel supports a `web/` project
inside this repository; select `web` as its Root Directory. Railway supports a `server/`
service in the same repository. See the official [Vercel monorepo guide](https://vercel.com/docs/monorepos)
and [Railway deployment configuration reference](https://docs.railway.com/config-as-code/reference).

Use sibling origins for the live application. The API session cookie remains host-only on
`api.slotera.app`; the readable CSRF cookie must use `.slotera.app` so `app.slotera.app`
can send the session-bound token. Do not put the API under a path proxy or mix the live API
into the portfolio demo.

## Vercel projects

Create two Vercel projects from this repository, each with Root Directory `web`.

| Project | Domain | Required environment variables |
|---|---|---|
| Demo | `www.slotera.app` | `NEXT_PUBLIC_DATA_SOURCE=mock` |
| Live app | `app.slotera.app` | `NEXT_PUBLIC_DATA_SOURCE=api`, `NEXT_PUBLIC_API_BASE_URL=https://api.slotera.app`, `NEXT_PUBLIC_CSRF_COOKIE_NAME=slotera_csrf` |

Use the same variables in the matching preview environment only when its API has a matching
preview origin. The API validates an exact origin for every unsafe authenticated request.

## Railway services

Create one Railway project with a managed PostgreSQL service and three services sourced from
the `server` directory:

| Service | Start command | Notes |
|---|---|---|
| API | `uv run uvicorn slotera_api.main:app --host 0.0.0.0 --port $PORT` | Health check: `/health/ready` |
| Email worker | `uv run slotera-email-worker` | One replica; it safely claims outbox work with `SKIP LOCKED` |
| Maintenance cron | `uv run slotera-maintenance` | Every 15 minutes (auth cleanup + booking reminders); no public domain |

Before the first API deployment and before every schema-changing release, run
`uv run alembic upgrade head` as Railway's API pre-deploy command. Do not run the local demo
seed in production: the server rejects it by design.

Set all secrets in Railway, never in this repository:

```text
SLOTERA_ENVIRONMENT=production
SLOTERA_DATABASE_URL=<restricted slotera_app PostgreSQL URL>
SLOTERA_MIGRATION_DATABASE_URL=<slotera_owner PostgreSQL URL>
SLOTERA_CORS_ORIGINS=["https://app.slotera.app"]
SLOTERA_PUBLIC_WEB_BASE_URL=https://app.slotera.app
SLOTERA_CSRF_COOKIE_DOMAIN=.slotera.app
SLOTERA_EMAIL_PROVIDER=resend
SLOTERA_EMAIL_FROM_ADDRESS=Slotera <no-reply@slotera.app>
SLOTERA_RESEND_API_KEY=<secret>
```

The production configuration deliberately refuses to start with local database credentials,
a console email provider, a missing shared CSRF-cookie domain, or a non-HTTPS public web URL.

## Live-release gate

Complete and record each item before enabling the live Vercel application:

1. Managed PostgreSQL has point-in-time recovery, encrypted backups, and a successful
   restore drill.
2. Database roles and migrations have been applied from empty production infrastructure;
   the API only has the restricted runtime URL.
3. Resend has a verified sending domain and a real activation/reset/booking delivery smoke
   test has passed.
4. Error monitoring, alert routing, structured-log retention, uptime checks for both
   `/health/live` and `/health/ready`, and an on-call owner exist.
5. A privacy/data-handling policy covers retention, client export, and erasure by
   anonymisation while retaining only financial facts that must be retained.
6. API origin, cookie, CSRF, login, reset, public booking, suspension, and email-worker
   smoke tests have passed on the actual `app.` / `api.` domains.
7. GitHub Actions is green for the release revision and a rollback owner/runbook is named.

Stripe, calendar
integrations, reminders, and package credits are deliberately outside this launch slice.
Do not enable a card-payment UI until verified payment webhooks are implemented.
