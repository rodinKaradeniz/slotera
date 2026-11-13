# Pilot release readiness

Status: **not ready to declare the pilot live**. This document records evidence, rather
than treating existing deployment code or a configured variable as a completed live check.
Live deployment and real-domain verification are outside this implementation.

## Evidence supplied by the developer

On 2026-11-13 the developer ran `./scripts/env-check --deploy` and supplied status-only
output. Backend settings validation passed and the command reported `0 problem(s)`.
The following deployment entries were nevertheless **empty**:

- `POSTGRES_PASSWORD` — developer must configure the deployment database password.
- `SLOTERA_APP_DB_PASSWORD` — developer must configure the restricted application role password.
- `STORAGE_BOX` — developer must configure the off-box backup destination.

Resend and Sentry settings were reported set; this establishes presence, not valid
credentials, working delivery, or received alerts. No secret values were requested or read.
Re-run `./scripts/env-check --deploy` after filling the empty entries and provide only its
names/statuses output.

## Owner checklist

| Required evidence | Owner | Status |
|---|---|---|
| Freeze production schema/system-data baseline without showcase accounts | Developer | Outstanding; local-only showcase migration rejects production |
| Release operator and rollback owner named | Developer | Awaiting names |
| Empty deployment entries above configured | Developer | Outstanding |
| Clean installation on deployment infrastructure | Release owner | Not verified |
| Backup restored from the off-box Storage Box and inspected | Release owner | Not verified |
| Activation, reset, confirmation, and reminder received in real inboxes | Release owner | Not verified |
| Sending-domain authentication checked | Release owner | Not verified |
| Sentry test events received in API and web projects | Release owner | Not verified |
| Uptime test alert received by a named person | Release owner | Not verified |
| At least 14 days of logs retained | Release owner | Not verified |
| Incorporation, applicable registration/fee, and solicitor-reviewed legal pages | Developer/legal adviser | Not verified |
| Export and erasure exercised with pilot data | Release owner | Not verified live |
| Real-domain smoke and manual booking/manage/calendar-feed walkthrough | Release owner | Not verified |
| Release CI passes and previous image is available for rollback | Release owner | Not verified for release |

Use the procedures in [DEPLOYMENT.md](DEPLOYMENT.md), including its rollback procedure.
Record the date, environment, person, and result beside each item when evidence exists.
Do not paste activation links, calendar tokens, manage tokens, credentials, or client data.

## Code verification

Implementation verification is reported separately from operational release readiness.
Local checks do not satisfy the real-domain and external-provider checklist above.

Local evidence recorded on 2026-11-13:

- Frontend: `npx tsc --noEmit`, `npm run lint`, and `npm test` passed (86 tests).
- Backend: `.venv/bin/pytest` passed (92 isolated tests), and the complete
  `.venv/bin/pytest -m integration` suite passed (59 tests) against real PostgreSQL 17.
  Additional focused runs covered concurrent identical submissions, billing-inbox
  attribution, and workspace deletion with package references.
- `.venv/bin/ruff check .` and `.venv/bin/mypy` passed (103 source files).
- `npm run generate:api` regenerated the transport contract; both mock and API production
  builds passed with real environment files blocked from reads.
- An empty disposable database migrated to head; the populated database downgraded to
  `20261027_0036` and upgraded through all four new migrations successfully.
- The API production server completed booking → required intake → confirmation → optional
  false answer → read-only answers in EN/TR/DE at desktop and 390px mobile sizes.
  Theme and overflow checks passed; consultant-written questions remained unchanged.
- Browser checks covered package information/private-note exclusion, inherited currency
  in the package drawer, persisted branding settings, an interval-only billing request
  with unchanged recorded billing, and an operator language preference after reload.
  Operator intake answers were read-only; a client dialog retained the scoped colour/font,
  and a real local 429 recovered through the translated retry control after the test
  throttle cleared.

All browser customers, bookings and inquiries were synthetic and used disposable local
databases. The email worker was not started for those journeys; queued messages were not
delivered to real inboxes. These checks provide no external-provider or deployment evidence.


## Local baseline reset pass — 2026-11-13

The old development chain is replaced by schema revision `0001` and showcase revision
`0002`; prior revision ids above are historical evidence. A clean install and a full
base → head rebuild succeeded. The schema comparison against the old final state matched
after PostgreSQL's equivalent array-cast normalization, including ACLs and stored functions.
`alembic check` reports no upgrade operations. Repeat explicit seed inserts zero rows.
The full PostgreSQL integration suite passes 60 tests; isolated backend tests pass 92;
frontend tests pass 92. The development database is reset separately from the integration
database, leaving six clients, three services, two forms, two packages and eight bookings.
No live checks or deployment were performed.

Browser checks for this pass covered creating exactly one form, reopening its desktop/mobile
editor, all six shared drawer consumers, and the four real KPI cards. The empty schedule was
rendered with a temporary browser response fixture on desktop/mobile; its calendar action
navigated correctly. A deleted seeded form stayed deleted after `dev --prepare-only --no-env`;
the final explicit reset restored the two clean templates. No synthetic integration rows were
left in the development database.
