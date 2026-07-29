# Slotera — Decisions & Rationale

Why things are the way they are. Architectural decisions, rejected alternatives, bug
catches, and calibration reasoning. `AGENTS.md` stays lean and present-tense because this
file carries the history.

**Read this when** you're about to change something that looks arbitrary, or when you're
tempted to reintroduce a pattern that was deliberately removed. Several rules below exist
because a specific failure burned the project once.

**Add to this when** you make a non-obvious call, reject an alternative, or catch a
framework-level bug. New chronological entries go at the bottom of the entry list;
thematic sections at the end are living and can be edited in place.

> **Provenance note.** Entries 001–018 were reconstructed on 2026-07-25 from the commit
> history, the product rulebook (now `docs/PRODUCT.md`), and rationale comments in the source.
> They are grouped by theme rather than mapped one-to-one onto commits, and they record
> *what the code and comments show was decided*. Entries from 019 onward are written as
> the work happens and should be more precise.

---

## Chronological entries

### Entry 001 — Scaffold, then a deliberate reset

The project started from `create-next-app` (TypeScript, Tailwind, ESLint, App Router,
`web/src/` dir, `@/*` alias, Turbopack, npm). The second substantive commit deleted the
generated `README.md`, the scaffold's agent docs, and the placeholder SVGs rather than
editing around them, and replaced the default stylesheet with the project's own tokens.

**Why:** the scaffold's copy describes a Next.js starter, not this product. Keeping it and
editing incrementally leaves stale claims scattered through the repo. Starting empty made
the first real docs (the product rulebook) unambiguous.

**Consequence worth knowing:** there has been no `README.md` since. `AGENTS.md` (added
2026-07-25) is the first entry-point document the repo has had since that reset.

### Entry 002 — Design tokens ported to CSS variables, then exposed to Tailwind

The visual language (warm cream paper, deep forest green accent, architectural radii)
came from a design handoff as a `tokens.css`. It was ported into `web/src/app/globals.css` as
`:root` custom properties, then re-exposed through Tailwind v4's `@theme inline` so the
tokens generate real utilities (`bg-paper`, `text-ink-3`, `border-line-soft`).

**Why the two-layer shape rather than declaring values directly in `@theme`:** the raw
`:root` variables stay readable as a palette and remain usable from plain CSS, while
`@theme inline` is what makes Tailwind emit `--color-*`-driven utilities. Shadows are
declared in a separate non-inline `@theme` block because they are literal values, not
indirections.

**Rejected:** a `tailwind.config.ts` theme extension. Tailwind v4's CSS-first config is
the supported path and keeps the tokens and their utilities in one file.

### Entry 003 — Typography classes are `.text-h1`, not `.h-1`

The handoff named heading classes `.h-1` / `.h-2` / `.h-3` / `.h-display`. Adopting those
names silently collapsed every heading box.

**Why:** Tailwind v4 generates `.h-1`, `.h-2`, `.h-3` as **height** utilities
(0.25rem / 0.5rem / 0.75rem). A custom `.h-1 { font-size: … }` competes with a generated
height utility of the same name, so headings got a 4px box instead of a font size. The
classes were renamed to `.text-display` / `.text-h1` / `.text-h2` / `.text-h3`, and the
reason is documented in `globals.css` itself so it survives a casual rename.

**Rule this produced:** never name a custom utility something Tailwind's numeric-scale
generators also produce.

### Entry 004 — `cn()` must teach `tailwind-merge` about the custom typography classes

With the renamed classes in place, headings still lost their styling when composed:
`cn("text-h1", "text-ink")` deduped down to just `text-ink`.

**Why:** `tailwind-merge` treats `text-*` as a conflict group covering both font-size and
color. It knows `text-lg` is a size and `text-ink` is a color for *its own* class list,
but `text-h1` is unknown, so it was resolved as a color and dropped in favour of the later
one. `web/src/lib/cn.ts` now uses `extendTailwindMerge` to register
`display / h1 / h2 / h3 / body / body-lg / small / micro` under the `font-size` group.

**Rule this produced:** compose classes with `cn(...)`, never raw `clsx`, anywhere the
custom typography utilities can appear — which is effectively everywhere.

### Entry 005 — Element resets must live in `@layer base`

Primary buttons rendered dark ink on the accent background instead of white, and no amount
of `text-white` at the call site fixed it.

**Why:** Tailwind v4 uses real CSS cascade layers, and **unlayered rules beat any layered
rule regardless of specificity**. A bare `button { color: inherit }` in `globals.css` was
unlayered; `.text-white` lives in `@layer utilities`. The unlayered reset therefore won
every time. Wrapping the `button` / `input` / `textarea` / `select` / `a` resets in
`@layer base` restored the expected precedence.

**Rule this produced:** every element-selector reset in this project goes inside
`@layer base`. When an accent button shows the wrong text colour, check `globals.css`
layering before touching the button component.

### Entry 006 — Section-root redirects moved to `web/next.config.ts`

`/admin` and `/superadmin` originally had `page.tsx` files whose only body was a
server-side `redirect()`. Under Next 16 + Turbopack this tripped a `Performance.measure`
race.

**Why the fix is config-level:** a `redirects()` entry resolves at the routing layer
before any page module is involved, so there is no component to race. It is also cheaper —
no page bundle, no render.

**Rule this produced:** never add a `page.tsx` at a route-segment root whose only job is
to redirect. Add a `web/next.config.ts` redirect instead. The reason is comment-documented in
`web/next.config.ts` so it survives a future "why is this here?" cleanup.

### Entry 007 — Two roles, two navs, one shell

Superadmin arrived as a separate route group rather than as extra items in the operator
sidebar. `AppShell` / `Sidebar` / `Topbar` are shared; `OPERATOR_NAV` and
`SUPERADMIN_NAV` in `web/src/lib/nav.ts` are not.

**Why:** the two areas are different mental models — one operator managing their own
workspace vs. platform staff managing every workspace. Merging the navs would imply the
operator can reach platform screens, and role-filtering a single list makes every nav
render carry an authorisation decision. Separate constants plus
`AuthGuard requireRole=…` puts the decision in one place.

`homePathForRole()` became the single source of truth for post-login routing so that a
role mismatch anywhere (guard redirect, login redirect, deep link) resolves identically.

**Rejected:** a permissions/capability system. Two fixed roles with no overlap does not
justify one, and Phase 1 has no real authorisation boundary to enforce anyway.

### Entry 008 — Drawers became global state (admin only)

