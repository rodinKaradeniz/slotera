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

### Entry 034 — Client notes cross a trust boundary at persistence

*2026-07-29.* Client notes now persist as distinct, tenant-scoped `client_notes` rows
under forced RLS, rather than relying on the mock-only local editor. The resource is
operator-only: list/create is nested under its client, while update/delete target the note
itself; every mutation requires the normal session/CSRF boundary and emits an audit event.
No public booking or client workspace DTO includes these records.

Tiptap output became untrusted as soon as it crossed HTTP. The server therefore retains
only the deliberately small editor tag allow-list, strips every attribute and script/style
content, and rejects bodies left without visible text. `NoteContent` repeats that policy in
the browser before rendering, so a malformed legacy row or alternate transport does not
turn `dangerouslySetInnerHTML` into a trust bypass. Do not loosen either layer without a
specific content-security design.

---

### Entry 035 — Session action items remain session-bound operator tasks

*2026-07-29.* Session action items persist as tenant-scoped rows with an owning session,
not as a generic workspace task system. They use ordinary item `PATCH` for an explicit
`todo`/`done` status change, rather than a second toggle command, so web and future clients
share one patch contract. The Calendar drawer keeps the existing small interaction model.

`clientVisible` is stored deliberately because the mock domain already represented it, but
it changes no authorisation or transport: no public or client-booking response exposes an
action item. The resource is protected by the normal operator session, CSRF, forced RLS,
and audit-event boundaries.

**Alternative rejected:** a generic task/assignee/reminder system or public sharing based
on `clientVisible`. Either would turn an operator session aid into a CRM/project board and
would weaken the standing operator/client boundary. Revisit only if a deliberate future
product surface needs cross-session ownership or client task access.

---

### Entry 036 — Dashboard is a tenant-scoped read model, not client composition

*2026-07-29.* The API dashboard is one authenticated `GET /dashboard/summary` resource.
It returns facts rather than presentation: workspace currency/timezone, current and prior
month booking aggregates, a 30-day daily trend, next/today session context, weekly session
count, and the current operator's unread-notification/open-action-item counts. The
repository uses the principal transaction context because notification RLS is recipient as
well as workspace scoped. The web service maps those facts to existing labels, money
formatting, relative KPI deltas, and schedule presentation.

**Alternative rejected:** composing the API dashboard from browser calls to bookings,
sessions, notifications, and action items, or preserving fixture-only conversion metrics.
The former spreads aggregate rules across clients and increases partial-data failure modes;
the latter makes a persistence-backed surface show invented facts. Revisit the response
shape only when another real client needs a materially different aggregate or a persisted
funnel denominator makes conversion well-defined.

---

### Entry 037 — Operator search is a bounded projection, not a page endpoint

*2026-07-29.* Operator search uses one authenticated `GET /search` resource over the
existing booking, client, service, and session rows. It accepts a non-empty query and a
small per-kind cap, applies workspace predicates and forced RLS in one tenant transaction,
and returns only resource kind/id plus compact search display facts. The web layer retains
icons, routes, local navigation entries, timestamp formatting, and grouping; API mode
never inserts fixture records into those results.

**Alternative rejected:** firing four browser searches against existing list endpoints,
or adding PostgreSQL full-text indexes now. Browser composition duplicates ranking/limits
for future clients and can fail partially; full-text infrastructure adds a migration and
language/relevance policy before current workspace data warrants it. Revisit indexing when
measured data size or query latency requires it. Notes and action items are intentionally
excluded: their internal context is neither needed for navigation nor appropriate to widen
through a general search projection.

---

### Entry 038 — Platform workspace access is an allow-listed global projection

*2026-07-30.* The first persisted superadmin bundle is deliberately read-only: a workspace
directory and detail view with workspace identity/configuration, a first operator owner,
and aggregate service/client/booking/session counts. The API grants no platform mutation,
subscription, inquiry, note, billing, activity, suspension, provisioning, or impersonation
capability.

Forced tenant RLS remains unchanged. Instead of adding a superadmin exception to every
tenant policy or granting the runtime role broad table access, two fixed-search-path
`SECURITY DEFINER` functions execute as the migration owner and return only those safe
columns. `slotera_app` gets `EXECUTE` on the functions, not direct access to the identity
tables or a generic cross-workspace read. FastAPI independently requires the verified
`superadmin` role before it calls either projection.

**Alternative rejected:** a session setting that lets superadmins bypass tenant policies,
or reusing the operator’s active workspace context. The former turns every tenant table
into a global read surface; the latter violates the no-synthetic-workspace decision and
cannot represent a platform directory. Revisit the boundary only when a separately
modelled platform-reporting or support capability has concrete, audited data needs.

---

### Entry 039 — Workspace provisioning is one audited platform capability

*2026-07-30.* The first persisted platform command is `POST /platform/workspaces`. It
atomically creates a EUR workspace, one operator identity/membership, a baseline business
profile, and a tenant audit event. The command takes only workspace identity, initial
operator identity, and timezone; it does not create a platform subscription, provision a
password, or send an invitation.

**Why provisioning is a function rather than a superadmin RLS exemption:** the runtime
role still cannot query or mutate global users/workspaces directly, and a superadmin
session must not become a general tenant-table bypass. A fixed-search-path
`SECURITY DEFINER` function receives generated record ids, checks that the passed actor is
still a platform superadmin, checks reserved/used slugs and globally used owner emails,
then writes the complete initial graph in one database transaction. FastAPI repeats the
session-role check and applies the existing CSRF/exact-Origin boundary before it can call
the function. Duplicate inputs return explicit conflict errors without partial records.

**Why the initial operator is activation-pending:** safely delivering a credential needs
the separately deferred password-reset/invitation and transactional-email capabilities.
Accepting a platform-chosen password would create an unsafe credential handoff, while
returning one would leak it through the API. The row therefore has no password hash and
cannot log in until that later activation flow exists.

**Alternative rejected:** copying the mock New Workspace drawer's plan, billing cycle,
seat, trial, and subscription-status fields into the API. Platform billing is a separate
payment domain with no persisted model, and keeping those fields would make a real
workspace look billed when it is not. Suspension/reactivation, inquiries, and
impersonation remain separate commands/models for the same reason.

---

### Entry 040 — Scheduled-session booking commands lock capacity before state

*2026-07-31.* The booking ledger now has an operator-only command foundation: create a
pending booking for an existing client and scheduled session, then explicitly confirm,
cancel, complete, or mark it no-show. Creation locks that session row before counting
`pending` and `confirmed` bookings, so concurrent attempts for the final place serialize
and one fails rather than overfilling capacity. Each command requires an opaque,
actor-scoped idempotency key persisted under forced RLS, and writes its booking change plus
audit event in the same tenant transaction. The operator cannot set amount, currency,
status, or payment status at creation: amount/currency snapshot from the session service
and workspace; creation is `pending`/`pending`; lifecycle transitions never modify payment
state.

The commands deliberately cover existing scheduled sessions only. Open-mode creation needs
its separately recorded advisory-lock target, and payment holds, payment verification,
public booking, attendance, and a command UI remain deferred. The API-mode booking screen
therefore stays a read-only ledger even though its generated API contract now exposes the
commands.

**Alternative rejected:** a generic booking `PATCH` or a standalone capacity counter.
`PATCH` would allow invalid transitions and money-adjacent field edits, while a counter
would drift under cancellation/retries and cannot prevent the last-place race. Session-row
locking plus a status-derived count turns on transactional correctness; revisit only when
open-mode slots or active holds need their own lock strategy.

---

### Entry 041 — Attendance is a group-session command, not a mutable booking field

*2026-07-31.* Migration `20260731_0016` adds optional persisted booking attendance using
the fixed `present | late | absent` vocabulary. `POST /bookings/{booking_id}/attendance`
locks both the booking and its session in the tenant transaction, is actor-idempotent and
audited, and accepts only confirmed/completed bookings whose session capacity exceeds one.
It always leaves the booking completed and never changes payment state; a later correction
updates the recorded outcome while retaining that completed lifecycle state. The
session-filtered booking resource provides the group roster, and API-mode Calendar joins it
to the existing tenant-scoped client resource in the SessionDrawer—never to mock fixtures.

**Alternative rejected:** treating attendance as generic `PATCH /bookings/{id}` data, or
adding a distinct group-booking entity/batch mutation. Generic patching would permit
attendance for 1:1 or pending/cancelled bookings and disconnect it from lifecycle/audit
rules. A separate group entity would violate the capacity-based domain model. A server batch
command is premature: the existing quick action composes the same safe idempotent command
per attendee. Transactional correctness and the single `capacity > 1` rule drove the
decision; revisit a true batch endpoint only if roster-scale or all-or-nothing semantics
become a demonstrated product need.

---

### Entry 042 — Workspace suspension is an access state, not a billing state

*2026-08-01.* Persisted workspaces now carry a separate `active | suspended` operational
status. A platform superadmin can suspend or reactivate through explicit CSRF-protected
commands backed by one fixed-search-path `SECURITY DEFINER` capability. Only real state
transitions write audit events, so retries are idempotent without a separate command-key
table. Suspension revokes every current operator session for that workspace, and the
login/session database functions reject suspended workspaces. Reactivation permits a new
login but never resurrects a revoked credential.

**Why this is separate from subscriptions:** loss of access may be an operational or
security intervention and cannot safely be inferred from a mocked plan, invoice, or
payment status. The command retains all tenant data and changes no booking, payment,
subscription, or billing fact. This keeps the two payment domains out of the access-control
boundary and prevents a future billing retry from silently becoming an authorisation
decision.

The restricted runtime role can execute the narrow status capability but can no longer
update the workspace root table directly. Forced tenant RLS and the two display-safe
platform projections remain unchanged; no global table grant or superadmin RLS bypass was
added.

**Alternative rejected:** implement activation/password reset as the next platform
bundle. Provisioned operators have no safe credential-delivery channel yet, and returning
an activation secret to platform staff would create the credential-handoff problem the
activation-pending model deliberately avoids. That bundle remains paired with the
transactional-email boundary. Notification producers were also left with their owning
future public-booking/payment events rather than emitting notifications for an operator's
own administrative commands.

---

### Entry 043 — Release MVP uses activation links, offline payments, and open capacity-one slots

*2026-08-03.* The first release bundle closes three independent but connected gaps. A
platform-provisioned operator now receives a hashed, one-time activation/password-reset
credential through a PostgreSQL outbox worker; consuming it rotates the password and
revokes every existing session. Login and reset requests use shared PostgreSQL throttles,
and maintenance removes stale auth/rate-limit/outbox rows. Production configuration
requires the Resend provider; the console provider is explicitly local/test-only.

Workspace client-payment settings now persist manual-payment instructions, provider terms,
and `none | fixed` tax configuration. Service prices are gross/tax-inclusive. Each booking
stores immutable gross, net, tax, rate, treatment, label, jurisdiction, seller-number,
currency, and billing-address snapshots; this is a booking/payment summary, not a numbered
tax invoice. No card, bank-account, Stripe, refund, or tax-provider behavior was introduced.

