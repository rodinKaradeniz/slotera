---
name: engineering-discipline
description: Use before writing code on any non-trivial change — defines success criteria first, then holds the line against silent assumptions, over-engineering, and scope creep.
---

# Engineering Discipline

The default failure mode on this codebase is not bad code. It's *plausible* code: a
component that renders, type-checks, and lints, but reads mock JSON directly, opens its
own modal, or hardcodes a status colour — quietly adding a second way to do something that
already had one.

This skill is the counterweight. Use it whenever a change touches more than one file, adds
a surface, or introduces a pattern.

> Skills are the workflow layer; **`docs/RULES.md` is the always-on convention layer and
> wins on any conflict.**

## Before writing any code

Write down — in the response, not just internally — three things:

1. **Success criteria.** What must be true when this is done, in terms someone could
   check. "The Notes tab shows entries sorted newest-first and an empty state when there
   are none" is checkable. "Improve the notes UX" is not.
2. **The blast radius.** Which files, which shared primitives, which mock fixtures. If the
   answer includes a file in `web/src/components/ui/` or `web/src/lib/`, every consumer of that
   file is in scope for regression — name them.
3. **What you are explicitly not doing.** The adjacent thing you noticed and are leaving
   alone. This is what keeps scope from drifting mid-task.

If any of the three can't be filled in without guessing, that's the question to ask.

## No silent assumptions

Three assumptions are cheap to make here and expensive to be wrong about:

- **The type or export exists where you expect.** `web/src/types/index.ts` is an incomplete
  barrel — `form`, `package`, `client-note`, `session-action-item`, and `demo` are not in
  it. `setSubscriptionStatus` exists in two services with different semantics. Read the
  module; don't infer it from the name.
- **The pattern you're copying is the current one.** Several patterns in this repo were
  deliberately replaced (markdown note editing, inquiry status enums, dual-write
  attachments, redirect-only pages). Copying a removed pattern from memory reintroduces a
  decision that was already argued. `docs/HISTORY.md` has the list.
- **The product rule allows it.** `docs/PRODUCT.md` constrains vocabulary and surface content
  per area — what may appear on the public booking flow, what "booking workspace" may
  never be called, which fields must never exist. Check the section for the surface you're
  touching before writing copy or adding a field.

When you do assume, state the assumption in the response and keep going. An unstated
assumption is the problem; a stated one is a decision the user can correct in one line.

## No over-engineering

Calibrate to what this build is: a mock-backed frontend prototype plus a separate local
backend foundation. The frontend's value is that it works end to end and demos well; the
backend's value is that its boundaries are proven before domain code lands. That makes
some things *worth less* than they'd normally be:

- Abstractions with one call site. Two similar components are cheaper than a premature
  shared one — extract on the third.
- Configuration for things nobody configures.
- Defensive handling of states the mock layer cannot produce.
- Generic solutions to a specific ask.

And some things worth *more* than usual:

- Shared primitives, because a visual bug appears on six pages at once.
- The service-layer boundary, because it's the entire Phase 2 migration seam.
- Product-rule fidelity, because the surfaces are the deliverable.

The test: would this abstraction still be justified if the second use case never arrives?
If not, write the direct version and note the alternative.

## No scope creep

The requested scope is the deliverable — don't narrow it, don't widen it, don't transform
it. Specifically:

- Finish the *whole* ask. If part of it is blocked, complete everything else and say
  exactly what you left out and why. Scaling down is the user's call.
- Adjacent problems you spot get **surfaced, not fixed** — unless fixing is required for
  the task to work. A bug found in passing goes in the summary (and `docs/TODO.md` if it's
  a real deferral), not into the diff.
- Don't reformat, reorder, or tidy files you only passed through.
- Refactors are their own task. "While I was in there" is how a two-file change becomes a
  thirty-file review.

## Definition of done

Before reporting completion:

- Frontend changes: from `web/`, `npx tsc --noEmit` and `npm run lint` clean; affected
  routes loaded in `PORT=3344 npm run dev`, including at least one failure or empty state.
- Backend changes: pytest, Ruff, and mypy clean; affected HTTP/database boundary exercised
  against real PostgreSQL when relevant, including its rejection or failure path.
- Docs updated per `docs/RULES.md` Do #8 — feature snapshot, history entry, or TODO item
  as applicable.
- The summary says what you **ran** versus what you **read**, and ends with a
  "deviations, all deliberate" list if there were any.

Nothing in that list is optional because the change was small.
