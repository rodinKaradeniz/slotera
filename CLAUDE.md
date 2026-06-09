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

- **Service** — the template the operator offers (name, description, duration, price, capacity, location type, booking mode, optional default address, optional internal notes). Examples: "Strategy Call", "Yoga Class".
- **Session** — a scheduled occurrence of a service (date, time, capacity, booked count, status, location, optional address, optional internal notes).
- **Booking** — a client's reservation for a session. One session can have many bookings when `capacity > 1`. Bookings carry optional `attendance` (`"present" | "late" | "absent"`) recorded post-session.
- **Capacity** — `1` is a 1:1 appointment; `>1` is a group/class/workshop. **Do not branch logic on a separate "1:1 vs group" service type — branch on capacity.** Group sessions are not a distinct entity.
- **Booking mode** — `service.bookingMode: "open" | "scheduled"` controls *how* a service is booked. **This is not a service category — never reintroduce a `type` enum like "consulting / yoga / workshop".** `open` = generate slots from working hours (consultations, drop-in classes); `scheduled` = operator pre-creates sessions, clients pick from the list (workshops, courses).
- **Address** — structured postal address (`Address` type, ISO-3166-1 alpha-2 country code). Operators save named places as `WorkspaceLocation`s under Settings → Business Profile and attach them to services (as defaults) and to sessions (as one-off overrides).
- **Workspace** — one operator + their settings + their data. The `(superadmin)` views manage all workspaces from a platform perspective.
- **Roles** — `UserRole = "operator_admin" | "superadmin"`. Customers don't have accounts; only operators/admins authenticate. Overlapping sessions on the same operator's calendar must be treated as a conflict (see `src/components/shared/ConflictWarning.tsx`).

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

`getDashboard()` is the only service that composes from other services live: it imports `listBookings()` and `listSessions()` to compute the "Record attendance for N sessions" pending action and prepend it to the seeded `pendingActions`. Other services should stay self-contained unless they need similar live-derived state.

### Auth and session

There is no real auth. `src/services/auth.service.ts` writes a fake token to `localStorage` under `slotera.session`; `src/lib/session.ts` is the only place that touches that key. `AuthGuard` (`src/components/layout/AuthGuard.tsx`) accepts an optional `requireRole` prop and:
- redirects to `/login?next=...` when no session,
- redirects to `homePathForRole(session.role)` when the role mismatches (so an operator hitting `/superadmin/*` lands back on `/admin/dashboard`).

`homePathForRole()` lives in `src/lib/nav.ts` and is the single source of truth for where each role goes home.

### Route groups

`src/app` uses four Next.js route groups, each with its own layout and shell:

- `(public)` — marketing landing + the public booking flow (`/booking`, `/booking/confirmation`, `/booking/failure`). No auth.
- `(auth)` — `/login`, `/register`, `/register/plan`, `/register/payment`, `/forgot-password`, `/reset-password`, `/onboarding`. Uses `AuthShell`. Size is set by pathname in `(auth)/layout.tsx` (`/onboarding` → wide, `/register*` → medium, others → default).
- `(admin)` — everything under `/admin/*`. Wrapped by `AuthGuard requireRole="operator_admin"` + `DrawersProvider`. Uses `AdminShell` (sidebar + topbar).
- `(superadmin)` — everything under `/superadmin/*`. Wrapped by `AuthGuard requireRole="superadmin"`. Uses the same `AppShell` as admin but with the platform nav from `SUPERADMIN_NAV` in `src/lib/nav.ts`.

`/admin` → `/admin/dashboard` and `/superadmin` → `/superadmin/overview` are handled by `redirects()` in `next.config.ts`, not by `redirect()` page bodies — Next 16 + Turbopack tripped a Performance.measure race on the page-body pattern. **Never reintroduce `page.tsx` files at the root of a route segment whose only job is to call `redirect()`.** Add a config redirect instead.

### Drawers are global (admin only)

Admin pages don't render `BookingDrawer`/`SessionDrawer`/`ServiceDrawer` inline. `DrawersProvider` (mounted once in the `(admin)` layout) holds drawer state; pages call `useDrawers().openBookingDrawer({...})` to open them. Only one drawer can be open at a time. When adding edit/create flows in admin, prefer extending this provider over adding new local modals. On mobile the same drawer renders as a bottom sheet — don't fork into a separate mobile dialog.

