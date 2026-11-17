# Consultant assistant — local verification

The operator Assistant, client briefings and dashboard briefing use one tenant-scoped
retrieval and reviewed-command pipeline. AI starts disabled, on both plans. Settings → AI
explains what leaves the server before workspace opt-in. Provider keys stay server-side.

## Start and walk through

Stop the running stack, then from the repository root:

```sh
uv sync --locked --project server
npm ci --prefix web
./scripts/reset-db
SLOTERA_AI_PROVIDER=local ./scripts/dev --api --no-env
```

The reset is required for this changed two-revision development baseline; it deletes local
showcase data. The local provider is explicitly simulated and makes no external AI calls. The default mock
demo offers simulated read-only answers; reviewed mutations are verified in local API mode.
Open http://localhost:3344; sign in with `hello@slotera.io` / `slotera-local-only`.

1. Settings → AI → Enable → Confirm: indexing starts and local simulation is labelled.
2. Assistant → ask “What is on my agenda?” → Send: a dated answer links to recorded sources.
3. Ask “Add task Prepare tomorrow’s notes” → Send: no task changes before review.
4. Review change → Confirm change → Dashboard: the task appears once.
5. Dashboard → Brief me → reload: the dated briefing remains visible.
6. Clients → Sofia → Brief me: a separate client briefing appears.
7. Settings → Account → Turkish or German → Assistant: controls use the saved language.
8. Settings → AI → Clear history → Confirm: chats and briefings disappear.
9. Settings → AI → Disable → Confirm: indexed context and history are removed.

Daily briefings use a 9am workspace-time cycle; manual regeneration has a 15-minute cooldown.
A previous briefing remains dated and visible until replaced. Changed records, expired
reviews and conflicting edits require a fresh proposal, preserving the original review.

## Boundaries and operating model

- One proposed action per answer; explicit confirmation executes existing domain commands
  and records the result atomically, with version, impact and idempotency checks.
- Supported actions: create/update clients, tasks, services and packages; create one-off
  sessions; edit/cancel sessions with existing scopes; create/move/cancel/complete/no-show bookings.
- Email transfer, payments/approval, billing, access, settings, hard deletion, messages,
  note/form writing and voice/video remain outside assistant actions.
- Current structured records are queried directly; private narratives and curated app help
  use PostgreSQL full-text plus exact pgvector cosine retrieval and reciprocal-rank fusion.
  Pilot-sized exact search avoids an approximate-index recall tradeoff; no separate reranker.
- Index jobs are leased, bounded and source-revision checked; edits remove stale vectors
  immediately. Incomplete or failed indexing is disclosed rather than treated as no records.
- Workspace-local limits: 50 successful answers, 250,000 generation/routing tokens,
  100,000 indexing tokens per day and two simultaneous generations. Reservations bound
  provider calls before they begin; unknown failed-call costs retain their reservation.
- Chats/briefings expire after 30 days through existing maintenance. Client erasure removes
  that client’s index and all workspace AI history/proposals conservatively; epoch and
  transaction-snapshot fences prevent in-flight results from restoring removed context.
- Operator history is actor-scoped; workspace exports contain entered AI history. Derived
  indexes, budgets, jobs and revision journals are excluded. Provider inputs and answers
  never enter logs; only safe identifiers, timing, model, calls and usage are recorded.
- OpenAI Responses use `store:false`; this does not promise zero provider abuse-monitoring
  retention. Live quality, provider behavior and billing require final integration checks.

For hosted configuration, use the optional AI variables in `server/env.example`; the
developer runs `./scripts/env-check` and supplies status-only output before live checks.
Never paste keys. Changing embedding models requires disabling and re-enabling the index;
only 1536-dimensional embeddings are supported by this schema.

## Refactoring evaluation

The assistant is split by provider, retrieval, jobs, generation, reviewed actions, API and
UI responsibilities. Existing command implementations remain the authority; the transaction
context lets them compose without internal HTTP or independent commits. The booking
repository is 1,173 lines and scheduling repository 405 lines; their existing financial and
lifecycle boundaries remain intact. Further splitting these modules is unnecessary for this release and would broaden
risk; extract a shared domain helper when another real caller needs the same behavior.

## Verification evidence

Final serial verification (2026-11-17):

- Frontend: type-check, ESLint and 147 Vitest tests passed.
- Backend: Ruff, mypy (128 source files), 119 isolated tests and 117 real-PostgreSQL tests passed.
- All 22 production Chromium checks passed: desktop/mobile in English, Turkish and German.
- API and mock production builds passed their fixture-exclusion/retention guards.
- Both consolidated migrations rebuilt an empty database; Alembic found no schema drift.
- Offline uv lockfile check and both launcher process-ownership tests passed.
- Read benchmark: two workspaces, each with 1,000 clients and 10,000 bookings, five concurrent
  readers, p50 30.40ms, p95 41.83ms, six queries per ledger read and a 14,550-byte response.
  Hardware and execution plans: `performance/assistant-2026-11-17.json`; safe browser
  evidence: `performance/assistant-browser-2026-11-17.json`.

Earlier resource-contended attempts hit unchanged test deadlines and PostgreSQL restarted
once; the final serial checks above passed without relaxed thresholds. Providers were local
simulation or console-based throughout. Live third-party verification remains on standby.
