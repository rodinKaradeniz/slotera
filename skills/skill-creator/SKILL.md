---
name: skill-creator
description: Use when a recurring workflow, convention, or hard-won lesson should be codified as a new reusable skill — covers when a skill is the right vehicle and how to write one that gets used.
---

# Skill Creator

For turning a recurring workflow into a reusable module. Also for deciding — often — that
a skill is the *wrong* vehicle and something else should carry the knowledge.

> Skills are the workflow layer; **`docs/RULES.md` is the always-on convention layer and
> wins on any conflict.** A new skill must not contradict it; if it needs to, the rule
> changes first.

## First: is a skill the right home?

Most knowledge worth writing down does **not** belong in a skill. Route it:

| The knowledge is… | It belongs in |
|---|---|
| A rule that applies to *every* task | `docs/RULES.md` |
| Why something is built the way it is | `docs/HISTORY.md` |
| Something deliberately not built | `docs/TODO.md` |
| What currently exists / how to run it | `AGENTS.md` |
| A product rule — positioning, vocabulary, what a surface may contain | `docs/PRODUCT.md` |
| **A repeatable *procedure* for a *specific kind* of task** | **a skill** |

The test: does it change *how you work* when a particular kind of task shows up, and stay
irrelevant the rest of the time? That's a skill. If it applies always, it's a rule. If it
explains a past decision, it's history.

Two more disqualifiers:
- **Used once.** Codify on the second or third recurrence, not the first. A skill written
  from a single instance encodes that instance's accidents.
- **Better as code.** A convention you can enforce with a lint rule, a type, or a shared
  helper should be enforced there. `src/lib/cn.ts` is a convention made unbreakable —
  worth more than a document asking people to remember.

## Format

```
skills/<skill-name>/SKILL.md          # canonical — readable by any tool
.claude/skills/<skill-name>           # symlink → ../../skills/<skill-name>
```

`skills/` is the canonical, vendor-neutral location. `.claude/skills/` holds symlinks into
it so assistants with native skill discovery pick up the same files — one copy, two access
paths. Create the module under `skills/`, symlink it, and add a row to the **Workflow
modules** table in `AGENTS.md` (that table is how tools without native discovery find it).

```markdown
---
name: <kebab-case, matches the folder name>
description: <one line: when to use it. This is what gets matched for relevance.>
---

# <Title>

<what it is, when to use it, how it changes your approach>
```

**The `description` is the highest-leverage line in the file.** It is what determines
whether the skill surfaces at the right moment. Write it as a *trigger condition*, not a
summary:

- Good: "Use when touching auth, data access, external input, or payment flows — …"
- Bad: "A skill about security."

Lead with "Use when…" and name the concrete situations.

## Writing a body that actually gets used

**Be specific to this project.** A skill that could apply to any repository will be
ignored in favour of general judgment, because it adds nothing. Name real files, real
commands, real invariants:

- the real commands (`npx tsc --noEmit`, `npm run lint`, `PORT=3344 npm run dev`) — and
  the fact that there is no test runner;
- real paths (`src/services/*.service.ts`, `src/lib/status-maps.ts`,
  `src/components/ui/Icon.tsx`);
- real constraints (the mock/api guard, single-sourced relationships, the
  `dangerouslySetInnerHTML` trust assumption, internal notes never reaching clients).

**Include the failure it prevents.** The most useful line in a skill is usually "this went
wrong once, here's the shape of it." Abstract advice is forgettable; a named failure mode
is not.

**Say what *not* to do**, explicitly. Boundaries are more actionable than encouragement,
and this codebase has a long list of deliberately-removed patterns that keep wanting to
come back.

**Keep it short enough to read at the start of a task.** A page or two. If it's growing
past that, it's probably two skills, or it's reference material that belongs in `docs/`.

**Don't restate the rules.** Reference `docs/RULES.md` rather than copying it — two copies
of a rule drift, and the copy is always the stale one.

## Naming

Kebab-case, folder name matches `name` in the frontmatter. Name it after the **activity**
(`test-authoring`, `security-review`), not the role (`senior-engineer`) or the vibe
(`do-it-well`). Activity names match how tasks are described; role names don't.

Keep project-specific skills out of any set you intend to reuse elsewhere. A skill tied to
this data model, this design language, or this product's positioning is legitimately
project-specific — just don't mix it into a portable baseline.

## After creating one

1. Add a row to the **Workflow modules** table in `AGENTS.md`, and symlink it into
   `.claude/skills/`.
2. If it encodes a decision about *how the project works* rather than just a procedure,
   add a `docs/HISTORY.md` entry too — the skill says what to do, history says why.
3. Use it on the next relevant task and fix what turns out to be vague. A skill that has
   never been applied is a draft.

## Retiring one

A skill that no longer matches the codebase is worse than a missing one — it's confidently
wrong. When the ground shifts (a test runner arrives, the backend lands, a pattern is
replaced), update or delete the skill in the same change. Deleting is fine; the reasoning
survives in `docs/HISTORY.md` if it mattered.
