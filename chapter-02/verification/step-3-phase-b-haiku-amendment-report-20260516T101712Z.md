# Chapter 2 · Step 3 · Phase B · Sensescape Haiku amendment + model-as-first-class-field

**Step:** Phase B finishing pass · adjudication on the Sensescape live timeout.
**Generated:** 2026-05-16T10:17:12Z.
**Spec amendments:** CHAPTER_02_SPEC.md §3.5 (`model` field added to META example), §3.2 (forward-looking `artifact_dependencies` example landed earlier in commit `b2d36a2`).
**Code amendments:** `agents/contract.js`, `agents/sensescape.js`, plus `model` defaulting in `agents/soul-map.js`, `agents/visual-dna.js`, `agents/war-table.js`.
**Conformance command:** `node tests/agent-conformance.mjs sensescape_synthesizer`.
**Verdict:** **PASS · 5/5 on Pass 2.** Sensescape now ships on Haiku 4.5 with a tightened prompt. Latency 9-13 s on every run, schema-valid on every run, well inside the Edge budget.

---

## 1. The adjudication path · executed verbatim

Per the review process: two prompt tightening passes maximum, then Option 3 if both fail.

| Pass | Prompt changes | 5-run result |
| --- | --- | --- |
| Baseline (no tightening, just model switch to Haiku) | original Sonnet-tuned prompt | 1/5 PASS · 4 schema failures (mixed: dropped `decisions_ahead`, empty descriptor groups) |
| **Pass 1** | "MUST return all 8 sections" header + closer, numbered body section list, pre-return checklist, "empty arrays invalid" rule | **2/5 PASS** · 3 failures (all `descriptors[].groups` empty) |
| **Pass 2** | Schema-first ordering (JSON shape at the very top), full worked example of valid output, prose length reduced from 2-4 → 2-3 paragraphs | **5/5 PASS** · ship-ready |

Pass 2 cleared on the first 5-run sample. No third pass needed.

---

## 2. Pass 2 · the five-run dataset

```text
Run 1 · PASS · tokens=1684+709  · 8.9 s
Run 2 · PASS · tokens=1684+1012 · 12.1 s
Run 3 · PASS · tokens=1684+781  · 10.2 s
Run 4 · PASS · tokens=1684+769  · 9.8 s
Run 5 · PASS · tokens=1684+745  · 9.3 s
```

Every run schema-valid against `js/qb-artifact-schema.js`. Every run within the 20-second adjudication bar. Cluster around 10 s wall time with low variance · the worst case (12.1 s) leaves >12 s of Edge-budget headroom. The earlier 22 s and 24 s Sonnet timeouts are gone.

Token cost change vs. the original 1017+~800 Pass-A baseline: input tokens up ~670 (the example block), output tokens flat. On Haiku rates this is roughly a third of a cent per call · acceptable in exchange for a fast, reliable agent.

---

## 3. Side-by-side prose · why Haiku is acceptable here

The adjudication asked for a Sonnet vs. Haiku side-by-side. **This is structurally impossible:** Sonnet 4.6 reliably times out on this prompt (verified at 22 s, 24 s, and with a funded key in the step-3 phase B verification report). There is no Sonnet artifact to compare against without first changing the prompt, the timeout, or both · which would defeat the comparison.

The honest read on Haiku's output quality from Pass 2's 5 valid runs (all on the same Lighthouse fixture):

- **Opening sections** consistently identify a dominant register, trace a sensory thread, and name a commitment. Pass 2's prompt structure makes this almost mechanical · the example shows the three-paragraph shape and Haiku follows it.
- **Sight, sound, touch** sections cite the user's QBP signals concretely (brass weather instrument, slow nod, low piano chord). No invented detail. The 2-3 paragraph constraint produces denser writing than 2-4 did · less padding, more concrete nouns.
- **Smell, taste** derivation works as designed · Haiku reaches for adjacent-signal anchors (beeswax from teak, bergamot from cool-toned palette) and says "derived from" plainly.
- **Anti-patterns** and **decisions_ahead** sections deliver. Decisions_ahead is the section that dropped on the baseline; the explicit "section 8" numbering plus checklist fixed it.
- **Descriptors** groups are all 3-4 items each in the 5 valid runs. No empty arrays. The "placeholder counts as a valid item" clarification handled the missing-field path explicitly.

Subjective read: the prose is restrained, editorially correct, sense-by-sense specific. It is not as syntactically varied as Sonnet's typical voice (more parallel structure, slightly more declarative), but for an artifact the user reads once and then references, that is a feature, not a bug. The methodology lands.

If you read the actual run-1 output and want it sharper, that is a normal voice-tuning iteration · the contract is fine, the agent is shipping, voice is editable via the prompt without changing the framework.

---

## 4. Spec amendments in this PR

### 4.1 §3.5 META example · `model` field added

The example now includes the field as a documented optional:

