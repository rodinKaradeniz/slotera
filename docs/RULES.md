# Slotera — Working Rules

Coding conventions and development rules for AI-assisted work on this project. **This
document applies to every task**, from a one-line copy tweak to a new surface. Where a
workflow module (`skills/*/SKILL.md`) and this file disagree, **this file wins** — skills
are the workflow layer, this is the always-on convention layer.

---

## Reading order at the start of every task

Canonical order lives in `AGENTS.md`; it is repeated here so this file stands alone.

1. **`AGENTS.md`** (root) — what exists now: layout, stack, how to run, feature snapshot.
   Always. It is the entry point.
2. **`docs/RULES.md`** — this file. Always.
3. **`docs/PRODUCT.md`** — the long-form product rulebook: positioning, domain vocabulary,
   per-surface rules, and the "never reintroduce X" list. Read the relevant section before
   changing any user-facing surface, adding a field to a domain type, or writing copy. On a
   product-rule conflict with any other document, `docs/PRODUCT.md` wins and the mismatch
   gets flagged.
4. **`docs/HISTORY.md`** — why it's built that way. Read before changing anything
   structural, and **always** before "improving" something that looks arbitrary. Most
   things that look arbitrary here are load-bearing.
5. **`docs/TODO.md`** — what's deliberately not built. Read when planning, and whenever
   the thing you're touching is adjacent to a deferred concern. An item listed there is a
   decision, not an oversight.

Right-sizing: simple polish needs 1–2. Copy or surface work adds 3. Architectural work
adds 4. Planning adds 5.

`CLAUDE.md` at the repo root is a pointer stub with no content of its own.

---

## Do

1. **Ask when a request is ambiguous or conflicts with existing code.** A wrong assumption
   carried through a multi-file change costs more than the question. Two readings that
   would produce materially different work is the threshold — routine judgment calls are
   yours to make.

2. **Follow the existing pattern; don't add a second way to do something.** This codebase
   has one way to do most things, and each was a decision:
   - data access → the service layer in `web/src/services/`, never `web/src/data/mock/*.json`
     from a component;
   - class composition → `cn(...)` from `web/src/lib/cn.ts`, never raw `clsx`;
   - status tone/label/icon → `web/src/lib/status-maps.ts`;
   - icons → the `IconName` union in `web/src/components/ui/Icon.tsx`, never a direct
     `lucide-react` import at a call site;
   - card inputs → the formatters in `web/src/lib/card.ts`;
   - money → `web/src/lib/money.ts` (default currency **GBP**);
   - ambient feedback → `toast.*`; blocking confirmation → `ConfirmDialog`. Never
     `window.alert()` or `window.confirm()`;
   - admin edit/create flows → extend `DrawersProvider`, don't add a local modal;
   - session/local storage keys → the module that owns them (`web/src/lib/session.ts`,
     `web/src/lib/register-draft.ts`, `web/src/lib/i18n.ts`). One owner per key.

   If the existing pattern is genuinely wrong for the case, say so and propose the change
   — don't quietly open a second path.

3. **Fix the shared primitive, not the page.** When something is visually or behaviourally
   wrong on more than one page, the bug is in `PageHeader` / `SectionHeader` / `Card` /
   `DrawerShell` / `Toggle` / the typography classes / `globals.css`. Patching each call
   site guarantees the next page gets it wrong too. Specifically: toggle-thumb alignment,
   drawer animation states, and heading spacing are **always** fixed centrally.

4. **Respect the styling invariants.** They exist because each one broke the UI once:
   - heading classes are `.text-display` / `.text-h1` / `.text-h2` / `.text-h3` — `.h-1`
     and friends are Tailwind *height* utilities;
   - element-selector resets go inside `@layer base`, or they silently beat every utility;
   - new custom `text-*` typography classes must be registered in `cn.ts`'s `font-size`
     group;
   - no negative margins, no absolute positioning for layout, no fixed heights that can
     overlap.

