# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

Slotera is a paid reservation and session-management product for **individual** service providers (consultants, coaches, instructors, workshop hosts). The current build is a frontend-only Next.js prototype intended for portfolio/client demos — not production.

### Phase scope (important)

**Phase 1 — now.** Next.js + TypeScript + Tailwind + mock JSON only. No backend, no real auth, no Stripe, no email provider, no Google Calendar/Meet. Local component state is fine; persistence across reload is not a requirement. Do not add any of those integrations unless explicitly asked.

**Phase 2 — later.** FastAPI + PostgreSQL + Docker Compose backend. The mock/api switch in `src/lib/env.ts` exists for this transition (see Data layer below).

**Phase 3 — later.** Stripe Checkout + webhooks, Resend/Postmark email, Google Calendar/Meet. Forward-looking rule worth remembering when modelling booking flows: **a booking should only become `confirmed` after a payment webhook fires, never just because the user landed on the success page.** The current mock flow flips to confirmed on the success route; that is acceptable for Phase 1 but should not be hardened into business logic that survives into Phase 2/3.

## Domain terminology

Use these terms consistently in code, types, and copy:

- **Service** — the template the operator offers (name, description, duration, price, capacity, location type). Examples: "Strategy Call", "Yoga Class".
- **Session** — a scheduled occurrence of a service (date, time, capacity, booked count, status, location).
- **Booking** — a client's reservation for a session. One session can have many bookings when `capacity > 1`.
- **Capacity** — `1` is a 1:1 appointment; `>1` is a group/class/workshop. **Do not branch logic on a separate "1:1 vs group" service type — branch on capacity.** Group sessions are not a distinct entity.

Customers do not have accounts; only the operator/admin authenticates. Overlapping sessions on the same operator's calendar must be treated as a conflict (see `src/components/shared/ConflictWarning.tsx`).

## Commands

```bash
npm run dev      # next dev (defaults to port 3000; PORT=3344 npm run dev is the convention here)
npm run build    # next build
npm run start    # next start (after build)
npm run lint     # eslint (config: eslint.config.mjs)
npx tsc --noEmit # type-check; tsconfig has noEmit:true so this is the type-check command
```

No test runner is configured.

## Architecture

### Data layer — mock vs api switch

Every service in `src/services/*.service.ts` follows the same pattern:

```ts
if (dataSource !== "mock") throw new NotImplementedError("methodName");
await sleep(N);                 // simulated latency
return ...                      // returns from / mutates an in-memory copy of src/data/mock/*.json
```

`dataSource` is read from `NEXT_PUBLIC_DATA_SOURCE` in `src/lib/env.ts` (defaults to `"mock"`). When the Phase 2 API exists, each service method needs an `else` branch that calls `apiBaseUrl`. **The mock state lives in module-level `let mock = JSON.parse(JSON.stringify(json))` arrays** — mutations persist for the lifetime of the dev process but reset on reload/HMR. Components must go through the service layer; never import `src/data/mock/*.json` directly from a component.

### Auth and session

There is no real auth. `src/services/auth.service.ts` writes a fake token to `localStorage` under `slotera.session`; `src/lib/session.ts` is the only place that touches that key. `AuthGuard` (`src/components/layout/AuthGuard.tsx`) gates the `(admin)` route group by reading `currentSession()` in an effect and redirecting to `/login?next=...` if absent — so admin pages flash a skeleton on first paint, not server-rendered.

### Route groups

`src/app` uses three Next.js route groups, each with its own layout and shell:

- `(public)` — marketing landing + the public booking flow (`/booking`, `/booking/confirmation`, `/booking/failure`). No auth.
- `(auth)` — `/login`, `/register`, `/forgot-password`, `/reset-password`, `/onboarding`. Uses `AuthShell`.
- `(admin)` — everything under `/admin/*`. Wrapped by `AuthGuard` + `DrawersProvider`. Uses `AdminShell` (sidebar + topbar). `/admin` itself just `redirect()`s to `/admin/dashboard`.

### Drawers are global

Admin pages don't render `BookingDrawer`/`SessionDrawer`/`ServiceDrawer` inline. `DrawersProvider` (mounted once in the `(admin)` layout) holds drawer state; pages call `useDrawers().openBookingDrawer({...})` to open them. Only one drawer can be open at a time. When adding edit/create flows in admin, prefer extending this provider over adding new local modals. On mobile the same drawer renders as a bottom sheet — don't fork into a separate mobile dialog.

### Styling system

Tailwind v4 with design tokens defined in `src/app/globals.css` via `@theme inline { --color-*: ... }`. Custom semantic colors: `paper`, `paper-2`, `ink`/`ink-2/3/4`, `line`, `accent` (forest green), `surface`. Shadows are `shadow-card`/`shadow-pop`/`shadow-overlay` (numeric aliases `shadow-1/2/3` also exist).

**Heading classes are `.text-display` / `.text-h1` / `.text-h2` / `.text-h3`, NOT `.h-1`.** Tailwind v4 generates `.h-1`/`.h-2`/`.h-3` as height utilities (0.25rem, 0.5rem, 0.75rem) which silently collapses heading boxes — this is documented in `globals.css` itself.

`src/lib/cn.ts` extends `tailwind-merge` so that the custom typography classes register as the `font-size` group; without this, `cn("text-h1", "text-ink")` would dedupe down to just `text-ink` and every heading would lose its class. Always use `cn(...)` (not raw `clsx`) when composing classes that include the custom `text-*` typography utilities.

**Element-selector resets must be wrapped in `@layer base`.** In Tailwind v4, unlayered rules win over any layered rule regardless of specificity — so a bare `button { color: inherit }` in `globals.css` will silently override `.text-white` (which lives in `@layer utilities`) and primary buttons end up inheriting the dark page ink. The button/input/textarea/select/a resets in `globals.css` are wrapped in `@layer base` for exactly this reason.

Fonts are loaded in `src/app/layout.tsx` via `next/font/google`: Fraunces (serif/display), Inter Tight (sans), JetBrains Mono — exposed as `--font-serif`/`--font-sans`/`--font-mono`.

### Design philosophy: fix primitives, not pages

The visual target is the Claude Design handoff (warm cream paper, deep forest green accent, generous spacing, no enterprise density). When something looks wrong on multiple pages — overlapping section titles, inconsistent gaps, mismatched header treatments — **fix the shared primitive** (`PageHeader`, `SectionHeader`, `Card`, `AdminShell`, the typography classes, drawer base) rather than patching each page. Avoid negative margins, absolute positioning for layout, and fixed heights that cause overlap; reach for the standard pattern instead:

```tsx
<div className="space-y-6">
  <PageHeader />
  <section className="space-y-4">
    <SectionHeader />
    <Card>...</Card>
  </section>
</div>
```

### Conventions

- Path alias `@/*` → `src/*`.
- `"use client"` is the default for anything that imports services or session; the only server components are static admin/auth/public layouts and the landing page.
- Errors thrown by services are either `NotImplementedError` (api branch not built) or `NotFoundError` (`src/services/_errors.ts`); components generally surface `error.message` directly.
- The eslint config disables `react-hooks/set-state-in-effect` project-wide — mount-once data fetches and SSR-portal mount flags both legitimately setState in effects here.
- Status badge / payment-status mappings live in `src/lib/status-maps.ts` — extend that file rather than re-deriving colors per page.
