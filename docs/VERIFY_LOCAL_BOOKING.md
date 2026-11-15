# Local booking workflows

From the repository root:

```bash
./scripts/reset-db       # once for this changed baseline; deletes disposable local data
./scripts/dev --api --no-env
```

Open `http://localhost:3344`, then sign in with `hello@slotera.io` / `slotera-local-only`.
This uses local defaults and console email; real environment files and external delivery are excluded.

## Pass 1: transactional changes

- Calendar → an upcoming session → Edit session → change its meeting/location detail → Save changes → review counts → Save changes; active clients receive one queued update.
- Bookings → Confirmed or Pending → a booking → Emails; see the update and superseded unsent older notices.
- Calendar → the session → Edit session → Cancel session → review → Cancel session; pending/confirmed bookings cancel together and financial/payment facts stay unchanged.
- For a paid session, the cancellation dialog explains that refunds must be arranged manually.
- Try capacity below active attendees or a service change with booking history; the server rejects it and keeps the draft.

## Pass 2: recurring and private controls

- Calendar → New session → choose a service/time → Recurrence: Weekly → Create session.
- Open its next occurrence → Edit session → Apply to: This and following → change time/location/capacity → Save changes → confirm; later dates stay fixed and local times follow DST.
- Open a later occurrence → Edit session → This and following → Cancel session → confirm; earlier occurrences remain and later generation stops.
- Calendar → session → Notes & Actions; tasks have private title, description and due date, with no visibility toggle.
- Settings → Account → EN/TR/DE → reload; the language persists, sign-in copy is translated and upcoming dashboard cards include a date.
- Close a session drawer and click the same Calendar event; it reopens immediately.
- Overlapping active/cancelled day or week cards appear side by side; both can be opened.

## Pass 3: repeatable browser checks

No normal database reset or running app is needed; Docker PostgreSQL must be available.

```bash
web/node_modules/.bin/playwright install chromium  # first run only
./scripts/browser-check
```

The runner migrates its own disposable database, copies source/dependencies without real env files,
builds production API mode, starts API/frontend on 8011/3345, tests desktop/mobile in EN/TR/DE,
and removes the servers/database afterward. The worker stays stopped so queued metadata is
observable; nothing is sent externally. Output is `web/browser-artifacts/results.json` plus
synthetic screenshots on failure. Raw test contexts are deleted; traces/video are disabled.
The CI browser job is configured but has not been run remotely from this working session.

## Evidence

- Frontend: TypeScript, ESLint and 136 Vitest tests pass.
- Backend: 107 isolated tests and 93 real-PostgreSQL tests pass; Ruff and strict mypy are clean.
- Production builds: environment-free Webpack API and mock builds pass, including fixture exclusion/retention guards.
- Browser: eight Chromium journeys pass (six desktop/mobile EN/TR/DE flows plus two recurring-control flows), covering operator creation, list-to-detail navigation, optional form submission, reviewed edits, stale-impact recovery, cancellation, language persistence and horizontal overflow; recurring tests exercise scope, date preservation and cancellation on both layouts.
- Migrations: empty database reaches 0002; Alembic schema comparison reports no new operations.
- The 14 focused session-command cases cover private notes, terminal history, fractional reminder keys, revoked-link races, competing writes and isolated generation templates.

Browser result metadata is in `verification/local-booking-browser-2026-11-15.json`.
No remote CI, external delivery or production deployment was performed.

The read benchmark uses two isolated workspaces, each with 1,000 clients and 10,000 bookings.
Five concurrent readers achieved HTTP p95 143.56 ms, eight queries/read and a maximum 13,291-byte
response; the established 500 ms gate passes. This is local warm-database/ASGI evidence, not a
network or live deployment result; see `performance/local-workflows-2026-11-15.json`.

Live third-party delivery, deployment and operational verification remain on standby.
The separate dependency audit finding and required framework/test-runner upgrades are in TODO.
