# Chapter 4 · Phase 02 Brand Creation · Status and remaining outline

**Drafted 2026-06-11. The remaining-steps outline in §4 is HELD for operator go. Status sections record shipped work only.**

---

## 1. Where the chapter stands

The operator resequenced the original outline on 2026-06-11: the three agents land first, the Phase 02 surface follows. Steps below use the operator's numbering.

| Step | Content | State |
|---|---|---|
| 1 | Logo Direction Agent | **SHIPPED + RELEASED.** #185 implementation, #186 release on prompt sign-off. Live in the Console for Starter+. |
| 2 | Logo Evaluation Agent | **SHIPPED, HELD.** #188. Production harness GREEN. Console-invisible behind PROMPT_HOLD_SLUGS pending prompt sign-off. |
| 3 | Voice Guide Agent | **SHIPPED, HELD.** #189. Production harness GREEN. Console-invisible behind PROMPT_HOLD_SLUGS pending prompt sign-off. |
| 4 | Phase 02 surface + reading-surface render + founder dispatch entry | NOT STARTED · outlined in §4, HELD |
| Z | Closure + chapter 5 outline | NOT STARTED |

Also this chapter: pricing copy reconciliation (#187, Pro $247/mo · annual $205), with three checkout-coupled files held and the Agency price + currency split surfaced as unruled.

## 2. PR ledger, chapter 4 to date

| PR | What | State |
|---|---|---|
| #185 | Logo Direction Agent · tier gate at both dispatch surfaces | MERGED |
| #186 | Logo Direction release (prompt signed) | MERGED |
| #187 | Pricing copy · Pro $247/$205 · 4 files, 4 strings | MERGED |
| #188 | Logo Evaluation Agent · vision verdicts · MIME gate extension | MERGED, prompt HELD |
| #189 | Voice Guide Agent · text-only | MERGED, prompt HELD |

Registry: 7 production agents (4 Phase 01 + 3 Phase 02) + 2 flag-gated test agents. Tier enforcement live at both dispatch surfaces for phase >= '02'. Every merge ran the standing gates: smoke verbatim, ancestry check, files+commits inspection, deploy READY, 401 probes, production harness.

## 3. The exit condition, measured

Stated (outline §1): a Starter-tier founder runs all three Phase 02 agents end to end, artifacts render through the reading surface, appear in Console and archive, survive chain/reaper/Realtime.

- All three agents deliver against production for a Starter-tier identity: **met** (harness evidence on #185/#186/#188/#189).
- Logo Evaluation reads an uploaded logo through the chapter-3 file path: **met**.
- Artifacts render through the reading surface: **not yet** · step 4 work.
- A founder can fire the agents from the product without a harness: **not yet** · the founder-initiated first-run dispatch entry is step 4 work (rerun requires an existing artifact; lock fan-out is Phase 01 only).
- Two of three prompts await sign-off.

## 4. Remaining steps · outline · HELD FOR OPERATOR GO

### Step 4 · Phase 02 surface, six calls

**Call 1 · The founder dispatch entry (ALWAYS-SURFACE · new gating-adjacent endpoint).** Today no production UI path can fire a Phase 02 agent first-run. Default: a `POST /api/agents/dispatch-phase02` endpoint (or an extension of the existing dispatch pattern) that authenticates the founder JWT, applies the tier gate, creates the dispatch + artifact rows service-side, and fires run.js · the same row shapes the harnesses create. Tradeoff: extending rerun.js to accept first-runs is less new surface but overloads its source-artifact semantics. This call touches dispatch gating and is flagged for explicit ruling either way.

**Call 2 · Dashboard cards.** Default: the three Phase 02 agents render as cards in the existing Console phase grouping (the LOCKED_PHASE_CARDS static copy for Phase 02 retires in favor of live agent cards). Tier-gated state for free users: locked card with upgrade affordance, reusing the qb-paywall pattern. Tradeoff: none structural; copy passes the voice tests.

**Call 3 · Reading-surface render.** Default: the three new artifact types render through the existing schema v1.0 renderer (they reuse descriptor_list, always_never, priority_list · no new block types were introduced, by design). Verify with the litmus test + weakest persona. Tradeoff: bespoke renderers (logo direction with mark-sketch slots) deferred until real usage, per the step-1 call-2 tradeoff note.

**Call 4 · File-upload affordance for Logo Evaluation.** Default: reuse the chapter-3 qb-file-upload attach pattern, scoped to logo-image, vision MIME + 5 MB enforced client-side with the same founder-facing copy the dispatch entry returns. SVG upload attempt gets the export-as-PNG instruction before the network call. Tradeoff: client-side checks are advisory; the dispatch entry remains the wall.

**Call 5 · CAL surface.** Default: the three-revision cap renders at the surface layer (the chapter-2 adjudication), feedback box wired to runtime_args.feedback through the rerun path. Tradeoff: cap is advisory at the API layer, accepted at current scale.

**Call 6 · Realtime + archive integration.** Default: no new code expected · artifacts flow through the existing chapter-2 bell/archive/Realtime paths; step-4 verification asserts it rather than builds it. Tradeoff: if the Phase 02 artifact types surface a renderer gap in the archive tree, fix forward inside the step.

### Step Z · Closure

Ledger, defect count, exit-condition evidence, chapter 5 outline (Phase 03 content agents per the roadmap). Chapter close surfaces; no self-certification.

### Always-surface items carried

1. Step-4 call 1 (founder dispatch entry) · new gating-adjacent endpoint.
2. Prompt sign-offs: Logo Evaluation (#188), Voice Guide (#189).
3. Agency price disagreement ($997/$830 copy vs $1,497 canonical) + dollar/euro split + checkout-coupled trio (payment.html, terms.html, index.html JSON-LD) · all surfaced at #187, all unruled.
4. FILE_TEST_AGENT still in Production env (chapter-3 exit condition 7, operator-only).
5. SVG support · deferred debt re-logged at step 2 (the founder-facing rejection now instructs PNG export; native SVG read remains out of scope).

---

*Chapter 4 status · QB BrandOS · June 2026 · the §4 outline is held until the operator says go.*
