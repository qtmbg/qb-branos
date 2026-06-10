# Chapter 4 · Phase 02 Brand Creation · Outline

**Status: DRAFT, HELD.** Chapter transitions always hold for operator go regardless of how clean the calls are. Nothing below is implementation; it is the shape of the work.

---

## 1. Scope and exit condition

Roadmap scope (QB_BUILD_STATE_AND_ROADMAP_v1, Chapter 4): logo and voice production for paying users.

Builds:

1. Logo Direction Agent
2. Logo Evaluation Agent (file upload required)
3. Voice Guide Agent
4. Phase 02 surface in the dashboard
5. All three artifacts render through the reading surface

**Exit condition:** a Starter-tier founder runs all three Phase 02 agents end to end. Logo Direction grounds in the delivered Phase 01 artifacts. Logo Evaluation reads an uploaded logo file through the chapter-3 file path. Voice Guide delivers. All three artifacts render through the reading surface, appear in the Console and archive, and survive the chain, reaper, and Realtime integration. One harness per agent, GREEN against production, plus the registry smoke and 401 probes per the standing gate on every merge.

**Inherited prerequisite, open:** the step-4 latency gate is RED (PR #178 HELD). Logo Evaluation depends on the file-read template that gate protects. The envelope decision (streaming runtime, model choice, or timeout change) is an operator ruling and is a hard prerequisite for step 3 below. Logo Direction and Voice Guide do not read files and can proceed independent of it.

## 2. Step sequence

| Step | Content | Gate |
|---|---|---|
| 0 | Chapter spec locked before code (per How We Work) | operator sign-off |
| 1 | Logo Direction Agent | standing registry gate + agent harness |
| 2 | Phase 02 surface in dashboard + reading-surface render for the new artifact types | visual litmus + weakest persona |
| 3 | Logo Evaluation Agent | BLOCKED on the #178 envelope ruling, then standing gate + file harness |
| 4 | Voice Guide Agent | standing gate + agent harness |
| Z | Closure + chapter 5 outline | operator sign-off |

## 3. The six calls for step 1 (Logo Direction Agent)

### Call 1 · Inputs: dependencies and QBP fields

- **Default:** `artifact_dependencies: ['visual_dna_synthesizer', 'soul_map_synthesizer']`, both required. QBP fields read: brandName, archetypePrimary (required), archetypeSecondary, archetypeVisualImplications, colorTerritory, forbiddenColor, visualTerritoryNote, typographyNote, antiVoice. Logo direction without the visual system and soul map is generic advice, which the codex refuses.
- **Tradeoff:** hard dependencies surface `missing_dependency` for founders who have not finished Phase 01. That is the correct behavior (the Console routes them back), but it makes the chain order load-bearing.

### Call 2 · Output artifact shape

- **Default:** existing artifact schema v1.0, no schema extension. body_sections for the direction narrative; data_blocks reuse `descriptor_list` (direction names + qualities) and `always_never` (logo do/never). No new block type, no renderer change, no KNOWN_AGENT_SLUGS class risk beyond the standard three-surface registration.
- **Tradeoff:** a bespoke `logo_direction` block type would render richer (mark sketches, lockup slots) but adds a fourth registration surface and a renderer build. Defer to a later step once the reading surface shows real usage.

### Call 3 · Triggers

- **Default:** `['chain', 'manual', 'regenerate']`. Chain fires after its dependencies deliver (the chapter-2 chain-trigger path, DB-idempotent). Not on `lock`: lock fan-out is the Phase 01 set.
- **Tradeoff:** chain-triggered means a Phase 02 agent auto-fires for tier-eligible users when Phase 01 completes. If the operator prefers explicit founder intent for paid-tier work, drop `chain` and keep manual-only; that weakens the "system works for you" feel but tightens cost control. Flagged under adjudication B.

### Call 4 · Model and latency class

- **Default:** `claude-sonnet-4-6`, `retry_budget: 0`, prompt sized for an 18 s observed-latency target, `AGENT_OBSERVED_LATENCY_MS` entry added from the step-1 verification runs before any production ramp. The step-4 gate showed the fleet has no slack: visual_dna sits at its cliff today. New agents get engineered to a target, not observed into one.
- **Tradeoff:** retry_budget 0 leans on the reaper for schema-invalid recovery (the §5.5 pattern, proven in chapter 2). retry_budget 1 needs worst case × 2 under 22 000 ms, which an 18 s agent cannot satisfy.

### Call 5 · Tier gating

- **Default:** `tier_required: 'starter'` in META, matching the pricing doc (Phase 02 agents are Starter and up).
- **Tradeoff and adjudication item A:** declaring the tier in META is configuration; ENFORCING it at the dispatch path is new gating behavior with revenue consequences in both directions (too loose gives Phase 02 away free; too strict locks paying founders out on edge cases). Enforcement design always surfaces before build.

### Call 6 · Content Approval Loop fit

- **Default:** the agent reads `runtime_args.feedback` into its prompt (the step-7B pipe, already plumbed through rerun.js). The three-revision cap lives at the surface layer per the chapter-2 adjudication: no loop counter at the framework layer.
- **Tradeoff:** a surface-layer cap is advisory; a determined founder can rerun past three rounds via the API. Acceptable at current scale; revisit when Phase 02 usage is real.

## 4. Per-agent latency and model sketch (steps 3 and 4, indicative)

| Agent | Model default | Latency class | Note |
|---|---|---|---|
| Logo Direction | sonnet-4-6 | target 18 s, retry 0 | text-only |
| Logo Evaluation | ruled by the #178 envelope decision | file-present class | vision read of the uploaded logo; inherits the step-4 template once the gate is resolved |
| Voice Guide | sonnet-4-6 | target 18 s, retry 0 | text-only; reads soul_map + war_table |

## 5. Adjudication items (always surface, operator decisions)

- **A · Tier enforcement at dispatch.** Gating behavior, revenue-relevant. Design surfaces before any code.
- **B · Chain auto-fire for paid-tier agents.** Cost and intent question (call 3 tradeoff).
- **C · Pricing copy reconciliation.** The roadmap document and the pricing block disagree on the Pro price point. Pricing values are hard-rule untouchable; reconciliation is operator-only and is NOT part of chapter 4 builds.
- **D · The streaming runtime.** The #178 RED gate makes the §5.2.1 deferral concrete: the fleet's heaviest agent cannot absorb a vision read inside the 24 s envelope, and the baseline itself shows timeouts. A streaming or async runtime decision unblocks Logo Evaluation and removes the whole latency-cliff class. This is the largest single call in chapter 4.

## 6. Out of scope (chapter 4)

- Phase 03 content agents (chapter 5)
- Video/audio MIME (chapter 5)
- File versioning, ZIP, tier storage caps (PL-003)
- Step 2 migration (PARKED on PL-002)
- WCAG audit
