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

- **~~`web/src/types/index.ts` is an incomplete barrel.~~ DONE.** It now re-exports
  `form`, `package`, `client-note`, `session-action-item`, and `demo` alongside the
  existing domain modules. The export set was checked for name collisions.

- **~~`@tiptap/extensions` is imported but not declared.~~ DONE.** It is now a direct
  dependency at the existing `3.27.1` package line, so `NoteEditor.tsx` no longer relies on
  a transitive install.

- **`setSubscriptionStatus` exists twice with different semantics.** `billing.service.ts`
  changes *the operator's own* subscription; `platform.service.ts` changes *any workspace's*.
  They are told apart only by import path. Nothing is wrong today, but the names invite a
  wrong-import bug that type-checks cleanly. Consider renaming the platform one
  (`setWorkspaceSubscriptionStatus`) when that file is next touched.

- **`react-hooks/set-state-in-effect` is disabled project-wide.** A Phase 1 accommodation
  for mount-once data fetches and SSR-portal mount flags (HISTORY.md, Framework-level bug
  catches). When data fetching moves to a real backend and can be restructured, re-enable
  the rule and fix the genuine cases it surfaces.

- **~~Onboarding is pinned to visual-testing mode.~~ DONE.** Onboarding is now real-app
  only and resumes from server state; completion is persisted.

- **~~No `README.md`.~~ DONE.** The new root README gives a human-facing product summary,
  the supported local entry points, and links to the architecture and deployment guides.

---

## 2. Testing — the largest frontend structural gap

- **~~Introduce a backend test and quality-check baseline before domain data lands.~~
  DONE.** `server/` now uses pytest, pytest-asyncio, Ruff, and strict mypy. Isolated tests
  cover configuration, health/error contracts, request ids, safe 500 responses, and
  OpenAPI operation ids; opt-in PostgreSQL integration tests cover live readiness and the
  restricted application role. GitHub Actions now runs these gates on pull requests and
  `main`.

**GitHub Actions CI is now in place:** it runs frontend type-check, lint, `npm test`
(Vitest) and production build, plus backend isolated and PostgreSQL integration gates, on
pull requests and `main`.

**~~Frontend test runner.~~ DONE.** Vitest runs logic-only tests in Node
(`web/src/**/*.test.ts`): money formatting, navigation and AuthGuard routing, date keys,
platform DTO mappers and the maintenance proxy. Still worth adding when touched:
- `card.ts`, `time.ts`, `calendar.ts` overlap detection, `text.ts` `plural()`,
  `status-maps.ts` completeness, and `cn.ts` (the typography merge group);
- service-layer patch-merge semantics and `NotFoundError` on unknown ids (mock mode);
- relationship filters (`listFormsForService`, `listPackagesForService`), where a bug
  shows up as an empty list rather than an error;
- `getDashboard()` mock composition, including the `ses-demo` exclusion.

No component snapshot tests: the browser covers UI.

---

## 3. Security & data-handling invariants to enforce later

The local backend now accepts authenticated operator input across the coherent API-mode
bundle, while the deployed frontend remains disconnected and mock-backed. The findings
below are standing security requirements as further API and frontend integration lands.

- **~~Sanitise rich-text client notes at both trust boundaries.~~ DONE.** API writes are
  allow-list sanitised before persistence and `NoteContent.tsx` sanitises again before its
  contained `dangerouslySetInnerHTML` render. Imports or future client-authored rich text
  must pass through the same server boundary rather than creating a new trusted path.

- **The default mock session token is fabricated client-side and never verified.**
  `auth.service.ts` mints `mock.<random>.<timestamp>` and `AuthGuard` trusts whatever is in
  `localStorage`. Role is derived from an email pattern. Every route protection in the app
  is therefore cosmetic in the demo. **API mode is DONE:** it uses server-verified,
  revocable opaque sessions and role/workspace dependencies; the guard is only a UX
  affordance there. The mock behavior remains deliberately isolated to mock mode.

- **~~A real booking must not become `confirmed` on the success route.~~ DONE for API
  mode.** The public transaction decides the persisted state atomically from independent
  payment and approval gates. The API confirmation route is display-only. The mock
  showcase may still present a simulated success outcome, but it is not a state transition
  and must never be copied into API behavior. A future card-funded booking confirms only
  from a verified payment webhook.

