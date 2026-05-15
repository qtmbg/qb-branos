# Chapter 2 · Step 3 · Agent registry + contract scaffold + Soul Map retrofit

**Step:** Build step 3 · agent registry + contract scaffold.
**Generated:** 2026-05-15T19:59:30Z.
**Spec sections:** CHAPTER_02_SPEC.md §3 (Agent contract), §11.12 + §11.12.1 (Conformance), §13 step 3.
**Conformance command:** `node tests/agent-conformance.mjs soul_map_synthesizer`.
**Verdict:** **PASS · with surfaced findings.** Soul Map Synthesizer is registered, validates against the §3.5 contract, and passes the conformance suite for the assertions in step-3 scope (a1 + a2 live + a3 offline). Assertions that require the step-4 runtime (a4 + a5) and the live-only error codes (edge_timeout, model_call_failed) are reported as DEFERRED with documented closure paths. Four findings surfaced for review before step 3 closes.

---

## 1. What shipped

| File | Purpose |
| --- | --- |
| [agents/contract.js](agents/contract.js) | META schema validator; `validateAgentMeta` + `assertAgentMetaOrThrow` |
| [agents/soul-map.js](agents/soul-map.js) | Soul Map Synthesizer retrofit · META + `run` per §3.5; back-compat `runSoulMapSynthesizer` export |
| [agents/registry.js](agents/registry.js) | Single import map; validates META at module load |
| [tests/agent-conformance.mjs](tests/agent-conformance.mjs) | The five-assertion conformance runner |
| [tests/agent-conformance/soul-map.fixtures.mjs](tests/agent-conformance/soul-map.fixtures.mjs) | Soul Map fixtures (happy path + offline error codes + live-only codes) |
| [api/agents/dispatch.js](api/agents/dispatch.js) | One-line import swap · Soul Map now sourced from `/agents/soul-map.js` |

The legacy `/api/agents/soul-map-synthesizer.js` is no longer imported anywhere. It stays on disk this chapter as dead code · step 14 (`api/agents/dispatch` deprecation) removes it.

---

## 2. Conformance run · Soul Map Synthesizer

Run twice: once offline (no `ANTHROPIC_API_KEY`) and once live (key from `/tmp/.env.qb-branos.live-backup`).

### 2.1 Offline run

```text
Running conformance for soul_map_synthesizer · live mode: NO (offline · a2 will skip)
  soul_map_synthesizer · a1 contract-schema · PASS
  soul_map_synthesizer · a2 happy-path · SKIP · ANTHROPIC_API_KEY not set · re-run live to verify
  soul_map_synthesizer · a3 error.config_missing · PASS · stage=config
  soul_map_synthesizer · a3 error.edge_timeout · DEFER · needs live trigger
  soul_map_synthesizer · a3 error.model_call_failed · DEFER · needs live trigger
  soul_map_synthesizer · a4 agent_version-write · DEFER · requires /api/agents/run · step 4
  soul_map_synthesizer · a5 qbp_snapshot-write · DEFER · requires /api/agents/run · step 4
soul_map_synthesizer · PASS (a1+a3 verified · a2 skipped offline · a4+a5 deferred to step 4)
```

### 2.2 Live run

```text
Running conformance for soul_map_synthesizer · live mode: YES (ANTHROPIC_API_KEY set)
  soul_map_synthesizer · a1 contract-schema · PASS
  soul_map_synthesizer · a2 happy-path · PASS · tokens=765+732 in 17722ms
  soul_map_synthesizer · a3 error.config_missing · PASS · stage=config
  soul_map_synthesizer · a3 error.edge_timeout · DEFER · needs live trigger
  soul_map_synthesizer · a3 error.model_call_failed · DEFER · needs live trigger
  soul_map_synthesizer · a4 agent_version-write · DEFER · requires /api/agents/run · step 4
  soul_map_synthesizer · a5 qbp_snapshot-write · DEFER · requires /api/agents/run · step 4
soul_map_synthesizer · PASS (a1+a3 verified · a2 verified · a4+a5 deferred to step 4)
```

Live happy path: 765 input tokens + 732 output tokens, 17.7s wall time, content schema-valid against `js/qb-artifact-schema.js`. The retrofit's happy path is functionally byte-equivalent to the legacy `runSoulMapSynthesizer` · same prompt, same parser, same artifact assembler.

---

## 3. Spec acceptance criteria · §11.12 + §13 step 3