The public API publishes only active open-mode services with capacity one. Availability
returns open slots, never occupied blocks. Creation rederives the slot in the workspace
timezone under advisory idempotency/slot locks, materialises a capacity-one session, and
creates either a confirmed free booking or a capacity-consuming pending manual booking.
Attached active pre-payment forms are validated and snapshotted in that same tenant/RLS
transaction. The browser keeps the exact server-issued instant so client timezone cannot
silently change the booking.

**Alternatives rejected:** returning activation secrets to platform staff; direct card or
bank handling by Slotera; showing booked blocks on the public calendar; broad platform
table privileges; and API-mode fallback to mock availability or checkout. Each would
weaken either credential custody, payment/legal boundaries, privacy, tenancy, or transport
coherence. Scheduled/group public booking, confirmation/magic-link email, payment
reconciliation, holds, Stripe, reminders, and impersonation remain separate milestones.

---

### Entry 044 — Confirmation is the conjunction of independent approval and payment gates

*2026-08-06.* Each service now owns `automatic | operator_approval`, snapshotted on every
booking. Approval is persisted separately as `not_required | pending | approved |
declined`; it is neither a payment state nor a new booking-lifecycle synonym. A booking
can become confirmed only when payment is `free | paid` and approval is `not_required |
approved`. This yields four truthful initial outcomes: automatic/free confirms;
automatic/manual waits for payment; approval/free waits for approval; approval/manual
waits for both. The operator commands for approval, decline, manual-payment receipt, and
cancellation are narrow, actor-idempotent, and audited, and the API-mode detail surface
only offers commands valid for the current gates.

Public bookings now retain their submitted contact independently of the matched client
profile, along with provider/platform terms acceptance, exact manual-payment instructions,
and financial snapshots. Reusing a normalized client email never overwrites the saved
profile or discards what was submitted for that transaction. Public-created capacity-one
sessions are marked distinctly so decline, cancellation, and payment expiry can release
their slot without cancelling an operator-created session.

The booking transaction emits deduplicated `booking_received` or `booking_confirmed`
events through the existing PostgreSQL outbox, and later gate completion emits confirmation
exactly once. Typed provider-neutral templates work with the local console provider now;
external provider/domain setup remains operational. Matching operator notifications carry
only resource ids and non-PII facts—client/service names stay out of notification payloads.
The customer confirmation page reports the persisted outcome and pending gates; it does
not invent confirmation, a meeting link, or a booking-management credential.

**Alternatives rejected:** treating manual-payment submission as paid; overloading
`pending` with an unmodelled approval meaning; adding a second “requested” lifecycle;
using the current client profile as historical booking evidence; cancelling any session
when a booking ends; introducing Stripe, customer accounts, or an all-history client
dashboard in this pass. Those choices would blur state ownership, weaken evidence, or
expand the authorization/product boundary before it is needed.

### Entry 045 — The demo is a showcase; sign-up is one step and email-verified

*2026-10-09.* The mock demo exists for prospects and portfolio visitors, so account
flows (sign-up, onboarding, password reset) and the superadmin area now 404 there and the
landing CTAs open the contact form instead. In the real app, sign-up is a single form:
`POST /auth/signup` creates the workspace, an activation-pending owner, and baseline
settings (payment settings and an availability policy), then sends the existing
activation link. The link is the email verification; no password exists until it is
used. Sign-up answers the same way for an already-registered email (and sends that owner
a fresh link), so it cannot be used to enumerate accounts; slugs are public and a taken
slug is reported. Superadmin provisioning and sign-up share one internal database
function so the two paths cannot drift. Pricing is two identical-feature tiers, Free
(€0 + 3% per card payment) and Pro (€19 + 1%); Free replaces a trial.

Each workspace's public page is `/book/{slug}`. The booking flow's many components and
services read the selected workspace from one module-level value set by that route,
rather than threading a slug through every call. Onboarding completion is a single
timestamp on the business profile, and resume is derived from data.

**Alternatives rejected:** keeping plan choice and a mock card form in sign-up (no real
billing exists yet); choosing a password at sign-up (unverified addresses); a client-side
onboarding checklist in `localStorage` (lost across devices); a separate sign-up SQL
function duplicating provisioning.

### Entry 046 — Customers manage one booking through an emailed link

*2026-10-09.* Customers still have no accounts. Each booking email carries a fresh link
to that booking; the token sits in the URL fragment (never sent to servers, so never
logged), only its hash is stored, and it expires 30 days after the session. One fixed
database function maps token to booking; all reads and changes then run inside that
booking's tenant transaction and return an allow-list.

Customers may cancel, and reschedule once, until a workspace-wide cutoff (default 24h).
"Once" keeps the existing one-email-per-kind outbox rule and avoids a customer endlessly
moving a slot; further changes go through the provider. Cancelling never changes payment
state. Reminders are queued by the existing maintenance job, not a new worker or
scheduler: a query finds confirmed bookings starting within 24h with no reminder, and the
outbox's per-booking uniqueness makes reruns harmless.

Scheduled services became publicly bookable by reusing the operator path: lock the
session, count pending/confirmed bookings, refuse when full. Joining never creates or
cancels an operator session; only public 1:1 sessions are released.

**Alternatives rejected:** token in the path or query string (logged by proxies);
customer accounts or an all-bookings dashboard; unlimited reschedules (needs a new outbox
key per change); a dedicated reminder worker or Redis/Celery.

### Entry 047 — Plans are a column, not a subscription system

*2026-10-09.* Platform billing is two identical-feature plans (Free £0 + 3%, Pro £19 + 1%
of card payments). Until Stripe exists, a plan is a `workspaces.plan` value changed only
by an audited superadmin command, Pro is invoiced manually, and Settings → Billing turns
"Upgrade" into an inquiry. There is no trial, status machine, or invoice model: Free is the
trial, and real billing state arrives with Stripe Billing. Inquiries are global platform
data reached only through fixed functions, and the overview is one aggregate query. The
mock-only Subscriptions/Settings superadmin pages and the MRR-style overview were removed
because the platform area is no longer part of the demo.

**Alternatives rejected:** porting the mock subscription model (trialing/past_due,
invoices) before any payment provider exists; a self-serve plan switch that nothing
charges for.

---

### Entry 048 — Series top up in the maintenance job; currency is per workspace, GBP first

*2026-10-10.* Recurring series used to stop after the six months created up front. The
existing `slotera-maintenance` job now tops every open-ended series back up to
`ROLLING_HORIZON_DAYS`. Each new occurrence copies the latest live one, so "this and
following" edits carry forward without series splitting, and a slot that clashes with
another session is skipped rather than failing the run. A "create more sessions" reminder
was rejected: it needs the same extend step plus notification plumbing, and a missed
reminder silently empties a booking page.

Merulio will be an English company, so platform pricing is GBP only. Client prices stay
per workspace: the currency is chosen at sign-up (GBP, EUR or USD), fixed afterwards, and
snapshotted on bookings. There is no conversion. A tenant in Turkey or Tanzania prices in
their own currency, added to the allowed list when one exists. Stripe may not onboard
those countries, so they would start on manual payments.

**Alternatives rejected:** one GBP currency for all tenants with conversion (exchange-rate
handling and rounding disputes for no gain); a fully open ISO currency list before any
tenant needs it.

### Entry 049 — Client pages drop marketing; logic gets unit tests; the superadmin area loses its mock

*2026-10-10.* Pages a client sees (booking, confirmation, manage) show the workspace name
and a "Powered by Slotera" footer instead of Slotera's marketing navigation. The demo keeps
the navigation because its visitors are evaluating Slotera. The FAQ now describes only
what ships. The maintenance page returns 503 with `Retry-After` so uptime checks notice it.

Vitest runs logic-only tests in Node: money formatting, navigation and guard rules, date
keys, DTO mappers and the maintenance proxy. These are the places that broke silently
before. Component snapshot tests were rejected as costly to maintain and low in signal.

The superadmin area has been real-app-only since Entry 045. Its mock branches,
subscription fixtures and the old Solo/Team billing service were dead code and are gone,
so `platform.service.ts` keeps a mock branch only for the demo's contact form.

### Entry 050 — Erasure keeps financial facts; legal drafts; one Hetzner box

*2026-10-10.* Operators can export a client's data as JSON and erase a client after
retyping their email. Erasure anonymises the client, deletes notes and form answers,
blanks the contact and billing snapshots on their bookings, revokes manage links, and
scrubs their booking emails (unsent emails are deleted; sent ones keep a blank row that
still blocks duplicate reminders). Amounts, tax, currency and payment state stay as
financial records. Terms, Privacy Policy and DPA are published as clearly marked drafts
for solicitor review. Merulio Ltd is the provider and the processor of operators' client
data.

Deployment is one Hetzner server running Docker Compose: Caddy, the demo and app web
images, the API, worker, a 15-minute maintenance loop, PostgreSQL and a nightly
`pg_dump` mirrored to a Storage Box. A local run from an empty volume migrated cleanly,
and a dump was restored in a restore drill.

**Alternatives rejected:** hard-deleting clients (destroys records that must be kept);
managed PostgreSQL and a separate scheduler at MVP scale; WAL archiving before daily
backups have proven insufficient.

### Entry 051 — Sentry for errors, with personal data kept out

*2026-10-10.* The API, email worker and maintenance job report errors and a sample of
request timings to Sentry (`sentry-sdk`); the real app's browser, server and proxy do
the same (`@sentry/nextjs` 10.x). Both are off unless a DSN is set, and only the
`web-app` image gets one, so the demo never reports. Events carry the release and the
API's `request_id` tag. Personal data is kept out: no default PII, request bodies or
frame variables, and every URL loses its query string and fragment (manage links carry
their token after `#`, reset links after `?token=`, search terms are client names). A
local check caught browser prefetch spans leaking the manage token in `url.full`, so URL
attributes are scrubbed by key pattern. Source maps upload during the Docker build with a
BuildKit secret, and are deleted from the image afterwards.

The setup stays inside Sentry's free Developer plan: two projects, a 10% trace sample with
health checks excluded, no Session Replay, no code-defined cron monitors.

**Alternatives rejected:** Session Replay (records client names and emails on screen);
v11 of the Next.js SDK (two weeks old at the time); cron check-ins (not clearly in the free
plan; the uptime monitor and worker errors cover the same failures).

### Entry 052 — Two paid tiers, a trial, and an invite-only pilot

*2026-10-11.* Free/Pro became **Essentials** (£19/mo or £190/yr, 2% card cut) and
**Professional** (£39/mo or £390/yr, 1%, no "Powered by Slotera", priority support,
WhatsApp later). Every workspace gets a 30-day trial; staff record the plan, billing
interval, trial end and paid-through date in one audited superadmin command (migration
0029). Nothing locks automatically: the dashboard reminds the operator, and suspension
stays manual. Sign-up is invite-only during the pilot (`SLOTERA_SIGNUP_OPEN`), and the
public pricing page has a monthly/yearly toggle and says Stripe's fee is extra.

**Alternatives rejected:** keeping a free tier (card cuts earn nothing until Stripe is
live, so the flat fee is the only income); a higher card cut (pushes operators to bank
transfer); automatic lock-out after the trial (staff follow up by hand at this size).

### Entry 053 — Pilot waitlist and launch support

