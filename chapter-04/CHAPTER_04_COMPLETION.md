# Chapter 4 · Phase 02 Brand Creation · Completion draft

**Status: DRAFT. Chapter close surfaces to the operator; this document does not self-certify.**

Drafted 2026-06-14, at the end of the step-4 resume run.

---

## 1. Exit condition

Stated (outline §1): a Starter-tier founder runs all three Phase 02 agents end to end. Logo Direction grounds in the delivered Phase 01 artifacts. Logo Evaluation reads an uploaded logo through the chapter-3 file path. Voice Guide delivers. All three render through the reading surface, appear in the Console and archive, and survive the chain, reaper, and Realtime integration. One harness per agent, GREEN against production, plus the registry smoke and 401 probes per the standing gate.

**Measured: met.**

- All three Phase 02 agents deliver against production for a Starter identity, fired first-run through the new founder dispatch entry: **met** (founder-dispatch-entry harness, happy x3 delivered).
- Logo Evaluation reads an uploaded logo through the chapter-3 file path: **met** (logo-evaluation harness, file_refs ok; founder-dispatch happy run for logo_evaluation_agent with an uploaded PNG).
- A founder can fire all three from the product without a harness: **met**. The founder dispatch entry (POST /api/agents/dispatch) plus the Console first-run CTA is the path; the UI calls the exact endpoint the harness exercises.
- Artifacts render through the reading surface: **met by inspection** (verify-only, §6). The three artifact types reuse the existing schema-v1.0 block types; no renderer change was needed.
- Console visibility for the released agents: **met** (console-visibility harness).
- Both held prompts signed and released: **met** (§4).

The reading surface was asserted, not exercised by a live browser in this run. The render path was verified by source coverage (every emitted block type is in both the renderer and schema sets; the header resolves all three slugs with no allowlist). Flagged honestly under §7.

---

## 2. PR ledger, chapter 4

| PR | What | State |
|---|---|---|
| #179 / #181 | Phase 02 outline draft (held; #180 reverted a gate breach, #181 re-landed doc-only) | MERGED (doc) |
| #185 | Logo Direction Agent · tier gate at dispatch · prompt held | MERGED |
| #186 | Logo Direction release (prompt signed) | MERGED |
| #187 | Pricing copy · Pro $247/mo, annual $205 · checkout-coupled trio held | MERGED |
| #188 | Logo Evaluation Agent · vision verdicts · MIME gate · prompt held | MERGED |
| #189 | Voice Guide Agent · text-only · prompt held | MERGED |
| #190 | Chapter 4 status · steps 1-3 shipped · remaining outline held | MERGED |
| #191 | Canonical USD price set · webhook foreign-event gate · trio unfreeze | MERGED |
| #192 | Phase 4 checkout-session verification harness | MERGED |
| #193 | Annual checkout · six-ID set fully sellable · interval plumbing | MERGED |
| #194 | Brand docs reconcile to USD (Agency 1,497 / 1,242 · five workspaces) | MERGED |
| #195 | Step 4 · Phase 02 surface · founder dispatch entry · both prompts released | MERGED |
| #196 | Step 4 · cross-version single-in-flight race fix | MERGED |
| migration 020 | Partial in-flight unique index on artifacts (applied to production) | APPLIED |

Registry after step 4: 7 production agents (4 Phase 01 + 3 Phase 02) + 2 flag-gated test agents. Tier enforcement live at three dispatch surfaces now (run, rerun, dispatch) for phase >= '02'.

---

## 3. The three signed-and-released prompts

The chapter shipped its three Phase 02 agents behind PROMPT_HOLD_SLUGS, the standing pattern: registered and dispatchable for harness verification, Console-invisible until the operator signs the prompt, released by a single set deletion.