| Criterion | Status |
| --- | --- |
| `agents/registry.js` exports validated AGENTS map | done |
| Soul Map declares `inputs.files = []` (forward-compat for Chapter 3) | done |
| Soul Map declares `triggers` explicitly | done · `['lock', 'manual', 'regenerate']` |
| `META.version` integer set | done · `version: 1` |
| Soul Map passes the conformance test before registration | done · a1+a2+a3-offline PASS; a3-live and a4/a5 documented as DEFERRED with closure paths |
| Spec amendment moment surfaced if Soul Map exposed a contract gap | done · four findings in §5 |
| Sensescape / Visual DNA / War Table moved to contract | **NOT in this PR** · phase-B scope. Rationale in §6 |

---

## 4. The five assertions · status table

| # | Assertion | Step-3 status | Closure path |
| --- | --- | --- | --- |
| 1 | Contract schema valid | **PASS** offline | n/a · passes |
| 2 | Happy path returns valid output | **PASS** live (skipped offline) | n/a · passes live, will rerun in CI with key on every push once CI key is provisioned |
| 3 | Documented error codes · `config_missing` | **PASS** offline | n/a · passes |
| 3 | Documented error codes · `edge_timeout` | **DEFERRED** | Step 4: live timeout injection via the new `/api/agents/run` test path, or a fetch mock in the conformance suite |
| 3 | Documented error codes · `model_call_failed` | **DEFERRED** | Step 4: same · live 5xx induced against the `/api/agents/run` test path |
| 4 | Writes correct `agent_version` to `dispatch_jobs` | **DEFERRED** | Step 4: `/api/agents/run` writes `agent_runs.agent_version` and `dispatch_jobs.agent_version` from `META.version`. Conformance test runs against a live test dispatch in the step-4 verification report |
| 5 | Writes `qbp_snapshot` to `agent_runs` | **DEFERRED** | Step 4: same · `/api/agents/run` writes a frozen QBP copy on every run |

Per spec §11.12.1 the conformance suite is hard-gated on every agent before the runtime accepts dispatches. Step-3's DEFERRED items are scoped to step 4 (where the runtime that performs the writes exists) and to the live-trigger mechanism for codes that need an induced upstream failure. The runner reports them explicitly so neither the next operator nor CI can drop them.

---

## 5. Findings · the first stress test of the contract

Per the user's reminder: "A failure here is a spec amendment moment, not a quiet fix." These are surfaced for explicit review before step 3 closes.

### 5.1 Finding A · `qbp_fields` strict-vs-graceful tension (load-bearing)

**Observation.** Soul Map's behavior on missing QBP fields is graceful degradation: it calls Claude with a `<not provided by user>` marker for any missing field, and Claude returns placeholder text ("Not yet captured. Return to the Soul Map to add this."). Spec §3.2 says the runtime should fail with `missing_inputs` when any required `qbp_field` is missing, and **not call Claude**. These are incompatible behaviors.

**Resolution chosen in this PR.** Soul Map declares `META.inputs.qbp_fields = []` (no fields are strictly required). The graceful behavior is preserved. The `missing_inputs` code is still in the contract's canonical set but is not declared in Soul Map's `META.error_codes` since the agent will never emit it.

**Why this matters.** Other Phase 01 agents (Sensescape, Visual DNA, War Table) may want different policies. Visual DNA reads quantitative outputs from the Visual DNA exercise; if those are missing, gracefully degrading to placeholders is probably wrong. War Table reads the War Table brief; missing that is probably a hard failure.

**Recommendation.** Amend §3.2 to support an optional/required distinction on `qbp_fields`, mirroring the `files[]` shape:

```js
qbp_fields: [
  { name: 'brandEssence', optional: false },
  { name: 'spark',        optional: true  },
]
```

This is the cleanest evolution and keeps the runtime's failure path explicit. Sensescape/Visual DNA/War Table retrofits (phase B) will need this resolved.

### 5.2 Finding B · canonical `error_codes` vs §3.5 example

**Observation.** Spec §11.12.1 requires every agent to declare `META.error_codes[]`. The §3.5 example META does not include this field. The contract validator I wrote (`agents/contract.js`) treats `error_codes` as required, with a canonical set in `CANONICAL_ERROR_CODES`. The retrofit succeeded by adopting the canonical set.

**Recommendation.** Update §3.5 to include `error_codes` in the example META shape, and codify the canonical set in §3 (close to the §3.4 output contract section). Otherwise future agent authors will follow the §3.5 example and the validator will reject them.

### 5.3 Finding C · live-only error codes are inherent

**Observation.** Two of Soul Map's declared error codes (`edge_timeout`, `model_call_failed`) can only be triggered by an actual upstream failure (a Claude timeout or a Claude 5xx). The offline conformance harness has no way to force either condition without mocking `fetch` globally.

**Resolution chosen.** The conformance runner reports them as DEFERRED with explicit reason ("needs live trigger"), and step 4's verification will exercise them via the `/api/agents/run` test path (which can be invoked against a Claude key that's intentionally invalid for the 5xx case, or against a model that's slow enough to trip the timeout for the timeout case).