*2026-10-11.* The real app has `/pilot`, a waitlist form stored as a **Pilot application**
inquiry (no new table); "Promote to workspace" provisions it prefilled. The demo links
there through `NEXT_PUBLIC_APP_URL` and still never calls the API. Footers link to support,
the operator menu's "Report a problem" now works in the real app, and `slotera-smoke`
checks a deployment read-only. The API's uvicorn access log is off (the JSON request log
covers every request), because it would have recorded calendar-feed tokens.

**Alternatives rejected:** a confirmation email for applications (lets anyone use the
form to mail strangers); the form directly on the demo (the first crack in the mock/API
split).

### Entry 054 — Calendar files, a subscribe feed and meeting links

*2026-10-11.* Services can carry one https meeting link (migration 0030), shown to clients
only once confirmed. Confirmed, rescheduled and cancelled emails attach `booking.ics`
(one UID per booking, so later files replace earlier ones); clients also get "Add to your
calendar" (file + Google link) on the confirmation and manage pages. Operators get a
private, revocable subscribe feed (migration 0031) with sessions and client names but no
contact details; its token is redacted from logs and Sentry. The server and browser write
the same iCalendar format, each with tests.

**Alternatives rejected:** two-way Google sync now (OAuth app verification takes weeks);
putting the manage link in calendar entries (they get shared); per-user feeds filtered by
calendar owner (one-operator workspaces; revisit with team accounts).

---

### Entry 055 — Pre-pilot hardening, slotera.io, and closing a workspace

*2026-10-12.* The production domain became slotera.io; the bare domain redirects to `www.`.
Email stays on `no-reply@slotera.merulio.com` (verified in Resend) and the support and
legal contact is `slotera@merulio.com`.

- **Operations:**
  - Each compose service now lists the variables it reads instead of loading all of
    `deploy/.env`. Only `migrate` gets the owner database connection.
  - Caddy sets security headers on every host.
  - `restore-drill.sh` proves a backup restores, optionally from the Storage Box.
  - The superadmin overview shows pending and failing emails with the latest error
    (migration 0032).
  - `slotera-send-test-email` checks the provider settings.
  - Tests no longer pick up a developer's Sentry DSN or Resend key from `server/.env`.
- **Emails:** every email says replies aren't read.
- **Operator emails:** the owner gets an email when a client books, cancels or
  reschedules; their own changes never email them (migration 0034).
- **Workspace data:**
  - Operators can export all workspace data as JSON. A test makes every tenant table
    either exported or deliberately excluded.
  - Operators can close their workspace, which suspends it at once. The maintenance job
    deletes it 30 days later (migration 0033), and reactivating it from the superadmin
    area cancels the closure.
- **Session outcomes:** a booking's page now offers Completed and No-show for a past
  one-to-one session, using the existing `complete` and `noshow` commands. Group
  attendance is unchanged.
- **Search engines:** the marketing site publishes `robots.txt` and a sitemap; the app
  allows only booking pages and the pilot form.
- **Fix:** `slugify` now maps the Turkish ı and German ß.

**Alternatives rejected:**
- Hard-deleting on close: there would be no undo for a mistaken click.
- A Content-Security-Policy now: Next.js inline scripts and Sentry need a nonce setup.
- Re-enabling `react-hooks/set-state-in-effect` in this round: 36 findings across 27
  files, so it stays a separate task.

### Entry 056 — `set-state-in-effect` back on

