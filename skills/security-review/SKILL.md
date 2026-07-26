---
name: security-review
description: Use when touching auth, data access, external input, rendering of stored content, or payment flows — defensive secure-by-default review, plus threat modelling on request.
---

# Security Review

Defensive review for a codebase that has **no real security today and will need real
security soon**. The job is to keep Phase 1's shortcuts from hardening into Phase 2's
vulnerabilities.

> Skills are the workflow layer; **`docs/RULES.md` is the always-on convention layer and
> wins on any conflict.**

## Start here: what's actually true today

State this plainly rather than reviewing as if it weren't:

- **Authentication is fabricated.** `auth.service.ts` mints a `mock.<random>.<timestamp>`
  token client-side, writes it to `localStorage`, and nothing ever verifies it. Role is
  derived from an **email pattern** (`/^(admin|super(admin)?)@/i`). Anyone can hand-edit
  `localStorage` into a superadmin session.
- **Every route protection is cosmetic.** `AuthGuard` trusts what it reads. It is a UX
  affordance, not a boundary — and must be described that way, never as access control.
- **There is no server**, so no CSRF, no rate limiting, no server-side validation, and no
  secrets. `.env.local` holds two `NEXT_PUBLIC_*` values, both non-sensitive by design.
- **No real payment data exists.** Card forms are formatting-only; nothing is transmitted
  or stored.

Reporting "the auth is insecure" as a finding is noise. The useful findings are the ones
about what happens *next*.

## The invariants that must not be weakened

These are the places where a routine change can create a real problem.

**1. Stored HTML rendering.** `NoteContent.tsx` renders `ClientNote.body` via
`dangerouslySetInnerHTML`. This is acceptable **only** under a specific, narrow assumption:
the content is produced by the local Tiptap StarterKit editor, authored by the workspace
operator, and never sourced from a client, a network response, or an import.

That assumption is load-bearing and easy to break by accident. **Flag immediately** any
change that: fetches note bodies from an API, imports notes from a file or another system,
lets a client submit content into that field, or reuses `NoteContent` for content from a
different origin. Sanitisation must land **in the same change**, not as a follow-up — an
allow-list applied server-side on write *and* defensively on render.

**2. The client/operator data boundary.** Service notes, session notes, client notes, and
session action items are operator-only. The public booking flow and
`/booking/manage/demo` must never surface them. `clientVisible` on `SessionActionItem` is
a placeholder for a future product decision — **not** permission to render it publicly
today. Any change that pipes admin-sourced data into a `(public)` route is a finding.

**3. Payment confirmation.** Today a booking flips to `confirmed` when the user lands on
the success route. That's an accepted Phase 1 shortcut with a recorded forward rule: in
the real system a free booking confirms atomically, a manual-payment booking confirms when
verified, and **only a verified payment webhook may confirm a card-funded booking**. Treat
any new logic that depends on "landed on success = paid" as a finding, because it's the
shortcut most likely to survive into production by inertia.

**4. Storage key ownership.** `slotera.session` is touched only by `src/lib/session.ts`;
`slotera.register.draft` only by `src/lib/register-draft.ts`; `slotera.lang` only by
`src/lib/i18n.ts`. Reading or writing these anywhere else is a finding — scattered access
to auth state is how a "clear on logout" gets missed. Note that the register draft holds a
password in `sessionStorage` between `/register` and `/register/payment`; that's tolerable
only because nothing is real, and Phase 2 must not carry the pattern forward.

**5. Public-facing operator content.** Manual payment instructions, booking terms, and the
business profile are operator-authored free text rendered to unauthenticated visitors.
They are rendered as text today. If any becomes rich text, the sanitisation requirement
applies at a *lower* trust level than client notes, because the audience is the public.

## Phase 2 review checklist

When the backend work starts, these are the things to check on every change:

- **Authorisation is server-side.** Every endpoint re-derives the actor's identity and
  workspace from a verified token. `AuthGuard` stays a UX affordance.
- **Tenancy isolation.** Every query is scoped by workspace. This has no representation in
  the codebase today, which means there is exactly one chance to get it right — and the
  superadmin surface is the one place a cross-workspace read is legitimate, which makes it
  the place to look hardest.
- **Validate on the server, always.** Client-side validation is currently the only
  validation on every form (booking, contact, forms step, registration). It becomes a UX
  nicety the moment a server exists, not a control.
- **Migrations reviewed for data exposure** — a widened column, a dropped constraint, a
  backfill that crosses workspaces.
- **Secrets never in `NEXT_PUBLIC_*`.** Anything under that prefix is compiled into the
  client bundle. The two current variables are safe; a third one carrying an API key would
  not be.
- **Webhooks verify signatures** and are idempotent. A booking must not double-confirm on
  a retry.
- **Magic links** (deferred, `docs/TODO.md` §6) need signing, expiry, single-use semantics,
  and no sensitive data in the URL. Customers have no accounts — the link *is* the
  credential, so it carries the whole burden.

## Reviewing a change

1. **What crosses a trust boundary?** External input in, stored content out, or data
   moving between operator and client surfaces. If nothing crosses, the security surface is
   small — say so and move on rather than manufacturing findings.
2. **What does this assume about the author of the data?** Then ask what happens when that
   assumption is false.
3. **Would this be safe with a real database and 500 workspaces?** If the answer is "yes
   because there's only mock data," that's a deferral to record in `docs/TODO.md` §3, not a
   pass.
4. **Report findings with the concrete path**: input → where it's stored → where it's
   rendered → who can reach it. A finding without a path is a guess.

## Threat modelling on request

When asked explicitly: enumerate the actors (public visitor, client with a booking,
operator, platform staff, a compromised operator account), what each can reach, what each
would want, and which controls exist between them. Be concrete about which controls are
**currently absent** and which are deferred by design — the distinction between "missing"
and "not built yet, deliberately, and recorded" is the whole value of the exercise here.
