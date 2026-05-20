# Chapter 2 · Step 11 closure report

Subject: Chapter 2 Step 11 close. Archive UI tree-view shipped end-to-end · `/api/artifacts?mode=chains` extension + tree-only render + "Earlier work" section + Realtime subscription. 5/5 acceptance gates green. Zero surgical fixes. Step closed.

Source authority: `chapter-02/step-11-outline.md` (now superseded), `chapter-02/step-11-spec.md` (55dcaae · adjudicated), `CHAPTER_02_SPEC.md` §13 build sequence + step 9 sequencing override.

Date: 2026-05-20.

**Step 12 scope determination · this closure confirms step 12 is NOT chapter close.** Master spec §13.13-13.16 still has Foundation `?upgrade=success` banner, `/api/agents/dispatch.js` retirement, end-to-end QA pass, and Final sign-off + `CHAPTER_02_COMPLETION.md` to ship. Step 12 outline opens next on `chapter-2/step-12-spec` per §6 forward references below.

## 1. PR ledger

Step 11 shipped via six pull requests:

| PR | Hash | Scope | Status |
| --- | --- | --- | --- |
| #130 | `c109723` / `55dcaae` | Step 11 spec · outline + full spec (6 adjudications baked) | Open · merges at close per established pattern |
| #131 | `604593d` | 11A · `/api/artifacts?mode=chains` chain-traversal extension | Merged |
| #132 | `3b27caa` | 11B · archive tree-view + "Earlier work" + Realtime sub | Merged |
| #133 | (10C-style hash) | 11C · `archive-tree.mjs` harness · 5/5 PASS | Merged |
| #134 | (this PR) | 11D · step 11 closure report | Pending |

5 of 5 acceptance gates green in one verification cycle:

| Sub-PR | Code PR | Verification | Gates |
| --- | --- | --- | --- |
| 11A · endpoint extension | #131 | smoke-verified inline + rolled into 11C | — |
| 11B · client tree render | #132 | rolled into 11C | — |
| 11C · `archive-tree.mjs` | #133 (harness + report) | inline 5/5 PASS | 5/5 |

## 2. Spec amendments / migrations shipped

None. Step 11 is a UI + endpoint-extension step · zero schema changes, zero migrations.

The synthetic `chain_id` backfill migration that would replace the "Earlier work" section is **logged as a chapter-3 candidate** per spec §6 / Nizzar adj #6 · own step, own reproduction gate, own SQL review.

## 3. Captured forward notes

### 3.1 Three-consumer Realtime pattern validated (NEW · architectural milestone)

The shared `qb-realtime-manager.js` (extracted in step 9C) now powers **three** consumers from one Supabase Realtime client:
- bell · notification badge + dropdown
- Phase view · live agent state on `/agents`
- archive · live chain state on `/archive`

One channel. One state machine. One auth surface. Three surfaces refresh from a single notification INSERT in <1s.

| Surface | Refresh latency from notification | Verified in |
| --- | --- | --- |
| bell | <2 s | step 7C harness |
| Phase view | 1003 ms | step 9D harness |
| archive | 500 ms | step 11C harness |

The pattern scales · future Realtime-aware surfaces (chapter 3 surfaces, any new audit views) inherit silently by registering `mgr.onNotification` + `mgr.onState`. No new clients, no new channels, no new state machines.

### 3.2 Vocabulary discipline (NEW pattern · validated in adj #6 + 11C)

