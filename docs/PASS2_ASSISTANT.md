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
5. Clients → Sofia → Brief me → reload: the dated client briefing remains visible.
6. Settings → Account → Turkish or German → Assistant: controls use the saved language.
7. Settings → AI → Clear history → Confirm: chats and briefings disappear.
8. Settings → AI → Disable → Confirm: indexed context and history are removed.

Briefings are per client; manual regeneration has a 15-minute cooldown. (The workspace-wide
daily briefing was removed on 2026-11-18.)
A previous briefing remains dated and visible until replaced. Changed records, expired
reviews and conflicting edits require a fresh proposal, preserving the original review.

## Boundaries and operating model

- One proposed action per answer; explicit confirmation executes existing domain commands
  and records the result atomically, with version, impact and idempotency checks.
- Supported actions: create/update clients, tasks, services and packages; remove general to-dos; create one-off
  sessions; edit/cancel sessions with existing scopes; create/move/cancel/complete/no-show bookings.
- Email transfer, payments/approval, billing, access, settings, deletion of anything except reviewed general to-dos, messages,
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

## Conversation UI follow-up

The later Ask Slotera refinements update the mutable baseline for title state; the agent restores the local database after checks. Start with the same local-provider
command above. Assistant → Send shows the question immediately; a validated response appears
progressively. Stop cancels unfinished generation. Hover/focus a question → Edit and branch →
change text → Send creates a new sidebar conversation; the original remains. Copy controls
copy plain text. Settings → AI now shows a single daily usage percentage. Messages → select a client shows sent
bubbles on the right and incoming bubbles on the left; scroll to the top for older messages.

Hosted configuration belongs in `server/.env`: `SLOTERA_AI_PROVIDER=openai` and
`SLOTERA_AI_API_KEY`. Generation defaults to `SLOTERA_AI_MODEL=gpt-6-luna`; request routing
uses `gpt-6-luna`, and `SLOTERA_AI_EMBEDDING_MODEL=text-embedding-3-small` supplies 1536-D
search vectors. The developer runs `./scripts/env-check` and shares status-only output when
configuring hosted access; real provider checks remain in final integration verification.

Follow-up verification: 121 PostgreSQL and 119 isolated backend tests passed with Ruff and
mypy; 22 production browser checks passed across desktop/mobile EN/TR/DE, including edited
branches and a request stopped before generation. Safe results are recorded in
`performance/chat-browser-2026-11-17.json`; synthetic UI captures were visually inspected.

Earlier conversation-UI follow-up gate: type-check, ESLint and 153 Vitest tests passed. No dependency
was added for the conversation UI; the subsequent title refinement below updates the schema baseline.

Both mock and API production builds passed their fixture-boundary guards for this follow-up.
The local showcase database was restored after verification; the Ask Slotera refinement below
includes the later schema reset. Hosted-provider tests remain deferred.

## Ask Slotera refinements

Start the same local API stack. Ask Slotera → New chat shows a centered composer and empty
history guidance; send a prompt to see its short title appear in the left list. Scroll either
history list to load more. Right-click a chat row (or use its options button) → Delete chat →
Confirm removes it. Header Ask/Messages icons navigate directly. Settings → AI shows daily
usage as a percentage. Messages → Sofia shows four example messages with both directions.

The showcase-data implementation now includes that example conversation; the agent restores
the clean local showcase after checks so no manual reset is needed for this pass.


Verification for Ask Slotera (2026-11-17):

- Frontend type-check, ESLint and 156 Vitest tests (49 files) passed.
- Backend Ruff, mypy (128 source files), 119 isolated tests and 122 real-PostgreSQL tests passed.
- API and mock production builds passed with fixture-boundary checks.
- All 22 browser scenarios passed across the full run and focused communication rerun,
  covering desktop/mobile EN/TR/DE. The initial new mobile sample check omitted opening
  the collapsed conversation list; its navigation was corrected, without an application change.
  Exact results: `performance/ask-browser-2026-11-17.json`.
- Empty/chat/usage/sample-message captures were visually inspected on desktop and mobile.
- Both consolidated migrations rebuilt the local database; Alembic reported no schema drift.
  Confirmed four sample messages, two read/digest watermarks and zero AI conversations.
- Local showcase data is restored. No developer reset is needed; start with
  `SLOTERA_AI_PROVIDER=local ./scripts/dev --api --no-env`, open `http://localhost:3344`,
  and sign in with `hello@slotera.io` / `slotera-local-only`.