`(superadmin)` does NOT use `DrawersProvider`. Its only drawer (`NewWorkspaceDrawer`) is mounted locally per view because the usage is narrow. If a second superadmin drawer ever appears, that's the moment to introduce `SuperadminDrawersProvider`.

### Toasts are global

`ToastProvider` is mounted once at the root layout (`src/app/layout.tsx`) so every route group inherits it via context. Use `const { toast } = useToast()` from any client component and call `toast.success(msg, { description? })` / `toast.error(...)` / `toast.info(...)`. Auto-dismiss is 3.5s; stack is top-right. Animations are gated on `prefers-reduced-motion`. **Never reach for `window.alert()` or `window.confirm()` — use a toast for ambient feedback or `ConfirmDialog` for blocking confirmation.**

### Styling system

Tailwind v4 with design tokens defined in `src/app/globals.css` via `@theme inline { --color-*: ... }`. Custom semantic colors: `paper`, `paper-2`, `ink`/`ink-2/3/4`, `line`, `accent` (forest green), `surface`. Shadows are `shadow-card`/`shadow-pop`/`shadow-overlay` (numeric aliases `shadow-1/2/3` also exist).

**Heading classes are `.text-display` / `.text-h1` / `.text-h2` / `.text-h3`, NOT `.h-1`.** Tailwind v4 generates `.h-1`/`.h-2`/`.h-3` as height utilities (0.25rem, 0.5rem, 0.75rem) which silently collapses heading boxes — this is documented in `globals.css` itself.

`src/lib/cn.ts` extends `tailwind-merge` so that the custom typography classes register as the `font-size` group; without this, `cn("text-h1", "text-ink")` would dedupe down to just `text-ink` and every heading would lose its class. Always use `cn(...)` (not raw `clsx`) when composing classes that include the custom `text-*` typography utilities.

**Element-selector resets must be wrapped in `@layer base`.** In Tailwind v4, unlayered rules win over any layered rule regardless of specificity — so a bare `button { color: inherit }` in `globals.css` will silently override `.text-white` (which lives in `@layer utilities`) and primary buttons end up inheriting the dark page ink. The button/input/textarea/select/a resets in `globals.css` are wrapped in `@layer base` for exactly this reason.

Fonts are loaded in `src/app/layout.tsx` via `next/font/google`: Fraunces (serif/display), Inter Tight (sans), JetBrains Mono — exposed as `--font-serif`/`--font-sans`/`--font-mono`.

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

- Path alias `@/*` → `src/*`.
- `"use client"` is the default for anything that imports services or session; the only server components are static admin/auth/public layouts and the landing page.
- Errors thrown by services are either `NotImplementedError` (api branch not built) or `NotFoundError` (`src/services/_errors.ts`); components generally surface `error.message` directly, usually via `toast.error("...", { description: err.message })`.
- The eslint config disables `react-hooks/set-state-in-effect` project-wide — mount-once data fetches and SSR-portal mount flags both legitimately setState in effects here.
- Status badge / payment-status mappings live in `src/lib/status-maps.ts` — extend that file rather than re-deriving colors per page.

---

## Product surfaces & rules

The sections below capture decisions that go beyond the code's structure — what's been built, what's deliberately *not* there, and what the planning agent should preserve when extending.

### Services

- **No `type` field, ever.** A service is defined by name, description, duration, price, capacity, location type, booking mode, optional default address, active state, and optional internal notes. Do not reintroduce service-type fields, filters, badges, color stripes, or hardcoded categories. If grouping is needed later, add a flexible tag/category system intentionally.
- **Allowed service filters:** search, active/inactive status, location type. (The Services page currently has no filter UI; when filters are added, restrict to these three.)
- **`bookingMode: "open" | "scheduled"`** is a booking *mechanic*, not a category — see Domain terminology above. Do not branch UI on it the way you would on a category enum.
- **Default address** — when `locationType` is physical/hybrid, a service can carry an `address?: Address` which is the default inherited by new sessions of that service. The session can override. Switching the chosen service in `SessionDrawer` re-inherits the new service's address.
- **Internal notes** — `service.notes`, displayed only to the operator. Prep instructions, materials, context. Never shown to clients.

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
// src/types/settings.ts
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

