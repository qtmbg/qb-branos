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

**Status (per Nizzar's spec review):** Option A confirmed. Move forward, subject to the pre-implementation gate in §2.5.

---

## 2.5 Pre-implementation gate · PR #59 failure reproduction

**Non-negotiable.** No production code lands on Option A until the PR #59 stuck-dispatch failure mode is reproduced, the root cause is confirmed, and the new pattern is explicitly verified to address it.

### Why this gate exists

PR #59 shipped fire-and-forget dispatch. 1 of 10 verification runs landed 0 artifacts at 60 s. The working hypothesis (`fetch()` cancellation when the parent Edge function returns before child connections establish) was named but not instrumented. Shipping a fix on top of an unconfirmed hypothesis risks shipping a fix to the wrong bug. If the actual mechanism is something else (Vercel runtime concurrency cap, network jitter, child function cold-start failure under load), `waitUntil` + reaper might not address it.

### Reproduction protocol

1. **Build a controlled test harness.** A local Vercel dev environment OR a dedicated preview branch with deployment protection disabled (or bypass-token wired). Inject diagnostic logs at every fetch boundary:
   - parent Edge function entry + return timestamps
   - each child `fetch()` initiation timestamp
   - child Edge function entry timestamp (added log line in `/api/agents/run`)
   - connection establishment receipt (TCP-level if accessible via Node's `lookup` callback equivalent; otherwise the child's first log line)

2. **Reproduce the PR #59 pattern.** Restore the reverted code path (fire 4 child fetches without `await`, no pre-inserted artifact rows, no `waitUntil`). Run 50 lock attempts against fresh test users. Capture the per-run log trail. Target: reproduce the 1/10 stuck rate with high confidence (5+ stuck runs in 50). If the rate doesn't reproduce, the bug may have been a transient Vercel issue and the architecture call needs re-evaluation.

3. **Identify the failed path.** For each stuck run:
   - Did the parent function fire 4 fetches? (look for the 4 initiation logs)
   - Did any child function start? (look for child entry logs)
   - At what timestamp did the parent return vs each child fetch initiate?
   - Is there a consistent pattern in which fetch position fails (first, last, any)?

4. **Confirm or reject the hypothesis.** Two outcomes:
   - **Hypothesis confirmed:** parent returns before child connection establishes; child fetches never reach their handler. `waitUntil` + pre-inserted rows + reaper is the right fix.
   - **Hypothesis rejected:** the bug is elsewhere (e.g. Edge concurrency cap, regional cold-start, supabase write race). Identify the actual mechanism. Re-evaluate Option A. May require switching to Option B earlier than planned.

5. **Document findings.** A short report under `chapter-02/verification/step-N-repro-<timestamp>.md` covering: harness setup, log methodology, 50-run results, identified mechanism, mapping from mechanism to fix.

### Definition of done

- [ ] Documented test that reliably reproduces the 1/10 stuck rate (or shows the rate was transient)
- [ ] Identified mechanism (with log evidence)
- [ ] Explicit confirmation that the Option A pattern (§5) addresses that mechanism
- [ ] Reproduction report committed to the repo

### Definition of proof · evidence bar

The gate is passed only when the reproduction provides evidence that the bug exists. Specifically:

- **Minimum reproduction rate:** the test must trigger the stuck-dispatch failure mode at **minimum 2 of 10 runs** (matching or exceeding PR #59's observed 1/10 rate; the 2/10 floor accounts for sampling variance and guarantees the test isn't pattern-matching a one-off).
- **Reproducibility:** the test must be runnable from a clean test user with a **single command**. No multi-step orchestration. No "click this, then run that." A script.
- **Mechanism captured in logs:** the log trail must show the specific moment of failure. Examples of acceptable evidence: a fetch cancellation event, an orphaned worker entry with no return, a race condition with conflicting timestamps, a Vercel-side concurrency rejection. "Nothing happened" is not evidence.
- **Zero-failure runs do NOT pass the gate.** If 10 runs produce 0 stuck dispatches, the gate is **not** passed. It means we have not reproduced the bug, only its absence. Two outcomes from there:
  - Iterate on the harness (increase load, change region, simulate cold-start) until the bug reproduces. Most likely path.
  - If after sustained effort the bug refuses to reproduce, escalate the architectural decision: the failure may have been a transient Vercel-side issue, in which case Option A still ships but the reaper's role shifts from "patch the known mechanism" to "catch whatever the actual mechanism turns out to be in production." This is a downgrade in confidence and triggers a separate review with Nizzar before code lands.

This evidence bar prevents the gate from being closed by a "we couldn't reproduce it, looks fine now" report. The bug must be caught before the fix is trusted.

Until this gate is cleared, Chapter 2 build step 1 (migrations) is the only allowable forward motion. No runtime code merges to main on top of an unconfirmed hypothesis.

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

Each agent declares the data it reads. Four kinds:
- `qbp_fields[]` · typed array of QBP fields the agent reads. Each entry `{ field, required }`:
  - `field` · the key in `profiles.qbp` (e.g. `'brandEssence'`, `'manifesto'`).
  - `required` · boolean. If `true`, the runtime refuses to dispatch when the field is missing or empty, and emits `qbp_field_missing` without calling Claude. If `false`, the field is passed through to the agent function, which decides how to handle absence (graceful degradation, placeholder copy, conditional logic).
  - Rationale: agents differ in tolerance for sparse QBPs. Soul Map serves a fresh user with an incomplete QBP by rendering "Not yet captured" placeholders · graceful degradation is correct. Visual DNA and War Table cannot produce honest output without specific inputs · strict refusal is correct. The flag puts the decision with the agent author, not the runtime. Mirrors the `files[]` `{ type, source, optional }` shape.
- `artifact_dependencies[]` · slugs of other agents whose latest delivered artifact this agent reads (e.g. Logo Direction, a Phase 02 agent shipping in Chapter 4, reads the latest delivered Visual DNA synthesis for color and type direction). All dependencies are implicitly required; the runtime refuses to dispatch when any declared dependency has no `delivered` artifact. **Chapter 2 status:** no Phase 01 agent uses `artifact_dependencies` · the four synthesizers read overlapping `qbp_fields` directly rather than each other's artifacts. The first real use lands in Chapter 4 (Phase 02).
- `files[]` · typed array of file inputs the agent needs. Each entry `{ type, source, optional }`:
  - `type` · semantic type. Initial vocabulary: `'logo-source'`, `'reference-image'`, `'brand-asset'`, `'transcript'`, `'document'`. New types added as agents declare them.
  - `source` · how the file is provided. Initial values: `'user-upload'` (the user attaches it via the UI in Chapter 3+), `'agent-output'` (a previous agent emitted a file artifact). Forward-compatible.
  - `optional` · boolean. If false, missing files block the run with `missing_inputs`.
  - **Chapter 2 status:** the contract field is declared and accepted; the asset layer that fulfills it is built in Chapter 3. No Chapter 2 agent declares non-optional files. Agents may declare optional files now for forward-compat, but the runtime treats them as always-empty until Chapter 3 wires uploads.
- `runtime_args{}` · optional kwargs (e.g. a regenerate event might carry a `feedback` arg from the Content Approval Loop, or a `qbp_source` arg of `'current'` or `'original'` per §6 manual rerun semantics)

The runtime validates: if any `qbp_field` marked `required: true` is missing or empty in the QBP snapshot, any `artifact_dependency` isn't `delivered`, or any non-optional `file` is unavailable, the agent fails with the matching error code (`qbp_field_missing`, `missing_dependency`, or `missing_inputs`) and does not call Claude.

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
    // Each qbp_fields entry is { field, required }. Soul Map degrades
    // gracefully on missing fields; Visual DNA / War Table set required:true
    // on the inputs they cannot work without.
    qbp_fields: [
      { field: 'brandEssence', required: false },
      { field: 'manifesto',    required: false },
      { field: 'paradox',      required: false },
      { field: 'antiBrand',    required: false },
      { field: 'alwaysNever',  required: false },
    ],
    artifact_dependencies: [],
    files: [],                          // forward-compat for Chapter 3 asset layer
    runtime_args: { feedback: 'optional', qbp_source: 'optional' },
  },
  triggers: ['lock', 'manual', 'regenerate'],
  // Per §11.12.1 every agent declares the error codes it may emit.
  // The conformance suite asserts each declared code is triggerable.
  error_codes: ['config_missing', 'edge_timeout', 'model_call_failed'],
};

