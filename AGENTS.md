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
calendar-only tool, and not a generic "reservation app." The repository currently holds a
**frontend-only Next.js prototype** built for portfolio and client demos: every service
call resolves against mock JSON in-process, there is no backend, no real authentication,
no payment provider, and no email. See `docs/PRODUCT.md` for the full positioning rules and the
phase plan (Phase 1 = this build; Phase 2 = local FastAPI + PostgreSQL plus the minimum
transactional email required by real bookings; Phase 3 = Stripe, scheduled email, and
calendar integrations).

---

## Running it locally

```bash
npm install

PORT=3344 npm run dev   # dev server (port 3344 is this project's convention)
npm run build           # production build
npm run start           # serve the production build
npm run lint            # eslint
npx tsc --noEmit        # type-check (tsconfig sets noEmit, so this is the type-check)
```

There is **no test runner configured** — `npm test` does not exist. "Verified" on this
project currently means: type-check clean, lint clean, and the affected route(s)
exercised in a running dev server. See `docs/RULES.md` for what may and may not be
claimed as verification.

**Environment** — `.env.local` (and `.env.example`) carry two public variables:

```
NEXT_PUBLIC_DATA_SOURCE=mock          # "mock" | "api"; read once in src/lib/env.ts
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000   # unused until the Phase 2 backend exists
```

**Signing in** — auth is mocked; any password works. `src/services/auth.service.ts`
resolves the role from the email address:

| Email | Lands on |
|---|---|
| `hello@slotera.app` (seeded operator, Dr. Lena Maria Hartmann) | `/admin/dashboard` |
| `admin@slotera.app` (seeded superadmin, Avery Quinn) | `/superadmin/overview` |
| anything starting `admin@` / `super@` / `superadmin@` | `/superadmin/overview` |
| any other address | `/admin/dashboard` (ad-hoc operator) |
| `wrong@example.com` | throws — the seeded failure case for testing error states |