Mock files: `src/data/mock/plans.json`, `subscription.json`, `invoices.json`. Service: `src/services/billing.service.ts` exporting `listPlans()`, `getSubscription()`, `changePlan(planId, cycle)`, `cancelSubscription()`, `reactivateSubscription()`, `listInvoices()`, `updateMockPaymentMethod(input)`, `setSubscriptionStatus(status)`. **Keep this mocked in Phase 1; no real Stripe Billing yet.**

**Change-plan → Custom diverts to contact.** Picking the Custom card in the Change-plan modal does NOT call `changePlan()` — it opens the persisting `ContactModal` (`persist`-mode) pre-filled with the operator's name/email and reason `business`. The submission lands in `/superadmin/inquiries` where staff can promote it to a manually-onboarded Custom workspace. The current subscription is unchanged until the contact is followed up.

### Superadmin area

Slotera has a separate mocked superadmin area at `/superadmin/*` for internal/platform management. **Do not mix operator-admin and superadmin navigation into one visible sidebar.** Both share the shell components (`AppShell`, `Sidebar`, `Topbar`) but with separate `OPERATOR_NAV` / `SUPERADMIN_NAV` in `src/lib/nav.ts` and separate mental models.

Routes:

| Operator (`/admin/*`) | Superadmin (`/superadmin/*`) |
|---|---|
| dashboard, calendar, bookings, clients, services, settings | overview, workspaces, workspaces/[id], subscriptions, inquiries, settings |

Mock auth routes by role via `homePathForRole()`. `/superadmin/*` is protected by `AuthGuard requireRole="superadmin"`.

