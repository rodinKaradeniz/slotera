---
name: test-authoring
description: Use when writing or reviewing tests — targets invariants and failure paths that catch real bugs, rather than happy-path tests that only restate the implementation.
---

# Test Authoring

A test that asserts the function does what the function does catches nothing. This skill
is about writing the other kind.

> Skills are the workflow layer; **`docs/RULES.md` is the always-on convention layer and
> wins on any conflict.**

## Read this first: there is no test runner yet

This project has **no test runner, no test files, and no CI** — see `docs/TODO.md` §2.
That has two consequences:

1. **Adding one is a dependency decision**, not a side effect of a task. Propose it, name
   the runner and why, and get agreement before installing. Don't arrive at a feature
   request with a testing framework attached.
2. **Until then, "testing" means manual exercise** — and the discipline below still
   applies to *which* cases you exercise. Run the failure path and the empty state, not
   just the happy one, and say in your summary which you actually loaded.

## What is worth testing here

Ranked by how silently the bug would fail:

**1. Pure helpers in `src/lib/`** — the cheapest, highest-yield targets.
- `card.ts` — `formatCardNumber`, `formatCardExpiry`, `formatCardCvc`,
  `isValidCardExpiry`, `parseCardExpiry`, `detectCardBrand`. Partial input, over-length
  input, non-digits, an expiry in the past, an expiry this month.
- `calendar.ts` — overlap/conflict detection. Adjacent-but-not-overlapping is the case
  that gets written wrong: a session ending at 10:00 and one starting at 10:00 do not
  conflict.
- `time.ts`, `money.ts`, `text.ts` (`plural()` — the 1 vs. 0 vs. n cases).
- `status-maps.ts` — completeness: every member of every status union has an entry. A
  missing key renders as `undefined` tone, not an error.
- `cn.ts` — that `cn("text-h1", "text-ink")` keeps **both**. This guards a regression that
  is invisible in a diff and silently unstyles every heading (`docs/HISTORY.md` Entry 004).

**2. Service-layer invariants** — the contract every component depends on.
- The mock/api guard: with `dataSource !== "mock"`, every method throws
  `NotImplementedError`. **Prove the negative** — this guard is the Phase 2 migration
  seam, and a method missing it is an invisible gap.
- Patch-merge semantics: `updateX(id, { oneField })` must not drop the other fields. This
  is relied on by two separate save buttons in `SessionDrawer`.
- `NotFoundError` on an unknown id, for every getter and updater.
- Deactivate/activate round-trips leave the record otherwise untouched.

**3. Relationship resolution** — where a bug looks like an empty list, not an error.
- `listFormsForService(serviceId)` against `FormTemplate.attachedServiceIds`.
- `listPackagesForService(serviceId)` — active packages only, matching on
  `items[].serviceId`, including the case where one package lists the same service twice.
- `listBookingServices(persona)` — preserves the **order** of the id list, and drops ids
  that don't resolve to an active service.

**4. Derived state.**
- `getDashboard()` composing from bookings, sessions, and action items — including the
  `ses-demo` exclusion and the prepend order (derived entries before seeded ones).

**5. Role routing.**
- `homePathForRole()` both ways; `AuthGuard`'s no-session and wrong-role redirects.

## How to write one that catches something

- **Start from the failure**, not the feature. Ask "how would this break without anyone
  noticing?" and assert against that. If you can't name a failure the test would catch,
  don't write it.
- **Test the boundary, not the middle.** Empty, one, many. First and last. The moment
  before and after. Zero-capacity, at-capacity, over-capacity.
- **Prove the negative.** Guards, validation, and permission checks are only tested by the
  case that must be *rejected*. A test suite where everything passes proves nothing about
  the guard.
- **Assert the invariant, not the implementation.** "The patch didn't drop other fields"
  survives a refactor; "it called `Object.assign` once" doesn't.
- **One reason to fail per test.** A test asserting six things tells you six things might
  be wrong.
- **Name the test after the bug it prevents** — `rejects a patch that would clear notes`,
  not `test update`.

## What not to test

- That mock fixtures contain specific seeded values. They're demo data and will churn.
- Rendered markup or class strings. The styling invariants are enforced by the primitives;
  snapshotting class lists produces tests that fail on every design tweak.
- Third-party behaviour — Next's router, Tailwind's compiler, Recharts' sizing.
- Anything whose only assertion is that a mock was called.

## After writing

State exactly what you ran and what passed. If a test is aspirational — written against
behaviour that doesn't exist yet — mark it clearly rather than letting it read as
coverage. Overclaiming verification is called out specifically in `docs/RULES.md`.