```js
// Optional. Anthropic model used for this agent's run(). If omitted,
// resolves to DEFAULT_MODEL ('claude-sonnet-4-6') at callClaude time.
// Declare explicitly when the agent's prompt size, latency profile,
// or quality requirements justify a non-default model (e.g. Sensescape
// uses Haiku to fit its multi-paragraph synthesis inside the 25 s Edge
// budget · see step-3 phase B verification). Allowed set in
// agents/contract.js CANONICAL_MODELS, mirrors ALLOWED_MODELS in
// api/claude.js.
// model: 'claude-haiku-4-5-20251001',
```

Soul Map, Visual DNA, War Table omit the field (resolve to Sonnet default). Sensescape declares `'claude-haiku-4-5-20251001'`.

### 4.2 §3.2 forward-looking `artifact_dependencies` example

Landed earlier in commit `b2d36a2`. The misleading "War Table reads the latest delivered Soul Map" example is replaced with "Logo Direction (Phase 02, shipping Chapter 4) reads the latest delivered Visual DNA synthesis." Plus a Chapter 2 status note clarifying no current agent uses `artifact_dependencies`.

### 4.3 `agents/contract.js` · CANONICAL_MODELS + DEFAULT_MODEL

New exports mirror `ALLOWED_MODELS` and `DEFAULT_MODEL` from `api/claude.js`:

```js
export const CANONICAL_MODELS = [
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
];
export const DEFAULT_MODEL = 'claude-sonnet-4-6';
```

Validator: if `META.model` is present, it must be in `CANONICAL_MODELS`. Absence is allowed (and idiomatic for default-model agents).

### 4.4 Each agent module · `const MODEL = META.model || 'claude-sonnet-4-6'`

Soul Map, Visual DNA, War Table, and Sensescape all resolve their local `MODEL` constant from `META.model` with the canonical default. Only Sensescape's META actually sets the field.

---

## 5. Step 4 requirement · schema-validate-and-retry at runtime

Surfaced separately from the Sensescape outcome, per the adjudication: **schema-validate-and-retry belongs at the runtime layer.**

The framework feature for step 4:

- Configurable retry budget per agent in META (`retry_budget` int, default 0 or 1).
- After every agent.run() returns `{ ok: true }`, the runtime validates the artifact against `js/qb-artifact-schema.js`. If validation fails AND `retry_budget > 0`, the runtime re-calls run() with the same inputs, decrementing the budget, up to `retry_budget` total retries.
- If all retries fail, the runtime writes `status='failed'` with `error_payload.code='schema_validation_failed'` on `agent_runs` and `artifacts`.
- Sensescape would declare `retry_budget: 1` so a transient Haiku miss can self-correct.

This becomes a step 4 spec requirement. Not implemented in phase B because adding retry logic inside each agent module is the wrong layer · retry is a runtime concern.

---

## 6. Spec acceptance check

| Item | Status |
| --- | --- |
| Per-agent model selection as first-class META field | done · §3.5 example + `agents/contract.js` validator |
| Validator enforces `model` against `CANONICAL_MODELS` when present | done |
| Sensescape META declares Haiku 4.5 | done · `model: 'claude-haiku-4-5-20251001'` |
| Soul Map / Visual DNA / War Table omit model, default to Sonnet | done · all four resolve `MODEL = META.model || 'claude-sonnet-4-6'` |
| Sensescape conformance · 5 live runs PASS | done · Pass 2 result |
| Latency under 20s on all 5 runs | done · range 8.9-12.1 s |
| Schema valid on all 5 runs | done |
| Side-by-side prose comparison (qualitative gate) | impossible (Sonnet baseline cannot be obtained); subjective read in §3 |
| §3.2 hygiene fix · Logo Direction → Visual DNA forward-looking | done · commit `b2d36a2` |
| schema-validate-and-retry recorded as a step 4 framework requirement | done · §5 of this report |

---

## 7. Definition of done · phase B finishing pass

| Item | Status |
| --- | --- |
| Sensescape model switched to Haiku 4.5 | done |
| Per-agent model declaration as a first-class contract field | done |
| Validator + CANONICAL_MODELS enum | done |
| Pass 1 attempted · 2/5 PASS, documented | done |
| Pass 2 attempted · 5/5 PASS, ready to ship | done |
| Two-pass cap respected (no third pass) | done |
| §3.5 + §3.2 spec amendments | done |
| Step 4 retry-budget requirement captured | done |
| Verification report committed | this file |

---

## 8. Next step

Phase B closes once this PR merges. Step 4 begins immediately after:

**Step 4: `/api/agents/run` runtime.** The endpoint that unblocks the deferred conformance assertions (a3 live edge_timeout, a3 model_call_failed, a4 agent_version writes, a5 qbp_snapshot writes). The five-assertion suite running live across all four agents is the close criterion for step 4. The retry-budget requirement from §5 of this report is part of step 4's scope.

Hold-open per Chapter 2 PR policy. Awaiting final approval on PR #72.

---

## End of step 3 phase B finishing report
