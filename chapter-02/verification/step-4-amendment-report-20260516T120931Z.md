# Chapter 2 · Step 4 amendment · retry semantics deferred to reaper · CLAUDE_TIMEOUT_MS audit

**Step:** Pre-step-4 amendment PR. The framework's §5.2.1 latency-budget pre-check fired at module load and caught a flaw in the prior `retry_budget: 1` adjudication. Step 4 code is blocked on this amendment landing.
**Generated:** 2026-05-16T12:09:31Z.
**Spec sections amended:** §5.2.1 (mandatory rule + two-layer pre-check), §5.5 (reaper handles dual-mode recovery), §3.5 (mandatory rule in META comment), §11.12 (registration check), §12 (known debt).
**Verdict:** **AMENDMENTS APPLIED. STEP 4 CODE STILL HELD.** All four agents now declare `retry_budget: 0`. Runtime files drafted locally are NOT in this PR; they ship after the spec amendment merges and step 4 code begins per the user's order.

---

## 1. What the framework caught

The §5.2.1 pre-check runs at module load against `AGENT_OBSERVED_LATENCY_MS` from each agent's verification report. With the prior adjudication's `retry_budget: 1` on three agents:

```text
[agents/registry] latency-budget warning: soul_map_synthesizer    · worst case 30000ms exceeds 22000ms (15.0 s × 2)
[agents/registry] latency-budget warning: visual_dna_synthesizer  · worst case 45800ms exceeds 22000ms (22.9 s × 2)
[agents/registry] latency-budget warning: war_table_synthesizer   · worst case 34000ms exceeds 22000ms (17.0 s × 2)
```

Sensescape was the only agent inside budget · the prior adjudication had already moved it to `retry_budget: 0`. The other three were over the 22 000 ms warning threshold; Visual DNA was also over the 25 000 ms hard Edge ceiling. **At `retry_budget: 1`, no heavy agent fits a two-attempt cycle inside a single Edge invocation.**

The prior adjudication's assumption ("worst case is 2 Claude calls per agent run") held only if 2 × latency fit the Edge budget. For Sonnet on Phase 01 prompts, it doesn't. The pre-check was the framework doing exactly what §5.2.1 was written for.

---

## 2. Adjudication · Option 3 (reaper-layer recovery)

User chose Option 3: defer retry semantics to the reaper layer (§5.5) entirely. Each `/api/agents/run` invocation is single-shot inside its own 25 000 ms Edge budget. Schema-invalid completions count against `retry_count` and are re-fired by the reaper within the 30 s cron window. The user-visible failure rate matches in-call retry but with a 30 s recovery latency added.

Option 3 reframes the safety net: not "two attempts per invocation" but "one attempt per invocation, with cron-driven retry across invocations." The reaper infrastructure already exists in §5.5 for stuck dispatches; the amendment extends it to schema-invalid completions. No new tier of infrastructure; the existing layer absorbs the recovery role.

---

## 3. Spec amendments landed

### 3.1 §5.2.1 · mandatory rule + two-layer pre-check

The methodology rule is now: when latency × (retry_budget + 1) exceeds the Edge budget, the agent **MUST** declare `retry_budget: 0` and defer retry semantics to the reaper layer. The pre-check enforces in two layers:

- **22 000 ms warning** (non-fatal, logged + operator-notified). The agent ships but headroom is thin.
- **25 000 ms hard ceiling** (fatal at `assertAgentMetaOrThrow`). Registration fails; the runtime refuses to accept dispatches.

The conformance suite (§11.12) treats the hard-fail path as the registration test.

### 3.2 §5.5 · dual-mode reaper recovery

The reaper now handles two recoverable failure modes:

