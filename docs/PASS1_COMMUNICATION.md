# Client communication release

Implemented scope: dependency/browser security and startup ownership, client email-link
accounts, private messaging/digests, post-session follow-ups and shared dashboard tasks.
The default demo remains mock-backed; client authentication is API-only.

## Behavior

- Existing clients request a workspace-specific 15-minute single-use link; separate client
  sessions expire in 12 hours and expose Messages, Bookings and Account only.
- One immutable plain-text conversation belongs to each workspace/client; sending is
  idempotent, history is bounded and only a visible open thread refreshes every 15 seconds.
- Optional daily digests cover new unread messages through 9am in the workspace timezone;
  they contain no message bodies and do not repeat old unread messages.
- Services own separately saved follow-up rules, disabled by default, with a 24-hour delay.
  Completion snapshots the rule and optional form; operators can review Send now or Skip.
- Preparation and follow-up answers belong to distinct immutable booking assignments;
  follow-up submissions close 30 days after queueing and never alter financial state.
- Reviewed client-email transfers replace future destinations, revoke old client/booking
  access and preserve original booking snapshots; claimed affected mail blocks all changes.
- Dashboard To-do and Calendar use identical private task records, versions and due dates;
  live billing, notification and message actions resolve through their source.
- Exports, erasure, suspension, closure and workspace deletion include communication data;
  credential/digest tables and message writes remain behind narrow database capabilities.

## Architecture and security

The modular monolith, PostgreSQL, existing scheduling transaction gate, outbox worker,
service contracts and two mutable migrations remain. Communication mappings live in
`db/client_models.py`; client authorization/conversations in `client_access/`; field
validation is shared through `form_validation.py`. No Redis, WebSockets or extra service.

Production documents enforce nonce CSP, including system/maintenance pages; inline CSS
remains allowed for the existing React UI. Fixed-port preflight never kills another process;
the launcher shuts down only its owned process groups and runs maintenance every 15 minutes.

Next 16.4.6, Vitest 5.1.0, Sentry 11.12.0, Tiptap 3.34 and compatible Python updates are
locked. Current npm audit: seven moderate TypeScript-ESLint/Minimatch findings, zero high or
critical; upstream uses Minimatch ^10.2.2 while the available patched major is 11.
No forced dependency override or advisory suppression. Python audit is clean.

## Local verification

- Frontend: generated transport types, TypeScript, ESLint and 143 Vitest tests pass.
- Backend: 108 isolated and 100 real-PostgreSQL tests pass; Ruff and strict mypy pass.
- Production Webpack mock/API builds pass their fixture-retention/exclusion guards.
- All 16 production Chromium journeys pass: desktop/mobile EN/TR/DE, client sign-in,
  messaging, preferences, booking/forms, follow-up submission, tasks, reviewed session
  changes, cancellation, recurring scopes and enforced script nonces.
- Browser reports contain allow-listed metadata only; synthetic failure screenshots are
  permitted, while raw errors, access links, bodies, traces and video are excluded.
  Evidence: `performance/communication-browser-2026-11-17.json`.
- `scripts/browser-check` creates/drops a dedicated database and owns server cleanup;
  `prepare-auth` resets synthetic login counters only in that guarded database, preserving
  production throttles. Optional Playwright filters pass through the script.
- Two empty-database revisions apply; Alembic schema agreement is checked after reset.
- Performance: two workspaces × 1,000 clients/10,000 bookings, five concurrent readers;
  HTTP p95 82.14 ms, eight queries/read, max response 13,291 bytes; gate passes.
  Evidence: `performance/communication-2026-11-16.json`.
- Two isolated launcher tests pass. Python dependency audit is clean; npm counts above.
- Remote CI, live provider delivery and deployment were not run.

## Developer walkthrough

Stop the running stack first. This checkout's disposable database is reset after verification;
for another existing local database, run `./scripts/reset-db` before starting.

```bash
uv sync --locked --project server
npm ci --prefix web
./scripts/dev --api --no-env
```

Open `http://localhost:3344/login`; use `hello@slotera.io` / `slotera-local-only`.

1. Dashboard → To-do → type a title → Enter → check it: the row stays checked, without tabs.
2. Calendar → a session → Notes & Actions → add a task: Dashboard shows the same task;
   completing it in either place updates the other after navigation/refresh.
3. Clients → Sofia Marin → Messages → send text: Messages shows the same conversation.
4. In a separate private window, open `/client/lena/sign-in`, enter
   `sofia.marin@example.com` and request a link; use its local console link from
   `.logs/worker.log` privately: Messages shows the consultant's text; reply once.
5. Client Account → change language/digest preferences → Save → reload: values persist;
   Bookings shows only Sofia's bookings and opens their existing management page.
6. Services → Strategy Session → Edit → Follow-up → choose Session preparation →
   Save follow-up settings: the rule persists without replacing other service edits.
7. Bookings → Completed → Sofia Marin → Follow-up → Send now → confirm destination:
   the local outbox gets one follow-up; the form is available through the new management
   link for 30 days, accepts required No, then becomes read-only.
8. Clients → Sofia Marin → edit email → Save client → review transfer → Transfer access and save: old client
   sessions/links stop working; future booking mail uses the reviewed address and the
   original booking contact snapshot stays unchanged.
9. Ctrl-C → restart: owned application processes release ports; occupied foreign ports
   produce an actionable error without killing their owner.

For repeatable automated checks run `./scripts/browser-check`; it uses synthetic data and
never sends external email. Live provider tests stay in final integration verification.

## Boundaries and deliberate deviations

AI/assistant actions and briefings belong to Pass 2; voice, video, package credits, external
integrations and deployment remain outside this pass. Seven upstream moderate development-
tooling advisories are explicitly retained rather than forcing an incompatible major.
No approved feature is intentionally left as foundation-only work.


## Refactoring evaluation

- Communication persistence was extracted into a 226-line model module instead of enlarging
  the 1,314-line core mapping file; shared field validation now has one owner.
- The 1,173-line booking repository spans creation, lifecycle and email recovery; those
  transaction-level concerns are the useful split boundaries if a later feature requires it,
  rather than splitting commands mid-transaction solely to reduce line count.
- The 618-line SessionDrawer combines editing, attendees and private tasks; extracted task
  management already shares the dashboard surface, and no unrelated drawer rewrite is needed.
- The 5,910-line consolidated schema intentionally contains all fixed capabilities and RLS;
  keep the two-revision pre-production policy, then freeze a reviewed production baseline.

Final privacy regressions also prove a waiting client-preference write cannot restore erased
context, and workspace closure permanently revokes client credentials even after reactivation.


The 2026-11-17 simplification supersedes the original combined worklist: dashboard To-do now
shows general title-only tasks, with no system-action rows or session-task manager. Calendar
keeps its existing controls. Ask Slotera supports reviewed removal of general to-dos only.
