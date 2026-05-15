# Chapter 2 · Agent Framework

**Status:** DRAFT for review. Hold all code until explicit spec approval.
**Author:** Cod, 2026-05-15.
**Prior chapter:** [`chapter-01/CHAPTER_01_COMPLETION.md`](./chapter-01/CHAPTER_01_COMPLETION.md).

---

## 0. Chapter goal

Replace the four one-off Phase 01 synthesizers with a shared agent framework that scales to all 20 agents across Phases 01-05. Make the user's AI workforce visible in an Agent Console. Fix the 504 UX lie at lock by switching dispatch to a pattern that hits 10/10 reliability. Wire chain orchestration so Phase 01 completion triggers Phase 02 readiness. Add a notification surface (in-app + email) so the user knows when work is done.

The chapter starts with code-as-spec for the agent contract that every agent will conform to from here on. Phase 01 synthesizers get refactored onto the framework first to prove it. Phase 02 agents follow on the same shape. The framework is the load-bearing piece for the rest of QB BrandOS.

---

## 1. Locked decisions from Chapter 1

These are not re-decided here:
- Vanilla HTML/CSS/JS only. No frameworks. No build step.
- Anthropic API via `claude-sonnet-4-6`. `api/claude.js` proxies the request.
- Supabase as the database. PostgREST for application reads. Service-role for service-only writes.
- Vercel Edge runtime for `/api/*`. Node runtime only when explicitly justified.
- Stripe webhook-driven tier flips. The webhook is HMAC-verified, dedup via `stripe_events`.
- Tier-server-authoritative everywhere (PR #60). Surfaces read tier from `/api/qbp`, never from localStorage.
- The 10 Chapter 1 migrations stay. Migration 010 (`dispatch_jobs`) revives in this chapter.
- Brand voice: voice codex + design system v3.4 still apply.

---

## 2. Architectural decision: dispatch pattern

This is the only architectural call to make before any code. The rest of the spec hangs off this choice.

### Option A · Edge-with-async-dispatch, done right

Keep all `/api/*` on Vercel Edge. The lock and regenerate endpoints insert artifact rows AND a `dispatch_jobs` row, then fire child Edge fetches without awaiting, and return 202. The client polls.

**What PR #59 got wrong:** child fetches were fire-and-forget without first ensuring the connection was established. 1 of 10 runs lost all four fetches.

**What gets fixed in this option:**
- Pre-insert four artifact rows with `status='queued'` and `dispatch_id` set BEFORE firing child fetches. The polling client sees `queued` immediately regardless of what happens to the fetches.
- Use Vercel's documented `context.waitUntil()` API for the child fetches so the parent's lifetime extends past return. This is the explicit Edge primitive for fire-and-forget work.
- Add a reaper: a cron-triggered (or webhook-triggered) sweep that picks up `dispatch_jobs` rows whose status is `producing` for >120 s with no artifact movement, and re-fires the dispatches.

**Cost:** moderate. ~1 day to wire `waitUntil` correctly, ~1 day for the reaper, ~1 day for the migration to all four agents.

**Reliability target:** 10 of 10. Reaper is the safety net for the residual fire-and-forget cancel rate.

**Scale ceiling:** acceptable for the first 1,000 users. At ~100 concurrent locks Vercel's edge concurrency limits become the bottleneck.

### Option B · Durable queue runner

Replace the fire-and-forget pattern with an explicit job queue. The lock endpoint enqueues a job and returns 202; a worker (Inngest, Trigger.dev, or Vercel Queues) picks the job up and runs the four agent dispatches in series or parallel.

**Pros:**
- Retries, exponential backoff, dead-letter queue all come for free.
- Workers can be Node (no 25 s budget cap).
- Job state is queryable from the runner's dashboard.
- Scales horizontally.

**Cons:**
- New dependency. New monthly cost ($20-$50 for Inngest/Trigger at our scale; Vercel Queues is bundled).
- Migration of 4 agents to the worker pattern is more invasive than Option A.
- Adds an external surface that can fail. Not all failures will be observable from our existing logs.
- Vercel Queues is in beta; the others are stable but ship with their own conventions.

**Cost:** higher. ~1 day to evaluate + pick a runner, ~2 days to wire one agent end-to-end, ~1 day per remaining agent.

**Reliability target:** 10 of 10. Queues are designed for this; the underlying retry primitives are battle-tested.

**Scale ceiling:** practically unlimited at our scale.

### Cod's recommendation: **Option A first, with a documented escape hatch to Option B.**

**Reasoning:**

1. **The Chapter 1 codebase is already Edge-native.** Switching to a queue runner means refactoring the entire dispatch path. That's a real chunk of Chapter 2 budget, and it's not where the user-visible value lives. The Agent Console is the user-visible win.

2. **Option A is enough for the next 1,000 users.** We don't have load. We have correctness. Pre-inserted artifact rows + `waitUntil` + reaper gives us correctness without the migration cost.

3. **Option B is reversible.** Once Option A is shipped with `dispatch_jobs` rows as the durable job-state record, swapping the executor from "fire-and-forget Edge fetch" to "queue worker" is a contained change. The data model is unchanged. The contract from the lock/regenerate endpoints is unchanged. Only the runner swaps. That's a Chapter 9 or 10 task.

4. **The 504 UX lie is fixed independently of the runner choice.** As long as the lock endpoint returns 202 with `dispatch_id` and the artifact rows are pre-inserted, the toast can be honest and the polling can paint state.

5. **The reaper is good hygiene.** Even if Option B ships later, the reaper as a sweep of stuck jobs is the kind of operational primitive that prevents silent failures across the entire system, not only dispatch.

**Decision deadline:** before Chapter 2 step 1 starts. If you disagree, this is the place to push back.

If you pick Option B instead, sections §5 and §6 of this spec swap "fire dispatch fetch" for "enqueue job"; everything else stays.

---

## 3. The agent contract

Every agent in QB BrandOS conforms to this contract from Chapter 2 forward.

### 3.1 Identity

Each agent declares:
- `slug` (canonical underscored: `soul_map_synthesizer`)
- `phase` (string: `00` through `05`)
- `tier_required` (string: `free` or `starter` · used by tier-gating module)
- `display_name` (human-readable: "Soul Map Synthesizer")
- `description` (one sentence, used in the Agent Console)
- `artifact_type` (the value written to `artifacts.artifact_type`)
- `version` (integer; bump when the agent's prompt or output schema changes meaningfully)

### 3.2 Inputs

Each agent declares the data it reads. Three kinds:
- `qbp_fields[]` · keys from `profiles.qbp` the agent needs (e.g. `brandEssence`, `manifesto`)
- `artifact_dependencies[]` · slugs of other agents whose latest delivered artifact this agent reads (e.g. War Table reads the latest delivered Soul Map)
- `runtime_args{}` · optional kwargs (e.g. a regenerate event might carry a `feedback` arg from the Content Approval Loop)

The runtime validates: if any required `qbp_field` is missing, or any `artifact_dependency` isn't `delivered`, the agent fails with `missing_inputs` and does not call Claude.

### 3.3 Triggers

How an agent can be invoked:
- `lock` · the user locks their foundation. All Phase 01 agents fire.
- `chain` · another agent completing causes this agent to fire (e.g. Logo Direction fires after Visual DNA delivers).
- `manual` · user clicks "Run" on the Agent Console.
- `regenerate` · user clicks "Re-run with feedback" on an artifact.
- `scheduled` · cron (e.g. Quarterly Brand Review fires every 90 days). Out of scope for Chapter 2, but the trigger type exists in the contract.

Each agent declares which triggers are valid.

### 3.4 Output contract

Agent returns one of:
- `{ ok: true, content, meta }` · schema-validated content + meta (tokens_in, tokens_out, duration_ms)
- `{ ok: false, error, stage, missing? }` · failure with stage (`missing-inputs`, `model-call`, `schema-validation`, `edge_timeout`, etc)

Content schema is per-agent and validated against `js/qb-artifact-schema.js`. Failure paths write `status='failed'` and an error string to `artifacts.error`.

### 3.5 The agent module shape

```js
// /agents/<slug>.js
export const META = {
  slug: 'soul_map_synthesizer',
  phase: '01',
  tier_required: 'free',
  display_name: 'Soul Map Synthesizer',
  description: 'Distills your brand essence into a readable Soul Map.',
  artifact_type: 'soul_map_synthesizer',
  version: 2,
  inputs: {
    qbp_fields: ['brandEssence', 'manifesto', 'paradox', 'antiBrand', 'alwaysNever'],
    artifact_dependencies: [],
    runtime_args: { feedback: 'optional' },
  },
  triggers: ['lock', 'manual', 'regenerate'],
};

export async function run({ qbp, dependencies, runtime_args, anthropicKey }) {
  // Returns { ok, content, meta } or { ok: false, error, stage }
}
```

### 3.6 Agent registry

A single `agents/registry.js` exports `AGENTS` keyed by slug. The runtime imports the registry only. Adding a new agent = adding one file under `/agents/` and one line in the registry. The four Chapter 1 synthesizers move from `api/agents/*` to `/agents/` and become contract-conformant.

---

## 4. Data model

### 4.1 New: `agent_runs` (replaces / generalizes `artifact_runs`)

| column | type | notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `dispatch_id` | uuid fk → dispatch_jobs.id | nullable for manual runs |
| `agent_slug` | text | matches META.slug |
| `agent_version` | int | matches META.version at run time |
| `user_id` | uuid fk → auth.users | for RLS |
| `artifact_id` | uuid fk → artifacts.id | the row this run produced/will produce |
| `trigger` | text | enum: `lock`, `chain`, `manual`, `regenerate`, `scheduled` |
| `status` | text | enum: `started`, `succeeded`, `failed` |
| `started_at` | timestamptz | default now() |
| `completed_at` | timestamptz | null until done |
| `duration_ms` | int | |
| `tokens_in` | int | |
| `tokens_out` | int | |
| `model` | text | `claude-sonnet-4-6` |
| `error` | jsonb | `{ stage, message, missing_inputs?, raw? }` |

`artifact_runs` from Chapter 1 is renamed to `agent_runs` via migration. Same columns + new ones. RLS: user can SELECT own runs.

### 4.2 Extend: `dispatch_jobs`

Already exists from migration 010. Extend with:
- `trigger` · enum matching agent run trigger
- `parent_agent_slug` · for chain triggers, which upstream agent's completion caused this dispatch
- `agents_count` · how many agents were enqueued (4 for lock, 1 for chain/manual/regenerate)
- `agents_settled` · running count of agents that have reached terminal state

### 4.3 New: `notifications`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `user_id` | uuid fk → auth.users | |
| `kind` | text | enum: `artifact_ready`, `chain_ready`, `dispatch_failed`, `quarterly_due` |
| `agent_slug` | text | nullable; for artifact_ready/chain_ready |
| `artifact_id` | uuid fk → artifacts | nullable |
| `payload` | jsonb | optional structured data |
| `read_at` | timestamptz | null until user marks read |
| `created_at` | timestamptz | default now() |

In-app notification bell on the Agent Console + email per matching template.

### 4.4 No changes (carried from Chapter 1)
- `profiles` (tier, tier_started_at, foundation_locked_at, qbp, tool_completions, stripe_*)
- `artifacts` (id, user_id, artifact_type, phase, version, parent_artifact_id, content, status, error, dispatch_id, created_at, updated_at)
- `qbp_revisions`
- `stripe_events`

### 4.5 Migrations

| # | file | content |
| --- | --- | --- |
| 011 | `011_artifact_runs_to_agent_runs.sql` | RENAME TABLE; add new columns; preserve existing rows |
| 012 | `012_dispatch_jobs_extend.sql` | ADD trigger, parent_agent_slug, agents_count, agents_settled |
| 013 | `013_notifications.sql` | CREATE TABLE notifications + RLS |
| 014 | `014_agent_registry_seed.sql` | Optional. If we want a SQL-side registry mirror for analytics, seed with the 4 Phase 01 agents. Otherwise skip. |

---

## 5. Runtime

### 5.1 `/api/lock-foundation` (refactored)

1. JWT verify. Profile read. Idempotency check on `foundation_locked_at`.
2. Validate Phase 01 completion against REQUIRED_TOOLS.
3. PATCH `foundation_locked_at` + `foundation_lock_qbp`.
4. Insert `dispatch_jobs` row: `kind='lock'`, `status='producing'`, `agents_count=4`.
5. Insert four `artifacts` rows with `status='queued'`, `dispatch_id=<jobs.id>`, correct version + parent_artifact_id.
6. Use `context.waitUntil()` to fire four child `fetch('/api/agents/run', ...)` requests.
7. Send foundation-locked email (already wired).
8. Return 202 with `{ ok: true, lockedAt, dispatch_id, agents: [4 slugs], artifact_ids: [4 uuids] }`.

The artifact rows exist regardless of whether the child fetches successfully fire. Polling sees them immediately.

### 5.2 `/api/agents/run` (replaces `/api/agents/dispatch`)

POST `{ user_id, agent_slug, dispatch_id, artifact_id, trigger, runtime_args }`.

1. Verify caller. Either: same-origin authenticated user, OR same-origin service call from lock/regenerate with a signed inter-edge token (HMAC-SHA256 over the body using `INTER_EDGE_SECRET`).
2. Look up agent META from registry.
3. Read inputs: pull qbp_fields from profile; pull artifact_dependencies (latest delivered per slug).
4. If any required input is missing → write artifact row to `failed` with `missing_inputs`; open + close `agent_runs` row; return 200 with `{ ok: false, error: 'missing_inputs', missing }`.
5. Insert `agent_runs` row: `status='started'`, `trigger`, `dispatch_id`, etc.
6. Flip artifact `status='generating'`.
7. Run agent (Claude call inside the 25 s budget).
8. Validate output schema.
9. On success: PATCH artifact to `delivered` + content; close run as `succeeded`; send artifact-ready email; check chain triggers (see §5.4).
10. On failure: PATCH artifact to `failed` + error; close run as `failed`.
11. Update `dispatch_jobs.agents_settled` and flip `dispatch_jobs.status` to `completed` when all four artifacts reach terminal state.
12. Return 200 with run summary.

### 5.3 `/api/artifacts/[id]/regenerate` (refactored)

Same pattern as lock but for a single agent. Insert a new `dispatch_jobs` row with `kind='regenerate'`, `agents_count=1`. Insert one new artifact row with bumped version. Fire one `/api/agents/run` via `waitUntil`. Return 202.

### 5.4 Chain orchestration

When `/api/agents/run` finishes a successful delivery:

1. Look up which agents have `artifact_dependencies` that include the upstream agent's slug.
2. For each downstream agent, check if its other dependencies are also satisfied (latest delivered).
3. If satisfied AND no in-flight artifact for that agent: insert a new `dispatch_jobs` row with `kind='chain'`, `parent_agent_slug=<upstream>`, fire a new artifact + run.

Phase 01 → Phase 02 example: when all four Phase 01 synthesizers deliver, Phase 02 agents (Logo Direction, Logo Evaluation, Voice Guide) that depend on them auto-fire.

Tier gating: chain triggers respect tier. A free user who completes Phase 01 will NOT auto-fire Phase 02 chain triggers (those are starter-only). Chain firing is wrapped in `canRun(tier, agent_slug)` from the tier-gating module.

### 5.5 Reaper

`/api/cron/reaper` · a Vercel Cron job that runs every 2 minutes. For each `dispatch_jobs` row with `status='producing'` AND `created_at < now() - 2 minutes`:

1. Read child artifacts. If any are still `queued`, treat as stuck.
2. Re-fire `/api/agents/run` for each stuck artifact.
3. Increment a `retry_count` column on `dispatch_jobs` (add via migration 012). If retry_count > 3, flip dispatch_jobs status to `failed` and emit a `dispatch_failed` notification.

Cron is declared in `vercel.json`:
```json
"crons": [{ "path": "/api/cron/reaper", "schedule": "*/2 * * * *" }]
```

### 5.6 Inter-edge auth

When the lock endpoint fires a child `fetch` to `/api/agents/run`, the child needs to know the call is legitimate. Two options:
- The user's bearer token (works but ties the child run to the user's session lifetime; not ideal for cron-triggered chains).
- A signed inter-edge HMAC of the body + timestamp using `INTER_EDGE_SECRET` (new Vercel env var).

Use the HMAC approach. Reaper, chain triggers, and lock's child fetches all sign their POST bodies. The handler verifies. Service calls bypass the JWT auth path entirely.

### 5.7 Migration of the four Chapter 1 synthesizers

The agent code currently lives at `api/agents/<name>-synthesizer.js`. Each file exports a `run<Name>Synthesizer` function. Refactor:
1. Move to `/agents/<slug>.js` with the contract shape from §3.5.
2. Update `api/agents/dispatch.js` → split into `/api/agents/run.js` (the runtime) and `agents/registry.js` (the META index).
3. Update lock-foundation + regenerate to call the new run endpoint.
4. Migration 011 renames `artifact_runs` → `agent_runs` and adds the new columns.

The four agents themselves stay functionally identical. The framework wraps them.

---

## 6. The Agent Console surface

### 6.1 Route

`/agents` · Cod-named "Agent Console" per the chapter goal. Sticky-nav app surface (per design system v3.4 §20.14).

### 6.2 Layout

Three tab views switchable via the eyebrow row:

**Phase view (default).** Five phase cards (01-05). Each card shows the phase name, the agents in that phase, per-agent status (ready / producing / delivered / failed / locked), and a "Run" button per manual-trigger-eligible agent. Free users see Phase 01 agents unlocked, Phase 02-05 paywalled with tier-locked treatment.

**Run history view.** Reverse-chronological list of every `agent_runs` row for this user. Each row shows agent name, trigger, status, duration, tokens. Click a run to see the input snapshot + error if failed. This is the diagnostic surface.

**Chain view.** Visualization of dependency DAG. Each agent is a node. Edges are `artifact_dependencies`. Nodes are colored by status. Hovering shows the artifact_id + last-delivered timestamp.

### 6.3 Components

New components added to the library (`js/qb-components.js`):
- `createAgentCard({ agent, status, lastRunAt, onRun })` · used in Phase view
- `createRunRow({ run, onClick })` · used in Run history view
- `createAgentDAG({ agents, runs })` · used in Chain view (SVG-rendered)
- `createNotificationBell({ count, onClick })` · top-right of the nav

### 6.4 States

- **Cold:** user hasn't locked foundation. Phase 01 agents show "Complete the foundation to run." Phase 02-05 show "Phase 01 first."
- **Foundation locked, agents producing:** "Producing" badge with a small spinner. Polling cadence 3 s.
- **All Phase 01 delivered, free tier:** Phase 01 agents show "Delivered." Phase 02-05 cards show paywall.
- **All Phase 01 delivered, starter tier:** Phase 02 agents become runnable.
- **Failed run:** Failed badge on the agent card. "Run again" pill. Clicking shows the error from `agent_runs.error`.

### 6.5 Empty + error states

| state | render |
| --- | --- |
| No agents yet (anonymous) | Redirect to `/auth?next=/agents` |
| Foundation not locked | "Lock your foundation to see your agents at work" + CTA to `/foundation` |
| Phase X has no agents yet (Phases 04-05 in Chapter 2 reality) | Show the phase card with "Coming soon" status and roadmap |
| API failure on initial load | Generic error empty state with reload CTA |

### 6.6 Mobile

360 px minimum width. Phase cards stack. Run history rows compress to two-line stacked layout. Chain DAG falls back to a vertical list with arrow indicators on mobile (the SVG is desktop-only).

---

## 7. Notifications

### 7.1 In-app

Bell icon top-right of the Agent Console (and Foundation, Archive, QBP, Account once we add it). Count shows unread notifications. Click opens a popover with the last 20.

Each notification is a `notifications` row. Read state is `read_at` timestamp.

### 7.2 Email

Existing artifact-ready + foundation-locked emails (from Chapter 1) continue. New emails for Chapter 2:

| trigger | template | sent to |
| --- | --- | --- |
| `chain_ready` | "Your Logo Direction is ready" (when Phase 02 agents chain-fire after Phase 01) | user |
| `dispatch_failed` | "Something went wrong producing your <artifact>" (after reaper exhausts retries) | user + me@qtmbg.com |

All new emails are transactional (no `List-Unsubscribe` header per EMAIL_DELIVERABILITY.md).

### 7.3 Notification trigger logic

- `artifact_ready`: emitted by `/api/agents/run` when an artifact delivers successfully. One per artifact.
- `chain_ready`: emitted by chain orchestration when a downstream agent auto-fires. The notification is for the upstream agent's success that unlocked the downstream.
- `dispatch_failed`: emitted by the reaper when retry count exceeds 3.
- `quarterly_due`: deferred to Chapter 9 (Quarterly Brand Review surface).

### 7.4 GET /api/notifications

Returns `{ notifications: [...], unread_count: int }`. Filterable by `?unread=true&limit=20`.

### 7.5 POST /api/notifications/mark-read

Body: `{ ids: [uuid] }` or `{ all: true }`. Updates `read_at`.

---

## 8. Routes (full Chapter 2 list)

| route | type | source |
| --- | --- | --- |
| `/agents` | new | sticky-nav app surface |
| `/api/agents/run` | new | runtime |
| `/api/agents/registry` | new | GET, returns sanitized META for the registered agents (used by Agent Console) |
| `/api/cron/reaper` | new | Vercel Cron-triggered |
| `/api/notifications` | new | GET list |
| `/api/notifications/mark-read` | new | POST |
| `/api/agents/dispatch` | deprecated | redirect to `/api/agents/run` or 410 after migration |
| `/api/lock-foundation` | refactored | returns 202, uses pre-inserted artifact rows |
| `/api/artifacts/[id]/regenerate` | refactored | returns 202, same pattern |

---

## 9. Surfaces (full Chapter 2 list)

| surface | change |
| --- | --- |
| `/agents` | NEW. Phase / Run history / Chain views. |
| `/foundation` | Update polling cadence to 3 s; banner copy stays. Pull tier from /api/qbp (already done). |
| Top nav | NEW notification bell on every signed-in surface. |
| `/account` | Add a "Agent activity" link to `/agents`. |
| Phase 02 stubs | Logo Direction, Logo Evaluation, Voice Guide. Migrated to the contract but kept under feature-flag for Cod's review before user-facing exposure. |

---

## 10. Edge cases

- **User refreshes `/agents` while dispatch is in flight.** Polling reattaches; shows current statuses.
- **Two browser tabs both try to manually re-run the same agent.** In-flight detection on `/api/agents/run` returns 409 to the second.
- **Reaper fires before child fetch establishes.** Polling client sees `queued` row; reaper sees `queued` row; reaper re-fires; child eventually runs; idempotency at the artifact row level (in-flight check) prevents duplicate work.
- **User's session expires mid-polling.** Polling 401s; client re-mints via refresh token (already wired in qb-cloud.js) or redirects to auth.
- **User has zero qbp data and forces a manual agent run.** Agent runtime returns `missing_inputs` error; UI surfaces "Need more data" with link to the corresponding exercise.
- **A Phase 02 chain fires for a free-tier user.** `canRun(tier, agent_slug)` short-circuits the chain. No artifact row created. No notification sent.
- **Stripe downgrade mid-Phase-02-dispatch.** Tier flips to free. The Phase 02 artifact row remains in DB but the read endpoint 402s under the tier-gating module.
- **Agent META version bump between runs.** Old runs keep their `agent_version` value. The Run history view shows the version at run time. Manual re-run uses current version.

---

## 11. Acceptance criteria

Chapter 2 closes when:

### 11.1 Framework
- [ ] All four Phase 01 synthesizers refactored to the contract in §3.5
- [ ] `agents/registry.js` lists them; `agent_runs` table is the canonical run log
- [ ] `/api/agents/run` handles every trigger type (lock, chain, manual, regenerate); rejects unknown
- [ ] Inter-edge HMAC auth verified by code-read and unit-style check
- [ ] Reaper runs every 2 minutes via Vercel Cron; can be triggered manually via a dev endpoint

### 11.2 Lock + regenerate
- [ ] Lock returns 202 in <1 s (single-digit, not 1.0-1.6 s as PR #59)
- [ ] **10 of 10 fresh-user locks complete successfully end-to-end (zero stuck dispatches)**
- [ ] 10 of 10 same-family concurrent regenerates succeed
- [ ] No 504s on prod across 10 test runs
- [ ] Foundation polling detects all artifact transitions within 6 s of state change
- [ ] User-facing toast: "Foundation locked. Producing your kit." then per-artifact toast as each delivers. No more failure lie.

### 11.3 Chain orchestration
- [ ] Locking foundation as starter user fires all 4 Phase 01 agents
- [ ] When all 4 Phase 01 deliver, Phase 02 chain-eligible agents auto-fire
- [ ] Free user's chain is short-circuited at the tier gate (no Phase 02 work)
- [ ] DAG view renders the dependency graph correctly

### 11.4 Agent Console
- [ ] `/agents` renders at 360, 768, 1440 viewports
- [ ] Phase view shows agent state correctly across all five buckets
- [ ] Run history view lists every run with click-through to error detail
- [ ] Manual "Run" pill triggers `/api/agents/run` with trigger=manual
- [ ] Reduced-motion respected
- [ ] All design system v3.4 components used (no inline styles)

### 11.5 Notifications
- [ ] Bell icon renders on every signed-in surface
- [ ] Unread count updates in real-time during polling
- [ ] Clicking the bell shows the last 20 notifications
- [ ] Marking-read clears the count
- [ ] In-app + email both fire for `artifact_ready`, `chain_ready`, `dispatch_failed`
- [ ] All new transactional emails ship without `List-Unsubscribe` (per EMAIL_DELIVERABILITY.md)

### 11.6 Database
- [ ] Migrations 011, 012, 013 applied to prod
- [ ] RLS verified on every new table
- [ ] `agent_runs` preserves all existing `artifact_runs` rows (renamed, columns added)
- [ ] No legacy `artifact_runs` references remain in code

### 11.7 Carry-overs from Chapter 1
- [ ] 504 UX lie at lock: gone. 10 of 10 lock runs return 202 in <1 s.
- [ ] Concurrent regenerate timeout: gone. 10 of 10 same-family regenerates succeed.
- [ ] `?upgrade=success` browser auth-gate fixed (see §11.8)

### 11.8 Foundation `?upgrade=success` bug
- [ ] Foundation page recognizes `?upgrade=success`. If the user's localStorage session is stale or absent, show a "Your upgrade succeeded. Sign in to see your paid content." banner with sign-in CTA. Do not silently bounce to signal-scan.

### 11.9 Sign-off
Nizzar runs through the free-tier path, hits the paywall, upgrades, sees Phase 01 deliver in <60 s, sees Phase 02 chain-fire, sees notifications land, sees the Agent Console show the full workforce in one glance. Only then is Chapter 2 closed.

---

## 12. Known debt entering Chapter 3

- Reaper retry strategy is fixed (3 tries, 2-minute interval). No exponential backoff. Chapter 3 hardens.
- DAG view is desktop-only SVG. Mobile fallback is a vertical list. Could be richer.
- Inter-edge HMAC secret is a single shared `INTER_EDGE_SECRET`. No per-caller credentials. Acceptable for our size; not Web-scale.
- Run history view shows all runs forever. Pagination + cleanup policy deferred.
- Phase 02-05 agent contracts conform but their actual logic + prompts are scaffolded. Each agent's prompt + schema is Chapter-specific (Phase 02 in Chapter 3, etc).
- No retry from the user-facing surfaces. If a run fails, the user clicks "Run again" manually. Chapter 3 could add policy.

---

## 13. Build sequence

Cod-recommended order. Each step is one PR + one verification report PR.

1. **Migrations 011 + 012 + 013** (data model + RLS). Apply to prod via Supabase MCP.
2. **`agents/registry.js` + contract scaffold.** Move four Phase 01 agents to the new shape. NO behavior change yet.
3. **`/api/agents/run` + inter-edge HMAC.** New endpoint, but lock + regenerate still call the old `/api/agents/dispatch` for now.
4. **Lock endpoint refactor.** Pre-insert artifact rows, fire `waitUntil` child fetches to `/api/agents/run`, return 202. 10-run verification.
5. **Regenerate endpoint refactor.** Same pattern. 10-run concurrent verification.
6. **Reaper cron.** Verify with intentional fetch-cancellation: insert a `producing` dispatch_jobs row with no artifact movement, watch the reaper pick it up.
7. **Chain orchestration.** Wire Phase 01 → Phase 02 chain triggers. Verify free user short-circuit + starter user follow-through.
8. **`/agents` surface.** Phase view + Run history view.
9. **Chain view (DAG).** Desktop-only SVG.
10. **Notifications.** Migration 013 already applied; build the bell, the popover, the API, the emails.
11. **Foundation `?upgrade=success` banner.** Small UX fix in foundation.html.
12. **Phase 02 agent scaffolding.** Logo Direction, Logo Evaluation, Voice Guide migrated to the contract but feature-flagged.
13. **End-to-end QA pass.** Same shape as step 17 in Chapter 1.
14. **Final sign-off + smoke + CHAPTER_02_COMPLETION.md.**

Each step starts only when the prior is merged AND verified.

---

## 14. Open questions for Nizzar's review

1. **Architectural decision (§2).** Option A or Option B? Cod recommends A.
2. **Phase 02 agent visibility.** Build Phase 02 agents to feature-flag in Chapter 2, or keep them as scaffolds and ship the user-facing Phase 02 surfaces in Chapter 3? Cod recommends scaffold-only in Chapter 2.
3. **DAG view scope.** Worth the build cost in Chapter 2, or defer to Chapter 4 once the agent count justifies the visualization? Cod recommends defer if budget pressure.
4. **Notification bell scope.** Build only on `/agents` in Chapter 2, or roll out to all signed-in surfaces? Cod recommends all-surface from the start to amortize the cost.
5. **Reaper retry count.** 3 tries reasonable? Or aggressive backoff (1 → 5 → 25 minutes)? Cod recommends fixed 3 / 2-minute for Chapter 2; tune in Chapter 3.

---

## End of Chapter 2 specification draft.

Hold all code until explicit spec approval.
