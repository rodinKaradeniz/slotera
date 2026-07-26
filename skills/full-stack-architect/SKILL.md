---
name: full-stack-architect
description: Use for cross-layer design decisions — data model, service boundaries, API shape, or anything that will outlive the current phase. Forces explicit maintainability, cost, and scale tradeoffs.
---

# Full-Stack Architect

Senior-level decision discipline for changes that cross layers or outlive the phase
they're made in. Use when the question is *how should this be shaped*, not *how do I write
this*.

> Skills are the workflow layer; **`docs/RULES.md` is the always-on convention layer and
> wins on any conflict.**

## The situation you're designing inside

This is a **frontend-only prototype with a real backend planned**. That single fact drives
most architectural calls here:

- Every service module in `src/services/` has an unwritten `api` branch. Today it throws
  `NotImplementedError`; in Phase 2 it calls FastAPI + PostgreSQL. **That boundary is the
  most valuable structure in the codebase** — decisions that respect it are cheap to
  migrate, decisions that bypass it are rewrites.
- Mock state lives in module-level arrays and resets on reload. Anything that quietly
  depends on cross-reload persistence is broken already and doesn't know it.
- A React Native client is planned against the *same* API, after the web MVP stabilises.

So the recurring architectural question is: **will this survive contact with a real
database, real tenancy, and a second client?**

## Where the layer boundaries actually are

| Layer | Owns | Must not |
|---|---|---|
| `src/app/**` routes | composition, route groups, guards | contain business logic or reach fixtures |
| `src/components/**` | rendering, local interaction state | import `src/data/mock/*.json`; hardcode status tones |
| `src/services/*.service.ts` | all data access, simulated latency, the mock/api guard | know about pages or components |
| `src/lib/**` | pure helpers, storage-key ownership, routing constants | import services or components |
| `src/types/**` | the domain vocabulary | carry UI concerns |

A change that blurs one of these is the one to push back on. The most common blur:
business logic drifting into a page component because it was faster than adding a service
method.

## Designing the API contract (Phase 2)

Endpoints are shaped around **resources, not pages** — because a mobile client will
consume them and must not need its own endpoints:

```
Good:  GET /dashboard/summary   GET /sessions   GET /bookings   GET /clients
       GET /services            GET /settings/payment   GET /settings/billing
Bad:   GET /admin/dashboard-card-left        GET /calendar-sidebar-panel
```

`getDashboard()` is the deliberate exception worth understanding: it composes live from
`listBookings()`, `listSessions()`, and `listActionItems()`. A `/dashboard/summary`
endpoint is legitimate because "the dashboard summary" is a real derived resource — not
because a page needed it. That distinction is the test to apply to any future composite
endpoint.

## Tradeoffs, stated explicitly

Every non-trivial design call should name where it lands on these three. Not all three
matter equally on every decision — say which one drove it.

**Maintainability.** Does this add a second way to do something? Does it create a
dual-write? Does it put a decision in one place or scatter it? The single-sourcing rule
(`FormTemplate.attachedServiceIds`, `ServicePackage.items[].serviceId`) exists because
dual-write relationships drift silently — that's a maintainability call made once and
enforced everywhere.

**Cost.** Files touched now, plus files that must change together *later*. A field added
to a shared type costs the type, the fixture, the service, the form, the display, and
three translation files. That's not an argument against it — it's the number you should
have before deciding.

**Scale.** Not throughput — this has eight mock clients. It means: what breaks when there
are 10,000 bookings, real tenancy, and concurrent operators? Client-side filtering over a
full list is fine now and becomes a server query later; a design that *assumes* the full
list is in memory is the one that hurts. Conflict detection is the live example: today a
client-side warning, tomorrow a server-side invariant.

## Vendor decisions

Anything swappable goes behind a local interface and a **single factory**, so the choice
stays a one-file decision. Existing examples: `lucide-react` behind `Icon.tsx`, and the
entire data layer behind the service modules plus `src/lib/env.ts`.

Phase 2's real-booking milestone brings the minimum transactional-email vendor decision;
Phase 3 brings payments (Stripe), scheduled email/reminders, and calendar (Google). Each
must arrive behind the same kind of local interface and single factory. **No provider SDK
imported at a call site.** A component calling `stripe.*` directly is a component that
cannot be tested, demoed offline, or migrated.

## Before proposing

1. Read `docs/HISTORY.md` — particularly the "Rejected alternatives" table and the
   modelling section. Several architectural questions have already been argued; re-opening
   one requires engaging with the recorded reasoning, not ignoring it.
2. Check `docs/PRODUCT.md` for the product rule. Some architecturally attractive options are
   ruled out by positioning — a `type` enum on `Service` is the standing example.
3. Check `docs/TODO.md` — the thing you're designing may already be deferred, with a
   recorded reason and a natural pairing (e.g. surfacing session addresses publicly is
   paired with building `bookingMode: "scheduled"`, and doing either alone is wasted work).

## Output

State the decision, the alternative you rejected, the axis it turned on, and the condition
that would reverse it. Then write it into `docs/HISTORY.md` as an entry — an architectural
decision that only exists in a chat message will be re-litigated.
