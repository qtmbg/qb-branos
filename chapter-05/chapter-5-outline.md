# Chapter 5 · Phase 03 Content Creation · Outline

**Status: DRAFT, HELD.** Chapter transitions hold for operator go regardless of how clean the calls are. Nothing below is implementation. It is the shape of the work, and one load-bearing correction to the going-in assumption.

---

## 0. The correction that frames the whole chapter

The going-in assumption was "all five ride the Chapter 4 agent template." That is half true, and the half that is false is the whole chapter.

The five agents ride the *dispatch* half of the template cleanly: META shape, the founder dispatch entry, tier gate at dispatch, manual and regenerate triggers, the schema-v1.0 header and body_sections and footer, the Content Approval Loop pipe. That part is proven and reusable.

Every one of the five breaks the *reading-surface* half. Their actual product is a content pack: twelve Instagram posts, twenty LinkedIn posts, six video scripts with eighteen reels, four written newsletter issues, an ordered production procedure. None of the six existing data_block types (palette, type_pairing, positioning_map, always_never, priority_list, descriptor_list) renders a compound per-item record carrying long-form prose. Phase 02 introduced no new block types by design. Phase 03 cannot avoid them.

So Chapter 5 is, first, a renderer chapter. The first real work is extending the artifact schema and the renderer with the new block types the content packs need, before any agent can ship read-clean. The second constraint is latency: the heavier content agents generate far more output than the calm Phase 02 agents, and at least one cannot register under the current function ceiling at all without a scope cut or the deferred streaming runtime.

This is the honest version of "ride the template." The skeleton rides. The body is new.

## 1. Scope and exit condition

Roadmap scope (QB_BUILD_STATE_AND_ROADMAP_v1, Phase 03 / Content Creation): content strategy across Instagram, LinkedIn, YouTube, and Newsletter, plus Content Bridge for production routing. The five agents already exist as standalone Chapter-1-era HTML tools (`instagram-seed-agent.html`, `linkedin-strategy-agent.html`, `youtube-strategy-agent.html`, `newsletter-architecture-agent.html`, `content-bridge.html`). Chapter 5 migrates them into the agent framework, the same move Phase 02 made, but with the renderer extension above.

Builds:

1. The Phase 03 reading-surface extension: the new content-pack data_block types, their schema validators, and their renderer builders.
2. Newsletter Architecture Agent (step 1, justified in §3).
3. LinkedIn Strategy Agent.
4. Instagram Seed Agent.
5. YouTube Strategy Agent.
6. Content Bridge Agent (last, it is the fan-in router and carries the most non-template work).
7. The Console Phase 03 surface: rewrite the `LOCKED_PHASE_CARDS` Phase 03 placeholder (today it advertises two phantom agents, `content_strategist` and `campaign_planner`) to the canonical five, and release each as it ships.

**Exit condition:** a paying founder who has completed Phase 01 and the Phase 02 Voice Guide fires each of the five Phase 03 agents first-run from the product, and each delivers a content artifact that renders correctly through the reading surface at mobile and desktop widths. Content packs render through the new block types, not flattened into lossy descriptor lists. One harness per agent, GREEN against production, plus the registry smoke and the 401 probes per the standing gate, plus a visual reading-surface proof per new block type (the Chapter 4 to 5 gate, now a standing close requirement).

**Inherited prerequisite, open:** the streaming or async runtime (Chapter 4 adjudication D, deferred). The heaviest content agent (YouTube, §4) cannot register at retry_budget 0 under the 290000ms function ceiling. The lighter four are borderline at retry_budget 0 with engineered token budgets. The runtime envelope decision is a hard prerequisite for the heavy agents and is the largest single call in Chapter 5, the same way it was flagged in Chapter 4.

## 2. Step sequence

