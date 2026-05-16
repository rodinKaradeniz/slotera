# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # next dev (defaults to port 3000; this workspace commonly uses PORT=3344 npm run dev)
npm run build    # next build
npm run start    # next start (after build)
npm run lint     # eslint (config: eslint.config.mjs)
npx tsc --noEmit # TypeScript check; tsconfig has noEmit:true so this is the type-check command
```

No test runner is configured.

## Architecture

Slotera is a Next.js 16 App Router app for individual service providers (consultants/coaches) to manage paid bookings. It is currently a **frontend-only prototype**: there is no backend, no database, no API routes. All data flows through a mock data layer keyed off the `NEXT_PUBLIC_DATA_SOURCE` env var.

### Data layer — mock vs api switch

Every service in `src/services/*.service.ts` follows the same pattern:

```ts
if (dataSource !== "mock") throw new NotImplementedError("methodName");
await sleep(N);                 // simulated latency
return ...                      // returns from / mutates an in-memory copy of src/data/mock/*.json
```

`dataSource` is read from `NEXT_PUBLIC_DATA_SOURCE` in `src/lib/env.ts` (defaults to `"mock"`). When the real API exists, each service method needs an `else` branch that calls `apiBaseUrl`. **The mock state lives in module-level `let mock = JSON.parse(JSON.stringify(json))` arrays** — mutations persist for the lifetime of the dev process but reset on reload/HMR.

Services are plain async functions imported directly by client components; there is no React Query / SWR / data-fetching abstraction. Components do `useEffect(() => { service.list().then(setState) }, [])` directly.

### Auth and session

There is no real auth. `src/services/auth.service.ts` writes a fake token to `localStorage` under `slotera.session`; `src/lib/session.ts` is the only place that touches that key. `AuthGuard` (`src/components/layout/AuthGuard.tsx`) gates the `(admin)` route group by reading `currentSession()` in an effect and redirecting to `/login?next=...` if absent — so admin pages flash a skeleton on first paint, not server-rendered.

### Route groups

`src/app` uses three Next.js route groups, each with its own layout and shell:

- `(public)` — marketing landing + the public booking flow (`/booking`, `/booking/confirmation`, `/booking/failure`). No auth.
- `(auth)` — `/login`, `/register`, `/forgot-password`, `/reset-password`, `/onboarding`. Uses `AuthShell`.
- `(admin)` — everything under `/admin/*`. Wrapped by `AuthGuard` + `DrawersProvider`. Uses `AdminShell` (sidebar + topbar). `/admin` itself just `redirect()`s to `/admin/dashboard`.

### Drawers are global

Admin pages don't render `BookingDrawer`/`SessionDrawer`/`ServiceDrawer` inline. `DrawersProvider` (mounted once in the `(admin)` layout) holds drawer state; pages call `useDrawers().openBookingDrawer({...})` to open them. Only one drawer can be open at a time. When adding edit/create flows in admin, prefer extending this provider over adding new local modals.

### Styling system

Tailwind v4 with design tokens defined in `src/app/globals.css` via `@theme inline { --color-*: ... }`. Custom semantic colors: `paper`, `paper-2`, `ink`/`ink-2/3/4`, `line`, `accent` (forest green), `surface`. Shadows are `shadow-card`/`shadow-pop`/`shadow-overlay` (numeric aliases `shadow-1/2/3` also exist).

**Heading classes are `.text-display` / `.text-h1` / `.text-h2` / `.text-h3`, NOT `.h-1`.** Tailwind v4 generates `.h-1`/`.h-2`/`.h-3` as height utilities (0.25rem, 0.5rem, 0.75rem) which silently collapses heading boxes — this is documented in `globals.css` itself.

`src/lib/cn.ts` extends `tailwind-merge` so that the custom typography classes register as the `font-size` group; without this, `cn("text-h1", "text-ink")` would dedupe down to just `text-ink` and every heading would lose its class. Always use `cn(...)` (not raw `clsx`) when composing classes that include the custom `text-*` typography utilities.

Fonts are loaded in `src/app/layout.tsx` via `next/font/google`: Fraunces (serif/display), Inter Tight (sans), JetBrains Mono — exposed as `--font-serif`/`--font-sans`/`--font-mono`.

### Conventions

- Path alias `@/*` → `src/*`.
- `"use client"` is the default for anything that imports services or session; the only server components are static admin/auth/public layouts and the landing page.
- Errors thrown by services are either `NotImplementedError` (api branch not built) or `NotFoundError` (`src/services/_errors.ts`); components generally surface `error.message` directly.
- The eslint config disables `react-hooks/set-state-in-effect` project-wide — mount-once data fetches and SSR-portal mount flags both legitimately setState in effects here.
