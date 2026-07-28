# Slotera — Deferred Work & Future Directions

What is deliberately **not** built. Known gaps, deferred items, and future architectural
directions — written down rather than silently carried.

**Read this when** planning new work, or when something you're touching relates to a
deferred concern. An item appearing here means the omission was a decision, not an
oversight; check the reasoning before "fixing" it.

**Maintain it by** marking completed items **in place** with strikethrough + `DONE` and a
note on what changed, rather than deleting them — the reasoning trail is the point:

```markdown
- **~~Original wording of the item~~ DONE.** What was built and how it differs from the
  original plan.
```

Items are grouped by kind, then roughly by how soon they matter.

---

## 1. Correctness & hygiene — small, worth doing soon

- **`web/src/types/index.ts` is an incomplete barrel.** It re-exports `common`, `address`,
  `service`, `session`, `booking`, `client`, `dashboard`, `notification`, `settings`,
  `auth`, `billing`, and `platform` — but **not** `form`, `package`, `client-note`,
  `session-action-item`, or `demo`. Those five are imported from their modules directly
  everywhere, so nothing is broken, but the barrel now lies about being the domain
  surface. Either complete it or delete it; a half-barrel is the worst of both. Check for
  name collisions before completing it (several modules export a `*Status` type).

- **`@tiptap/extensions` is imported but not declared.** `NoteEditor.tsx` imports
  `Placeholder` from `@tiptap/extensions`, which resolves only because it is a transitive
  dependency of `@tiptap/starter-kit`. It works today and will keep working until a
  StarterKit release drops or repackages it, at which point the failure is an unresolved
  import at build time. Add `@tiptap/extensions` to `dependencies` at the version already
  in the lockfile.

- **`setSubscriptionStatus` exists twice with different semantics.** `billing.service.ts`
  changes *the operator's own* subscription; `platform.service.ts` changes *any workspace's*.
  They are told apart only by import path. Nothing is wrong today, but the names invite a
  wrong-import bug that type-checks cleanly. Consider renaming the platform one
  (`setWorkspaceSubscriptionStatus`) when that file is next touched.

- **`react-hooks/set-state-in-effect` is disabled project-wide.** A Phase 1 accommodation
  for mount-once data fetches and SSR-portal mount flags (HISTORY.md, Framework-level bug
  catches). When data fetching moves to a real backend and can be restructured, re-enable
  the rule and fix the genuine cases it surfaces.

- **Onboarding is pinned to visual-testing mode.** `/onboarding` always starts at step 0
  regardless of completion state. The real resume logic survives as the `resumeStep()`
  helper at the bottom of the page behind an `eslint-disable`, with the call site
  commented out one line above. Two lines to flip back on when the demo no longer needs a
  fixed entry point.

- **No `README.md`.** The scaffold's was deleted in the first cleanup (HISTORY.md,
  Entry 001) and never replaced. `AGENTS.md` covers agent-facing needs; a human landing on
  the repository cold still gets nothing. Low priority while the project is private.

---

## 2. Testing — the largest frontend structural gap

- **~~Introduce a backend test and quality-check baseline before domain data lands.~~
  DONE.** `server/` now uses pytest, pytest-asyncio, Ruff, and strict mypy. Isolated tests
  cover configuration, health/error contracts, request ids, safe 500 responses, and
  OpenAPI operation ids; opt-in PostgreSQL integration tests cover live readiness and the
  restricted application role. CI remains deferred.

The **frontend still has no test runner or test files**, and the repository has no CI.
Frontend verification currently means type-check clean, lint clean, and routes exercised
by hand in a dev server. The highest-value frontend targets remain:

When tests arrive, the highest-value targets — the places where a bug is silent — are:

- **`web/src/lib/` pure helpers**, which are trivially testable and already correctness-critical:
  `card.ts` (formatting and expiry validation), `money.ts`, `time.ts`, `calendar.ts`
  (overlap/conflict detection), `text.ts` (`plural()`), `status-maps.ts` completeness
  (every union member has an entry), and `cn.ts` (the typography merge group — the
  regression it guards against is invisible in a diff).