- **(a) Stuck dispatches** · artifact still `queued`, parent context tore down (the PR #59 mechanism)
- **(b) Schema-invalid completions** · artifact `failed` with `error_payload.code = 'schema_validation_failed'` (or `edge_timeout`, `model_call_failed`)

Both modes are recoverable by re-firing `/api/agents/run` as a fresh Edge invocation. Both count against `retry_count`, capped at 3 before `failed_permanently`.

### 3.3 §3.5 · mandatory rule in META comment + retry_budget: 0 in the example

The §3.5 META example now declares `retry_budget: 0` (not `1`) with a comment naming the mandatory rule. The "agents that exceed budget MUST declare retry_budget: 0" language is in-place where every new agent author will read it.

### 3.4 §11.12 · registration check enforced at the ceiling

New criterion: `(retry_budget + 1) × declared_latency ≤ EDGE_FUNCTION_CEILING_MS`. Failure throws at `assertAgentMetaOrThrow`. The 22 000 ms warning is signal; the 25 000 ms ceiling is the gate. Implementation lands with step 4 code (the contract.js validator currently warns; the throw on ceiling violation is a step 4 deliverable).

### 3.5 §12 · known debt updated

All four agents at `retry_budget: 0` is now documented debt with the resolution path (step 6+ streaming/async). Visual DNA's marginal status (22.9 s observed vs 22 000 ms warning) is called out separately.

---

## 4. Code changes in this PR

### 4.1 META retry_budget across all four agents

| Agent | retry_budget (before) | retry_budget (after) |
| --- | --- | --- |
| `soul_map_synthesizer` | 1 | **0** |
| `sensescape_synthesizer` | 0 | 0 (unchanged) |
| `visual_dna_synthesizer` | 1 | **0** |
| `war_table_synthesizer` | 1 | **0** |

Each agent's META comment now references the §5.2.1 mandatory rule and names the reaper layer (§5.5) as the recovery path.

### 4.2 Post-amendment pre-check state

```text
[agents/registry] latency-budget warning: visual_dna_synthesizer · worst case 22900ms exceeds 22000ms (single-shot, retry_budget=0)
registry OK · agents: soul_map_synthesizer, sensescape_synthesizer, visual_dna_synthesizer, war_table_synthesizer
latency warnings: 1
```

One warning remains: **Visual DNA at single-shot is 900 ms above the warning threshold but 2 100 ms below the ceiling.** The agent registers cleanly (would pass the future hard-fail check at 25 000 ms). The warning surfaces to the operator notification channel on every registry load · the operator sees the marginal status without it blocking dispatch. Resolution path: step 6+ streaming/async.

---

## 5. CLAUDE_TIMEOUT_MS audit · per-agent finding

Per the adjudication directive: audit deployed timeout vs observed worst-case latency. Document in this PR; do not fix.

| Agent | Deployed `CLAUDE_TIMEOUT_MS` | Observed worst case (step 3 phase B) | Headroom inside agent function | Notes |
| --- | --- | --- | --- | --- |
| `soul_map_synthesizer` | 22 000 ms | 15 000 ms | 7 000 ms | Comfortable |
| `sensescape_synthesizer` (Haiku 4.5) | 22 000 ms | 12 700 ms | 9 300 ms | Comfortable on Haiku · Sonnet would not fit at any retry_budget |
| `visual_dna_synthesizer` | 24 000 ms | 22 900 ms | **1 100 ms** | **Marginal · single Claude call has minimal headroom inside the agent function's own timer** |
| `war_table_synthesizer` | 24 000 ms | 17 000 ms | 7 000 ms | Comfortable |

**The Visual DNA finding.** `CLAUDE_TIMEOUT_MS = 24 000 ms` with an observed 22 900 ms worst case leaves 1 100 ms of headroom inside the agent's own AbortController. A 5 % latency variance pushes the call over the agent-level timer (returning `edge_timeout`) before it hits the Edge function's outer ceiling (25 000 ms total). This is technically a different timeout layer than §5.2.1: the agent's `CLAUDE_TIMEOUT_MS` aborts the fetch; the Edge function's runtime ceiling cuts the entire invocation.

The user's adjudication directive named this as a separate finding ("Visual DNA at 22.9 s observed vs 22000 ms deployed") but the deployed value is actually 24 000 ms · the user was mis-remembering. The finding holds either way: Visual DNA's single-shot wall is structurally close to its own timeout, and any natural latency variance will trip `edge_timeout` more often than the other three agents.

**Recommendation (not fixed in this PR per directive):** Visual DNA's prompt is a candidate for the same kind of tightening Sensescape received in step 3 phase B (Pass 2). The output token target (currently `MAX_TOKENS = 2400`) could be reduced if the artifact methodology allows. Defer to a later step when a prompt-tightening pass is in scope.

### 5.1 Why the audit matters now

With `retry_budget: 0` across all four agents, the reaper layer handles recovery. Visual DNA's marginal `CLAUDE_TIMEOUT_MS` means an elevated rate of `edge_timeout` failures in production · each one triggers a reaper retry within 30 s. The user-visible cost: more "Run failed, retrying" surface time on the Visual DNA row. Operationally tolerable; methodologically worth surfacing.

---

## 6. What is NOT in this PR

Per the adjudication's strict order ("step 4 code begins" only after the amendment lands):

- `api/agents/run.js` (the 12-step runtime) · drafted locally, **not staged**
- `agents/user-action-copy.js` (§5.8.1 canonical copy resolver) · drafted locally, **not staged**
- `api/_lib/operator-notify.js` (§5.8.2 Resend channel) · drafted locally, **not staged**
- The `EDGE_FUNCTION_CEILING_MS = 25 000` throw in `assertAgentMetaOrThrow` · part of step 4 code, not this PR
- Test endpoints for triggering `edge_timeout` and `model_call_failed` live (§11.12.1 a3 live) · step 4 verification work
- Conformance runner updates to dispatch via `/api/agents/run` (§11.12.1 a4 + a5) · step 4 verification work
- PR #67 reproduction harness rerun against the new runtime · step 4 verification work

These files are on disk on the `chapter-2/step-4-runtime` branch (alongside this PR's changes) but unstaged. They land in the step 4 code PR that opens after this amendment merges.

---

## 7. Definition of done · amendment PR

| Item | Status |
| --- | --- |
| §5.2.1 amendment · mandatory rule + two-layer pre-check | done |
| §5.5 amendment · dual-mode reaper recovery | done |
| §3.5 amendment · retry_budget: 0 example + mandatory-rule comment | done |
| §11.12 amendment · registration-time hard-fail check at ceiling | done |
| §12 known debt · all four agents at retry_budget: 0 + Visual DNA marginal callout | done |
| `agents/soul-map.js` retry_budget: 0 with §5.2.1 cross-reference | done |
| `agents/visual-dna.js` retry_budget: 0 with §5.2.1 cross-reference | done |
| `agents/war-table.js` retry_budget: 0 with §5.2.1 cross-reference | done |
| `agents/sensescape.js` retry_budget: 0 (unchanged) | done |
| Post-amendment registry import clean (1 warning · Visual DNA marginal) | done |
| CLAUDE_TIMEOUT_MS audit table | done · §5 of this report |
| Visual DNA marginal-timeout finding documented (no fix in PR) | done · §5.1 |
| Step 4 runtime code deferred to post-merge | done · §6 |
| Voice codex sweep on the diff | done |

---

## 8. Next step

Per the user's order:

1. ✅ This amendment PR opens, hold-open
2. ⏳ Move A production smoke test on Haiku Sensescape proceeds in parallel (user-initiated; not in this code path)
3. ⏳ User reviews both
4. ⏳ If both pass, merge both, then step 4 code begins per locked spec
5. ⏳ If smoke fails, stop, separate finding adjudication

Hold-open per Chapter 2 PR policy.

---

## End of step 4 amendment verification report