Settings → AI → Enable AI → Confirm enables local simulation and shows the single daily
percentage. Header Ask icon → New chat → send a question shows the centered empty composer,
then a short conversation title and response. Right-click its row (or use its options button)
→ Delete chat → Confirm removes it. Header Messages icon → Sofia Marin shows the four-message
example; on mobile, first open Conversations. Live provider checks remain on standby.

Deliberate addition: the row options button and keyboard menu provide the requested deletion
menu on touch devices and without a mouse. No other scope changes.


## Simple dashboard To-do (2026-11-17)

No database reset is required. Use the same local startup command and sign-in above.
Dashboard → To-do → type a title → Enter adds a checkbox row; checking it keeps it visibly
completed, without extra tabs or task editors. Ask Slotera → send `Add task Call Sofia` →
Review → Confirm adds a general to-do. Send `Remove task Call Sofia` → Review → Confirm
removes that exact item. Deletion waits for confirmation and stale reviews fail safely.
Local simulation requires an exact, unique title; hosted AI uses the same reviewed command.
Session tasks remain in Calendar and are excluded from dashboard To-do and AI removal.


## Today, checklist and messaging verification — 2026-11-17

- Frontend type-check, ESLint and 158 Vitest tests (51 files) passed.
- Backend Ruff and mypy (127 source files) passed, with 121 isolated and 125 real-PostgreSQL tests; the final local-summary provider selection passed all 13 tests.
- Both consolidated migrations rebuilt a dedicated test database, with no schema drift.
- API and mock production builds passed fixture-exclusion/retention checks.
- All 22 production browser scenarios passed across full and focused reruns on desktop/mobile EN/TR/DE. Exact results, corrected test assumptions and the intermittent client-load rerun are recorded in `performance/today-browser-2026-11-17.json`; deadlines were unchanged.
- Dashboard and messaging captures were visually inspected; booking routes were exercised by the booking workflows. Builds took several minutes under the developer's existing machine load.
- No real environment files, external providers or application database rows were used or changed; verification databases and owned servers were cleaned up.

Stop the current stack, then run `SLOTERA_AI_PROVIDER=local ./scripts/dev --api --no-env`.
No database reset is needed. Dashboard → To-do → type a title → Enter adds it; its checkbox
marks it complete without extra controls. Ask Slotera → `Add task Review notes` → Review →
Confirm adds it; `Remove task Review notes` uses the same explicit review to remove it.
Metrics omit undefined comparisons against a zero baseline, as confirmed.
Messages → choose a client shows the single composer with its internal send arrow; scrolling
the conversation list loads more rows. Bookings → open a status group shows compact badges
and vertically centered dates/prices. Live third-party checks remain on standby.

No scope deviations: the dashboard checklist is simplified; Calendar retains session tasks.


## Briefing and settings refinement — 2026-11-17

Implemented: generated reports are separate from chats, Today has only dated highlights and
an icon refresh, directory headers show named totals/state counts, the composer is single-line,
Business Profile includes Branding, and Notifications houses the existing email preferences.

Verification: type-check, ESLint and 160 Vitest tests passed; Ruff, mypy (127 files), 121
isolated tests and 130 real-PostgreSQL tests passed. Both baseline migrations rebuilt an
empty disposable database and Alembic found no schema drift. Transport types were regenerated.
Both mock/API production builds passed fixture-boundary checks. All 28 desktop/mobile EN/TR/DE
browser scenarios passed across the full run and six directory reruns; the latter corrected
a test matching both the global bell and settings Notifications button. Exact safe results:
`performance/settings-directory-browser-2026-11-17.json`. Dashboard, messaging and merged
settings captures were visually reviewed. Real environment files, external delivery and the
developer's running application database were not touched.

A reset is required once for the new thread-kind baseline. Stop the running stack, run
`./scripts/reset-db` (deletes local test data), then start with
`SLOTERA_AI_PROVIDER=local ./scripts/dev --api --no-env`. Sign in using the seeded
`hello@slotera.io` / `slotera-local-only`. Settings → AI → Enable AI → Confirm enables the
local provider. Dashboard → Today → cycle-arrows icon generates dated highlights without
introductory text; Ask Slotera shows chats only. Open Services, Packages, Forms and Clients
for named totals/state counts. Messages → Sofia shows the short single-line composer.
Settings → Business Profile includes Branding; Settings → Notifications shows email controls.
Mobile push remains future scope. No scope deviations.
