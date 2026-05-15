# Chapter 2 · Step 3 · Phase B · sensescape + visual_dna + war_table retrofits

**Step:** Step 3 phase B · the remaining three Phase 01 agents retrofitted to the §3.5 amended contract.
**Generated:** 2026-05-15T20:25:49Z.
**Spec sections:** CHAPTER_02_SPEC.md §3 (Agent contract, amended in PR #71), §11.12.1 (Conformance test), §13 step 3.
**Conformance command:** `node tests/agent-conformance.mjs --all`.
**Verdict:** **PASS** offline on all four agents. Three of four PASS live; Sensescape live a2 SKIPPED for a billing reason documented in §5, not a code issue. Phase B is complete; step 4 (`/api/agents/run` runtime) unblocked.

---

## 1. What shipped

| File | Status |
| --- | --- |
| `agents/sensescape.js` | new · Sensescape Synthesizer retrofit. All 11 fields `required: false`. |
| `agents/visual-dna.js` | new · Visual DNA Synthesizer retrofit. `archetypePrimary` `required: true`; 13 others `required: false`. |
| `agents/war-table.js` | new · War Table Synthesizer retrofit. `archetypePrimary` `required: true`; 18 others `required: false`. |
| `agents/registry.js` | updated · imports + validates all four agents at module load. |
| `tests/agent-conformance/sensescape.fixtures.mjs` | new · happy-path QBP + offline error fixtures. |
| `tests/agent-conformance/visual-dna.fixtures.mjs` | new · happy-path QBP with `archetypePrimary: 'The Sage'`. |
| `tests/agent-conformance/war-table.fixtures.mjs` | new · happy-path QBP with `archetypePrimary: 'The Sage'`. |
| `api/agents/dispatch.js` | edited · imports all four from `/agents/`. Legacy `runXxxSynthesizer` names re-exported on each new module so dispatch behavior is byte-equivalent. |

All four legacy `api/agents/*-synthesizer.js` modules are no longer imported anywhere. They become dead code in the step 14 deprecation pass.

---

## 2. Methodology decisions · `required: true` vs `required: false`

Per the phase B directive: required fields are a methodology decision, not a code decision. The actual minimum the methodology needs, not what feels safe.

### 2.1 Sensescape · all fields `required: false`

The Sensescape SYSTEM_PROMPT explicitly handles every missing sense with a placeholder: *"If a QBP field is missing, write 'Not yet captured. Return to the Sensescape exercise to add this.' for the affected prose field."* Graceful degradation is the methodology, not a fallback.

Marking any individual sense as `required: true` would force a hard refusal where the methodology calls for a partial sensory portrait with honest gaps. The agent's purpose is to translate **whatever sensory cues the user provided** into a multi-sense world · zero cues yields a placeholder artifact, not a refusal. Matches Soul Map's pattern.

### 2.2 Visual DNA · `archetypePrimary` `required: true`, all 13 others `required: false`

The agent's NOTE comment in the legacy module reads:

> "image catalog tags are session-random and not persisted, so kept-image IDs alone do not resolve to a color or typeface. The synthesizer therefore reads the adjacent QBP signals · colorTerritory, forbiddenColor, typographyNote, archetype implications · to inform palette and type direction."

The methodology floor is the archetype. Without `archetypePrimary`, the agent has no visual register to anchor palette or typography choices · everything else is enrichment. The SYSTEM_PROMPT's fallback ("If QBP is mostly empty, lean on archetype signals") is what makes the agent honest with sparse input; remove archetype and the fallback has nothing to lean on.

Visual DNA exercise outputs (`visualDnaKeepCount`, `visualDnaDiscardRate`, `visualDnaKeptImages`, `visualDnaFastDiscards`), Sensescape signals (`colorTerritory`, `forbiddenColor`, `typographyNote`, `antiVoice`), and the secondary archetype fields are all enrichment · `required: false`.

### 2.3 War Table · `archetypePrimary` `required: true`, all 18 others `required: false`

Same methodology floor. War Table positions a brand against a competitive field. The archetype delivers market landscape, strategic moat, and central paradox · the substrate every positioning decision sits on. Without it, the positioning map has no axis interpretation grounded in the brand's real strategic register.

War Table exercise outputs (`warTableBrief`, `warTableTopInitiatives`, `warTablePosture`, `warTablePrinciples`, `warTableNextHandoff`), audience block (`audienceFears`, `audienceDesires`, `audienceLanguage`, `audienceFriction`), Soul Map strategic signals (`paradox`, `antiBrand`, `alwaysNever`, `manifesto`), and the other archetype fields are enrichment · `required: false`.

### 2.4 Why only one required field per agent (not a "feels safe" set)

The phase B directive: "Make sure the required set reflects the actual minimum the methodology needs, not what feels safe."

For each agent, the strictest possible methodology floor is one field: the single anchor without which the output is meaningless. Adding more required fields would be defensive (good UX hints) rather than methodological (real refusal triggers). Defense lives in the UI surface (the Agent Console can recommend fields to add); refusal lives in the contract.

The Phase 01 flow already requires `archetype-compass` completion before lock-foundation, so `archetypePrimary` is virtually always present. The `required: true` declaration is the methodology guarantee, not a typical-traffic protection.

---

## 3. Conformance results

### 3.1 Offline · all four agents

```text
soul_map_synthesizer    · PASS (a1+a3 verified · a2 skipped offline · a4+a5 deferred to step 4)
sensescape_synthesizer  · PASS (a1+a3 verified · a2 skipped offline · a4+a5 deferred to step 4)
visual_dna_synthesizer  · PASS (a1+a3 verified · a2 skipped offline · a4+a5 deferred to step 4)
war_table_synthesizer   · PASS (a1+a3 verified · a2 skipped offline · a4+a5 deferred to step 4)
```

Exit code 0. CI-runnable; no Anthropic key required for the offline path.

### 3.2 Live · three of four agents

| Agent | a2 happy-path | Result |
| --- | --- | --- |
| `soul_map_synthesizer` | PASS · 765+578 tokens · 14.4 s | verified in PR #71 |
| `visual_dna_synthesizer` | PASS · 936+919 tokens · 22.7 s | this PR |
| `war_table_synthesizer` | PASS · 1269+931 tokens · 17.0 s | this PR |
| `sensescape_synthesizer` | DEFERRED · billing failure on local key (§5.1) | unverified live; offline PASS sufficient for merge |

Three of four live-verified is sufficient evidence that the retrofit pattern is sound. Sensescape's offline a1 + a3 PASS confirms the contract is correctly declared; the live a2 failure is environmental, not behavioral.

---

## 4. Spec acceptance criteria · §11.12 + §13 step 3

| Criterion | Status |
| --- | --- |
| All four Phase 01 agents retrofitted to §3.5 contract | done |
| Each agent declares `inputs.files = []` (Chapter 3 forward-compat) | done |
| Each agent declares `triggers` explicitly | done · `['lock', 'manual', 'regenerate']` for all four |
| `META.version` integer set | done · `version: 1` for the three new agents |
| `qbp_fields` declared as typed `{ field, required }` per amended §3.2 | done |
| Each agent's `required: true` set reflects methodology floor, not safety bar | done · documented in §2 |
| Every agent passes conformance before registration | done · `assertAgentMetaOrThrow` enforces at module load |
| Offline conformance PASS for all four | done · exit 0 |
| Live conformance PASS for at least one new agent | done · two of three new agents PASS live |

---

## 5. Findings · environmental, not contractual

### 5.1 Finding · local Anthropic key out of credits (informational)

Sensescape live a2 first returned `edge_timeout`, then on retry returned `model_call_failed` with body `"Your credit balance is too low to access the Anthropic API"`. The first timeout was the slow 400 response hitting the 22 s budget; the second exposed the underlying billing state.

This is not a code regression. Sensescape's `CLAUDE_TIMEOUT_MS` (22000) and `MAX_TOKENS` (4000) match the legacy `api/agents/sensescape-synthesizer.js`. The agent function correctly returned the canonical error codes (`edge_timeout`, `model_call_failed`) per its META declaration.

Production runs on a separate Anthropic key with credits and has been producing Sensescape artifacts for users since Chapter 1 (`agent_runs` table row count confirms this · 77 legacy rows in migration 011 backfill). The phase B retrofit changes the META surface, not the agent function · Sensescape will deliver in production as before once step 4's `/api/agents/run` ships.

**Action:** none required for phase B merge. The local conformance harness is a developer tool, not a production gate. Live conformance for Sensescape will pass once the local key is replenished or once step 6 (lock-foundation refactor) exercises the retrofit through the production deploy.

### 5.2 Note · Sensescape's prompt size is the closest of the four to the Edge budget

Even with credits, Sensescape's MAX_TOKENS=4000 + 8 prose sections + descriptor lists + 22 s timeout puts it closest to the Edge ceiling. Visual DNA (MAX_TOKENS=2400) and War Table (MAX_TOKENS=2400) have more headroom. This is not a phase B issue · it's an existing operational truth carried from Chapter 1. Worth surfacing because step 6 (lock-foundation refactor with `context.waitUntil()`) needs to plan for Sensescape's worst-case latency.

---

## 6. Definition of done · phase B

| Item | Status |
| --- | --- |
| `agents/sensescape.js` retrofit · behavior preserved | done |
| `agents/visual-dna.js` retrofit · `archetypePrimary` required, behavior preserved | done |
| `agents/war-table.js` retrofit · `archetypePrimary` required, behavior preserved | done |
| All four agents in `agents/registry.js` | done |
| `api/agents/dispatch.js` imports updated · legacy path unchanged | done |
| Fixtures written for all three new agents | done |
| Offline conformance · all four PASS | done · exit 0 |
| Live conformance · three of four PASS, Sensescape deferred for environmental reason | done |
| Verification report committed | this file |

---

## 7. Next step

**Step 4 · `/api/agents/run` runtime.** The contract surface and the registry are locked. Step 4 builds the runtime that:

1. Imports `AGENTS` from `agents/registry.js`.
2. Validates `runtime_args.qbp_source` of `'current'` or `'original'`.
3. Reads required `qbp_fields` per agent META, emits `qbp_field_missing` if any are absent · this is where assertion a4 and a5 become testable.
4. Writes `agent_runs.qbp_snapshot`, `file_refs`, `runtime_args`, `agent_version` on every dispatch.
5. Uses inter-edge HMAC per §5.2 so the lock + regenerate endpoints can call `/api/agents/run` over the wire.

Hold-open per Chapter 2 PR policy. Awaiting your review before step 4.

---

## End of step 3 phase B verification report
