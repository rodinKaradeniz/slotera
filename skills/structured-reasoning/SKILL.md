---
name: structured-reasoning
description: Use for complex, multi-tradeoff problems — decomposes the question into explicit steps and makes the tradeoffs visible before committing to an answer.
---

# Structured Reasoning

For problems where the hard part is *deciding*, not typing. Use when a question has
several defensible answers, when constraints pull against each other, or when the cost of
picking wrong is a rewrite rather than an edit.

Do **not** use it for straightforward work — narrating a decomposition of a one-file
change is noise.

> Skills are the workflow layer; **`docs/RULES.md` is the always-on convention layer and
> wins on any conflict.**

## When it earns its keep here

- Modelling decisions that touch `src/types/` — a field added to a shared type is
  load-bearing across services, fixtures, forms, and three translation files.
- Anything that will outlive Phase 1: the API surface, the service-layer boundary, the
  shape of a relationship.
- Changes that cross surfaces (operator ↔ public, admin ↔ superadmin), where a shortcut on
  one side becomes a constraint on the other.
- Situations where `docs/HISTORY.md` records a decision that no longer obviously holds and
  you're deciding whether to keep it.

## The method

**1. State the actual question.** Usually narrower than the request. "Should packages
support credits?" is often really "does the demo need to show a balance, or just a
sequence?" Write the question you're answering; if it differs from the one asked, say so.

**2. Surface the constraints, separating hard from soft.**

Hard constraints on this project, which are not yours to trade away:
- Phase 1 is frontend-only — no backend, no real auth, no payment provider, no email.
- Product rules in `docs/PRODUCT.md` — vocabulary, positioning, the "never reintroduce" list.
- Single-sourced relationships; no dual-write.
- Internal notes and action items never reach client-facing surfaces.

Soft constraints, which are tradeable with reasoning: file count, abstraction level,
fixture size, how much of a future capability to represent.

**3. Check the record before generating options.** `docs/HISTORY.md` has a "Rejected
alternatives" table. If your option is in it, either adopt the recorded reasoning or
argue specifically against it — don't rediscover it silently.

**4. Generate at least two real options.** A straw man doesn't count. Each needs: what it
looks like concretely, what it costs now, and what it costs at Phase 2 when a real
database and real tenancy exist.

**5. Name the tradeoff axis.** Usually one of:
- *Now vs. later* — a shortcut that's fine in mock and lethal with real data. The
  confirm-on-success-route booking is the canonical example: acceptable today, must not
  harden.
- *Specific vs. general* — a fixed enum reads clean and blocks the next vertical; the
  product model is deliberately generic (see: no `type` field on `Service`).
- *Local vs. shared* — a local fix is one file; a primitive fix is six pages at once.
- *Represent vs. build* — showing a future capability in the UI without implementing it is
  an established pattern here, not a cop-out.

**6. Recommend one, with the condition that would change it.** "Display-only package
context, because there is no purchase path to consume credits against — revisit when
checkout exists." A recommendation without its invalidating condition is an opinion.

**7. Say what you'd need to be sure.** If the deciding fact is unknown and knowable, go
look. If it's a product call, ask — one question with a recommendation attached, not a
survey.

## Output shape

Short. The reasoning is a tool, not the deliverable:

```
Question:      <the narrowed question>
Constraints:   <hard ones that eliminate options>
Options:       A — <what it is> / cost now / cost at Phase 2
               B — <what it is> / cost now / cost at Phase 2
Tradeoff:      <the axis>
Recommend:     <one>, because <reason>. Revisit if <condition>.
```

Then build it. If the decision was non-obvious, it belongs in `docs/HISTORY.md` as an
entry — including the option you rejected and why. That's what stops the same question
being re-argued in three months.