User-facing copy should not leak internal system or build vocabulary. Step 11 adj #6 rejected:
- "Pre-chain history" · system vocabulary (the user doesn't know what "chain" is at the data layer)
- "Chapter 1 artifacts" · build vocabulary (the user doesn't know about chapter numbering)

Accepted: "Earlier work" · plain language, no system/build leak.

**Pattern for forward chapters:** every user-facing string runs the QB voice test before shipping. When tempted to expose a system concept, ask what the user actually experiences and name THAT.

### 3.3 Backfill-migration discipline (NEW pattern · captured in spec §6)

Data-backfill migrations get their own step + reproduction gate + SQL review. They do NOT ride along inside UI steps. The synthetic chain_id backfill for legacy artifacts is the canonical instance · logged as a chapter-3 candidate, not folded into step 11.

The discipline came from step 8C closure (migration 016 was correctly its own sub-PR within step 8) and was reinforced by the operator-driven 5606c47 security hotfix (which got its own dedicated commit + review). Step 11 explicitly applied the pattern by deferring rather than absorbing.

### 3.4 Harness-seed schema discipline (NEW · candidate)

During 11C verification, the first run FAILed on Gate 4 because the queued sensescape artifact was seeded with `content: null`, violating the `artifacts.content NOT NULL` constraint. PostgREST returned 400 + 23502 in the response body, but the harness's `await` ignored the response status. The missing fixture row produced a downstream "no in-flight row" failure that looked like a client bug, when in fact the seed had silently rejected.

**Mitigation applied:** `content: {}` as the queued-state seed convention. The qb-archive.js client handles `content: null` gracefully via `titleFromContent` (returns "(generating)" copy), but the DB doesn't.

**Pattern for chapter 3+ harnesses:** check INSERT response status codes when seeding fixture data. Silent 400s during seed produce downstream "missing row" failures that masquerade as client bugs. Capture: `const r = await tfetch(...); if (!r.ok) throw new Error(...)` is the minimum bar for any seed function.

### 3.5 Harness-determinism pattern (carryforward from step 10 §3.6 · applied to 11C)

Step 11 inherited the harness-determinism pattern: wait for `.qb-notification-bell[data-mounted="true"]` AND `data-realtime="true"` before any view-interaction assertions. No intermittent FAILs in the 11C verification cycle.

The pattern is now mandatory for any harness against a Realtime-aware surface. Step 12+ harnesses inherit.

### 3.6 Single-canonical-surface discipline (carryforward · reinforced by adj #1, #2, #5)

Step 11 adjudications consistently reinforced single-canonical-surface:
- adj #1 extended the existing `/api/artifacts` endpoint rather than splitting to `/api/chain-history`
- adj #2 killed the flat-list render path (no dual-mode toggle)
- adj #5 deferred row-level pagination to chapter 3's unified design pass

### 3.7 Bell-only Realtime indicator pattern (carryforward · adj #3 default accepted)

No per-surface "Live" pill on archive. Bell's `data-realtime` attribute remains the canonical signal. The harness-determinism pattern from §3.5 also exploits this attribute · a single source of truth for connection status across all consumers.

### 3.8 Framework defect-rate continuation

Per directive: aggregate across chapter 2. Escalate hardening to "before chapter 3 opens" if total approaches 12+.

| Step | Surgical PRs | Notes |
| --- | --- | --- |
| 6 | 1 (#86) | `context.waitUntil` Edge bug |
| 7 | 3 (#100, #105, #107) | max(version)+1, JWT sub decode, SUBSCRIBED grace timeout |
| 8 | 4 (#115, #116, #117a, #117b) | registry race, schema compliance, allowlist, lock-trigger filter |
| 9 | 0 | clean step |
| 10 | 0 | clean step (10B was planned, not surgical) |
| 11 | 0 | clean step |

Running total: **8 surgical fixes across steps 6-11**. Three clean steps in a row (9, 10, 11). Chapter has stabilized. Chapter-3 hardening sub-PR at first step recommendation holds, but evidence supports it being a small bracketed pass rather than a major sweep.

### 3.9 Branch-state verification discipline (carryforward · reinforced)

Step 11-outline branch breach (commit landed on local main instead of `chapter-2/step-11-spec`) recovered via cherry-pick + `reset --hard origin/main`. Origin never received the stray commit. Discipline reminder embedded in step 11 spec §4: `git branch --show-current` before every commit. The recovery pattern from step 7 closure §3.3 remains the canonical recovery for branch-state breaches when origin stays clean.

Step 11 sub-PRs (11A, 11B, 11C, 11D) all landed on their intended branches without repeated breaches. Discipline working.

### 3.10 Tooling discipline (carryforward · permanent)

Comet operator-only. No breaches this step. The env-file regeneration during 10C verification + the operator-driven 5606c47 security hotfix were both correct exemplars: when secrets or schema changes are needed, the operator does them; tooling agents do not improvise.

## 4. Harnesses shipped across step 11

One new harness under `tests/chapter-02/`:

- `tests/chapter-02/archive-tree.mjs` · 5-gate Playwright harness covering tree render, branched-rerun nesting, "Earlier work" section, in-flight placeholder, Realtime live-update

Step 11 verification harness suite total: 1 new. Combined with steps 6-11: **12 harnesses available for chapter close + future regression.**

## 5. Local cleanup performed in this PR

- `git worktree list` confirms no stale worktrees (clean since step 7D)
- Local `chapter-2/*` branches: `chapter-2/step-4-code` (historical), `chapter-2/step-5-verification` (residual), `chapter-2/step-11-spec` (open · merges at close), `chapter-2/step-11d-closure` (this branch)
- No env var changes this step

## 6. Out of scope · forward references

Items deferred to subsequent chapter steps:

- **Step 12** Foundation `?upgrade=success` banner + `/api/agents/dispatch.js` retirement (proposed bundling · two small fixes). Outline opens next on `chapter-2/step-12-spec` per the autonomous-chain posture.
- **Step 13** End-to-end QA pass (master spec §13.15). Substantial verification step covering fresh-user full-path + all gates.
- **Step 14** Final sign-off + `CHAPTER_02_COMPLETION.md` (master spec §13.16).
- **Chapter 3 first step** Bracketed hardening sub-PR (per step 8 + step 10 + step 11 closure recommendations; evidence supports a small focused pass given chapter stabilization).
- **Chapter 3 candidate work** Synthetic chain_id backfill migration (per Nizzar adj #6) · own step, own reproduction gate, own SQL review. After it ships, "Earlier work" section disappears and the archive collapses to one chain model permanently.

## 7. Sign-off

Step 11 closes with all 5 acceptance gates green, zero surgical fixes (third clean step in a row), one new harness, four NEW patterns captured (three-consumer Realtime validated, vocabulary discipline, backfill-migration discipline, harness-seed schema discipline), four carryforward patterns reinforced (harness-determinism, single-canonical-surface, bell-only Realtime indicator, branch-state verification).

Chapter 2 is not yet closed. Step 12 outline opens next on `chapter-2/step-12-spec` with the Foundation banner + dispatch retirement scope.

Per the autonomous-chain posture: this PR merges immediately.
