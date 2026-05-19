# Chapter 2 · Step 8 spec

Status: spec lands as second commit on `chapter-2/step-8-spec` (PR #110). Hold-open per merge-gate protocol until explicit release.

Source authority: `CHAPTER_02_SPEC.md` §5.4 (chain orchestration) + §3.5 (agent contract) + §13.9 (build sequence step 9 · chain orchestration). Step 8 outline at [`chapter-02/step-8-outline.md`](step-8-outline.md). Adjudications from Nizzar (recorded in §2 below). Step 7 closure report forward references.

Prerequisites met (carried from step 6 + 7):
- `INTER_EDGE_SECRET`, `CRON_SECRET` live in Vercel Production.
- Vercel Pro tier active.
- Lock + regenerate Option A pattern verified.
- Reaper cron live + verified.
- Notification bell live (Realtime + poll fallback).
- Step 7 closure shipped at `d0f13eb`.

---

## 1. Bundle scope · what step 8 ships

Per outline framing (one chapter step, four sub-PRs):

| Sub-PR | Topic | Source spec |
| --- | --- | --- |
| 8A | Chain trigger logic in `/api/agents/run` + migration 016 (parent_agent_slug + chain_id + chain_depth + unique partial index) | §5.4 + §2.3 below |
| 8B | Synthetic test agent (`chain_test_agent`, feature-flagged via `CHAIN_TEST_AGENT === '1'`) | §2.4 below |
| 8C | Tier-gate short-circuit + `chain-orchestration.mjs` 5/5 harness | §5.4 + §6 below |
| 8D | Step 8 closure report · framework defect-rate review folded in | §11 build sequence |

Each sub-PR opens with a code commit + a verification report commit. Sub-PRs merge autonomously per the autonomous-chain posture (established step 6 closure, continued step 7). User touchpoint is the step 8 closure report only.

---

## 2. Locked decisions from outline review

Recorded so the resolutions are traceable. Same pattern as `CHAPTER_02_SPEC.md` §14 + prior chapter-step specs.

1. **Synthetic test agent slug + deps · default accepted, payload refinement added.** Slug `chain_test_agent`. Dependencies `['soul_map_synthesizer', 'sensescape_synthesizer']`. Two deps test multi-dep satisfaction without over-stressing the framework. **Refinement:** the deterministic output JSON embeds dep names + delivery timestamps so chain traces are self-describing in verification logs (no cross-table joins required to read what dep set triggered the fire):

   ```json
   {
     "schema_version": "1.0",
     "header": { "eyebrow": "test", "title": "Chain Test Agent", "agent": "chain_test_agent", "generated_at": "<ISO>", "version": 1 },
     "body_sections": [],
     "data_blocks": [
       {
         "kind": "chain_trace",
         "dependencies_satisfied": [
           { "agent_slug": "soul_map_synthesizer",   "artifact_id": "<uuid>", "delivered_at": "<ISO>" },
           { "agent_slug": "sensescape_synthesizer", "artifact_id": "<uuid>", "delivered_at": "<ISO>" }
         ],
         "chain_id": "<uuid>",
         "chain_depth": 1
       }
     ],
     "footer": {}
   }
   ```

2. **Feature-flag mechanism · default accepted with two strict conditions.**
   - **A.** Registry load uses strict string equality: `if (process.env.CHAIN_TEST_AGENT === '1')`. Truthy checks fail open; strict equality fails closed.
   - **B.** Registry startup log line names whether the test agent is loaded: `"agent registry loaded · 4 prod agents"` vs `"agent registry loaded · 4 prod agents + 1 test agent (CHAIN_TEST_AGENT=1)"`. If the test agent ever appears in prod deploy logs, the anomaly surfaces immediately in observability.

3. **`parent_agent_slug` column · OVERRIDE accepted · structural call.** Migration 016 adds BOTH columns plus depth + the unique partial index:
   - `dispatch_jobs.parent_agent_slug VARCHAR` · immediate parent agent's slug for fast lookup.
   - `dispatch_jobs.chain_id UUID` · groups all dispatches in the same fan-out tree. Seeds at the lock-foundation parent dispatch (`chain_id = lock dispatch_jobs.id`). Every chain-fired dispatch inherits the same chain_id. Reruns and regenerates do NOT inherit chain_id (user-triggered, not chain-triggered · their `chain_id` is NULL).
   - `dispatch_jobs.chain_depth INTEGER DEFAULT 0` · per adjudication #5 (chain depth cap).
   - `CREATE UNIQUE INDEX dispatch_jobs_chain_unique ON public.dispatch_jobs (chain_id, agent_slug) WHERE kind = 'chain'` · enforces idempotency at the DB layer.

   This makes "what fired automatically in this lock run" a single query: `SELECT * FROM dispatch_jobs WHERE chain_id = <root_id>`. Also powers the unique-index idempotency check in adjudication #4 and the future archive tree-view in step 9.

4. **Reaper interaction idempotency · OVERRIDE accepted · DB-enforced.** In-flight detection alone is insufficient · a reaper-retried parent that already chain-fired before retry will fire chain a second time on the retry path (in-flight check returns false because the downstream completed in the interim). DB enforces the constraint instead:
   - Unique partial index per §2.3 above.
   - Spec idempotency logic in `/api/agents/run`: attempt insert `dispatch_jobs` row with `kind='chain'`; if PostgREST surfaces a `23505` unique-violation, skip silently (the chain already fired). No application-level in-flight check for THIS class of duplicate. Existing in-flight check on the downstream artifact still applies for the unrelated case of two concurrent chain-eligible deliveries reaching the trigger logic simultaneously.

5. **Chain depth cap · OVERRIDE accepted · 8.** Phase 01 → 02 → 03 → 04 → 05 is 5 hops minimum at the Chapter 4 mapping. Within-phase chaining adds 1-2. Depth 8 leaves headroom without permitting accidental infinite recursion (cycle bugs, transitive dep loops).
   - Lock-foundation root dispatch: `chain_depth = 0`.
   - Each chain-fire sets `chain_depth = parent_dispatch.chain_depth + 1`.
   - If a chain-fire's prospective depth would exceed 8: refuse the fire, send a Resend operator email (`subject: "QB BrandOS · chain depth exceeded (framework defect-class event)"`), log with `[chain-depth-exceeded]` marker. This is a framework-bug-class event, not user-facing; the affected user's experience is "this chain didn't fire" with no Console-side error surface.

6. **`chain_ready` notification scope · default accepted.** No emitter in Chapter 2. The `chain_ready` kind exists in the `notifications.kind` enum from migration 013 but has no Chapter 2 caller. **Captured in §10 forward references: "chain_ready notification emitter waits for Chapter 4 Phase 02 synthesizer rollout. Kind enum reserved; emitter is not."**

---

## 3. Migration 016 · dispatch_jobs chain metadata + unique index

```sql
-- 016_dispatch_jobs_chain.sql
-- Chapter 2 · Step 8 · chain orchestration data model.

alter table public.dispatch_jobs
  add column if not exists parent_agent_slug varchar,
  add column if not exists chain_id          uuid,
  add column if not exists chain_depth       integer not null default 0;

-- Unique partial index · DB-enforced "one chain-fire per (tree, downstream) ever".
-- Only applies to chain-fired rows; user-triggered reruns and regenerates have
-- chain_id = NULL and are not constrained.
create unique index if not exists dispatch_jobs_chain_unique
  on public.dispatch_jobs (chain_id, agent_slug)
  where kind = 'chain';

-- chain_id index for the "what fired automatically in this lock run" query
-- pattern. Partial: only chain or root rows; ignores reruns/regenerates with
-- chain_id = NULL.
create index if not exists dispatch_jobs_chain_id_idx
  on public.dispatch_jobs (chain_id)
  where chain_id is not null;
```

Applied via Supabase MCP `apply_migration` in sub-PR 8A. Verified by `pg_indexes` read post-migration.

`chain_id` seeding rule:
- Lock-foundation parent dispatch: `chain_id = self.id` after insert.
- Regenerate / rerun dispatches: `chain_id = NULL` (user-triggered, not chain-triggered).
- Reaper-retry of a parent: `chain_id` unchanged (the row is reused, not re-inserted).
- Chain-fired dispatches: `chain_id = parent.chain_id` (inherits the tree's root).

Implementation note · the lock-foundation handler currently inserts the dispatch_jobs row then has its id. The handler needs a post-insert UPDATE to set `chain_id = id` (because a self-reference at insert time requires either a returning clause + immediate UPDATE or an `id` column-generated default). The dispatch-pattern.js `preInsertDispatch` helper will handle this for `kind='lock'` cases (set `chain_id = dispatchId` after the insert returns).

---

## 4. Sub-PR 8A · chain trigger logic in `/api/agents/run` + migration 016

### 4.1 File-level scope

| File | Change |
| --- | --- |
| `supabase/migrations/016_dispatch_jobs_chain.sql` (new) | Migration per §3. |
| `api/agents/run.js` | After successful delivery, call `triggerChainIfReady({...})` (new helper · see §4.2). |
| `api/_lib/chain-trigger.js` (new) | `triggerChainIfReady()` · the chain-orchestration logic. |
| `api/_lib/dispatch-pattern.js` | `preInsertDispatch` accepts new optional fields (`parentAgentSlug`, `chainId`, `chainDepth`). For `kind='lock'`, sets `chain_id = dispatchId` after insert. |
| `api/lock-foundation.js` | Pass `chainId: dispatchId` to its own preInsertDispatch (via the same post-insert UPDATE pattern). Verify chain_depth=0 implicit via default. |

### 4.2 `triggerChainIfReady({...})` contract

```
Input:
  · env                    · SUPABASE_URL + SERVICE_ROLE_KEY for service-role queries
  · userId                 · the run's user
  · upstreamSlug           · the agent that just delivered
  · upstreamArtifact       · { id, version, dispatch_id }
  · parentDispatch         · the upstream agent's dispatch_jobs row { id, chain_id, chain_depth }
  · baseUrl                · for fireChildRuns

Logic (per §5.4 + §2.3-2.5):
  1. registry = listAgents() · filter to those with inputs.dependencies including upstreamSlug
  2. For each candidate downstream agent:
     a. Check ALL its dependencies are delivered for this user (latest delivered artifact per slug)
     b. Check tier-gating · canRun(profile.tier, downstream_slug)
     c. If depth-of-child = parentDispatch.chain_depth + 1 > 8: log + emit operator email, skip
  3. For each surviving candidate · attempt preInsertDispatch with:
     · kind='chain'
     · parent_agent_slug=upstreamSlug
     · chain_id=parentDispatch.chain_id (or parentDispatch.id if chain_id is null · for safety)
     · chain_depth=parentDispatch.chain_depth + 1
  4. Catch PostgREST 23505 unique-violation · log [chain-idempotent-skip] + continue (the chain already fired)
  5. For each successfully inserted dispatch · fireChildRuns(...) with the new artifact_id (also pre-inserted by preInsertDispatch)
  6. waitUntil keeps the parent Edge function alive past 202 return
```

The chain trigger runs INSIDE `/api/agents/run` after the artifact transitions to `status='delivered'`. It does NOT block the response · waitUntil pattern.

### 4.3 Acceptance for 8A

Migration 016 applied · verified by:

```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='dispatch_jobs'
  and column_name in ('parent_agent_slug', 'chain_id', 'chain_depth');
-- expect 3 rows

select indexname from pg_indexes
where schemaname='public' and tablename='dispatch_jobs'
  and indexname in ('dispatch_jobs_chain_unique', 'dispatch_jobs_chain_id_idx');
-- expect 2 rows
```

Then 8B + 8C land the synthetic agent + harness for end-to-end gate coverage.

---

## 5. Sub-PR 8B · synthetic test agent (`chain_test_agent`)

### 5.1 File-level scope

| File | Change |
| --- | --- |
| `agents/chain-test-agent.js` (new) | The synthetic agent module per §3.5 contract. |
| `agents/registry.js` | Conditionally load `chain-test-agent` if `process.env.CHAIN_TEST_AGENT === '1'`. Strict equality. Startup log line per §2.2 condition B. |

### 5.2 Agent shape (per §3.5 contract)

```js
export const META = {
  slug: 'chain_test_agent',
  display_name: 'Chain Test Agent',
  description: 'Synthetic agent for chain-orchestration verification. Loaded only when CHAIN_TEST_AGENT=1.',
  phase: '99', // sentinel · not a real chapter phase
  tier_required: 'starter',
  version: 1,
  model: 'claude-haiku-4-5-20251001', // never actually called · marker only
  retry_budget: 0,
};

export const INPUTS = {
  files: [],
  qbp_fields: [], // no qbp required · isolated from user state
  dependencies: ['soul_map_synthesizer', 'sensescape_synthesizer'],
};

export const TRIGGERS = ['chain']; // explicitly NOT 'lock' · cannot be lock-fired

// The synthesizer skips Claude entirely · returns a deterministic artifact
// embedding dep names + delivery timestamps so chain traces are self-
// describing in verification logs. Per spec §2.3 refinement.
export async function synthesize({ user, qbp, dependencies, dispatch, supaUrl, serviceKey }) {
  const depTraces = await Promise.all(
    INPUTS.dependencies.map(async (depSlug) => {
      // Look up the latest delivered artifact for the dep
      const r = await fetch(
        `${supaUrl}/rest/v1/artifacts?user_id=eq.${user.id}` +
        `&artifact_type=eq.${depSlug}&status=eq.delivered` +
        `&select=id,updated_at&order=version.desc&limit=1`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );
      const rows = r.ok ? await r.json() : [];
      const row = rows?.[0];
      return {
        agent_slug: depSlug,
        artifact_id: row?.id || null,
        delivered_at: row?.updated_at || null,
      };
    })
  );

  return {
    schema_version: '1.0',
    header: {
      eyebrow: 'test',
      title: 'Chain Test Agent',
      agent: 'chain_test_agent',
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections: [],
    data_blocks: [{
      kind: 'chain_trace',
      dependencies_satisfied: depTraces,
      chain_id: dispatch?.chain_id || null,
      chain_depth: dispatch?.chain_depth ?? null,
    }],
    footer: {},
  };
}
```

### 5.3 Registry conditional load

```js
// agents/registry.js (excerpt)

import { META as SOUL_MAP, ...} from './soul-map-synthesizer.js';
import { META as SENSE,    ...} from './sensescape-synthesizer.js';
import { META as VDNA,     ...} from './visual-dna-synthesizer.js';
import { META as WAR_TBL,  ...} from './war-table-synthesizer.js';

const PROD_AGENTS = {
  soul_map_synthesizer:   { META: SOUL_MAP, ... },
  sensescape_synthesizer: { META: SENSE,    ... },
  visual_dna_synthesizer: { META: VDNA,     ... },
  war_table_synthesizer:  { META: WAR_TBL,  ... },
};

let AGENTS = { ...PROD_AGENTS };

if (process.env.CHAIN_TEST_AGENT === '1') {
  const testAgent = await import('./chain-test-agent.js');
  AGENTS = { ...AGENTS, chain_test_agent: { META: testAgent.META, INPUTS: testAgent.INPUTS, ... } };
  console.log('agent registry loaded · 4 prod agents + 1 test agent (CHAIN_TEST_AGENT=1)');
} else {
  console.log('agent registry loaded · 4 prod agents');
}

export { AGENTS };
```

Strict `=== '1'` per §2.2 condition A. Startup log line per condition B.

### 5.4 Acceptance for 8B

- Registry loads `chain_test_agent` ONLY when `CHAIN_TEST_AGENT=1` env var is set. Verified by grepping the agent_slug enum in the deployed `/api/agents/console` response with and without the env var.
- Startup log line surfaces in Vercel runtime logs · "+ 1 test agent" appears in verification environment; "4 prod agents" appears in prod.

---

## 6. Sub-PR 8C · tier-gate + verification harness

### 6.1 File-level scope

| File | Change |
| --- | --- |
| `tests/chapter-02/chain-orchestration.mjs` (new) | 5-acceptance-gate harness per §6.2. |
| `api/_lib/chain-trigger.js` | Tier-gate short-circuit · `canRun(profile.tier, downstream_slug)` from `api/_lib/tier-gating.js`. |

### 6.2 Acceptance for 8C

1. **Chain fires on satisfied deps** · single user, `CHAIN_TEST_AGENT=1` env var set in Vercel Preview deployment used for verification. Lock-foundation fires four Phase 01 synthesizers. When BOTH `soul_map_synthesizer` AND `sensescape_synthesizer` deliver, `chain_test_agent` auto-fires. Verify: `dispatch_jobs.kind='chain'`, `parent_agent_slug=<last-completing-dep>`, `chain_id=<lock-root-dispatch-id>`, `chain_depth=1`, `agent_runs.trigger='chain'`. Artifact's `data_blocks[0].dependencies_satisfied` lists both deps with their timestamps.
2. **No fan-out when deps unsatisfied** · simulate a partial state · only Soul Map delivered, Sensescape failed. Verify `chain_test_agent` does NOT fire (single-dep satisfied, but dep set requires both).
3. **DB-enforced idempotency** · simulate reaper retry on the upstream parent (manually replay the chain trigger logic for the same chain_id + downstream_slug combo). Verify PostgREST returns 23505 unique-violation on the second insert · the helper catches it and logs `[chain-idempotent-skip]`. No second `dispatch_jobs` row exists.
4. **Tier-gate short-circuit** · free-tier user; chain_test_agent.META.tier_required='starter'. After both deps deliver, chain does NOT fire. Verify by inspecting `dispatch_jobs` count for the user · no chain row.
5. **Depth cap at 8** · synthetic test with a manufactured chain_depth=8 on the parent dispatch. The chain trigger refuses to fire a new row, logs `[chain-depth-exceeded]`, sends Resend email if `RESEND_API_KEY` is set. Verify by inspecting logs + no new dispatch_jobs row.

Plus regression check: 7A rerun-conformance 10/10 still PASS; 7C bell-realtime 5/5 still PASS; step 6E 15-state capture matrix still re-fires green.

### 6.3 Synthetic test environment setup

The acceptance gates require `CHAIN_TEST_AGENT=1` to be set in the Vercel deployment serving the verification harness. Two options:
- **Prod-staging shared env** · set the env var on prod for the verification window, then remove. Risk: chain_test_agent appears in prod registry during the window.
- **Vercel preview deployment** · set the env var only on a preview deployment for the verification branch. No prod impact.

Spec defaults to the **preview-deployment** option for safety. The harness uses `BASE` env var to point at the preview URL during the verification run. Captured in 8C verification report.

---

## 7. Sub-PR 8D · step 8 closure

The 8D PR is verification-only (no code change beyond the harness + closure report).

### 7.1 Required closure-report sections (per goal)

- **PR ledger** across step 8 sub-PRs.
- **Migration 016 applied** · `pg_indexes` confirmation.
- **Framework defect-rate review** · count latent bugs surfaced during step 8 verification cycles. Aggregate with the 3 from step 7 (+ potentially 5 across the chapter). If aggregate exceeds 5 across the chapter, flag for a hardening pass before chapter 3 spec opens. This is a goal-mandated review.
- **Branch-state verification discipline** · note if it recurred during step 8.
- **Any new patterns** emerging from the chain-orchestration surface.
- **Forward notes** · step 9 archive tree-view, etc.

### 7.2 Local cleanup performed in 8D

Per the goal pattern continuing from step 7 closure: completed-agent worktree branches removed in the closure commit. `git worktree remove -f -f` + `git branch -D`.

---

## 8. Acceptance criteria (consolidated)

Per §4.3 + §5.4 + §6.2:

1. **Migration 016 applied** · 3 columns + 2 indexes present on `dispatch_jobs`.
2. **Chain fires on satisfied deps** (8C gate 1).
3. **No fan-out when deps unsatisfied** (8C gate 2).
4. **DB-enforced idempotency** (8C gate 3 · 23505 catch).
5. **Tier-gate short-circuit** (8C gate 4).
6. **Depth cap enforced** (8C gate 5).
7. **No regression** · 7A 10/10, 7C 5/5, step 6E 15-state matrix re-fire green.
8. **Registry log line** verified in deploy logs (8B).

---

## 9. Out of scope

Explicit:

- Phase 02+ real synthesizers (Chapter 4).
- `chain_ready` notification emitter (deferred per adjudication #6).
- `/api/agents/dispatch.js` retirement (step 14).
- Archive UI tree-view for chains (step 9 forward note).
- Foundation `?upgrade=success` banner (step 13).
- Loop counter / revision tracking at framework layer (carried from step 7 · agent author responsibility).
- DAG view (CHAPTER_02_SPEC.md §14.3 explicit out-of-scope).
- Notification preferences UI (CHAPTER_02_SPEC.md §14.4 explicit out-of-scope).
- chain_test_agent in prod registry (prevented by strict env-var equality check per adjudication #2).

---

## 10. Build sequence inside step 8

Per the autonomous-chain posture:

1. **Sub-PR 8A** opens · migration 016 + chain trigger logic + dispatch-pattern.js extensions. Gate: migration applied via Supabase MCP + `pg_indexes` confirmation. Auto-merge on gates green.
2. **Sub-PR 8B** opens against main · synthetic agent module + registry conditional load. Gate: deploy-log confirmation, agent slug enum check. Auto-merge.
3. **Sub-PR 8C** opens · tier-gate + chain-orchestration.mjs harness. Vercel preview deployment with `CHAIN_TEST_AGENT=1`. Gate: 5/5 acceptance + regression checks. Auto-merge.
4. **Sub-PR 8D** opens · step 8 closure report (defect-rate review, branch-state discipline, forward notes) + local worktree cleanup. Auto-merge.
5. **Step 8 closes.** Surface to Nizzar at the closure report only.
6. **Step 9 spec opens immediately** on `chapter-2/step-9-spec` per §13.10 + accumulated forward notes (archive tree-view, etc.). Outline first, six adjudications.

---

## 11. Open questions

None at spec-write time. All six outline-level open calls adjudicated in §2 above. Any new question that surfaces during sub-PR implementation gets captured in the affected sub-PR's verification report (per autonomous-chain posture · blocker-only escalation).

---

## 12. Forward references

- **`chain_ready` notification emitter** waits for Chapter 4 Phase 02 synthesizer rollout. Kind enum reserved in migration 013; emitter is not implemented in Chapter 2.
- **Step 9 · archive UI tree-view rendering.** Surfaced as step 7 forward note + amplified by step 8's `chain_id` column. The query `SELECT * FROM dispatch_jobs WHERE chain_id = <root_id>` returns the full chain tree for a lock run; the Archive surface needs a tree visualization to render this readably.
- **Step 13** Foundation `?upgrade=success` banner.
- **Step 14** `/api/agents/dispatch.js` retirement.
- **Chapter 4** Phase 02 synthesizers · Logo Direction, Logo Evaluation, Voice Guide. First real chain consumers.

---

## 13. End of step 8 spec

Sub-PR 8A opens on a new branch off main once this spec lands and the hold gate releases.
