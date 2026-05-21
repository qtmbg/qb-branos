# Chapter 3 · Step 1 spec · Hardening pass on the steps 6-8 surgical-fix cluster

Status: spec with all six adjudications baked. Ready for execution. Hold gate remains active on the PR until Nizzar releases. Branch: `chapter-3/step-1-outline` (outline + spec ride together per chapter-2 pattern).

Source authority: `chapter-03/step-1-outline.md` (the open-call outline · this branch · first commit) · the six adjudications surfaced in chat 2026-05-21 · `CHAPTER_02_COMPLETION.md` §3 (defect-rate ledger) + §7 (forward references).

**Step 1 is hardening, not building.** Zero product code rewrites. Enforcement + documentation, not refactoring. The two hard fences below apply.

---

## 0. Adjudications baked

| # | Adjudication |
|---|---|
| 1 | **Override · per-surface audit.** Four surfaces: Edge dispatch, versioning, auth-decode, Realtime-subscribe. Read each end-to-end, including paths that did NOT throw in steps 6-8 but sit on the same seam. |
| 2 | **Override · consolidate.** Lift only the four class-of-bug verdicts (#100 version race, #107 SUBSCRIBED grace, #115 registry race, #116 schema compliance). Four one-offs (#86, #105, #117a, #117b) do NOT lift. Consolidate into **at most two** pattern docs: one race-discipline doc, one schema-compliance doc. |
| 3 | **Default · targeted 7-harness re-fire.** Not the full 14 + E2E. Suite passed at Ch2 close with no intervening product code; re-running proves nothing new and wastes the window. |
| 4 | **Override · invariant assertions, coupled to call 2.** One assertion per class-of-bug verdict. Four harness files at `tests/chapter-03/invariants-*.mjs`. Each goes red if the race shape or schema violation returns. |
| 5 | **Override · time-boxed, MEMO-ONLY.** 60-90 min sweep across the five Edge/Realtime surfaces for race shapes matching #100/#107/#115. Zero patches in step 1. Real findings become their own scoped fix later, not a quiet patch riding in hardening. |
| 6 | **Override · bundled 1A/1B/1C/1D/1Z.** Only new invariant harnesses, two pattern docs, and the sweep memo are touched. No working Chapter 2 product code is rewritten. |

### Hard fences (re-stated)

**Fence 1 · Memo-only on the sweep.** Call 5 produces a findings memo at `chapter-03/step-1-sweep-notes.md`. Zero patches in step 1. If a real race is found, it surfaces as a named forward-referenced step (step 1-bis or step 2 blocker) with its own repro gate. The hardening step does not patch it.

**Fence 2 · Zero product-code rewrites.** Only three artifact classes are touched in step 1: (a) NEW invariant assertion harnesses at `tests/chapter-03/invariants-*.mjs`; (b) NEW pattern docs at `docs/patterns/*.md`; (c) NEW step-1 reports + memo at `chapter-03/`. Working Chapter 2 product code (`api/lock-foundation.js`, `api/agents/run.js`, `agents/contract.js`, `api/_lib/chain-trigger.js`, `js/qb-realtime-manager.js`, `api/cron/reaper.js`, `agents/{soul-map,sensescape,visual-dna,war-table}.js`, `agents.html`, `archive.html`, `js/qb-notification-bell.js`) is read for audit. NOT edited. Refactoring working production code is how previously-cleared bugs get reintroduced.

---

## 1. Bundle framing

Chapter 2 closed with 8 product surgical fixes, all in steps 6-8, then 6 consecutive zero-fix steps through gating + terminal closure. The cluster shipped stable but was never systematically audited for class-of-bug shape. Step 1 is the audit.

Three of the eight match race-condition shapes. One is a schema-compliance discipline failure. The four remaining are genuine one-offs. The audit's job is to verify or correct that first-glance classification, then convert each class-of-bug verdict into a documented pattern AND an enforced invariant harness, so that if the same shape returns at any point in chapter 3 or later, a gate goes red before a user notices.

The audit is per-surface, not per-PR, because chapter 3 writes to exactly the same surfaces (Edge dispatch · versioning · auth-decode · Realtime-subscribe). Auditing only the eight incidents misses adjacent paths on the same seams that didn't happen to throw. Auditing the surface catches the next variant before it ships.

Step 1 size: five sub-PRs (1A through 1Z). Each small. Each shippable in isolation. The full step closes when 1Z merges.

### Work item map

| Item | Source | Sub-PR | Action |
|---|---|---|---|
| Per-surface audit · four surfaces | This step | 1A | Walk each surface end-to-end · name invariants · name gate gaps · classify the 8 fixes |
| Pattern lift · two consolidated docs | Call 2 adjudication | 1B | `docs/patterns/race-discipline.md` (3 race shapes) + `docs/patterns/schema-compliance.md` (extends harness-seed discipline to app + Edge writes) |
| Invariant assertions · four harnesses | Call 4 adjudication | 1C | `tests/chapter-03/invariants-{version-race,subscribe-grace,registry-race,schema-compliance}.mjs` |
| Race sweep memo | Call 5 adjudication | 1D | `chapter-03/step-1-sweep-notes.md` · 60-90 min budget · findings inventory · zero patches |
| Step 1 closure | This step | 1Z | Closure report + 7-harness targeted re-fire results + 4-invariant green attestation + step 2 outline (backfill migration) handoff |

Prerequisites met (verified before this spec was written):
- Chapter 2 closed (PR #149).
- Roadmap pinned (PR #150).
- Step 1 outline open as hold-gated PR #151 (this branch).
- All 14 chapter-2 harnesses present at `tests/chapter-02/*.mjs`.
- Adjudications recorded in chat 2026-05-21 + reproduced verbatim in §0 above.

---

## 2. The cluster · input data

Verbatim from `CHAPTER_02_COMPLETION.md` §3:

| Step | PR | Brief | First-glance class |
|---|---|---|---|
| 6 | #86 | `context.waitUntil` Edge bug | One-off (Edge runtime semantics) |
| 7 | #100 | `max(version)+1` artifact version race | **Class · race (write contention on version)** |
| 7 | #105 | JWT `sub` decode | One-off (parser correctness) |
| 7 | #107 | SUBSCRIBED grace timeout | **Class · race (async state transition grace)** |
| 8 | #115 | Agent registry race | **Class · race (dependency loading)** |
| 8 | #116 | Schema compliance | **Class · discipline (silent-400 on insert/patch)** |
| 8 | #117a | Allowlist | One-off (config correctness) |
| 8 | #117b | Lock-trigger filter | One-off (filter logic correctness) |

Four class-of-bug verdicts (3 races + 1 schema). Four one-offs.

The audit in 1A confirms or corrects each classification with reasoning. If the audit promotes a one-off to class-of-bug, the pattern + invariant deliverables extend; if it demotes a class-of-bug to one-off, the deliverable count contracts. The expected outcome based on first-glance is 4 class-of-bug verdicts (no change), but the audit must verify, not assume.

---

## 3. Sub-PR 1A · Per-surface audit + hardening report

### 3.1 Output

File: `chapter-03/step-1-hardening-report.md`

### 3.2 Structure

Four bucket sections, one per surface:

**Section 1 · Edge dispatch surface**
- Files audited: `api/lock-foundation.js`, `api/agents/run.js`, `api/_lib/chain-trigger.js`, `api/cron/reaper.js`, `api/artifacts/[id]/regenerate.js`
- Read for: `context.waitUntil` correctness (#86 origin) · child-fetch lifecycle · 202 vs 200 return semantics · HMAC inter-edge auth · dispatch idempotency
- Per-file output: invariants currently enforced · invariants currently assumed-but-unchecked · gate coverage (which harness asserts this, if any) · gate gap (where coverage is absent)

**Section 2 · Versioning surface**
- Files audited: `api/lock-foundation.js` (insert path) · `api/artifacts/[id]/regenerate.js` (version increment path) · `agents/contract.js` (agent_version writes) · the unique partial index on `(chain_id, agent_slug) WHERE kind='chain'` from migration 016 · any other `agent_runs` write site
- Read for: version race shapes matching #100 · concurrent-write contention · DB-enforced uniqueness coverage · max(version)+1 paths still in code or fully replaced
- Per-file output: version-write call sites · uniqueness coverage at the DB layer · gate coverage at the harness layer

**Section 3 · Auth-decode surface**
- Files audited: every Edge function that decodes a JWT · `api/agents/run.js` · `api/lock-foundation.js` · `api/artifacts/[id]/regenerate.js` · `api/agent-runs/[id]/replay.js` · `api/cron/reaper.js` · the `_lib` shared auth helpers if any
- Read for: `sub` field decoding (#105 origin) · token-validation discipline · RLS-vs-JWT alignment · expiration handling
- Per-file output: which decoder is used · whether the `sub` field path matches the corrected #105 pattern · whether any Edge function rolls its own decode

**Section 4 · Realtime-subscribe surface**
- Files audited: `js/qb-realtime-manager.js` · `js/qb-notification-bell.js` · the Phase view Realtime consumer in `agents.html` · the archive Realtime consumer in `archive.html`
- Read for: SUBSCRIBED grace timeout coverage (#107 origin) · pre-SUBSCRIBED code paths · channel lifecycle · single-channel-many-consumers compliance · the documented pattern at `docs/patterns/qb-realtime-manager-pattern.md`
- Per-file output: subscribe lifecycle · grace window enforcement · whether any consumer assumes SUBSCRIBED without the manager's guarantee

### 3.3 Per-fix classification table

Eight rows, one per PR. Columns: PR · root cause one-liner · surface · class-of-bug verdict (`class` or `one-off`) · reasoning · existing gate coverage · gate gap (if any).

The table is the load-bearing artifact. The four bucket sections are the supporting evidence.

### 3.4 Class-of-bug ledger

Rolled up from the per-fix table. For each class:
- Name (e.g., "Race · concurrent version write")
- PRs that fell under it (expected: one per class for the three races + #116 for schema)
- Invariant statement (precise, single-sentence, testable)
- Pattern doc that captures it (1B output)
- Invariant harness that enforces it (1C output)

### 3.5 Forward references

Any audit finding that would require a product code change becomes a named forward-referenced step. Examples of the shape (only if the audit surfaces the underlying gap):
- "Step 1-bis · enforce `agent_runs (artifact_id, version)` uniqueness at DB level if migration 016 partial index does not already cover it."
- "Step 2 blocker · audit any chapter-3 Edge function spawning child fetches for `context.waitUntil` correctness against the #86 pattern."

The forward references are named, not executed.

### 3.6 Out of scope for 1A

- Any product code edit (Fence 2).
- Audit of surfaces not in the four buckets above (the per-surface adjudication scopes the audit precisely).
- Audit of one-off PRs as if they were class-of-bug (the verdicts settle that).

---

## 4. Sub-PR 1B · Pattern docs

### 4.1 Output

Two files at `docs/patterns/`:

1. `docs/patterns/race-discipline.md`
2. `docs/patterns/schema-compliance.md`

NOT four thin files. The consolidation is explicit in the adjudication.

### 4.2 `docs/patterns/race-discipline.md` · structure

| Section | Content |
|---|---|
| Header | Origin + scope · three race shapes from chapter-2 steps 7-8 · linked to invariant harnesses at `tests/chapter-03/invariants-{version-race,subscribe-grace,registry-race}.mjs` |
| Shape 1 · Concurrent version-write race | The #100 instance · root cause · the fix shape · the invariant ("no two `agent_runs` rows can race-write the same `(artifact_id, version)` tuple") · the DB-enforced uniqueness mechanism · how to test it |
| Shape 2 · Async state-transition grace race | The #107 instance · the SUBSCRIBED lifecycle · the grace-window mechanism · the invariant ("no Realtime-dependent code path fires before SUBSCRIBED resolves or its grace timeout elapses") · how to test it |
| Shape 3 · Dependency-loading race | The #115 instance · the agent registry import lifecycle · the barrier pattern · the invariant ("no chain trigger dispatches against an agent slug missing from the registry at dispatch time") · how to test it |
| General principles | Idempotency via DB constraints · grace windows on every async state transition · dependency-ordered loading with explicit barriers |
| Gotchas | The three race shapes share a family resemblance: each is a temporal assumption about state that turned out to be false under concurrency. The cure for all three is to convert the temporal assumption into an enforced barrier (DB constraint · timed grace · loading barrier) |

### 4.3 `docs/patterns/schema-compliance.md` · structure

| Section | Content |
|---|---|
| Header | Origin · #116 + the harness-seed-schema-discipline lineage at `docs/patterns/harness-seed-schema-discipline.md` · scope extension from test-harness seeds to app + Edge writes · linked to invariant harness at `tests/chapter-03/invariants-schema-compliance.mjs` |
| Insert/patch contract | Every write site checks `r.ok` before assuming success · throw with response body on failure · no silent-400 paths |
| Enum + check constraint awareness | Schema-defined enums + check constraints reject values silently as 400 unless the call site explicitly reads the response · contract: every write site reads `r.ok` |
| Silent-400 anti-pattern | The shape: write succeeds at the HTTP layer (no exception thrown) but the DB rejects it (400 returned, body ignored) · the consequence: state diverges from assumption · the fix: explicit r.ok check at every write call |
| Cross-reference | This doc EXTENDS `docs/patterns/harness-seed-schema-discipline.md` from test-harness seeds to ALL writes (app code + Edge functions). The harness-seed doc remains valid for its scope; this doc names the broader contract |
| Gotchas | The trap is friendliness: most HTTP clients don't throw on 4xx by default. The discipline is to make EVERY write call assert ok-or-throw, regardless of whether the failure mode "should" happen |

### 4.4 Out of scope for 1B

- Pattern docs for the four one-off PRs (#86, #105, #117a, #117b). Adjudicated as not lifting.
- Splitting race-discipline.md into three separate files. Consolidation is explicit.

---

## 5. Sub-PR 1C · Invariant assertion harnesses

### 5.1 Output

Four files at `tests/chapter-03/`:

1. `tests/chapter-03/invariants-version-race.mjs`
2. `tests/chapter-03/invariants-subscribe-grace.mjs`
3. `tests/chapter-03/invariants-registry-race.mjs`
4. `tests/chapter-03/invariants-schema-compliance.mjs`

One file per class-of-bug verdict. Each invariant is the inverse of its corresponding class.

### 5.2 Harness contract

Each harness:
- Imports from the existing test framework used by `tests/chapter-02/*.mjs` (Playwright + Node test runner per the chapter-2 pattern)
- Names its invariant in the header comment (single sentence, testable)
- Sets up the smallest reproducer for the bug shape (e.g., for version-race: spawn N concurrent lock-foundation calls against a fresh test user)
- Asserts the inverse of the bug (e.g., for version-race: no two `agent_runs` rows share `(artifact_id, version)` across the N calls)
- Tears down its test fixtures (matches the chapter-2 `signup_source`-tagged-zero-residual discipline)
- Writes a `.last-run.json` to `tests/chapter-03/invariants-<name>.last-run.json` for post-run inspection (matches the chapter-2 convention; untracked)
- Goes red if the race shape or schema violation returns

### 5.3 Per-harness sketches

**`invariants-version-race.mjs`**
- Invariant: "No two `agent_runs` rows can race-write the same `(artifact_id, version)` tuple under concurrent lock-foundation calls."
- Reproducer: spawn 10 concurrent calls to `/api/lock-foundation` for the same test user (matches the `lock-foundation-10x.mjs` shape but with version-uniqueness assertions added).
- PASS: all 10 calls succeed AND no two resulting `agent_runs` rows share `(artifact_id, version)`.
- FAIL surface: any duplicate tuple, OR any 23505 unique-constraint violation surfacing as a 500 instead of being caught at the app layer.

**`invariants-subscribe-grace.mjs`**
- Invariant: "No Realtime-dependent code path fires before SUBSCRIBED resolves or its grace timeout elapses."
- Reproducer: instantiate the shared Realtime manager · attach a consumer · assert that pre-SUBSCRIBED state surfaces a documented placeholder, not a runtime exception · advance time to within and then beyond the grace window · assert behavior at each boundary.
- PASS: pre-SUBSCRIBED reads return the placeholder · grace boundary fires the documented fallback path.
- FAIL surface: pre-SUBSCRIBED throws · OR grace boundary fails to fire fallback.

**`invariants-registry-race.mjs`**
- Invariant: "No chain trigger dispatches against an agent slug missing from the registry at dispatch time."
- Reproducer: spawn a chain trigger immediately after Edge cold start · assert the registry is fully loaded before the dispatch executes · OR assert that any missing-slug dispatch returns a documented refusal, not a silent fail.
- PASS: dispatch finds the slug · OR dispatch returns the documented refusal (no silent fail).
- FAIL surface: dispatch returns success against a missing slug · OR dispatch throws without the documented refusal.

**`invariants-schema-compliance.mjs`**
- Invariant: "No insert/patch call site assumes success without reading `r.ok`."
- Reproducer: send a deliberately-malformed insert (e.g., a known-invalid enum value · or a null in a NOT NULL column) to a chapter-2 write surface · assert the harness pattern catches it explicitly with the response body in the thrown error.
- PASS: malformed insert throws with body · the body names the constraint that rejected.
- FAIL surface: malformed insert returns success at the HTTP layer · OR throws without the response body context.

### 5.4 Out of scope for 1C

- Harnesses for the four one-off PRs. Class-of-bug only.
- Harnesses that overlap existing chapter-2 coverage. These are NEW invariants, not regression-coverage duplicates.

---

## 6. Sub-PR 1D · Race-condition sweep memo

### 6.1 Output

File: `chapter-03/step-1-sweep-notes.md`

### 6.2 Scope

60-90 minute time-boxed sweep. Five surfaces:

1. `api/lock-foundation.js`
2. `api/agents/run.js`
3. `api/_lib/chain-trigger.js`
4. `js/qb-realtime-manager.js`
5. `api/cron/reaper.js`

Looking for: the fourth, fifth, or N-th instance of any of the three race shapes (version race · subscribe grace · registry race) in surfaces adjacent to the eight chapter-2 fixes. Three reactive races on one class of surface is itself a pattern; the sweep checks whether more instances exist before chapter 3 adds new Edge/Realtime code on top.

### 6.3 Output structure

Per finding:
- Surface + file + line range
- Race shape suspected (which of the three classes, or new)
- Severity verdict (`real`: confirmed reproducer exists · `suspected`: shape matches but no reproducer attempted · `likely-fine`: shape resembles a race but the path has implicit ordering that protects it)
- Recommended next step (`own scoped fix later` · `add to step-2 blocker list` · `no action`)

### 6.4 HARD FENCE

**Zero patches in step 1.** Memo only. If the sweep finds a real race:
- It surfaces as a named forward reference at the end of 1D
- It becomes its own scoped step with its own repro gate
- It does NOT get patched as a quiet ride-along in step 1
- The closure report at 1Z names it

This fence exists because hardening that silently patches "while we're in there" is exactly how previously-cleared bugs get reintroduced. The discipline holds.

### 6.5 Out of scope for 1D

- Any patch (fence above).
- Sweep of surfaces not in the five listed (time budget binds the scope).
- Findings categorized below `suspected` (too speculative to memo).

---

## 7. Sub-PR 1Z · Step 1 closure

### 7.1 Output

Two files:

1. `chapter-03/verification/step-1-closure-report.md` (matches the chapter-2 `verification/` convention)
2. `chapter-03/step-2-outline.md` (the next step's outline · the synthetic `chain_id` backfill migration · its own repro gate + SQL review per `CHAPTER_02_COMPLETION.md` §7)

### 7.2 Closure report structure

| Section | Content |
|---|---|
| Closeout statement | "Step 1 closes" + Signed-off-by line |
| Class-of-bug verdicts (final) | Verbatim from 1A · with any audit-driven reclassifications named explicitly |
| Pattern docs delivered | `docs/patterns/race-discipline.md` + `docs/patterns/schema-compliance.md` · link + summary |
| Invariant harnesses delivered | Four files · all PASS at first run · last-run.json summaries pasted |
| Sweep memo | Link + headline finding (e.g., "0 real races · 2 suspected · 3 likely-fine") |
| Targeted 7-harness re-fire | `lock-foundation-10x` · `regenerate-10x` · `reaper-gates` · `bell-realtime` · `rerun-conformance` · `rerun-feedback-arg` · `chain-orchestration` · all PASS · last-run.json summaries pasted |
| Forward references | Any audit-driven step 1-bis or step 2 blocker · named · linked |
| Step 2 handoff | The backfill migration · scope summary · repro gate + SQL review requirements (per `CHAPTER_02_COMPLETION.md` §7) |
| Defect-rate ledger update | Step 1 product surgical-fix count: 0 (hardening · zero patches by design) |

### 7.3 Step 2 outline (`chapter-03/step-2-outline.md`)

This is the second instance of the user's named "surface once at step 1 closure + step 2 outline" pattern · the outline rides along in 1Z, not in a separate session opening.

Step 2 = synthetic `chain_id` backfill migration. Per `CHAPTER_02_COMPLETION.md` §4.5 (Backfill-migration discipline) and §7 (Open items):

- Own dedicated step
- Own reproduction gate (synthetic-state-vs-real-state diff)
- Own human-eyes-on-SQL review (per migration 017 hotfix discipline)
- After it ships, the "Earlier work" section in `archive.html` disappears and the UI collapses to one chain model permanently

The step-2 outline structure:
- Bundle framing
- Migration scope (which legacy artifacts get synthetic `chain_id` values · the source-of-truth for the synthesis · idempotency requirements)
- Repro gate spec (the synthetic-state-vs-real-state diff harness)
- SQL review requirements (human-eyes-on · the 017 hotfix model)
- Sub-PR breakdown (2A migration + 2B repro gate harness + 2Z closure expected)
- Six open calls for adjudication

Step 2 follows step 1 close. Adjudication on step 2 happens after 1Z merges, NOT before. The outline rides in 1Z to fulfill the user's "surface once at step 1 closure + step 2 outline" instruction.

### 7.4 Out of scope for 1Z

- Any product code edit (Fence 2 holds through closure).
- Step 2 spec (only outline rides; spec is its own work).
- Re-firing harnesses outside the targeted 7.

---

## 8. Sub-PR cycle + branch hygiene

### 8.1 Order

Serial. Each sub-PR is small and self-contained:

| Sub-PR | Branch | Depends on |
|---|---|---|
| 1A | `chapter-3/step-1a-audit` | step-1 spec merged (PR #151) |
| 1B | `chapter-3/step-1b-patterns` | 1A merged (verdicts settled) |
| 1C | `chapter-3/step-1c-invariants` | 1A merged (verdicts settled) |
| 1D | `chapter-3/step-1d-sweep` | None of 1A/1B/1C (independent) |
| 1Z | `chapter-3/step-1z-closure` | 1A + 1B + 1C + 1D all merged |

1B and 1C can ride in parallel after 1A. 1D can ride at any point after the spec lands.

### 8.2 Branch hygiene discipline

Per `CHAPTER_02_COMPLETION.md` §4.6 (Branch-state verification · `git branch --show-current` before every commit), the discipline is enforced:

- `git branch --show-current` is run BEFORE every commit on every sub-PR
- The output is named in the commit body (e.g., "Verified on branch chapter-3/step-1a-audit before commit")
- If the output names `main` or any other unintended branch, STOP. Do not commit. Switch branches and re-verify.

Three chapter-2 breaches (steps 7, 9, 11) recovered cleanly via cherry-pick because origin/main stayed clean. The discipline is now baseline.

### 8.3 PR title shape

Match chapter-2's commit convention:
- `spec(chapter-3/step-1): outline + spec · hardening pass (hold)` (this PR · #151)
- `doc(chapter-3/step-1a): per-surface audit + hardening report`
- `doc(chapter-3/step-1b): pattern docs · race-discipline + schema-compliance`
- `test(chapter-3/step-1c): invariant assertion harnesses · 4 files`
- `doc(chapter-3/step-1d): race-condition sweep memo (memo-only · zero patches)`
- `verify(chapter-3/step-1z): closure · step 1 closes + step 2 outline`

---

## 9. Out of scope (whole step)

- Asset-layer build (Supabase Storage bucket · upload UI · file browser · agent file-ref read). Starts at step 3 after the step-2 backfill migration closes.
- Phase 02 agents (Logo Direction · Logo Evaluation · Voice Guide). Chapter 4 territory.
- Stripe pre-launch seam (PL-001) and Supabase Pro upgrade (PL-002). Pre-launch register, not step 1.
- Pricing reconciliation. Roadmap states $97/$247/$1497/Atelier; the autoloaded master instruction states $97/$297/$997/Enterprise. Out of scope per the PR #150 reconciliation note. Surface separately.
- WCAG accessibility audit. Post-launch deferred.
- Any product code edit (Fence 2).

---

## 10. Forward references

After 1Z merges, the live state:
- Step 1 closed · zero product surgical fixes in step 1 (hardening · enforcement-only by design)
- Two pattern docs at `docs/patterns/race-discipline.md` + `docs/patterns/schema-compliance.md`
- Four invariant harnesses at `tests/chapter-03/invariants-*.mjs` · all green
- Sweep memo at `chapter-03/step-1-sweep-notes.md` · zero patches · forward-referenced findings (if any) named
- 7-harness targeted re-fire all green
- Step 2 outline opened (backfill migration · awaiting adjudication)

Chapter 3 step 2 follows. The asset-layer build follows step 2. The chapter goal (founder uploads a file, an agent reads it) is two-to-four steps away depending on step 2 + asset-layer scope decisions.

---

## 11. End of spec

Hold gate active. PR #151 carries both the outline + this spec. Awaiting Nizzar release to merge.

After release:
1. Squash-merge PR #151 (outline + spec land on main together · step 1 work begins)
2. Branch `chapter-3/step-1a-audit` opens for the first sub-PR
3. Surface at step 1 closure (1Z) with step 2 outline · per the user's "surface once" instruction

Branch verification gate is on every commit between here and 1Z.
