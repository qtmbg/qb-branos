# Chapter 2 · Step 6 spec outline

Status: draft outline. Awaiting Nizzar adjudication on the open calls below. Full spec follows on the same branch once the outline lands.

Source authority: `CHAPTER_02_SPEC.md` §5.1, §5.3, §5.5, §6.6, §7, §13. Step 5 verification report (PR #79). AD-001 (Vercel Pro cron, recorded in step 5 report §238).

Branch: `chapter-2/step-6-spec`. PR opens on a hold gate until the outline is approved.

---

## 1. Bundle framing

Step 6 collapses four §13 build-sequence items plus one carry-over fix into a single chapter step:

| §13 item | Topic | Reason for inclusion |
| --- | --- | --- |
| 6 | Lock endpoint refactor (Option A) | Primary deliverable. Locks the dispatch correctness pattern. |
| 7 | Regenerate endpoint refactor (Option A) | Same architectural pattern. Splitting it costs a second harness pass for no win. Both endpoints become Option A in one shot. |
| 8 | Reaper cron | The §5.5 retry safety net. With `retry_budget: 0` declared on all four synthesizers, the reaper is the only retry mechanism; the lock + regen refactors are not safe to ship without it. |
| 12 | Notifications | Bell + bell-row click-to-clear. The reaper emits `dispatch_failed` notifications at terminal state, so the notification surface must exist when the reaper goes live. |
| · | `readLatestArtifacts` status-aware selector | Carry-over fix for PR #79 §3 Case C. Lands inside the lock-foundation refactor because the same code path is touched. |

§13 items deferred out of step 6:
- §13.9 Chain orchestration. Out of scope. No Phase 02 synthesizer exists for Chapter 2 to chain INTO; the framework hook ships separately in step 9.
- §13.10-11 Agent Console views. Already shipped (PR #78).
- §13.13 Foundation `?upgrade=success` banner. Cosmetic. Defer to step 13.
- §13.14 `api/agents/dispatch` deprecation. Still load-bearing for step 14 (see §3 below).

Prerequisite (not deliverable): Vercel Pro upgrade. Nizzar's action this turn; signal before spec finalization so the reaper section can lean on Pro-tier cron primitives as available rather than pending.

---

## 2. Deliverable surfaces

### 2.1 Lock-foundation refactor (`/api/lock-foundation`)

Pattern per §5.1. Pre-insert four `artifacts` rows with `status='queued'` and `dispatch_id` set BEFORE firing child fetches. Use `context.waitUntil()` for the child fetches to `/api/agents/run`. Return 202 immediately. Acceptance: `tests/chapter-02/run-repro.mjs` reports 10/10 zero-stuck-dispatch over 10 controlled runs (deferred step 4 criterion 8).

### 2.2 Regenerate refactor (`/api/artifacts/[id]/regenerate`)

Same Option A pattern. Single-artifact dispatch (one `dispatch_jobs` row with `agents_count=1`). Accepts `qbp_source='current'` (default) or `'original'` per §5.3 + §15.4. Same acceptance harness, scoped to single-agent dispatch.

### 2.3 `readLatestArtifacts` status-aware selector

Per PR #79 §3 Case C. Current `readLatestArtifacts` in `api/agents/console.js` returns the latest artifact by `version desc` regardless of status. When a regenerate produces `v2` in `queued` state and `v1` in `delivered`, the Console hides the rerun CTAs because `v1.status != 'delivered'` is checked against `v2` (the latest by version). Fix: status-aware selector returns the latest *delivered* artifact for CTA gating; the inflight `queued`/`producing` artifact surfaces through the existing `inflight_dispatch_id` field.

Server-side fix only. Client renderer in `qb-agents-console.js` stays unchanged.

### 2.4 Reaper cron (`/api/cron/reaper`)

Per §5.5. 30 s / 2 min / 5 min backoff schedule keyed on `dispatch_jobs.last_retry_at` + `retry_count`. Permanent-failure flip at `retry_count = 3 + still producing`. Emits one `dispatch_failed` notification (in-app + email) on terminal state only. Verification: induce stuck dispatch, observe retries at expected timestamps, observe permanent flip + notification emit.

### 2.5 Notification surface (§7)

Three parts:
1. **Bell component.** New file `js/qb-notification-bell.js`. Mounted on every signed-in surface. Unread badge count. Click reveals dropdown with last 10 notifications. Click on a row marks read (per §14.4: no preferences UI, no mark-all-read; each row clears on click).
2. **`/api/notifications` (GET, mark-read POST).** Per §7.4 + §7.5.
3. **Bell mount sites.** `/agents`, `/foundation`, `/archive`, `/scan` continuation surfaces. Plus `/account`, `/qbp`, `/artifact`, the per-Phase-01 reading pages (`sensescape.html` et al.) for parity. Bell does not mount on logged-out marketing surfaces.

### 2.6 Verification harness extensions

Extend `seed-and-capture.mjs --all` with new state seeds for the surfaces this step adds:
- `reaper-backoff-window` · stuck dispatch mid-backoff, Console shows producing with retry_count > 0
- `reaper-recovered` · stuck dispatch recovered after retry, Console shows delivered with retry_count history visible on the recent_runs row
- `bell-empty` · signed-in user, no notifications, bell shows no badge
- `bell-with-unread` · two unread notifications, badge count 2
- `latest-delivered-with-queued` · the Case C scenario, gating CTAs render correctly

Contact-sheet grid grows from 3×3 to 4×4 (15 tiles). One empty slot or replace with a step-6-only contact sheet.

---

## 3. `/api/artifacts/[id]/regenerate` retirement call

Per Nizzar brief: "your call which is cleaner".

**Recommendation: delete the file in step 6, 410 the route in `vercel.json`.**

Rationale:
- Audit shows zero active callers. Console rerun CTAs already route through `/api/agents/rerun.js` (PR #78 audit item 3). The endpoint is dead code on the wire.
- Leaving it alive while we refactor the lock pattern means three regen surfaces coexist (`run`, `rerun`, `regenerate`) when only two are real. Operators reading the code will guess wrong about which is canonical.
- Step 14 retains its load-bearing scope: deprecate `/api/agents/dispatch.js`, which is still called by the legacy `regenerate.js` until step 6 lands. Cleaner separation: step 6 retires regenerate (the consumer), step 14 retires dispatch (the producer).

Alternative if you want to keep step 14 doing the cleanup: leave `regenerate.js` in place during step 6 but rewire its internals to fetch `/api/agents/run` instead of `/api/agents/dispatch`. Step 14 deletes both. Costs nothing operationally; the file just sits unused until then.

Default the outline picks: delete in step 6.

---

## 4. Sub-PR breakdown

Step 6 is too large for one PR. Proposed phasing on the verification branch:

1. **6A · Lock-foundation refactor.** `/api/lock-foundation` Option A pattern + `readLatestArtifacts` selector fix. Single PR. Harness gate: 10/10 lock runs.
2. **6B · Regenerate refactor + legacy retirement.** `/api/artifacts/[id]/regenerate` deleted, `/api/agents/rerun.js` becomes the canonical Console rerun path (already is, per PR #78). Single PR. Harness gate: 10/10 rerun runs.
3. **6C · Reaper cron.** `/api/cron/reaper` + cron config in `vercel.json` + backoff state machine. Single PR. Verification: induced-stuck test + retry trace + permanent flip + notification emit.
4. **6D · Notifications.** `/api/notifications` + bell component + mount on every signed-in surface. Single PR. Verification: bell-empty + bell-with-unread captures + click-to-clear.
5. **6E · Verification capture + contact sheet expansion.** `seed-and-capture.mjs` new states. Updated contact sheet. Step 6 closure report.

Each PR gates on the prior. Hold protocol: no merge to main on 6A-6D until Nizzar releases each. 6E auto-merges once 6A-6D land.

Open question: should 6A and 6B merge as one PR? They share architectural pattern. Splitting protects against one regression breaking both refactors; merging halves the verification cycle. Default outline picks split.

---

## 5. Acceptance criteria

Per §11.3 (lock + regenerate), §11.5 (reaper + permanent failure), §11.8 (notifications), plus the deferred step 4 criterion 8 (run-repro 10/10).

1. **Lock-foundation correctness** · 10/10 stuck-free dispatches over 10 controlled lock runs (10 fresh users × 1 lock each). `tests/chapter-02/run-repro.mjs` reports zero 504s, zero stuck-in-queued, all four artifacts per dispatch reach `delivered` or `failed` within 60 s.
2. **Regenerate correctness** · 10/10 single-agent regenerate runs. `qbp_source='current'` writes the current `profiles.qbp` to `agent_runs.qbp_snapshot`. `qbp_source='original'` writes the locked `foundation_lock_qbp`.
3. **Case C gating** · regen artifact in `queued`/`producing` does not hide the prior delivered artifact's rerun CTAs. Verified through `latest-delivered-with-queued` capture + Console render trace.
4. **Reaper retry trace** · induced stuck dispatch retries at +30 s, +2 min, +5 min relative to insert time. Each retry shows in `dispatch_jobs.last_retry_at`. Final state `failed_permanently` at +5 min retry exhaustion.
5. **Reaper permanent-failure notification** · exactly one `dispatch_failed` row inserted into `notifications` per terminal flip. Exactly one email sent. No notifications at intermediate retries.
6. **Bell on every signed-in surface** · enumerate the surface list (above §2.5.3), verify bell DOM is present, badge count reads from `/api/notifications`, click clears the row.
7. **No regression on §6.6 Console state** · contact sheet rerun shows the nine step 5 states still render correctly. Specifically: rolling-badge gold/rose colors per §6.6.1/§6.6.2, failure copy per §5.8.1, permanent-failure pill independence per PR #79 §3.1.

---

## 6. Open calls for Nizzar adjudication

1. **`/api/artifacts/[id]/regenerate` retirement** · default outline deletes in step 6. Override if you want it kept until step 14.
2. **6A vs 6B as one PR vs split** · default outline splits. Override if you want the harness pass consolidated.
3. **Reaper cron interval** · §5.5 prose says "every 30 seconds (the tightest interval Vercel offers)", `vercel.json` snippet at line 462 says `"* * * * *"` (1 minute). Vercel Pro may now permit sub-minute cron. Confirm what Pro tier offers when the upgrade lands; spec defaults to whatever Vercel returns as the tightest available.
4. **Bell mount on reading surfaces** · §7.1 says "every signed-in surface". Outline reads that as including the per-Phase-01 reading pages (`sensescape.html`, `the-profiles.html`, `archetype-compass.html`, `war-table.html`). These surfaces are tool-context, signed-in, and a long-running session can hold them open while a reaper notification lands. Confirm or scope down.
5. **Notification source-of-truth in the bell** · three options: (a) client-side 30 s poll against `/api/notifications`, (b) Supabase Realtime subscription on the `notifications` table, (c) SSE from a server endpoint. Outline defaults to (a) for MVP simplicity, with realtime as the step-7+ enhancement. Override if you want Realtime in step 6.
6. **Step 7 starting point** · per your brief, step 7 opens against `/api/agents/rerun` from PR #78 / 60c7ce4. Confirmed. Step 7 scope is the secondary refactor pass (full §5.3 spec conformance vs the MVS PR #78 wired). Capture here so step 7 spec opens cleanly.

---

## 7. Out of scope

- Vercel Pro upgrade (Nizzar action, prerequisite, lands before step 6 code starts).
- Service role key rotation (Nizzar action, immediate, blocking on security but not step 6 spec).
- Chain orchestration (§13.9, step 9).
- Foundation `?upgrade=success` banner (§13.13, step 13).
- `/api/agents/dispatch` deprecation (§13.14, step 14).
- Phase 02-05 synthesizers (Chapter 4).
- Notification preferences UI (§14.4 explicitly out of scope).
- DAG view (§14.3 explicitly out of scope).

---

## 8. Forward references

- **Step 7 spec.** Opens against `/api/agents/rerun` (PR #78 / 60c7ce4) as starting point. Step 6 sets up the canonical regen pattern; step 7 closes the §5.3 spec compliance.
- **Step 8 spec.** Chain orchestration. Depends on step 6's lock-foundation refactor being live (chain triggers fire through the same Option A pattern).
- **Step 14 spec.** `/api/agents/dispatch.js` deprecation. Depends on step 6 having removed the last consumer of dispatch (via the regenerate retirement).

---

## 9. End of outline

Hold-open PR opens on this branch. Awaiting adjudication on §6 open calls. Full spec follows in a second commit on the same branch.