- **Service-layer invariants**: patch-merge semantics of `update*` (a partial patch must
  not drop fields), `NotFoundError` on unknown ids, and the mock/api guard (every method
  throws `NotImplementedError` when `dataSource !== "mock"` — the negative case, not just
  the happy path).
- **Relationship single-sourcing**: `listFormsForService`, `listPackagesForService`, and
  the booking↔session link. These are filters over an owning array, and a filter bug shows
  up as a merely-empty list, not an error.
- **Derived dashboard state**: `getDashboard()` composing live from bookings, sessions, and
  action items, including the `ses-demo` exclusion.
- **Role routing**: `homePathForRole()` and `AuthGuard`'s two redirect paths.

Choosing a frontend runner is itself deferred — see `docs/RULES.md` on introducing
dependencies. The backend runner is not implicitly the frontend runner.

---

## 3. Security & data-handling invariants to enforce later

None of these domain findings are exploitable today: the backend currently exposes health
and OpenAPI infrastructure only, with no domain input path or real credential. Each
becomes real as the corresponding Phase 2 resource lands.

- **`NoteContent.tsx` renders stored HTML with `dangerouslySetInnerHTML`.** Safe **only**
  because the body is produced by the local Tiptap StarterKit editor and authored by the
  workspace operator. **The moment note bodies can arrive from an API, a client, or an
  import, this path must be sanitised** (allow-list, server-side, on write *and* on
  render). This is the single load-bearing "trusted author" assumption in the codebase —
  see HISTORY.md Entry 018.

- **The session token is fabricated client-side and never verified.**
  `auth.service.ts` mints `mock.<random>.<timestamp>` and `AuthGuard` trusts whatever is in
  `localStorage`. Role is derived from an email pattern. Every route protection in the app
  is therefore cosmetic. Phase 2 must move authorisation server-side; the guard should
  become a UX affordance, never the boundary.

- **A booking must not become `confirmed` on the success route.** Today it does. In the
  real state machine a free booking confirms atomically, a manual-payment booking confirms
  when verified, and a card-funded booking confirms only from a verified payment webhook.
  Landing on the success route is never evidence for any of them. This is the one Phase 1
  shortcut most likely to harden into business logic by accident.

- **Manual payment instructions are operator-authored free text shown to the public.**
  Rendered as text today. If that ever becomes rich text, the sanitisation note above
  applies with a *lower* trust level — this content reaches unauthenticated visitors.

- **No domain rate limiting, CSRF, or server-side form validation yet.** The foundation
  has exact-origin credentialed CORS and Pydantic configuration validation, but nothing
  submits product data to it. Every public form (booking, contact, forms step) needs
  server-side validation in Phase 2; client-side validation remains only a UX check.

---

## 4. Phase 2 — backend

The architecture is approved: a Python/FastAPI modular monolith, PostgreSQL, SQLAlchemy,
Alembic, and Docker Compose for local development. Build it under `server/` and keep it
local-only initially; Railway is a possible later host, not a current dependency or
deployment target. The public portfolio/demo remains entirely mock-backed while the API is
built and exercised separately.

### Migration and contract

- **The `api` branch of every service is unwritten.** `NEXT_PUBLIC_DATA_SOURCE` and
  `apiBaseUrl` exist in `web/src/lib/env.ts`; every service method currently throws
  `NotImplementedError` when `dataSource !== "mock"`. Fill those explicit branches rather
  than adding automatic per-method fallback: mixing API services with related mock
  services would produce incompatible ids and broken form/package/session relationships.
- **Keep two coherent environments.** The public demo stays `mock`; an API-backed local or
  preview environment uses `api`. Integrate complete route bundles (public catalog,
  operator baseline, scheduling) rather than silently falling back method by method.
- **Design endpoints around resources, not pages.** `GET /dashboard/summary`,
  `/sessions`, `/bookings`, `/clients`, `/services`, `/settings/payment`,
  `/settings/billing` — never `/admin/dashboard-card-left`. A future mobile client must be
  able to use the same API without mobile-only endpoints.
