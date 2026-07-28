# Slotera — Product Rules

This document is the **product rulebook**: positioning, domain vocabulary, per-surface
product rules, and the standing "never reintroduce X" list. It answers *what the product
must be*. It is authoritative on product rules — if another document disagrees about one,
this file wins and the mismatch should be flagged.

Read the relevant section before changing any user-facing surface, adding a field to a
domain type, or writing copy.

Companion documents cover the other lanes:

- **`AGENTS.md`** (root) — current state and entry point: repository layout, stack, how to
  run it locally, conventions, and a snapshot of what's implemented. Read it first.
- **`docs/HISTORY.md`** — decisions, rationale, rejected alternatives, and framework-level
  bug catches. Read before changing something that looks arbitrary.
- **`docs/TODO.md`** — deferred work, known gaps, and future directions. Read when planning.
- **`docs/RULES.md`** — always-on working conventions. Applies to every task.

## Product

Slotera is a paid booking and session-management product for **individual** service providers (consultants, coaches, instructors, workshop hosts). The default/public product experience is a mock-backed Next.js prototype intended for portfolio/client demos — not production. An opt-in local API mode now connects the first operator bundle to the local backend without changing that deployment boundary.

### Positioning / first ICP (important)

Slotera's **first ICP is independent consultants, coaches, instructors, and small expert-led studios/workshops.** Default public positioning: *"a lightweight client workspace for independent consultants, coaches, and instructors — paid bookings, prep forms, packages, and follow-up."* Themes to lead with: paid bookings, client intake/prep forms, packages, session management, client context/notes and follow-up, the customer booking page, manual/card payment readiness, the multilingual booking experience, and a lightweight admin workspace — explicitly **not a heavy CRM, not a generic calendar-only tool, and not a generic "reservation app."** Frame Slotera as a *lightweight client workspace*, not a reservation/appointment app. Avoid medical/clinical/patient wording unless a specialized demo is explicitly added later.

- The **underlying product model stays generic and flexible** (services, sessions, bookings, forms, payments, clients, calendar, settings, customer booking page). Don't hardcode a vertical into the data model — refine *positioning and defaults*, not architecture. See the "**No `type` field, ever**" rule under Services.
- **Public/default surfaces should not try to speak to every vertical at once.** The standard `/booking` default and the public Demo Guide lead with consultant/coach/instructor. Specialised verticals (vet, therapist) may exist as flexible mock examples but are **not** promoted in the public positioning.
- **Never claim Slotera is veterinary-clinic software, therapy practice-management software, healthcare software, or a medical-records/patient-management system. No medical/clinical/compliance claims.** Keep privacy/legal wording soft ("UK GDPR-aware", never "GDPR compliant" — see Landing copy).
- Prefer non-clinical language: *client intake, pre-session questions, booking forms, session prep, client notes, customer booking page.*
- **Standard `/booking` default story** is the curated consultant/coach/instructor set in `STANDARD_BOOKING_SERVICE_IDS` (`web/src/services/demo.service.ts`) — Discovery Call, Strategy Session, Coaching Session, Group Workshop. Keep it focused (3–5 services, 4 is the sweet spot) and curate it in the **resolver/data**, never via render-time slicing. Persona demos (`?demo=<slug>`) and the admin Services list can carry richer sets.
- **Demo Guide personas** (`DemoGuidelinesModal.tsx` + `demo-personas.json`) lead with `consultant`, `coach`, `instructor`. Adjust labels/order/copy here freely; if reintroducing vet/therapist demos, keep them secondary and out of the main public pitch.

### Phase scope (important)

**Phase 1 — default frontend/demo.** Next.js + TypeScript + Tailwind + mock JSON only. No
real auth, Stripe, email provider, or Google Calendar/Meet reaches the public/Vercel
environment. Local component state is fine; persistence across reload is not a
requirement. Phase 2's explicit local `api` mode is separate from this demo contract.

**Phase 2 — underway, local-only first.** Build a Python/FastAPI modular monolith with
PostgreSQL, SQLAlchemy, Alembic, and Docker Compose under `server/`. The infrastructure
foundation, identity/tenancy persistence, backend auth/session, business settings, saved
locations, services, the structured notification baseline, generated OpenAPI transport
types, and the first coherent operator frontend wiring exist.
The
public portfolio/demo deployment stays mock-backed; the API is developed and exercised in
a separate local/API environment. Real public bookings include durable transactional
confirmation + booking-workspace magic-link email through a PostgreSQL outbox worker.
Hosting is deliberately undecided (Railway is a later candidate, not a current dependency).
The mock/api switch in `web/src/lib/env.ts` remains the transition seam (see Data layer below).

**Phase 3 — later and deliberately de-prioritised.** Stripe connected-account onboarding,
Checkout/Elements + webhooks, advanced email reminders/follow-ups, and Google
Calendar/Meet arrive only after identity, tenancy, scheduling, tracking, free/manual
booking, and the booking workspace work reliably. Forward-looking rule worth remembering
when modelling card flows: **a card-funded booking should only become `confirmed` after a
verified payment webhook fires, never just because the user landed on the success page.**
The current mock flow flips to confirmed on the success route; that is acceptable for
Phase 1 but must not survive into the real system.

## Domain terminology

Use these terms consistently in code, types, and copy:

- **Service** — the template the operator offers (name, description, duration, price, capacity, location type, booking mode, optional default address, optional internal notes). Examples: "Strategy Call", "Yoga Class".
- **Session** — a scheduled occurrence of a service (date, time, capacity, booked count, status, location, optional address, optional internal notes).
- **Booking** — a client's booked place in a session. One session can have many bookings when `capacity > 1`. Bookings carry optional `attendance` (`"present" | "late" | "absent"`) recorded post-session.
- **Capacity** — `1` is a 1:1 appointment; `>1` is a group/class/workshop. **Do not branch logic on a separate "1:1 vs group" service type — branch on capacity.** Group sessions are not a distinct entity.
- **Booking mode** — `service.bookingMode: "open" | "scheduled"` controls *how* a service is booked. **This is not a service category — never reintroduce a `type` enum like "consulting / yoga / workshop".** `open` = generate slots from working hours (consultations, drop-in classes); `scheduled` = operator pre-creates sessions, clients pick from the list (workshops, courses).
- **Address** — structured postal address (`Address` type, ISO-3166-1 alpha-2 country code). Operators save named places as `WorkspaceLocation`s under Settings → Business Profile and attach them to services (as defaults) and to sessions (as one-off overrides).
- **Workspace** — one operator + their settings + their data. The `(superadmin)` views manage all workspaces from a platform perspective.
- **Workspace currency** — one client-payment currency per workspace. The initial backend
  default is **EUR**; services and packages inherit it, while bookings/payments snapshot
  it. The Phase 1 mock remains GBP until its deliberate frontend/data migration. Platform
  billing is a separate payment domain and does not share this invariant accidentally.
