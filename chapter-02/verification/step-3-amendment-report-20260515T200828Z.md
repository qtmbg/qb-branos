# Chapter 2 · Step 3 · Spec amendment · §3.2 + §3.5

**Step:** Step 3 amendment PR · adjudication of Findings A and B from the step-3 phase A verification report.
**Generated:** 2026-05-15T20:08:28Z.
**Spec sections amended:** CHAPTER_02_SPEC.md §3.2 (Inputs), §3.5 (The agent module shape).
**Code updated:** `agents/contract.js`, `agents/soul-map.js`.
**Conformance command:** `node tests/agent-conformance.mjs soul_map_synthesizer`.
**Verdict:** **AMENDMENTS LAND CLEAN.** Soul Map still passes conformance (offline + live) under the amended contract. Phase B (sensescape + visual_dna + war_table retrofits) is unblocked.

---

## 1. What changed

| File | Change |
| --- | --- |
| `CHAPTER_02_SPEC.md` §3.2 | `qbp_fields[]` is now typed entries `{ field, required }` mirroring `files[]`. Runtime emits `qbp_field_missing` (not `missing_inputs`) when a `required:true` field is absent. `artifact_dependencies` clarified as implicitly required with the matching `missing_dependency` code. |
| `CHAPTER_02_SPEC.md` §3.5 | META example now declares `qbp_fields` as five typed entries and adds the previously-omitted `error_codes` field with three canonical codes. |
| `agents/contract.js` | Validator enforces the new `{ field, required }` shape. `CANONICAL_ERROR_CODES` adds `qbp_field_missing` and `missing_dependency`. |
| `agents/soul-map.js` | META declares all eight Soul Map fields as `{ field, required: false }`. The retrofit comment is updated to describe the amended contract. |

No runtime behavior change. The §3.2 + §3.5 amendment is a contract shape change; Soul Map's graceful degradation is now spec-sanctioned rather than a workaround.

---

## 2. The amended §3.2 (the load-bearing paragraph)

```
qbp_fields[] · typed array of QBP fields the agent reads. Each entry { field, required }:
  - field    · the key in profiles.qbp (e.g. 'brandEssence', 'manifesto').
  - required · boolean. If true, the runtime refuses to dispatch when
               the field is missing or empty, and emits qbp_field_missing
               without calling Claude. If false, the field is passed
               through to the agent function, which decides how to
               handle absence (graceful degradation, placeholder copy,
               conditional logic).
```

The closing validation paragraph now reads:

> The runtime validates: if any `qbp_field` marked `required: true` is missing or empty in the QBP snapshot, any `artifact_dependency` isn't `delivered`, or any non-optional `file` is unavailable, the agent fails with the matching error code (`qbp_field_missing`, `missing_dependency`, or `missing_inputs`) and does not call Claude.

Three error codes now cover the three input families · cleaner than the single `missing_inputs` that the original §3.2 used for everything.

---

## 3. The amended §3.5 META example (relevant deltas)

```js
inputs: {
  qbp_fields: [
    { field: 'brandEssence', required: false },
    { field: 'manifesto',    required: false },
    { field: 'paradox',      required: false },
    { field: 'antiBrand',    required: false },
    { field: 'alwaysNever',  required: false },
  ],
  artifact_dependencies: [],
  files: [],
  runtime_args: { feedback: 'optional', qbp_source: 'optional' },
},
triggers: ['lock', 'manual', 'regenerate'],
error_codes: ['config_missing', 'edge_timeout', 'model_call_failed'],
```

Two changes: `qbp_fields` shape, and the new `error_codes` field (required by §11.12.1, previously absent from the example).

---

## 4. Conformance re-run

### 4.1 Offline

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

### 4.2 Live (`ANTHROPIC_API_KEY` set)

```text
Running conformance for soul_map_synthesizer · live mode: YES (ANTHROPIC_API_KEY set)
  soul_map_synthesizer · a1 contract-schema · PASS
  soul_map_synthesizer · a2 happy-path · PASS · tokens=765+578 in 14370ms
  soul_map_synthesizer · a3 error.config_missing · PASS · stage=config
  soul_map_synthesizer · a3 error.edge_timeout · DEFER · needs live trigger
  soul_map_synthesizer · a3 error.model_call_failed · DEFER · needs live trigger
  soul_map_synthesizer · a4 agent_version-write · DEFER · requires /api/agents/run · step 4
  soul_map_synthesizer · a5 qbp_snapshot-write · DEFER · requires /api/agents/run · step 4
soul_map_synthesizer · PASS (a1+a3 verified · a2 verified · a4+a5 deferred to step 4)
```