| Step | Content | Gate |
|---|---|---|
| 0 | Chapter spec locked before code (per How We Work) | operator sign-off |
| 1 | Reading-surface extension + Newsletter Architecture Agent (first new block type, end to end) | renderer review + visual proof + standing registry gate + agent harness |
| 2 | LinkedIn Strategy Agent | standing gate + harness + the two-deliverable adjudication (§5.B) |
| 3 | Instagram Seed Agent | standing gate + harness + the image-brief reconciliation (§5.E) |
| 4 | YouTube Strategy Agent | BLOCKED on the runtime-envelope ruling (§5.A), then standing gate + harness |
| 5 | Content Bridge Agent | standing gate + harness + the consent-gate and vendor-list adjudications (§5.D) |
| Z | Closure + chapter 6 outline | operator sign-off |

Step 1 carries the reading-surface extension because the first agent cannot render without it. Building the extension against one concrete agent (Newsletter) is cleaner than building it abstractly.

## 3. Step 1 · the first agent, and why

**First agent: Newsletter Architecture.**

Order for the chapter: Newsletter, then LinkedIn, then Instagram, then YouTube, then Content Bridge last.

The justification, weighed against fewest dependencies, founder value, best template proof, and the Weakest Persona Principle (which the master instruction marks non-negotiable):

- **Weakest persona, the deciding criterion.** Build for the founder who arrives with only an idea, zero assets, no footage, no audience. A newsletter is the only Phase 03 channel that needs none of those. No existing following, no design files, no video. A founder can send issue one to ten people the day they get it. LinkedIn assumes a presence, Instagram leans on visual assets and a grid aesthetic, YouTube implies production capability. Newsletter is the weakest-persona-safe channel, and the owned channel that no algorithm can take away.
- **Best template proof.** It is a single-subject agent with exactly one new block type (the written issue). That is the cleanest possible case to establish the new-block-type renderer pattern that the other four then reuse. LinkedIn carries two deliverables in one artifact, YouTube carries four new block types, Content Bridge needs a new runtime input surface. None of those is the right place to prove the pattern first.
- **Founder value.** A complete owned-channel system, a named newsletter with positioning and the first four issues written word for word, is a high-value first deliverable that demonstrates the content layer without depending on the unbuilt production integrations.
- **Dependencies.** Tied with the other channel agents for fewest: it reads the QBP and the delivered foundation, no sibling or platform-integration dependency.

LinkedIn is the high-value runner-up and comes second: the strongest channel for the B2B and agency doors, but it produces two parallel deliverables (personal and company), which is a heavier first migration. Content Bridge is last: it is the fan-in router that consumes the others' output and brand identity, and it needs third-party platform integrations and a likeness-consent gate that do not exist yet.

### The six calls for step 1 (Newsletter Architecture Agent)

#### Call 1 · Inputs: dependencies and QBP fields

- **Default:** `artifact_dependencies: ['voice_guide_agent', 'soul_map_synthesizer', 'war_table_synthesizer']`, all required. The newsletter's voice is the delivered Voice Guide. Its soul is the Soul Map. Its reader is the War Table audience block. QBP fields read: brandName, brandEssence, spark, archetypePrimary (required floor, same as the Phase 02 agents), manifesto, antiBrand, alwaysNever. The standalone tool's hand-entered fields remap: primaryPersona and transformation come from the War Table audience artifact, voiceNotes comes from the Voice Guide artifact, and the newsletter-specific inputs (name, goal, existing newsletter) move to `runtime_args`.
- **Tradeoff:** hard dependencies surface `missing_dependency` for a founder who has not finished Phase 01 and the Voice Guide. This is the first cross-phase dependency in the framework: a Phase 03 agent requires a delivered Phase 02 artifact. It is the correct behavior (the Console routes them back), but it couples Chapter 5 to Chapter 4's output and makes the Voice Guide a hard prerequisite for every content agent. Flagged under §5.C.

#### Call 2 · Output artifact shape (the template break)

