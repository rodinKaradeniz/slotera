# Slotera — Current State

This document describes the current state of the application: what exists, how it's
structured, and how to run it. It is the entry point — read it first.

## Reading order at the start of every task

1. **`AGENTS.md`** (this file) — what exists now: layout, stack, how to run it,
   conventions, feature snapshot. Always.
2. **`docs/RULES.md`** — how to work on this project: Do / Don't / Communication rules.
   Always; it applies to every task regardless of size.
3. **`docs/PRODUCT.md`** — the product rulebook: positioning, domain vocabulary,
   per-surface rules, and the standing "never reintroduce X" list. Read the relevant
   section before changing any user-facing surface, adding a field to a domain type, or
   writing copy. **Authoritative on product rules** — if another document disagrees about
   one, this file wins and the mismatch gets flagged.
4. **`docs/HISTORY.md`** — decisions, rationale, rejected alternatives, framework-level bug
   catches. Read before changing something that looks arbitrary; most things that look
   arbitrary here are load-bearing.
5. **`docs/TODO.md`** — deferred items, known gaps, future directions. Read when planning,
   or when what you're touching is adjacent to a deferred concern. An item listed there is
   a decision, not an oversight.

Right-sizing: simple polish needs 1–2. Copy or surface work adds 3. Architectural work
adds 4. Planning adds 5.