- **Roles** — `UserRole = "operator_admin" | "superadmin"`. Customers don't have accounts; only operators/admins authenticate. Overlapping sessions on the same operator's calendar must be treated as a conflict (see `web/src/components/shared/ConflictWarning.tsx`).

## Commands

Run frontend commands from `web/`:

```bash
npm run dev      # next dev (defaults to port 3000; PORT=3344 npm run dev is the convention here)
npm run build    # next build
npm run start    # next start (after build)
npm run lint     # eslint (config: web/eslint.config.mjs)
npx tsc --noEmit # type-check; tsconfig has noEmit:true so this is the type-check command
```

No test runner is configured.

## Architecture

### Data layer — mock vs api switch

Every service in `web/src/services/*.service.ts` keeps mock and API behavior behind one
component-facing contract. An unwired API branch follows this explicit pattern:

```ts
if (dataSource !== "mock") throw new NotImplementedError("methodName");
await sleep(N);                 // simulated latency
return ...                      // returns from / mutates an in-memory copy of web/src/data/mock/*.json
```

`dataSource` is read from `NEXT_PUBLIC_DATA_SOURCE` in `web/src/lib/env.ts` (defaults to `"mock"`). The first API bundle implements auth/session, business settings, saved locations, services, and notifications through `web/src/api/client.ts`; every other API branch still throws explicitly. There is no automatic API→mock fallback. **The mock state lives in module-level `let mock = JSON.parse(JSON.stringify(json))` arrays** — mutations persist for the lifetime of the dev process but reset on reload/HMR. Components must go through the service layer; never import `web/src/data/mock/*.json` directly from a component.

`getDashboard()` is the only service that composes from other services live: it imports `listBookings()` and `listSessions()` to compute the "Record attendance for N sessions" pending action and prepend it to the seeded `pendingActions`. Other services should stay self-contained unless they need similar live-derived state.

### Auth and session

Mock mode writes a fake token to `localStorage` under `slotera.session`. Local API mode
uses the backend's HttpOnly session cookie, restores the verified session through
`GET /auth/session`, and sends the readable CSRF cookie on unsafe requests.
`web/src/lib/session.ts` remains the only place that touches the local UI snapshot key.
`AuthGuard` (`web/src/components/layout/AuthGuard.tsx`) accepts an optional `requireRole`
prop and:
- redirects to `/login?next=...` when no session,
- redirects to `homePathForRole(session.role)` when the role mismatches (so an operator hitting `/superadmin/*` lands back on `/admin/dashboard`).

`homePathForRole()` lives in `web/src/lib/nav.ts` and is the single source of truth for where each role goes home.

### Route groups

`web/src/app` uses four Next.js route groups, each with its own layout and shell:

- `(public)` — marketing landing + the public booking flow (`/booking`, `/booking/confirmation`, `/booking/failure`). No auth.
- `(auth)` — `/login`, `/register`, `/register/plan`, `/register/payment`, `/forgot-password`, `/reset-password`, `/onboarding`. Uses `AuthShell`. Size is set by pathname in `(auth)/layout.tsx` (`/onboarding` → wide, `/register*` → medium, others → default).
- `(admin)` — everything under `/admin/*`. Wrapped by `AuthGuard requireRole="operator_admin"` + `DrawersProvider`. Uses `AdminShell` (sidebar + topbar).
- `(superadmin)` — everything under `/superadmin/*`. Wrapped by `AuthGuard requireRole="superadmin"`. Uses the same `AppShell` as admin but with the platform nav from `SUPERADMIN_NAV` in `web/src/lib/nav.ts`.

`/admin` → `/admin/dashboard` and `/superadmin` → `/superadmin/overview` are handled by `redirects()` in `web/next.config.ts`, not by `redirect()` page bodies — Next 16 + Turbopack tripped a Performance.measure race on the page-body pattern. **Never reintroduce `page.tsx` files at the root of a route segment whose only job is to call `redirect()`.** Add a config redirect instead.

### Drawers are global (admin only)

Admin pages don't render `BookingDrawer`/`SessionDrawer`/`ServiceDrawer` inline. `DrawersProvider` (mounted once in the `(admin)` layout) holds drawer state; pages call `useDrawers().openBookingDrawer({...})` to open them. Only one drawer can be open at a time. When adding edit/create flows in admin, prefer extending this provider over adding new local modals. On mobile the same drawer renders as a bottom sheet — don't fork into a separate mobile dialog.

`(superadmin)` does NOT use `DrawersProvider`. Its only drawer (`NewWorkspaceDrawer`) is mounted locally per view because the usage is narrow. If a second superadmin drawer ever appears, that's the moment to introduce `SuperadminDrawersProvider`.

### Toasts are global

`ToastProvider` is mounted once at the root layout (`web/src/app/layout.tsx`) so every route group inherits it via context. Use `const { toast } = useToast()` from any client component and call `toast.success(msg, { description? })` / `toast.error(...)` / `toast.info(...)`. Auto-dismiss is 3.5s; stack is top-right. Animations are gated on `prefers-reduced-motion`. **Never reach for `window.alert()` or `window.confirm()` — use a toast for ambient feedback or `ConfirmDialog` for blocking confirmation.**

### Styling system

Tailwind v4 with design tokens defined in `web/src/app/globals.css` via `@theme inline { --color-*: ... }`. Custom semantic colors: `paper`, `paper-2`, `ink`/`ink-2/3/4`, `line`, `accent` (forest green), `surface`. Shadows are `shadow-card`/`shadow-pop`/`shadow-overlay` (numeric aliases `shadow-1/2/3` also exist).

**Heading classes are `.text-display` / `.text-h1` / `.text-h2` / `.text-h3`, NOT `.h-1`.** Tailwind v4 generates `.h-1`/`.h-2`/`.h-3` as height utilities (0.25rem, 0.5rem, 0.75rem) which silently collapses heading boxes — this is documented in `globals.css` itself.

`web/src/lib/cn.ts` extends `tailwind-merge` so that the custom typography classes register as the `font-size` group; without this, `cn("text-h1", "text-ink")` would dedupe down to just `text-ink` and every heading would lose its class. Always use `cn(...)` (not raw `clsx`) when composing classes that include the custom `text-*` typography utilities.

**Element-selector resets must be wrapped in `@layer base`.** In Tailwind v4, unlayered rules win over any layered rule regardless of specificity — so a bare `button { color: inherit }` in `globals.css` will silently override `.text-white` (which lives in `@layer utilities`) and primary buttons end up inheriting the dark page ink. The button/input/textarea/select/a resets in `globals.css` are wrapped in `@layer base` for exactly this reason.