- **Generate transport types from FastAPI's OpenAPI document** into
  `web/src/api/generated/`. Only the service/transport layer imports them; it maps them to the
  existing domain/UI types in `web/src/types/`. Generated HTTP DTOs do not become a second set
  of component-facing domain types.
- **Browser/API topology:** plan for `app.slotera.app` and `api.slotera.app` as same-site
  sibling origins. Web auth uses a Secure, HttpOnly, SameSite=Lax cookie with exact
  credentialed CORS and CSRF protection on unsafe methods; a future native client uses a
  bearer token. Locally, the equivalent is the Next dev origin plus `localhost:8000`.

### Foundation and tenancy

- **Identity is server-owned.** Add users, opaque revocable auth sessions, password-reset
  tokens, workspaces, and workspace memberships. `Client` remains a separate no-login
  entity with a stable UUID `clientId`; normalized email is required and unique within a
  workspace, but is not its primary key. A repeat public booking may reuse the client id
  by email and must not silently overwrite the saved client profile.
- **Multi-workspace isolation is both application- and database-enforced.** Every
  tenant-owned row carries `workspace_id`; every query scopes it; PostgreSQL RLS is enabled
  under a restricted app role. Migrations run as a separate owner role. The SQLAlchemy
  request dependency owns one transaction/connection and applies tenant context with
  `SET LOCAL`; statement pooling is not supported. Add an automated schema test that fails
  when a tenant table lacks an RLS policy.
- **One workspace client-payment currency.** The initial backend currency is EUR. Services
  and packages inherit it; bookings and payments snapshot it. The Phase 1 mock UI remains
  GBP until a deliberate frontend/data migration, and platform billing remains a separate
  payment domain.
- **Persistence across reload becomes a requirement.** Mock state currently lives in
  module-level arrays and resets on HMR; API-backed flows must not inherit assumptions that
  a refresh resets data.
- **Production readiness is required before any live API cutover:** managed PostgreSQL
  with point-in-time recovery, structured logs, error monitoring, health checks, a tested
  backup restore, secret management, data retention, client export, and erasure-by-
  anonymisation that preserves only legally required financial facts.

### Scheduling and availability

- **Availability v1 is workspace-wide:** IANA timezone, weekly working hours, slot
  interval, buffers before/after, minimum notice, maximum advance window, and blackout
  dates. Expand slots server-side in the workspace timezone and test DST boundaries.
  Per-service overrides wait for a product/UI requirement.
- **Scheduled-mode capacity is transactional.** Lock the existing session row before
  counting capacity-consuming bookings and active holds.
- **Open-mode creation needs its own lock target.** Acquire a transaction advisory lock
  for calendar owner + slot, recheck availability, then find or create the materialised
  session. The database exclusion constraint remains the final safeguard.
- **Calendar conflicts are a database invariant.** Install `btree_gist`; use a partial
  GiST exclusion constraint on `calendar_owner_id` plus the half-open
  `tstzrange(start_at, end_at, '[)')`, excluding cancelled sessions. Keying on the calendar
  owner allows future team members in one workspace to run parallel sessions.
- **Recurring sessions use a series plus materialised occurrences.** Maintain a rolling
  six-month horizon with a database-backed worker. Editing supports “this occurrence” and
  “this and following”; past occurrences never change.

### Bookings, payments, and public access

- **Booking lifecycle is explicit.** `pending → confirmed → completed | noshow`, with
  cancellation allowed from appropriate prior states. `noshow` is the 1:1 outcome;
  `attendance: present | late | absent` applies only to bookings in group sessions, which
  finish as `completed`. Payment state is separate; cancellation never implies refund.
  Approval-before-booking remains deferred and does not add a speculative `requested`
  status now.
- **Operator-created bookings are privileged commands.** They may bypass public lead-time
  and availability rules with an audit reason, but never capacity or calendar-conflict
  invariants. Provisioning, booking creation, payment/refund commands, and batch attendance
  use idempotency keys.
- **Capacity policy:** free bookings are created and confirmed atomically; manual-payment
  bookings remain pending and consume capacity until verified or `paymentDueAt` expires;
  later card checkout uses a short-lived 15-minute hold. Availability subtracts active
  holds and capacity-consuming bookings.
