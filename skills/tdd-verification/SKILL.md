---
name: tdd-verification
description: Use when a change needs to be provably correct — drives red/green cycles and backs every "done" claim with the actual command output from this project.
---

# TDD & Verification

Two related disciplines: writing the failing check *before* the fix, and never claiming
something works without evidence you can point at.

> Skills are the workflow layer; **`docs/RULES.md` is the always-on convention layer and
> wins on any conflict.**

## This project's real commands

Frontend verification, from `web/`, remains:

```bash
npx tsc --noEmit        # type-check — tsconfig sets noEmit, so this is the check
npm run lint            # eslint, flat config
PORT=3344 npm run dev   # dev server on the project's conventional port
npm run build           # production build — catches what dev mode tolerates
```

Backend verification, from `server/`, is:

```bash
uv run pytest                     # isolated suite; integration excluded by default
uv run pytest -m integration      # live local PostgreSQL
uv run ruff check .
uv run mypy
uv run alembic upgrade head
```

Route probes, for confirming a route still resolves:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3344/booking
```

The frontend still has no `npm test`. Do not describe a check you did not run or treat a
backend test as coverage of a frontend flow.

## The red/green cycle, adapted

Even where the frontend lacks a runner, the cycle is what makes a fix trustworthy —
because it proves the check can fail. Backend work should use a literal failing pytest
first whenever the behaviour can be expressed at that boundary.

**1. Red — reproduce first.** Before changing anything, produce the failure and record
it. Depending on the bug that's a type error, a lint error, a console message, a wrong
value on screen, or a non-200 route. If you cannot reproduce it, you cannot know your
change fixed it, and that uncertainty goes in the summary.

**2. Green — the smallest change that flips it.** Resist fixing the adjacent thing in the
same edit; you lose the causal link between change and outcome.

**3. Confirm — re-run the exact same check.** Same command, same route, same input. Then
run the relevant full gate: frontend type-check/lint/routes, or backend pytest/Ruff/mypy
plus migrations/integration when the database boundary changed.

**4. Regress — check what shares the code.** If the fix was in `web/src/components/ui/` or
`web/src/lib/`, list the consumers (`grep -rn "<name>" web/src/`) and load at least one page per
distinct usage. A change to a primitive is never a one-page change.

For a *new* feature, the equivalent of red is: define the observable success criteria
first, confirm they're currently false, build, confirm they're true.

## Verifying by surface

What "loaded it" should mean, per area:

- **Public booking** — walk the stepper to Pay, with a service that has attached forms
  (so the conditional Forms step appears) and one without. Check the manual-payment
  branch, since it changes the receipt.
- **Admin** — log in as `hello@slotera.app` (any password). Exercise the drawer, not just
  the list: open, save, cancel, and confirm the toast fires.
- **Superadmin** — log in as `admin@slotera.app`. Confirm role routing sends an operator
  hitting `/superadmin/*` back to `/admin/dashboard`.
- **Anything touching mock state** — remember mutations are module-level and reset on HMR.
  A "it saved" observation after an edit that triggered a hot reload proves nothing; do a
  clean reload and re-check.
- **Anything touching styling primitives** — check both a page that uses the default and
  one that composes extra classes over it, because `cn()`'s merge behaviour is where these
  regressions live.
- **Backend HTTP/database** — exercise the endpoint through ASGI or a running server, and
  use the real Compose PostgreSQL for connection, migration, permission, constraint, and
  transaction claims. A stub proves HTTP behaviour, not PostgreSQL behaviour.

## Evidence-backed "done"

A completion claim names the command and its outcome:

> `npx tsc --noEmit` clean, `npm run lint` clean. Loaded `/admin/clients/cli-002` on
> `PORT=3344 npm run dev`: added a note, edited it, deleted it — all three toasts fire and
> the empty state renders after deleting the last one. Did **not** run `npm run build`.

Not:

> Tested and working.

Rules that apply without exception:

- **Distinguish "ran" from "read."** Code you inspected is not code you exercised. Say
  which is which.
- **Report partial verification as partial.** "Type-checks; I did not load the superadmin
  route" is a useful sentence.
- **A green type-check is not a working feature.** This codebase is `strict`, which catches
  a lot — and nothing about whether the UI does the right thing.
- **If you couldn't verify, say so and say why.** That's information. A confident claim
  that turns out to be false costs more than the admission.