- **Manual payment instructions are operator-authored free text shown to the public.**
  Rendered as text today. If that ever becomes rich text, the sanitisation note above
  applies with a *lower* trust level — this content reaches unauthenticated visitors.

- **Future public flows inherit rate limiting and server-side validation.** Operator resource
  mutations now have exact-Origin, session-bound CSRF, strict Pydantic validation, and
  tenant authorization. Login throttling is now PostgreSQL-backed. Every future public
  form (booking, contact, forms step) needs endpoint-specific server-side validation and
  abuse controls; client-side validation remains only a UX check. **The real password-
  reset and public-booking endpoints are DONE:** both use shared PostgreSQL rate limits,
  strict external schemas, trusted-origin checks on mutations, and safe error contracts.
  Future contact and magic-link surfaces inherit the same requirement.

---

## 4. Phase 2 — backend

The architecture is approved: a Python/FastAPI modular monolith, PostgreSQL, SQLAlchemy,
Alembic, and Docker Compose for local development. Continue it under `server/` and keep it
local-only initially; production runs on one Hetzner server (`docs/DEPLOYMENT.md`). The public portfolio/demo remains entirely mock-backed while the API is
built and exercised separately.

### Migration and contract

- **Coherent API bundles are wired.** Auth/session, operator settings/resources,
  scheduling, clients, bookings, forms, notes/action items, dashboard/search, public
  capacity-one booking, and the narrow platform workspace surface use generated DTO
  adapters through the shared HTTP/CSRF client in opt-in local API mode. Methods outside
  those bundles continue to fail explicitly; fill them as coherent bundles without
  automatic mock fallback.
- **Keep two coherent environments.** The public demo stays `mock`; an API-backed local or
  preview environment uses `api`. Integrate complete route bundles (public catalog,
  operator baseline, scheduling) rather than silently falling back method by method.
- **Design endpoints around resources, not pages.** `GET /dashboard/summary`,
  `/sessions`, `/bookings`, `/clients`, `/services`, `/settings/payments`,
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
- **One workspace client-payment currency.** Chosen at sign-up (GBP default; GBP, EUR,
  USD), fixed afterwards. Services and packages inherit it; bookings and payments snapshot
  it. Add currencies on demand, never convert. Platform billing is GBP only and a separate
  payment domain.
- **Persistence across reload becomes a requirement.** Mock state currently lives in
  module-level arrays and resets on HMR; API-backed flows must not inherit assumptions that
  a refresh resets data.
- **Production readiness is required before any live API cutover.** Done: Hetzner
  Compose stack, health checks, nightly backups with a tested restore, secrets in
  `deploy/.env`, client export, and erasure by anonymisation (financial facts kept).
  Remaining, in the `docs/DEPLOYMENT.md` gate: the off-box restore drill, error monitoring
  and alerting, solicitor-reviewed legal pages, and real-domain smoke tests.

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

- **~~Booking lifecycle and confirmation gates are explicit.~~ DONE.** `pending → confirmed → completed | noshow`, with
  cancellation allowed from appropriate prior states. `noshow` is the 1:1 outcome;
  `attendance: present | late | absent` applies only to bookings in group sessions, which
  finish as `completed`. Payment state is separate; cancellation never implies refund.
  Service-level `automatic | operator_approval` is snapshotted on each booking, with
  `not_required | pending | approved | declined` approval separate from payment and
  lifecycle state. Confirmation requires every applicable gate.
- **Operator-created bookings are privileged commands.** They may bypass public lead-time
  and availability rules with an audit reason, but never capacity or calendar-conflict
  invariants. Provisioning, booking creation, payment/refund commands, and batch attendance
  use idempotency keys.
- **Capacity policy:** free automatic bookings confirm atomically; approval-required and/or
  manual-payment bookings remain pending and consume capacity until their gates pass or
  they are declined/cancelled/expired. Later card checkout uses a short-lived 15-minute
  hold. Availability subtracts active holds and capacity-consuming bookings.
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
  notes, or action items. An all-history client dashboard would require cross-booking
  identity and authorization and is therefore a different, larger product decision; it is
  not part of the next booking/email foundation pass.