- **The server owns financial calculation.** Store immutable subtotal, tax, total,
  currency, applied rate/treatment/jurisdiction/label, seller tax-number snapshot, and an
  optional provider calculation reference/breakdown. Remove the frontend's hard-coded
  country VAT calculation when the booking API lands. Start with operator-configured
  `none | fixed` tax policy for free/manual flows; do not hand-roll international tax
  tables. Customer-facing output is a booking/payment summary, not a legally numbered tax
  invoice.
- **Real customer access uses a booking-scoped magic credential, not a customer account.**
  Store only a hash, expiry, and usage/revocation state; never place PII in the URL. Public
  response DTOs are allow-lists and never contain service notes, session notes, client
  notes, or action items.
- **Transactional confirmation email moves into Phase 2 with real public bookings.** A
  booking transaction writes an outbox event; a small second process polls PostgreSQL with
  `FOR UPDATE SKIP LOCKED`, sends confirmation/magic-link email behind a local provider
  interface, and records attempts/provider ids. Do not add Redis or Celery yet.
- **Rich-text client notes become untrusted network data.** Sanitise their allow-listed
  HTML server-side on write and defensively on render in the same migration; the current
  local-editor trust assumption no longer holds once notes come from an API.

### Delivery order

1. **~~Backend foundation: package/config layout, liveness/readiness, PostgreSQL,
   Alembic, Docker Compose, pytest, lint/type-check, structured errors/logs, and OpenAPI
   conventions.~~ DONE.** Built under `server/` with a uv lockfile, separate migration
   owner and restricted application roles, an empty baseline migration, exact-origin
   CORS, and isolated plus live-database tests. The demo/frontend remains mock-backed.
2. **~~Seed importer: add it with the first model-backed identity/tenancy resources.~~
   DONE.** `uv run slotera-seed` imports deterministic UUID-backed demo identities, the
   Hartmann workspace/membership, its provisioning audit event, and reserved slugs. It is
   disabled in production and repeat imports insert no duplicate rows.
3. **~~Identity and tenancy persistence: users, workspaces, memberships, auth sessions,
   password-reset tokens, RLS, audit events, slug history, and reserved slugs.~~ DONE.**
   Migration `20260728_0002` adds the schema, forces RLS on every tenant table, withholds
   identity tables from the runtime role, and adds schema/negative-path integration tests.
   HTTP credential/session commands remain part of the coherent bundle below.
4. First coherent frontend/API bundle: auth/session, notification baseline, business
   settings, and services.
5. Scheduling: availability, sessions, recurrence, conflict/capacity enforcement.
6. Operator core: clients, bookings, forms/responses, notes, action items, attendance, and
   operator-created manual bookings.
7. Public booking: public catalog/availability, free/manual booking transactions, tax
   snapshots, idempotency, and expiry.
8. Transactional email and booking workspace: outbox worker, confirmation/magic links,
   post-booking forms, reschedule/cancel requests, and client messages.
9. Derived/platform resources: dashboard, server-side search, notifications, superadmin,
   subscriptions, and inquiries.
10. Production-readiness gate, then later hosting/deployment selection.

## 5. Phase 3 — external integrations

- **Stripe is deliberately mocked and de-prioritised.** Prove identity, tenancy,
  scheduling, tracking, free/manual booking, and the booking workspace first. Then add
  connected-account onboarding, short-lived card holds, Checkout/Elements, verified
  idempotent webhooks, refunds, and provider tax calculations behind a local payment
  interface. Operators are intended to be merchant of record using direct charges and a
  full Stripe Dashboard/controller configuration; confirm provider/country coverage when
  implementation starts. Turkey is not an initial operator market and does not influence
  Phase 2.
- **Advanced email scheduling.** Phase 2 carries the minimum transactional confirmation
  and magic-link delivery required by real bookings. Reminder/follow-up scheduling,
  heavier retry orchestration, and Redis/Celery stay here until their operational need is
  demonstrated.