export async function run({ qbp, dependencies, files, runtime_args, anthropicKey }) {
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
| `qbp_snapshot` | jsonb | frozen copy of `profiles.qbp` at run start. Powers replay. |
| `file_refs` | jsonb | array of file references at run start (empty until Chapter 3 wires uploads). Powers replay. |
| `runtime_args` | jsonb | the runtime args this run received (e.g. `feedback`, `qbp_source`). Powers replay. |
| `status` | text | enum: `started`, `succeeded`, `failed` |
| `started_at` | timestamptz | default now() |
| `completed_at` | timestamptz | null until done |
| `duration_ms` | int | |
| `tokens_in` | int | |
| `tokens_out` | int | |
| `model` | text | `claude-sonnet-4-6` |
| `error` | jsonb | `{ stage, message, missing_inputs?, raw? }` |

`artifact_runs` from Chapter 1 is renamed to `agent_runs` via migration. Old rows backfill `qbp_snapshot = null`, `file_refs = []`, `runtime_args = {}`. From this migration forward, every run writes those three columns at run start. RLS: user can SELECT own runs.

**Replay support.** Given an `artifact_id`, the user can ask "what produced this?". The path:
1. Look up the `agent_runs` row where `artifact_id = <id>`.
2. Read `qbp_snapshot`, `file_refs`, `runtime_args`, `agent_version`.
3. Surface in the Agent Console + the artifact reading surface as "What produced this version" with a detail panel.

This is the non-negotiable trust primitive: every artifact is reproducible back to its inputs. See §5.x and §6 for the surface treatment.

### 4.2 Extend: `dispatch_jobs`

Already exists from migration 010. Extend with:
- `trigger` · enum matching agent run trigger
- `parent_agent_slug` · for chain triggers, which upstream agent's completion caused this dispatch
- `agents_count` · how many agents were enqueued (4 for lock, 1 for chain/manual/regenerate)
- `agents_settled` · running count of agents that have reached terminal state
- `agent_version` · the META.version of the agent(s) at dispatch time. For multi-agent dispatches (lock), stores the highest version among the dispatched set. The per-row agent version still lives on `agent_runs.agent_version` for precision.
- `retry_count` · integer, default 0. Reaper increments on each retry.
- `status` enum extended: `queued`, `producing`, `completed`, `partial`, `failed`, `failed_permanently` (NEW). `failed_permanently` is the terminal state the reaper sets when retry_count > 3.

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
3. **Resolve QBP source.** `runtime_args.qbp_source` is `'current'` (default) or `'original'`. Default reads the user's live `profiles.qbp`. The original mode reads the `qbp_snapshot` from the source artifact's `agent_runs` row (only meaningful on regenerate triggers; manual triggers default to current).
4. Read inputs: pull `qbp_fields` from the resolved QBP source; pull `artifact_dependencies` (latest delivered per slug); pull `files` from the file refs in `runtime_args` (Chapter 2 always empty).
5. If any required input is missing → write artifact row to `failed` with `missing_inputs`; open + close `agent_runs` row (still capturing `qbp_snapshot`, `file_refs`, `runtime_args`, `agent_version`); return 200 with `{ ok: false, error: 'missing_inputs', missing }`.
6. **Insert `agent_runs` row.** Set `status='started'`, `trigger`, `dispatch_id`, `agent_slug`, `agent_version` (from META), `qbp_snapshot` (frozen copy of the resolved QBP), `file_refs`, `runtime_args`. This row is the replay record.
7. Flip artifact `status='generating'`.
8. Run agent (Claude call inside the 25 s budget) with the frozen inputs.
9. Validate output schema.
10. On success: PATCH artifact to `delivered` + content; close run as `succeeded`; send artifact-ready email; check chain triggers (see §5.4).
11. On failure: PATCH artifact to `failed` + error; close run as `failed`.
12. Update `dispatch_jobs.agents_settled` and flip `dispatch_jobs.status` to `completed` when all child artifacts reach terminal state.
13. Return 200 with run summary.

### 5.3 `/api/artifacts/[id]/regenerate` (refactored)

POST `{ qbp_source }`. Default `qbp_source = 'current'`. Accepts `'original'` to rerun against the QBP snapshot at the time the source artifact was produced.

Same pattern as lock but for a single agent. Insert a new `dispatch_jobs` row with `kind='regenerate'`, `agents_count=1`, `agent_version=<META.version>`. Insert one new artifact row with bumped version and `parent_artifact_id` pointing at the source. Fire one `/api/agents/run` via `waitUntil` with the chosen `qbp_source`. Return 202.

### 5.3.1 `/api/agent-runs/[id]/replay` (new, GET-only read surface)

Given an `agent_runs.id` (looked up by `artifact_id` from the source artifact), return the frozen inputs:

```
{
  agent_slug, agent_version, trigger, qbp_snapshot, file_refs, runtime_args,
  started_at, completed_at, duration_ms, tokens_in, tokens_out,
  artifact_id, artifact_version, status, error
}
```

Used by the Agent Console "What produced this version" panel and the artifact reading surface's "Replay details" link. RLS scopes to caller's own runs.

### 5.4 Chain orchestration

When `/api/agents/run` finishes a successful delivery:

1. Look up which agents have `artifact_dependencies` that include the upstream agent's slug.
2. For each downstream agent, check if its other dependencies are also satisfied (latest delivered).
3. If satisfied AND no in-flight artifact for that agent: insert a new `dispatch_jobs` row with `kind='chain'`, `parent_agent_slug=<upstream>`, fire a new artifact + run.

Phase 01 → Phase 02 example: when all four Phase 01 synthesizers deliver, Phase 02 agents (Logo Direction, Logo Evaluation, Voice Guide) that depend on them auto-fire.

Tier gating: chain triggers respect tier. A free user who completes Phase 01 will NOT auto-fire Phase 02 chain triggers (those are starter-only). Chain firing is wrapped in `canRun(tier, agent_slug)` from the tier-gating module.

### 5.5 Reaper

`/api/cron/reaper` · a Vercel Cron job that runs every 30 seconds (the tightest interval Vercel offers; the per-row check below enforces the backoff curve precisely). For each `dispatch_jobs` row with `status='producing'`:

1. Determine the row's age: `seconds_since_dispatch = now() - created_at`. Determine the row's most recent retry attempt: `seconds_since_last_retry = now() - last_retry_at` (new column, default `created_at`).
2. **Backoff schedule.** The reaper acts only when the elapsed time since the most recent attempt has crossed the next backoff threshold:
   - Retry 1 fires when `seconds_since_last_retry >= 30 s` AND `retry_count = 0`.
   - Retry 2 fires when `seconds_since_last_retry >= 120 s` AND `retry_count = 1`.
   - Retry 3 fires when `seconds_since_last_retry >= 300 s` AND `retry_count = 2`.
3. Read child artifacts for the dispatch. If any are still `queued`, treat as stuck.
4. Re-fire `/api/agents/run` for each stuck artifact. Increment `retry_count`. Update `last_retry_at = now()`.
5. **Permanent failure.** If `retry_count = 3` AND the dispatch is still `producing` at the next reaper tick, flip `dispatch_jobs.status = 'failed_permanently'`. Emit a single `dispatch_failed` notification (in-app + email). Email is sent ONLY at this terminal state, not on intermediate retries. The Agent Console surfaces a manual retry CTA on the affected agent row.

`last_retry_at` is added to `dispatch_jobs` via migration 012 alongside `retry_count`.

Cron is declared in `vercel.json`:
```json
"crons": [{ "path": "/api/cron/reaper", "schedule": "* * * * *" }]
```

(Vercel Cron's minimum granularity is one minute; the 30 s backoff arm fires on the first tick after threshold, so effective worst-case latency is 30 s + cron jitter.)

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

Two tab views switchable via the eyebrow row:

**Phase view (default).** Five phase cards (01-05). Each card shows the phase name and the agents in that phase as a list of rows. Each row shows:
- Agent name + one-line description (from META.description)
- Status pill (ready / producing / delivered / failed / locked)
- Last run timestamp (from `agent_runs.completed_at`)
- Next run cue (for `scheduled` agents; null in Chapter 2)
- "Depends on: X, Y" plain-text line under the description, derived from META.inputs.artifact_dependencies (display_name list)
- "Run" pill, two-button variant on agents with a prior version delivered (see §6.4)

**Run history view.** Reverse-chronological list of every `agent_runs` row for this user. Each row shows agent name, trigger, status, duration, tokens, and the `agent_version` at run time. Click a row to open the "What produced this run" panel · the replay view per §5.3.1. This is the diagnostic surface.

**Chain view: out of scope for Chapter 2.** Dependencies surface as plain text on the agent rows. Visual DAG is a post-launch enhancement once agent count justifies the visualization.

### 6.3 Phase 02-05 cards · locked state

Phase 02-05 agents are visible in the Phase view from chapter close forward. Each phase card renders as a tier-locked treatment:
- Phase 02: card shows the phase name + the three Chapter 4 agents (Logo Direction, Logo Evaluation, Voice Guide) as a list with locked-glyph status pills.
- Phase 03-05: same treatment, with the agents that are planned per the roadmap doc.
- **Unlock-criteria copy** under each locked agent row: "Unlocks when Starter tier is active" (or the relevant tier per the agent's `tier_required` in META).
- The card itself stays visible. No paywall modal on click in Chapter 2 (Chapter 4 wires the actual agents). Clicking a locked Phase 02 agent in Chapter 2 navigates to `/paywall?reason=phase_02` (existing surface from Chapter 1).

This is the user-visible answer to "what comes next." The console is the surface in Chapter 2; the agents themselves ship in Chapter 4. No Phase 02 agent code is written in Chapter 2.

### 6.4 Manual rerun · two-button semantics

When an agent has a prior delivered artifact AND the agent is in `manual` triggers AND the user's tier permits the agent, the Phase view row shows TWO rerun pills:
- **"Rerun with current QBP"** (default, primary pill) · POSTs `/api/artifacts/<id>/regenerate` with `qbp_source='current'`. The runtime reads the user's live `profiles.qbp` at run time.
- **"Rerun with original QBP"** (secondary pill) · POSTs `/api/artifacts/<id>/regenerate` with `qbp_source='original'`. The runtime reads the `qbp_snapshot` from the source artifact's `agent_runs` row.

Two semantics, two visible buttons. The user picks. If the source artifact has no `qbp_snapshot` (e.g. legacy artifacts from Chapter 1 before migration 011), the "original" pill is disabled with a tooltip explaining why.

### 6.5 Components

New components added to the library (`js/qb-components.js`):
- `createAgentRow({ agent, status, lastRunAt, agentVersion, dependencies, onRunCurrent, onRunOriginal })` · used in Phase view. Two-button rerun handled by the component.
- `createRunRow({ run, onClick })` · used in Run history view
- `createReplayPanel({ runDetails })` · the "What produced this run" panel triggered from a run row click
- `createNotificationBell({ count, onClick })` · top-right of the nav, used on every signed-in surface (see §7)

### 6.6 States

- **Cold:** user hasn't locked foundation. Phase 01 agents show "Complete the foundation to run." Phase 02-05 cards visible but every row locked.
- **Foundation locked, agents producing:** "Producing" badge with a small spinner on the relevant rows. Polling cadence 3 s.
- **All Phase 01 delivered, free tier:** Phase 01 agents show "Delivered." Phase 02-05 cards visible with "Unlocks when Starter tier is active" on every row.
- **All Phase 01 delivered, starter tier:** Phase 02 cards visible; agents marked as Chapter 4 ship target ("Available soon" status, not runnable in Chapter 2).
- **Failed run:** Failed badge on the agent row. "Run again" pill. Clicking shows the error from `agent_runs.error`.
- **Dispatch permanently failed:** Phase view row shows a "Retry manually" CTA (per §5.5 permanent-failure surfacing). One-click starts a fresh manual run.

### 6.7 Empty + error states

| state | render |
| --- | --- |
| No agents yet (anonymous) | Redirect to `/auth?next=/agents` |
| Foundation not locked | "Lock your foundation to see your agents at work" + CTA to `/foundation` |
| API failure on initial load | Generic error empty state with reload CTA |
| Run history is empty | "Your run history will populate after your first agent completes" |

### 6.8 Mobile

360 px minimum width. Phase cards stack. Run history rows compress to two-line stacked layout. The two-button rerun stacks vertically on mobile (current QBP on top, original underneath). Locked-state Phase 02-05 cards collapse to a single-line "Unlocks with Starter" treatment with a tap-to-expand affordance.

---

## 7. Notifications

Chapter 2 ships the MVP shape. No preferences UI. No mark-all-read button. Persistence in `public.notifications` with RLS.

### 7.0 What counts as a notification in Chapter 2 · exhaustive

This list is the source of truth. Anything not on it does not fire a bell, does not write a `notifications` row, does not send an email under the new templates.

**Fires a notification:**

1. **Artifact ready** · one per artifact. Includes regenerations (each new version that lands `delivered` produces one notification). Kind: `artifact_ready`.
2. **Agent run failed permanently** · after the reaper exhausts 3 retries and flips `dispatch_jobs.status = 'failed_permanently'`. One per dispatch. Kind: `dispatch_failed`.
3. **Foundation locked** · the existing Chapter 1 foundation-locked email already fires; Chapter 2 adds the in-app notification row alongside it so the bell badge shows immediately after lock. Kind: `foundation_locked`.
4. **Manual rerun completed** · success or failure. One per rerun. The success case routes through `artifact_ready`; the failure case routes through `dispatch_failed` once it reaches `failed_permanently` (intermediate retries stay silent per §5.5).

**Does NOT fire a notification (prevents scope drift):**

- Tier changes (already surfaced on `/account`; the bell isn't where billing state belongs)
- Login events (sign-in, sign-out, session-refresh)
- Marketing announcements (no inbound marketing surface in Chapter 2; marketing comms route through the welcome-email cadence)
- File uploads · Chapter 3 owns the asset layer and decides whether file ingest fires notifications
- QBP edits (the live document; not eventful enough to interrupt)
- Stripe webhook events other than the tier flips already covered above
- Anything sent by the reaper before the terminal state (retries 1, 2, 3 in-flight are silent by design)

Anything added to either list after Chapter 2 close is a spec change, not an implementation detail.

### 7.1 In-app · bell icon

Bell icon top-right of every signed-in surface (Foundation, Archive, QBP, Account, Agents, Paywall). One component, one wiring; amortizes the cost from the start.

**Badge.** Shows the unread count (`notifications.read_at IS NULL`). Caps at "9+" visually but the API returns the precise count.

**Click reveals a dropdown** anchored under the bell with the last 10 notifications (any read state). Each row:
- Eyebrow line: notification kind + agent name (e.g. "Artifact ready · Soul Map Synthesizer")
- Body line: one-sentence summary (e.g. "Your Soul Map is ready to read.")
- Timestamp (relative: "2 minutes ago")
- A click target that navigates to the relevant artifact / run history row / paywall

**Click-to-clear behavior.** Clicking a notification in the dropdown marks that row read AND navigates to its destination. No separate mark-as-read button. No mark-all-read button. The user clears notifications by clicking through them, one at a time. This is deliberate · it forces the user to actually look at each notification before it disappears from the unread count.

**Empty state.** "No notifications yet. Your agents will let you know when work is done."

### 7.2 Email

Existing artifact-ready + foundation-locked emails (from Chapter 1) continue. New email for Chapter 2:

| trigger | template | sent to | when |
| --- | --- | --- | --- |
| `chain_ready` | "Your <Artifact> is ready" (when Phase 02 chain-fires after Phase 01 · Chapter 4 ships the actual chain) | user | on chain-trigger delivery |
| `dispatch_failed` | "Something went wrong producing your <artifact>" | user + me@qtmbg.com | **only after reaper reaches `failed_permanently`** (retry_count = 3 exhausted). No emails on intermediate retries. |

All new emails are transactional (no `List-Unsubscribe` header per EMAIL_DELIVERABILITY.md).

### 7.3 Notification trigger logic

`notifications.kind` enum values for Chapter 2, matching the §7.0 list:

- `artifact_ready`: emitted by `/api/agents/run` when an artifact delivers successfully. Includes regenerations (each new version produces one). Triggers in-app notification AND the Chapter 1 artifact-ready email.
- `foundation_locked`: emitted at the end of `/api/lock-foundation` after the artifact rows are pre-inserted. Triggers in-app notification AND the Chapter 1 foundation-locked email.
- `dispatch_failed`: emitted by the reaper ONLY when a dispatch reaches `failed_permanently` (retry_count = 3). Triggers in-app notification AND a `dispatch_failed` email. No notifications on retries 1, 2, or 3 in-flight · only the terminal state.
- `chain_ready`: emitted by chain orchestration when a downstream agent auto-fires after upstream delivery AND the downstream artifact reaches `delivered`. Triggers in-app notification AND a `chain_ready` email. In Chapter 2 this is reachable only via the framework's test harness (no Phase 02 agents until Chapter 4).
- `quarterly_due`: deferred to Chapter 9 (Quarterly Brand Review surface). Listed for completeness in the `notifications.kind` enum.

### 7.4 GET /api/notifications

Returns `{ notifications: [...], unread_count: int }`. Default returns the last 10 (the dropdown's pagination unit). `?limit=N` accepts up to 100 for the eventual full-history view. `?unread=true` filters to unread only.

### 7.5 POST /api/notifications/[id]/read

Marks a single notification read by setting `read_at = now()`. Click-to-clear in the dropdown calls this endpoint for the clicked row before navigating.

No bulk mark-read endpoint in Chapter 2. The user clears notifications individually by clicking through them.

---

## 8. Routes (full Chapter 2 list)

| route | type | source |
| --- | --- | --- |
| `/agents` | new | sticky-nav app surface |
| `/api/agents/run` | new | runtime |
| `/api/agents/registry` | new | GET, returns sanitized META for the registered agents (used by Agent Console). Includes Phase 02-05 entries with locked-status flag. |
| `/api/agent-runs/[id]/replay` | new | GET, returns the frozen-input replay record per §5.3.1 |
| `/api/cron/reaper` | new | Vercel Cron-triggered |
| `/api/notifications` | new | GET list (default 10, accepts `?limit=N&unread=true`) |
| `/api/notifications/[id]/read` | new | POST, marks single notification read |
| `/api/agents/dispatch` | deprecated | redirect to `/api/agents/run` or 410 after migration |
| `/api/lock-foundation` | refactored | returns 202, uses pre-inserted artifact rows |
| `/api/artifacts/[id]/regenerate` | refactored | returns 202, accepts `qbp_source` body field |

---

## 9. Surfaces (full Chapter 2 list)

| surface | change |
| --- | --- |
| `/agents` | NEW. Phase view (default) + Run history view. Phase 02-05 cards visible with locked-state treatment. No DAG view in Chapter 2. |
| `/foundation` | Update polling cadence to 3 s; banner copy stays. Pull tier from /api/qbp (already done). |
| Top nav | NEW notification bell on every signed-in surface (Foundation, Archive, QBP, Account, Agents, Paywall). |
| `/account` | Add an "Agent activity" link to `/agents`. |
| Phase 02-05 agents | NOT built in Chapter 2. Phase 02 agents (Logo Direction, Logo Evaluation, Voice Guide) ship in Chapter 4. Console renders them as locked-status rows with "Unlocks when Starter tier is active" copy per §6.3. |

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
- **User clicks "Rerun with original QBP" on a Chapter 1 legacy artifact.** That artifact's `agent_runs` row has `qbp_snapshot = null` (migration backfill default). The Phase view's secondary pill is disabled with a tooltip: "No snapshot available for this version. Original QBP rerun unsupported."
- **User clicks "Rerun with original QBP" on a v2 regenerate of an original.** The runtime reads the v1 artifact's `agent_runs.qbp_snapshot` (the version BEFORE the user rerendered with current QBP). This preserves the original lock-time inputs across the version chain.
- **Reaper retry triggers same-second as user's manual rerun.** Both POSTs hit `/api/agents/run` concurrently. The first to write the `agent_runs` row wins; the second hits the in-flight check (queued or generating artifact row already exists) and 409s. The reaper backs off on 409 (treats it as "someone else is handling it").
- **Permanent failure email fires twice.** Reaper increments retry_count past 3 and sets `failed_permanently` once. The status check on subsequent reaper ticks short-circuits before re-emitting the email (only the transition from `producing` → `failed_permanently` emits; idempotent terminal state).
- **User clicks an unread notification mid-polling.** `POST /api/notifications/[id]/read` updates `read_at`. The next polling tick refreshes the badge count downward by one.
- **Notification dropdown opened with 0 unread.** Renders the last 10 read notifications. Badge hidden when count = 0.
- **Bell on signal-scan (anonymous user).** Bell does not render on anonymous surfaces. Signed-in only.
- **Phase 02 card click on free tier.** Navigates to `/paywall?reason=phase_02`. No agent dispatch.
- **File input declared but unavailable in Chapter 2.** Agent META declares `files[]` with optional entries. Runtime treats files as empty array (Chapter 3 wires the asset layer). Agent run completes with empty files; no `missing_inputs` because the entries are marked optional.

---

## 11. Acceptance criteria

Chapter 2 closes when:

### 11.1 Framework
- [ ] All four Phase 01 synthesizers refactored to the contract in §3.5
- [ ] `agents/registry.js` lists them; `agent_runs` table is the canonical run log
- [ ] `/api/agents/run` handles every trigger type (lock, chain, manual, regenerate); rejects unknown
- [ ] Inter-edge HMAC auth verified by code-read and unit-style check
- [ ] Reaper runs every 2 minutes via Vercel Cron; can be triggered manually via a dev endpoint

### 11.2 Pre-implementation gate (§2.5)
- [ ] PR #59 stuck-dispatch failure reproduced in a controlled environment
- [ ] Root cause identified (with log evidence) OR hypothesis explicitly rejected and re-evaluated
- [ ] Reproduction report committed to `chapter-02/verification/`
- [ ] No runtime code merges to main before this gate is cleared

### 11.3 Lock + regenerate
- [ ] Lock returns 202 in <1 s (single-digit, not 1.0-1.6 s as PR #59)
- [ ] **10 of 10 fresh-user locks complete successfully end-to-end (zero stuck dispatches)**
- [ ] 10 of 10 same-family concurrent regenerates succeed
- [ ] No 504s on prod across 10 test runs
- [ ] Foundation polling detects all artifact transitions within 6 s of state change
- [ ] User-facing toast: "Foundation locked. Producing your kit." then per-artifact toast as each delivers. No more failure lie.
- [ ] Regenerate accepts `qbp_source='current'` AND `qbp_source='original'`; uses correct QBP per request

### 11.4 Chain orchestration
- [ ] Locking foundation as starter user fires all 4 Phase 01 agents
- [ ] When all 4 Phase 01 deliver, the framework's chain orchestration is wired and verifiable (Chapter 4 brings the actual Phase 02 agents that complete the loop)
- [ ] Free user's chain is short-circuited at the tier gate (no Phase 02 work)
- [ ] Dependencies surface as plain text on Phase view rows. No DAG visualization in Chapter 2.

### 11.5 Reaper + permanent failure
- [ ] Reaper backoff schedule (30 s, 2 min, 5 min) verified in a controlled test (insert a `producing` row with stuck child artifacts; observe retry cadence)
- [ ] `failed_permanently` is the terminal state after retry_count = 3
- [ ] Single `dispatch_failed` notification emitted on permanent failure; no notifications on intermediate retries
- [ ] Agent Console surfaces a "Retry manually" CTA on permanently-failed rows

### 11.6 Agent Console
- [ ] `/agents` renders at 360, 768, 1440 viewports
- [ ] Phase view shows agent state correctly across all five buckets (cold, producing, delivered free, delivered starter, failed)
- [ ] Phase 02-05 cards visible with locked-state treatment; "Unlocks when Starter tier is active" copy under each row
- [ ] Click on a locked Phase 02 agent navigates to `/paywall?reason=phase_02`
- [ ] Run history view lists every run with click-through to the replay panel (per §5.3.1)
- [ ] Run row shows `agent_version` from `agent_runs`
- [ ] Two-button rerun renders on agents with prior delivered artifact: "Rerun with current QBP" (primary) + "Rerun with original QBP" (secondary)
- [ ] Secondary pill disabled with tooltip when source artifact has null `qbp_snapshot` (Chapter 1 legacy)
- [ ] Manual "Run" pill triggers `/api/agents/run` with trigger=manual
- [ ] Reduced-motion respected
- [ ] All design system v3.4 components used (no inline styles)

### 11.7 Replay
- [ ] Every new `agent_runs` row writes `qbp_snapshot`, `file_refs`, `runtime_args` at run start
- [ ] `/api/agent-runs/[id]/replay` returns the frozen inputs for any run the caller owns
- [ ] Run history click opens the replay panel with full input detail
- [ ] Artifact reading surface has a "What produced this version" link to the replay panel

### 11.8 Notifications (MVP shape)
- [ ] Bell icon renders on every signed-in surface (Foundation, Archive, QBP, Account, Agents, Paywall)
- [ ] Badge count shows unread; caps visually at "9+"; API returns precise count
- [ ] Click bell reveals dropdown with last 10 notifications (any read state)
- [ ] Click notification row marks it read AND navigates to destination (click-to-clear)
- [ ] No mark-all-read button (deliberate)
- [ ] No notification preferences UI (deliberate)
- [ ] `dispatch_failed` email fires ONLY at `failed_permanently`; no emails on intermediate retries
- [ ] All new transactional emails ship without `List-Unsubscribe` (per EMAIL_DELIVERABILITY.md)

### 11.9 Database
- [ ] Migrations 011, 012, 013 applied to prod
- [ ] RLS verified on every new table
- [ ] `agent_runs` preserves all existing `artifact_runs` rows (renamed, columns added)
- [ ] `dispatch_jobs.agent_version`, `dispatch_jobs.retry_count`, `dispatch_jobs.last_retry_at` columns present
- [ ] `dispatch_jobs.status` CHECK includes `failed_permanently`
- [ ] No legacy `artifact_runs` references remain in code

### 11.10 Carry-overs from Chapter 1
- [ ] 504 UX lie at lock: gone (covered by §11.3).
- [ ] Concurrent regenerate timeout: gone (covered by §11.3).
- [ ] `?upgrade=success` browser auth-gate fixed (see §11.11).

### 11.11 Foundation `?upgrade=success` bug
- [ ] Foundation page recognizes `?upgrade=success`. If the user's localStorage session is stale or absent, show a "Your upgrade succeeded. Sign in to see your paid content." banner with sign-in CTA. Do not silently bounce to signal-scan.

### 11.12 Agent contract conformance (§3)
- [ ] All four Phase 01 synthesizers declare `inputs.files` (empty array; forward-compat for Chapter 3)
- [ ] All four agents declare `triggers` explicitly
- [ ] `META.version` integer set per agent; bumps tracked when prompt or schema changes
- [ ] Runtime accepts `runtime_args.qbp_source` of `'current'` or `'original'`
- [ ] **Every agent passes the conformance test (§11.12.1) before registration.** Soul Map Synthesizer is retrofit to pass conformance as part of Chapter 2 build step 3.

### 11.12.1 Agent conformance test · automated

Every agent registered in `agents/registry.js` must pass a conformance test before the runtime accepts dispatches for it. The test lives at `tests/agent-conformance.mjs` and is invoked per-agent via `node tests/agent-conformance.mjs <agent_slug>`. CI runs it for the full registry on every PR. Adding a new agent without a passing conformance test is rejected at registry import time.

The conformance test asserts:

1. **Contract schema valid.** META declares: `slug` (canonical underscored), `phase` (`00`-`05`), `tier_required`, `display_name`, `description`, `artifact_type`, `version` (int), `inputs.qbp_fields[]`, `inputs.artifact_dependencies[]`, `inputs.files[]` (each entry has `type`, `source`, `optional`), `inputs.runtime_args{}`, `triggers[]` (each value in the canonical enum). Each field is type-checked.
2. **Happy path returns valid output.** Test fixture: a synthetic QBP with all required `qbp_fields` set, all `artifact_dependencies` satisfied via stub delivered artifacts, `files = []`, no `runtime_args.feedback`. Run the agent. Assert: `{ ok: true, content, meta }` shape; `content` validates against the artifact schema in `js/qb-artifact-schema.js`; `meta.tokens_in` and `meta.tokens_out` are positive integers; `meta.duration_ms` is positive.
3. **Documented error codes on each known failure mode.** Each agent's META declares an `error_codes[]` enum (e.g. `missing_inputs`, `model_call_failed`, `schema_validation_failed`, `edge_timeout`). For each declared code, the test runs the agent with inputs designed to trigger that code and asserts the returned `{ ok: false, error, stage }` matches.
4. **Writes correct `agent_version` to `dispatch_jobs`.** A test run via `/api/agents/run` confirms the `agent_runs.agent_version` and the parent `dispatch_jobs.agent_version` match `META.version` at run time.
5. **Writes `qbp_snapshot` to `agent_runs`.** Test run confirms the `qbp_snapshot` column is populated with a non-null frozen copy of the QBP used for the run.

Conformance test output is a single line per agent: `<slug> · PASS` or `<slug> · FAIL: <reason>`. CI rejects the PR if any agent fails. The conformance suite is committed under `tests/agent-conformance/` with one fixture per agent.

**Soul Map Synthesizer retrofit.** The Chapter 1 Soul Map Synthesizer was built before the contract existed. Build step 3 (the contract scaffold) retrofits it to conform. If retrofitting surfaces a contract gap (e.g. Soul Map needs an input shape the contract doesn't model), the contract evolves and the spec is amended before Chapter 2 closes. This is the first stress test of the contract; treat findings as load-bearing.

### 11.13 Sign-off
Nizzar runs through the free-tier path, hits the paywall, upgrades, sees Phase 01 deliver in <60 s, sees notifications land in the bell, sees the Agent Console show the full workforce in one glance (Phase 02-05 visible as locked rows with "Unlocks when Starter tier is active" copy). Reruns Soul Map with current QBP, reruns again with original QBP, confirms different inputs produce different outputs. Triggers a permanent dispatch failure (e.g. by killing the Edge function mid-run via a manual deploy), observes the reaper email after retry 3, clicks "Retry manually" from the Agent Console, sees recovery. Only then is Chapter 2 closed.

---

## 12. Known debt entering Chapter 3

- **DAG view is out of scope for Chapter 2.** Dependencies surface as plain text on each agent row. Post-launch enhancement once the agent count + chain depth justify the visualization.
- **Reaper retry curve is hardcoded** (30 s, 2 min, 5 min, then `failed_permanently`). No per-agent override. Chapter 3 or later hardens if specific agents warrant a different policy.
- **Inter-edge HMAC secret is a single shared `INTER_EDGE_SECRET`.** No per-caller credentials. Acceptable for our size; not Web-scale.
- **Run history view shows all runs forever.** No pagination, no archival, no cleanup policy. Chapter 3+ when history depth becomes a Postgres performance concern.
- **Phase 02-05 agents not built.** Console shows them as locked rows with "Unlocks when Starter tier is active" copy. Phase 02 agents (Logo Direction, Logo Evaluation, Voice Guide) ship in Chapter 4.
- **Asset layer (file uploads) not built.** Agent contract declares `inputs.files` for forward-compat with Chapter 3. No Chapter 2 agent requires non-optional files. Chapter 3 builds upload + storage + asset records.
- **No retry from the user-facing surfaces beyond the manual CTA.** If a run fails for a recoverable reason (rate limit, transient API error), there's no automatic retry policy. Chapter 3 or 4 can add per-agent retry config.
- **Notification dropdown is read-only display.** No full-history view, no filtering by kind, no archive. Last 10 only. Chapter 3+ when the user has enough history to warrant a full page.

---

## 13. Build sequence

Cod-recommended order. Each step is one PR + one verification report PR.

1. **PR #59 reproduction + root cause confirmation (§2.5 gate).** Controlled test environment, 50-run failure trace, identified mechanism, explicit confirmation the Option A pattern addresses that mechanism. Reproduction report committed under `chapter-02/verification/`. No runtime code moves until this is cleared.
2. **Migrations 011 + 012 + 013** (data model + RLS). Apply to prod via Supabase MCP. Includes `agent_runs` rename + new columns, `dispatch_jobs` extension (`agent_version`, `retry_count`, `last_retry_at`, `failed_permanently` status), `notifications` table.
3. **`agents/registry.js` + contract scaffold.** Move four Phase 01 agents to the contract shape from §3.5. Declare `inputs.files` (empty), `triggers`, `META.version`. NO behavior change yet.
4. **`/api/agents/run` + inter-edge HMAC.** New endpoint with the contract runtime per §5.2. Writes `qbp_snapshot`, `file_refs`, `runtime_args`, `agent_version` on every `agent_runs` row. Accepts `runtime_args.qbp_source`. Lock + regenerate still call the old `/api/agents/dispatch` for now.
5. **`/api/agent-runs/[id]/replay` endpoint (§5.3.1).** GET only. RLS-scoped to caller. Used by the Console replay panel.
6. **Lock endpoint refactor (Option A pattern).** Pre-insert artifact rows with `status='queued'` and `dispatch_id` BEFORE firing child fetches. Use `context.waitUntil()` for the child fetches to `/api/agents/run`. Return 202. **10-run prod verification: zero stuck dispatches, zero 504s.** This is the §11.9 acceptance gate.
7. **Regenerate endpoint refactor.** Same pattern. Accepts `qbp_source='current'` (default) or `'original'`. 10-run concurrent regenerate verification.
8. **Reaper cron.** Wire `/api/cron/reaper` with the 30 s / 2 min / 5 min backoff schedule. Test: induce stuck dispatch (manual artifact in `queued` state with parent `dispatch_jobs` in `producing`), watch the reaper retry, exhaust at retry 3, observe `failed_permanently` + email + notification.
9. **Chain orchestration.** Wire the chain-trigger logic per §5.4. Verify tier-gate short-circuit for free users. Chapter 2 has no Phase 02 agents to chain INTO, but the framework is testable by adding a synthetic test agent in a feature-flagged dev module.
10. **`/agents` surface · Phase view.** Phase 01 agents with state, Phase 02-05 as locked rows with the gating copy ("Unlocks when Starter tier is active"), two-button rerun for prior-delivered agents.
11. **`/agents` surface · Run history view + replay panel.** List of `agent_runs` with click-through to the replay panel. Replay panel surfaces frozen inputs from `qbp_snapshot`, `file_refs`, `runtime_args`, `agent_version`.
12. **Notifications.** Build the bell component, wire it to every signed-in surface, build the dropdown with click-to-clear, ship the `dispatch_failed` and `chain_ready` email templates. Migration 013 already applied in step 2.
13. **Foundation `?upgrade=success` banner.** Small UX fix in foundation.html (§11.11).
14. **`api/agents/dispatch` deprecation.** Route to `/api/agents/run` or 410. Lock + regenerate already migrated.
15. **End-to-end QA pass.** Same shape as Chapter 1 step 17. Fresh user, full path, all gates.
16. **Final sign-off + smoke + CHAPTER_02_COMPLETION.md.**

Each step starts only when the prior is merged AND verified. **Step 1 is a hard gate on every subsequent step.**

---

## 14. Open questions · ANSWERED in spec review

All five questions resolved in Nizzar's PR #66 review. Recorded here so the resolution is traceable.

1. **Architectural decision (§2).** **ANSWERED: Option A confirmed.** Cod's five reasoning points hold. Non-negotiable addition: the §2.5 pre-implementation gate. No production code lands on Option A until the PR #59 stuck-dispatch failure mode is reproduced, the root cause is confirmed, and the new pattern is explicitly verified to address it. Build step 1 is the gate.

2. **Phase 02 agent visibility.** **ANSWERED: Phase 02 cards remain visible in the Agent Console as locked rows with explicit unlock copy ("Unlocks when Starter tier is active").** No Phase 02 agents are built in Chapter 2. The console is the surface; the framework is the substrate. Phase 02 agents ship in Chapter 4. See §6.3.

3. **DAG view scope.** **ANSWERED: out of scope for Chapter 2.** Agent Console shows agents as a list with status, last run, next run, manual rerun, plain-text dependencies ("Depends on: Soul Map synthesis"). Visual DAG view is a post-launch enhancement. See §6.2 + §12.

4. **Notification bell scope.** **ANSWERED: in scope, MVP shape only.** Bell icon in every signed-in surface, badge count for unread, click reveals dropdown with last 10 notifications. No preferences UI. No mark-all-read button (each notification clears on click). Persisted in `public.notifications` with RLS. See §7.

5. **Reaper retry count.** **ANSWERED: 3 retries with exponential backoff (30 s, 2 min, 5 min).** After retry 3, `dispatch_jobs.status = 'failed_permanently'` and the Agent Console surfaces a manual retry CTA. Email user only on permanent failure, not on intermediate retries. See §5.5 + §7.

## 15. Additional spec requirements · integrated from PR #66 review

Beyond the five §14 answers, Nizzar's review added four requirements. All integrated into the spec:

1. **Agent contract `inputs.files` declared as forward-compat for Chapter 3.** Typed array of `{ type, source, optional }`. Chapter 2 agents declare empty arrays; the asset layer that fulfills them ships in Chapter 3. See §3.2 + §3.5.

2. **Run history supports replay.** Every `agent_runs` row writes `qbp_snapshot`, `file_refs`, `runtime_args`, `agent_version` at run start. Replay surfaces both in the Agent Console run-history view and on the artifact reading surface ("What produced this version" link). See §4.1 + §5.3.1 + §6.5 + §11.7.

3. **`agent_version` on every `dispatch_jobs` row.** When a synthesizer's prompt or schema bumps, downstream queries can distinguish artifacts produced by v1 vs v2. The per-row precision lives on `agent_runs.agent_version`. See §4.2.

4. **Manual rerun two-button semantics.** "Rerun with current QBP" (default, primary) vs "Rerun with original QBP" (secondary). Different `qbp_source` runtime arg. Original-pill disabled with tooltip for Chapter 1 legacy artifacts. See §5.3 + §6.4.

---

## End of Chapter 2 specification draft.

Hold all code until explicit spec approval.