- **~~Transactional receipt/confirmation email moves into Phase 2 with real public bookings.~~ DONE for local/provider-neutral delivery.** A
  booking transaction writes an outbox event; a small second process polls PostgreSQL with
  `FOR UPDATE SKIP LOCKED`, sends confirmation behind the existing local provider
  interface, and records attempts/provider ids. `booking_received` and
  `booking_confirmed` have local-console templates and transaction-level deduplication.
  External provider/domain setup remains operational work; booking-workspace magic links
  remain a separate customer-access bundle.
- **~~Rich-text client notes become untrusted network data.~~ DONE.** The client-notes
  API allow-lists editor HTML on write and the browser sanitises again immediately before
  rendering; this protection must remain as new note transports are added.

### Completed local implementation pass — booking decisions and email foundation

This pass remains local-only. It prepares the product for manual payments before Stripe;
it does not create Railway resources, configure a delivery provider/domain, or launch a
live environment.

- **~~Manual-payment reconciliation is the release path.~~ DONE.** An idempotent, audited
  `mark-payment-received` command is exposed on the API-mode booking detail. Payment state
  remains separate from booking lifecycle.
- **~~Service-level confirmation policy is the adjacent decision.~~ DONE.** Each service
  owns `automatic | operator_approval`; bookings snapshot it and keep
  `not_required | pending | approved | declined` approval separate. Confirmation requires
  every applicable payment/approval gate.
- **~~Persist transaction evidence.~~ DONE.** Public bookings snapshot the submitted customer contact, provider
  terms/version, acceptance instant, and the exact financial/manual-payment facts used for
  the booking. A repeat client match must not discard the newly submitted booking contact
  or silently overwrite the saved client profile.
- **~~Add provider-neutral booking events.~~ DONE.** `booking_received` and
  `booking_confirmed` outbox events plus PII-safe operator notification events in the same
  transaction as their state change use typed local templates and event uniqueness.
  External provider setup and real delivery testing remain later.
- **~~Include the directly overlapping correctness work.~~ DONE.** Pending reason/status is
  explicit in booking DTOs and operator/customer UI; approval decline, cancellation, and
  expiry must release a public-created capacity-one slot without cancelling an operator-
  created session; idempotency replay must not duplicate commands or events.
- **Keep customer access narrow for now.** Do not add an all-history client dashboard in
  this pass. Booking-scoped magic access and the booking workspace remain a later coherent
  bundle, and a cross-booking dashboard would first require a deliberate customer-identity
  decision.

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
4. First coherent frontend/API bundle:
   - **~~Backend auth/session boundary.~~ DONE.** Argon2id login, opaque revocable
     sessions, exact-Origin validation, session-bound CSRF, no-store current-session DTOs,
     secure production-cookie policy, and narrow database functions are implemented.
   - **~~Backend business settings, saved locations, and services.~~ DONE.** Resource-
     shaped operator APIs now persist under forced tenant RLS, require operator sessions
     and CSRF on mutations, derive service currency from the EUR workspace, keep service
     notes private, and emit append-only audit events.
   - **~~Notification baseline.~~ DONE.** Structured, membership-backed, user-targeted
     notifications now support authenticated listing with unread count and CSRF-protected
     mark-all-read. Public booking receipt/confirmation producers are now implemented;
     future session and external-payment producers remain with their domains.
   - **~~Generated OpenAPI transport types and coherent frontend wiring.~~ DONE.** FastAPI
     exports a repeatable contract, `openapi-typescript` generates committed DTOs, and the
     shared credentialed client maps auth/session, business settings/locations, services,
     and notifications to existing UI types. `./scripts/dev --api` enables only the wired
     operator routes; the default demo remains mock-backed.