- **Google Calendar / Meet.** Settings → Calendar → Calendar Connections is display-only.
  Online sessions have no meeting link — the booking workspace shows a placeholder.
- **International tax detection.** Phase 2 snapshots an operator-configured `none | fixed`
  treatment for the initial German context. Country-dependent and cross-border treatment
  stays deferred to a provider tax service plus professional tax review; never restore the
  hard-coded country table as business logic.

## 6. Product surfaces represented but not built

These exist as *demonstrations* of a future capability. The recorded intent is that they
stay demonstrations until the backend can support them properly.

- **Real customer booking access via magic links.** `/booking/manage/demo` is a single
  fixed booking with no id, token, or persistence. The real version needs guest access,
  signed expiring links, email delivery, and backend persistence. Customers still get no
  accounts — that boundary is deliberate.
- **Post-booking optional forms.** Demonstrated on the booking workspace's Forms tab
  (save writes to local state only). The real flow is the magic-link one above.
- **Approval before booking.** A future **service-level** workflow ("request → operator
  approves → confirmed"). Explicitly **not** a change to the public booking step sequence.
- **Email reminders and follow-ups.** Represented by the reminder line; transactional
  confirmation/magic-link email belongs to the real-booking Phase 2 milestone, while
  scheduled reminders and follow-ups remain Phase 3.
- **Package purchase and credits.** Packages are display-only by design — no checkout, no
  credit ledger, no consumption, no entitlements, no memberships, no recurring billing, no
  coupons or gift cards. A real version would need purchase, remaining-credit tracking,
  enrollment, and customer-facing package management. Do not add any of it to the current
  surface; see HISTORY.md Entry 016.
- **Manual booking by the operator.** Creating a booking for someone who has already paid
  out-of-band, from the admin side. Not modelled.
- **Client-side authentication at booking time** ("if you have an account, log in") and
  **invitation flows** ("your provider has invited you to book"). Both imply customer
  accounts, which the product currently does not have — adopting either is a positioning
  decision, not just a feature.
- **`bookingMode: "scheduled"` end-to-end.** The field exists and services carry it, but
  the public flow's date/time picker generates free-form slots and never resolves to a
  concrete `SessionItem`. Consequence: `SessionItem.address` is stored but never shown to
  the public client, because there is no session reference to read it from at confirmation.
  Surfacing the address publicly is the natural pairing with building `scheduled` mode —
  do them together.
- **Client-visible session action items.** `clientVisible` is on the type and has a toggle
  in the admin UI, but nothing reads it. Action items are admin-only today. The helper that
  would have served a client surface (`listClientActionItemsForSession`) was deleted rather
  than left dead; re-add it if a real client surface is built.
- **Shared resources / client-facing next steps.** Built, then **removed** — the booking
  workspace was drifting into project management. Listed here so the removal reads as a
  decision (HISTORY.md, Scope boundaries) rather than an omission to be helpfully restored.

## 7. Longer horizon

- **React Native client.** Not before the web MVP is stable and the backend exists. The
  ordering is deliberate: finish responsive web → make key flows mobile-friendly (drawers
  already render as bottom sheets) → build the backend with a domain-shaped API → build
  native against that same API. No mobile-only endpoints.
- **Team accounts.** The Team plan advertises 10 members and `SubscriptionStatus` supports
  it, but there is no member model, no invitations, and no per-member permissions. The
  billing UI currently promises something the data model cannot express.
- **Real operator impersonation.** "View as operator" in superadmin fires a
  `toast.info(...)` placeholder. A real implementation is an audit-logged, scoped,
  time-limited privilege — not a session swap.
- **ML-based analytics.** Noted as a long-horizon idea only. Nothing in the current model
  is shaped for it, and it should not influence Phase 2 schema decisions.
- **Flexible service grouping.** If services ever need categories, it arrives as an
  intentional tag system. Reintroducing a `type` enum is specifically ruled out — see
  HISTORY.md, "what is deliberately not in the data model."
- **Notes as a multi-author log.** If `notes` needs authorship and history, promote
  Service, Session, and Booking notes to `NoteEntry[]` **together**, in one deliberate
  change. Do not fork the shape per entity.
