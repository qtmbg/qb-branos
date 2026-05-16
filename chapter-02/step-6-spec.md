# Chapter 2 · Step 6 spec

Status: spec lands as second commit on `chapter-2/step-6-spec` (PR #83). Hold-open per merge-gate protocol until explicit release.

Source authority: `CHAPTER_02_SPEC.md` §5.1, §5.3, §5.5, §5.6, §6.6, §7, §13. Outline at [`chapter-02/step-6-outline.md`](step-6-outline.md). Adjudications from Nizzar (recorded in §2 below). Vercel cron docs verified 2026-05-16 (sub-minute cron not available on any tier; see §3).

Prerequisites met:
- Vercel Pro upgrade live (Nizzar action, cleared this turn).
- Migrations 011-013 already shipped; reaper + notifications schema already in place.

Prerequisites outstanding (tracked, non-blocking on this spec):
- Supabase service role key rotation. Sequencing tied to Vercel env var update to avoid prod runtime break. Signal-out separate.

---

## 1. Bundle scope · what step 6 ships

Per outline bundle framing (one chapter step, five sub-PRs):

| Sub-PR | Topic | Source spec |
| --- | --- | --- |
| 6A | Lock-foundation refactor + `readLatestArtifacts` status-aware selector | §5.1 + PR #79 §3 |
| 6B | Regenerate refactor + `X-Deprecated` header on legacy endpoint | §5.3 + §13.14 |
| 6C | Reaper cron + `/api/cron/reaper` + HMAC auth | §5.5 + §5.6 |
| 6D | Notification bell + `/api/notifications` GET + mark-read | §7.0-§7.5 |
| 6E | Verification capture states + contact sheet expansion + step 6 closure report | §11 |

Each sub-PR opens with a code commit + a verification report commit, mirroring the chapter 2 pattern (see PRs #67-#79). Each sub-PR gates on the prior. The hold gate is released per sub-PR, not for the bundle.

---

## 2. Locked decisions from outline review

Recorded so the resolutions are traceable. Mirrors `CHAPTER_02_SPEC.md` §14 pattern.

1. **`/api/artifacts/[id]/regenerate` retirement timing.** Kept until step 14. Step 6 (sub-PR 6B) adds `X-Deprecated: replaced by /api/agents/rerun, retires step 14` response header so remaining callers surface in observability before step 14 sweep. No file deletion in step 6. Rationale: zero active callers confirmed by repo audit; the header is a safety net for any drift between audit and step 14, not a migration requirement.

2. **6A vs 6B as one PR vs split.** Split. Two separate sub-PRs, two separate verification harness passes. Matches the chapter 2 code-PR + verification-PR pattern. Halving the verification cycle is not worth one regression breaking both refactors.

3. **Reaper cron interval.** Verified against Vercel docs 2026-05-16: minute precision is the tightest supported, across all tiers including Pro. Sub-minute cron is not a Vercel capability. The §5.5 prose in `CHAPTER_02_SPEC.md` ("every 30 seconds, the tightest interval Vercel offers") is incorrect against current Vercel docs and must amend. **Backoff schedule for step 6: 1 min / 2 min / 5 min**, keyed on `dispatch_jobs.last_retry_at` + `retry_count`. Cron expression: `* * * * *` (every minute). The per-row backoff check below enforces the curve precisely.

4. **Bell mount scope.** Four surfaces only: `/agents`, `/foundation`, `/archive`, `/scan` continuation surfaces. Per-Phase-01 reading pages (`sensescape.html`, `the-profiles.html`, `archetype-compass.html`, `war-table.html`) do NOT get the bell. Reading surfaces are exit-direction; no action affordance for system notifications.

5. **Notification source-of-truth in the bell.** Client-side 30 s poll against `/api/notifications` for MVP. Poll suppresses while tab is backgrounded (Page Visibility API: `visibilitychange` event). Resumes on visible. One immediate fetch on resume so a tab returning from background does not wait a full poll interval to refresh. Realtime upgrade lands step 7+.

6. **Step 7 starting point.** Confirmed. Step 7 opens against `/api/agents/rerun` (PR #78 / commit `60c7ce4`) as starting point. Step 7 scope: full §5.3 spec conformance pass over the MVS shipped in PR #78. Capture closed at end of this spec (§13 forward references).

---

## 3. Amendment to `CHAPTER_02_SPEC.md` §5.5

The 30-second prose in §5.5 of the master spec is wrong. Sub-PR 6C ships a one-paragraph amendment to `CHAPTER_02_SPEC.md` that corrects the cron-frequency claim and the backoff schedule.

Old (lines 442 + 445-447):
> `/api/cron/reaper` · a Vercel Cron job that runs every 30 seconds (the tightest interval Vercel offers; the per-row check below enforces the backoff curve precisely).
> 
> 2. **Backoff schedule.** The reaper acts only when the elapsed time since the most recent attempt has crossed the next backoff threshold:
>    - retry 1 at +30 s
>    - retry 2 at +2 min
>    - retry 3 at +5 min

New:
> `/api/cron/reaper` · a Vercel Cron job that runs every 1 minute (the tightest interval Vercel supports across all tiers; verified against Vercel cron docs 2026-05-16). The per-row backoff check below enforces the curve precisely.
> 
> 2. **Backoff schedule.** The reaper acts only when the elapsed time since the most recent attempt has crossed the next backoff threshold:
>    - retry 1 at +1 min
>    - retry 2 at +2 min
>    - retry 3 at +5 min

Step 6 closure commit folds the amendment into `CHAPTER_02_SPEC.md` and updates the cross-references in §5.5 step 5 (`crons` array in vercel.json snippet, already `"* * * * *"` on line 462; no change to that line).

---

## 4. Sub-PR 6A · lock-foundation refactor + status-aware selector

### 4.1 File-level scope

| File | Change |
| --- | --- |
| `api/lock-foundation.js` | Refactor to Option A: pre-insert four artifact rows with `status='queued'` + `dispatch_id`, fire four `/api/agents/run` fetches inside `context.waitUntil()`, return 202. |
| `api/agents/console.js` | `readLatestArtifacts` becomes `readLatestDeliveredArtifact` (status-aware). Returns the latest artifact with `status='delivered'` per slug. Inflight artifacts continue to surface through the existing `inflight_dispatch_id` field. |
| `api/_lib/dispatch-pattern.js` (new) | Extract the pre-insert + waitUntil pattern as a shared helper. Used by both 6A (lock) and 6B (regenerate). Single source of truth for the Option A invariants. |
| `js/qb-agents-console.js` | No change. Client paints what the server returns. The selector fix is server-side only. |

### 4.2 Option A invariants (per §5.1)

The refactor must guarantee, in order:

1. **Pre-insert.** All four `artifacts` rows (one per Phase 01 agent slug) inserted with `status='queued'`, `dispatch_id` set to the new `dispatch_jobs.id`, `version=1`. Insert happens INSIDE the request handler, BEFORE any child fetch fires. If the insert fails, return 5xx and roll back the `dispatch_jobs` row.

2. **Dispatch row writes.** One `dispatch_jobs` row per lock invocation: `status='producing'`, `kind='lock'`, `agents_count=4`, `agents_settled=0`, `trigger='lock'`, `retry_count=0`, `last_retry_at=NULL`.

3. **Child fetch dispatch.** Four `fetch(/api/agents/run)` calls, one per slug, fired inside `context.waitUntil(Promise.allSettled([...]))`. Inter-edge HMAC headers per §5.6. The parent returns 202 before any child resolves.

4. **Idempotency.** Repeat lock from same user within 60 s returns 409 with the in-flight `dispatch_id` (existing behavior; carry forward).

5. **Failure surface.** A child fetch that throws or returns non-2xx writes `agent_runs.status='failed'` + `error_payload` server-side inside `/api/agents/run` (already implemented in step 4). The lock parent does not observe child outcomes; the reaper picks up stuck producings on the next tick.

### 4.3 `readLatestDeliveredArtifact` selector

Current behavior (PR #79 §3 Case C):
```js
// api/agents/console.js · readLatestArtifacts
// Returns latest by version desc, regardless of status. A queued v2 hides v1's CTAs.
&order=version.desc&limit=1
```

New behavior:
```js
// api/agents/console.js · readLatestDeliveredArtifact
// Returns latest delivered. queued / producing / failed artifacts do not gate
// rerun CTAs against the prior delivered artifact.
&status=eq.delivered&order=version.desc&limit=1
```

The inflight state surfaces unchanged through `inflight_dispatch_id` (built from `activeDispatches` + `dispatchByArtifact` in the existing handler). Console renderer reads `latest_delivered_artifact` + `inflight_dispatch_id` as two independent signals, gates rerun CTAs against `latest_delivered_artifact`, paints producing state from `inflight_dispatch_id`. Permanent-failure pill independence per PR #79 §3.1 stays intact (it reads from `permanently_failed_dispatch_id`, not from artifact status).

Rename note: function name changes from `readLatestArtifacts` (plural) to `readLatestDeliveredArtifact` (singular, status-aware). Update callers in the same PR. The payload field name on the agent rollup stays `latest_artifact` for client compatibility (sub-PR 6A is server-only); the rename is purely internal.

### 4.4 Acceptance for 6A

1. `tests/chapter-02/run-repro.mjs` reports 10/10 zero-stuck-dispatch over 10 controlled lock runs. Deferred step 4 criterion 8. Non-negotiable.
2. PR #79 §3 Case C trace: regen produces queued v2 + delivered v1, Console renders v1's rerun CTAs, producing pill from v2. Verified via new capture state `latest-delivered-with-queued` (see §8 below).
3. Existing nine step-5 capture states (PR #79) re-fire green: contact-sheet diff against committed step-5 contact-sheet shows no regression in row composition, badge colors, or failure copy.

---

## 5. Sub-PR 6B · regenerate refactor + deprecation header

### 5.1 File-level scope

| File | Change |
| --- | --- |
| `api/artifacts/[id]/regenerate.js` | Refactor internals to Option A pattern via `api/_lib/dispatch-pattern.js`. Pre-insert single `artifacts` row (version = prior + 1), fire one `/api/agents/run` inside `context.waitUntil()`. Add `X-Deprecated` response header on every response (2xx and 4xx). |
| `api/_lib/dispatch-pattern.js` | Already extracted in 6A. Accepts `agentsCount=1` for single-agent regen and `agentsCount=4` for lock. |
| `api/agents/rerun.js` | No change in 6B. Step 7 reworks this against full §5.3 conformance. |

### 5.2 X-Deprecated header

Per adjudication #1. Every response from `/api/artifacts/[id]/regenerate` includes:

```
X-Deprecated: replaced by /api/agents/rerun, retires step 14
```

Logs (Vercel runtime + downstream observability) can grep this header to surface any remaining callers between step 6 ship and step 14 retirement. Zero callers expected per the PR #83 audit; the header confirms reality matches expectation through the step 6 → step 14 gap.

### 5.3 `qbp_source` parameter

Per §5.3 + §15.4. Accepts:
- `qbp_source='current'` (default) · `/api/agents/run` reads the current `profiles.qbp` at dispatch time, writes it to `agent_runs.qbp_snapshot`.
- `qbp_source='original'` · `/api/agents/run` reads the locked `profiles.foundation_lock_qbp`, writes it to `agent_runs.qbp_snapshot`.

If `foundation_lock_qbp` is null (Chapter 1 legacy artifact), `qbp_source='original'` returns 422 with `error.code='no_original_snapshot'`. Console two-button rerun UI already disables the "original" button for Chapter 1 legacy artifacts per §6.4; this is the server-side enforcement.

### 5.4 Acceptance for 6B

1. 10/10 single-agent regenerate runs against `/api/artifacts/[id]/regenerate` complete with `agent_runs` + `artifacts` rows correctly linked, `qbp_snapshot` matches the chosen `qbp_source`.
2. `X-Deprecated` header present on every response, format matches §5.2 exactly.
3. No regression on the Console rerun CTAs (which call `/api/agents/rerun`, not the deprecated endpoint).

---

## 6. Sub-PR 6C · reaper cron + HMAC

### 6.1 File-level scope

| File | Change |
| --- | --- |
| `api/cron/reaper.js` (new) | Reaper handler. Reads `dispatch_jobs` rows with `status='producing'`, applies backoff schedule, re-fires `/api/agents/run` for each stuck child agent, increments `retry_count`, updates `last_retry_at`, flips to `failed_permanently` at exhaustion. |
| `api/_lib/notifications.js` (new) | Helper to emit `dispatch_failed` notification (in-app row + email). Used by reaper at terminal state only. |
| `api/_lib/inter-edge-auth.js` | No new code; reaper reuses `INTER_EDGE_SECRET` HMAC pattern from §5.6 for the cron-trigger-to-reaper handshake. The cron trigger is a Vercel-controlled GET; the reaper still validates the `vercel-cron/1.0` user agent + a configurable bearer token to prevent unauthenticated public POSTs from invoking it. |
| `vercel.json` | Add `crons` array: `{ "path": "/api/cron/reaper", "schedule": "* * * * *" }`. New route may not be needed if filesystem handler resolves `api/cron/reaper.js` directly; if not, add an explicit src/dest rewrite (same pattern as PRs #80 / #82). |
| `CHAPTER_02_SPEC.md` | §5.5 prose amendment per §3 of this spec (1 min / 2 min / 5 min, not 30 s / 2 min / 5 min). |

### 6.2 Reaper state machine

Per row of `dispatch_jobs` with `status='producing'`, on every cron tick:

1. **Compute elapsed.** `elapsed = now() - coalesce(last_retry_at, created_at)`.
2. **Check backoff gate.** Skip this row if elapsed < the next-retry threshold:
   - `retry_count=0` (never retried) → fire if elapsed ≥ 60 s
   - `retry_count=1` → fire if elapsed ≥ 120 s
   - `retry_count=2` → fire if elapsed ≥ 300 s
   - `retry_count=3` → no fire; check terminal flip condition below
3. **Identify stuck children.** Read child `artifacts` for the dispatch. Stuck = `status in ('queued', 'producing', 'failed')` with a `failed` reason in `agent_runs.error_payload.code` matching a retry-eligible code per §5.8 (`edge_timeout`, `model_call_failed`, `schema_validation_failed`). User-fixable codes (`qbp_field_missing`, `missing_inputs`, `missing_dependency`) are NOT retried by the reaper; the artifact stays `failed` with the user-action copy surfaced.
4. **Re-fire.** For each retry-eligible stuck child, `fetch('/api/agents/run')` with inter-edge HMAC headers + the same `agent_slug` + `artifact_id` + `qbp_source` as the original dispatch. The re-fire is a fresh Edge invocation with its own 25 000 ms ceiling.
5. **Record retry.** Atomically increment `dispatch_jobs.retry_count`, set `last_retry_at = now()`. One increment per cron tick per dispatch, regardless of how many child agents the reaper re-fired in that tick.
6. **Terminal flip.** If `retry_count = 3` AND dispatch is still `producing` at the next reaper tick after the +5 min window has elapsed since the retry-3 attempt, flip `status = 'failed_permanently'`. Emit ONE `dispatch_failed` notification (in-app + email) per dispatch. No notifications at intermediate retries.

### 6.3 HMAC trigger auth

Reaper handler validates request origin in this order:
1. Check `user-agent` header equals `vercel-cron/1.0` (Vercel cron contract; see Vercel cron docs).
2. Check `authorization: Bearer <INTER_EDGE_SECRET>` header. Vercel cron jobs support `CRON_SECRET` env var which Vercel injects as `Authorization: Bearer <secret>` per the platform contract. Reaper reuses `INTER_EDGE_SECRET` for symmetry with §5.6.
3. If either fails, return 401 with `error.code='unauthorized_cron_trigger'`. Log the rejected request user-agent + ip prefix so anomalous probe attempts surface.

### 6.4 Acceptance for 6C

1. Induced stuck-dispatch trace: insert a `dispatch_jobs` row with `status='producing'` + `created_at = now() - 70 s` + four `agent_runs` rows in `status='failed'` with `error_payload.code='edge_timeout'`. Verify the reaper re-fires at the next tick, increments retry_count to 1, writes last_retry_at.
2. Backoff schedule trace: stuck dispatch at insert + 130 s elapsed shows retry_count=2 after second cron tick. Stuck at insert + 310 s shows retry_count=3 after third tick. Stuck at insert + 320 s shows terminal flip to `failed_permanently` on next tick + one `dispatch_failed` notification row + one email sent.
3. User-fixable code non-retry: stuck dispatch with `error_payload.code='qbp_field_missing'` is NOT retried by the reaper. Artifact stays `failed`, user-action copy surfaces in Console.
4. Unauthenticated POST to `/api/cron/reaper` returns 401. Authenticated cron tick returns 200 with reap summary (rows examined, rows retried, rows flipped).

---

## 7. Sub-PR 6D · notification bell + GET/mark-read endpoints

### 7.1 File-level scope

| File | Change |
| --- | --- |
| `api/notifications.js` (new) | GET handler, RLS-scoped to caller, returns last 50 notifications + unread count. Pagination via `?before=<iso>` query param for older pages (MVP serves a single page; pagination param shipped for forward compat). |
| `api/notifications/[id]/read.js` (new) | POST handler, sets `read_at = now()` on the caller's own row. RLS enforces ownership. Idempotent (re-read is a no-op). |
| `js/qb-notification-bell.js` (new) | Bell component. Self-contained vanilla module. Mounts via `QBNotificationBell.mount(parentEl, { authToken })`. Renders unread badge + dropdown with last 10 notifications. Click on row hits `/api/notifications/[id]/read` then routes to the kind-specific target URL (artifact reader, replay panel, etc.). |
| `vercel.json` | Add three rewrites: `/api/notifications` → `/api/notifications` (filesystem-direct OK), `/api/notifications/([0-9a-fA-F-]{36})/read` → `/api/notifications/[id]/read`. Catch-all `/api/(.*)` already covers the first; second needs the explicit src/dest per the lessons of PRs #80 / #82. |
| Bell mount sites: `agents.html`, `foundation.html`, `archive.html`, `scan-continuation.html` (if a distinct file; otherwise the continuation surface inside `signal-scan.html`) | One-line script import + one-line mount call. Same wiring pattern as `qb-cloud.js`. |

### 7.2 Polling logic

Bell mounts → fetches `/api/notifications` once on mount → starts a 30 s `setInterval` poll → on `document.visibilitychange`:
- `document.hidden === true` · `clearInterval(pollHandle)`, `pollHandle = null`.
- `document.hidden === false` AND `pollHandle === null` · immediate fetch + restart `setInterval`.

The immediate fetch on resume covers the gap where a user backgrounds the tab for 5 min, returns, and would otherwise wait up to 30 s to see new notifications.

Poll surrender on auth fail: a 401 response from `/api/notifications` indicates session expiry; the bell hides itself + clears the interval. Re-mounting on a fresh session re-establishes the poll. The bell does not handle session refresh itself (qb-cloud.js owns auth lifecycle).

### 7.3 Bell DOM shape

```html
<div class="qb-notification-bell" data-mounted="true">
  <button class="qb-notification-bell_trigger" aria-label="Notifications · 2 unread" aria-expanded="false">
    <svg class="qb-notification-bell_icon">[bell glyph]</svg>
    <span class="qb-notification-bell_badge" data-count="2">2</span>
  </button>
  <div class="qb-notification-bell_dropdown" hidden>
    <ul class="qb-notification-bell_list">
      <li class="qb-notification-bell_item" data-kind="dispatch_failed" data-read="0">[copy]</li>
      [...]
    </ul>
  </div>
</div>
```

CSS uses tokens from `:root` per the design system (cream-card surface, ink border, hard offset shadow per §20.12 modal pattern adapted for dropdown sizing). Reduced-motion respected on dropdown reveal.

### 7.4 Notification kinds and target URLs

Per `notifications.kind` enum in migration 013:

| kind | Source | Target URL on click |
| --- | --- | --- |
| `artifact_ready` | Lock-foundation completes a child agent | `/artifact/<artifact_id>` |
| `chain_ready` | Chain orchestration writes (Chapter 2 emits no chain_ready notifications; placeholder for Chapter 4+) | `/artifact/<artifact_id>` |
| `dispatch_failed` | Reaper terminal flip (only source in Chapter 2) | `/agents` with hash `#agent=<slug>` to scroll the failed row into view |
| `quarterly_due` | Step 9+ Quarterly Brand Review cadence (no Chapter 2 emitter) | `/agents` |

### 7.5 Acceptance for 6D

1. Bell mounts on all four target surfaces. DOM probe: `document.querySelector('.qb-notification-bell[data-mounted="true"]')` returns a node on each surface, returns null on every other surface (marketing pages, reading pages, signed-out routes).
2. Empty state: signed-in user with zero notifications shows the bell with no badge, dropdown empty-state copy ("No notifications. The system flags here when something needs your attention.").
3. Unread state: insert two `notifications` rows for the test user with `read_at=null`. Bell renders badge count `2`. Click trigger reveals dropdown with two rows.
4. Mark-read: click a notification row, observe POST to `/api/notifications/<id>/read`, observe row visually marks read (faded), observe badge count decrements to 1, observe re-poll picks up the persisted state.
5. Visibility-aware suppression: background the tab for 60 s, observe no poll requests in the network log during that window. Foreground the tab, observe one immediate poll request followed by 30 s interval polls.

---

## 8. Migration plan

**Zero new migrations.** Schema for step 6 is already in place from:

- Migration 011 (`agent_runs` with all replay surface columns).
- Migration 012 (`dispatch_jobs` with `retry_count`, `last_retry_at`, `failed_permanently` status, partial index on `(status, last_retry_at) where status = 'producing'` for reaper lookup performance).
- Migration 013 (`notifications` table with `kind` enum including `dispatch_failed`, RLS for user-read + service-write + user-update-read_at).
- Migration 014 (`agent_runs.schema_retry_count`, shipped step 4).

If a `failed_permanently_at` or `retry_history` column surfaces as load-bearing during 6C implementation, sub-PR 6C ships migration 015. Default assumption: not needed; the dispatch_jobs.last_retry_at + dispatch_jobs.status flip + the eventual notifications row form a sufficient audit trail.

---

## 9. Verification matrix

### 9.1 Existing nine state contact sheet (carry forward)

All nine states from PR #79 re-fire green at the close of each sub-PR. The `--all` mode + contact sheet builder shipped in PR #79 handle this in one command. Contact sheet diff against committed step-5 contact-sheet must show no regression in row composition, badge colors, failure copy, or replay modal version targeting.

### 9.2 New step 6 capture states

Add to `chapter-02/verification/step-5-screenshots/seed-and-capture.mjs` (same script, new state names). Six new states:

| State | Source seed | Surface captured |
| --- | --- | --- |
| `latest-delivered-with-queued` | Lock + deliver v1, then simulate regen producing v2 (insert artifact v2 with status='queued', leave v1 delivered). | Console renders v1's two-button rerun CTAs + v2's producing pill independently. PR #79 §3 Case C resolution. |
| `reaper-mid-backoff` | Insert stuck dispatch_jobs row at `created_at - 90 s`, retry_count=1, last_retry_at = `now - 30 s`. | Console shows producing with retry_count badge ("retry 1 of 3"). |
| `reaper-recovered` | Stuck dispatch that the reaper successfully retried, child artifact now `delivered`. | Console shows delivered with recent_runs row showing the retry history (one row with status=failed, one with status=succeeded). |
| `permanent-failure-with-notification` | Permanent-failure flip + one `notifications` row of kind `dispatch_failed`. Bell badge shows 1. | Both the Console permanent-failure pill (existing PR #79 state) AND the bell badge with the dispatch_failed dropdown entry. Cross-surface composition. |
| `bell-empty` | Signed-in user, zero notifications rows. | Bell renders with no badge, dropdown empty-state copy. |
| `bell-with-unread` | Two `notifications` rows for user with `read_at=null`, mixed kinds (one artifact_ready + one dispatch_failed). | Bell badge count 2, dropdown shows both rows with kind-distinct visual cues. |

### 9.3 Contact sheet expansion

Nine existing + six new = 15 tiles. The contact-sheet builder in `seed-and-capture.mjs` uses a 3-column CSS grid that wraps naturally to 5 rows. No code change needed in the builder; passing the expanded `VALID_STATES` array generates a 3 × 5 grid automatically.

### 9.4 `run-repro.mjs` 10/10

Deferred step 4 criterion 8. The run-repro harness must report:
- 10/10 lock-foundation dispatches complete (4 artifacts each, zero stuck in queued, zero 504s).
- 10/10 single-agent regenerates complete.

No exceptions. If any run fails to converge within the 60 s harness window, sub-PR 6A or 6B does NOT close.

---

## 10. Out of scope

Explicit. Anything not listed here does not ship in step 6 even if it is tempting:

- Phase 02+ agent retrofit. Chapter 4.
- Agent registry expansion beyond the four Phase 01 agents (Soul Map, Sensescape, Visual DNA, War Table). Chapter 4.
- Realtime subscriptions for notifications (Supabase Realtime, SSE). Step 7+ per adjudication #5.
- `/api/artifacts/[id]/regenerate` file deletion. Step 14 per adjudication #1.
- `/api/agents/dispatch` deprecation. Step 14.
- Notification preferences UI. Out of Chapter 2 per `CHAPTER_02_SPEC.md` §14.4.
- DAG view in Agent Console. Out of Chapter 2 per `CHAPTER_02_SPEC.md` §14.3.
- Foundation `?upgrade=success` banner. Step 13.
- Chain orchestration wiring for non-existent Phase 02 agents. Step 9.
- Notification source-of-truth upgrade to Realtime. Step 7+ per adjudication #5.
- Bell mount on per-Phase-01 reading pages. Out per adjudication #4.

---

## 11. Build sequence inside step 6

1. **Vercel Pro upgrade confirmed live.** Nizzar action, cleared this turn. Spec proceeds.
2. **Sub-PR 6A** opens. Code commit + verification report commit. Hold gate until 10/10 harness pass + Case C trace + no regression on step-5 contact sheet.
3. **Sub-PR 6B** opens against main (post-6A merge). Same shape.
4. **Sub-PR 6C** opens. Reaper code + induced-stuck trace + permanent-flip trace + spec amendment to `CHAPTER_02_SPEC.md` §5.5.
5. **Sub-PR 6D** opens. Bell + endpoints + cross-surface mount probe.
6. **Sub-PR 6E** opens. Six new capture states + 15-tile contact sheet + step 6 closure report.
7. **Step 6 closes.** Closure report at `chapter-02/verification/step-6-closure-report-<timestamp>.md` per established pattern.

---

## 12. Open questions

None at spec-write time. The six §6 outline open calls were all adjudicated by Nizzar this turn (recorded in §2 of this spec). Any new question that surfaces during sub-PR implementation gets captured in the affected sub-PR's verification report.

---

## 13. Forward references

- **Step 7 spec.** Opens against `/api/agents/rerun` (PR #78 / commit `60c7ce4`) as starting point. Step 7 scope: full §5.3 spec conformance pass over the MVS shipped in PR #78. Specifically: dual `qbp_source` handling, parent_artifact_id linkage validation, replay-target version semantics matching `/api/artifacts/[id]/regenerate` per the conformance harness. Step 7 also picks up Realtime notification subscriptions as the upgrade path from the step 6 MVP poll.
- **Step 8 spec.** Chain orchestration. Depends on step 6 lock + regen Option A pattern being live. The chain trigger fires through the same shared `dispatch-pattern.js` helper extracted in 6A.
- **Step 14 spec.** `/api/agents/dispatch.js` retirement + `/api/artifacts/[id]/regenerate.js` retirement. Depends on the `X-Deprecated` header from 6B confirming no callers in the intervening window.

---

## 14. End of step 6 spec

Sub-PR 6A opens on a new branch off main once this spec lands and the hold gate releases.