5. Scheduling:
   - **~~Backend availability, sessions, recurrence, and conflict baseline.~~ DONE.**
     Workspace-wide policy/windows/blackouts and authenticated session resources now
     persist under forced RLS. Recurrence materialises a DST-aware rolling six-month
     horizon, item edits use explicit `this` / `this_and_following` scope, and PostgreSQL
     rejects same-owner active overlaps with a partial GiST exclusion constraint.
   - **~~Scheduling frontend bundle.~~ DONE.** Generated availability/session DTOs map
     through the service layer; API mode now exposes Calendar and Calendar Settings without
     mixing mock booking/client, attendance, or action-item data.
   - **~~Recurrence horizon maintenance.~~ DONE.** `slotera-maintenance` tops every
     active series back up to `ROLLING_HORIZON_DAYS` ahead, copying the latest live
     occurrence (so `this_and_following` edits carry forward) and skipping clashing slots.
     No series split was needed.
   - **~~Capacity consumption.~~ DONE for MVP bookings.** Scheduled commands lock the
     session and count pending/confirmed bookings; public open-mode capacity-one creation
     takes slot/idempotency advisory locks, rederives availability, materialises the
     session, and relies on the exclusion constraint as the final race safeguard. Card
     holds and group public booking remain deferred.
6. Operator core:
   - **~~Clients API bundle.~~ DONE.** Tenant-scoped client profiles now have normalized,
     workspace-unique emails, operator CRUD/search, audit events, forced RLS, generated
     transport, and API-mode directory/detail reads. Booking-derived totals/tags remain
     placeholders until the booking ledger exists.
   - **~~Bookings read baseline.~~ DONE.** Tenant-scoped ledger rows now persist client and
     session references plus immutable contact, terms, payment, approval, and financial
     snapshots, with forced RLS and API-mode list/detail reads. Commands, attendance, and
     public/open-mode transactions are recorded separately below.
   - **~~Form-template operator CRUD.~~ DONE.** Operator form templates and their
     single-sourced service attachments persist under RLS, with API-mode create/edit/
     activate/deactivate/delete. Required attached forms are rendered and snapshotted by
     the public capacity-one flow; post-booking optional responses remain deferred.
   - **~~Client-notes operator CRUD.~~ DONE.** Private, tenant-scoped note entries now
     persist under RLS with audit events, CSRF-protected mutations, allow-listed HTML
     sanitisation on write, defensive browser sanitisation on render, and an API-mode
     Notes tab. They remain operator-only.
   - **~~Session action items.~~ DONE.** Operator-only task entries now persist against
     real sessions under RLS, with CSRF-protected CRUD/status changes, audit events, and
     API-mode Calendar drawer support. `clientVisible` remains a stored future flag and
     does not expose an item to any public or client-booking response.
   - **~~Scheduled-session booking capacity consumption and commands.~~ DONE.** Migration
     `20260731_0014` adds idempotent, audited operator creation plus explicit
     confirm/cancel/complete/no-show commands. Creation locks the existing session and
     counts pending/confirmed bookings in one tenant transaction; it snapshots service
     price and workspace currency and rejects a full session. API-mode detail now exposes
     narrow approval/payment/cancel actions; operator creation UI, holds, and scheduled/
     group public creation remain separate.
   - **~~Group-session attendance.~~ DONE.** Migration `20260731_0016` persists nullable
     `present`/`late`/`absent` outcomes. Its idempotent operator command locks booking and
     session, rejects capacity-1 and ineligible lifecycle states, completes the booking
     without touching payment state, and powers the API-mode Calendar roster/tab.
   - **~~Form responses.~~ DONE for pre-booking responses.** The public transaction
     validates active attached templates and snapshots submitted answers against the
     booking under forced RLS. Post-booking optional responses remain with magic-link
     access.
7. **~~Public booking: public catalog/availability, free/manual booking transactions, tax
   snapshots, idempotency, and expiry.~~ DONE for the MVP open-mode/capacity-one slice.**
   API mode now publishes only active `open` services with capacity one, exposes only
   available slots, applies the snapshotted approval/payment gate matrix atomically,
   snapshots gross-inclusive `none | fixed` tax facts, and removes the claimed slot.
   Scheduled/group public booking and card holds remain deferred; operator manual-payment
   reconciliation and public-slot release are now complete.
8. Transactional email and customer access: the outbox worker/provider boundary is DONE
   for activation/reset and provider-neutral `booking_received`/`booking_confirmed` events
   with local-console templates. Booking-workspace magic links, post-booking forms,
   reschedule/cancel requests, and client messages remain a separate later bundle.
