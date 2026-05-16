# Chapter 2 · Step 4 · retry_budget amendment · reaper-as-recovery

**Step:** Step 4 spec amendment · the framework's pre-check fired on three of four agents at module load and the prior adjudication was self-corrected before any runtime code shipped.
**Generated:** 2026-05-16T12:10:08Z.
**Branch:** `chapter-2/step-4-runtime` (this PR's amendment work; the runtime code itself is held until this lands).
**Verdict:** **AMENDMENTS LAND CLEAN.** Spec updated per the Option 3 adjudication. All four Phase 01 agents declare `retry_budget: 0`. Reaper layer is the framework's retry safety net. Step 4 runtime code remains drafted locally but unstaged until this amendment merges.

---

## 1. What the framework caught

During step 4 build-out, the runtime imports loaded `agents/registry.js`. The §5.2.1 pre-check fired three warnings:

```text
[agents/registry] latency-budget warning: soul_map_synthesizer  · 30000ms exceeds 22000ms (15s × 2)
[agents/registry] latency-budget warning: visual_dna_synthesizer · 45800ms exceeds 22000ms (22.9s × 2)
[agents/registry] latency-budget warning: war_table_synthesizer  · 34000ms exceeds 22000ms (17s × 2)
```

The prior step-4-spec adjudication had approved `retry_budget: 1` as the default with Sensescape as the only `retry_budget: 0` carve-out. The latency math says that's wrong: at `retry_budget: 1`, three of four agents have a worst-case wall × 2 that does not fit inside the 25 s Edge ceiling.

Visual DNA's 45.8 s would not only trip the 22 s warning · it would exceed the 25 s ceiling entirely. The Edge function would terminate the second Claude call mid-stream. Silent runtime debt of exactly the kind §5.2.1's methodology rule was written to prevent.

---

## 2. The Option 3 reframe

In the alternatives review, three paths were on the table:

- **Option 1** · drop all four to `retry_budget: 0`, lose the in-call safety net, no replacement.
- **Option 2** · keep `retry_budget: 1`, accept the budget violation as known debt. Contradicts §5.2.1's "silent shipping is not acceptable" rule.
- **Option 3** · defer retry semantics to the reaper layer entirely. Each `/api/agents/run` is single-shot inside its own Edge budget; the reaper re-fires failed runs as fresh invocations.

Option 3 chosen. Architectural reasons:

1. **Eliminates the budget violation by design, not by exception.** Option 1 ships clean but treats budget violation as a four-way exception. Option 3 reframes: the safety net is the reaper, not in-call. Architecturally cleaner.
2. **Each call is independent.** When a single-shot returns schema-invalid, runtime writes failed; reaper picks up at the next cron tick (≤30 s window); re-fires `/api/agents/run` as a fresh Edge invocation with its own 25 s budget. This is the queue-worker pattern.
3. **User-visible failure rate matches Option 1, with a ~30 s recovery window.** No different from the in-call retry pattern from the user's perspective.
4. **`retry_budget` stays a contract field** for future agents whose math fits (streaming runtime, faster models, shorter prompts).

---

## 3. Spec amendments (this PR)

### 3.1 §5.2.1 · mandatory rule + two-layer enforcement

Replaced the old "EITHER tighten OR defer" framing with the cleaner mandatory rule:

> When `observed_avg_latency × (retry_budget + 1)` exceeds the 22 000 ms Edge budget, the agent **MUST** declare `retry_budget: 0` and defer retry semantics to the reaper layer (§5.5). In-call retry is reserved for agents whose worst-case latency × 2 fits inside the 22 000 ms warning threshold.

Plus two-layer enforcement:

- **Warning (non-fatal):** worst case > 22 000 ms but ≤ 25 000 ms. Logs to operator notification channel.
- **Hard fail at registration (fatal):** worst case > 25 000 ms. `assertAgentMetaOrThrow` throws; runtime does not accept dispatches for the agent.

### 3.2 §5.5 · reaper dual-mode recovery

Reaper now explicitly handles two failure modes:

- **(a)** stuck dispatches where parent context tore down before children executed (the PR #59 mechanism)
- **(b)** schema-invalid completions where the agent returned but the result failed schema validation

Both modes are recoverable by re-firing `/api/agents/run` as a fresh Edge invocation. Schema-invalid failures count against `retry_count` the same way stuck dispatches do, capped at 3 attempts before `failed_permanently`. For mode (b), the re-fire resets the prior failed artifact's status to `queued` AND opens a fresh `agent_runs` row · the prior failed run stays in history as audit.

### 3.3 §3.5 · META documentation

META example updated to document the constraint:

> Agents whose worst-case latency × 2 exceeds Edge budget MUST declare `retry_budget: 0`. Current Chapter 2 agents (soul_map, sensescape, visual_dna, war_table) all declare `retry_budget: 0` and rely on reaper-layer recovery.

### 3.4 §12 · known debt updated

Replaces the Sensescape-only callout with the full four-agent context:

- All four Chapter 2 synthesizers ship `retry_budget: 0` per §5.2.1 mandatory rule.
- Reaper layer (§5.5) handles schema-invalid recovery.
- `retry_budget: 1` becomes available again for agents that fit budget when streaming/async runtime lands in step 6+.
- Visual DNA flagged as marginal (22.9 s observed vs 22 000 ms warning threshold) even at `retry_budget: 0`.
- Adds the CLAUDE_TIMEOUT_MS audit (§4 of this report) for ops visibility.

### 3.5 §11.12 · conformance criteria for budget check

Adds an acceptance criterion:

> Step-4 amendment: retry_budget validation enforced at registration. The conformance check verifies that `(retry_budget + 1) × declared_latency ≤ EDGE_FUNCTION_CEILING_MS`. Failure fails agent registration. The 22 000 ms warning threshold logs a non-fatal signal; the 25 000 ms ceiling is the hard fail.

Implementation lands with step 4 code (this PR is amendment-only).

---

## 4. CLAUDE_TIMEOUT_MS audit (finding · no fix in this PR)

Per the adjudication: audit deployed timeouts vs observed worst-case latencies; surface mismatches as findings without fixing in this PR.

| Agent | Deployed `CLAUDE_TIMEOUT_MS` | Observed worst case | Headroom | Verdict |
| --- | --- | --- | --- | --- |
| soul_map_synthesizer | 22 000 ms | 15 000 ms | 7 000 ms | safe |
| sensescape_synthesizer (Haiku 4.5) | 22 000 ms | 12 700 ms | 9 300 ms | safe |
| visual_dna_synthesizer | 24 000 ms | 22 900 ms | **1 100 ms** | **marginal** |
| war_table_synthesizer | 24 000 ms | 17 000 ms | 7 000 ms | safe |

**Finding.** Visual DNA's deployed `CLAUDE_TIMEOUT_MS` is 24 000 ms. Its observed worst case in step 3 phase B live conformance was 22 900 ms. Headroom is 1 100 ms · about 5% of the wall. A modest latency drift in production (Anthropic API slowdown, prompt-sensitive content) could push Visual DNA past the timeout, triggering `edge_timeout` and routing the run through the reaper.

**Not a deploy-blocker.** Visual DNA has been shipping on this timeout for Chapter 1 and step 3 phase B without observed production timeouts. The 22.9 s figure was the 95th percentile on test fixtures with a deliberately rich QBP. Median production latency is probably lower. But the headroom is genuinely thin.

**Adjacent finding · the adjudication message said "Visual DNA at 22.9s observed vs 22000ms deployed".** Code has 24 000 ms deployed (visual-dna.js:15). The 22 000 ms reference in the message likely came from the 22 000 ms warning threshold from §5.2.1, not the agent's actual timeout. The audit clarifies: Visual DNA's hard timeout is 24 000 ms; its registry-load pre-check warns because its observed × 1 (= 22 900 ms) exceeds the 22 000 ms warning threshold, not the 25 000 ms ceiling.

**Recommendation (deferred to a later PR):** monitor Visual DNA latency in production. If sustained drift toward 24 s+ surfaces, options are (a) reduce `MAX_TOKENS` (currently 2 400 · could trim toward 2 000 if output quality holds), (b) switch to Haiku 4.5 like Sensescape, or (c) defer to streaming/async runtime in step 6+. No fix in this PR per the adjudication.

---

## 5. Code changes in this PR

| File | Change |
| --- | --- |
| `CHAPTER_02_SPEC.md` | §5.2.1 mandatory rule + two-layer enforcement; §5.5 reaper dual-mode; §3.5 META documentation; §12 known debt updated; §11.12 conformance criterion added |
| `agents/contract.js` | Pre-existing extensions remain (CANONICAL_MODELS, DEFAULT_RETRY_BUDGET, AGENT_OBSERVED_LATENCY_MS, QBP_FIELD_TO_EXERCISE, `checkLatencyBudget`, retry_budget validator) · these are the implementation hooks the spec amendments reference |
| `agents/registry.js` | Calls `checkLatencyBudget` at module load; collects warnings in `LATENCY_BUDGET_WARNINGS` for runtime to route through operator-notify on first dispatch |
| `agents/soul-map.js` | `retry_budget: 0` |
| `agents/sensescape.js` | `retry_budget: 0` (was already 0 from step 3 phase B) |
| `agents/visual-dna.js` | `retry_budget: 0` |
| `agents/war-table.js` | `retry_budget: 0` |

The pre-check now reports clean across all four agents at registry load · only Visual DNA generates a warning (informational, below ceiling). No hard fails.

---

## 6. Verification · pre-check status with `retry_budget: 0` across the board

```text
[agents/registry] latency-budget warning: visual_dna_synthesizer · 22900ms exceeds 22000ms budget at retry_budget=0
registry OK · agents: soul_map_synthesizer, sensescape_synthesizer, visual_dna_synthesizer, war_table_synthesizer
latency warnings: 1
```

Three of four pass cleanly. Visual DNA's single warning is the marginal-zone signal flagged in §4 above; not a registration failure (still 2.1 s below the 25 000 ms ceiling).

---

## 7. What's NOT in this PR (deferred to step 4 code)

Per the locked adjudication, step 4 runtime code begins only after this amendment merges. Three files are drafted locally but unstaged:

- `agents/user-action-copy.js` · §5.8.1 canonical copy resolver
- `api/_lib/operator-notify.js` · §5.8.2 Resend channel with 60 s dedup
- `api/agents/run.js` · the 12-step runtime per §5.2

These ship in the step 4 code PR following this amendment merge. They are working drafts; final shape pending review of the amended spec.

---

## 8. Definition of done · step 4 amendment

| Item | Status |
| --- | --- |
| §5.2.1 mandatory rule + two-layer enforcement | done |
| §5.5 reaper dual-mode recovery | done |
| §3.5 META documentation | done |
| §12 known debt updated | done |
| §11.12 conformance criterion | done |
| All four agents declare `retry_budget: 0` | done |
| CLAUDE_TIMEOUT_MS audit + finding documented | this report §4 |
| Pre-check passes (warning-only on Visual DNA, below ceiling) | done |
| Runtime files deferred per adjudication | done |
| Voice codex pass | clean |
| Verification report committed | this file |

---

## 9. Next step

This PR opens hold-open per Chapter 2 PR policy. The Move A smoke test on Haiku Sensescape runs in parallel (operator-side). After both clear:

1. Merge this amendment PR.
2. Step 4 code begins per the locked spec · the three drafted runtime files go through a clean review cycle on the amended contract.

The framework caught the budget violation before it shipped. The discipline of §5.2.1 is exactly why it exists. The reaper as recovery layer is the architectural answer that maintains the methodology rule.

---

## End of step 4 retry_budget amendment report