Mock files under `src/data/mock/`: `platform-workspaces.json`, `platform-subscriptions.json`, `platform-inquiries.json`, `platform-overview.json`. **Everything platform-side lives in `src/services/platform.service.ts`** — workspaces, subscriptions, and inquiries together. There is no separate `platform-billing.service.ts`; both share `setSubscriptionStatus` (with different semantics from `billing.service.ts`'s same-name method — different import sites).

`createInquiry()` powers the Custom-plan persist flow. `createWorkspace()` provisions a workspace + matching `PlatformSubscription` in one call; used by the `NewWorkspaceDrawer` (the "New workspace" button on `/superadmin/workspaces` and the "Promote to workspace" action surfaced inside the inquiry preview modal). Real impersonation is not implemented; "View as operator" is a placeholder that fires `toast.info(...)`.

**Inquiries are an inbox, not a ticketing system.** `PlatformInquiry` carries a single `read: boolean` field — no `new | in_review | resolved` enum, no per-row status dropdowns or badges. `INQUIRY_STATUS` no longer exists in `src/lib/status-maps.ts`; only `INQUIRY_TYPE` remains. Rows on `/superadmin/inquiries` are slim and single-line: a small accent dot + warm tint marks unread; columns are `name+email · type pill · truncated 1-line message · date (right-aligned)`. Click a row to open the preview modal which auto-marks read on open, lets the operator flip back to unread, and surfaces **"Promote to workspace"** only for `type === "business"` inquiries (which forwards into `NewWorkspaceDrawer`). The `setInquiryRead(id, read)` service method (renamed from the previous `setInquiryStatus`) is the only mutation. `PlatformOverview.totals.openInquiries` is kept as the JSON field name but now semantically means "unread" — the overview KPI label is **"Unread inquiries"**.

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
- the user picks Custom — draft stays, no account created, contact inquiry persisted. Helpers live in `src/lib/register-draft.ts`.

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

- Inline navbar dropdown (`src/components/admin/search/NavbarSearch.tsx`)
- Command-K palette (`src/components/admin/search/CommandPalette.tsx`)

Both consume `useSearch()` from `src/lib/search.ts` which indexes bookings, clients, services, sessions, and a fixed nav list. Cmd/Ctrl+K is wired in `AppShell`. **No separate search results page in Phase 1.** Keep search mocked and frontend-only.

### Contact feature

`src/components/public/ContactModal.tsx` is the single contact form. Default behavior is mocked-success-only (no persistence, no email), used from landing/footer/demo guide/paused-booking-page. Pass `persist={true}` for paths where the submission should land as a `PlatformInquiry` in superadmin — the Custom-plan registration flow (`/register/plan`) and the Custom-plan upgrade flow (Settings → Billing → Change plan → Custom) both use this.

Optional pre-fill props: `presetName`, `presetEmail`, `presetMessage`, `defaultReason`, plus `eyebrow` / `title` / `description` overrides. The title uses the prominent eyebrow + large-serif pattern shared with `DemoGuidelinesModal`. Four reason types only (`business / development / feature / general`) — do not add more.

Avoid nested-modal artifacts: when opening contact from another modal, close the parent first.

### Demo guide modal

Public demo guide explains Slotera is a demo, sets data-is-mocked expectations, and guides visitors to: create a demo account → admin dashboard → booking flow. **Do not promote the superadmin workflow in the public demo modal.** The footer invites contact for bugs, requests, or business inquiries — through the same `ContactModal` (non-persisting). **Do not change the auto-open/sessionStorage behavior unless explicitly asked.**

### Landing / public copy

- **GBP** by default.
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
- When `settings.business.bookingPageEnabled === false`, the page renders `BookingsPausedCard` (operator name + Get in touch button) instead of the stepper. The route still returns 200 — don't 404 it, that would break shared links silently.
- Card inputs are auto-formatted via `src/lib/card.ts` (`formatCardNumber` → `"4242 4242 4242 4242"`, `formatCardExpiry` → `"12 / 30"`, `formatCardCvc` digits-only). Apply these in every card form (booking, register payment, billing update card).
- **Address surfacing** — `SessionItem.address` is stored but not yet shown to the public client. The booking flow's date/time picker doesn't resolve to a specific `SessionItem` (free-form slots), so there's no plumbed-through session reference at confirmation. Surfacing the address publicly is the natural pairing with the `bookingMode: "scheduled"` flow when it gets built — the "scheduled" mode resolves the chosen session and can pass its address to the receipt and confirmation.

### Forms

- Reusable `FormTemplate`s (`src/types/form.ts`) are created under `/admin/forms` and attached to services. Attachment is **single-sourced on `FormTemplate.attachedServiceIds`** — there is no `Service.attachedFormIds` field. The public flow resolves attachment via `listFormsForService(serviceId)`. Don't reintroduce a dual-write relationship.
- Forms attach at the **service** level only; sessions inherit, they are not attached per-session.
- The booking flow handles **pre-payment** form completion: a conditional Forms step (one step, all attached active forms stacked) appears between Details and Billing when the chosen service has attached forms, and is gated on required fields before payment. `FormTemplate.requiredBeforePayment` already exists for this.
- **Future — optional / post-booking forms (not built; do not implement now).** A later iteration may let clients complete *optional* forms after booking via a customer reservation-management link/page (possible routes: `/reservation/:id`, `/booking/manage?token=...`). Such a page could let a client view reservation details, complete remaining optional forms, review manual payment instructions, reschedule/cancel if allowed, and see address/meeting details. This is deferred because it needs guest access / magic links, email delivery, and backend persistence — all Phase 2/3 concerns. Keep wording non-clinical/non-legal (intake questions, pre-visit information, client-provided notes, agreement acknowledgement); no medical-record or compliance claims.

### Calendar

- Day / Week / Month views supported.
- Selected-view titles: Day → "Monday, 11 May 2026", Week → "Week of 11 – 17 May 2026", Month → "May 2026".
- Cells stay compact: primary = service name, secondary = client name for 1:1 (`capacity === 1`) or `"X / Y booked"` for groups (`capacity > 1`). There is no separate "session title" field — don't reference one.
- Spots wording: `1 spot open`, `X spots open` (via `plural()` in `src/lib/text.ts`).
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
// src/types/address.ts
type Address = { street; street2?; city; region?; postalCode; country; notes? };
type WorkspaceLocation = { id; label; address };
```

- `SettingsData.business.locations: WorkspaceLocation[]` — workspace's saved studios/offices.
- `Service.address?: Address` — default address inherited by new sessions of that service.
- `SessionItem.address?: Address` — per-session override (or one-off venue).

`AddressForm` is the controlled-field component; `AddressPicker` is the dashed-card empty state + quick-fill dropdown + AddressForm + Remove combination. Both live in `src/components/shared/forms/`. The picker is used in `ServiceForm` (when locationType isn't online) and `SessionDrawer` (likewise). On save, sessions with `locationType: "online"` drop their address so the data stays clean.

### Notes

Every top-level entity has a single optional `notes?: string` textarea — Service (internal), Session (internal), Booking (booking note), Client (notes). Single textarea per entity for now, not a timestamped log. If a multi-author/audit-log shape becomes useful, promote each `notes?: string` to `notes: NoteEntry[]` together — don't fork the shape per entity.

---

## Shared primitives (`src/components/ui/` and `src/components/shared/forms/`)

These are the components new work should reuse before rolling its own. Re-listing them with a one-liner each so the planning agent doesn't reinvent them.

### Modal & dialogs

- **`Modal`** (`src/components/ui/Modal.tsx`) — base portal modal. `children` is **optional**: when omitted, the dividing line under title/description is suppressed and no padded body region is rendered. Always pass buttons via the `footer` prop (not inside the body). Sizes: `"sm"` (`max-w-md`), `"md"` (`max-w-xl`, default), `"lg"` (`max-w-3xl`), `"xl"` (`max-w-5xl`).
- **`ConfirmDialog`** (`src/components/ui/ConfirmDialog.tsx`) — thin Modal wrapper for destructive/significant actions. Props: `title`, `description`, `confirmLabel`, `cancelLabel`, `destructive`, `busy`. **Replaces `window.confirm()` everywhere.** Pattern: caller tracks a `pendingX` state (or just a boolean), opens the dialog, runs the action inside `onConfirm` with try/catch + toast, closes on success.
- **`ContactModal`** (`src/components/public/ContactModal.tsx`) — described above. Pass `persist` to route through `createInquiry()`.

### Toast

- **`ToastProvider`** + **`useToast()`** (`src/components/ui/Toast.tsx`) — mounted at root. `toast.success / error / info(message, { description?, durationMs? })`. Top-right stack, 3.5s auto-dismiss, `prefers-reduced-motion` aware.

### Drawer

- **`DrawerShell`** (`src/components/ui/DrawerShell.tsx`) — base for `BookingDrawer` / `SessionDrawer` / `ServiceDrawer` / `NewWorkspaceDrawer`. Right-sheet on desktop, bottom-sheet on mobile. Uses `data-state="open"|"closed"` for enter/exit transitions; respects `prefers-reduced-motion`.

### Shared forms

All live in `src/components/shared/forms/`. Controlled — caller owns state and persistence:

| Component | Used by | Notes |
|---|---|---|
| `ServiceForm` | ServiceDrawer body, onboarding step 1 | Includes the address picker when locationType is physical/hybrid. `showActiveToggle` prop hides the active toggle for first-time creation. |
| `WorkingHoursForm` | Settings → Calendar → Working Hours, onboarding step 2 | 7-row weekly grid. |
| `ManualPaymentForm` | Settings → Client Payments → Manual Payment, onboarding step 3 | `{ enabled, instructions }` value object. |
| `AddressForm` | Settings Locations CRUD, AddressPicker body | Single structured address. Country dropdown matches the public billing flow. Exports `formatAddressSummary()` for one-line summaries. |
| `AddressPicker` | ServiceForm, SessionDrawer | Wraps `AddressForm` with empty-state, saved-location quick-fill dropdown, and a Remove button. Caller passes `savedLocations`. |

### Helper libraries

- **`src/lib/card.ts`** — `detectCardBrand`, `formatCardNumber`, `formatCardExpiry`, `formatCardCvc`, `isValidCardExpiry`, `parseCardExpiry`. All pure, all client-side. Use these for every card input across the codebase; do not roll new formatters.
- **`src/lib/register-draft.ts`** — sessionStorage helpers for the deferred-account registration flow. `slotera.register.draft` key is owned exclusively here.
- **`src/lib/status-maps.ts`** — single source of truth for status tone + label + icon. Always extend this rather than hardcoding tones per page.
- **`src/lib/nav.ts`** — `OPERATOR_NAV`, `SUPERADMIN_NAV`, `navForRole`, `homePathForRole`, `eyebrowForRole`. The role-routing source of truth.

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

---

## UI primitives / shared fixes — preserved rules

A handful of cross-cutting rules earned their place by burning us at least once:

- **Switch/toggle thumb alignment** must be fixed globally in the shared `Toggle` component or shared styling — never per usage.
- **Drawer/sheet animations** are driven by `data-state` on `DrawerShell`. Check `data-state` classes, the Tailwind v4 animation setup in `globals.css`, and the wrapper before patching an individual drawer.
- **Buttons with accent backgrounds must render white text.** If they don't, check element-selector resets in `globals.css` (they must be inside `@layer base` — see Styling system above).
- **Prefer shared fixes over call-site patches whenever an issue repeats.**