9. Derived/platform resources:
   - **~~Operator dashboard summary.~~ DONE.** `GET /dashboard/summary` provides a
     tenant- and principal-scoped read model for monthly booking facts, a 30-day trend,
     next/today sessions, and action-item/notification attention counts; API mode maps it
     without mock fallback.
   - **~~Server-side operator search.~~ DONE.** `GET /search` is an authenticated,
     tenant-scoped, bounded read projection for bookings, clients, services, and sessions;
     API mode enables the existing navbar dropdown and Cmd/Ctrl-K palette without fixture
     fallback. Note/action-item text remains outside its search/response scope.
   - **~~Superadmin workspace reads.~~ DONE.** Global-superadmin-only directory/detail
     reads now use two fixed, display-safe database projections; the runtime role has
     `EXECUTE` on those projections rather than direct cross-workspace table access or a
     generic RLS bypass. API mode established its platform island with these reads.
   - **~~Superadmin workspace provisioning.~~ DONE.** The single CSRF-protected command
     atomically creates a EUR workspace, activation-pending initial operator identity and
     membership, baseline business/payment settings, and tenant audit event through a fixed
     `SECURITY DEFINER` capability; no broad superadmin RLS exception or direct global
     table access was introduced. The API now queues that operator's one-time activation
     link through the separately restricted auth/outbox capability.
   - **~~Superadmin workspace suspension/reactivation.~~ DONE.** Explicit idempotent
     commands now change a persisted `active | suspended` operational state through one
     audited fixed database capability. Suspension revokes current operator sessions and
     auth rejects new ones until reactivation; data and subscription/payment state are
     untouched, and the runtime role cannot update the workspace root directly.
   - **~~Booking/payment/approval notification producers.~~ DONE.** Public receipt and
     confirmation transitions create PII-safe, user-targeted events. Further superadmin
     workspace commands, subscriptions, and inquiries remain later.
10. **~~Hosting selection.~~ DONE:** one Hetzner server with Docker Compose
   (`deploy/`). The production-readiness gate in `docs/DEPLOYMENT.md` remains.

### Explicitly deferred dependencies

- **~~Recurrence-horizon worker.~~ DONE** inside the existing maintenance job.
- **~~Scheduled-session booking capacity consumption and commands.~~ DONE.** Pending and
  confirmed operator-created bookings now consume capacity under a locked-session,
  idempotent transaction; explicit lifecycle commands are audit logged. **Open-mode
  capacity-one public creation is also DONE** with advisory slot locking and a
  server-derived expiry for manual-payment capacity. Card holds remain deferred.
- **~~Group-session attendance.~~ DONE.** Confirmed/completed bookings on sessions with
  capacity greater than one can now record/correct `present`/`late`/`absent` through an
  actor-idempotent, audited command; it completes the booking and does not alter payment
  state. Batch attendance remains a client composition of these safe per-booking commands,
  not a new broad mutation endpoint.
- **Payments:** Stripe, payment holds, webhooks, refunds, and tax-provider work remain
  Phase 3.
- **Email:** the PostgreSQL outbox, retry-safe worker, local console provider, production
  Resend provider, activation/password-reset delivery, and booking receipt/confirmation
  events/templates are DONE in code. External provider/domain configuration remains an
  operational live-release task. Magic-link access stays paired with the later customer
  booking workspace; reminders and follow-ups remain Phase 3.
- **External calendars:** Google Calendar/Meet and all connection/sync work remain
  display-only/deferred.

**~~Before any live auth deployment, add shared login throttling, expired/revoked-session
cleanup, password reset delivery/consumption, and password-change session revocation.~~
DONE.** Fixed-window throttles and cleanup are PostgreSQL-backed; reset credentials are
hashed, one-time, expiring, and revoke every existing session when consumed. Operational
security monitoring remains part of the production-readiness gate. In-process rate
limiting was not used because it would reset on deploy and disagree across multiple
workers. Multi-workspace login already fails closed with `workspace_selection_required`;
the workspace chooser waits for the Team/member product surface.

## 5. Phase 3 — external integrations