Admin pages stopped rendering `BookingDrawer` / `SessionDrawer` / `ServiceDrawer` inline.
`DrawersProvider` mounted once in the `(admin)` layout now owns a discriminated-union
state (`{ type: "none" | "booking" | "session" | … }`) and pages call
`useDrawers().openBookingDrawer({...})`.

**Why:** the same drawer is opened from several unrelated pages (calendar cell, bookings
row, dashboard card, search result). Inline mounting meant duplicated state, duplicated
close handling, and the possibility of two drawers open at once. A union-typed provider
makes "one drawer at a time" a type-level guarantee rather than a convention.

**Why superadmin was left out:** it has exactly one drawer (`NewWorkspaceDrawer`) opened
from two adjacent places. A provider there would be ceremony. The recorded trigger for
revisiting: **the moment a second superadmin drawer appears**, introduce
`SuperadminDrawersProvider` rather than growing the local pattern.

**Also decided:** mobile renders the same drawer as a bottom sheet via `DrawerShell`'s
`data-state` transitions. A separate mobile dialog component was rejected — two
implementations of one interaction drift.

### Entry 009 — Toasts and `ConfirmDialog` replaced native dialogs

`window.alert()` and `window.confirm()` were removed in favour of a root-mounted
`ToastProvider` for ambient feedback and a `ConfirmDialog` wrapper around `Modal` for
blocking confirmation.

**Why:** native dialogs block the main thread, cannot be styled, and look nothing like the
rest of the product — which matters disproportionately here because the build exists to be
demoed. `ConfirmDialog` also carries a `busy` state, which native `confirm()` cannot
express at all, so async destructive actions can show progress.

Calibration: 3.5s auto-dismiss, top-right stack, animations gated on
`prefers-reduced-motion`.

### Entry 010 — Payment methods narrowed to `card | manual`

PayPal was implemented and then removed; SEPA was considered and removed.

**Why:** each extra method multiplied the surface — settings toggles, booking-step
branches, receipt variants, mock data shapes — for a prototype that processes no real
money. Card (mocked) plus manual instructions covers the two behaviours that actually
differ in the UI: "pay now in the flow" vs. "pay out-of-band, here's how."

**Rule this produced:** `PaymentMethod = "card" | "manual"`. Neither PayPal nor SEPA
should be reintroduced without an explicit decision.

**Related, decided at the same time:** manual payment instructions are **workspace-global,
not per-service**. An operator has one bank account, not one per service; per-service
instructions would be a data-entry burden with no realistic use case.

### Entry 011 — The two payment domains are kept structurally separate

"Client payments" (how clients pay the operator) and "platform billing" (how the operator
pays Slotera) live in different settings sections, different mock files, different
services (`settings.service.ts` vs `billing.service.ts`), and different vocabulary.

**Why:** they are the classic source of confusion in this product category — both involve
plans, cards, invoices, and statuses, and conflating them produces UI where an operator
cannot tell whose money is moving. Keeping them apart in code makes the wrong wiring hard
to write by accident.