The React lint rule disabled in Phase 1 is on again (Next's default) and its 36 findings
in 27 files are fixed, not suppressed.

**What changed:**
- **`useHydrated()`** (`useSyncExternalStore`) replaces every mount-flag effect: portals
  (drawer, modal, toast, command palette) and browser-only reads (language, sidebar
  state, session name, reset and manage tokens, booking draft and confirmation).
- **`useResetOnOpen(open, deps, reset)`** resets drawer and modal forms during render, React's
  "adjust state when a prop changes" pattern, so a reopened form never shows its previous
  values for a frame.
- **Async results carry their key** (search query, session id, booking id, service id),
  so loading is derived from "the answer isn't for this key yet" instead of clearing state
  first.
- **The booking flow** restores its draft once storage is readable and only saves after
  that, so a reload can't overwrite the draft with an empty one.

**Checked in a browser (mock mode):** draft and language survive a reload, drawer
enter/exit animation, new-vs-view drawer reset, ⌘K search, sidebar state after a reload,
no console errors.

### Entry 057 — Closing gaps in existing features

A review of what already existed found places where the real app showed fake or missing
data, or had controls that did nothing. No new product surface; each item finishes
something that was already there.

**What changed:**
- **Client stats are real.** `GET /clients` and `/clients/{id}` return booking totals,
  completed and cancelled counts, paid spend and a tag (`new` has no live booking,
  `active` has one starting in the last 30 days or later, `dormant` otherwise). The client
  detail page lists the client's bookings through the new `GET /bookings?clientId=`.
  Money on the client pages uses the workspace currency, not £.
- **Operators can move a booking** to another upcoming session of the same service that
  has room (`POST /bookings/{id}/move`, idempotent, audited as `booking.moved`). A client
  who booked online gets a "booking moved" email with a fresh calendar file. Migration
  0036 adds `email_outbox.event_key` to the uniqueness so a second move still emails
  (the one-email-per-kind rule stays for every other event), and the move does not
  create the operator's own "reschedule requested" notification.
- **Operator emails can be switched off** (Settings → Emails, migration 0035): new
  booking, cancellation and reschedule, each on by default.
- **Pausing the booking page** has a control in Settings → Business Profile; before, only
  the demo dashboard had one.
- **Long lists no longer stop at the page size.** `apiListAll` pages through clients,
  bookings, services, sessions and workspaces.
- **The session drawer warns about a clash** in the real app too (`findConflict`).
- **Exports work:** Clients "Export CSV" and Bookings "Export" download a CSV (formula-
  safe, UTF-8 with byte-order mark). "Invoice PDF" became "Print summary", which prints
  the booking page without the app shell.
- **Smaller:** the dashboard no longer greets "Lena" when the name is missing; six
  public strings that were English-only in TR and DE are translated, and a test now
  fails if any English key is missing in either language.

**Rejected / decided:**
- Moving to a new date and time (rather than an existing session) would need an
  availability picker for the operator; adding the session in the Calendar first is
  enough for now.
- A bookings-by-client filter instead of a stats table: totals are computed on read with
  one grouped query per page, with no stored counters to drift.
- The move email reuses `booking_rescheduled` and its template instead of a new kind.


### Entry 058 — Correctness, simplification and hardening pass

No new features; this pass finished and tidied what exists.

**What changed:**
- **Operator session times follow the workspace timezone.** They were cut out of the UTC
  string (`startISO.slice(11, 16)`), so any workspace outside UTC saw times that disagreed
  with its public page. `clockIn` / `zonedWallToISO` (`lib/calendar.ts`) and
  `useWorkspaceTimezone()` now do it; the session drawer reads and saves the typed time in
  that zone, and derives the end from the duration so a session crossing midnight no
  longer ends before it starts. The demo reads its mock times as written (UTC).
- **Workspace currency and timezone are fetched once** per sign-in (memoised in
  `settings.service.ts`, cleared on login, logout and when settings change).
- **Failed loads show a message and a retry** (`useLoad` + `LoadError`) in Clients,
  Bookings, Calendar, client detail and booking detail, instead of loading forever.
- **The operator sidebar** shows the operator's email, not a hardcoded "Online · Berlin".
- **Backend:** one `session_capacity.py` holds the seat-holding statuses and the public
  1:1 session release (was duplicated in the booking and manage code), and the booking
  commands share one `_Command` for the idempotency replay and record steps.
- **Settings** is one file per panel instead of a single 1,400-line component.
- **Bookings list** joins client, session and service through id maps.
- **A report-only Content-Security-Policy** is sent by the web app in production
  (`lib/csp.ts`); violations show in the browser console and nothing is blocked yet.
- **Tests:** `card`, `time`, `cn`, the new calendar zone helpers, the CSP builder and the
  mock services' patch/not-found behaviour.

**Not done, on purpose:**
- Component render tests and a browser end-to-end test need packages (jsdom, Playwright)
  that were not installed and could not be fetched here.
- The `dataSource` branches inside components are mostly real differences between the
  demo and the real app, not duplicated plumbing; moving them is not a mechanical change.
- Splitting `db/models.py` and `public_booking/repository.py`, embedding names in
  `GET /bookings`, server-side paging in the UIs and excluding mock data from the real
  bundle remain on the list in `docs/TODO.md`.


### Entry 059 — Accessibility, consent record and component tests

**What changed:**
- **Dialogs trap and restore focus.** `Modal` and `DrawerShell` use `useDialogFocus()`
  (focus moves in, Tab wraps, focus returns to the opener on close) and are labelled by
  their title (`aria-labelledby`).
- **Skip link and `lang`.** Operator pages have a "Skip to content" link and a focusable
  `<main id="main">`; `<html lang>` follows the chosen language.
- **Error boundaries.** `app/error.tsx` (EN/TR/DE, reports to Sentry) and
  `app/global-error.tsx` replace the blank screen when a page throws.
- **Sign-up records the agreement.** The notice became a required checkbox, the API rejects
  `termsAccepted: false`, and a `workspace.terms_accepted` audit event names the owner and
  the three documents.
- **Privacy policy** now has a "Cookies and browser storage" section (strictly necessary
  only, so no banner).
- **Load errors** with retry also on the Dashboard and the superadmin Workspaces list.
- **Component tests.** jsdom and Testing Library are dev dependencies; `useLoad`,
  `LoadError` and `useDialogFocus` are covered. A test opts into jsdom with
  `// @vitest-environment jsdom`.

**Still open (needs the owner):** the legal documents still contain placeholders
(registered address, company number, publication dates, Resend's data location, retention
period). They must be filled before launch.

---

## Thematic sections

### Modelling: what is deliberately *not* in the data model

- **No `type` field on `Service`.** Ever. A service is name, description, duration, price,
  capacity, location type, booking mode, confirmation policy, optional address, active
  flag, optional notes. A
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
- **`confirmationPolicy: "automatic" | "operator_approval"` is a workflow gate, not a
  lifecycle.** It is snapshotted on the booking; approval state remains separate from
  payment and booking status (Entry 044).
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
   moves to a real backend and can be restructured, the rule is worth re-enabling. Re-enabled
   in Entry 056.

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
  as flexible examples only and are kept out of the public pitch. The legal entity was a mock `Velora Labs` until Entry 050; it is now Merulio Ltd, named only in the footer copyright and the legal pages.

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

### Entry 060 — Agents work without opening env files

**What changed:**
- **No generated test env file.** Tests and migrations read nothing from `.env`: the local
  database URLs are defaults in `config.py` and match `server/compose.yaml`.
- **Backend skips an unreadable env file.** `_env_file()` returns `None` when the file is
  missing or unreadable, or when `SLOTERA_ENV_FILE` is empty; `conftest.py` sets it empty.
  Production is unchanged (the container has no `.env`).
- **pytest** ignores `.env*` during collection (`--ignore-glob` in `addopts`).
- **`./scripts/dev --no-env`** creates and reads no env file, skips installs and runs compose
  with `--env-file /dev/null`.
- **`.logs/`** (gitignored): every `./scripts/dev` run tees `api.log`, `worker.log` and
  `web.log`, so an agent can read output without the developer's terminal.
- **`.claude/settings.json`** denies Read/Edit/Write on `.env`, `.env.local`, `.env.production`.
- **`scripts/env-check`** (run by the developer): compares `server/.env`, `web/.env.local`
  (and `deploy/.env` with `--deploy`) with their examples and validates the backend settings;
  it prints names and statuses only. AGENTS.md and DEPLOYMENT.md point to it.

- **Fonts are self-hosted.** `next/font/google` is replaced by `web/src/app/fonts/`
  (Fraunces, Inter Tight, JetBrains Mono as `latin` + `latin-ext` woff2, OFL licences,
  `fonts.css`), so no build or visitor contacts Google. `latin-ext` also adds the Turkish
  letters (ş, ğ, ı, İ) that the old `latin`-only subset lacked.
- **`npm run build`** now succeeds offline (first time verified here); `next start` serves
  `/`, `/login` and `/privacy` with the fonts from `/_next/static/media/`.

**Not verified:** `next dev` under the agent sandbox (its file watcher hits `EMFILE`, so routes
return 404); use `npm run build` + `npm run start` there. The developer's own dev run is unaffected.

### Entry 061 — Finish persisted offers, booking forms, themes and manual billing

*2026-11-13.* The product decisions for this completion bundle were confirmed explicitly:
packages become persisted informational offers without purchases or credits; both plans
get client-page colour/font settings; Professional alone removes the Slotera attribution;
billing stays staff-operated; all interface and transactional email languages are EN/TR/DE.

Forms are assigned and snapshotted when a booking is created. Required-before-payment
forms stay in checkout; remaining forms appear only after booking. Clients submit once,
while pending/confirmed and before the session. Booking-scoped locking makes identical
retries harmless and rejects replacement answers. Existing bookings gain no assignments;
legacy answers retain their data and explicitly mark current-template labels as approximate.
The same field validation now correctly accepts a required yes/no answer of false, while
rejecting invalid dates, choices, types, and blank required text.

One snapshot table and the existing response table preserve historical questions without
introducing template version management. Packages keep ordered service references with
composite tenant foreign keys. The public projection excludes private notes and offers
with inactive services. Billing requests reuse the inquiries inbox without a new workflow
or automatic billing mutation. Theme variables are scoped to client pages and their
portals; colour validation retains readable white button text. Email language is captured
when the outbox row is inserted, so retries do not follow a later language preference.

No deployment, provider configuration, or legal verification is implied. Developer-supplied
environment statuses and outstanding operational checks are in `docs/PILOT_READINESS.md`.

Browser verification caught a stale mock session causing public language changes to try
saving an authenticated preference and revert after a 401. Preference requests now run
only on operator/staff surfaces; public selection stays local and booking creation captures
it explicitly. A focused regression test covers this boundary. Browser storage in component
tests is explicit because Node's optional global storage can shadow jsdom's storage.

Two existing integration fixtures needed deterministic dates: scheduled-booking setup now
finds a free calendar range, and the series-extension test computes Berlin recurrence times
in local time across DST. These change test setup, not scheduling behavior. API dashboards
also omit the demo's hard-coded countdown, since it has no persisted timestamp behind it.
Free checkout now uses the confirmation wording and omits manual-payment instructions;
country names are translated in billing and printable summaries.
Repeated browser journeys also reached the existing rate limit and exposed a misleading
expired-link screen. Management reads now distinguish an actual 404 from temporary
failures and offer retry for the latter; the request limits themselves are unchanged.


### Entry 062 — Reset the local baseline and keep showcase data small

*2026-11-13.* The developer confirmed that all data is local and explicitly requested
consolidation: retain two mutable revisions until the first production release. Revision
0001 snapshots the final old-chain PostgreSQL schema, including forced RLS, security-definer
capabilities, constraints, triggers and ACLs. It is not generated from ORM tables alone,
which would lose those database boundaries. The dump comparison differed only by equivalent
array-cast syntax after PostgreSQL round-tripping. Explicitly revoke inherited default table
privileges before restoring ACLs, so rebuilding an already-used database cannot widen access.
ORM metadata now declares the existing inbox table, indexes and constraint names; Alembic's
model check reports no upgrade operations. No database feature was removed.

Revision 0002 seeds six clients, three services, eight sessions/bookings, two distinct forms,
two offers and a few notes/tasks/notifications. Dates are relative to the initial reset.
The existing seed command and migration share one connection-bound implementation, avoiding
two copies of data. Normal startup no longer invokes the repair seed command, so deleted
forms and edited examples stay changed until an explicit reset. The fixed local reset command
only targets the Compose database and ignores real environment files. Production must freeze
its own baseline without showcase accounts, then resume incremental revisions.

The developer selected unique clients booked this month as the fourth dashboard metric.
It counts distinct clients in the same non-cancelled, month-created population as the booking
metric. The demo also replaces its unsupported conversion metric with client counts.
The empty next-session card keeps visual weight and a calendar action; explicit zero-minimum
responsive grid tracks prevent mobile overflow.

The broken New form action came from translating the CSS state token `open` into display
copy during Entry 061. Drawers and toasts now keep literal state tokens; regressions cover
EN/TR/DE and the form editor was opened and saved in the browser. Separate duplicate database
rows were removed by the authorized reset rather than hidden by UI deduplication. Integration
tests now check their own notes, tasks, form responses and reminder idempotency against the
richer seed; their records stay in a separate disposable test database.


### Entry 063 — Repair form edits and catalog removal boundaries

*2026-11-13.* Existing-form editing spread response-only IDs/timestamps into a strict PATCH
body, causing rejected saves for type and attachment changes. Form service writes now
allow-list input fields, and service-editor attachment updates load the actual persisted
form rather than the mock array. Grouped controls use fieldset/legend semantics to avoid
nested labels activating the wrong checkbox. The choice textarea previously trimmed and
removed newlines during every keystroke; separate option inputs retain draft whitespace,
with Enter advancing/appending and normalization at the service write boundary.

All three catalog drawers confirm deactivation through both quick actions and saved edits.
Their action uses committed state, so deactivation followed by activation works without
reopening. Delete copy names attachment/item cleanup and preserved booking history.
The reported crash was a service DELETE returning 500 after packages were removed: sessions
still held a restrictive foreign key. The repository now locks the service, checks package
and session references, and returns 409 instead of removing history. Unused-service deletion
unlinks form attachments in the same transaction. Foreign keys remain a concurrent-reference
backstop; only foreign-key violations map to the recoverable conflict. The mock follows the
same reference policy. No schema change or developer database reset is required.

Native `scrollbar-gutter: stable` reserves consistent width on the root and shared dialog
scroll areas; custom absolute scrollbars were unnecessary and would replace browser/OS
behavior. Nested confirmations exposed independent body-lock cleanup and Escape listeners:
a small shared lock counter retains locking until the last overlay closes, and only the
focused dialog handles Escape. Input minimum widths allow option rows to fit mobile drawers.

Verification: 106 frontend tests pass; TypeScript and ESLint are clean; both mock and API
production builds pass with real dotenv files excluded. Backend: 92 isolated tests and
61 real-PostgreSQL integration tests pass; Ruff and mypy (103 files) are clean. Fresh
migrations were applied only to disposable verification/browser databases. The API production
server was exercised at `/admin/forms`, `/admin/services`, `/admin/packages`, `/admin/settings`
and `/book/lena`: form creation, spaces/Enter/add-option, persisted choice-to-date and
attachment edits, nested Escape/scroll locking, service deactivation/reactivation, package
deletion then protected service deletion. The latter displayed the recoverable conflict and
readiness remained 200. A 390px drawer has no horizontal overflow; measured main width is
unchanged between forced scroll/hidden overflow. Developer data and real environment files
were untouched. No deployment or external email delivery was attempted.


### Entry 064 — Overlay scrolling and visible form validation

*2026-11-13.* Developer screenshots showed the preceding gutter approach still shifting
content in their browser and leaving an opaque native scrollbar track. Replace it on the
page and shared drawer/modal/search scroll areas with one local overlay control. Native
wheel, touch and normal page keyboard scrolling remain; the overlay supports track clicks,
pointer-captured dragging and Arrow/Page/Home/End keys with ARIA range/target metadata.
It occupies no layout width and uses a transparent track; forced-colour mode retains a
visible thumb. The page's native scrollbar is hidden only after the replacement initializes.
The earlier width check did not establish behavior on the developer's browser/OS setup;
this is a deliberate change from reserved native gutters to overlay controls, with no new
dependency or database change.

Choice rows now have identical remove controls and an independent full-width Add more
options action below the list. Form Save validates required template/question names and
nonempty choice lists before a request, displays translated inline errors and focuses the
first invalid input. Name/description/placeholder/help-text inputs respect existing server
length bounds. Server validation stays authoritative and network errors retain their toasts.

Verification: TypeScript, ESLint and all 111 frontend tests pass. Focused tests cover
inline error/focus/correction without a request, empty choice lists, scrollbar bounds,
keyboard/wheel input, pointer dragging, changing overflow and dialog page locks. In the
mock production server, the Forms list-to-empty filter transition preserved main left/width
and title position exactly at 1512×823; the scrollbar track computed fully transparent and
no native gutter remained. Three option inputs each measured 323px, with the add bar below;
at 390px, both option inputs measured 234px and the page/drawer had no horizontal overflow.
A missing question label displayed its inline warning and received focus; corrected values
saved. Page End/Home controls, drawer scrolling, command-palette overflow and the public
Demo Guide modal were exercised. Verification used a separate frontend port and changed no
developer database records. Backend code and database schema are unchanged in this pass.
Both mock and API production builds pass with dotenv reads disabled. No backend tests were
rerun for this frontend-only pass. Temporary mock-server tabs and processes were closed.


### Entry 065 — Prevent scrollbar layout gaps under stale development CSS

*2026-11-14.* The running API-mode development app served a stylesheet without the overlay
rules while its newer JavaScript already rendered the scrollbar. Live inspection found the
ready class on html but computed native scrollbar width still `auto`, and no overlay rules
in the loaded CSS. The unpositioned scrollbar thumb could occupy normal flow above the app,
matching the developer's large blank area; native scrollbar hiding also never applied.

Essential overlay positioning, dimensions, transparent track and thumb geometry now travel
with the component as inline styles. Initialization applies native scrollbar width/gutter
styles directly and restores previous values on cleanup; scroll-area viewports likewise hide
the native track directly. Hover/focus/print and forced-colour decoration remain in CSS.
A regression reproduces missing CSS and checks out-of-flow positioning, hidden native track
and cleanup. No application layout padding, form behavior, database schema or data changed.

Live verification on the existing API-backed `/admin/forms` at 1512×500: header and sidebar
start at y=0, main starts at y=64, document and viewport widths both equal 1512, the overlay
is fixed with a fully transparent background, and the native scrollbar is hidden.
The actual development Forms filter transition also preserved main left/width and header
position exactly; New form's inner track computed transparent with native scrollbar width
`none`, then Cancel closed it without saving. TypeScript, ESLint and all 112 frontend tests
pass; the mock production build passes. Database/schema/backend code are unchanged.
The API production build also passes. The verification tab was closed; the developer's
running stack was not stopped or restarted. No environment files were read.

### Everyday booking and email recovery — 2026-11-14

Operator booking creation now accepts exactly one existing client or a narrow new-client
identity. Client creation, capacity check under the session lock, booking, shared public/operator
tax quote, immutable form/contact snapshots, audit, command idempotency and optional initial
email share one transaction. A duplicate normalized workspace email requires explicit existing
client selection; no profile merge occurs. Free operator bookings confirm immediately; paid
bookings await manual payment. Operator creation records no client consent, sends no operator
self-notification, and permits all assigned unanswered forms before the session starts. The
initial-email checkbox does not disable later booking lifecycle emails or reminders.

Email recovery is booking-scoped: paginated customer metadata is exposed by narrow tenant
capabilities, never general outbox grants. A reviewed send queues a current-state summary and
supersedes unclaimed unsent customer messages. A corrected destination is a nullable booking
override, leaving original snapshots and client profiles intact, and revokes every prior
management token. Booking and outbox locks serialize generation, correction and worker claims;
any claimed unsent message returns a recoverable conflict. Successful sends consume transactional
booking/workspace rate-limit allowances after replay detection, so retries neither duplicate
messages nor spend allowances. Cancelled summaries omit management links; erasure blocks sends.
Sent means provider acceptance; console/mock delivery is visibly simulated.

Browser checks exposed an old read-model omission: session DTOs defaulted bookedCount to zero.
Scheduling reads now obtain bounded, tenant-scoped aggregate counts using the shared capacity
status policy. This keeps Calendar, booking details and drawer eligibility consistent without
adding a stored counter. Workspace purge now deletes both sent and unsent related email rows
before removing bookings, preventing ON DELETE SET NULL from detaching retained contact data.
The shared Modal description uses a block container because confirmation descriptions can
contain labelled form controls; wrapping that ReactNode in a paragraph produced invalid HTML.

The pre-production policy remains exactly two mutable consolidated revisions, with disposable
local resets. Package credits, imports, customer accounts, new time-creation flows, live delivery,
infrastructure and deployment remain outside this bundle.

A final concurrency test reproduced a privacy race: an existing client's details could be
copied before erasure and committed afterward. Existing-client creation now locks that client
before the session; erasure locks the client and its bookings in a stable order before
removing forms or contact data. This preserves one lock order with booking commands and makes
new operator bookings fail closed when the client was erased while the request waited.

Recovery testing also reproduced a terminal lease bug: a worker stopped on its tenth attempt
left an email permanently claimed because the existing claimant correctly refuses an eleventh
attempt. The worker claim capability now releases expired terminal claims in a bounded,
skip-locked cleanup. They remain failed (no automatic eleventh delivery), allowing the reviewed
send-details command to supersede them. Active claims still block correction without changes.

The final mobile check reproduced booking-detail overflow (390px visual viewport, 429px
scroll width). Its implicit mobile grid track could retain the columns' intrinsic minimum
width. Explicit single-column/minmax tracks and shrinkable detail columns fixed the measured
width to 390px without clipping content or hiding horizontal overflow. This also keeps the
new email history readable at phone widths.

Final verification: 97 isolated backend tests and 72 real-PostgreSQL integration tests pass;
Ruff and strict mypy pass. The additional explicit last-seat email-count assertion also
passes. Frontend TypeScript, ESLint and all 117 Vitest tests pass, with mock/API production
builds and regenerated transport checked. Both consolidated migrations were exercised from
empty databases; Alembic check reports no model drift and a repeated upgrade at head is a
no-op. The main local stack was stopped and its database reset to the small showcase dataset.

Browser verification used a production server and disposable data: EN/TR/DE at desktop and
phone widths, new/existing clients, free confirmation, paid email opt-out, persisted client
and Calendar entry-point preselection, reviewed address correction, console-provider acceptance,
and one-time management-form submission with a required false answer. The previously submitted
answers remained read-only in all three languages. The existing Calendar “booked” suffix was
observed untranslated and logged separately in TODO. Live delivery and deployment were not run.
Developer startup and short navigation checks are in `docs/VERIFY_EVERYDAY_BOOKING.md`.
The final saved API production route was reloaded without injected styles: mobile visual,
client and document widths all measured 390px, and its German email confirmation opened
correctly. `/health/ready` reported database ok. Temporary verification servers and databases
were removed after checking; PostgreSQL and the reset main showcase database remain available.


## Bounded booking ledger — 2026-11-14

The API booking ledger previously loaded all bookings, clients, sessions and services and
joined/filtered them in the browser. A tenant-scoped booking-summary resource now joins the
necessary display fields and returns bounded status pages plus complete filtered counts.
Counts and rows share a repeatable-read, read-only transaction; no tenant/RLS privileges
change. CSV export uses a streaming server cursor in its own read snapshot, with formula
escaping and no private notes/contact snapshots. Existing booking commands are unchanged.
The real application opens booking details directly, fixing the missing route to Emails;
the demo keeps its drawer and gains a View details link. Cancellation reaches fetch rather
than becoming a misleading network error. No schema migration or seed reset is necessary.

This is an initial implementation slice, not completion of the four-pass architecture plan.
Other collections, collapsed previews, shared caching/session ownership, edit versions,
mock/API bundle isolation, and correlated performance instrumentation remain outstanding.

## Shared operational reads and reviewed edits — 2026-11-15

The approved architecture bundle extends the initial booking-ledger work across Clients,
Calendar, catalogs and platform screens. Collection screens use bounded server pages and
complete totals; booking details carry joined display context. Contextual notes, tasks and
attendance are paged, with bulk attendance explicitly limited to the displayed page. Exports
stream complete filtered results. Selected picker records remain available across searches.

TanStack Query is confined to one local HTTP/query owner (one additional runtime dependency,
plus its query-core dependency). Operational freshness is 30 seconds; catalog/settings
freshness and inactive retention are five minutes. Verified identity/workspace scope owns
private data, cancellation, targeted invalidation and auth expiry. There is no polling,
cache persistence, Redis or new monitoring service. Session verification is shared, including
language/currency/timezone metadata; language selection moved to operator Account settings and
the staff account menu. Refresh failures retain data and settings drafts rather than remounting
editors. API builds replace the fixture adapter at build time and reject accidental mock access.

Reviewed writes use an HTTP If-Match revision and SQLAlchemy's atomic version predicate.
Form fields and package items bump their parent. Recurring edits lock series before occurrences
and review the series revision for following-scope edits. Settings sections serialize on the
existing business profile, avoiding broader runtime privileges on the workspace root. Staff
billing has its own revision inside the narrow owner capability. Stale editors keep drafts and
require explicit review/reload; they cannot force-save. Address corrections compare the reviewed
recipient under the booking lock, after idempotent replay detection. Client-note writes lock
and recheck the parent before personal context so erasure cannot be followed by a late note.

Browser verification caught a missing CORS permission for If-Match/X-Series-Version: API tests
alone had passed while real edits failed at preflight. The specific headers are now allowed,
origins remain restricted, and an isolated preflight test protects the browser contract.
The German mobile form editor then rejected a competing revision, preserved the draft and
showed a safe request reference. Calendar checks also found browser/UTC date grouping beside
workspace-time filtering; shared wall-date segments now handle midnight overlap consistently.

Diagnostics correlate verified actor/workspace and request/operation IDs through audit and
outbox triggers, including capability-generated records, and through worker attempts. SQL
parameters, raw exception/provider values and tokens are excluded. ASGI request tracing spans
streamed response completion; a regression test ensures export work contributes to duration
and query metrics. Sentry remains opt-in and scrubs request secrets and exception values.

Verification: 128 frontend tests, 103 isolated backend tests and 78 real-PostgreSQL integration
tests pass; TypeScript, ESLint, Ruff and strict mypy pass. OpenAPI transport was regenerated.
The two consolidated migrations were exercised from empty local and isolated databases;
Alembic check reports no model/schema drift. API/mock production builds use Webpack because
Turbopack previously stalled in the sandbox; build copies exclude real environment files.

The final isolated workload has two synthetic workspaces, each with 1,000 clients and 10,000
bookings, on an Apple M1 Pro (10 logical cores, 16 GiB RAM). With five concurrent readers,
authenticated HTTP p95 is 129.63 ms, eight SQL statements per read, and at most 13,291 response
bytes. Repository p95 is 95.51 ms, six statements including transaction setup. The 500 ms gate
passes; the report includes PostgreSQL execution-plan evidence. These are local ASGI/repository
measurements, not internet latency or a numerical before/after claim: no comparable pre-change
production capture exists. The artifact is `docs/performance/architecture-2026-11-15.json`.

Production Chrome checks covered EN booking-ledger/detail navigation and Emails visibility;
TR/DE Account preferences and persistence; German catalog/editor behavior; and mobile settings,
forms and stale-edit notices at a measured 390 px without horizontal overflow. This is focused
coverage of affected flows, not an exhaustive recheck of every screen/language combination.
No live delivery, deployment, real environment-file access or git operations were performed.
Use `docs/VERIFY_ARCHITECTURE.md` for concise startup/reset and navigation checks.

Final bundle inspection reproduced another build-boundary issue: Next's path resolution
bypassed the plain Webpack fixture alias. The build now replaces that provider at the compiler
module boundary, and an automatic postbuild guard rejects API chunks containing the fixture
adapter or missing explicit mock-access rejection. Both final API and mock builds pass this
guard. Runtime source hashes were checked against the isolated build input; no environment
files were copied. The Turbopack alias remains configured, but its build is not claimed verified.

The final fixture-free production login and client-directory check also confirmed that private
bootstrap reuse no longer fetches a separate language-preferences resource. The test suite leaves
disposable clients behind, so the normal local database is reset again after verification.

The last mobile client-editor check used a long synthetic email and exposed an implicit
client-detail grid track expanding the layout viewport to 515 px. The portal inherited that
expanded viewport, placing Save off-screen. Explicit shrinkable grid tracks, shared header
wrapping for long identifiers, and the browser's fieldset minimum reset resolve the underlying
constraints. The measured layout becomes 390 px and the Save footer fits within 844 px.
The final revision-checked client save closes successfully. These are shared sizing rules,
not clipping, negative margins or a fixed-height workaround.

The rebuilt production stylesheet was reloaded without injected CSS: inner/visual/document
widths all measured 390 px, the fieldset minimum measured 0 px, and Save's bottom edge was
828 px within the 844 px viewport. The real pointer click then saved the client successfully.

The final server fallback privacy gate disables duplicate raw URL access logs and gives Uvicorn
errors the safe formatter. A live local readiness probe passes against the reset database;
a synthetic private feed marker is absent from all process output while its route template
and 404 are retained. The additional isolated redaction test brings that suite to 103 passes.
Temporary verification servers are stopped and disposable benchmark databases removed.


### 2026-11-15 — Reviewed, transactional local session workflows

Session changes now use a preview and one transaction-scoped workspace scheduling gate before
row locks. Booking commands formerly locked bookings before sessions, while recurring bulk
changes needed sessions before attendee bookings; the shared gate removes that conflicting
write order without blocking reads or adding infrastructure. The same gate covers maintenance,
client erasure, public form writes and workspace purge. Public management writes recheck their
link after the gate so a waiting request cannot outlive an address-correction revocation.

Dedicated cancellation transitions only active bookings and preserves terminal, payment,
financial and immutable form facts. Time/location changes and cancellation suppress old unclaimed
customer messages and queue current notices using saved destinations/languages; a claimed
message rejects everything. Session command records retain reviewed outcomes, making identical
retries harmless even after resource revisions advance. Generic status patches cannot cancel or
reopen sessions. Private notes remain independently editable, including on cancelled sessions.

Following edits retain each recurrence date and apply local clock deltas across DST. The existing
series owns a cancellation cutoff and stops later materialisation; no series-splitting system was
added. The ineffective client-task visibility property, control and database column were removed.
Sign-in descriptions and upcoming-session dates use existing EN/TR/DE dictionaries/Intl formatting.

Playwright is development-only and runs against an environment-free production build plus a
fixed disposable test database. Its runner does not inherit provider settings, start a delivery
worker or read real environment files. CI failure artifacts contain allow-listed result metadata
and synthetic screen pixels; raw contexts, bodies, headers, tokens, traces and video are excluded.
Production browser checks caught the day/week Calendar's old selection-toggle behavior, which
required two clicks to reopen the same event; both grids now open the selected event on every click.
Named dialog locators also ensure tests wait for asynchronous impact review before confirming.

The two consolidated migrations remain the only revisions; the shared showcase seed drops the
unused task flag. Webpack was used for isolated verification because the previously observed
sandbox Turbopack build stall remains outside this change. The default mock demo and dates are
preserved. See VERIFY_LOCAL_BOOKING.md for exact evidence and walkthroughs. Live integration,
operational and deployment verification remain on standby, and npm's separately observed
Next.js/Vitest security advisories are recorded in TODO rather than hidden in this feature work.


Final recurrence inspection found that copying the latest occurrence into the rolling horizon
would leak a "This session" exception into future sessions. The existing series now owns its
generation fields, with tenant foreign keys to service/calendar owner and explicit local time,
duration, capacity and location. Only following-scope edits update that template; single changes
stay on their occurrence. A PostgreSQL regression changes the final occurrence's time/location,
then extends the horizon and proves the next occurrence still uses the series template.


Production browser verification also reproduced active/cancelled events covering one another.
Day and week views now share a deterministic overlap-lane layout based on rendered card heights,
so history remains visible without covering active click targets. Day filtering uses the workspace
calendar-date key, matching the week view. The browser reporter records only safe source-line
numbers and named phases for failures; it never logs raw locator/URL/error values.


Weekly creation now derives its weekday from the verified workspace timezone, rather than
UTC, so late-night/early-morning sessions retain the selected calendar date. Tests cover both
a positive and negative UTC offset. The recurrence expander also preserves an explicitly chosen
second fall-back clock occurrence on the first date instead of silently omitting that occurrence.


Verification: 136 frontend tests, 107 isolated backend tests and 93 PostgreSQL integration
cases pass, with TypeScript, ESLint, Ruff and strict mypy clean. Production Webpack mock/API
builds pass their fixture boundary guards. Eight production Chromium journeys cover desktop/
mobile EN/TR/DE booking/form/review/recovery flows and both recurring-control layouts.
The final schema migrates empty-to-0002 and Alembic reports no model/schema differences.
The warm local read gate passes at 143.56 ms HTTP p95 with five concurrent readers and eight
queries/read. The normal local database is restored to the small showcase after tests.
Remote CI and live integrations were not executed. See VERIFY_LOCAL_BOOKING.md and the
linked JSON artifacts; dependency advisories remain a separately recorded security finding.


### Communication foundation — 2026-11-16

Production scripts now use fresh document nonces rather than report-only CSP. Root
rendering is dynamic to ensure the nonce matches framework scripts; existing React
inline styles remain allowed deliberately. Maintenance responses use the same policy.
The local launcher delegates process ownership to a Python supervisor, preflights fixed
ports and terminates process groups, including descendants after leader exit. It never
kills a process merely because it owns a desired port. Maintenance now supports an
explicit 15-minute loop while retaining the existing one-shot command. Dependency
upgrades include Vitest 5 (ESM configuration) and Sentry 11 to remove vulnerable build
tooling. Remaining implementation and verification are tracked in PASS1_COMMUNICATION.md.

### Workspace-scoped client communication — 2026-11-16

Existing client records now authorize separate passwordless sessions: 15-minute single-use
links, 12-hour sessions, distinct cookies/CSRF, workspace/client UUID ownership and narrow
fixed-search-path capabilities. Staff roles and memberships stay unchanged. Guest booking
links remain a separate authorization surface. Client content is never persisted in browser
caches or cross-tab lifecycle signals; a lifecycle event clears the visible client view.
Same-tab sign-in links listen for fragment changes and immediately remove the fragment.

A conversation belongs to one workspace/client, with immutable plain-text messages,
idempotent submissions, bounded cursor history and internal read/digest watermarks. Visible
open threads alone refresh every 15 seconds; polling was chosen over WebSockets because
this product does not require real-time presence. Daily digests cover messages through 9am
workspace-local time, respecting DST and per-recipient preferences, with no message content.

Booking completion snapshots a service's follow-up delay, consultant text and optional form.
Preparation and follow-up responses now reference their exact immutable assignment, allowing
one template at both stages without shared answers. Follow-up forms expire 30 days after
queueing. Automatic sends respect client opt-out; reviewed manual sends remain possible.
Email transfer serializes against the workspace scheduling gate, client, bookings and outbox,
revokes old credentials and preserves original booking snapshots. Claimed messages reject
all changes. Exports, erasure, suspension and workspace deletion cover the new data.

Dashboard To-do and Calendar use the same task table with nullable session association and
reviewed versions, rather than a second task system. Live billing, notification and message
items resolve through their sources. The dashboard worklist reads tasks/counts coherently.
Communication models and shared form validation were extracted; the existing modular
monolith and outbox worker remain. No new infrastructure or AI is introduced.

A negative privilege test caught inherited owner default grants on newly added tables;
the baseline explicitly revokes runtime credential/digest access and conversation writes,
then grants only safe tenant reads. This is enforced by real-PostgreSQL tests. The two
mutable pre-production migrations remain the only revisions; no compatibility path is kept.
Verification evidence and remaining upstream dependency findings live in PASS1_COMMUNICATION.md.


Final communication verification: 143 frontend tests, 108 isolated backend tests and 100
real-PostgreSQL cases pass, including preference/erasure serialization and closure revocation.
All 16 production Chromium cases pass on EN/TR/DE desktop/mobile. Transport regeneration,
types, ESLint, Ruff, mypy, fixture-checked mock/API builds and empty migration/schema agreement
pass. The read gate records 82.14 ms HTTP p95, eight queries/read with five readers. The
normal local database is restored to six showcase clients after verification; remote CI,
live third-party delivery and deployment were not run. See PASS1_COMMUNICATION.md.


## 2026-11-17 — Consultant assistant boundaries

The assistant uses current SQL facts plus tenant-filtered full-text/pgvector retrieval,
reciprocal-rank fusion and a versioned application-help corpus. Exact cosine search is
intentional at pilot scale. Provider routing is advisory; strict schemas, a fixed command
registry, explicit review and existing domain validation govern every write. A transaction
context composes existing commands and proposal outcomes without nested commits or HTTP.

Source edits append a transaction-ID journal rather than locking a shared workspace revision
row, which would add a competing lock order to existing catalog writes. Generation captures
a PostgreSQL snapshot and rejects journal transactions that were not visible then; sequence
numbers alone are unsafe because commits can finish out of order. Privacy epochs additionally
fence erasure, history deletion, opt-out and closure. Index workers lock the job before
publishing; source triggers update that job before deleting vectors to prevent resurrection.

SQLAlchemy needs explicit vector type reflection and the full-text expression index in model
metadata for meaningful Alembic drift checks. Optional UI update callbacks must not wrap an
awaited mutation in optional-call syntax: JavaScript skips evaluating that argument when the
callback is absent. A component regression now covers this confirmation case.

Later verification also covered cascade deletion while AI is enabled, revisioning workspace
settings as generation sources, retaining unrelated indexing work during client erasure,
and enforcing the briefing cooldown across language changes. Assistant integration fixtures
seed once per module and clear AI state per test, avoiding repeated full showcase repair;
streaming-log assertions accept both normal and slow-request log levels.

Production browser builds now reuse the installed dependency directory through a symlink;
copying it for every isolated build caused severe avoidable filesystem work. Source files,
environment selection, production output and the disposable database remain isolated.

## 2026-11-17 — Conversation presentation and reviewed chat controls

Assistant chat now shows optimistic questions, a persistent composer and a progressively
revealed validated answer. Reveal is presentation only, with reduced-motion support; provider
output is never shown before citation, tenant and privacy checks finish. Stop uses a durable
cancelled turn (including the pre-reservation race) and best-effort process-local task
cancellation; the database prevents late results in every process. Provider costs already
incurred cannot be recalled, and unknown token reservations remain conservative.

Editing creates an idempotent branch, copies only earlier history and strips executable
proposals. Original conversations and confirmed domain actions remain intact; editing is
never a rollback command. Branch audit metadata checks only its own source/title-hash fields,
since existing audit instrumentation adds correlation fields.

Messages use sender-relative bubbles for both operator and client surfaces; reaching the top
loads the existing bounded history cursor and preserves the scroll anchor. No websocket,
message-edit protocol, or new infrastructure is introduced. AI settings use the standard
body type scale and accessible bounded usage bars.

The two full conversation pages use an explicit AppShell layout mode with a bounded flex
viewport and independent history/message scrolling. Mobile conversation lists collapse into
a selector. Other operator pages retain their existing document flow.

## 2026-11-17 — Ask Slotera and automatic conversation history

The empty chat centers its composer beneath Ask Slotera and the existing muted description;
active conversations keep the composer at the bottom. History remains bounded to 25-row
requests, loaded automatically as each list reaches its edge. Scope changes abort requests
and discard unrelated history even on failure; earlier messages preserve their scroll anchor.
Deletion moves into a row context menu, also reachable through an options button and keyboard.

The first successful response supplies a short conversation title in the same structured
provider response; there is no separate naming request. Copied branch history does not count
as a response in the new conversation. Generated titles pass the same privacy and output
validation boundary before persistence. Local simulation uses a deterministic short title.

Usage settings show one daily percentage calculated from the generation budget; internal
budgets and indexing limits remain enforced. Search preparation is described without internal
terminology. Ask Slotera uses a conversation icon distinct from Branding, with operator-only
Ask/Messages shortcuts beside notifications. The disposable showcase includes a four-message
Sofia conversation, already read so it cannot trigger a sample-message digest.

First-title state is stored explicitly on the conversation: its existing created_at field is
updated for recency, so it cannot identify whether a response is the first. The mock sample
conversation is in the build-selected fixture adapter, preserving API fixture exclusion.


## 2026-11-17 — Simplify dashboard To-do

The requested dashboard simplification replaces the combined live-action/session-task manager
with a title-only general checklist. One input submits on Enter; checkboxes retain completed
rows without separate tabs. System-action cards and the reusable session-task editor are
removed from this surface. Calendar keeps its existing session tasks. The retired composite
worklist endpoint and unused frontend action derivations are removed rather than left as
hidden code. Billing and notification features retain their own existing surfaces.

General and session tasks still share one persisted model: a bounded general_only task filter
keeps the dashboard distinct without another table, dual-write or migration. Existing versions,
tenant RLS, audits and cache invalidation remain authoritative. Existing pagination infrastructure
loads older items by scroll, with no pagination controls. This favors maintainability over a
separate task subsystem; reconsider only if a future product decision needs different data.

AI task.delete is the sole new deletion permission: prepare rejects session-bound items and
foreign-workspace records; execution rechecks the reviewed version and uses the existing
command transaction and idempotency. It requires the normal explicit review/confirmation and
a to-do-specific permanent-removal warning. No model receives direct database access.

Verification follows the current AGENTS.md test commands; some older workflow-module examples
still describe the retired no-frontend-test-runner stage.


### Dashboard and communication polish — 2026-11-17

The dashboard Today card combines the manually requested daily briefing with the existing
next-session details, separated by an inset muted rule. Briefings render a short summary and
bulleted highlights; local simulation formats scheduled times and service names instead of
retrieval JSON. Source links remain available in assistant chat, not the compact Today brief.
Without a generated briefing, Today shows the session count. KPI comparisons show percentages
only; an undefined comparison against a zero baseline is omitted rather than invented.
Messages has no large page title or visible composer label; the input retains its accessible
name. The send arrow sits inside the composer, aligned bottom-right. Conversation lists load
more on scroll, and message history loads automatically at the top. Booking rows center their
cells, and shared pills use their natural compact line height instead of stretching to a row.


## 2026-11-17 — Separate reports from chat and consolidate settings

A persisted AI thread kind distinguishes ordinary chats from generated daily/client reports,
including failed generations and older daily cycles without a current briefing pointer. This
avoids inferring purpose from mutable/translatable titles or hiding only the latest linked
report. The two-revision pre-production baseline is updated in place; existing local data
must be reset rather than supported through compatibility inference. Export and erasure
already cover the same thread table and all report kinds.

Directory responses add server-owned state aggregates over all search matches before catalog
state filtering; pagination still uses the filtered row total. The client aggregate uses the
same activity definition and cutoff as per-row statistics. No browser-wide collections or
per-row HTTP requests are introduced. Metadata and entity plurals are translated at display
time, preserving language-independent cached facts.

Business Profile and Branding share a settings page while retaining their existing save,
contrast and stale-edit review boundaries. Notifications names the settings category without
adding unimplemented push controls. Today removes filler copy, keeps its timestamp beside an
icon refresh and messaging uses a short centered single-line composer.

## 2026-11-18 — Calm motion system and de-templating pass

The interface had no motion tokens (four hand-written curves, one 400 ms `.fade-in` shared by
menus, modals and accordions), and most overlays, menus and disclosures mounted and unmounted
in one frame. Motion now follows one token module (`lib/motion.ts`, mirrored in CSS and
checked by a test) and the calm-motion defaults: ease-out `0.2, 0.8, 0.2, 1`, sheet curve
`0.32, 0.72, 0, 1`, 120 to 380 ms, exits at 80%, no bounce, Reduce Motion everywhere.

**Mechanisms, not per-page code.** `DrawerShell`'s existing mount-through-exit logic became
`usePresence` and now also drives `Modal`, the three hand-rolled popovers and `Accordion`
(grid-rows collapse rather than animating height). A closing overlay is `inert` and
`aria-hidden` and drops its dialog role, so tests and assistive tech see it as gone while it
animates. Route arrival uses `template.tsx` + `ScreenEnter`, with CSS `nth-child` delays and
fill-mode `backwards`, so the resting state is the element's own styles and nothing depends on
JavaScript to become visible. Toasts moved from keyframes to transitions (a burst retargets
instead of restarting), cap at three, newest on top, and pause while hovered or focused.

**Rejected:** a motion library (CSS and two small hooks cover it, and CSS animations stay
smooth while the main thread is busy); View Transitions for routes (the old screen is removed
at once by the router, so only the incoming screen animates); animating the command palette
(keyboard-opened many times a day, so it appears instantly); scroll-driven CSS animations for
the landing page (they replay on scroll-up; reveals should happen once).

**Identity.** The visual world is unchanged (paper, forest, Fraunces). What changed are the
signals that read as generated: `.eyebrow` is now a sentence-case body-face label instead of
spaced mono capitals; decorative kickers above list-page titles ("Catalog", "Operations",
"Directory", "Platform") and landing section kickers were removed with their dictionary keys;
the greeting lost its italic accent name and uppercase date; em dashes were rewritten out of
EN/TR/DE interface copy and seeded demo copy; list previews join with commas; `EmptyState`
became a left-aligned, contextual note and catalog/client lists gained real empty and
no-match states; landing features became a hairline list instead of six identical cards, and
the hero's tick-badge row went. The client portal's tabs had been filled buttons, which read
as actions, so they now use `Tabs`. A gliding "now" marker was added to today's rail.

**Not done yet:** the landing hero still uses the div-built product collage; replacing it with
real screenshots needs captures from a browser, which the agent sandbox cannot launch.

## 2026-11-18 — Dashboard rework, notifications page and daily brief removal

**Daily briefing removed.** The workspace-wide "Brief me" on the dashboard duplicated what the
next call, the schedule and the to-do already show, and its 9am cycle was the only reason for
`ai_briefings.cycle`. The `daily` kind is gone from `/ai/briefings/{kind}` (only `client`
remains, and it requires `clientId`), the service no longer creates daily threads, and the
`cycle` column was dropped from the baseline revision (reset local databases). Client briefings
are unchanged.

**Dashboard.** "Today" became **Your next call** (the next session may not be today) without a
brief, refresh or rule above the details. Today's schedule is its own card under it; the to-do
card sits beside both and is absolutely positioned on wide screens so the left column sets the
row height and the to-do scrolls inside. To-dos are created in a small modal with a title and
optional description (the backend already stored descriptions); rows show one truncated line
and expand in place with a height transition. This reverses two PRODUCT.md rules ("no separate
schedule card", "no descriptions"), which were updated with the user's request. KPI tiles now
read number, label, then the change in words.

**Notifications.** Keyset paging (time, then id) rather than offsets, so notifications that
arrive while someone scrolls never shift or duplicate later pages. Retention follows the usual
inbox convention: read notifications are cleared after 30 days, unread ones after 90, by a
fixed `SECURITY DEFINER` function the maintenance job calls; the runtime role still cannot
delete notifications. The bell shows the latest 7, and `/admin/notifications` loads 20 at a
time, fetching the next batch when the item halfway down the loaded list scrolls into view.
`AuthGuard` admits this top-bar route in API mode through `OPERATOR_TOPBAR_ROUTES`.

**Bookings (API mode)** had a second search box that only filtered the services dropdown; the
dropdown now loads the services once and sits at the right end of the main search row.

**Layout fixes.** Phones get the sidebar as a sheet instead of a permanent 68px rail; the next
call stacks the time above the client so the name isn't cut; chart axes use compact amounts
(`formatMoneyCompact`) instead of clipped full ones; the landing demo band uses the accent
tint instead of a near-black slab.

**Visual review from the agent.** Chromium cannot start inside the agent's macOS sandbox
(`bootstrap_check_in … MachPortRendezvousServer: Permission denied`), so screenshots need the
walkthrough to run unsandboxed. The script now lives in the repo as `npm run ui:walk`; letting
the agent run it means listing that command under `sandbox.excludedCommands` in the
developer's Claude Code settings.

## 2026-11-18 — Demo booking page follows the server's rules

The demo `/booking` had drifted from `/book/{slug}`. It showed a hard-coded list of service
ids (so a service created in the demo never appeared), offered eight fixed times on made-up
weekdays, took card payments with a fake "card ending 0002 fails" path, added VAT for the
client's billing country on top of the price, and confirmed every booking with a made-up
meeting link. The server lists every active, publicly bookable service, computes slots from
working hours, interval, buffers, notice, advance limit, blackouts and existing sessions (or
the operator's scheduled sessions with seats left), accepts only free or manual payment, treats
the price as tax-inclusive at the operator's fixed rate, and leaves a booking pending for
approval or payment.

The demo now calls the same service functions as API mode; their mock branches apply those
rules from `web/src/lib/public-booking-rules.ts` (unit-tested against the server's cases) and
return a server-shaped booking result, so the stepper and confirmation page have one path.
The API payment step also no longer falls back to a card form when manual payment is off; it
says paid bookings are not available, which matches the server's rejection. Because the demo
sessions are dated May 2026, the demo workshop currently shows no open times, as the real
page would. `lib/card.ts` stays for the future Stripe forms; `/booking/failure` is unreachable
until then.

Also in this round: AI settings shows a toast when AI is turned on or off (or the change
fails), the assistant, messages and notifications icons sit left of the search, and AI moved
to the bottom of the settings menu.

## 2026-11-18 — Smaller page bundles, ruff format, legal rule

Measured first-load JavaScript per route from the build's client manifests (gzip). Three costs
stood out: all three languages shipped to every page (about 61 KB gzip of Turkish and German
that a visitor never uses), Recharts (103 KB) on the dashboard, and Tiptap (128 KB) on client
detail, pulled in even for reading notes because `NoteContent` imported a style constant from
`NoteEditor`. Turkish and German now load on demand, the chart plot and the note editor load
through `next/dynamic`, and the prose styles moved to `note-prose.ts`.

| Route | Before | After |
|---|---|---|
| `/admin/clients/[id]` | 522 KB | 338 KB |
| `/admin/dashboard` | 491 KB | 335 KB |
| other admin pages | ~388 KB | ~327 KB |
| public, booking and auth pages | ~345 KB | ~284 KB |

The remaining shared base is React, the Next runtime and Sentry (no Session Replay); menus,
drawers and the palette are too small to be worth deferring.

`ruff format` was applied to the five backend files that had drifted (formatting only;
mypy and the isolated tests unchanged). PRODUCT.md's footer rule described a legal modal and
no legal pages; it now describes the real `/terms`, `/privacy` and `/dpa` routes.

## 2026-11-18 — Real screenshots in the landing hero

The hero's div-built product collage (a recognisable generated-landing pattern, which also
showed VAT added on top of a price, unlike the server's tax-inclusive quote) is replaced by
real captures: the dashboard in a plain frame with the client booking page over its corner,
and the phone dashboard on small screens. The images live in `web/public/landing/` and are
served through `next/image`; `npm run ui:walk` recaptures them at 2x with a fixed 08:16 clock
so the greeting and "next call in 2h 14m" agree. The first set was cropped from 1x
walkthrough shots. The hero subtitle no longer promises card payments. The client briefing
hint still described the removed 9am daily cycle; it now says briefings are made on request
and should be refreshed after new sessions or notes.

## 2026-11-18 — Design critique pass

Applied every recommendation from the screenshot critique.

- **Honest landing copy.** "How it works", "Paid bookings" and the pricing small print no
  longer promise card payments; cards are "coming soon" and the per-payment cut applies once
  they launch.
- **Demo dates follow the clock.** Fixtures are written as if today were 17 May 2026;
  `mockData()` shifts every date and date-time by the same whole number of days. The demo
  dashboard now builds today's schedule, the next call and the week count from the demo
  sessions (as the API summary does), the calendar opens on this week in both modes, and the
  "in 2h 14m" pill is a real countdown in both modes instead of a fixed demo string. The
  clients KPI is an illustrative fixture like the other three ("500%" came from computing it
  over a fortnight of demo bookings).
- **Free bookings skip Billing.** The server now accepts a booking without a billing address
  when it is free and still requires one for manual payment (integration-tested); the last
  step reads "Confirm" for free services.
- **Lists.** Booking rows on phones put the date and time on their own line; the payment badge
  is dropped where it repeats the group ("Pending" in Pending); empty status groups are a flat
  muted line; pagination hides when everything fits on one page.
- **Messages.** The conversation list shows the last message (with "You:" for replies), its
  time and an unread dot, from new `lastMessagePreview` / `lastMessageAt` / `lastMessageFrom`
  fields on `GET /conversations`; the newest conversation opens by default. The demo has three
  conversations instead of one.
- **Hierarchy and consistency.** List-page titles use the h2 size; Settings drops the extra
  eyebrows and the card heading that repeated "Business Profile"; settings checkboxes are
  switch rows; Business and Branding show Save only with unsaved changes; the client page's
  AI briefing is one line below the stats when AI is off; upcoming calendar sessions carry the
  accent and past ones step back; amount fields show "£" rather than "GBP"; KPI changes read
  "+12.4% vs last month".
- **Accessibility.** `--ink-3` is now `#6A655A` (at least 4.5:1 on every surface, was 3.76:1 on
  `paper-2`); placeholders, future step labels, the schedule axis, the ⌘K hint and two icon
  buttons moved off `--ink-4`, which stays for decoration. Top-bar buttons are 44px on touch
  screens, and the assistant and messages links carry text labels on wide screens.
- **Follow-up from the screenshot review.** The demo had two timezones: availability (and so
  the booking page and the new dashboard) used Europe/Berlin while `getWorkspaceTimezone()`
  returned UTC, so one session read 09:30 on the dashboard and 08:30 in the calendar and lists.
  The demo workspace timezone now comes from the availability settings. A demo message no
  longer names a weekday that the date shift would make wrong, and the hero capture hides the
  demo-only "Demo" button.
- **Hero images moved to `web/src/assets/landing/`.** Served from `public/` under a fixed URL,
  the image optimiser kept returning the first crop after new captures replaced the file.
  `HeroShots` now imports the images, so every capture gets a content-hashed URL (and its
  size comes from the file). `npm run ui:walk` writes the captures there.
- **Hero layout, second take.** One large dashboard screenshot under the buttons was not what
  was asked for: the hero now keeps the copy on the left and scatters five small captures of
  single components on the right (next call, revenue trend, revenue KPI, messages list, the
  booking page's services), loosely overlapped on a percentage-based stage; phones and tablets
  show two of them under the copy. The captions (one of which overlapped its image) are gone.
  The walkthrough captures each card as an element at 2x.

## 2026-11-18 — Demo bookings show up in the demo admin

- **Browser-only, no server.** The demo admin opens the booking page in a new tab, so the
  mock stores' in-memory arrays could not carry a booking across. `createDemoBooking` now
  saves the booking (plus a new client, matched by email otherwise, and its own session for
  open services, or a seat in the existing session for scheduled ones) under the
  `slotera.demoBookings` `localStorage` key. The bookings, sessions and clients stores merge
  those records at load and on the other tab's `storage` event, and `DATA_CHANGED` refreshes
  open pages, so the booking appears in Bookings, the calendar, Clients and the dashboard.
  A server-backed demo was rejected: it would cost money to run, need abuse protection, and
  mix strangers' bookings together.
- **Saved locations** now leave through `useLeavingRows` like the other lists.

## 2026-11-21 — Deleted cards fade, and the missing tests

- **Catalog cards and assistant chats leave gently.** Services, packages and forms fade in
  their grid cell (`.card-shell`) when the drawer deletes one; deleted assistant chats leave
  through `.row-shell`. `useLeavingRows` gained `canLeave`, so only the item just deleted
  fades: searching, filtering, paging, or a chat-history reload that drops older pages, still
  swaps at once. The empty state waits until the last card has gone.
- **Tests.** `getDashboard()` demo composition on a fixed clock (schedule order and states,
  next session, week count, cancelled sessions and bookings left out); `MoveBookingDialog`
  (same-service choices, required reason, failed move keeps its idempotency key, load retry);
  `BookingDrawer` (save payload, failure keeps the draft, confirmed cancel, view mode);
  `ClientDrawer` (inline validation, email-transfer confirmation, stale edit).
- **Smoke journey.** `web/e2e/smoke.spec.ts` runs through `./scripts/browser-check` on the
  real API: a client books an approval service on `/book/lena`, the operator signs in with
  the form, approves the booking and moves it to the next session.

## 2026-11-21 — Operator-recorded package sales

- **Decisions (with the user):** the operator records the sale (the client pays outside
  Slotera; no checkout until Stripe), only the operator books package sessions, any remaining
  item can be used, and sessions never expire. This lifts Entry 016's "presentation only"
  line for the operator side; client checkout and client package views stay out.
- **Model:** `package_purchases` snapshots the package's name, price and currency, with
  `pending | paid` payment and `active | voided` status; `package_purchase_items` snapshots
  one row per session. A booking holds an item through `package_purchase_id` and
  `package_position`, with `payment_method = 'package'`, amount 0 and status confirmed. A
  partial unique index allows one live booking per item, so any cancellation gives the
  session back and no extra bookkeeping is needed. Recording a sale is idempotent by
  deriving the purchase id from the operator's idempotency key, without a new table.
- **Money:** a paid, unvoided sale counts once in dashboard revenue (at the sale date) and in
  the client's total spent; covered bookings count 0 and are left out of the average
  booking value. Erasure keeps a sale's money facts and clears its note. A sold package
  can't be deleted (`package_in_use`). Workspace purge deletes sales after bookings.
- **UI:** `ClientPackagesCard` on the client Overview (record, mark paid, void with
  confirmation), a "Package" select in New booking when a sale covers the session's service,
  "Covered by …, session N of M" on the booking detail, and a "Package" marker in booking
  lists. The demo seeds one partly used sale (Sofia Marin, Strategy Sprint Package).
- **Tests:** two PostgreSQL integration tests (the full sale lifecycle and the double-spend
  index), demo service rules, `ClientPackagesCard` and the New booking package option; the
  Chromium journey `web/e2e/package.spec.ts`.


## 2026-11-22 — Large files split, stale TODO items closed

- **Already done:** API-mode Bookings and Clients search and page on the server, the calendar
  loads only its visible window, and the API build swaps the fixtures out (a postbuild check
  enforces it). `LogoWall`/`Testimonials` were gone; their leftover landing copy is deleted.
- **Splits, moving code only:** `db/models.py` re-exports `enums`, `identity_models`,
  `catalog_models`, `scheduling_models` and `booking_models` (the existing sibling pattern of
  `ai_models`/`client_models`, so no import changed). Slot computing moved to
  `public_booking/availability.py` as plain functions, so `manage.py` no longer calls the
  repository's private methods; `client_for_email` is shared with package requests. The
  booking detail page uses `BookingActionsCard`, `BookingOutcomeCard` and
  `BookingPaymentCard`; `SessionDrawer` uses `SessionDetailsForm`; onboarding and the demo
  manage page keep their panes in `components/onboarding/` and `components/booking/manage-demo/`.

## 2026-11-22 — Clients buy and book packages; refunds are recorded

- **Decisions (with the user):** buying needs no sign-in (name and email on the booking page,
  manual payment, the consultant marks it paid); a client books with a package only once
  it's paid; refunds are full or partial and only recorded; the only extra is the "ready"
  email. Invitations, price edits and undoing a payment were decided against.
- **Refunds:** `refunded_cents`/`refunded_at` on bookings and sales. Revenue and total spent
  now count money received minus refunds **whatever the booking's status**: a paid booking
  cancelled without a refund is money kept (before, cancelled bookings dropped out of
  revenue). A void no longer drops a sale's revenue; a refund does. The booking
  confirmation-gate check allows `refunded`, since a refunded booking was paid.
- **Client side:** `GET /client/package-purchases` (no operator notes), a Packages tab on the
  client page, "Covered by your package" in client history, the manage page and the booking
  flow. A signed-in client's paid package is offered on the Service step; the public
  booking command accepts `paymentMethod: "package"` only with the client session and CSRF,
  books for the signed-in client and keeps the service's approval policy.
- **Buying:** `POST /public/workspaces/{slug}/package-purchases` (trusted origin, rate limit,
  idempotency key, terms snapshot) records a pending sale for the client with that email.
  `slotera_package_purchase_notify` (SECURITY DEFINER) takes the copy in every language and
  picks the client's and owner's preferred language; it queues `package_requested`,
  `package_ready` and `operator_package_requested`, plus a `package_requested` bell item.
  The demo stores requests in `slotera.demoPackagePurchases` so the demo admin sees them.
- **Tests:** refund and client-package PostgreSQL integration tests (signed-out, forged CSRF,
  unpaid, someone else's, voided, approval, buying, emails, no-email sale), Vitest for the
  refund rules and dialog, the Packages tab, the package choice, the package request body,
  buying and the demo request; `web/e2e/package.spec.ts` gains the buy → mark paid → refund
  journey.
- **Fixed after the first browser run (2026-11-23):** marking a sale paid, voiding it or
  refunding it left the client's package card showing the cached list, because writes under
  `/package-purchases` did not refresh reads under `/clients` or the dashboard
  (`relatedReads` in `api/query-cache.ts`). The browser reporter now reports failing lines
  for every spec, not just five.

## 2026-11-24 — Gap pass: client export, cancellation email, custom repeats

- **Client data export** now includes package sales (sessions, payment, refunds, when the
  terms were accepted and their text) and each booking's payment method and refunds.
- **Cancellation email:** a cancelled package booking says the session is back in the
  package; a free booking no longer mentions refunds (en, de, tr).
- **Custom repeats:** the session form's "Custom" works in the real app: every N weeks on
  chosen weekdays, which the API already supported. Before, the real app refused it and the
  demo offered it without repeating anything.
- **Checked and found complete:** every server endpoint has a screen, cache refreshes cover
  every write, translations match in all three languages, erasure clears sale notes, and
  the workspace export already includes the new columns.
- **Browser journeys fixed (2026-11-25):** the first full run since 2026-11-18 failed every
  Turkish and German case, because the specs never called `loadLang` after languages became
  lazy, so their expected text was English. Two English checks were also stale: the
  conversation list now previews the client's message (two matches), and the phone layout
  hides the sidebar link the language check looked for. The second run found two more: the
  client page's tabs have the tab role, not button; and the calendar's week steps came from
  the day offset, which skips a week after local midnight east of UTC, so they now count
  local Mondays to the session's real start. Test-only changes.