**Alternative.** Add a `fetch`-mock injection point to the agent module (`run({ ..., _testFetch })`) so the conformance test can simulate failures offline. This adds a test-only surface to production code. I do not recommend it; the live test in step 4 is cleaner. Flagging the alternative so the call is explicit.

### 5.4 Finding D · failure-path error string change (one-line diff)

**Observation.** The retrofit changes the `result.error` value returned from `run()` on failure paths to canonical codes:

| Failure path | Legacy value | Retrofit value |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` missing | `'ANTHROPIC_API_KEY missing'` | `'config_missing'` |
| Claude returns non-2xx | `'Claude call failed (status N)'` | `'model_call_failed'` |
| Claude returns malformed text | `'Could not parse synthesized JSON'` | `'model_call_failed'` |
| Claude times out | `'edge_timeout'` | `'edge_timeout'` (unchanged) |

`api/agents/dispatch.js` concatenates `<stage>: <error>` into the `artifacts.error` text column on failure. The retrofit therefore changes the text that lands in that column for legacy failure paths. The happy path is unchanged.

**Why this is acceptable.** The `artifacts.error` text column is a debug log, not a user-facing surface. The CHANGE is from human-readable strings to canonical codes, which is exactly what the spec demands. Migration 011 has already added `agent_runs.error_payload (jsonb)` as the structured replacement; the `artifacts.error` text column is on a deprecation path (spec §11.5). This step-3 change accelerates the migration off the freeform text.

**Action.** None required, but the verification report flags it so it isn't a surprise during the §11.13 sign-off run.

---

## 6. Scope decision · Soul Map only, sensescape / visual_dna / war_table deferred to phase B

Per build sequence §13 step 3, the literal text reads: "Move four Phase 01 agents to the contract shape from §3.5."

I deliberately did not retrofit the other three in this PR. The reasoning:

- Finding A (`qbp_fields` strict-vs-graceful) is genuinely load-bearing for Visual DNA and War Table. Retrofitting those three before §3.2 is amended would force a one-shot decision per agent on how to handle missing inputs, which is exactly the contract evolution moment the user warned against rushing.
- Sensescape's inputs are mostly user-typed prose (`colorTerritory`, `forbiddenColor`, etc.) and could go either way.
- Visual DNA reads quantitative outputs (`visualDnaKeepCount`, `visualDnaDiscardRate`) where graceful degradation is suspect.
- War Table reads the War Table brief and audience block from upstream agents · these are dependencies, not soft inputs.

The cleanest sequencing:

1. This PR · Soul Map retrofitted, contract proven, four findings surfaced.
2. User decides on Finding A (§3.2 amendment for optional/required qbp_fields).
3. Sub-PR · the other three agents retrofitted with the amended contract.
4. Step 4 begins with all four in the registry and the new `/api/agents/run` runtime takes over.

The registry header documents this scope decision explicitly so the next operator sees it without reading the verification report.

---

## 7. Definition of done · step 3 in this PR

| Item | Status |
| --- | --- |
| `agents/registry.js` exports a validated AGENTS map (at minimum: Soul Map) | done |
| `agents/contract.js` validates META against §3.5 | done |
| Soul Map Synthesizer retrofitted to the contract | done |
| Conformance test runner committed at `tests/agent-conformance.mjs` | done |
| Per-agent fixtures committed under `tests/agent-conformance/` | done |
| Conformance test PASS for Soul Map (offline + live) | done |
| Findings surfaced for review | done · §5 above |
| Step-3 verification report committed | this file |
| Sensescape / Visual DNA / War Table retrofitted | **NOT** · phase B (see §6) |

---

## 8. Hold-open

Per Chapter 2 PR policy, this PR is draft and holds open until explicit "approved, merge" with adjudication on Finding A. The phase-B retrofit waits on:

1. Your read on Finding A (§3.2 amendment for optional/required `qbp_fields`).
2. Your read on Finding B (§3.5 example META should include `error_codes`).

Findings C and D are informational · no spec change requested, but please acknowledge.

---

## 9. Next step

After your read and any spec amendment:

- **Step 3 phase B:** Sensescape, Visual DNA, War Table retrofitted with the amended contract. Same shape as this PR · contract-conformant modules under `/agents/`, registry expanded, conformance test PASS for each.
- **Step 4:** `/api/agents/run` + inter-edge HMAC per §5.2. New endpoint with the contract runtime. Writes `qbp_snapshot`, `file_refs`, `runtime_args`, `agent_version` on every `agent_runs` row. Accepts `runtime_args.qbp_source`. Closes assertions 4 and 5 of the conformance suite for every agent in the registry at that point.

---

## End of step 3 verification report
