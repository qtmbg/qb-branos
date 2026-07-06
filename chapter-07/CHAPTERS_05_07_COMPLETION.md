# Chapters 5, 6, 7 · completion

## Phases 03, 04, 05 on the framework · 2026-07-04

Chapter 4 closed with seven agents live on the framework. This document closes the arc that followed: ten more agents across three phases, landed across eight pull requests from 2026-07-03 to 2026-07-05, every one harness-verified in production, every prompt held for operator sign-off. All seventeen production agents now run on the framework. The legacy standalone HTML tools keep serving; prompt release does not retire them, and their retire-or-redirect decision is step 4 of the release procedure in `PROMPT_SIGNOFF.md`.

## The pull requests

| PR | Landed | Scope |
|---|---|---|
| #207 | 2026-07-03 | The content-pack block family: `content_pack`, `numbered_procedure`, `spec_grid`. Three deliberately generic types carry every Phase 03-05 deliverable. Canonical phase cards. |
| #208 | 2026-07-04 | Newsletter Architecture, the first Phase 03 agent. |
| #209 | 2026-07-04 | LinkedIn Strategy + Instagram Seed. |
| #210 | 2026-07-04 | YouTube Strategy + Content Bridge. Phase 03 complete. Dispatch extension: `source_content`, `target_platform`. |
| #211 | 2026-07-04 | Content Repurposing Engine + Content Scheduler. Phase 04 complete. |
| #212 | 2026-07-04 | Brand Performance Dashboard + Quarterly Brand Review + Predictive Panel, pro tier. Phase 05 complete. |
| #213 | 2026-07-04 | Chapter close: ten measured latency entries, the heavy-class budget cure, migration 021 authored. |
| #214 | 2026-07-05 | Content Scheduler promoted from standard to heavy after the whole-system E2E failed it at phase 04 with real dependency artifacts. The E2E + visual proof harness lands. |

## The agents

| Phase | Agent | Slug | Tier | Class | Measured |
|---|---|---|---|---|---|
| 03 | Newsletter Architecture | `newsletter_architecture_agent` | starter | heavy | 46.0 s |
| 03 | LinkedIn Strategy | `linkedin_strategy_agent` | starter | heavy | 105.3 s |
| 03 | Instagram Seed | `instagram_seed_agent` | starter | heavy | 82.1 s |
| 03 | YouTube Strategy | `youtube_strategy_agent` | starter | heavy | 85.6 s |
| 03 | Content Bridge | `content_bridge_agent` | starter | standard | 31.1 s |
| 04 | Content Repurposing Engine | `content_repurposing_agent` | starter | heavy | 43.9 s |
| 04 | Content Scheduler | `content_scheduler_agent` | starter | heavy | 52.1 s |
| 05 | Brand Performance Dashboard | `brand_performance_agent` | pro | heavy | 43.0 s |
| 05 | Quarterly Brand Review | `quarterly_review_agent` | pro | heavy | 76.3 s |
| 05 | Predictive Panel | `predictive_panel_agent` | pro | heavy | 53.5 s |

Measurements are one dedicated live run each (`agent_runs.duration_ms`), 2026-07-04, all succeeded, zero schema retries. LinkedIn runs closest to its 120 s envelope and is the first candidate for prompt tightening if it drifts. The Scheduler measured 52.1 s against a 60 s standard envelope, the tightest margin in the fleet; the whole-system E2E then failed it at phase 04 with real dependency artifacts in the prompt, and #214 promoted it to heavy.

Shared rulings across the ten: founder-initiated only (`manual`, `regenerate`), `retry_budget: 0`, cross-phase dependencies on delivered foundation artifacts, the pasted founder input rides `runtime_args.source_content` (8000-char cap, dispatch re-validates), and every no-paste path degrades to something useful for the weakest persona (measurement scaffold, baseline review, from-foundation brief, strongest-dependency source, core-offer simulation).

## Production harness results (all GREEN)