**Consequence to watch:** `setSubscriptionStatus` exists in *both* `billing.service.ts`
and `platform.service.ts` with different semantics (operator's own subscription vs. any
workspace's). They are distinguished only by import site. That is a known sharp edge — see
TODO.md.

### Entry 012 — Registration defers account creation until after payment

`/register` collects the account form into `sessionStorage` (`slotera.register.draft`),
`/register/plan` records the chosen plan, and only `/register/payment` calls `register()`,
`changePlan()`, and `updateMockPaymentMethod()` before clearing the draft and sending the
user to `/onboarding`.

**Why the draft rather than creating the account on step 1:** a half-registered account
with no plan is a support problem in the real product and a confusing demo state here. The
draft models the intended production behaviour (account exists only once payment
succeeds) without needing a backend to enforce it.

**Why Custom plan branches out entirely:** a negotiated plan has no price to charge, so
there is nothing to complete. Picking Custom opens the contact modal in persisting mode,
creates a `PlatformInquiry`, and creates **no account** — leaving the draft intact. Staff
then promote the inquiry to a manually-provisioned workspace from `/superadmin/inquiries`.
This gave the inquiry inbox a real purpose beyond being a form dump.

`web/src/lib/register-draft.ts` owns the storage key exclusively, mirroring how
`web/src/lib/session.ts` owns `slotera.session`.

### Entry 013 — Inquiries are an inbox, not a ticketing system

An earlier version gave `PlatformInquiry` a `new | in_review | resolved` status enum with
per-row dropdowns and badges. It was replaced by a single `read: boolean`.

**Why:** the status field was never driving anything. Nothing branched on `in_review`, and
"resolved" duplicated the real signal (a workspace was provisioned, or it wasn't). Three
states with no behaviour behind them is UI that implies a workflow the product does not
have. Read/unread is honest about what the surface actually is.

The rows were slimmed to a single line (accent dot + warm tint for unread; name+email,
type pill, truncated message, right-aligned date) and the detail moved into a preview
modal that auto-marks read on open. `INQUIRY_STATUS` was deleted from `status-maps.ts`;
only `INQUIRY_TYPE` remains. `setInquiryStatus` became `setInquiryRead`.

`PlatformOverview.totals.openInquiries` kept its JSON field name but now means *unread* —
a deliberate small inconsistency to avoid churning the fixture; the KPI label reads
"Unread inquiries."

### Entry 014 — Structured addresses, with defaults that flow one way

`Address` (ISO-3166-1 alpha-2 country) replaced free-text location strings.
`WorkspaceLocation` (a labelled address) is saved under Settings → Business Profile;
`Service.address` is a **default**; `SessionItem.address` is a per-session **override**.

**Why the one-way inheritance:** a session is a concrete occurrence and often moves
(a one-off venue, a client's office). A service is a template. Letting the session write
back to the service would silently repoint every future session. Switching the selected
service in `SessionDrawer` therefore re-inherits the *new* service's address rather than
keeping the old one — the session's address is understood as "inherited unless
overridden."

**Cleanup rule:** on save, a session with `locationType: "online"` drops its address, so
the data cannot carry a stale venue behind an online session.

### Entry 015 — Attachment relationships are single-sourced

Three separate relationships were each collapsed to one owning side:

| Relationship | Source of truth | Explicitly *not* a field |
|---|---|---|
| Form ↔ Service | `FormTemplate.attachedServiceIds` | `Service.attachedFormIds` |
| Package ↔ Service | `ServicePackage.items[].serviceId` | `Service.packageIds` |
| Booking ↔ Session | `Booking.sessionId` | any reverse array on the session |

**Why:** dual-write relationships in a mock layer with no transactions drift the first time
a code path updates one side and not the other, and the resulting bug is invisible until a
list renders wrong. Picking an owner makes the reverse lookup a filter
(`listFormsForService`, `listPackagesForService`), which is trivially correct at this data
size.

**Consequence accepted deliberately:** the service editor has **no** package-inclusion
control. Changing which packages include a service is done from `/admin/packages`. An
earlier `AvailableInPackagesField` + `setPackageServiceAttachment` pair was removed for
exactly this reason and should not come back.

### Entry 016 — "Programs" collapsed into "Packages"

An earlier model had both `Package` and `PackageProgram` with a `kind` enum plus
`durationLabel`, `validityDays`, and `includedSessionCount`.

**Why it collapsed:** the two shapes were never distinguished by behaviour — nothing
branched on `kind`, and the extra fields duplicated information already derivable from
`items` (session count is `items.length`). Two names for one concept forced a naming
decision at every call site and every string.

The surviving model is deliberately minimal: an ordered bundle of existing services
(`items: PackageItem[]`), a price, a status, and an optional featured flag. The editor
manages `items` as an array and recomputes `order` from position, so reordering is a array
move rather than index arithmetic.

**Scope line held:** packages are a *presentation* model. No checkout, no credit ledger,
no consumption tracking, no entitlements, no recurring billing. Public booking shows an
informational `PackageOptionsHint` and nothing more — no required choice, no change to the
step sequence, no payment impact.

### Entry 017 — "Reservation" renamed to "Booking" everywhere

The customer-facing post-booking surface shipped first at `/reservation/demo` and was
renamed to `/booking/manage/demo`, with the vocabulary changed across code, routes, and
three translation files.

**Why:** the product already had `Booking` as its core domain type. Introducing
"reservation" for the customer's view of the same record created two words for one thing —
and "reservation app" is precisely the generic positioning the product is trying not to
occupy.

**No redirect was added from the old route.** It was never public, never linked
externally, and a permanent redirect for a demo path is cache-sticky debt. All internal
links were repointed instead.

Also settled here: this surface is a **booking workspace**, never a "customer portal" or
"client portal" — customers still have no accounts, and portal language promises one.

### Entry 018 — Client notes became entries, then rich text

`Client.notes?: string` (a single textarea) was replaced by `ClientNote` records
(`{ id, clientId, title, body, createdAtISO, updatedAtISO }`) in their own mock file and
service, surfaced on a dedicated Notes tab.

**Why:** one growing textarea is unusable as soon as there is more than one thing to
remember about a client, and it has no natural place for dates. Discrete titled entries
match how the note is actually used ("what to prep before the next session").

**Then rich text, via a deliberately small Tiptap setup.** The first implementation used a
markdown-marker toolbar with a custom parser (`NoteBody.tsx`) — the admin typed `**bold**`
and saw markers. That was replaced by a WYSIWYG Tiptap editor because an operator writing
a note between sessions should see formatting, not syntax. The toolbar is capped at
**bold, italic, heading, bullet list, numbered list, quote, undo/redo**.

**The security reasoning that makes this acceptable:** `ClientNote.body` stores HTML and
`NoteContent.tsx` renders it with `dangerouslySetInnerHTML`. That is safe *only* because
the content is produced by the local StarterKit editor, authored by the workspace operator,
and never sourced from a client, a network response, or a public form. **If note bodies
ever become client-supplied or arrive from an API, this render path must be sanitised
first** — it is the one place in the codebase where the "trusted author" assumption is
load-bearing. See TODO.md.

**Explicitly out of scope:** images, uploads, embeds, tables, colours, font pickers, slash
commands, AI writing, comments, collaboration. The value here is a fast note, not an
editor product.

### Entry 019 — Documentation made vendor-neutral for multiple assistants

*2026-07-25.* More than one AI coding assistant is used on this project. The doc set as
first written was portable in content but not in *discovery*: the 54KB product rulebook
lived in a file named after one vendor, and the workflow modules lived only under that
vendor's dot-directory. An assistant that auto-loads `AGENTS.md` — the cross-tool
convention — would have reached the structure, history, deferred work, and rules, but the
product rules it most needs (no `type` field, "booking" never "reservation", no medical
claims) only via a pointer to a file named for a different tool.

Three changes, all mechanical:

1. **The rulebook moved to `docs/PRODUCT.md`.** The root `CLAUDE.md` is now a five-line
   stub pointing at `AGENTS.md`. Assistants that auto-load that filename land in the right
   place; assistants that auto-load `AGENTS.md` get there directly. One canonical copy.
2. **Skills moved to a neutral `skills/<name>/SKILL.md`**, with `.claude/skills/<name>`
   as a **symlink** into it. Verified before adopting: a symlinked skill directory is
   discovered normally by the native skill loader, so there is no duplicated content and
   no sync burden. Git tracks symlinks, so the arrangement survives a clone.
3. **The reading order moved into `AGENTS.md` itself**, and a **Workflow modules** table
   was added there listing each skill with its trigger condition and path. `AGENTS.md` is
   the only file every tool loads without being told, so anything an agent must see has to
   be in it or one hop from it. That table is how tools *without* native skill discovery
   find the modules at all.

**Why not duplicate the files per tool:** two copies of a rule drift, and the copy is
always the stale one — the same reasoning that rejected dual-write relationships in the
data model (Entry 015).

**Why not simply delete `CLAUDE.md`:** the stub costs five lines and removes any dependency
on which tool version reads which filename. Cheap insurance against a discovery gap that
would be silent.

**Consequence to maintain:** a new skill is created under `skills/`, symlinked into
`.claude/skills/`, and added to the `AGENTS.md` table. Skipping the third step makes it
invisible to any assistant without native discovery — the failure is silent, which is what
makes it worth writing down.

### Entry 020 — Phase 2 backend architecture approved, with the demo kept separate

*2026-07-26.* The backend direction was reviewed from two independent architecture passes
and approved before scaffolding: a Python/FastAPI **modular monolith**, PostgreSQL,
SQLAlchemy, Alembic, and Docker Compose under `server/`. Development starts locally only.
Railway is a possible later deployment target because it is already familiar, but no host
or production topology is a dependency of the first backend milestone.

**Why a modular monolith:** Slotera needs transactions, tenancy, scheduling invariants,
public booking, and external-provider boundaries; it does not need distributed ownership
or independent scaling. One application and one database keep booking creation, capacity,
form responses, and outbox events atomic. Spring Boot remained a credible alternative for
a Java organisation, but added ceremony here; Go and C++ offered no product-relevant
advantage. PostgreSQL was chosen over MySQL for range/exclusion constraints, RLS, JSONB,
and transactional locking.

#### Demo and migration boundary

The public portfolio/demo remains entirely `mock`-backed even while the backend is built.
The API runs in a separate local/API environment. This protects the current product's
actual job — repeatable client demos — from persistent vandalism, signup spam, and seed
drift. Ephemeral per-visitor workspaces and nightly resetting of a shared persistent demo
were rejected as operational work with no current benefit.

The single `NEXT_PUBLIC_DATA_SOURCE` switch stays. An automatic per-method
`resolve(apiFn, mockFn)` fallback was rejected: an API service with database ids combined
with mock forms, packages, sessions, or bookings would silently break single-sourced
relationships. API integration therefore happens in coherent route bundles while
unfinished paths keep throwing explicitly.

FastAPI's OpenAPI document is the HTTP contract. Generated TypeScript transport DTOs live
under `web/src/api/generated/` and are imported only by the service/API layer, which maps them
to the established component-facing types under `web/src/types/`. Generating a second set of
domain types used throughout components was rejected; transport and domain shapes differ
legitimately because current UI types contain derived/demo fields.

#### Identity, tenancy, and client identity

Real auth uses server-owned opaque revocable sessions. Web receives a Secure, HttpOnly,
SameSite=Lax cookie across planned same-site `app.` / `api.` sibling origins, with exact
credentialed CORS and CSRF protection on unsafe methods; a future native client uses a
bearer token. The frontend `AuthGuard` remains a UX affordance, never authorisation.

Users, workspaces, and workspace memberships are separate entities. Memberships arrive
now even though the UI remains single-operator, so future Team accounts do not require an
identity rewrite and scheduled-session conflicts can key on `calendar_owner_id` rather
than blocking every member of a workspace from operating in parallel.

Every tenant-owned table carries `workspace_id`; application queries scope it and
PostgreSQL RLS provides defence in depth under a restricted app role. Migrations use a
separate owner role. Tenant context is applied with `SET LOCAL` inside the request's one
database transaction/connection, and statement pooling is excluded. A schema-level test
must fail when any tenant table lacks an RLS policy.

Customers still have no accounts. Each `Client` gets a stable UUID `clientId`, and
bookings reference it. Normalised email remains required and unique within a workspace so
a public repeat booking can reuse the client record, but email is not the primary key and
a repeat booking never silently overwrites the saved profile. The booking keeps the
contact snapshot that applied to that transaction.

#### Currency, tax, and payment scope

The real workspace has one client-payment currency, initially **EUR** for the known German
context. Services and packages inherit it; bookings and payments snapshot it. The Phase 1
mock stays GBP until its frontend/fixture migration, and platform billing remains a
separate payment domain. Independent per-service currencies were rejected because the
dashboard and client aggregates have no exchange-rate model and would sum meaningless
amounts.

Financial calculation becomes server-owned. A booking snapshots subtotal, tax, total,
currency, applied tax treatment/rate/jurisdiction/label, the operator's tax number, and an
optional provider calculation reference/breakdown. The hard-coded country VAT table in
the Phase 1 receipt is explicitly not business logic. Initial free/manual booking supports
operator-configured `none | fixed` treatment; international/cross-border resolution waits
for a provider tax service and professional review. Initial customer documents are
booking/payment summaries, not legally numbered tax invoices.

Stripe stays mocked and is deliberately de-prioritised until identity, tenancy,
scheduling, tracking, free/manual booking, and the booking workspace work. The intended
future model is the operator/connected account as merchant of record with direct charges
and a full Stripe Dashboard/controller configuration. Provider/country coverage is
rechecked when integration begins; Turkey is not an initial operator market. No raw card
number, expiry, or CVC ever reaches Slotera's backend.

#### Scheduling and booking invariants

Availability v1 is workspace-wide: IANA timezone, weekly hours, slot interval, buffers,
minimum notice, maximum advance, and blackout dates. Per-service overrides wait for a real
product/UI requirement. Slot expansion is server-side and DST-aware.

The calendar conflict invariant is a partial PostgreSQL GiST exclusion constraint on
`calendar_owner_id` plus half-open `tstzrange(start_at, end_at, '[)')`, excluding cancelled
sessions, with `btree_gist` installed. Scheduled booking locks the existing session row.
Open-mode booking first acquires a transaction advisory lock for owner + slot, rechecks,
then finds or creates and locks the materialised session; the exclusion constraint remains
the final guard. Recurrence is a series plus a rolling six-month occurrence horizon,
extended by the database-backed worker. Edits mean “this occurrence” or “this and
following”; past occurrences are immutable.

Booking lifecycle and payment state remain separate. `pending → confirmed → completed |
noshow`, with cancellation from allowed earlier states; cancellation never means refund.
`noshow` is the 1:1 outcome, while `attendance: present | late | absent` applies only to
group bookings that finish as `completed`. Approval-before-booking remains deliberately
deferred rather than adding a speculative `requested` state.

Free bookings create and confirm atomically. Manual-payment bookings stay pending and
consume capacity until verified or their `paymentDueAt` expires. Later card checkout gets
a short-lived 15-minute hold and can become confirmed only from a verified, idempotent
payment webhook. Operator-created bookings are privileged audited commands: they may
bypass public lead-time/availability rules with a reason, but never capacity or calendar
conflict constraints.

#### Transactional email and operations

Transactional confirmation and booking-workspace magic-link email move into the Phase 2
real-public-booking milestone. Email delivery is not useful during the initial skeleton,
but a persistent public booking is not complete without it. The booking transaction writes
an outbox row; a small second process polls PostgreSQL with `FOR UPDATE SKIP LOCKED`, calls
a swappable email provider, and records delivery attempts/provider ids. Redis and Celery
were rejected for this milestone; scheduled reminders, follow-ups, and heavier job
orchestration remain Phase 3.

Before any live API cutover the production gate includes managed PostgreSQL with point-in-
time recovery, structured logs, error monitoring, health checks, a restore drill, secret
management, retention/export, and anonymisation-based erasure. Financial facts may be
retained where required, but PII is stored so it can be removed rather than embedded in
append-only event text. Rich-text client notes must be allow-list sanitised on server write
and defensively on render as soon as they arrive over the API.

### Entry 021 — The backend starts with a proven local foundation, not domain scaffolding

*2026-07-26.* Phase 2 implementation began under `server/` as an independently runnable
Python 3.13 project. `uv` owns dependency resolution and the committed lockfile; FastAPI
owns HTTP/OpenAPI; SQLAlchemy uses its async engine/session factory; Alembic uses the
official async migration bridge; pytest, Ruff, and strict mypy are the backend gates.
This is still one modular application and one PostgreSQL database. No frontend service
was pointed at it, so the portfolio/demo remains deterministic and mock-backed.

**Why establish HTTP and operational contracts first:** identity and booking code will
otherwise invent request ids, errors, database ownership, health semantics, and OpenAPI
naming while implementing product behaviour. The foundation now gives every response a
generated `X-Request-ID`, serialises known and unknown failures through one camelCase
error envelope, redacts unexpected exception messages, emits structured request logs,
and gives health operations explicit stable ids. Liveness never touches PostgreSQL;
readiness fails closed when PostgreSQL is unavailable.

**Why two database roles immediately:** migrations connect as `slotera_owner`; the API
connects as `slotera_app`. The Compose bootstrap grants the app role data-operation
defaults but no schema creation. An integration test proves that readiness works through
that role and that `CREATE TABLE` is rejected. This does not yet claim tenant isolation —
RLS can only be implemented and schema-tested when tenant tables arrive — but it prevents
the common failure where future RLS appears configured while a table-owning runtime role
bypasses it.

**Local isolation:** the Compose project is explicitly named `slotera`, and PostgreSQL is
bound only to `127.0.0.1:55432`. The non-default host port was chosen after verification
found another healthy project already using `5432`; stopping or reconfiguring that project
was outside Slotera's scope. PostgreSQL remains on `5432` inside its own container.

**Seed importer deferred one milestone:** the original foundation list included a seed
importer. With no domain tables, natural keys, upsert rules, or foreign-key ordering, a
"generic importer" would be a placeholder whose interface is likely to be rewritten.
It will land with identity/tenancy and the first model-backed resources, where fixture
mapping and repeatable conflict semantics can be tested. The empty baseline migration is
deliberate for the same reason: migration infrastructure is real; speculative schema is
not.

**Rejected alternatives:** Poetry/pip requirements would add a second less-familiar
dependency workflow despite `uv` already being available; a wildcard CORS origin is
incompatible with credentialed browser requests and is rejected by settings validation;
connecting the app as the database owner would make later RLS defence-in-depth illusory.
The decisions turn primarily on maintainability and security, not throughput. They would
be revisited if the backend were split into independently deployed services or if a
deployment platform imposed a different package/runtime contract.

### Entry 022 — The Next.js application moved under `web/`

*2026-07-28.* Once `server/` became a real workspace, leaving the Next.js package, source,
configuration, and local build state loose at the repository root made the root look like
the frontend rather than the shared Slotera workspace. The entire Next.js project moved
as one unit under `web/`: package manifests, environment files, Next/TypeScript/ESLint/
PostCSS configuration, `public/`, `src/`, dependencies, and local build caches. Internal
`@/*` imports did not change because `web/tsconfig.json` and `web/src/` moved together.

**Why `web`, not `client`:** Slotera already plans a future native client and will generate
an API client from OpenAPI. Calling the Next.js application `client` would make all three
meanings compete. `web` identifies the delivery surface exactly and leaves `mobile/` or a
generated client package unambiguous if either appears later.

**Why not `apps/web` + `apps/api`:** that layout is useful when a monorepo has several
deployable applications, shared packages, and root-level orchestration. Today it would
rename and move a working Python service merely for symmetry, while npm and uv still need
separate toolchains. The repository therefore uses the deliberately shallow
`web/` + `server/` split, with shared `docs/`, `skills/`, and `AGENTS.md` at root. Revisit
`apps/*` if Slotera gains multiple additional deployables or shared build orchestration
that materially benefits from it.

There is intentionally no root npm workspace or proxy script. Frontend commands run from
`web/`; backend commands run from `server/`. Explicit working directories keep each
toolchain independently reproducible and avoid a root abstraction with only two commands
behind it.

### Entry 023 — Identity persistence establishes the tenant boundary before HTTP auth

*2026-07-28.* The first model-backed revision adds global users, opaque auth sessions,
password-reset tokens, workspaces, workspace memberships, retired-slug history, reserved
slugs, and tenant audit events. `operator_admin` is a membership role; `superadmin` is a
global platform role and does not acquire a synthetic Slotera HQ membership. This keeps
platform authority separate from ownership inside a customer workspace.

**RLS is the enforceable boundary, not a repository convention.** Workspaces,
memberships, slug history, and audit events have forced PostgreSQL row-level security.
`Database.tenant_transaction(workspace_id)` applies `app.current_workspace_id`
transaction-locally on the same SQLAlchemy session/connection; a normal unscoped runtime
transaction sees no tenant rows. Cross-workspace inserts fail. A live schema test
discovers every table with `workspace_id` (plus the root `workspaces` table) and fails if
any lacks forced RLS or a policy, so forgetting to update a handwritten allow-list cannot
silently weaken isolation.

**Global identity storage is closed until its repository exists.** The restricted
runtime role has no direct privilege on users, auth sessions, or password-reset tokens.
The later auth bundle must introduce a narrow identity repository/boundary rather than
grant broad table access as a shortcut. Only SHA-256 digests of opaque tokens are stored;
raw credentials are returned to a caller once and never persisted. Seeded Lena and Avery
rows deliberately have no password hash, so adding tables cannot accidentally turn the
mock credentials into real accounts.

Slug history remains tenant-protected even though public routing will eventually need to
resolve an old slug before tenant context exists. That later lookup must be a narrow,
audited database function or equivalent repository boundary; making the entire routing
table globally readable was rejected. Audit events similarly allow tenant-scoped insert
and select but no update/delete policies, making them append-only to the runtime role.

The seed importer lands with these natural keys and conflict rules rather than as generic
foundation scaffolding. It deterministically maps the existing Lena operator, Avery
superadmin, Hartmann Strategy workspace (`lena`, EUR, Europe/Berlin), membership,
provisioning event, and reserved platform slugs. It runs only in local/test environments
through the migration-owner connection; the first import inserts the model set and an
immediate repeat inserts nothing.

No HTTP login, registration, reset, cookie/CSRF handling, notification, settings, or
services endpoint is part of this milestone. Those form the next coherent API bundle so
the mock-backed Vercel demo remains isolated and no half-real frontend mode is created.

### Entry 024 — Real auth uses a narrow database capability, not broad identity grants

*2026-07-28.* The backend now exposes `POST /auth/login`, `GET /auth/session`, and
`POST /auth/logout`. Passwords use Argon2id through a local `PasswordHasher` interface;
opaque session and CSRF values are generated independently and only their SHA-256 digests
reach PostgreSQL. Login responses and current-session responses are marked `no-store`.
The local demo seed sets the Lena/Avery password `slotera-local-only`, can be overridden
by local environment, and remains disabled in production.

**Identity access is capability-shaped.** The restricted application role still has no
direct table privilege on users, auth sessions, or reset tokens. Four
`SECURITY DEFINER` functions with `search_path` fixed to `pg_catalog` expose only login
identity lookup, membership-validated session creation, active-session lookup, and
revocation. Broad runtime table grants were rejected because one accidental repository
query could dump credentials or all active sessions. A second privileged auth connection
was rejected because it adds another production secret/pool without improving isolation
inside the same process. Revisit the latter only if identity becomes an independently
deployed service or database role boundary.

**CSRF is bound to the server session.** The browser session is a host-only HttpOnly
SameSite=Lax cookie. A separate readable CSRF cookie is checked against both
`X-CSRF-Token` and the digest stored on that exact session, and every unsafe cookie-auth
request requires an exact configured `Origin`. This is stronger than an unbound
double-submit cookie, which a compromised sibling origin could replace. Production marks
both cookies Secure and refuses to start without an explicit shared CSRF cookie domain;
the planned `app.slotera.app` / `api.slotera.app` topology uses `.slotera.app` so the web
client can read the CSRF value while the session credential remains API-host-only.

Authentication and CSRF checks live in reusable FastAPI dependencies. Future tenant
resource routes receive user, role, and workspace only from the verified database
session, never a request body or the frontend `AuthGuard`. Superadmin sessions carry no
synthetic workspace; an operator with multiple memberships must explicitly select one,
and otherwise fails closed.

This remains a local backend slice. Registration, password-reset delivery/consumption,
password changes, notifications, settings/services resources, generated TypeScript
transport types, and frontend wiring are not included. Shared login throttling and session
cleanup are production-gate work; an in-process limiter was rejected because it resets on
deploy and diverges across workers.

### Entry 025 — Operator settings and services stay resource-shaped and tenant-owned

*2026-07-28.* The first authenticated operator domain slice adds business-profile
settings, structured saved locations, and services. The API mirrors durable resources:
`/settings/business`, `/settings/locations`, and `/services`; it does not expose one
page-shaped settings payload. The frontend can later compose those resources into its
existing `SettingsData` view without making that screen layout an API contract.

**Workspace currency is the single source of truth.** A service row has no currency
column. Authenticated service responses derive EUR from the owning workspace, and strict
request schemas reject a client-supplied currency. This prevents internally inconsistent
aggregates while leaving bookings and payments free to snapshot currency when they land.
Workspace slug and currency are intentionally read-only in the business-settings API.

**Tenant isolation is layered.** Operator dependencies require an authenticated
`operator_admin` with a workspace; a superadmin does not gain implicit tenant access.
Repositories scope every query by workspace and execute through a tenant transaction,
while PostgreSQL forces RLS on profiles, locations, and services. Mutations additionally
require the session-bound CSRF token and exact Origin, and write an append-only audit event
inside the same transaction. Cross-workspace ids resolve as not found, avoiding resource
enumeration.

Saved locations are normalized because they are independently managed and reused.
Service default addresses remain JSONB because they are value snapshots attached to one
service, not shared ownership links; normalize them only if address-field querying or
shared lifecycle becomes a demonstrated requirement. Service deletion is a hard delete
for this pre-booking slice. Future booking/package foreign keys must restrict deletion or
promote archival once services can have history.

There is deliberately no public service catalog here, so operator-only service notes
cannot leak through a reused response. The seed imports the current five-service demo but
derives their response currency from the EUR workspace even though the disconnected Phase
1 mock frontend still displays GBP. Notification baseline, generated OpenAPI transport
types, and coherent frontend wiring remain before any API-mode cutover.

### Entry 026 — Local startup is one idempotent root command

*2026-07-28.* `./scripts/dev` is the canonical full-stack local entry point. It checks
Docker/uv/npm, creates missing untracked env files from the committed examples, syncs both
dependency sets, starts PostgreSQL with Compose health waiting, advances Alembic to head,
imports the idempotent demo seed, and runs the FastAPI and Next.js development servers.
The preparation steps intentionally run on every start: each is idempotent, and this
prevents a branch switch from leaving dependencies or schema silently stale.

Alembic's own `alembic_version` table remains the migration ledger; a second Slotera-
specific table was rejected because it would duplicate framework state and could drift.
`--prepare-only` exposes the same setup path without long-running application processes,
which is useful for verification and database preparation rather than a second workflow.

The script owns only the two application processes it launches. Ctrl-C stops them and
returns status 130, while PostgreSQL deliberately remains running and its named volume is
never removed. This keeps subsequent starts fast and avoids making a development-stop
command destructive. Docker lifecycle beyond starting the `db` service remains explicit.

### Entry 027 — Notifications store events, not rendered UI copy

*2026-07-28.* The operator notification baseline adds `GET /notifications` and
`POST /notifications/mark-all-read`. Notifications persist a stable event kind, a typed
JSON payload, optional resource reference, occurrence time, and nullable read time. They
do not store icon, tone, title, detail, relative-age text, or a redundant unread boolean.
Those values depend on client presentation, locale, and the current clock; generated
transport adapters will map structured events into the existing frontend display model.

**A notification belongs to both a workspace and one recipient.** The database requires
the `(workspace_id, recipient_user_id)` pair to exist as a workspace membership. Requests
derive both values from the verified session, repositories predicate on both, and a
principal transaction sets both values for forced RLS. This adds defense against accidental
same-workspace disclosure rather than treating workspace isolation as sufficient for
personal notifications.

**Acknowledgement is a narrow database capability.** The runtime role receives `SELECT`
and column-level `UPDATE(read_at)` only. It has no insert/delete permission and cannot
rewrite the kind, payload, recipient, or resource reference. Notification creation stays
with future booking/session/payment domain transactions; no generic operator-facing
create endpoint or premature producer abstraction was added. Mark-all-read is not written
to the audit log because it is low-value UI acknowledgement rather than a business record.

The list response includes a total unread count independent of its 50-item default/100-
item maximum window. Individual read/unread mutation was rejected for now because the
current UI exposes only mark-all-read; add it when a real interaction requires it. Four
deterministic structured events seed the contract until their actual domain producers
land. This baseline is in-app state only and has no relationship to transactional email,
outbox processing, or scheduled reminders.

### Entry 028 — The first API cutover is an opt-in operator island

*2026-07-28.* FastAPI's OpenAPI document now generates committed TypeScript transport
types under `web/src/api/generated/`. A small local HTTP client owns credentialed fetch,
no-store semantics, the readable-cookie CSRF header, and the structured backend error
envelope. Service adapters map those DTOs into the established component-facing types;
generated transport shapes do not escape into components.

The opt-in `./scripts/dev --api` environment wires cookie login/session restoration and
logout, operator services, business settings, saved locations, and structured
notifications. The default command and Vercel environment remain mock-backed. API-mode
operator navigation exposes only Services and Business Settings, sends operators there
after login, disables the mock-derived command palette, hides mock-only account actions,
and redirects direct visits to other operator routes. The public booking resolver also
fails explicitly in API mode so an authenticated operator response—including private
service notes—can never be repurposed as a public catalog.

**Alternative rejected:** composing real settings/services with mocked dashboard,
bookings, forms, packages, or public-booking relationships. It would make the UI look more
complete but silently combine UUIDs and server persistence with incompatible fixture ids.
Maintainability and the operator/client data boundary outweighed route count. The island
expands when scheduling and operator-core resources land as their next coherent bundle;
until then, unimplemented services continue to throw rather than fall back.

### Entry 029 — Recurrence is a validated series over materialised sessions

*2026-07-28.* The first scheduling backend stores workspace availability as one policy,
normalized split working-hour windows, and blackout ranges; the IANA timezone remains
single-sourced on the workspace. `PUT /availability` replaces that aggregate atomically,
so clients cannot leave a half-updated policy across multiple requests.

Sessions are occurrence rows whether one-off or recurring. A recurring create adds a
validated weekly-rule series and materialises a DST-aware rolling six-month horizon;
ordinary list/get behavior remains occurrence-oriented for web and future native clients.
Patches explicitly choose `this` or `this_and_following`. The latter updates already-
materialised future occurrences; a database-backed horizon worker and series splitting
remain deferred until worker infrastructure exists.

**Alternative rejected:** persisting an opaque recurrence JSON blob and deriving every
calendar view dynamically. It costs fewer tables now, but weakens validation, makes
exception edits ambiguous, and prevents bookings from locking a concrete occurrence.
Materialisation costs more rows but gives every booking a stable lock target.

The final overlap decision lives in PostgreSQL: `btree_gist` plus a deferrable partial
exclusion constraint on calendar owner and half-open time range. Adjacent sessions and
times occupied only by cancelled sessions are allowed; concurrent active overlap is not.
Composite workspace foreign keys prevent a session from referencing another tenant's
service, series, or calendar owner even if an application predicate regresses. Capacity
is validated on the session row, while booked/held capacity remains with the future
booking transaction because no capacity-consuming table exists yet.

---

### Entry 030 — API Calendar is a scheduling-only resource bundle

*2026-07-29.* The local API Calendar maps generated session and availability DTOs through
the existing service layer and exposes the Calendar plus Calendar Settings routes in API
mode. It loads only persisted sessions and services. Calendar Settings persists the full
availability aggregate—timezone, windows, policy values, and blackout ranges—so editing
working hours does not discard policy or blackout data.

The calendar intentionally does **not** call mocked bookings, clients, attendance, or
session-action-item services in API mode. Those fixture relationships use different ids and
would turn a partially wired view into a misleading mixed-data surface. Session internal
notes remain available because they are part of the session resource; the mock-only drawer
tabs disappear until their resources are implemented. PostgreSQL remains the conflict
authority in API mode, while the mock calendar retains its local advisory warning.

**Alternative rejected:** making API Calendar look complete by falling back to fixture data
for booking context or action items. That would be cheaper today but violates the coherent
environment rule and risks displaying unrelated client data beside a real session. The
decision turns on maintainability and tenant correctness; it should be revisited only when
the operator-core booking, client, attendance, and action-item APIs are wired together.

---

### Entry 031 — Client profiles precede the booking ledger

*2026-07-29.* Client persistence owns only stable identity and operator-maintained contact
profile data. Email is normalized and unique within a workspace; the client UUID, rather
than email, is the future booking relationship key. The API deliberately returns no
fixture booking totals, activity tags, notes, or recent bookings.

**Alternative rejected:** storing the current UI totals/tag or filling them with mock data
to retain a fuller detail page in API mode. Those values are booking-derived and would
become stale dual writes before a booking ledger exists. Maintainability and tenant
correctness win; the profile expands when bookings and notes have real backing resources.

---

### Entry 032 — Bookings begin as a read-only ledger

*2026-07-29.* The first booking API stores tenant-scoped client/session references and
amount/currency snapshots, but exposes only list and detail reads. Composite tenant foreign
keys prevent a booking from referencing a client or session in another workspace, and
deleting a referenced session is restricted.

**Alternative rejected:** adding create, cancellation, payment-state, or attendance commands
alongside the table. Each changes capacity or money-adjacent business state, so a convenient
CRUD endpoint would be an incorrect transaction before the deferred capacity and payment
rules exist. Correctness and future command semantics outweigh a more interactive UI.

---

### Entry 033 — Templates own form/service attachments

*2026-07-29.* Form fields persist as one template-owned JSON aggregate, while a tenant-scoped
join table validates the template-owned attached-service list against real workspace services.
The Service model has no reverse attachment field.

**Alternative rejected:** storing service UUIDs only in JSON. That would be cheaper, but loses
database-enforced tenant references and leaves deleted-service handling ambiguous.

---

## Thematic sections

### Modelling: what is deliberately *not* in the data model

- **No `type` field on `Service`.** Ever. A service is name, description, duration, price,
  capacity, location type, booking mode, optional address, active flag, optional notes. A
  category enum ("consulting / yoga / workshop") was rejected because it hardcodes a
  vertical into the schema, and the product's positioning is expected to keep moving
  across verticals while the model stays generic. If grouping becomes necessary, it should
  arrive as a deliberate flexible tag system, not a fixed enum.
- **No "1:1 vs group" service type.** Branch on `capacity`: `1` is an appointment, `>1` is
  a class/workshop. A group session is not a distinct entity, so the attendance tab, the
  "X / Y booked" calendar cell, and the spots wording all key off the same number.
- **`bookingMode: "open" | "scheduled"` is a mechanic, not a category.** `open` generates
  slots from working hours; `scheduled` lists operator-created sessions. It answers *how
  is this booked*, and should not be branched on the way a category would be.
- **`notes?: string` is a single field, not a log**, on Service, Session, and Booking.
  Client notes are the one exception (Entry 018). The recorded rule: if a
  multi-author/audit shape becomes useful, promote **all three together** to
  `notes: NoteEntry[]` — do not fork the shape per entity.

### Framework-level bug catches

Four of these cost real debugging time and are all documented at the point of the fix:

1. **Tailwind v4 numeric-scale collision** — `.h-1` as a heading class (Entry 003).
2. **Tailwind v4 cascade layers** — unlayered element resets beating utilities
   (Entry 005).
3. **`tailwind-merge` dropping unknown `text-*` classes** (Entry 004).
4. **Next 16 + Turbopack `Performance.measure` race** on redirect-only page bodies
   (Entry 006).

Two more are handled in code rather than by a rule:

5. **Recharts `width(-1) / height(-1)` warnings.** `ResponsiveContainer` falls back to
   `-1` dimensions when its parent is briefly detached or zero-sized during a route
   transition, printing console noise on every navigation. `TrendChart` gates the chart on
   a `ResizeObserver`-measured positive size so it mounts only once the container has real
   dimensions.
6. **`react-hooks/set-state-in-effect` disabled project-wide.** Two legitimate Phase 1
   patterns trip it: mount-once data fetches (`useEffect(() => { load() }, [])` setting
   loading/data state) and SSR-portal mount flags. The rule was disabled rather than
   suppressed at ~40 call sites. This is a **Phase 1 accommodation** — when data fetching
   moves to a real backend and can be restructured, the rule is worth re-enabling.

### Rejected alternatives, collected

| Considered | Rejected because |
|---|---|
| `tailwind.config.ts` theme extension | Tailwind v4's CSS-first `@theme` is the supported path and keeps tokens next to their utilities |
| Permission/capability system | two fixed, non-overlapping roles; no real authorisation boundary in Phase 1 |
| Separate mobile dialog components | two implementations of one interaction drift; `DrawerShell` renders a bottom sheet instead |
| `SuperadminDrawersProvider` (now) | one drawer, two call sites — ceremony. Trigger to revisit is recorded in Entry 008 |
| Inquiry status enum | no behaviour behind the states (Entry 013) |
| Dual-write attachment relationships | drift with no transactions (Entry 015) |
| `Package` + `PackageProgram` split | no behavioural difference between them (Entry 016) |
| Redirect from `/reservation/demo` | never public; permanent redirects for demo paths are cache-sticky debt (Entry 017) |
| Markdown-marker note editor | operators should see formatting, not syntax (Entry 018) |
| PayPal / SEPA payment methods | multiplied UI surface for a prototype handling no real money (Entry 010) |
| Per-service manual payment instructions | an operator has one bank account, not one per service (Entry 010) |
| Separate `platform-billing.service.ts` | platform workspaces, subscriptions, and inquiries are one cohesive surface — kept in `platform.service.ts` |
| Search results page | Phase 1 search is a mocked index; a dropdown plus a palette covers it |
| Microservices for Phase 2 | one team and one transactional domain; distributed deployment adds failure modes without independent ownership or scaling pressure (Entry 020) |
| Automatic per-method mock/API fallback | API ids combined with mock relationships would fail silently; keep coherent environments and explicit unimplemented paths (Entry 020) |
| Redis/Celery for first transactional emails | the PostgreSQL outbox worker is durable with infrastructure already required; revisit for heavier scheduling/retry volume (Entry 020) |
| Independent service/package currencies | dashboard and client aggregates have no conversion model; one workspace currency keeps totals meaningful (Entry 020) |

### Scope boundaries that were argued and settled

- **The booking workspace (`/booking/manage/demo`) is not a portal.** "Shared resources"
  and a client-facing "your next steps" list were both built and then **removed** — the
  page was becoming a project-management surface. The resources feature (type, service,
  and fixtures) was deleted outright as unused. `clientVisible` survives on
  `SessionActionItem` for a possible future client surface, but action items are
  **admin-only today** and must not be surfaced there. The now-unused
  `listClientActionItemsForSession` helper was deleted with the feature rather than left
  as dead code.
- **Internal notes never reach clients.** Service notes, session notes, and client notes
  are all operator-only, and the booking workspace exposes none of them.
- **A booking becoming `confirmed` on the success route is a Phase 1 shortcut.** The
  recorded forward rule: a free booking confirms atomically, a manual-payment booking
  confirms when verified, and a card-funded booking confirms by a **verified payment
  webhook**. The user landing on a success page confirms none of them. This must not
  harden into business logic that survives into Phase 2/3.
- **The public booking service list is curated in the resolver, never render-sliced.**
  `listBookingServices()` in `demo.service.ts` resolves either a persona's `serviceIds` or
  `STANDARD_BOOKING_SERVICE_IDS`. The reasoning, comment-documented at the constant: a
  demo booking page showing every active service in the workspace reads as an unedited
  admin list, and slicing at render time hides the curation from anyone reading the data
  layer. Four services is the calibrated sweet spot.
- **Positioning claims are constrained.** "UK GDPR-aware," never "GDPR compliant." No
  medical, clinical, patient, or compliance claims — the vet and therapist personas exist
  as flexible examples only and are kept out of the public pitch. `Velora Labs` is the
  mock legal entity and appears only in the footer copyright and the imprint tab; the
  product brand is Slotera everywhere else.

### Documentation lanes

The product rulebook predates this doc set and had grown into a mix of product rules,
structural description, and hard-won gotchas. Rather than split a 50KB+ working document —
and risk losing rules that are load-bearing for the product — it was kept whole as the
**product rulebook** and the rest of the system was layered around it. Each document has
exactly one lane:

| Document | Lane |
|---|---|
| `AGENTS.md` | what the code currently is — layout, stack, how to run, feature snapshot. The entry point. |
| `docs/PRODUCT.md` | what the product must be — positioning, domain vocabulary, per-surface rules, "never reintroduce X" |
| `docs/HISTORY.md` | why it is that way |
| `docs/TODO.md` | what is deliberately not built yet |
| `docs/RULES.md` | how to work on it |
| `skills/*/SKILL.md` | how to approach one *kind* of task — the workflow layer |

The overlap between `docs/PRODUCT.md` and `AGENTS.md` is real but bounded: `AGENTS.md`
describes structure and mechanics, `docs/PRODUCT.md` states product rules. On a
product-rule conflict, `docs/PRODUCT.md` wins and the mismatch should be flagged rather
than silently resolved.