Fonts are loaded in `web/src/app/layout.tsx` via `next/font/google`: Fraunces (serif/display), Inter Tight (sans), JetBrains Mono — exposed as `--font-serif`/`--font-sans`/`--font-mono`.

`<html>` carries `data-scroll-behavior="smooth"` so Next 16 can suppress smooth scrolling during route transitions; don't remove it.

### Design philosophy: fix primitives, not pages

The visual target is the Claude Design handoff (warm cream paper, deep forest green accent, generous spacing, no enterprise density). When something looks wrong on multiple pages — overlapping section titles, inconsistent gaps, mismatched header treatments — **fix the shared primitive** (`PageHeader`, `SectionHeader`, `Card`, `AdminShell`, the typography classes, drawer base, the shared form components) rather than patching each page. Avoid negative margins, absolute positioning for layout, and fixed heights that cause overlap; reach for the standard pattern instead:

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

- Path alias `@/*` → `web/src/*`.
- `"use client"` is the default for anything that imports services or session; the only server components are static admin/auth/public layouts and the landing page.
- Service errors are `NotImplementedError` (API branch not built), `NotFoundError` (mock
  resource missing), or `ApiRequestError` (status/code/request id/details from the backend
  envelope); components generally surface `error.message`, usually through a toast.
- The eslint config disables `react-hooks/set-state-in-effect` project-wide — mount-once data fetches and SSR-portal mount flags both legitimately setState in effects here.
- Status badge / payment-status mappings live in `web/src/lib/status-maps.ts` — extend that file rather than re-deriving colors per page.

---

## Product surfaces & rules

The sections below capture decisions that go beyond the code's structure — what's been built, what's deliberately *not* there, and what the planning agent should preserve when extending.

### Services

- **No `type` field, ever.** A service is defined by name, description, duration, price, capacity, location type, booking mode, optional default address, active state, and optional internal notes. Do not reintroduce service-type fields, filters, badges, color stripes, or hardcoded categories. If grouping is needed later, add a flexible tag/category system intentionally.
- **Allowed service filters:** search, active/inactive status, location type. (The Services page currently has no filter UI; when filters are added, restrict to these three.)
- **`bookingMode: "open" | "scheduled"`** is a booking *mechanic*, not a category — see Domain terminology above. Do not branch UI on it the way you would on a category enum.
- **Default address** — when `locationType` is physical/hybrid, a service can carry an `address?: Address` which is the default inherited by new sessions of that service. The session can override. Switching the chosen service in `SessionDrawer` re-inherits the new service's address.
- **Internal notes** — `service.notes`, displayed only to the operator. Prep instructions, materials, context. Never shown to clients.
- **Currency migration rule.** Phase 1 keeps `Service.currency` because that is the current
  mock shape. In the real data model currency belongs to the workspace; service API DTOs
  may include the inherited value for display, but the service row does not become an
  independent currency source.
- **Curated mock set.** `web/src/data/mock/services.json` is intentionally small and ICP-aligned: 4 active (Discovery Call, Strategy Session, Coaching Session, Group Workshop) + 1 inactive (Monthly Office Hours). Group Workshop is the only `capacity > 1` service and carries the group/attendance/calendar story. Don't re-add broad profession-specific services (yoga/vet/therapy/trainer) unless explicitly reintroduced.

### Payment domains

Slotera has two completely separate payment domains. Keep them separate in code, UI, mock data, and naming.

| Domain | What it means | Settings section |
|---|---|---|
| **Client payments** | How clients pay the operator (card mock + manual instructions). | Settings → Client Payments |
| **Platform billing** | How the operator pays Slotera (Solo/Team/Custom plans, trial, invoices, card on file). | Settings → Billing & Subscription |

**`PaymentMethod = "card" | "manual"`**. PayPal was removed everywhere and should not be reintroduced. SEPA was removed and should stay removed.

**Stripe fee notice (operator-facing only).** Onboarding's Payments step and Settings → Client Payments → Payment Processors each render a small `bg-paper-2` info banner near the Stripe/card setup, explaining that Stripe-powered payments may include processing fees. Never show this banner to the public client (booking flow). No fee math, no real Stripe.

**Provider booking terms.** `payments.bookingTerms: { enabled, content }` lives next to `manualPaymentEnabled` in the settings shape. Operators edit it in Settings → Client Payments → Booking Terms. It surfaces to clients on the **Provider Booking Terms** tab of the public booking flow's `LegalModal`. These are the operator's *own* terms — distinct from Slotera's platform terms/privacy (the modal's second tab).

### Manual payment instructions

Manual payment instructions are **global** workspace-level settings, not per-service. Use the wording: *Manual payment*, *Payment instructions*, *Manual payment instructions*. Examples: "Bank transfer to this account: …", "Interac transfer to this email: …".

```ts
// web/src/types/settings.ts
payments: {
  manualPaymentEnabled: boolean;
  manualPaymentInstructions: string;
  defaultPaymentMethods: PaymentMethod[];
  // ... plus processors[], taxRate, vatNumber
};
```

They appear in: the public booking payment step, the receipt/pay summary when manual is selected, Settings → Client Payments, and the onboarding payments step.

### Platform billing / subscription (operator-side)

Mocked SaaS subscription. Settings → Billing & Subscription shows: current plan, status pill, billing cycle, trial end / next billing date, team-member usage, payment method card, invoice history, change plan, cancel/reactivate. Defaults: currency **GBP**, Solo £20/mo, Team £50/mo (10 members), Custom is negotiated.

```ts
type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancel_scheduled"
  | "cancelled";
```

Mock files: `web/src/data/mock/plans.json`, `subscription.json`, `invoices.json`. Service: `web/src/services/billing.service.ts` exporting `listPlans()`, `getSubscription()`, `changePlan(planId, cycle)`, `cancelSubscription()`, `reactivateSubscription()`, `listInvoices()`, `updateMockPaymentMethod(input)`, `setSubscriptionStatus(status)`. **Keep this mocked in Phase 1; no real Stripe Billing yet.**

**Change-plan → Custom diverts to contact.** Picking the Custom card in the Change-plan modal does NOT call `changePlan()` — it opens the persisting `ContactModal` (`persist`-mode) pre-filled with the operator's name/email and reason `business`. The submission lands in `/superadmin/inquiries` where staff can promote it to a manually-onboarded Custom workspace. The current subscription is unchanged until the contact is followed up.

### Superadmin area

Slotera has a separate mocked superadmin area at `/superadmin/*` for internal/platform management. **Do not mix operator-admin and superadmin navigation into one visible sidebar.** Both share the shell components (`AppShell`, `Sidebar`, `Topbar`) but with separate `OPERATOR_NAV` / `SUPERADMIN_NAV` in `web/src/lib/nav.ts` and separate mental models.