| Harness | Result | Notes |
|---|---|---|
| `tests/chapter-05/newsletter-architecture.mjs` | PASS · happy 62.5 s | Tier 403, dependency 422, teardown clean. |
| `tests/chapter-05/linkedin-instagram.mjs` | PASS · happy 114.3 s concurrent | Re-run after a deploy race; schema-based wait added to the runbook. |
| `tests/chapter-05/youtube-bridge.mjs` | PASS · happy 83.9 s concurrent | Bridge reflowed the pasted source; episode extras verified. |
| `tests/chapter-06/repurposing-scheduler.mjs` | PASS · happy 57.2 s concurrent | Six fixed surface kickers, source reflow, 12 slots, 6 routine steps. |
| `tests/chapter-07/intelligence-trio.mjs` | PASS · happy 82.1 s concurrent x3 | Pro gate proven against a STARTER founder; 422 names `war_table_synthesizer`. |
| `tests/chapter-07/whole-system-e2e.mjs` | PASS · 331.2 s generation wall | 17/17 delivered, 34/34 visual proofs, teardown debris-free. First attempt failed the Scheduler at phase 04; #214 cured it. |

Every merge ran the standing registry gate both halves: `registry-smoke.mjs` output verbatim in the PR body pre-merge, unauthenticated handler-level 401 on `/api/agents/run` and `/api/agents/console` post-deploy. No 500s at any deploy.

## Whole-system E2E + visual proof

`tests/chapter-07/whole-system-e2e.mjs`: one QA founder walks all seventeen agents in phase order, the QBP as the only fixture. Phase 01 generates from the QBP; every later phase reads the REAL delivered artifacts of the phases before it, including a real uploaded mark for Logo Evaluation. Every delivered artifact renders through the deployed production reading surface at 390 px and 1280 px; 34 full-page screenshots land in `chapter-07/qa/reading-surface/`.

Result: PASS · 2026-07-05 · seed founder `qb-e2e-2c616263@qb-harness.test`, torn down debris-free.

| Check | Result |
|---|---|
| Agents delivered | 17 of 17, phase by phase: 01 in 28.0 s, 02 in 43.5 s, 03 in 107.0 s, 04 in 62.8 s, 05 in 89.9 s |
| Total generation wall | 331.2 s |
| Reading-surface proofs | 34 of 34 rendered `.qb-rs-title` at 390 px and 1280 px |
| Teardown | Debris-free: auth user, profile, artifacts, dispatch jobs, agent runs, storage objects all gone |

The first attempt (2026-07-04) failed exactly one agent: the Scheduler at phase 04, past its 60 s standard envelope with real phase-03 artifacts in the prompt. #214 promoted it to heavy; the re-run walked all seventeen clean, the Scheduler delivering in 55.2 s. Slowest in the walk: LinkedIn Strategy at 101.2 s. Fastest: the Phase 01 synthesizers, 8.4 to 20.1 s.

## What remains for the operator

1. **Sign the prompts.** DONE 2026-07-06. All ten released under the operator's go-live directive after a source re-verification; record in `chapter-07/PROMPT_SIGNOFF.md`, shipped under the registry merge gate (smoke output in the release PR body, post-deploy 401 probes recorded).
2. **Apply migration 021.** STILL OPEN, operator-blocked. `supabase/migrations/021_reconcile_018_artifacts_uniqueness.sql` reconciles the never-applied migration 018 (empirically re-confirmed absent 2026-07-04: duplicate artifact versions insert cleanly). Needs the Supabase SQL editor or an MCP-connected session; neither the 2026-07-05 nor the 2026-07-06 session had SQL access (service-role REST cannot run DDL). After applying, a duplicate-insert probe must fail on the second insert.
3. **Third-party wiring stays flagged.** Content Bridge's platform inventory carries the legacy `OPERATOR_PLATFORMS` list verbatim for review; the Scheduler's Buffer integration and the Bridge's vendor APIs both need operator accounts and were deliberately not wired.
4. **The WCAG audit stays chapter-deferred.** LARGELY CURED. The 2026-07-05 audit ran (74 views, four serious rule types; two fixed in #217). The 2026-07-06 go-live pass applied the quantified remediation: `--ink-50` contrast nudge across 35 files (clears the dominant ~190-node cluster) and the link-in-text-block underlines (#218). Remaining open: gold/rose/forest used as text on cream (~80 nodes); darkening `--gold-deep` globally would break ink-on-gold fills, so it needs a per-use sweep. Logged in `chapter-07/qa/wcag/WCAG-FINDINGS.md`.
5. **Legacy-page disposition.** DECIDED 2026-07-06: option 1, keep the thirteen standalone pages serving deliberately as the anonymous tryout funnel while the Console serves paying founders. Rationale and revisit conditions in `chapter-07/qa/LEGACY-PAGE-DISPOSITION.md`.

*Chapters 5-7 · QB BrandOS · July 2026 · updated 2026-07-06 (go-live pass)*
