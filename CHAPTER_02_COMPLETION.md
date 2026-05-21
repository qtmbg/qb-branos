# Chapter 2 · Completion

**Status:** CHAPTER CLOSED · 2026-05-21.

The Agent Framework chapter. Built the foundation lock + Phase 01 synthesis runtime, the agent contract, the dispatch + replay surfaces, the Realtime notification spine, chain orchestration, the archive tree-view, and the upgrade flow's celebratory banner. Retired the Chapter 1 dispatch path. Closed with a 13-gate end-to-end pass · 5 consecutive zero-fix steps · zero cross-surface seam defects surfaced.

`Signed-off-by: Ahmed Nizzar Ben Chekroune <me@qtmbg.com>`

---

## Table of contents

1. [Shipped surfaces ledger](#1-shipped-surfaces-ledger)
2. [Harness suite catalog](#2-harness-suite-catalog)
3. [Framework defect-rate ledger](#3-framework-defect-rate-ledger)
4. [Captured patterns ledger](#4-captured-patterns-ledger)
5. [Chapter-3 inheritance notes](#5-chapter-3-inheritance-notes)
6. [Pre-launch register pointer](#6-pre-launch-register-pointer)
7. [Open items handed to chapter 3](#7-open-items-handed-to-chapter-3)
8. [Sign-off](#8-sign-off)

---

## 1. Shipped surfaces ledger

Every chapter-2 user-facing surface added or modified, in build order. Step numbers reference the chapter-02/step-N-spec + verification-report set.

### Agent runtime + contract (steps 1-4)

| Surface | Shipped in | Brief |
|---|---|---|
| `agents/contract.js` · §3.5 agent contract | Step 3 (PR #66) | Single import map for every contract-conformant agent. META + run() shape. Latency-budget pre-check at load. |
| `agents/{soul-map,sensescape,visual-dna,war-table}.js` · 4 Phase 01 agents | Step 3 phase B (PR #68 etc) | Retrofitted to §3.5 contract. Sensescape on Haiku 4.5; others on Sonnet 4.6. |
| `/api/agents/run.js` · canonical execution path | Step 4 | Edge handler · qbp_snapshot + file_refs + runtime_args + agent_version written per run. Inter-edge HMAC. |
| `/api/agent-runs/[id]/replay` · replay GET endpoint | Step 5 (PR #84) | RLS-scoped frozen-input read for the replay panel. |

### Foundation lock + dispatch (step 6)

| Surface | Shipped in | Brief |
|---|---|---|
| `/api/lock-foundation` · Option A refactor | Step 6A (PR #85) | Pre-insert artifact rows with `status='queued'` BEFORE firing child fetches. `context.waitUntil()` for `/api/agents/run` invocations. Returns 202. |
| `/api/artifacts/[id]/regenerate` · refactored | Step 6B / step 7A | Accepts `qbp_source='current'` (default) or `'original'`. Same dispatch pattern. |
| `/api/cron/reaper` · stuck-dispatch retry | Step 6C | 30s / 2min / 5min backoff. Retry 3 → `failed_permanently` + email + notification. |
| `js/qb-notification-bell.js` + DOM mount | Step 6D | In-app bell · badge count for unread · click reveals dropdown with last 10 notifications. Mounted on foundation/agents/archive/signal-scan. |

### Agent Console + Phase view (steps 5 + 9)

| Surface | Shipped in | Brief |
|---|---|---|
| `/agents` (agents.html · Phase view) | Step 5 + step 9 | Phase 01 agents with live state + Phase 02-05 as locked rows with tier-aware unlock copy + two-button rerun (current QBP / original QBP). |
| Run history view + replay modal | Step 5 (build) + step 7 (Realtime path) + step 10 (focus management) | Last 200 agent_runs in 7-day window with replay click-through. Focus capture on modal open · restore on close (Escape + backdrop + × all route through `closeModal()`). |
| Tier-aware locked-row copy | Step 9A | Free: "Unlocks when Starter tier is active." · Starter+: "Available in Chapter ${N} · ${phase label} phase." |

### Realtime + chain orchestration (steps 7 + 8 + 9)

| Surface | Shipped in | Brief |
|---|---|---|
| `js/qb-realtime-manager.js` · shared singleton | Step 9C | One Supabase Realtime client + channel powering bell + Phase view + archive. Extracted from the bell's step 7C state machine. |
| Chain trigger logic · `api/_lib/chain-trigger.js` | Step 8A | `triggerChainIfReady()` after `/api/agents/run` delivery · enumerates downstream agents · tier-gate + depth-cap (8) + DB-enforced idempotency via 23505. |
| `agents/chain-test-agent.js` · synthetic test agent | Step 8B | Phase '00' sentinel · loads only under `CHAIN_TEST_AGENT=1`. Used in step 8C and step 13A verification windows. |
| Phase view Realtime extension | Step 9C | `livePayload` refetch on notification arrival. Three-consumer pattern validated. |

### Archive tree-view (step 11)

| Surface | Shipped in | Brief |
|---|---|---|
| `/api/artifacts?mode=chains` · chain-traversal extension | Step 11A | Returns `{ chains, legacy }` tree shape. Existing default-mode flat-array unchanged. |
| `archive.html` · tree-only render | Step 11B | Each chain renders as a `qb-card` with "Locked YYYY-MM-DD · N agents" header. Branched reruns nest via `parent_artifact_id`. In-flight chains render with status pill placeholders. |
| "Earlier work" section | Step 11B | Chapter-1 legacy artifacts (no `chain_id`) render below the chain section. Visible · not an accordion. |

### Foundation upgrade-success banner (step 12)

| Surface | Shipped in | Brief |
|---|---|---|
| Foundation `?upgrade=success` banner | Step 12A (PR #139) | URL detection → qb-card with gold accent + tier-aware copy (Starter · "Your tools are unlocked"; Pro · "Everything is open"; Agency · "Client mode is on"). Manual dismiss + `history.replaceState` param strip. |
| `/api/agents/dispatch.js` retirement + 4 stub synthesizer files + step-4 smoke | Step 12B (PR #140) | Hard delete after fresh zero-caller audit. Chapter-1 dispatch path retired. |

### End-to-end verification (step 13)

| Surface | Shipped in | Brief |
|---|---|---|
| `tests/chapter-02/e2e-chapter-2.mjs` · monolithic 13-gate harness | Step 13A | One fresh user · single Playwright context · sequential gates from signup through replay. Stripe gate mocked-with-logged-gap (PL-001). Chain gate against live `CHAIN_TEST_AGENT=1`. |

### Migrations (data model)

Migrations 011-017 applied via Supabase MCP across chapter-2 work:

- **011** · `artifact_runs` → `agent_runs` rename + extended columns (qbp_snapshot, file_refs, runtime_args, agent_version, error_payload jsonb)
- **012** · `dispatch_jobs` extension (`failed_permanently` status, retry counters)
- **013** · `notifications` table + RLS
- **014** · `schema_retry_count` on agent_runs
- **015** · `notifications` added to `supabase_realtime` publication (surfaced during 7C as a quiet gap; idempotent fix)
- **016** · `dispatch_jobs.chain_id` + `chain_depth` + `parent_agent_slug` + unique partial index on `(chain_id, agent_slug) WHERE kind='chain'`
- **017** · security hotfix (operator-driven · out-of-band Supabase advisor response · `user_access` view PII leak fix + repro tables dropped + `search_path` pinned on 5 SECURITY DEFINER functions)

---

## 2. Harness suite catalog

The chapter-2 verification suite. 14 harnesses · all PASS at their last gate run. The `e2e-chapter-2.mjs` harness verifies the seams between them.

| Harness | Surface | Last gate result | Steps |
|---|---|---|---|
| `tests/chapter-02/lock-foundation-10x.mjs` | Lock-foundation fan-out | 10/10 PASS | step 6 |
| `tests/chapter-02/regenerate-10x.mjs` | Regenerate path | 10/10 PASS | step 6 |
| `tests/chapter-02/case-c-trace.mjs` | Agent-slug dispatch resolution | trace-only | step 6 |
| `tests/chapter-02/reaper-gates.mjs` | Reaper cron retries | gates PASS | step 6 |
| `tests/chapter-02/notification-bell-gates.mjs` | Bell DOM + states | gates PASS | step 6D |
| `tests/chapter-02/bell-realtime.mjs` | Bell Realtime + poll fallback | 5/5 PASS | step 7C (re-fired post-9C) |
| `tests/chapter-02/rerun-conformance.mjs` | Rerun + branching | 10/10 PASS | step 7A |
| `tests/chapter-02/rerun-feedback-arg.mjs` | Feedback runtime arg | 2/2 PASS | step 7B (re-fired step 9) |
| `tests/chapter-02/chain-orchestration.mjs` | Chain trigger end-to-end | 5/5 PASS | step 8C |
| `tests/chapter-02/phase-view.mjs` | Agent Console Phase view | 5/5 PASS | step 9D |
| `tests/chapter-02/replay-panel.mjs` | Run history + replay modal | 5/5 PASS | step 10C |
| `tests/chapter-02/archive-tree.mjs` | Archive chain tree-view | 5/5 PASS | step 11C |
| `tests/chapter-02/foundation-banner.mjs` | Upgrade-success banner (all 3 tiers verbatim) | 2/2 PASS | step 12C |
| **`tests/chapter-02/e2e-chapter-2.mjs`** | **End-to-end seam verification** | **13/13 PASS** | step 13A |

Run-artifact JSON files (`.last-run.json`) are untracked · each harness writes its result to `tests/chapter-02/<harness>.last-run.json` for post-run inspection.

---

## 3. Framework defect-rate ledger

**Final chapter-2 product surgical-fix count: 8.**

| Step | Surgical fixes | Items |
|---|---|---|
| 6 | 1 | PR #86 · `context.waitUntil` Edge bug |
| 7 | 3 | PR #100 max(version)+1 · PR #105 JWT sub decode · PR #107 SUBSCRIBED grace timeout |
| 8 | 4 | PR #115 registry race · PR #116 schema compliance · PR #117a allowlist · PR #117b lock-trigger filter |
| 9 | 0 | clean |
| 10 | 0 | clean (10B focus-management was planned, not surgical) |
| 11 | 0 | clean |
| 12 | 0 | clean (Cat A test-infra fixes don't count toward product) |
| 13 | 0 | clean (Cat A test-infra fixes at cap of 2; zero product code touched) |

**Clean-streak final: 5 consecutive zero-fix steps (steps 9, 10, 11, 12, 13).** The streak held through the GATING E2E pass · the most likely place for it to break. The 13/13 first-pass PASS is meaningful evidence that the chapter shipped stable.

**Distribution shape:** all 8 product surgical fixes landed in the heavy-build half of the chapter (steps 6-8). The audit + verification + build-on-stable-foundation half (steps 9-13) shipped clean. Recommendation for chapter-3 first-step hardening: small + focused, NOT a major sweep. The evidence supports it.

---

## 4. Captured patterns ledger

Thirteen patterns surfaced across chapter-2 closures. The three **major architectural patterns** are extracted to `docs/patterns/*.md` for cross-chapter reach. The remaining ten **step-local disciplines** stay inline here · they're not lost (closure reports preserve full context), they just don't each need a standalone file.

### Major architectural patterns (extracted)

1. **`qb-realtime-manager` · single-channel, many-consumers Realtime** · [docs/patterns/qb-realtime-manager-pattern.md](docs/patterns/qb-realtime-manager-pattern.md). Origin: step 9C. Validated at step 11C (3 consumers, all refreshed from one notification in <1s). Used by bell + Phase view + archive. The architectural payoff the chapter named in step 9C and the chapter consistently exercised through every Realtime-aware surface that followed.

2. **Harness-determinism · wait for mount + data-painted-state + Realtime before asserting** · [docs/patterns/harness-determinism.md](docs/patterns/harness-determinism.md). Origin: step 10C (replay-panel intermittent FAIL). Refined at 11C / 12C / 13A. Every Playwright harness in the suite uses the dual-wait pattern. Eliminated all intermittent-FAIL bug reports for the rest of the chapter.

3. **Harness-seed schema discipline · check INSERT/PATCH r.ok or throw with body** · [docs/patterns/harness-seed-schema-discipline.md](docs/patterns/harness-seed-schema-discipline.md). Origin: step 11C (the `content: null` silent-400 trap). Reinforced at 12C / 13A. Saves hours of investigation time per silent-seed-failure incident · the discipline costs ~5 lines per wrapper.

### Step-local disciplines (inline)

4. **Vocabulary discipline · no system/build vocab leaking to user copy.** Origin: step 11 §3.2 ("Earlier work" beat "Pre-chain history" + "Chapter 1 artifacts"). Reinforced: step 12A copy-check (Starter headline "Your foundation is unlocked" → "Your tools are unlocked" · headline and body must tell one true story at the money moment). Every user-facing string runs the QB voice test + a "is this system vocabulary leaking?" test before shipping.

5. **Backfill-migration discipline · own step, own repro gate, own SQL review.** Origin: step 11 §3.3. The synthetic chain_id backfill for legacy artifacts is the canonical instance · deferred to chapter-3, will get its own step, its own reproduction gate, its own human-eyes-on-SQL review (per the migration 017 hotfix model). Data-backfill migrations do NOT ride along inside UI steps.

6. **Branch-state verification · `git branch --show-current` before every commit.** Origin: step 7 (first breach + cherry-pick recovery). Two further breaches in step 9 (outline commit on local main) and step 11 (same shape). Each recovered cleanly via cherry-pick + `reset --hard origin/main` because origin stayed clean. The discipline holds: verify the branch, commit, then verify again before push.

7. **Audit-then-delete · deletion-moment re-audit, not spec-time alone.** Origin: step 12B (dispatch retirement). The spec-time audit was clean; the deletion-moment re-audit surfaced the step-4 smoke harness as the sole live caller. STOP-and-surface resolved cleanly. Step 14B applied the same discipline to the orphan re-export removal.

8. **Operator-coordination dependency · surface before harness run, not mid-flight.** Origin: step 13 §3.3. Two named dependencies (Stripe test-mode key + CHAIN_TEST_AGENT=1) surfaced as BLOCKERS at spec-write time. User resolved each explicitly. The disable-after coordination (mid-flight one-liner) closed the CHAIN_TEST_AGENT loop cleanly post-PASS. Pattern: any environmental dependency the harness can't self-provision surfaces BEFORE the harness runs, with the resolution path named in the spec.

9. **Single-canonical-surface discipline · semantic role per surface.** Origin: step 10 §3.2. Reinforced step 11 (`/api/artifacts` extension over new endpoint, tree-only render, no rerun on archive rows) + step 12 (banner lives only on /foundation, bell carries no upgrade notification). Surfaces have semantic roles: rerun is action (Phase view), audit is inspection (run history), output is consumption (artifact reading surface). Don't duplicate affordances · the duplication erodes each surface's semantic role.

10. **Bell-only Realtime indicator · `data-realtime` is the canonical signal.** Origin: step 10 §3.3. Reinforced step 11 §3.7 + step 12 §2.4. Single source of truth for Realtime connection status. No per-surface "Live" pills. Future Realtime-aware surfaces (chapter-3 surfaces) inherit silently via the shared manager.

11. **Three-consumer Realtime · bell + Phase view + archive on one manager.** Origin: step 11 §3.1 (architectural milestone). The single-channel pattern scales to N consumers · the chapter-2 high-water mark is three, but the architecture has no inherent cap. Cross-cuts with the qb-realtime-manager pattern (extracted, item 1 above).

12. **Loading-state vs data-painted-state distinguisher (harness pattern).** Origin: step 10C selector discipline. Reinforced step 11C (`.qb-archive-chain` data-state) + step 13A Gate 4 (the `[data-bucket]` attribute fix). Any harness against a surface with a loading skeleton MUST select the data-painted-state attribute, not the wrapper class.

13. **Category-gated surgical-fix policy · Cat A vs Cat B.** Origin: step 13 adj #6 (modified surgical-fix policy). Cat A = cosmetic / test-infrastructure (selector, timing, harness bug, copy typo) · ship in-session under cap of 2. Cat B = ANY cross-surface seam defect (state not propagating, redirect dropping param, Realtime consumer not refreshing in integrated timeline) · STOP and surface before patching, regardless of line count. Validated by step 13A (2 Cat A fixes shipped; 0 Cat B; 13/13 PASS).

---

## 5. Chapter-3 inheritance notes

Chapter 3 starts cold. The following carries forward unchanged · chapter 3 can rely on these without re-verification:

### Patterns carrying forward

All 13 patterns above. The three majors are at `docs/patterns/*.md`; the ten step-local disciplines are documented inline above + in the full closure reports at `chapter-02/verification/`. Chapter 3 inherits them as the baseline.

### Primitives carrying forward

- **`chain_id`** seeds at lock-foundation root, inherits down each chain hop. Chapter-3 chain-aware surfaces (if any) build on this.
- **`parent_artifact_id`** links rerun branches to their parent. Chapter-3 surfaces that show artifact history rely on this lineage.
- **`agent_version`** writes on every `agent_runs` row. Cross-version artifact distinction is available without further schema work.
- **`qbp_snapshot` + `file_refs` + `runtime_args`** frozen on each `agent_runs` row. Chapter-3 replay surfaces (if extended) read these directly.
- **Chain depth cap (8)** in `chain-trigger.js`. Framework guardrail · refuse + Resend operator email on exceed.
- **DB-enforced idempotency** via unique partial index `(chain_id, agent_slug) WHERE kind='chain'`. Catch 23505 at the call site · no app-level inflight tracking needed.
- **Phase '00' sentinel** in the agent contract. Chapter-3 may use this for any synthetic test agent · feature-flagged via env var (step-8C pattern).

### Code surfaces carrying forward

- `js/qb-realtime-manager.js` · shared singleton, ready for chapter-3 consumers
- `tests/chapter-02/*.mjs` · 14 harnesses · re-run any of them in chapter 3 as regression gates (re-fire policy: any chapter-2 surface modified in chapter 3 requires its harness re-fire to green)
- `agents/{soul-map,sensescape,visual-dna,war-table}.js` · the four Phase 01 agents · contract-conformant · ready for Phase 02 chain consumers in chapter 4

### What resets between chapter 2 and chapter 3

- **`CHAIN_TEST_AGENT` env var** · was set in Vercel Production for the step 13A verification window (operator-coordinated). Removed at step 13Z close (operator-confirmed). Chapter 3 starts with this env var OFF · re-enable required for any future synthetic-agent verification.
- **Test-user fixtures** · all chapter-2 verification users deleted (`signup_source` tagged · zero residual after each harness). Chapter 3 creates its own.
- **The `chapter-2/step-*-spec` branches** · merged + deleted via PR ledger. Chapter 3 starts its branch sequence fresh.

### What's deliberately NOT inherited

- `api/agents/dispatch.js` · DELETED in step 12B. The four Chapter-1-shape `api/agents/*-synthesizer.js` stub files · DELETED in step 12B. The `tests/chapter-02/smoke-haiku-sensescape.mjs` step-4-era smoke · DELETED in step 12B. The four `runXxxSynthesizer` orphan re-exports on `agents/*.js` · DELETED in step 14B (this step).

The chapter-1 dispatch surface is fully gone. Chapter 3 builds on `/api/agents/run` as the canonical execution path.

---

## 6. Pre-launch register pointer

Durable register at [`chapter-02/pre-launch-checklist.md`](chapter-02/pre-launch-checklist.md). Two open items as of chapter close:

- **PL-001 · Real-Stripe upgrade-flow seam check (`/foundation?upgrade=success`).** Surfaced in step 13A. Prod env has only `STRIPE_SECRET_KEY=rk_live_*`; test-mode not provisionable. Step 13A used the authorized mocked-with-logged-gap fallback. Real-Stripe seam check is a pre-launch deliverable. Three execution paths documented in the checklist.

- **PL-002 · Supabase Pro upgrade at launch.** Surfaced in chapter-2 security audit. Free tier appropriate for verification; Pro required at GA for leaked-password protection + PITR + production-traffic limits. Upgrade is a billing change, not code.

Future verification gaps that surface under "authorized-fallback" treatment add rows here, not forgotten notes in closure reports.

---

## 7. Open items handed to chapter 3

### Chapter-3 first step · bracketed hardening sub-PR

Recommendation across step 8 + step 10 + step 11 + step 12 + step 13 closures: small + focused, NOT a major sweep. The 5-step clean streak through the GATING E2E pass is meaningful evidence that the chapter shipped stable.

Suggested scope for the hardening sub-PR (chapter-3 first step adjudicates the exact list):
- Visual DNA marginal latency · re-fire `e2e-chapter-2.mjs` at the standard 240s budget; if it consistently delivers in <30s, the timing tolerance is the right place. If it pushes past 240s repeatedly, the agent itself needs work (prompt/model/retry-budget revisit).
- Any chapter-2 surface accessibility WARN that surfaced during step 15 deferral · resolve as part of the chapter-3 hardening if scoped, else defer to a dedicated a11y pass.

### Synthetic `chain_id` backfill migration

Per step 11 adj #6. After it ships in chapter 3, the "Earlier work" section in the archive disappears and the UI collapses to one chain model permanently. Requires:
- Own dedicated chapter-3 step
- Own reproduction gate (synthetic-state-vs-real-state diff)
- Own human-eyes-on-SQL review (per the migration 017 hotfix discipline)

### Phase 02 synthesizers (chapter 4 territory)

Phase 02 agents (Logo Direction, Logo Evaluation, Voice Guide per the master spec) become the first real chain consumers of the chapter-2 framework. They are NOT chapter-3 scope (chapter 3 is integration hardening + post-launch readiness). Phase 02 ships in chapter 4.

### Accessibility audit (post-launch deferred)

Multiple chapter-2 closures referenced a full WCAG accessibility audit as deferred work. Step 13's E2E QA confirmed that per-surface harnesses cover the keyboard + focus a11y basics (replay modal focus management was the highest-stakes case). A full WCAG audit is post-launch · noted here for visibility but not blocking.

### Stripe + Supabase pre-launch deliverables

PL-001 and PL-002 above. Both are pre-launch, not chapter-3 scope · they clear before GA, owned by operator/Cod.

---

## 8. Sign-off

Chapter 2 closes with:
- 13/13 E2E gates green on first-pass (after 2 Cat A test-infra fixes; zero Cat B seam defects)
- 5 consecutive zero-fix steps (steps 9 through 13)
- 8 product surgical fixes total across the chapter (all concentrated in steps 6-8)
- 14 harnesses in the verification suite, all PASS at their last run
- 3 major architectural patterns extracted to `docs/patterns/` for cross-chapter reach
- 10 step-local disciplines documented inline + in closure reports
- 2 pre-launch deliverables logged (PL-001 + PL-002) on a durable register
- `api/agents/dispatch.js` + 4 stubs + step-4 smoke harness retired
- 4 orphan re-exports cleaned (step 14B · audit-confirmed clean at edit time)

The Agent Framework is shipped. Chapter 3 inherits a stable foundation.

`Signed-off-by: Ahmed Nizzar Ben Chekroune <me@qtmbg.com>`

---

*Chapter 2 · QB BrandOS · 2026-05-21*