Routes:

| Operator (`/admin/*`) | Superadmin (`/superadmin/*`) |
|---|---|
| dashboard, calendar, bookings, clients, services, packages, forms, settings | overview, workspaces, workspaces/[id], subscriptions, inquiries, settings |

Mock auth routes by role via `homePathForRole()`. `/superadmin/*` is protected by `AuthGuard requireRole="superadmin"`.

Mock files under `web/src/data/mock/`: `platform-workspaces.json`, `platform-subscriptions.json`, `platform-inquiries.json`, `platform-overview.json`. **Everything platform-side lives in `web/src/services/platform.service.ts`** — workspaces, subscriptions, and inquiries together. There is no separate `platform-billing.service.ts`; both share `setSubscriptionStatus` (with different semantics from `billing.service.ts`'s same-name method — different import sites).

`createInquiry()` powers the Custom-plan persist flow. `createWorkspace()` provisions a workspace + matching `PlatformSubscription` in one call; used by the `NewWorkspaceDrawer` (the "New workspace" button on `/superadmin/workspaces` and the "Promote to workspace" action surfaced inside the inquiry preview modal). Real impersonation is not implemented; "View as operator" is a placeholder that fires `toast.info(...)`.

**Inquiries are an inbox, not a ticketing system.** `PlatformInquiry` carries a single `read: boolean` field — no `new | in_review | resolved` enum, no per-row status dropdowns or badges. `INQUIRY_STATUS` no longer exists in `web/src/lib/status-maps.ts`; only `INQUIRY_TYPE` remains. Rows on `/superadmin/inquiries` are slim and single-line: a small accent dot + warm tint marks unread; columns are `name+email · type pill · truncated 1-line message · date (right-aligned)`. Click a row to open the preview modal which auto-marks read on open, lets the operator flip back to unread, and surfaces **"Promote to workspace"** only for `type === "business"` inquiries (which forwards into `NewWorkspaceDrawer`). The `setInquiryRead(id, read)` service method (renamed from the previous `setInquiryStatus`) is the only mutation. `PlatformOverview.totals.openInquiries` is kept as the JSON field name but now semantically means "unread" — the overview KPI label is **"Unread inquiries"**.

### Auth / Register flow

Customers do not have accounts. Only operators authenticate. Public navbar uses **"Log in"** for the action label, not "Login".

Registration is now a three-route flow that defers account creation until after payment:

```
/register             account form  → writeRegisterDraft → /register/plan
/register/plan        plan picker
  ├─ Solo or Team     write planId+cycle → /register/payment
  └─ Custom           opens persisting ContactModal → inquiry created, NO account
/register/payment     mock card form → register() + changePlan() + updateMockPaymentMethod()
                                      → clear draft → /onboarding
```

The form data lives in `slotera.register.draft` (sessionStorage) until either:
- payment succeeds — draft is cleared, account is created, plan + card persisted, lands on `/onboarding`; or
- the user picks Custom — draft stays, no account created, contact inquiry persisted. Helpers live in `web/src/lib/register-draft.ts`.

Register form fields: title (Dr./Mr./Ms./Mrs./Mx./Prof./Other), name(s), last name, email, password, confirm password (frontend-only validation), workspace name, what-do-you-offer dropdown. **Use the first word of `firstNames` in the dashboard greeting** (e.g. "Lena Maria" → "Welcome back, Lena"). Full display name composes title + names + last name (e.g. "Dr. Lena Maria Hartmann").

### Onboarding

Onboarding is a five-pane linear stepper in `/onboarding`:

```
0. Welcome      — intro + bullet list of upcoming steps + "Get started"
1. Service      — inline ServiceForm (showActiveToggle=false)
2. Availability — inline WorkingHoursForm
3. Payments     — two-card layout: Stripe (mock) connect + ManualPaymentForm
4. Done         — share booking page CTA + "Go to dashboard"
```

"Skip for now" exits to `/admin/dashboard` at any point. The page is currently in **visual-testing mode** — it always starts at step 0 regardless of completion. The original resume-from-first-incomplete-step logic is kept around as the `resumeStep()` helper at the bottom of the file behind an eslint-disable, plus a commented-out call site. Flip those two lines back on when you want the real resume behavior.

Step 1's button reads **"Add and continue"** unconditionally — no "Add another" variant. Don't auto-mark Step 1 done when Step 2 is marked done. Step completion is data-derived from existing services + settings (not from a checklist of clicks).

### Global search

Two surfaces share the same index:

- Inline navbar dropdown (`web/src/components/admin/search/NavbarSearch.tsx`)
- Command-K palette (`web/src/components/admin/search/CommandPalette.tsx`)

Both consume `useSearch()` from `web/src/lib/search.ts` which indexes bookings, clients, services, sessions, and a fixed nav list. Cmd/Ctrl+K is wired in `AppShell`. **No separate search results page in Phase 1.** Keep search mocked and frontend-only.

### Contact feature

`web/src/components/public/ContactModal.tsx` is the single contact form. Default behavior is mocked-success-only (no persistence, no email), used from landing/footer/demo guide/paused-booking-page. Pass `persist={true}` for paths where the submission should land as a `PlatformInquiry` in superadmin — the Custom-plan registration flow (`/register/plan`) and the Custom-plan upgrade flow (Settings → Billing → Change plan → Custom) both use this.

Optional pre-fill props: `presetName`, `presetEmail`, `presetMessage`, `defaultReason`, plus `eyebrow` / `title` / `description` overrides. The title uses the prominent eyebrow + large-serif pattern shared with `DemoGuidelinesModal`. Four reason types only (`business / development / feature / general`) — do not add more.

Avoid nested-modal artifacts: when opening contact from another modal, close the parent first.

### Demo guide modal

Public demo guide explains Slotera is a demo, sets data-is-mocked expectations, and guides visitors to: create a demo account → admin dashboard → booking flow. **Do not promote the superadmin workflow in the public demo modal.** The footer invites contact for bugs, requests, or business inquiries — through the same `ContactModal` (non-persisting). **Do not change the auto-open/sessionStorage behavior unless explicitly asked.**

### Landing / public copy

- **Phase 1 mock: GBP. Phase 2 real-data target: EUR.** This is a recorded transition, not
  permission to mix currencies inside one workspace. Change the frontend fixtures,
  formatters/defaults, and copy together when the API-backed surface is implemented.
- **"UK GDPR-aware"** wording (or "Built with UK data protection workflows in mind"). Never claim "GDPR compliant".
- Smooth anchor scrolling for `#features` / `#pricing` / `#faq` works via `<html data-scroll-behavior="smooth">` plus `globals.css`.
- Hero collage is desktop/tablet only mini-UI cards — hide or simplify on mobile.
- **Company-behind-Slotera is `Velora Labs`** — a mock legal entity. Slotera is the product brand and stays unchanged across the UI; Velora Labs only appears in the footer copyright (`© Velora Labs. Slotera is a product by Velora Labs.`) and the public `PublicLegalModal`'s Imprint tab. Don't rename the product, don't sprinkle "Velora Labs" elsewhere.
- **Footer** has a single `Legal` link that opens `PublicLegalModal` with three tabs: Imprint / Privacy / Terms. There are no separate `/imprint`, `/privacy`, `/terms` pages. Footer "Company" column is just `Contact` — no Blog or About.

### Public booking flow

- Stepper keeps action buttons aligned across steps via a consistent flexible min-height area. Don't use fixed heights.
- The consent checkbox on the Details step links to a single `LegalModal` with two tabs: **Provider Booking Terms** (from `settings.payments.bookingTerms` — falls back to a default placeholder if `enabled=false` or empty) and **Slotera Terms & Privacy** (combined terms + privacy sub-sections inside the same tab). Keep it one consent link, not three.
- Billing address order: line 1 → line 2 → city + state/region → country + postal code.
- Review and Pay steps use `ReceiptCard` (perforated receipt look) showing service, client, billing address, subtotal, tax/VAT, total, payment method, and manual instructions when applicable.
- **The Phase 1 tax preview is not backend business logic.** Its hard-coded country VAT
  table is a mock-only shortcut. The real flow requests a server-calculated quote and
  snapshots subtotal, tax, total, currency, treatment/jurisdiction/label, and the
  operator's tax number. Initial free/manual flows support operator-configured no-tax or
  fixed treatment; international tax detection waits for a provider tax service and
  professional review. The customer receives a booking/payment summary, not a legally
  numbered tax invoice.
- When `settings.business.bookingPageEnabled === false`, the page renders `BookingsPausedCard` (operator name + Get in touch button) instead of the stepper. The route still returns 200 — don't 404 it, that would break shared links silently.
- Card inputs are auto-formatted via `web/src/lib/card.ts` (`formatCardNumber` → `"4242 4242 4242 4242"`, `formatCardExpiry` → `"12 / 30"`, `formatCardCvc` digits-only). Apply these in every card form (booking, register payment, billing update card).
- **Address surfacing** — `SessionItem.address` is stored but not yet shown to the public client. The booking flow's date/time picker doesn't resolve to a specific `SessionItem` (free-form slots), so there's no plumbed-through session reference at confirmation. Surfacing the address publicly is the natural pairing with the `bookingMode: "scheduled"` flow when it gets built — the "scheduled" mode resolves the chosen session and can pass its address to the receipt and confirmation.

### Forms

- Reusable `FormTemplate`s (`web/src/types/form.ts`) are created under `/admin/forms` and attached to services. Attachment is **single-sourced on `FormTemplate.attachedServiceIds`** — there is no `Service.attachedFormIds` field. The public flow resolves attachment via `listFormsForService(serviceId)`. Don't reintroduce a dual-write relationship.
- **Simplified shape (no `purpose`).** A `FormTemplate` is `{ id, name, description, status, fields, attachedServiceIds, requiredBeforePayment, createdAtISO }`. There is **no `purpose`/`FormPurpose` field, category, or filter** — don't reintroduce one. Mock forms are curated around the consultant/coach/instructor ICP (Discovery Call prep, Business context questions, Workshop intake, Mutual NDA acknowledgement). Don't add back profession-specific forms (pet/therapy/trainer).
- Forms attach at the **service** level only; sessions inherit, they are not attached per-session.
- The booking flow handles **pre-payment** form completion: a conditional Forms step (one step, all attached active forms stacked) appears between Details and Billing when the chosen service has attached forms, and is gated on required fields before payment. `FormTemplate.requiredBeforePayment` already exists for this.
- **Optional / post-booking forms** are demonstrated (mocked) on the customer booking workspace (`/booking/manage/demo` → Forms tab). A real version would let clients complete *optional* forms after booking via a secure booking-management link (e.g. `/booking/manage?token=...`): view booking details, complete remaining optional forms, review manual payment instructions, reschedule/cancel if allowed, and see address/meeting details. The real flow is deferred — it needs guest access / magic links, email delivery, and backend persistence (Phase 2/3). Keep wording non-clinical/non-legal (intake questions, pre-visit information, client-provided notes, agreement acknowledgement); no medical-record or compliance claims.

### Packages

Lightweight Phase 1 demo entities for selling/presenting **multi-session offers** — the kind an independent consultant/coach/instructor runs: a 4-session coaching package, a strategy sprint package. `ServicePackage` (`web/src/types/package.ts`), seeded in `web/src/data/mock/packages.json`, served by `web/src/services/packages.service.ts` (`listPackages`, `getPackage`, `create`/`update`, `deactivate`/`activate`, `removePackage`, `listActivePackages`, `listPackagesForService`).

- **Use "Packages" only — there is no separate "Programs" concept.** No `kind` enum, no package/program distinction, no `durationLabel`/`validityDays`/`includedSessionCount` fields. Don't reintroduce them.
- **A package is an ordered bundle of existing services.** Shape: `ServicePackage { id, name, description, status, priceCents, currency, items: PackageItem[], notes?, featured?, createdAtISO, updatedAtISO }`. `PackageItem { id, serviceId, title?, description?, order }`. Each item points to an existing `Service`; multiple items may share a `serviceId`; the operator arranges them in a custom order (the editor manages `items` as an array and recomputes `order` from position).
- **Source of truth for the service relationship is `ServicePackage.items[].serviceId`** — there is **no `Service.packageIds`** field and **no dual-write**. To change which packages include a service, edit the package's items on `/admin/packages`. The service editor does **not** have a package-inclusion control (don't reintroduce `AvailableInPackagesField`/`setPackageServiceAttachment`).
- **Operator surface only:** the **Packages** nav item + `/admin/packages` are operator-admin only (never superadmin). Create/edit uses the global `DrawersProvider` (`openPackageDrawer` → `PackageDrawer` → `PackageForm`). Cards/list show name, price, number of included sessions (`items.length`), status, and a featured indicator.
- **Public booking is informational only.** When a selected service is included in active packages, the Service step shows a `PackageOptionsHint` (a hint + a modal listing the offers), resolved via `listPackagesForService` (active packages whose `items[].serviceId` matches). **No package checkout, no required choice, no payment changes, no step-sequence changes.** Copy: "Available in packages" / "View package options" — never "programs", "memberships", "credits", "subscriptions", or "available with services".
- **`/booking/manage/demo`** shows a **display-only** Package tab ("Session N of M" + included services in order) when the booking is part of a package. No credit ledger, balance, or consumption.
- **This is a product/demo model only.** It does **not** implement real checkout, credit/balance ledgers, session consumption, entitlement rules, recurring billing, memberships, coupons, gift cards, or Stripe product/price objects. Future iterations may add package purchase, remaining credits, enrollment, reminders, and customer package management.
- **Don't confuse this with platform billing.** Settings → Billing & Subscription = how the **operator pays Slotera** (Solo/Team/Custom). Packages = what the **operator sells to their own clients**. They are separate domains in code, UI, and copy — keep them separate.