5. **Keep the mock/api switch intact.** Every new service method must implement its mock
   path and either map through the shared API client/generated transport DTOs or throw
   `NotImplementedError` explicitly in API mode. Never fall back automatically from API
   to mock. That explicit branch is the Phase 2 migration seam.

6. **Preserve single-sourced relationships.** Form↔service lives on
   `FormTemplate.attachedServiceIds`; package↔service on `ServicePackage.items[].serviceId`.
   Never add the reverse field, and never dual-write. Reverse lookups are filters
   (`listFormsForService`, `listPackagesForService`).

7. **Test what you build, at the boundaries — not just the happy path.** The frontend has
   no runner yet (see TODO.md §2), so frontend work still exercises failure, empty, and
   permission/role paths by hand. Backend work uses pytest and must prove the negative —
   unavailable dependencies fail closed, unauthorised operations are rejected, and
   unknown resources use the error contract. A test that only asserts success is close to
   no test.

8. **Update the docs as part of the work, not after it.**
   - new or changed feature → update the `AGENTS.md` snapshot;
   - non-obvious decision, rejected alternative, or framework bug caught → a
     `HISTORY.md` entry;
   - something consciously not done → a `TODO.md` entry;
   - a `TODO.md` item completed → strikethrough + `DONE` **in place**, with what changed.
     Never delete it;
   - a product rule changed or added → the relevant `docs/PRODUCT.md` section.

   Docs that drift from the code are worse than no docs, because they are trusted.

9. **Question the design rather than blindly extending it.** Check `HISTORY.md` for the
   recorded rationale first — the thing you want to change may already have been argued.
   If the rationale doesn't hold, surface the better approach and the reasoning. Don't
   silently rewrite, and don't silently comply either.

10. **Wrap a swappable third-party dependency behind a local interface and a single
    factory**, so the vendor choice stays a one-file decision. The existing examples:
   `lucide-react` behind `Icon.tsx`, and the whole data layer behind
   `web/src/services/*.service.ts` + `web/src/lib/env.ts`. Phase 2's transactional-email provider
   and Phase 3's payment, scheduled-email, and calendar providers must arrive the same way
   — no provider SDK imported at a call site.

11. **Prefer additive changes over invasive rewrites.** This is a demo build whose value is
    that it works end to end. A refactor that touches thirty files to improve five is a
    bad trade unless the current shape is actively blocking the work.

12. **Fail open where it's safe, and log why a path degraded.** The i18n layer is the
    model: an unknown key falls back to English, then to the key itself, rather than
    throwing. Storage reads are wrapped in try/catch and return sane defaults. Silent
    degradation is only acceptable when the fallback is visible in the output; otherwise
    surface it.

13. **Report in-scope work you did not do.** If part of the task was blocked, skipped, or
    turned out to be a bad idea, say so explicitly and finish everything else in full.
    Scaling the work down is the user's call.

---

## Don't

1. **Don't run git operations unless explicitly asked.** No commits, no branches, no
   pushes, no PRs, no `git checkout`/`restore`/`stash`. Leave changes in the working tree
   for review. This is absolute.

2. **Don't reference internal ticket, task, or work-item labels in code or comments.**
   Narrative belongs in `HISTORY.md`; code comments explain the code. A comment saying
   "per the plan's step 4" is meaningless six months later.

3. **Don't assume a filename, type name, or location — check or ask.** The type barrel
   (`web/src/types/index.ts`) is incomplete, several services export similarly-named methods
   with different semantics, and route files live under parenthesised group directories.
   Guessing here produces plausible code that doesn't compile, or worse, compiles against
   the wrong module.

4. **Don't reformat, reorder, or "tidy" unrelated code.** It buries the real change in the
   diff. This includes import sorting, quote style, and comment rewrapping in files you
   only passed through.