- **Default:** a new `newsletter_issue` data_block type. Each issue is a compound record: subject line plus variants, preview text, premise, read time, best send time, strategic purpose, an opening, three named prose sections, a close, a P.S., a growth hook, and repurpose angles. The architecture narrative (positioning, name rationale, format, cadence, growth and platform plan, welcome sequence) maps onto body_sections, and the four-issue arc maps onto a priority_list at-a-glance map. The new block forces an addition to `js/qb-artifact-schema.js` (DATA_BLOCK_TYPES plus a validator) and `js/qb-artifact-renderer.js` (a builder), and the slug into KNOWN_AGENT_SLUGS.
- **Tradeoff:** flattening the four issues into descriptor_list strings avoids the renderer work but discards the written-issue product, which is the entire deliverable. The renderer extension is accepted as step-1 scope. It is not throwaway: it is the foundation the other four packs build on, and the visual proof of one new block type is the reusable gate for the rest.

#### Call 3 · Triggers

- **Default:** `['manual', 'regenerate']`. Founder-initiated only, the standing Phase 02 ruling. No chain, no lock. Content is produced when the founder asks for it.
- **Tradeoff:** chain auto-fire (produce the newsletter when the Voice Guide delivers) would make the system feel proactive for tier-eligible founders, but the Phase 02 adjudication chose explicit intent for paid work and tighter cost control. Keep manual. If the operator wants proactivity, that is a chapter-wide reversal, not a per-agent call.

#### Call 4 · Model and latency class (the second break)

- **Default:** `claude-sonnet-4-6`, `retry_budget: 0`. The constraint is output volume. The standalone tool requests 8000 max tokens to write four full issues, against the 3000 the Phase 02 agents use and their observed 36 to 39 seconds. At retry_budget 0 a single 8000-token call risks running past the 60000ms in-call timeout and surfacing `edge_timeout`. Three ways to fit it: tighten the prompt to a lower token target (the first issue written in full, the next three as tight outlines, with regenerate expanding one at a time), split architecture from issue-writing into two calls, or raise this agent's in-call timeout. The contract admits a higher timeout at retry_budget 0 (the timeout-bounded worst case is 120.6 seconds, inside the 290000ms ceiling), so a per-agent timeout raise is contract-legal. Add an `AGENT_OBSERVED_LATENCY_MS` entry from the verification runs before any ramp.
- **Tradeoff:** retry_budget 0 leans on the reaper for schema-invalid recovery, proven since Chapter 2. The token target is the real design lever. This is the Chapter 5 analog of the Chapter 3 step-4 latency cliff. Newsletter is borderline-feasible at retry_budget 0 with a tightened prompt. YouTube is not (§4, §5.A), which is why the runtime-envelope decision is a chapter prerequisite, not a per-agent footnote.

#### Call 5 · Tier gating

- **Default:** `tier_required: 'starter'`, per the roadmap pricing block, which places all five Phase 03 content agents at Starter and up. Enforced at all three dispatch surfaces (run, rerun, dispatch) for phase >= '02', which is live and needs no new code.
- **Tradeoff and adjudication item:** the per-agent value read argues for `pro`. A complete written content system is a clear step above the Starter foundation agents, and the standalone tools badge themselves accordingly. The roadmap pricing says Starter. This is a revenue-relevant fork the operator rules, the same class as the Chapter 4 tier adjudication. Default to the roadmap (Starter) until ruled otherwise. Separately, the `LOCKED_PHASE_CARDS` Phase 03 placeholder rewrite is a console edit that trips the registry merge gate.

#### Call 6 · Content Approval Loop fit (the third break)

- **Default:** `runtime_args.feedback`, whole-artifact regeneration through the rerun path, with the surface-layer three-round advisory cap (the Chapter 2 adjudication, no framework loop counter).
- **Tradeoff:** the standalone tool has a richer per-issue loop: approve issues one through three, revise only issue four. The template's whole-artifact feedback cannot express that without re-drafting all four. Accept whole-artifact CAL for the first migration and flag per-item revision as a known regression. This mismatch is shared by all four pack-producing agents (Newsletter, Instagram, LinkedIn, YouTube), so it is a chapter-wide decision: accept whole-artifact CAL for Chapter 5, or invest in sub-item revision on the reading surface. Recommend whole-artifact for the first pass, carry sub-item revision as a chapter-6 candidate.