- **Logo Direction** · signed and released 2026-06-11 (#186).
- **Logo Evaluation** · signed two sessions before the step-4 run; released 2026-06-14 (#195, Phase 0).
- **Voice Guide** · signed two sessions before the step-4 run; released 2026-06-14 (#195, Phase 0).

After #195 the hold set is empty. The mechanism stays in place for the next held prompt.

---

## 4. The founder dispatch entry · the step-4 build

Outline §4 call 1, ruled YES. POST /api/agents/dispatch is the first production path a founder can press to fire a Phase 02 agent with no prior artifact. It owns the dispatch + artifact row creation, then fires api/agents/run.js, the same split as rerun.js.

The four ruled constraints, all verified:

1. **JWT-authenticated.** resolveUser gates every request; the JWT is forwarded to run.js.
2. **Tier enforcement pre-row, fails closed.** phase >= '02' requires Starter+, checked before any row is written; an unreadable profile rejects with its own named detail. Verified: free tier 403 tier_insufficient, zero rows.
3. **Dependency check, user-fixable.** Declared dependencies verified pre-row; a Phase-01-incomplete founder gets 422 missing_dependency naming the slug, zero rows. A read failure fails closed (503 dependency_unverified). Verified.
4. **Single-in-flight guard, race-safe.** This took two iterations and a migration to get right (§5). Final mechanism: a pre-check read catches the sequential double-click; the partial unique index `artifacts (user_id, artifact_type) WHERE status IN ('queued','generating')` is the atomic backstop, so a concurrent second insert violates it (23505), and the endpoint's handler returns 409 dispatch_in_flight and rolls its rows back. Verified: sequential double-fire and the true simultaneous race both yield exactly one 202 and one 409, one dispatch, one artifact.

Uploaded files are agent-read only: signed and passed to the runtime for the agent's vision read, never rendered inline.

The Phase 02 surface (calls 2-6): Console first-run CTA, per-phase grouping, the Phase 02 locked card retired for live cards, a free-tier upgrade affordance scoped to phase >= '02' (so Phase 01 free access does not regress), the producing state, a logo-image upload for Logo Evaluation, and a CAL feedback box on delivered artifacts wired to the rerun feedback param with a surface-layer advisory three-round cap.

---

## 5. Incident record

### Incident A · the single-in-flight race · caught in verification, cured before close

The step-4 plan asserted "no migration needed: the (user_id, artifact_type, version) unique index already exists." The post-deploy founder-dispatch harness disproved it empirically: the true simultaneous double-fire let two dispatches through (both 202, two artifacts / two dispatches / two runs).

Diagnosis chain:
1. A fresh-context adversarial review (before merge) had already flagged the version-index backstop as status-blind, but assumed the index existed.
2. A first code-only fix (#196, re-read non-terminal rows, lower-version-wins) did not close it: under READ COMMITTED two concurrent inserts can each re-read before the other commits, so neither sees the other.
3. Direct production schema inspection showed the root cause: **there is no uniqueness on artifacts in production at all.** Migration 018, the file that would have added `artifacts_user_type_version_unique`, was never applied (its snapshot table is absent and 16 dispatch_jobs.chain_id values it would have backfilled are still null; 018 is a single transaction, so none of it committed). Production schema diverges from the repo migration files from 018 onward.
4. Cure (operator-approved): a targeted partial unique index on the non-terminal set, migration 020, applied to production (0 violating rows pre-checked). The endpoint's existing 23505 handler converts the violation into the clean 409 with rollback, so no code change was needed. Re-verification: race resolves to one 202 / one 409.

The lesson mirrors chapter 3's #170: a "the index exists / verified on branch" assumption was false; the post-deploy harness is what caught it. The class is now pinned by the founder-dispatch-entry harness' simultaneous-race assertion.

### Incident B · the dead checkout · discovered and cured mid-chapter (the pricing thread)

During the pricing-swap work, the phase-4 checkout-session verification harness (#192) found that production checkout was dead: the page shipped hardcoded EUR Stripe Payment Links, and when routed to the server-side session the production restricted key lacked `checkout_session_write`, so /api/stripe/checkout returned 502 on every tier. The 401 probes were GREEN but no session could be created.

Cure: #191 replaced the EUR Payment Links with the canonical USD six-ID price set and a server-side checkout session, and hardened the webhook with a foreign-event gate (the shared Stripe account carries 20 non-QB products). The operator granted the key permission; #193 added the annual interval so the six-ID set is fully sellable; #194 reconciled the brand docs to USD (Agency 1,497 / 1,242, five client workspaces). The founder qb-paywall checkout path verified live for the first time across all production sessions.

---

## 6. Reading surface and downstream integration (verify-only)

- **Reading surface (call 3):** the three artifact types render through the unchanged schema-v1.0 renderer. Every block type they emit (descriptor_list, always_never, priority_list) is in both the renderer builder set and the schema validator set; KNOWN_AGENT_SLUGS already lists all three; the renderer header resolves their slugs through prettyAgent with no allowlist. No renderer or schema change.
- **Realtime + notification bell (call 6):** no change. The Realtime subscription filters on user_id only; the bell keys off notification kind. Both are type-agnostic.
- **Archive tree:** renders whatever rows exist and humanizes unknown slugs. One cosmetic item carried (§7).

---

## 7. Parks, deferrals, forward risks

1. **SVG read** · deferred (carried from step 2). Native SVG is not vision-readable; the founder-facing rejection instructs PNG export, enforced at the dispatch entry. Out of scope for chapter 4.
2. **Production schema divergence from repo migrations** · surfaced by Incident A. Migration 018 (and possibly others after it) was never applied to production. rerun.js's stated reliance on the (user_id, artifact_type, version) unique index is therefore unbacked, and reruns could create duplicate versions on a race. The chapter-4 fix (migration 020) addresses the in-flight guard only. A reconcile of repo migrations against production schema is an operator decision, logged here.
3. **CAL three-round cap** · advisory at the surface layer (chapter-2 adjudication; no framework loop counter). A determined founder can rerun past three rounds via the API. Accepted at current scale.
4. **Archive chain-node phase tag** · qb-archive.js hardcodes phase '01' on chain-tree nodes, which would mislabel a Phase 02 artifact rendered via the chain tree. The three Phase 02 agents never chain (triggers are manual/regenerate), so it does not surface today. Fix-forward if it ever does.
5. **Reading surface live render** · asserted by source coverage, not exercised by a live browser this run. A WCAG audit and a live render check remain chapter-deferred.
6. **FILE_TEST_AGENT in production env** · chapter-3 carryover, operator-only. Not touched this chapter.

---

## 8. Standing gates exercised this chapter

Every dispatch-path merge ran the registry merge gate: registry-smoke verbatim pre-merge (GREEN), and the unauthenticated 401 probe on /api/agents/run, /api/agents/console, and (new) /api/agents/dispatch post-deploy (handler-level 401, no FUNCTION_INVOCATION_FAILED). The step-4 endpoint additionally went through a 15-agent adversarial review (3 real defects fixed pre-merge, 9 false alarms dismissed) and the founder-dispatch-entry production harness (which caught Incident A post-deploy).

### Harness evidence (production, this run)

- **logo-evaluation-agent**: PASS. happy 200 delivered 31.8 s, 5 ranked changes, file_refs ok; tier 403 zero-rows; SVG 400 with the PNG-export instruction; missing_dependency correct; teardown 3 users debris-free.
- **voice-guide-agent**: PASS. 3/3 happy delivered (33.6 / 34.8 / 36.3 s, 3 rule groups each); tier 403 zero-rows; missing_dependency correct; teardown 3 users debris-free.
- **console-visibility**: PASS. all three Phase 02 slugs in agents[]; locked_phases ['03','04','05'] (Phase 02 retired, Phase 03 still locked); teardown ok.
- **founder-dispatch-entry**: PASS. happy x3 delivered; sequential double-fire 202 then 409 dispatch_in_flight, one dispatch; simultaneous race [202, 409], one 202 / one 409, one dispatch, one artifact; tier 403 zero-rows; missing_dependency 422 zero-rows; teardown 5 users debris-free.
- **registry-smoke**: GREEN (7 prod + 2 test agents, all slugs in KNOWN_AGENT_SLUGS).
- **401 probe** (post each deploy): /api/agents/dispatch, /api/agents/run, /api/agents/console all 401, no 500.

`.last-run.json` for each harness is written beside it under tests/chapter-04/.

---

## 9. Chapter boundary

Chapter 4 delivered logo and voice production for paying founders: three Phase 02 agents, all signed and released, firable first-run from the product through a tier-gated, dependency-checked, race-safe founder dispatch entry, rendering through the existing reading surface. The pricing thread that landed mid-chapter took QB BrandOS from a dead EUR checkout to a live USD six-ID set, monthly and annual.

Chapter 5 (Phase 03, Content Creation) is the next roadmap step. Its outline is not part of this draft.

Open for the operator: items in §7, principally the production-schema-divergence reconcile (§7.2).

---

*Chapter 4 completion draft · QB BrandOS · June 2026 · close surfaces to the operator; not self-certified.*