**Public routes needing no session:** `/` (landing), `/booking`,
`/booking/confirmation`, `/booking/failure`, `/booking/manage/demo`.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js `16.2.6`, App Router, Turbopack | four route groups, one root layout |
| Language | TypeScript `^5`, `strict: true`, `noEmit: true` | path alias `@/*` → `src/*` |
| UI runtime | React `19.2.4` | most components are `"use client"` |
| Styling | Tailwind CSS `v4` via `@tailwindcss/postcss` | design tokens in `src/app/globals.css` under `@theme inline` |
| Class composition | `clsx` + `tailwind-merge` (extended) | always via `src/lib/cn.ts` |
| Icons | `lucide-react` | never imported directly — wrapped by `src/components/ui/Icon.tsx` as a named `IconName` union |
| Charts | `recharts` `^3.8` | one usage: `TrendChart` on the dashboard |
| Rich text | Tiptap `^3.27` (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`) | one usage: client notes editor |
| Fonts | `next/font/google` — Fraunces, Inter Tight, JetBrains Mono | exposed as `--font-serif` / `--font-sans` / `--font-mono` |
| Data | JSON fixtures in `src/data/mock/`, mutated in module-level memory | switchable via `NEXT_PUBLIC_DATA_SOURCE` |
| Auth | fake token in `localStorage` under `slotera.session` | no server, no verification |
| i18n | hand-rolled flat dictionary, EN / TR / DE | `src/lib/i18n.ts` + `src/i18n/messages/*.ts` |
| Lint | ESLint `^9` + `eslint-config-next` (flat config) | `eslint.config.mjs` |
| Tests | none | no runner, no fixtures, no CI |

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
next.config.ts         section-root redirects live here, not in page bodies
eslint.config.mjs      flat ESLint config
public/                empty

src/
  app/
    layout.tsx         root layout: fonts + I18nProvider > ToastProvider > DemoGuideProvider
    globals.css        design tokens, typography classes, base-layer resets, animations
    (public)/          landing + public booking flow + booking workspace demo
    (auth)/            login, register (3 routes), password reset, onboarding
    (admin)/           /admin/* — operator workspace (AuthGuard + DrawersProvider)
    (superadmin)/      /superadmin/* — platform management (AuthGuard)
  components/
    ui/                primitives: Button, Card, Modal, ConfirmDialog, DrawerShell, Toast, …
    shared/            cross-surface pieces: PageHeader, SectionHeader, StatusBadge, …
    shared/forms/      controlled form bodies reused across drawers/settings/onboarding
    layout/            AppShell, AdminShell, AuthShell, Sidebar, Topbar, PublicNav, AuthGuard
    drawers/           DrawersProvider + Booking/Session/Service/Form/Package drawers
    admin/<area>/      per-area admin views (dashboard, bookings, calendar, clients, …)
    superadmin/        platform views + NewWorkspaceDrawer
    booking/           public booking steps + receipt + legal modal
    public/            landing sections, contact modal, demo guide
    auth/              AuthCard
    i18n/              I18nProvider
  data/mock/           21 JSON fixtures — the entire data set
  i18n/messages/       en.ts (source of truth for keys), tr.ts, de.ts
  lib/                 pure helpers: cn, env, nav, session, status-maps, card, money, time, …
  services/            16 *.service.ts modules — the only path to data
  types/               domain types; index.ts is a partial barrel
```

---

## Architecture

### Data layer — the mock/api switch

Every module in `src/services/` follows one shape:

```ts
let mock: T[] = JSON.parse(JSON.stringify(json)) as T[];   // module-level in-memory copy

export async function listThings(): Promise<T[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listThings");
  await sleep(60);          // simulated latency
  return [...mock];
}
```

- `dataSource` comes from `NEXT_PUBLIC_DATA_SOURCE` via `src/lib/env.ts` and defaults to
  `"mock"`. The `api` branch is deliberately unwritten — every method throws
  `NotImplementedError` until Phase 2 fills it in.
- Mutations persist for the lifetime of the dev process and reset on reload/HMR.
  Cross-reload persistence is not a Phase 1 requirement.
- **Components must go through the service layer.** Importing `src/data/mock/*.json`
  directly from a component is a bug.
- Errors are `NotImplementedError` or `NotFoundError` from `src/services/_errors.ts`;
  components surface `err.message`, usually through `toast.error(...)`.
- Services are self-contained with one exception: `dashboard.service.ts` composes live
  from `listBookings()`, `listSessions()`, and `listActionItems()` to derive its
  "Needs your attention" entries and prepend them to the seeded ones.

Current services: `auth`, `billing`, `bookings`, `client-notes`, `clients`, `dashboard`,
`demo`, `forms`, `notifications`, `packages`, `platform`, `services`,
`session-action-items`, `sessions`, `settings`.

### Auth and session

No real authentication exists. `auth.service.ts` writes a fabricated token to
`localStorage`; `src/lib/session.ts` is the **only** module that touches the
`slotera.session` and `slotera.onboarding` keys. `AuthGuard`
(`src/components/layout/AuthGuard.tsx`) takes an optional `requireRole` and redirects to
`/login?next=…` when there is no session, or to `homePathForRole(session.role)` on a role
mismatch. `homePathForRole()` in `src/lib/nav.ts` is the single source of truth for where
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
`redirects()` in `next.config.ts` — **not** by `page.tsx` bodies calling `redirect()`.
See HISTORY.md for why.

### Providers

Mounted once at the root layout (`src/app/layout.tsx`), so every route group inherits
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

Tailwind v4 with tokens declared in `src/app/globals.css`:

- Semantic colors `paper`, `paper-2`, `ink`/`ink-2`/`ink-3`/`ink-4`, `line`, `line-soft`,
  `surface`, `surface-warm`, `accent` (deep forest green) + `accent-ink`/`accent-soft`/
  `accent-hover`, and `success`/`warning`/`danger`/`info`.
- Shadows `shadow-card` / `shadow-pop` / `shadow-overlay`, with numeric aliases
  `shadow-1` / `shadow-2` / `shadow-3`.
- Heading classes are **`.text-display` / `.text-h1` / `.text-h2` / `.text-h3`** — never
  `.h-1`/`.h-2`/`.h-3`, which Tailwind v4 generates as *height* utilities.
- `src/lib/cn.ts` registers the custom `text-*` typography classes with `tailwind-merge`
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

Hand-rolled, no i18n library. `src/lib/i18n.ts` exposes `Lang = "en" | "tr" | "de"`,
`translate(lang, key, vars?)` with `{name}` interpolation, `localeForLang()` (→ `en-GB`,
`tr-TR`, `de-DE` for `Intl` formatting), and read/write of the `slotera.lang`
`localStorage` key. `src/i18n/messages/en.ts` defines the `Messages` type and is the key
source of truth; `tr.ts` and `de.ts` are `Partial<Messages>` and fall back to English
per-key, then to the key itself.

Coverage is chrome and labels — most demo/mock body copy (provider names, service
descriptions, seeded notes) is English-only by design.

---

## Conventions

- **Path alias** `@/*` → `src/*`. Use it; no deep relative climbs.
- **`"use client"`** is the default for anything importing a service or session helper.
  Server components are limited to static layouts and the landing page.
- **Status presentation** lives in `src/lib/status-maps.ts` (`BOOKING_STATUS`,
  `PAY_STATUS`, `CLIENT_TAGS`, `LOC_TYPE_META`, `SUBSCRIPTION_STATUS`, `INQUIRY_TYPE`,
  `PLAN_LABEL`, `FORM_STATUS`, `PACKAGE_STATUS`). Extend that file; never hardcode a tone
  or label per page.
- **Icons** go through `IconName` in `src/components/ui/Icon.tsx`. Add to the map rather
  than importing from `lucide-react` at a call site.
- **Card inputs** are formatted with `src/lib/card.ts` (`formatCardNumber`,
  `formatCardExpiry`, `formatCardCvc`, `detectCardBrand`, `isValidCardExpiry`). Every
  card form uses these; do not write new formatters.
- **Money** goes through `src/lib/money.ts`; the default currency is **GBP**.
- **IDs** for mock records come from `makeId(prefix)` in `src/lib/id.ts`.
- **`react-hooks/set-state-in-effect` is disabled project-wide** — mount-once data fetches
  and SSR-portal mount flags both legitimately set state in an effect here.
- **Unused vars** are a warning when prefixed `_`; that's the intentional escape hatch for
  Phase 1 stub parameters (`_password`, `_token`).
- **Section-root redirects belong in `next.config.ts`.** Never add a `page.tsx` whose only
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
  `src/lib/register-draft.ts`. Choosing the Custom plan diverts to a persisting contact
  inquiry and creates no account.
- Five-pane onboarding stepper: Welcome → Service → Availability → Payments → Done, reusing
  `ServiceForm`, `WorkingHoursForm`, and `ManualPaymentForm`.

**Operator workspace (`/admin`)**
- Dashboard: KPI tiles, Recharts revenue trend, `NextSessionCard` (with today's timeline
  embedded), `PendingActions`, and a booking-page live/paused toggle in the greeting.
- Calendar: day / week / month grids, conflict warning, session details via `SessionDrawer`.
- Bookings: status accordions (Pending → Confirmed → Completed → No-show → Cancelled),
  a `client` query-param filter with a removable chip, and a focused booking detail page.
- Clients: list + a two-tab detail page (Overview, Notes) with rich-text client notes
  backed by a minimal Tiptap editor.
- Services, Packages (ordered bundles of existing services), Forms (reusable templates
  attached to services), and Settings (Business Profile incl. saved locations, Branding,
  Client Payments, Billing & Subscription, Calendar, Emails, Account).
- Session drawer carries a "Notes & Actions" tab: one internal note plus lightweight
  action items, both admin-only.
- Global search: navbar dropdown + Cmd/Ctrl-K palette over one shared index
  (`src/lib/search.ts`) spanning bookings, clients, services, sessions, and nav.

**Platform workspace (`/superadmin`)**
- Overview KPIs, workspaces list + detail, subscriptions, and an inquiries **inbox**
  (read/unread only — no ticket statuses) with a preview modal that can promote a business
  inquiry into a provisioned workspace.

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

The Phase 2/3 planning summary was updated on 2026-07-26. That update changed
documentation only; the current application state and verification snapshot above still
refer to commit `8b80465`.