Workflow modules for specific kinds of task live in **`skills/`** — see
[Workflow modules](#workflow-modules) below.

`CLAUDE.md` at the repo root is a pointer stub, kept so that tooling which auto-loads that
filename lands here. It holds no content of its own.

---

## What Slotera is

Slotera is a paid booking and session-management product for **individual** service
providers — independent consultants, coaches, instructors, and small expert-led
studios/workshops. It is positioned as a *lightweight client workspace*: paid bookings,
client intake/prep forms, multi-session packages, session management, client context and
notes, and a public customer booking page — deliberately not a heavy CRM, not a
calendar-only tool, and not a generic "reservation app." The public/default product
frontend remains a **mock-backed Next.js prototype** built for portfolio and client demos,
with no real authentication, payment provider, or email. A separate opt-in local API mode
now wires the first operator bundle to FastAPI without changing that deployment default.
Phase 2 continues as a local-only FastAPI + PostgreSQL backend under `server/`; it
currently exposes infrastructure health checks,
real auth/session endpoints, operator business-settings/saved-location/service resources,
workspace availability, session/recurrence resources, client/booking/form/context
resources, a tenant-scoped dashboard read model, database-enforced calendar conflicts,
server-side operator search, and a user-targeted notification baseline over the
identity/tenancy model. See
`docs/PRODUCT.md` for the full positioning rules and
phase plan (Phase 2 later adds the minimum transactional email required by real bookings;
Phase 3 adds Stripe, scheduled email, and calendar integrations).

---

## Running it locally

**Complete development stack** — from the repository root:

```bash
./scripts/dev                 # prepare everything, then run API + frontend
./scripts/dev --api           # same stack, with the frontend using the local API bundle
./scripts/dev --prepare-only  # prepare dependencies/database without running apps
```

The script requires Docker, uv, and npm. It creates missing local env files from their
examples without overwriting existing ones, synchronizes both dependency sets, regenerates
TypeScript transport types from FastAPI OpenAPI, starts and waits for PostgreSQL, runs
`alembic upgrade head`, imports the idempotent demo seed, then
starts FastAPI on `8000` and Next.js on `3344`. Ctrl-C stops both application processes
but deliberately leaves PostgreSQL running with its named volume intact. Alembic tracks
the applied revision in PostgreSQL's `alembic_version` table, so repeated starts apply
only pending migrations.

**Frontend** — from `web/`:

```bash
npm install

PORT=3344 npm run dev   # dev server (port 3344 is this project's convention)
npm run build           # production build
npm run start           # serve the production build
npm run lint            # eslint
npx tsc --noEmit        # type-check (tsconfig sets noEmit, so this is the type-check)
```

The frontend still has **no test runner configured** — `npm test` does not exist.
Frontend verification remains type-check, lint, and affected routes exercised in a
running dev server. The backend has its own pytest/Ruff/mypy gates below.

**Backend foundation** — from `server/`:

```bash
cp .env.example .env
uv sync
docker compose up -d db           # PostgreSQL on 127.0.0.1:55432
uv run alembic upgrade head
uv run slotera-seed                # local password: slotera-local-only
uv run uvicorn slotera_api.main:app --reload --port 8000

uv run pytest                     # isolated tests; integration tests excluded by default
uv run pytest -m integration      # requires the Compose database
uv run ruff check .
uv run mypy
```

The backend exposes `/health/live`, `/health/ready`, `/docs`, and `/openapi.json`. See
`server/README.md` and `docs/RULES.md` for what may and may not be claimed as verification.

**Frontend environment** — `web/.env.local` (and `web/.env.example`) carry three public
variables:

```
NEXT_PUBLIC_DATA_SOURCE=mock          # "mock" | "api"; read once in web/src/lib/env.ts
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_CSRF_COOKIE_NAME=slotera_csrf
```

**Signing in (mock mode)** — any password works. `web/src/services/auth.service.ts`
resolves the role from the email address:

| Email | Lands on |
|---|---|
| `hello@slotera.app` (seeded operator, Dr. Lena Maria Hartmann) | `/admin/dashboard` |
| `admin@slotera.app` (seeded superadmin, Avery Quinn) | `/superadmin/overview` |
| anything starting `admin@` / `super@` / `superadmin@` | `/superadmin/overview` |
| any other address | `/admin/dashboard` (ad-hoc operator) |
| `wrong@example.com` | throws — the seeded failure case for testing error states |

**Signing in (local API mode)** — use `hello@slotera.app` / `slotera-local-only`.
Authentication is cookie-backed and the operator lands on `/admin/dashboard`; Dashboard,
Calendar, Calendar Settings, Bookings, Clients, Services, Forms, and Business Settings are
exposed in API-mode navigation. The navbar and Cmd/Ctrl-K operator search are also
API-backed. Calendar uses persisted sessions, booking/client context, and session action
items, while attendance remains deferred until booking commands exist.
Superadmin resource pages, public booking, registration/reset, and the remaining operator
routes are not API-wired yet.

**Public routes needing no session:** `/` (landing), `/booking`,
`/booking/confirmation`, `/booking/failure`, `/booking/manage/demo`.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js `16.2.6`, App Router, Turbopack | four route groups, one root layout |
| Language | TypeScript `^5`, `strict: true`, `noEmit: true` | path alias `@/*` → `web/src/*` |
| UI runtime | React `19.2.4` | most components are `"use client"` |
| Styling | Tailwind CSS `v4` via `@tailwindcss/postcss` | design tokens in `web/src/app/globals.css` under `@theme inline` |
| Class composition | `clsx` + `tailwind-merge` (extended) | always via `web/src/lib/cn.ts` |
| Icons | `lucide-react` | never imported directly — wrapped by `web/src/components/ui/Icon.tsx` as a named `IconName` union |
| Charts | `recharts` `^3.8` | one usage: `TrendChart` on the dashboard |
| Rich text | Tiptap `^3.27` (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`) | one usage: client notes editor |
| Fonts | `next/font/google` — Fraunces, Inter Tight, JetBrains Mono | exposed as `--font-serif` / `--font-sans` / `--font-mono` |
| Data | mock JSON by default; generated OpenAPI DTOs + HTTP adapters for the local operator bundle | switchable via `NEXT_PUBLIC_DATA_SOURCE` |
| Frontend auth | mock token in mock mode; HttpOnly cookie + CSRF in API mode | `localStorage` holds only the UI session snapshot |
| i18n | hand-rolled flat dictionary, EN / TR / DE | `web/src/lib/i18n.ts` + `web/src/i18n/messages/*.ts` |
| Lint | ESLint `^9` + `eslint-config-next` (flat config) | `web/eslint.config.mjs` |
| Backend | Python 3.13 + FastAPI, SQLAlchemy async, Alembic | auth/session + operator settings/locations/services/notifications |
| Backend data | PostgreSQL 17 via Docker Compose | owner migrations, restricted application role, forced tenant RLS; host port `55432` |
| Backend tooling | uv, pytest, Ruff, mypy | lockfile under `server/`; no CI yet |
| Frontend tests | none | no runner, no test files, no CI |

---

## Repository layout

```
AGENTS.md              this file — current state, entry point
CLAUDE.md              pointer stub → AGENTS.md (no content of its own)
docs/
  PRODUCT.md           long-form product rulebook (positioning, domain rules)
  HISTORY.md           decisions & rationale
  TODO.md              deferred work & future directions
  RULES.md             always-on working conventions
skills/<name>/SKILL.md on-demand workflow modules (canonical location)
.claude/skills/        symlinks into skills/ for native skill discovery
scripts/dev            one-command local dependency/database/application startup

web/
  package.json         Next.js dependencies and npm scripts
  package-lock.json    reproducible frontend dependency lock
  next.config.ts       section-root redirects live here, not in page bodies
  eslint.config.mjs    flat ESLint config
  postcss.config.mjs   Tailwind/PostCSS integration
  tsconfig.json        strict TypeScript config; `@/*` → `web/src/*`
  public/              static assets (currently empty)
  src/
    app/               App Router routes, route groups, layouts, global CSS
    api/               shared HTTP/CSRF client + generated OpenAPI document/types
    components/        UI, shared, layout, drawer, admin, booking, and public components
    data/mock/         21 JSON fixtures — the entire frontend data set
    i18n/messages/     en.ts source keys plus TR/DE partial translations
    lib/               pure helpers and client storage/env owners
    services/          16 service modules — the only frontend path to data
    types/             frontend domain types; index.ts is a partial barrel

server/
  pyproject.toml       uv project + pytest/Ruff/mypy configuration
  uv.lock              reproducible Python dependency lock
  compose.yaml         local PostgreSQL 17 (`slotera` Compose project)
  migrations/          async Alembic environment + versioned schema revisions
  docker/postgres/     restricted application-role bootstrap
  src/slotera_api/     FastAPI app, auth, operator resources, models, seed, DB lifecycle
  tests/               isolated contracts + opt-in PostgreSQL/RLS integration tests
```

---

## Architecture

### Data layer — the mock/api switch

Every module in `web/src/services/` keeps mock and API behavior behind the same component-
facing function. Unwired functions still fail explicitly:

```ts
let mock: T[] = JSON.parse(JSON.stringify(json)) as T[];   // module-level in-memory copy

export async function listThings(): Promise<T[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listThings");
  await sleep(60);          // simulated latency
  return [...mock];
}
```

- `dataSource` comes from `NEXT_PUBLIC_DATA_SOURCE` via `web/src/lib/env.ts` and defaults to
  `"mock"`. Auth/session, business settings/saved locations, services, notifications,
  availability, sessions, clients, booking reads, forms, client notes, session action
  items, dashboard summary, and workspace search have API adapters; other methods still throw
  `NotImplementedError` in API mode.
- FastAPI OpenAPI is exported to `web/src/api/generated/` by `npm run generate:api`.
  Generated DTOs stay inside the API/service boundary and are mapped to `web/src/types/`.
- `web/src/api/client.ts` owns credentialed fetch, no-store requests, structured API
  errors, and readable-cookie CSRF headers for unsafe methods.
- Mutations persist for the lifetime of the dev process and reset on reload/HMR.
  Cross-reload persistence is not a Phase 1 requirement.
- **Components must go through the service layer.** Importing `web/src/data/mock/*.json`
  directly from a component is a bug.
- Errors are `NotImplementedError` or `NotFoundError` from `web/src/services/_errors.ts`;
  components surface `err.message`, usually through `toast.error(...)`.
- Services are self-contained with one exception: in mock mode, `dashboard.service.ts`
  composes live from bookings, sessions, and action items to prepend derived "Needs your
  attention" entries. API mode maps the single dashboard summary read model instead.

Current services: `auth`, `billing`, `bookings`, `client-notes`, `clients`, `dashboard`,
`demo`, `forms`, `notifications`, `packages`, `platform`, `services`,
`search`, `session-action-items`, `sessions`, `settings`.

### Backend persistence

`server/src/slotera_api/main.py` builds the local FastAPI application. The opt-in local API
mode wires its first operator bundle through `web/src/services/`; the public/default demo
remains deterministically mock-backed. The
implemented HTTP surface is deliberately limited to:

- `/health/live` — process liveness and no database access;
- `/health/ready` — verifies PostgreSQL through the restricted `slotera_app` role;
- `POST /auth/login` — verifies Argon2id credentials and issues an opaque session;
- `GET /auth/session` — resolves the current user, role, and workspace;
- `POST /auth/logout` — CSRF-protected immediate session revocation;
- `GET/PATCH /settings/business` — operator-owned workspace/profile settings;
- `GET/POST /settings/locations` plus item `PATCH/DELETE` — saved locations;
- `GET/POST /services` plus item `GET/PATCH/DELETE` — operator service management;
- `GET/POST /clients` plus item `GET/PATCH` — operator client profiles and search;
- `GET /bookings` plus item `GET` — tenant-scoped operator booking-ledger reads;
- `GET/POST /forms` plus item `GET/PATCH/DELETE` — operator form-template management;
- `GET/POST /clients/{client_id}/notes` plus note `PATCH/DELETE` — private operator
  client context, allow-list sanitised before persistence;
- `GET /notifications` and `POST /notifications/mark-all-read` — structured, user-
  targeted operator notifications and read acknowledgement;
- `GET/PUT /availability` — workspace timezone, split weekly hours, booking-window policy,
  buffers, notice/advance limits, and blackout ranges;
- `GET/POST /sessions` plus item `GET/PATCH` — one-off and recurring materialised
  sessions, including explicit `this` / `this_and_following` edit scope;
- `GET/POST /sessions/{session_id}/action-items` plus item `PATCH/DELETE` — private
  operator session tasks with persisted `todo`/`done` state;
- `GET /dashboard/summary` — a tenant- and principal-scoped operator dashboard read model;
- `GET /search` — a bounded tenant-scoped projection over searchable operator resources;
- `/openapi.json` and `/docs` — the future generated-transport contract.

Every response receives a generated `X-Request-ID`. HTTP, validation, application, and
unexpected errors use one camelCase error envelope, and unexpected exceptions do not
expose their message. Request logs are structured JSON. CORS is credential-capable but
restricted to configured exact origins; wildcard origins are rejected by configuration.

SQLAlchemy uses an async engine/session factory. Alembic connects separately as
`slotera_owner`; the API uses `slotera_app`, which has data-operation defaults but cannot
create tables. The first domain revision adds users, opaque auth sessions, password-reset
tokens, workspaces, memberships, slug history/reservations, append-only audit events,
business profiles, saved locations, and services.
The notification revision adds membership-backed recipients, structured event payloads,
and a separate principal transaction context for workspace-and-user RLS.
The scheduling revision adds normalized availability, recurrence series, materialised
occurrences, composite tenant foreign keys, and a partial GiST exclusion constraint that
allows adjacent/cancelled time ranges but rejects active overlap per calendar owner.
Only SHA-256 session/CSRF token digests are stored. The local seed gives Lena and Avery an
Argon2id hash for `slotera-local-only`; the seed command is disabled in production.

Tenant transactions call PostgreSQL `set_config(..., true)` on the same connection and
transaction that performs the query. Forced RLS applies to workspaces, memberships, slug
history, audit events, business profiles, locations, and services; repositories also
scope resource queries explicitly. Unscoped tenant reads return no rows and cross-
workspace writes fail. The runtime role has no direct privileges on users, auth sessions,
or reset tokens.
Four fixed-search-path `SECURITY DEFINER` functions expose only login lookup, session
creation, session lookup, and revocation to that role.
The local Compose database binds to `127.0.0.1:55432` to avoid the commonly used host
`5432` port. `uv run slotera-seed` imports the Hartmann workspace, operator, business
profile, two locations, five EUR-derived services, four notifications, platform
superadmin, default weekday availability, audit event, and reserved slugs idempotently
through the owner connection.

### Auth and session

Real backend HTTP authentication exists locally. Passwords use Argon2id behind one local
wrapper; login rotates opaque session and CSRF credentials. The session cookie is
host-only, HttpOnly, and SameSite=Lax. The readable CSRF cookie must match both the
`X-CSRF-Token` header and the digest bound to that session. Unsafe authenticated requests
also require an exact configured `Origin`. Production marks both cookies Secure and
requires an explicit shared sibling-domain CSRF cookie. Reusable FastAPI dependencies
provide authenticated, CSRF-protected, and operator-workspace request contexts. Operator
mutations emit audit events in the same transaction as their resource change.
Notification queries additionally derive the recipient from the verified session and set
both workspace and user database context. The runtime role can select notifications and
update only `read_at`; it cannot insert/delete rows or rewrite structured payloads.

In mock mode, `auth.service.ts` writes a fabricated token to `localStorage`. In API mode,
it exchanges credentials for server cookies, restores the verified session from
`GET /auth/session`, and sends the readable CSRF cookie through the shared client on
logout. `web/src/lib/session.ts` remains the **only** module that touches the
`slotera.session` and `slotera.onboarding` keys. `AuthGuard`
(`web/src/components/layout/AuthGuard.tsx`) takes an optional `requireRole` and redirects to
`/login?next=…` when there is no session, or to `homePathForRole(session.role)` on a role
mismatch. `homePathForRole()` in `web/src/lib/nav.ts` is the single source of truth for where
each role goes home; `OPERATOR_NAV` / `SUPERADMIN_NAV` / `navForRole()` live beside it.

`UserRole` is `"operator_admin" | "superadmin"`. Customers never authenticate.

### Route groups

| Group | Routes | Shell | Guard |
|---|---|---|---|
| `(public)` | `/`, `/booking`, `/booking/confirmation`, `/booking/failure`, `/booking/manage/demo` | `PublicNav` / booking chrome | none |
| `(auth)` | `/login`, `/register`, `/register/plan`, `/register/payment`, `/forgot-password`, `/reset-password`, `/onboarding` | `AuthShell` (width chosen by pathname in the group layout) | none |
| `(admin)` | `/admin/{dashboard,calendar,bookings,bookings/[id],clients,clients/[id],services,packages,forms,settings}` | `AdminShell` | `AuthGuard requireRole="operator_admin"` + `DrawersProvider` |
| `(superadmin)` | `/superadmin/{overview,workspaces,workspaces/[id],subscriptions,inquiries,settings}` | `AppShell` with `SUPERADMIN_NAV` | `AuthGuard requireRole="superadmin"` |

`/admin` → `/admin/dashboard` and `/superadmin` → `/superadmin/overview` are handled by
`redirects()` in `web/next.config.ts` — **not** by `page.tsx` bodies calling `redirect()`.
See HISTORY.md for why.

### Providers

Mounted once at the root layout (`web/src/app/layout.tsx`), so every route group inherits
them: `I18nProvider` → `ToastProvider` → `DemoGuideProvider`.

- **Toasts** — `const { toast } = useToast()`; `toast.success/error/info(msg, {
  description?, durationMs? })`. Top-right stack, 3.5s auto-dismiss,
  `prefers-reduced-motion` aware. `window.alert()` / `window.confirm()` are not used
  anywhere; use a toast for ambient feedback and `ConfirmDialog` for blocking
  confirmation.
- **Drawers (admin only)** — `DrawersProvider` is mounted in the `(admin)` layout and
  holds the state for `BookingDrawer`, `SessionDrawer`, `ServiceDrawer`, `FormDrawer`,
  and `PackageDrawer`. Pages call `useDrawers().openBookingDrawer({...})` rather than
  rendering drawers inline; one drawer is open at a time. On mobile the same component
  renders as a bottom sheet — there is no forked mobile dialog. `(superadmin)` has no
  provider; its single `NewWorkspaceDrawer` is mounted locally per view.
- **Demo guide** — one shared modal instance; auto-open is landing-only and gated on
  `sessionStorage`.

### Styling

Tailwind v4 with tokens declared in `web/src/app/globals.css`:

- Semantic colors `paper`, `paper-2`, `ink`/`ink-2`/`ink-3`/`ink-4`, `line`, `line-soft`,
  `surface`, `surface-warm`, `accent` (deep forest green) + `accent-ink`/`accent-soft`/
  `accent-hover`, and `success`/`warning`/`danger`/`info`.
- Shadows `shadow-card` / `shadow-pop` / `shadow-overlay`, with numeric aliases
  `shadow-1` / `shadow-2` / `shadow-3`.
- Heading classes are **`.text-display` / `.text-h1` / `.text-h2` / `.text-h3`** — never
  `.h-1`/`.h-2`/`.h-3`, which Tailwind v4 generates as *height* utilities.
- `web/src/lib/cn.ts` registers the custom `text-*` typography classes with `tailwind-merge`
  as the `font-size` group. Always compose classes with `cn(...)`, not raw `clsx`.
- Element-selector resets (`button`, `input`, `textarea`, `select`, `a`) are wrapped in
  `@layer base` — mandatory, see HISTORY.md.
- `<html>` carries `data-scroll-behavior="smooth"`; do not remove it.

The visual target is warm cream paper, deep forest accent, generous spacing, no
enterprise density. When something looks wrong on several pages, fix the shared primitive
(`PageHeader`, `SectionHeader`, `Card`, `DrawerShell`, the typography classes), not each
page. Standard page shape:

```tsx
<div className="space-y-6">
  <PageHeader />
  <section className="space-y-4">
    <SectionHeader />
    <Card>…</Card>
  </section>
</div>
```

### Internationalisation

Hand-rolled, no i18n library. `web/src/lib/i18n.ts` exposes `Lang = "en" | "tr" | "de"`,
`translate(lang, key, vars?)` with `{name}` interpolation, `localeForLang()` (→ `en-GB`,
`tr-TR`, `de-DE` for `Intl` formatting), and read/write of the `slotera.lang`
`localStorage` key. `web/src/i18n/messages/en.ts` defines the `Messages` type and is the key
source of truth; `tr.ts` and `de.ts` are `Partial<Messages>` and fall back to English
per-key, then to the key itself.

Coverage is chrome and labels — most demo/mock body copy (provider names, service
descriptions, seeded notes) is English-only by design.

---

## Conventions

- **Path alias** `@/*` → `web/src/*`. Use it; no deep relative climbs.
- **`"use client"`** is the default for anything importing a service or session helper.
  Server components are limited to static layouts and the landing page.
- **Status presentation** lives in `web/src/lib/status-maps.ts` (`BOOKING_STATUS`,
  `PAY_STATUS`, `CLIENT_TAGS`, `LOC_TYPE_META`, `SUBSCRIPTION_STATUS`, `INQUIRY_TYPE`,
  `PLAN_LABEL`, `FORM_STATUS`, `PACKAGE_STATUS`). Extend that file; never hardcode a tone
  or label per page.
- **Icons** go through `IconName` in `web/src/components/ui/Icon.tsx`. Add to the map rather
  than importing from `lucide-react` at a call site.
- **Card inputs** are formatted with `web/src/lib/card.ts` (`formatCardNumber`,
  `formatCardExpiry`, `formatCardCvc`, `detectCardBrand`, `isValidCardExpiry`). Every
  card form uses these; do not write new formatters.
- **Money** goes through `web/src/lib/money.ts`; the default currency is **GBP**.
- **IDs** for mock records come from `makeId(prefix)` in `web/src/lib/id.ts`.
- **`react-hooks/set-state-in-effect` is disabled project-wide** — mount-once data fetches
  and SSR-portal mount flags both legitimately set state in an effect here.
- **Unused vars** are a warning when prefixed `_`; that's the intentional escape hatch for
  Phase 1 stub parameters (`_password`, `_token`).
- **Section-root redirects belong in `web/next.config.ts`.** Never add a `page.tsx` whose only
  job is `redirect()`.

---

## Feature snapshot

Present tense — what exists in the working tree today.

**Public**
- Landing page with hero + collage, features, how-it-works, logo wall, testimonials,
  pricing, FAQ, final CTA, footer with a single `Legal` link opening a three-tab modal
  (Imprint / Privacy / Terms). No standalone `/imprint`, `/privacy`, `/terms` routes.
- Public booking flow: Service → Date & time → Details → (Forms, conditional) → Billing →
  Review → Pay, with a receipt-styled summary, consent linking to a two-tab legal modal
  (provider booking terms + platform terms), and confirmation/failure routes.
- The service list on `/booking` is curated in `demo.service.ts`
  (`STANDARD_BOOKING_SERVICE_IDS` → Discovery Call, Strategy Session, Coaching Session,
  Group Workshop). Persona demos are reachable via `?demo=<slug>`.
- When `settings.business.bookingPageEnabled === false` the route still returns 200 and
  renders `BookingsPausedCard` instead of the stepper.
- `/booking/manage/demo` — a mocked, no-auth two-column customer **booking workspace**
  with tabs: Booking info, Manage booking, Forms, Payment, and Package (only when the
  booking belongs to a package). Single fixed demo booking; no tokens or persistence.

**Auth & onboarding**
- Login, forgot/reset password, and a three-route registration flow
  (`/register` → `/register/plan` → `/register/payment`) that defers account creation
  until after mock payment, holding the draft in `sessionStorage` via
  `web/src/lib/register-draft.ts`. Choosing the Custom plan diverts to a persisting contact
  inquiry and creates no account.
- Five-pane onboarding stepper: Welcome → Service → Availability → Payments → Done, reusing
  `ServiceForm`, `WorkingHoursForm`, and `ManualPaymentForm`.

**Operator workspace (`/admin`)**
- Dashboard: KPI tiles, Recharts revenue trend, `NextSessionCard` (with today's timeline
  embedded), and `PendingActions`; API mode uses persisted dashboard facts, while the
  mock-only booking-page live/paused controls stay hidden in API mode.
- Calendar: day / week / month grids, conflict warning, session details via `SessionDrawer`.
- Bookings: status accordions (Pending → Confirmed → Completed → No-show → Cancelled),
  a `client` query-param filter with a removable chip, and a focused booking detail page.
- Clients: list + a two-tab detail page (Overview, Notes) with rich-text client notes
  backed by a minimal Tiptap editor.
- Services, Packages (ordered bundles of existing services), Forms (reusable templates
  attached to services), and Settings (Business Profile incl. saved locations, Branding,
  Client Payments, Billing & Subscription, Calendar, Emails, Account).
- Session drawer carries a "Notes & Actions" tab: one internal note plus lightweight
  action items, both admin-only. API mode persists the action-item list, its task status,
  optional due date, and future-only `clientVisible` flag.
- Client Notes persist in API mode as separate internal entries; stored rich text is
  server-sanitised and defensively sanitised again before rendering.
- Global search: navbar dropdown + Cmd/Ctrl-K palette over one shared presentation index
  (`web/src/lib/search.ts`) spanning bookings, clients, services, sessions, and nav; API
  mode uses the tenant-scoped search projection without fixture fallback.

**Platform workspace (`/superadmin`)**
- Overview KPIs, workspaces list + detail, subscriptions, and an inquiries **inbox**
  (read/unread only — no ticket statuses) with a preview modal that can promote a business
  inquiry into a provisioned workspace.

**Backend persistence**
- Local FastAPI app with liveness/readiness, OpenAPI docs, structured errors and request
  logging, exact-origin CORS, async PostgreSQL lifecycle, and Alembic migrations.
- Identity/tenancy schema for users, sessions/reset tokens, workspaces, memberships,
  slug history/reservations, and audit events. Tenant tables use forced PostgreSQL RLS;
  identity tables remain withheld from the runtime role behind four narrow auth functions.
- A deterministic local seed importer maps the Lena/Avery identity fixture into UUID-backed
  rows, including local-only Argon2id credentials, and is repeatable.
- Real `/auth/login`, `/auth/session`, and `/auth/logout` resources with revocable cookies,
  exact-Origin checks, session-bound CSRF, and no-store identity responses. Pytest covers
  HTTP contracts and negative security paths;
  opt-in integration tests exercise live readiness, privileges, tenant isolation, RLS
  coverage, append-only audit events, and seed idempotency.
- Operator business-profile, saved-location, and service CRUD. Service currency is
  inherited from the workspace, inputs cannot override it, and service notes are exposed
  only on authenticated operator endpoints. Resource queries are application-scoped and
  backed by forced PostgreSQL RLS.
- Structured operator notifications with a typed event/payload response, aggregate unread
  count, and CSRF-protected mark-all-read command. Both repository predicates and forced
  PostgreSQL RLS isolate workspace and recipient; no email or event producers exist yet.
- Generated OpenAPI transport types and a shared credentialed HTTP client back an opt-in
  local operator UI for auth, services, business settings/locations, notifications,
  availability/sessions, clients, booking-ledger reads, forms, client notes, session
  action items, dashboard facts, and workspace search. API-mode Calendar intentionally excludes mock-only
  attendance; the public/Vercel experience continues to default to mock mode.
- Workspace availability and authenticated session APIs persist one-off or rolling six-
  month recurring occurrences. PostgreSQL owns the same-calendar-owner overlap invariant;
  session capacity is validated, while booked-count consumption waits for bookings.
- Tenant-scoped client profiles persist stable UUIDs and normalized, workspace-unique
  email addresses. Operator client CRUD/search is RLS-backed and audit logged; booking
  metrics remain unwired until their resources land.
- Client-note CRUD persists separate, internal operator context under forced RLS and audit
  events. The API strips all HTML attributes and non-editor markup before storage; no
  public response exposes client notes.
- Session action items persist as separate session-owned operator tasks under forced RLS
  and audit events. `clientVisible` is stored but has no public/client transport effect.

**Mock data set** — 5 services, 4 form templates, 2 packages, 8 clients, 11 bookings,
10 sessions, 3 client notes, 9 session action items, 8 platform workspaces, 6 inquiries,
3 plans, 5 invoices, plus dashboard, settings, notifications, demo-persona, and
form-response fixtures.

---

## Workflow modules

`skills/<name>/SKILL.md` holds on-demand **workflow modules** — procedures for a specific
kind of task, as opposed to the always-on rules in `docs/RULES.md`. Each is a folder with
a `SKILL.md`: YAML frontmatter (`name`, `description`) plus a markdown body saying when to
use it and how it changes your approach.

**Open the module when its trigger matches. If none match, don't.**

| Module | Open it when |
|---|---|
| [`skills/engineering-discipline`](skills/engineering-discipline/SKILL.md) | before writing code on any change touching more than one file, adding a surface, or introducing a pattern — sets success criteria and holds scope |
| [`skills/structured-reasoning`](skills/structured-reasoning/SKILL.md) | the hard part is *deciding*: several defensible answers, competing constraints, or a wrong call means a rewrite |
| [`skills/test-authoring`](skills/test-authoring/SKILL.md) | writing or reviewing tests — what's worth testing here and what only restates the implementation |
| [`skills/tdd-verification`](skills/tdd-verification/SKILL.md) | a change must be provably correct, or you're about to claim something is done |
| [`skills/full-stack-architect`](skills/full-stack-architect/SKILL.md) | cross-layer design: data model, service boundaries, API shape, anything outliving the current phase |
| [`skills/security-review`](skills/security-review/SKILL.md) | touching auth, data access, external input, rendering of stored content, or payment flows |
| [`skills/skill-creator`](skills/skill-creator/SKILL.md) | a recurring workflow or hard-won lesson should be written down — includes deciding whether a module is even the right home |

**Skills are the workflow layer; `docs/RULES.md` is the always-on convention layer and
wins on any conflict.**

`skills/` is the canonical location and is readable by any tool. `.claude/skills/`
contains symlinks into it, so assistants with native skill discovery pick the same files
up automatically — one copy, two access paths. Adding a module means creating it under
`skills/`, symlinking it, and adding a row to the table above.

---

## Verification status of this document

Written on 2026-07-25 against the working tree at commit `8b80465`. At that point
`npx tsc --noEmit` and `npm run lint` both exit clean, and `PORT=3344 npm run dev` boots
in under a second with `/`, `/booking`, `/login`, and `/booking/manage/demo` all
returning 200.

The Phase 2/3 planning summary was updated on 2026-07-26, followed by the local backend
foundation described above. For that foundation, isolated pytest reports 9 passed,
PostgreSQL integration pytest reports 2 passed, Ruff and mypy are clean, the baseline
Alembic migration applies, and the Compose PostgreSQL service reaches healthy. Frontend
`npx tsc --noEmit` and `npm run lint` were also rerun after the docs-only integration.

On 2026-07-28 the complete Next.js workspace moved under `web/`. From that directory,
`npx tsc --noEmit`, `npm run lint`, and `npm run build` pass; the dev server boots on
`127.0.0.1:3344`, `/`, `/booking`, `/login`, and `/booking/manage/demo` return 200, and an
unknown route returns 404. Backend isolated pytest, Ruff, mypy, and Compose configuration
also remain clean after the workspace move.

Later on 2026-07-28, identity/tenancy persistence landed under `server/`. Isolated pytest
reports 13 passed and PostgreSQL integration pytest reports 7 passed; Ruff and strict
mypy are clean. Alembic upgrades to `20260728_0002`, reports no model drift, and completes
a downgrade/upgrade round trip. The seed CLI inserts 16 rows on a fresh schema and zero
on its immediate repeat. Frontend checks were not rerun because no `web/` files changed.

The local auth/session HTTP boundary followed on 2026-07-28. Isolated pytest reports 22
passed and PostgreSQL integration pytest reports 12 passed; Ruff and strict mypy are
clean. Alembic is at `20260728_0003`, has no model drift, and the auth revision completes
a downgrade/upgrade round trip. Live tests cover operator and superadmin sessions, raw-
token non-persistence, revocation, expiry, generic credential failures, RLS/privileges,
and repeatable password seeding. No frontend files changed, so frontend checks were not
rerun.

Later on 2026-07-28, the first operator resources landed. Business settings, saved
locations, and services now persist through authenticated resource-shaped APIs under
forced RLS, CSRF-protected mutations, and append-only audit events. Isolated pytest
reports 25 passed and PostgreSQL integration pytest reports 18 passed; Ruff and strict
mypy are clean, and Alembic is at `20260728_0004` with no model drift. No frontend files
changed, so frontend checks were not rerun.

The root `./scripts/dev` workflow was then exercised end to end on 2026-07-28. Its
preparation mode synchronized both dependency sets, waited for the real Compose database,
reported Alembic `20260728_0004 (head)`, and confirmed a zero-change repeat seed. Default
mode started both development servers; `/`, `/docs`, and `/health/ready` returned 200,
with readiness reporting PostgreSQL `ok`. Ctrl-C stopped both application processes with
status 130 and left PostgreSQL running as designed.

The notification baseline followed on 2026-07-28. `GET /notifications` and the CSRF-
protected mark-all-read command use structured payloads, membership-backed recipients,
and workspace-plus-user RLS. The runtime role has column-level update permission only for
`read_at`. Isolated pytest reports 26 passed and PostgreSQL integration pytest reports 20
passed; Ruff and strict mypy are clean, and Alembic is at `20260728_0005` with no model
drift. No frontend files changed, so frontend checks were not rerun.

The first frontend/API bundle followed on 2026-07-28. `npm run generate:api` now exports
the FastAPI contract and regenerates TypeScript DTOs; a shared browser client owns cookies,
CSRF, no-store requests, and structured errors. Local `--api` mode wires operator auth,
services, business settings/locations, and notifications while mock remains the default.
Frontend type-check and lint pass; backend isolated pytest reports 26 passed, PostgreSQL
integration pytest reports 20 passed, and Ruff/strict mypy are clean. Live cookie login,
session restore, all wired reads, CSRF rejection, and CSRF-protected logout were exercised.
The pre-existing listeners on ports 8000/3344 prevented starting a second API-mode UI
process, so the affected API-mode pages were not browser-walked in that run.

The scheduling backend foundation followed on 2026-07-28. Alembic revision
`20260728_0006` adds workspace availability policies/windows/blackouts, recurrence series,
materialised sessions, composite tenant references, and the partial GiST owner/time
exclusion constraint. Isolated pytest reports 28 passed; PostgreSQL integration pytest
reports 23 passed; Ruff and strict mypy are clean. The migration applies through real
PostgreSQL and generated OpenAPI/TypeScript transport declarations include availability
and session contracts. Frontend calendar/settings adapters remain deliberately unwired.

On 2026-07-29, the scheduling frontend/API bundle wired those generated contracts through
the service layer. API mode exposes Calendar plus Calendar Settings, without mixing in
mock booking/client, attendance, or action-item data. `./scripts/dev --api` regenerated
the transport, reached migration `20260728_0006 (head)`, and repeated the seed with zero
inserts; authenticated availability/session reads and Calendar/Settings route probes
returned successfully. `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.
Backend isolated pytest reports 28 passed, PostgreSQL integration pytest reports 23
passed, and Ruff/strict mypy are clean.

Later on 2026-07-29, booking ledger revision `20260729_0008` added forced-RLS booking
rows with composite workspace/client and workspace/session references plus EUR monetary
snapshots. API mode exposes operator Booking list/detail reads only; commands and capacity
consumption remain deferred.

Later on 2026-07-29, the client-profile API bundle added migration
`20260729_0007`, forced tenant RLS, normalized workspace-unique emails, audit events,
and generated frontend transport. API mode now supports the Client directory, profile
detail, and add/edit drawer without using mock booking metrics or notes. The idempotent
seed reports `clients_inserted: 0` on repeat. Isolated pytest reports 28 passed,
PostgreSQL integration pytest reports 25 passed, Ruff and strict mypy are clean, and
`npm run generate:api`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.

Later on 2026-07-29, client-notes revision `20260729_0010` added separate private note
rows with composite client/workspace ownership, forced RLS, and audit events. The operator
API exposes list/create beneath a client and update/delete by note id; it allow-list
sanitises Tiptap HTML on write and the browser repeats that sanitisation before rendering.
The regenerated OpenAPI transport enables the API-mode Client Notes tab, while public
routes expose no note data. `uv run alembic upgrade head` applied the revision; Ruff and
strict mypy pass; isolated pytest reports 28 passed and PostgreSQL integration pytest
reports 28 passed. `npm run generate:api`, `npx tsc --noEmit`, `npm run lint`, and
`npm run build` also pass.

Later on 2026-07-29, session-action-items revision `20260729_0011` added tenant-scoped,
session-owned operator tasks with forced RLS, audit events, and CSRF-protected CRUD. The
generated transport now enables the existing API-mode Calendar Notes & Actions manager;
the stored `clientVisible` flag has no public/client transport effect. `uv run alembic
upgrade head` reached `20260729_0011 (head)` and the repeat seed inserted zero rows.
Backend isolated pytest reports 28 passed, PostgreSQL integration pytest reports 29
passed, and Ruff/strict mypy are clean. `npm run generate:api`, `npx tsc --noEmit`,
`npm run lint`, and `npm run build` pass. An attempted fresh `./scripts/dev --api` could
not bind ports 8000/3344 because listeners already occupied them; read-only probes of the
existing listeners returned 200 for `/openapi.json` and `/admin/calendar`.

Later on 2026-07-29, the operator dashboard summary added the authenticated,
tenant-and-principal-scoped `GET /dashboard/summary` read model without a migration: it
derives existing booking, session, notification, and session-action-item facts under the
same database transaction context that enforces RLS. API mode now opens at Dashboard and
maps its generated DTOs through the dashboard service; mock-only public-booking controls
and booking rescheduling remain hidden there. Backend verification reports 28 isolated
pytest passes and 30 PostgreSQL integration passes, with Ruff and strict mypy clean.
`npm run generate:api`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.
Read-only probes of the running local services returned ready `{"status":"ok","checks":{"database":"ok"}}`
from `/health/ready` and HTTP 200 from `/admin/dashboard`.

Later on 2026-07-29, server-side operator search added authenticated `GET /search` without
a migration. It performs bounded, forced-RLS search projections across bookings, clients,
services, and sessions, intentionally excluding internal note/action-item text. The
existing navbar dropdown and Cmd/Ctrl-K palette now run in API mode through generated
transport rather than a fixture index; their locally added navigation entries are limited
to API-available routes. Backend isolated pytest reports 28 passes and PostgreSQL
integration pytest reports 31 passes, with Ruff and strict mypy clean. `npm run
generate:api`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass; read-only
probes of the running listeners returned HTTP 200 for `/openapi.json` and
`/admin/dashboard`.
