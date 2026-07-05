# QB BrandOS · handoff · exactly what remains

Written 2026-07-05, immediately after the chapters 5-7 close (#215). This is the complete, verified list of remaining work. Execute it top to bottom and the product is fully open for revenue: all seventeen agents visible and purchasable, data integrity DB-enforced, no dead surfaces, accessibility audited.

---

## 0. State you inherit (verified against the repo and production, 2026-07-05)

- `main` at `a9c2db4` (#215). No open PRs. Working tree clean apart from by-convention-untracked `.last-run.json`, `.console.log`, `node_modules/`, `package-lock.json`. Never commit those.
- All 17 production agents run on the framework across Phases 01-05. Whole-system E2E PASS: 17/17 delivered from one QBP with real cross-phase artifacts, 34/34 reading-surface proofs, teardown debris-free, 331.2 s generation wall (`tests/chapter-07/whole-system-e2e.last-run.json`).
- Payments are live and harness-verified (Stripe USD, checkout + webhook + billing portal, PRs #191-#194, #201-#206). Site audit GREEN as of 2026-07-03 (`tests/site-audit/audit.mjs`).
- **The ten Phase 03-05 agent prompts are HELD.** `PROMPT_HOLD_SLUGS` in `api/agents/console.js` hides them from the Console. Paying founders currently see Phases 03, 04, 05 as locked cards. This is the single largest revenue blocker and it is Task 1.
- Production DB: migration 020 applied (in-flight uniqueness). Migration 018 never applied; migration 021 (the reconcile) is authored but NOT applied. Duplicate artifact versions currently insert cleanly. That is Task 2.

## 0.1 Read before doing anything

1. `CLAUDE.md` (voice self-check, merge gates, hard rules)
2. `chapter-07/CHAPTERS_05_07_COMPLETION.md` (the close record)
3. `chapter-07/PROMPT_SIGNOFF.md` (the release surface and procedure)
4. `docs/patterns/registry-merge-gate.md` (why the gate exists)

## 0.2 Standing rules that bind every task below

- **Registry merge gate, both halves, on any merge touching `agents/`, the registry, or the dispatch path** (`api/agents/*`): pre-merge run `node scripts/registry-smoke.mjs` and paste its output verbatim in the PR body; post-deploy probe `POST /api/agents/run`, `GET /api/agents/console`, and `POST /api/agents/dispatch` unauthenticated and confirm handler-level 401. Any 500 FUNCTION_INVOCATION_FAILED: revert immediately, then surface.
- Voice codex five-point self-check on every response, doc, and commit message. No em dash character anywhere. No banned words. Sentence-case headings. "QB BrandOS" exact casing.
- Small focused PRs, squash merge, self-merge by default. Stop only on explicit hold language from the operator.
- Never `git add -A`. Stage files by name.
- Harness env: `vercel env pull .env.qb-branos.live` (gitignored). Harnesses read it via `QB_ENV_FILE` or the default path.
- Live harnesses cost real Anthropic tokens and create real DB rows; every harness tears down its own users. Do not point harnesses at anything but the deployed production URL they default to.
- Supabase project id: `yushbxjwfhuokaezoioe`. Verify any repo migration against the live schema before assuming it is applied; the repo has diverged before.

---

## Task 1 · Release the ten held prompts (revenue blocker, do first)

**Why.** Ten harness-verified agents (all of Phases 03-05) are invisible to the founders who pay for them. Starter tier buys Phase 03-04 output; pro tier buys Phase 05. Until release, the product sells five phases and shows two.

**Authority.** Prompt release is an operator decision. You prepare everything; the operator releases with explicit language in chat. Inferred approval does not count.

**Steps.**
1. For each of the ten agents in `chapter-07/PROMPT_SIGNOFF.md`, read `SYSTEM_PROMPT` at its source module (listed in the doc's table) and run the doc's five checks: voice mechanics, no-invention rule, weakest-persona fallback, vendor discipline (Content Bridge's `OPERATOR_PLATFORMS` inventory), revision rule.
2. Report the ten check results to the operator in one table. Ask once for release ("approved, release all ten" or a named subset).
3. On explicit approval: edit `api/agents/console.js`, delete the released slugs from `PROMPT_HOLD_SLUGS`, and update the comment above it to record the release date. Nothing else changes in the app; the Console dedupe retires each phase's locked card automatically (the Phase 02 precedent).
4. Ship under the registry merge gate, both halves (rule 0.2).
5. Post-release verification: `tests/chapter-04/console-visibility.mjs` asserts the Console payload including `locked_phases`; its expectations were written when Phases 03-05 were locked. Update its expected payload deliberately to the new state, run it, and record the result. Then confirm in a browser that the released phases render live cards.

**Acceptance.** Authenticated Console lists all released agents as live; locked cards for released phases are gone; gate probes 401; console-visibility harness GREEN against updated expectations.

## Task 2 · Apply migration 021 (data integrity)

**Why.** `rerun.js` states reliance on a (user_id, artifact_type, version) unique index that does not exist in production. Racing reruns can create duplicate artifact versions today. Migration 020 guards in-flight dispatch only.

**Steps.**
1. Read `supabase/migrations/021_reconcile_018_artifacts_uniqueness.sql` fully, including its comments about existing-duplicate cleanup order.
2. Pre-check: confirm the divergence still holds (a duplicate version insert succeeds against prod). The 2026-07-04 session re-confirmed it empirically.
3. Apply via the Supabase MCP (project `yushbxjwfhuokaezoioe`) or the SQL editor. The 2026-07-05 session had no SQL access; if you have the MCP connected, this is minutes.
4. Post-apply probe: insert a duplicate (user_id, artifact_type, version) row against a throwaway harness user; the second insert must fail with a unique violation. Tear down.
5. Re-run `tests/chapter-03/invariants-version-race.mjs`. Its assertions predate DB enforcement; if any expectation now differs, reconcile it deliberately in a PR that quotes the new behavior. Do not loosen assertions to pass.

**Acceptance.** Second duplicate insert fails at the DB; version-race harness GREEN against reconciled expectations; result recorded in a short addendum to `chapter-07/CHAPTERS_05_07_COMPLETION.md` (What remains item 2 marked done).

## Task 3 · Legacy page disposition (thirteen pages, after Task 1)

**Why.** Thirteen standalone HTML tools still serve at the repo root while their framework agents supersede them: the ten from `PROMPT_SIGNOFF.md` release step 4, plus `logo-direction-agent.html`, `logo-evaluation-agent.html`, `voice-guide-agent.html` (released 2026-06, never dispositioned). Two parallel surfaces for the same capability is confusion and drift.

**Authority.** The disposition (retire to `/_archive`, redirect, or keep deliberately) is an operator decision. Present the three options with a recommendation; the journey-guide precedent (Chapter 1 steps 12/16: archive the file, keep git history) is the established retire path.

**Steps once decided.**
1. Move retired files to `/_archive/` following the existing `/_archive/chapter-1-deprecations/` pattern.
2. Add redirects in `vercel.json` for retired URLs pointing at the Console or the relevant surface. Caution: `predictive-panel..html` has a real double dot and `vercel.json` already rewrites `predictive-panel.html` to it; handle that pair together and test both URLs.
3. Sweep every nav, CTA, and in-copy link that referenced the retired pages. The nav is chassis-locked; count changes must match the SOT (`ecosystem.html`).
4. Run `tests/site-audit/audit.mjs` against production post-deploy. Expect zero errors, zero dead links, zero dead CTAs, all pages at SOT navCount.

**Acceptance.** Retired URLs 308 to their successors; audit GREEN; no page anywhere links to a retired file.

## Task 4 · WCAG audit (chapter-deferred since chapter 4)

**Why.** Carried in `chapter-04/CHAPTER_04_COMPLETION.md` section 7 item 5. The live-render half was cured by the E2E's 34 proofs; the accessibility half has never run.

**Steps.**
1. Scope: the 25 production HTML pages plus the artifact reading surface (`artifact.html` with a real delivered artifact, reusing the E2E harness session-injection pattern from `tests/chapter-07/whole-system-e2e.mjs`).
2. Method: axe-core through Playwright (already in `node_modules`) at 390 px and 1280 px, plus manual keyboard-navigation and reduced-motion passes. Contrast checks run against the `:root` tokens; do not change token values to pass, surface conflicts instead.
3. Write findings to `chapter-07/qa/wcag/` with severity. Fix serious and critical findings in small per-page PRs. Cosmetic findings: log, ask the operator.

**Acceptance.** Zero serious or critical axe violations across the scope; findings doc committed; deferral marked cured in the completion doc.

## Task 5 · Third-party wiring (blocked on operator accounts, do not start unprompted)

The Scheduler's Buffer integration and Content Bridge's vendor APIs were deliberately not wired: both need operator-owned accounts and keys. If and only if the operator supplies credentials: review the `OPERATOR_PLATFORMS` inventory with them first (it was carried verbatim from the legacy tool), wire behind server-side env vars (never in client HTML), and harness-verify like every other integration. Until then this stays flagged, not built.

---

## Accepted risks · logged, do not work on these

From `chapter-04/CHAPTER_04_COMPLETION.md` section 7, still standing by design:

- **SVG read**: native SVG is not vision-readable; dispatch rejects with a PNG-export instruction. Accepted.
- **CAL three-round cap**: advisory at the surface layer; API can exceed it. Accepted at current scale.
- **Archive chain-node phase tag**: `qb-archive.js` hardcodes phase '01' on chain-tree nodes; no chaining agent exists today. Fix forward only if one appears.
- **FILE_TEST_AGENT**: already removed from prod env and verified absent. Not a carried item.

## Hard do-not-touch list

Pricing values · banner copy (verbatim constant) · `:root` token block · nav pill, footer, chassis components · testimonials and the featured-by list · illustration inventory (closed; flag missing assets, never substitute) · `predictive-panel..html` filename · `the-profiles.html` font URLs · `claude-sonnet-4-6` default in `api/claude.js`.

## Definition of done

1. All seventeen agents visible in the Console and firable end to end by paying founders at the right tiers.
2. Migration 021 applied and probed; artifact versioning DB-enforced.
3. One canonical surface per capability; retired pages redirect; site audit GREEN.
4. Zero serious or critical WCAG violations in scope.
5. Every merge that touched the dispatch path carries both gate halves in its PR trail.
6. `chapter-07/CHAPTERS_05_07_COMPLETION.md` "What remains" updated as each item lands, so the record never lies.

When all six hold, the program of record is complete. Anything beyond (new agents, growth surfaces, integrations) is a new operator decision, not carried work.

*Handoff · QB BrandOS · 2026-07-05*