### Customer booking workspace (demo)

**Naming: use "Booking" consistently for this customer-facing concept — never "reservation".** The core domain model stays `Booking`; this is the post-booking *management* layer on top of it. User-facing copy: **"booking workspace"** / **"your booking"** / **"manage booking"**. It is **not a customer account, and never call it a "Customer Portal" or "Client Portal"** (don't use those terms in UI copy). Customers still do not have accounts.

`/booking/manage/demo` (`web/src/app/(public)/booking/manage/demo/page.tsx`) is a **mocked, public, no-auth Phase 1 preview** of a lightweight post-booking **booking workspace** — what a customer could see/do *after* booking. It surfaces from the booking confirmation page's "Manage booking" link and from a `BookingDrawer` "View booking workspace" link, and uses a single fixed demo booking (no IDs, tokens, secure links, persistence, or email). There is **no redirect** from the old `/reservation/demo` route — it was removed and all internal links were repointed.

It is deliberately **not** a full client portal, CRM, project-management app, course platform, messaging platform, or file-management system.

**Layout — a two-column tabbed workspace** (not a long stack of cards). A compact header (badge + "Your booking" + subtitle), then:
- **Left column (wider):** the selected tab's content.
- **Right column (narrower):** a **quiet vertical tab menu** — selected tab gets a slight highlight (`bg-surface-warm` + accent icon), non-selected tabs stay visually quiet (no heavy borders). A **subtle vertical separator** (`lg:border-l lg:border-line-soft`) divides content from tabs.
- **Mobile** moves the tab menu **above** the content as a horizontally scrollable row; columns stack naturally with no nested scroll.

**Tabs** (default **Booking info**):
- **Booking info** — service, provider, date/time, status, location/online placeholder, booking reference, and a short derived context line ("N optional forms to complete before your session"). Includes the display-only reminder line ("You'll receive a reminder 24 hours before your session") that represents future email reminders without building them.
- **Manage booking** — message-provider textarea (mocked send → toast) + request-reschedule / request-cancellation (ConfirmDialog + toast). No real messaging, no real reschedule/cancel logic.
- **Forms** — a clean **list** of forms with **Required/Optional** and **Completed/Not completed** statuses. Clicking a row opens a **modal** with the fields: a pre-payment-completed *required* form shows read-only answers; an *optional* incomplete form is fillable (save → local state + toast). The main tab does not expand all fields by default.
- **Payment** (not "Receipt" — the demo booking is manual/unpaid) — payment method, status, line item + subtotal/tax/total, and manual payment instructions.
- **Package** — shown **only** when the booking is part of a package: package name, "Session N of M", and the included services in order (current session highlighted). Display-only — **no credits, balances, subscriptions, memberships, checkout, or Stripe product info.**

All tab content is mocked English provider/service copy; only the surrounding chrome/labels are translated (EN/TR/DE under the `bookingManage.*` i18n namespace).

A production version would use **secure magic links/tokens sent by email + backend persistence**, and could additionally show address/meeting details. Keep copy non-clinical/non-legal; **no medical-record or compliance claims**. **Internal session notes and action items are never exposed here.** Don't promote this page in the public Demo Guide modal unless it stays uncrowded.

**Deliberately simplified — do not re-add to this surface:** "Shared resources" / resource links and a client-facing "Your next steps" / shared action-items list were **removed**. The resources feature (type/service/mock data) was deleted as unused. `clientVisible` remains on `SessionActionItem` for a possible future client surface, but action items are **admin-only today** and must not be surfaced on the booking workspace in this pass.

**Future backend-heavy ideas are represented, not built.** Email reminders/follow-ups (the reminder line), real customer magic-link access (the disclaimer copy), approval-before-booking (a future *service-level* workflow only — do **not** change the public booking step sequence), and package checkout/credits (package context stays display-only) are all documented as future work. Don't implement any of them in this surface.

### Calendar

- Day / Week / Month views supported.
- Selected-view titles: Day → "Monday, 11 May 2026", Week → "Week of 11 – 17 May 2026", Month → "May 2026".
- Cells stay compact: primary = service name, secondary = client name for 1:1 (`capacity === 1`) or `"X / Y booked"` for groups (`capacity > 1`). There is no separate "session title" field — don't reference one.
- Spots wording: `1 spot open`, `X spots open` (via `plural()` in `web/src/lib/text.ts`).
- Session details open in the shared `SessionDrawer`. Do not reserve permanent right-side space for them.

### Dashboard

Intentionally more editorial than generic SaaS. **Keep:**

- Compact KPI cards (`KpiTile`).
- Revenue trend with Recharts (`TrendChart`) — its `ResponsiveContainer` is gated on a measured positive size to suppress the `width(-1)/height(-1)` warnings that fire during route transitions.
- Prominent `NextSessionCard` (also embeds today's schedule timeline — don't add a separate "Today's schedule" card).
- `PendingActions` ("Needs your attention"). New live-derived entries get *prepended* via `dashboard.service.ts`; the existing one is "Record attendance for N sessions" (computed from past `capacity > 1` sessions with un-marked, non-cancelled bookings).
- `Greeting`'s right-hand column has the **booking-page toggle**: a `Toggle` + status pill ("Booking page live" / "Bookings paused") + confirmation modal + `toast.info("Bookings paused", { description })` / `toast.success("Bookings live")`. Persists to `settings.business.bookingPageEnabled`.

**Do not reintroduce:** "Recent bookings" card, "This week" card. Those live on other pages.

### Bookings

- Grouped into status accordions in order: **Pending → Confirmed → Completed → No-show → Cancelled**.
- Accordion headers: color-coded dot + bold label + count + a muted truncated preview like `Maya 10:00 · John 14:30 · +6 more`. **No status badges in headers** — the dot is the indicator.
- Row-level edit/cancel icons stay removed. Use the `BookingDrawer` for everything.
- `BookingStatus` includes `"noshow"`. Its `BOOKING_STATUS` entry uses tone `warning` and icon `alert` so it's visually distinct from `cancelled` (tone `danger`, icon `x`). Don't make them look the same.
- Per-booking attendance — `Booking.attendance?: "present" | "late" | "absent"` — is set via the SessionDrawer's **Attendance** tab (renders only when `capacity > 1`). Recorded per row with a `SegGroup`. "Mark all present" quick action saves a batch with one toast.
- **Booking detail page (`/admin/bookings/[id]`)** is a focused two-column layout: **left = Session + Location** (+ the optional booking note), **right = Payment**. It deliberately does **not** duplicate the full client info card — the Session section shows the client **name as a link to `/admin/clients/<clientId>`** instead. Payment shows status, subtotal/tax/total, and the workspace manual payment instructions when enabled — display-only, no real payment actions or Stripe workflow.

### Settings

Two-column structure: left aside (eyebrow "Workspace" + H1 "Settings" + description + nav links), right column (selected section).

Sidebar labels in **Title Case** — exact strings:

```
Business Profile · Branding · Client Payments · Billing & Subscription · Calendar · Emails · Account
```

Inner panel card titles match the same Title Case (`Business Profile`, `Manual Payment`, `Payment Processors`, `Calendar Connections`, `Working Hours`, `Email Notifications`). The right-column section header reads just `{label}` — no "settings" suffix.

**Business Profile** also includes a **Studios & offices** card (`LocationsCard`) — list + Add/Edit/Delete of saved `WorkspaceLocation`s. Each location is `{ id, label, address: Address }`. These are pickable in the SessionDrawer and ServiceDrawer via `AddressPicker`.

Keep Settings simple and not enterprise-heavy.

### Addresses

```ts
// web/src/types/address.ts
type Address = { street; street2?; city; region?; postalCode; country; notes? };
type WorkspaceLocation = { id; label; address };
```

- `SettingsData.business.locations: WorkspaceLocation[]` — workspace's saved studios/offices.
- `Service.address?: Address` — default address inherited by new sessions of that service.
- `SessionItem.address?: Address` — per-session override (or one-off venue).

`AddressForm` is the controlled-field component; `AddressPicker` is the dashed-card empty state + quick-fill dropdown + AddressForm + Remove combination. Both live in `web/src/components/shared/forms/`. The picker is used in `ServiceForm` (when locationType isn't online) and `SessionDrawer` (likewise). On save, sessions with `locationType: "online"` drop their address so the data stays clean.

### Clients

The client detail page (`/admin/clients/[id]`) is a focused two-tab workspace, **not** a CRM:

- **Real-data identity:** every client has a stable UUID `clientId`; bookings point to it.
  Normalised email remains required and unique within a workspace so public repeat
  bookings can resolve the existing client, but email is not the primary key and repeat
  booking never silently overwrites the saved profile. Customers still have no login.

- **Overview** and **Notes** tabs only (shared `Tabs` primitive). Don't add more tabs in this pass.
- **Overview** is a two-column layout: **Recent bookings** on the left (wider), **Contact info** on the right (narrower); on mobile they stack with Recent bookings first. The "Booking history" card was renamed to "Recent bookings" and the old single-textarea notes card was removed from Overview.
- **Recent bookings** shows a compact list (service, date/time, amount, status) and a **"View all bookings"** action that navigates to `/admin/bookings?client=<clientId>`. The main **Bookings page stays the canonical place to manage all bookings** — don't duplicate the booking table or add a full Bookings tab inside client details. `BookingsView` reads the `client` query param, filters to that client, and shows a removable filter chip.
- **Notes** tab → see Client notes below.

### Client notes

Client notes are **separate internal note entries**, not one big textarea (the old `Client.notes?: string` field was removed). Type `ClientNote` (`web/src/types/client-note.ts`): `{ id, clientId, title, body, createdAtISO, updatedAtISO }`. Seeded in `web/src/data/mock/client-notes.json`, served by `web/src/services/client-notes.service.ts` (`listClientNotes`, `createClientNote`, `updateClientNote`, `deleteClientNote`). The Notes tab (`web/src/components/admin/clients/ClientNotes.tsx`) lists notes (title + body + created/updated date), with add/edit via a `Modal` (title + body, both required) and delete via `ConfirmDialog`; all mutations toast.

- **Admin-only by default — never shown to clients** and **never surfaced on the customer booking workspace**. A small `info` affordance + muted helper text on the tab makes the internal-only intent explicit.
- Notes are for **client context, follow-up reminders, preferences, and details useful before future sessions** — the operator has full freedom in the text.
- Keep it lightweight: **not a full CRM activity log, audit timeline, assignees, comments, or reminders.** If a multi-author/audit-log shape becomes useful later, promote intentionally — don't fork it ad hoc.
- **Rich text via lightweight Tiptap.** The note body is edited with a small Tiptap editor (`NoteEditor.tsx`, `@tiptap/react` + `@tiptap/starter-kit` + the `Placeholder` extension from `@tiptap/extensions`) — admins format **visually** while typing, not with markdown markers. Toolbar is deliberately minimal: **Bold, Italic, Heading, Bullet list, Numbered list, Quote, Undo/Redo** only. Do **not** add images, uploads, embeds, tables, colors, font/size pickers, slash commands, AI writing, comments, or collaboration. `ClientNote.body` stores **safe HTML** produced by the editor (StarterKit tags only) and is rendered read-only via `NoteContent.tsx` (contained `dangerouslySetInnerHTML` — acceptable **only** because the content is controlled/admin-authored, never client- or network-supplied). The previous markdown-marker toolbar + `NoteBody.tsx` parser were removed; don't reintroduce them.

### Notes

Service (internal), Session (internal), and Booking (booking note) each carry a single optional `notes?: string` textarea — not a timestamped log. (Client notes are the exception: they are separate `ClientNote` entries — see Client notes above.) If a multi-author/audit-log shape becomes useful, promote each `notes?: string` to `notes: NoteEntry[]` together — don't fork the shape per entity.

### Session notes & action items

A session carries two distinct admin surfaces, both in the shared `SessionDrawer` under a **"Notes & Actions"** tab (rendered for existing sessions; the tab label shows the open-item count, e.g. `Notes & Actions (2)`):

- **Internal note** — the existing `SessionItem.notes` single string. **Admin/internal by default and never shown to clients.** While *creating* a session the note stays inline on the Details tab; for an *existing* session it moves into the Notes & Actions tab with its own "Save note" button (`updateSession` is a patch-merge, so this stays consistent with the Details "Save"). Don't build a note history/audit log.
- **Action items** — lightweight admin tasks attached to a session. Type `SessionActionItem` (`web/src/types/session-action-item.ts`): `{ id, sessionId, title, description?, status: "todo"|"done", dueDate?, clientVisible?, createdAtISO, updatedAtISO }`. Seeded in `web/src/data/mock/session-action-items.json`, served by `web/src/services/session-action-items.service.ts` (`listActionItems`, `listActionItemsForSession`, `createActionItem`, `updateActionItem`, `toggleActionItemStatus`, `deleteActionItem`). The admin manager (`web/src/components/drawers/SessionActionItems.tsx`) supports add / edit / mark todo↔done / delete + optional due date + a **"Visible to client"** toggle.

`clientVisible` is retained for a possible **future** client-facing surface, but action items are **admin-only today** — they are **not** shown on the customer booking workspace. (The previously-exported `listClientActionItemsForSession` helper was removed as unused once client-facing next steps were dropped from the booking workspace; re-add it if/when a real client surface needs it.) **Internal-only items (the default) never leave the admin surface, and internal notes are never exposed to clients.** Keep this lightweight — **no assignees, comments, reminders, notifications, recurrence, project boards, or messaging.**

Derived surfaces: the Dashboard "Needs your attention" list prepends a live **"Review N open session action items"** entry (computed in `dashboard.service.ts` from `todo` items on real sessions; the `ses-demo` seed is excluded). `BookingDrawer` carries a small **"View booking workspace"** link to `/booking/manage/demo`.

---

## Shared primitives (`web/src/components/ui/` and `web/src/components/shared/forms/`)

These are the components new work should reuse before rolling its own. Re-listing them with a one-liner each so the planning agent doesn't reinvent them.

### Modal & dialogs

- **`Modal`** (`web/src/components/ui/Modal.tsx`) — base portal modal. `children` is **optional**: when omitted, the dividing line under title/description is suppressed and no padded body region is rendered. Always pass buttons via the `footer` prop (not inside the body). Sizes: `"sm"` (`max-w-md`), `"md"` (`max-w-xl`, default), `"lg"` (`max-w-3xl`), `"xl"` (`max-w-5xl`).
- **`ConfirmDialog`** (`web/src/components/ui/ConfirmDialog.tsx`) — thin Modal wrapper for destructive/significant actions. Props: `title`, `description`, `confirmLabel`, `cancelLabel`, `destructive`, `busy`. **Replaces `window.confirm()` everywhere.** Pattern: caller tracks a `pendingX` state (or just a boolean), opens the dialog, runs the action inside `onConfirm` with try/catch + toast, closes on success.
- **`ContactModal`** (`web/src/components/public/ContactModal.tsx`) — described above. Pass `persist` to route through `createInquiry()`.

### Toast

- **`ToastProvider`** + **`useToast()`** (`web/src/components/ui/Toast.tsx`) — mounted at root. `toast.success / error / info(message, { description?, durationMs? })`. Top-right stack, 3.5s auto-dismiss, `prefers-reduced-motion` aware.

### Drawer

- **`DrawerShell`** (`web/src/components/ui/DrawerShell.tsx`) — base for `BookingDrawer` / `SessionDrawer` / `ServiceDrawer` / `NewWorkspaceDrawer`. Right-sheet on desktop, bottom-sheet on mobile. Uses `data-state="open"|"closed"` for enter/exit transitions; respects `prefers-reduced-motion`.

### Shared forms

All live in `web/src/components/shared/forms/`. Controlled — caller owns state and persistence:

| Component | Used by | Notes |
|---|---|---|
| `ServiceForm` | ServiceDrawer body, onboarding step 1 | Includes the address picker when locationType is physical/hybrid. `showActiveToggle` prop hides the active toggle for first-time creation. |
| `WorkingHoursForm` | Settings → Calendar → Working Hours, onboarding step 2 | 7-row weekly grid. |
| `ManualPaymentForm` | Settings → Client Payments → Manual Payment, onboarding step 3 | `{ enabled, instructions }` value object. |
| `AddressForm` | Settings Locations CRUD, AddressPicker body | Single structured address. Country dropdown matches the public billing flow. Exports `formatAddressSummary()` for one-line summaries. |
| `AddressPicker` | ServiceForm, SessionDrawer | Wraps `AddressForm` with empty-state, saved-location quick-fill dropdown, and a Remove button. Caller passes `savedLocations`. |

### Helper libraries

- **`web/src/lib/card.ts`** — `detectCardBrand`, `formatCardNumber`, `formatCardExpiry`, `formatCardCvc`, `isValidCardExpiry`, `parseCardExpiry`. All pure, all client-side. Use these for every card input across the codebase; do not roll new formatters.
- **`web/src/lib/register-draft.ts`** — sessionStorage helpers for the deferred-account registration flow. `slotera.register.draft` key is owned exclusively here.
- **`web/src/lib/status-maps.ts`** — single source of truth for status tone + label + icon. Always extend this rather than hardcoding tones per page.
- **`web/src/lib/nav.ts`** — `OPERATOR_NAV`, `SUPERADMIN_NAV`, `navForRole`, `homePathForRole`, `eyebrowForRole`. The role-routing source of truth.

---

## Mobile / future React Native readiness

Before the Phase 2 backend, keep future mobile support in mind, but do not build React Native yet. Current priority:

1. Finish the responsive web MVP.
2. Make key web flows mobile-friendly (drawers already render as bottom sheets, ToastViewport adapts to viewport width).
3. Keep the API contract domain-based for later mobile use — design endpoints around resources, not pages.
4. Build the backend once web flows stabilize.
5. Build React Native later against the same API.

Avoid page-specific endpoints when designing Phase 2:

```
Bad:  GET /admin/dashboard-card-left, GET /calendar-sidebar-panel
Good: GET /dashboard/summary, GET /sessions, GET /bookings, GET /clients,
      GET /services, GET /settings/payment, GET /settings/billing
```

Backend should serve both Next.js web and a future React Native client without separate "mobile-only" endpoints unless there's a clear reason.

FastAPI's OpenAPI document is also the transport contract. Generated TypeScript request /
response DTOs live under `web/src/api/generated/` and are used only inside the service/API
boundary, which maps them to the existing component-facing types under `web/src/types/`.
Generated transport types are not database entities and do not create a second domain
vocabulary for components.

---

## UI primitives / shared fixes — preserved rules

A handful of cross-cutting rules earned their place by burning us at least once:

- **Switch/toggle thumb alignment** must be fixed globally in the shared `Toggle` component or shared styling — never per usage.
- **Drawer/sheet animations** are driven by `data-state` on `DrawerShell`. Check `data-state` classes, the Tailwind v4 animation setup in `globals.css`, and the wrapper before patching an individual drawer.
- **Buttons with accent backgrounds must render white text.** If they don't, check element-selector resets in `globals.css` (they must be inside `@layer base` — see Styling system above).
- **Prefer shared fixes over call-site patches whenever an issue repeats.**