## 4. Per-agent profile (steps 1 to 5, indicative)

Every agent below depends on the delivered foundation rather than re-deriving from raw QBP, and every agent reads `claude-sonnet-4-6` at `retry_budget: 0` with `['manual','regenerate']` triggers. The columns that vary, and the template break, are the point.

| Agent | Deps | Output (new block) | Files | Latency / token load | Template break |
|---|---|---|---|---|---|
| **Newsletter Architecture** `newsletter_architecture_agent` | voice_guide, soul_map, war_table | architecture body_sections + `newsletter_issue` (4 written issues) | none (existing-newsletter context to runtime_args) | heavy, ~8000 tokens, borderline at retry 0 | new block type; per-issue CAL |
| **LinkedIn Strategy** `linkedin_strategy_agent` | voice_guide, soul_map, war_table | strategy body_sections + `post_pack` (12 personal + 8 company posts) | optional reference-image | heavy, ~12000 tokens, does not fit retry 0 as one call | new block type; TWO parallel deliverables in one artifact; per-post CAL |
| **Instagram Seed** `instagram_seed_agent` | soul_map, voice_guide, visual_dna | strategy body_sections + `post_pack` (12 posts, hooks, captions, visual briefs, hashtags) | optional reference-image (grid mood) | heavy, ~8000 tokens | new block type (reuses post_pack); Midjourney field to neutralize; per-post CAL |
| **YouTube Strategy** `youtube_strategy_agent` | soul_map, voice_guide, war_table | channel body_sections + `series_plan` + `video_script_pack` (6 scripts) + `reel_set` (18 reels) + `repurpose_pack` | optional reference-image | heaviest, ~14000 tokens, REJECTED by the contract ceiling at retry 0 as one call | four new block types; registration-blocking latency; per-item CAL; Midjourney field |
| **Content Bridge** `content_bridge_agent` | voice_guide, soul_map | brief body_sections + `numbered_procedure` + `spec_grid` | none today | medium-heavy, ~3000 tokens, fits the envelope best | two new block types; needs a runtime input surface for pasted content and a platform pick; likeness-consent gate; third-party vendor list |

Notes that matter:

- **`post_pack` is shared** by Instagram and LinkedIn. Build it once (alongside or right after `newsletter_issue`), reuse it twice. LinkedIn's two-deliverable shape is the open question (one oversized artifact with grouped packs, or two artifacts), see §5.B.
- **YouTube is the hard agent.** Four new block types and a token load that the contract validator (`assertAgentMetaOrThrow`, the timeout-bounded ceiling check) will refuse to register at retry_budget 0. It cannot ship as one call. It needs a scope cut (fewer scripts or reels per run), a fan-out the single-call dispatch path does not support today, or the streaming runtime. This is why it is step 4, behind the runtime ruling.
- **Content Bridge is the fan-in.** Its prose half fits the template, but its product half (an ordered, beginner-proof production procedure plus a platform spec grid) needs two new block types, and its input is a pasted content blob plus a required platform pick plus a consent checkbox, none of which the current dispatch contract has a surface for. It is last for good reasons.

## 5. Adjudication items (always surface, operator decisions)