a1 (contract schema) now validates the new `{ field, required }` shape. a2 (live happy path) produced 765 input + 578 output tokens in 14.4 s with a schema-valid artifact. Soul Map's prompt and assembler are byte-equivalent to phase A; only the META shape changed.

---

## 5. Implementation notes worth keeping

### 5.1 Field count discrepancy with adjudication message

The adjudication message said: "Soul Map declares all four current fields as `required: false`." Soul Map actually reads **eight** fields (`SOUL_MAP_FIELDS` in `agents/soul-map.js`): `brandName`, `brandEssence`, `spark`, `archetype`, `manifesto`, `antiBrand`, `paradox`, `alwaysNever`. The amendment declares all eight as `required: false` to match what the code actually reads, not the message's "four." Flag if this is wrong; the spec's §3.5 example uses five fields (the original spec author's example, unrelated to Soul Map's true input set).

### 5.2 `qbp_field_missing` and `missing_dependency` not in any agent's `error_codes`

Neither code is in Soul Map's `META.error_codes` because Soul Map declares every field as `required: false` and has zero `artifact_dependencies`. The codes exist in the canonical enum (`agents/contract.js`) for Visual DNA / War Table / future agents to declare. The conformance test only asserts the codes an agent **declares** are triggerable, so Soul Map remains conformant.

### 5.3 The validator no longer accepts string-array `qbp_fields`

The old shape `qbp_fields: ['brandEssence', 'manifesto']` is now rejected by `agents/contract.js`. Any phase-B retrofit MUST use the typed shape from the start. If a future scenario needs the string-array form (e.g. ad-hoc tools), the validator can accept both with a deprecation note · for now strict is correct.

### 5.4 `artifact_dependencies` shape unchanged

`artifact_dependencies` remains a string array of slugs. They are implicitly required (the runtime cannot meaningfully run an agent whose upstream artifact is missing). If a future agent needs optional dependencies, the same `{ slug, required }` pattern can be introduced. Not needed in Chapter 2.

---

## 6. Spec acceptance check

| Item | Status |
| --- | --- |
| §3.2 amended with per-field `{ field, required }` | done |
| `qbp_field_missing` error code documented in §3.2 | done |
| `missing_dependency` error code documented in §3.2 | done |
| §3.5 META example includes `qbp_fields` typed entries | done |
| §3.5 META example includes `error_codes[]` (Finding B) | done |
| Validator enforces new shape | done · `agents/contract.js` |
| Soul Map META updated to new shape | done · all eight fields as `required: false` |
| Soul Map conformance test still PASSES (offline + live) | done |
| No runtime behavior change | done · only META shape and validator changed |

---

## 7. Definition of done · amendment PR

| Item | Status |
| --- | --- |
| §3.2 amended (per-field optional) | this file §2 |
| §3.5 amended (META example + error_codes) | this file §3 |
| `agents/contract.js` validator enforces new shape | this file §5.3 |
| `agents/soul-map.js` META migrated | this file §1 |
| Conformance re-run · offline + live · both PASS | this file §4 |
| Verification report committed | this file |
| Phase B unblocked | yes · contract is locked, validator is strict, Soul Map proves the shape works |

---

## 8. Next step

**Phase B** retrofits the remaining three Phase 01 agents to the amended contract:

1. `sensescape_synthesizer` · qbp_fields likely `required: false` for most, `required: true` for the sensory anchors that Sensescape depends on. To be decided when retrofitting.
2. `visual_dna_synthesizer` · qbp_fields with `required: true` for the inputs Visual DNA cannot work without (color preferences, archetype, tone). artifact_dependencies likely empty in Chapter 2.
3. `war_table_synthesizer` · qbp_fields with `required: true` for competitive inputs. artifact_dependencies likely `['soul_map_synthesizer']` (War Table reads the latest delivered Soul Map per §3.2 example).

Phase B is mechanical: three modules, three fixture files, three conformance runs. Each agent's `required:true` declarations are the place where judgement is needed; the rest is the same pattern as Soul Map.

**Step 4** (the `/api/agents/run` runtime) does not depend on phase B. The runtime accepts whatever the registry exposes; Soul Map alone is sufficient to validate the runtime against one real agent. Phase B can ship in parallel with step 4.

Hold-open per Chapter 2 PR policy. Awaiting your review before phase B begins.

---

## End of step 3 amendment verification report