5. **Don't introduce dependencies casually.** A small pure utility goes inline in
   `web/src/lib/`. A new package needs a stated reason, a look at what it pulls in, and — if it
   is swappable — a local wrapper (Do #10). The current dependency list is short on
   purpose. Related: don't rely on a transitive dependency's presence; if you import it,
   declare it (TODO.md §1 has a live example).

6. **Don't overclaim verification.** State exactly what you ran versus what you read.
   "`npx tsc --noEmit` and `npm run lint` pass; I loaded `/admin/clients/cli-002` and added
   a note" is useful. For backend work, name the pytest selection, Ruff, mypy, migrations,
   and whether PostgreSQL was real or stubbed. "Tested and working" is not evidence. If
   you didn't run the affected process or route, say so.

7. **Don't silently fix something flag-worthy.** A bug outside the task's scope, a doc that
   contradicts the code, a security-relevant assumption — surface it, even if you also fix
   it. The judgment about whether it matters is not yours to make alone.

8. **Don't reintroduce what was deliberately removed.** The list is in `docs/PRODUCT.md` per
   surface and in `HISTORY.md` with reasoning. The recurring ones: a `type`/category enum
   on `Service`; a "1:1 vs group" service type (branch on `capacity`); PayPal or SEPA;
   per-service manual payment instructions; a `purpose` field on forms; a
   package/program distinction; `Service.packageIds` or `Service.attachedFormIds`;
   an inquiry status enum; shared resources or client-facing next steps on the booking
   workspace; a redirect-only `page.tsx`; markdown-marker note editing.

9. **Don't let Phase 2 work silently change the Phase 1 demo.** The default and Vercel
   frontend remain mock-backed. API calls and real auth enter only opt-in API mode in
   coherent route bundles; Stripe, email, and calendar integrations remain separate future
   work. Representing a future capability in the UI (a reminder line, a placeholder link)
   remains the established Phase 1 pattern.

10. **Don't expose internal data to client-facing surfaces.** Service notes, session notes,
    client notes, and session action items are operator-only. The public booking flow and
    the booking workspace must never surface them. `clientVisible` on `SessionActionItem`
    is a placeholder for a future decision, not permission.

11. **Don't weaken the sanitisation assumption around client notes.** `NoteContent.tsx`
    renders stored HTML directly, which is safe only because the content is
    operator-authored via the local editor. If a change makes note bodies reachable from an
    API, an import, or a client, sanitisation is required **in the same change** — not as a
    follow-up.

12. **Don't put product copy decisions on autopilot.** The current Phase 1 mock is GBP and
    the Phase 2 real-data target is one EUR currency per workspace — never mix the two in
    one surface; "UK GDPR-aware" never "GDPR compliant"; "booking" never "reservation";
    "booking workspace" never "customer portal"; no medical, clinical, or compliance
    claims. Copy in this product is positioning, and positioning is a product rule.

---

## Communication

1. **Push back with reasoning when a spec seems wrong.** State the concern in a sentence
   or two, then deliver the work under explicitly stated assumptions. Don't stop with
   nothing delivered unless proceeding would be unsafe or would make the result useless if
   the assumption is wrong.

2. **If a concern is raised and the user reaffirms the request, that's the decision.**
   Acknowledge it once and build the full thing. Don't relitigate.

3. **End substantial work with a "deviations, all deliberate" section** listing every
   non-trivial departure from what was asked, each with its reason. A change nobody asked
   for and nobody was told about is the expensive kind.

4. **Say what you verified, in the verification vocabulary this project actually has**:
   from `web/`, frontend uses `npx tsc --noEmit`, `npm run lint`, and
   `PORT=3344 npm run dev` plus the specific routes loaded; from `server/`, backend uses
   `uv run pytest`, `uv run pytest -m integration`, `uv run ruff check .`, `uv run mypy`,
   Alembic, and explicit health probes as applicable. Distinguish "ran" from "read."

5. **Be concrete about what's left.** If the task is 90% done, name the 10% — don't report
   completion and let it surface later.