- **Gate: Merulio incorporation.** Slotera will be operated as a product of Merulio.
  Third-party integrations that need a legal entity — Stripe (Connect and platform
  billing), a production email-sending domain, Google Calendar/Meet OAuth apps — are
  registered under Merulio and start only after the company is incorporated.
- **Stripe is deliberately mocked and de-prioritised.** Prove identity, tenancy,
  scheduling, tracking, free/manual booking, and the booking workspace first. Then add
  connected-account onboarding, short-lived card holds, Checkout/Elements, verified
  idempotent webhooks, refunds, and provider tax calculations behind a local payment
  interface. Operators are intended to be merchant of record using direct charges and a
  full Stripe Dashboard/controller configuration; confirm provider/country coverage when
  implementation starts. Turkey is not an initial operator market and does not influence
  Phase 2.
- **Advanced email scheduling.** Phase 2 carries provider-neutral booking receipt and
  confirmation events first; booking-workspace magic-link delivery follows with that
  access bundle. Reminder/follow-up scheduling, heavier retry orchestration, and
  Redis/Celery stay here until their operational need is demonstrated.
- **Google Calendar / Meet.** Settings → Calendar → Calendar Connections is display-only.
  Online sessions have no meeting link — the booking workspace shows a placeholder.
- **International tax detection.** Phase 2 snapshots an operator-configured `none | fixed`
  treatment for the initial German context. Country-dependent and cross-border treatment
  stays deferred to a provider tax service plus professional tax review; never restore the
  hard-coded country table as business logic.

## 6. Product surfaces represented but not built

These exist as *demonstrations* of a future capability. The recorded intent is that they
stay demonstrations until the backend can support them properly.

- **~~Real customer booking access via magic links.~~ DONE (2026-10-09)** as `/booking/manage#<token>` with self-serve cancel and one reschedule; reminders ship from the maintenance job. Post-booking optional forms and client messages are still not built. Original note: `/booking/manage/demo` is a single
  fixed booking with no id, token, or persistence. The real version needs guest access,
  signed expiring links, email delivery, and backend persistence. Customers still get no
  accounts — that boundary is deliberate. An all-history dashboard is not a smaller
  version of this feature: it would authorize access across bookings and therefore needs a
  separate customer-identity/product decision.
- **Post-booking optional forms.** Demonstrated on the booking workspace's Forms tab
  (save writes to local state only). The real flow is the magic-link one above.
- **~~Approval before booking.~~ DONE for the capacity-one API flow.** It is a
  **service-level** `automatic | operator_approval` policy, snapshotted on bookings and
  separate from payment/lifecycle state. It does not change the public booking steps.
- **Email reminders and follow-ups.** Represented by the reminder line; transactional
  receipt/confirmation events are implemented, while magic-link access remains with the
  booking workspace and scheduled reminders/follow-ups remain Phase 3.
- **Package purchase and credits.** Packages are display-only by design — no checkout, no
  credit ledger, no consumption, no entitlements, no memberships, no recurring billing, no
  coupons or gift cards. A real version would need purchase, remaining-credit tracking,
  enrollment, and customer-facing package management. Do not add any of it to the current
  surface; see HISTORY.md Entry 016.
- **~~Operator booking approval/payment reconciliation UI.~~ DONE for narrow booking-detail actions.**
  API mode exposes approve, decline, mark manual payment received, and cancel when valid.
  Operator booking creation is DONE from Bookings → New booking (existing clients and
  sessions only; adding from the Calendar roster is not built). Broader payment
  adjustment/refund behavior remains later.
- **Client-side authentication at booking time** ("if you have an account, log in") and
  **invitation flows** ("your provider has invited you to book"). Both imply customer
  accounts, which the product currently does not have — adopting either is a positioning
  decision, not just a feature.
- **~~`bookingMode: "scheduled"` end-to-end.~~ DONE (2026-10-09).** Scheduled services (any capacity) list upcoming operator sessions with seats left; booking locks the session and counts capacity, and the confirmation/manage pages show the session address. Original note: The field exists and services carry it, but
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
- **Team accounts.** (The Team plan was removed from pricing on 2026-10-09.) The old Team plan advertised 10 members and `SubscriptionStatus` supports
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