- **A · The runtime envelope.** The deferred streaming or async runtime (Chapter 4 adjudication D) is now load-bearing, not theoretical. The heavy content agents exceed the retry_budget-0 function envelope, and YouTube is rejected by the contract ceiling outright. The chapter cannot ship all five at full scope without either per-agent scope cuts engineered to the envelope or the runtime decision. Largest single call in Chapter 5.
- **B · LinkedIn's two deliverables.** Personal system and company system, each a profile rewrite plus a post pack plus strategy. One artifact wants one subject. Decide one oversized artifact with grouped packs, or two artifacts (and two dispatch rows, two reading-surface entries). Affects the `post_pack` block design.
- **C · Cross-phase dependency.** Phase 03 agents depend on the Phase 02 Voice Guide. This is the first time the framework couples chapters. A founder must complete Phase 01 and the Voice Guide before any content agent runs, and `missing_dependency` now spans phases. Confirm this is the intended gating, or soften specific dependencies to optional.
- **D · Content Bridge's third-party surface.** It names third-party production vendors (Canva, HeyGen, Tavus, and others) as recommendations, an external-endorsement and link-rot surface that must be an operator-maintained constant, not model-generated. It needs a likeness-consent gate for face and voice cloning that the agent contract has no slot for, which forces a dispatch or runtime-layer addition. The browser-direct Anthropic call in the standalone tool must move to the server dispatch path. Preserve the faceless-content path as the weakest-persona-safe route.
- **E · Pricing copy and tier placement.** Roadmap says Starter and up; the per-agent value read argues pro. Operator-only, revenue-relevant. Pricing values stay untouchable; this is placement, not a price change. Plus the `LOCKED_PHASE_CARDS` Phase 03 rewrite (the placeholder advertises `content_strategist` and `campaign_planner`, which these five supersede).
- **F · CAL granularity, chapter-wide.** Whole-artifact feedback (template) versus per-item approve and revise (the standalone tools). Recommend whole-artifact for Chapter 5, carry sub-item revision as a chapter-6 reading-surface candidate.
- **G · Image-gen field.** Instagram and YouTube legacy outputs emit Midjourney prompts. Per the Anthropic-only backbone and the anti-aggregator rule, rename to a neutral image brief or route image generation to `api/gemini.js`. Do not ship a named third-party image-gen prompt as a product field.

## 6. The new-block-type infrastructure (step 1 sub-build)

The reading-surface extension is the first concrete work and the reusable foundation:

- `js/qb-artifact-schema.js`: add the new types to DATA_BLOCK_TYPES, add a validator per type. The content packs are arrays of compound records, so the validators enforce per-record field shape, not plain string lists.
- `js/qb-artifact-renderer.js`: add a builder per type in DATA_BLOCK_BUILDERS. The packs render as ordered, expandable cards (a newsletter issue, a post, a script), mobile-first, inside the existing artifact section frame.
- KNOWN_AGENT_SLUGS gains each Phase 03 slug as its agent registers (the `registry-smoke` check 4 enforces this).
- Visual proof per new block type at mobile and desktop, the standing reading-surface gate established at the Chapter 4 to 5 boundary.

Block types, minimum set: `newsletter_issue` (step 1), `post_pack` (LinkedIn and Instagram), `series_plan` + `video_script_pack` + `reel_set` + `repurpose_pack` (YouTube), `numbered_procedure` + `spec_grid` (Content Bridge). Some may consolidate during design (a generic `content_pack` of typed records could cover post_pack and the YouTube packs); that consolidation is a step-1 design call, not assumed here.

## 7. Out of scope (Chapter 5)

- Third-party platform integrations themselves (Canva, HeyGen, Creatify API wiring). Content Bridge produces the brief; it does not call the production platforms. Those integrations are a later build.
- The QBP-field reconciliation as a schema migration. The standalone tools read non-canonical field names (naturalForce, primaryPersona, offer, voiceNotes, and others); the migration remaps them to canonical names or sources them from dependency artifacts and runtime_args. No new QBP fields are added without an explicit call.
- Retirement of the standalone HTML tools. Once an agent migrates, its standalone React tool is superseded; the retire-or-redirect decision (as `journey-guide` was handled) is a closure-step item, not a build.
- Sub-item CAL revision on the reading surface (carried to chapter 6 per §5.F).
- Phase 04 Execution agents.

---

*Chapter 5 outline · QB BrandOS · June 2026 · the outline is held until the operator says go. The skeleton rides the Chapter 4 template; the body is new, and the renderer extension is the first work.*
