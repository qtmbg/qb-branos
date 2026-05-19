# Chapter 2 · Step 7 spec

Status: spec lands as second commit on `chapter-2/step-7-spec` (PR #94). Hold-open per merge-gate protocol until explicit release.

Source authority: `CHAPTER_02_SPEC.md` §5.3 + §5.3.1, step 6 closure report §7 forward references, `api/agents/rerun.js` header comment (MVS shipped in PR #78, Edge `waitUntil` fix in PR #86), step-7 outline at [`chapter-02/step-7-outline.md`](step-7-outline.md). Adjudications from Nizzar (recorded in §2 below).

Prerequisites met (carried from step 6 closure):
- `INTER_EDGE_SECRET` live in Vercel Production.
- `CRON_SECRET` live in Vercel Production.
- Vercel Pro tier active.
- Step 6 closure shipped at `ef47940`.

---

## 1. Bundle scope · what step 7 ships

Per outline bundle framing (one chapter step, four sub-PRs):

| Sub-PR | Topic | Source spec |
| --- | --- | --- |
| 7A | `/api/agents/rerun` §5.3 conformance + `/api/artifacts/[id]/regenerate` retirement (gated by repo-wide grep) | §5.3 + step 6 closure §7 |
| 7B | `feedback` runtime arg plumbing · rerun → run → `agent_runs.runtime_args.feedback` | §3.5 + outline §2.2 |
| 7C | Realtime notification subscriptions (primary path) with poll-on-error fallback | §7 + step 6 closure forward note 5 |
| 7D | Verification closure · two new harnesses + closure report | §11 |

Each sub-PR opens with a code commit + a verification report commit. Sub-PRs merge autonomously per the autonomous-chain posture (established step 6 closure). User touchpoint is the step 7 closure report only.

---

## 2. Locked decisions from outline review

Recorded so the resolutions are traceable. Same pattern as `CHAPTER_02_SPEC.md` §14 + step-6-spec.md §2.

1. **`/api/artifacts/[id]/regenerate` retirement timing · 7A with grep gate.** Default accepted with one condition: the 7A verification harness performs a final repo-wide grep across `api/`, `js/`, `tests/`, `.html`, `.md` for any string reference to `/api/artifacts/[id]/regenerate`. The verification report captures the grep output verbatim. If any in-code or in-template caller surfaces, retirement flips to step 14 and the `X-Deprecated` header stays alive. Cod confirms either way in the 7A verification report.

2. **`feedback` runtime arg plumbing only in 7B.** Default accepted. The framework ships the pipe (request body field → `agent_runs.runtime_args.feedback`). Revision logic — loop counter, revision number, prompt-template selection — is the agent author's responsibility per `/agents/<slug>/prompt.md` conventions. If multiple agent authors duplicate the same revision-tracking pattern, refactor up to framework later. No loop-counter columns in `dispatch_jobs` or `agent_runs` in step 7.

3. **Realtime subscription scope · INSERT AND UPDATE.** **Override accepted.** Bell subscribes to both `INSERT` and `UPDATE` events on `notifications` table filtered by `user_id`. Cross-device read-state consistency is the whole point of going to Realtime; INSERT-only would ship half the upgrade. The bell reacts to `INSERT` by adding a row to the dropdown + incrementing the badge, and to `UPDATE` (specifically `read_at` transitions from null → timestamp) by marking the corresponding row read + decrementing the badge. Incremental cost: one filter; same auth surface; same RLS.

4. **Branched version semantics on mid-chain rerun.** Default accepted. When user rerun on v2 of a 3-version chain (v3 is latest), the new artifact is **v4 with `parent_artifact_id = v2.id`**, branching off v2 as a sibling to v3. `parent_artifact_id` captures user intent (which version the user reran on); `source_artifact_id` on the agent_runs row redundantly captures the same. Two additional captures land in the 7A verification report:
   - The replay modal correctly identifies the specific `run.id` for v4 with `parent_artifact_id=v2.id`, not v3 (the latest). Verifies §5.3.1 replay-target semantics for mid-chain sources.
   - **Forward note for step 9** · Archive UI tree-view rendering. Non-linear chains (v1 → v2 → {v3, v4}) will need a tree visualization in the Archive surface eventually. Captured as a step 9 deliverable.

5. **Realtime as primary · poll on Realtime error.** **Override accepted.** Reasoning per the adjudication: poll-always at 30 s × N users is unnecessary baseline load (1k users = 2k requests/minute, 10k users = 20k requests/minute). The bell runs a state machine:

   ```
   Bell mounts
     → opens Realtime channel
     → on subscription confirmed → no poll fires
     → on Realtime error (CHANNEL_ERROR, TIMED_OUT, CLOSED) → bell starts 30s poll
     → on Realtime reconnect → bell stops poll
   ```

   Single state machine, two paths, never both active. Visibility-aware suppression still applies to the poll path when active. Realtime path runs continuously regardless of tab focus (server-pushed; no client poll to suppress). The 30 s poll interval and the `visibilitychange` suppression behavior are inherited from step 6D · only the start condition changes (poll fires on Realtime error, not on bell mount).

6. **No new capture states for step 7.** Default accepted. Realtime is invisible to static screenshots. The existing 15-state matrix from step 6E covers regression detection. If 7B ships a visible feedback dialog modal at implementation time, add one capture state then. Otherwise, the step 6E contact sheet remains the regression baseline.

---

## 3. Sub-PR 7A · rerun conformance + legacy retirement

### 3.1 File-level scope

| File | Change |
| --- | --- |
| `api/agents/rerun.js` | Conformance audit against §5.3. Confirm dual `qbp_source` handling. Confirm `parent_artifact_id` linkage. Confirm 422 path for `qbp_source='original'` + null `foundation_lock_qbp`. Any drift from the spec gets fixed in this PR. |
| `api/artifacts/[id]/regenerate.js` | **Delete** (gated by §3.4 grep check below). |
| `vercel.json` | Remove the `/api/artifacts/<uuid>/regenerate` route entry if `regenerate.js` is deleted. Keep if retirement defers. |

### 3.2 §5.3 conformance items to audit

PR #78 shipped the MVS. The audit checklist:

1. **Dual `qbp_source` handling.** Body accepts `qbp_source: 'current' | 'original'`. Default is `'current'`. Verified by `rerun-conformance.mjs` (§5.5 verification harness).
2. **422 path for `'original'` with no lock snapshot.** Returns `{ error: { code: 'no_original_snapshot' } }` if `profiles.foundation_lock_qbp` is null or empty. Refused at this endpoint (not in `/api/agents/run`) so the runtime never receives an empty snapshot.
3. **`parent_artifact_id` linkage.** New artifact's `parent_artifact_id` is the source artifact's `id` (the artifact the user rerun on), NOT the latest in the chain. Branched semantics per adjudication #4.
4. **Version bump correctness.** New artifact's `version = (max existing version for user + slug) + 1`. The version space is global per (user_id, artifact_type), not per chain. So v1 → v2 → v3 + rerun on v2 produces v4 (not v2-branch.v3).
5. **`dispatch_jobs.kind='regenerate'`.** Confirmed via `agent_runs.trigger='regenerate'` on the new row.
6. **`agent_version` write.** `dispatch_jobs.agent_version = META.version` from `agents/registry.js`. Captures which prompt/schema version produced this run.

### 3.3 Replay-target version semantics (branched-chain proof)

The 7A harness seeds a 3-version chain on Soul Map (v1 → v2 → v3 with appropriate parent_artifact_id linkage). Then a rerun fires against v2 specifically (not v3). Verifies:

- New artifact `v4.parent_artifact_id === v2.id`.
- `agent_runs.source_artifact_id === v2.id` (for replay-target tracking).
- `/api/agent-runs/<v4-run-id>/replay` returns the v4-specific snapshot, NOT v3's snapshot.
- The Console's Run history row for v4 correctly points the replay modal at v4's `agent_run.id`. Captured as the first additional finding in the 7A verification report per adjudication #4.

### 3.4 Pre-deletion grep gate

Before `regenerate.js` deletes, run from repo root:

```bash
grep -rnE "/api/artifacts/\[id\]/regenerate|/api/artifacts/.*/regenerate" \
  --include="*.js" --include="*.html" --include="*.mjs" --include="*.md" \
  --exclude-dir=node_modules .
```

Capture the verbatim output in the 7A verification report. Decision rule:
- **Zero hits** (or only hits in inert docs / spec text describing the retired endpoint) · retirement proceeds, file deletes, route removed from `vercel.json`.
- **Any in-code hit** (active caller in JS / HTML / harness) · retirement flips to step 14. `regenerate.js` stays alive. `X-Deprecated` header stays. The verification report names the surfaces that still reference the endpoint.

The hit on `chapter-02/verification/step-6-closure-report-*.md` (which references the deprecation header by name) is expected and does NOT block retirement; the report is historical documentation, not a live caller.

### 3.5 Acceptance for 7A

1. `tests/chapter-02/rerun-conformance.mjs` reports 10/10 successful reruns. 5 runs target v1 (root), 5 target v2 (mid-chain).
2. Each run verifies: new artifact at `version = N+1`, `parent_artifact_id = source.id`, `agent_runs.trigger='regenerate'`, `qbp_snapshot` matches chosen `qbp_source`, replay endpoint returns the run-specific snapshot.
3. Repo-wide grep performed and verbatim output captured in the verification report.
4. If retirement proceeded: `POST /api/artifacts/<any-uuid>/regenerate` returns 410 OR 404 (depending on platform vs handler behavior). Console rerun CTAs work unchanged.

---

## 4. Sub-PR 7B · `feedback` runtime arg plumbing

### 4.1 File-level scope

| File | Change |
| --- | --- |
| `api/agents/rerun.js` | Accept `feedback?: string` in request body. Pass through to `/api/agents/run` as `runtime_args.feedback`. |
| `api/agents/run.js` | No change required if `/api/agents/run` already writes the full `runtime_args` object to `agent_runs.runtime_args` (per step 4 spec). Audit to confirm; surgical fix if needed. |
| `js/qb-agents-console.js` | No change in 7B. The Console rerun CTAs do not currently surface a feedback field. If a feedback dialog modal ships later (step 7B-extension or step 9), this file gets the UI hook. |

### 4.2 Scope of plumbing

The `feedback` arg is a string. The framework's contract:

- `rerun.js` accepts it from the request body. Default: undefined.
- Passes through to `/api/agents/run` payload as `runtime_args.feedback`.
- `/api/agents/run` writes the full `runtime_args` blob to `agent_runs.runtime_args` (existing behavior · feedback rides along).
- Agent prompt builders read `runtime_args.feedback` from the agent_run row at prompt-construction time. The framework does not interpret the string.

No loop counter. No revision number. No prompt-template selection at framework layer. Per adjudication #2.

### 4.3 Acceptance for 7B

1. POST `/api/agents/rerun` with `{ artifact_id, qbp_source: 'current', feedback: 'add more vibrant detail' }` writes `agent_runs.runtime_args.feedback === 'add more vibrant detail'` on the resulting run row.
2. POST without `feedback` writes `agent_runs.runtime_args.feedback === undefined` (or simply absent from the JSON; both are valid).
3. No regression on 7A's 10/10 rerun harness · feedback is optional; absence does not change the run shape.

---

## 5. Sub-PR 7C · Realtime notification subscriptions

### 5.1 File-level scope

| File | Change |
| --- | --- |
| `js/qb-notification-bell.js` | Wire Supabase Realtime channel · `INSERT AND UPDATE` filter on `notifications` user_id. State machine per §5.2 below. Poll-on-Realtime-error fallback. |
| `js/qb-cloud.js` | No change expected. The bell's mount receives the Supabase URL + anon key + user JWT from existing cloud config. Audit; surgical fix if Realtime needs anything currently not exposed. |

### 5.2 State machine

```
[Bell mount]
  ↓
[supabase.channel('notifications-<userId>')
   .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.<userId>' }, handleInsert)
   .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: 'user_id=eq.<userId>' }, handleUpdate)
   .subscribe(onStatusChange)]
  ↓
[onStatusChange:
   'SUBSCRIBED' → state = realtime; cancel any active poll
   'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' → state = poll; start 30s setInterval
]

[visibilitychange]
  when state === 'poll' AND document.hidden → clearInterval (suppress poll)
  when state === 'poll' AND !document.hidden → immediate poll + resume interval
  when state === 'realtime' → no-op (Realtime continues regardless of tab focus)

[handleInsert(payload)]
  ↓
  lastRows = [payload.new, ...lastRows].slice(0, DROPDOWN_LIMIT)
  lastUnread = lastUnread + 1
  setBadge(lastUnread); renderDropdown(lastRows)

[handleUpdate(payload)]
  ↓
  was_read = payload.old.read_at != null
  is_read  = payload.new.read_at != null
  if (!was_read && is_read) → lastUnread = max(lastUnread - 1, 0)
  if (was_read && !is_read) → lastUnread = lastUnread + 1   // unlikely but defensive
  update lastRows in place where lastRows[i].id === payload.new.id
  setBadge(lastUnread); renderDropdown(lastRows)
```

The single state machine governs both paths. Two paths, never both active.

### 5.3 Auth surface

Realtime uses the user's JWT for channel auth (Supabase Realtime supports JWT-based RLS enforcement). The bell already has `opts.authToken` from the mount call. Pass it to the Supabase client used for Realtime. Per Supabase docs, the Realtime channel inherits RLS from `notifications` table policies; only rows where `user_id = auth.uid()` reach the subscriber.

The 401-surrender behavior from step 6D stays intact:
- Realtime path: subscription failure (e.g., expired JWT) lands as a `CHANNEL_ERROR` and the state machine flips to poll.
- Poll path: 401 on `GET /api/notifications` triggers bell destroy + interval cleanup (existing behavior from PR #85).
- `qb-cloud.js` owns session refresh in both cases.

### 5.4 Acceptance for 7C

1. `tests/chapter-02/bell-realtime.mjs` opens the bell in headless Playwright, observes `SUBSCRIBED` status on the channel (via DOM probe of a debug attribute or via a Realtime event log injected for the test). Required: zero `/api/notifications` GET requests during the Realtime-active window.
2. Service-role inserts a `notifications` row for the test user. Bell badge updates within 2 s without any client poll fire.
3. Service-role PATCHes the inserted row's `read_at` to `now()`. Bell badge decrements within 2 s.
4. Inject a Realtime error (close the channel via `supabase.removeChannel(channel)` from page context). State machine flips to poll mode. Verify the bell fires a `GET /api/notifications` within 30 s.
5. Re-subscribe (re-open the channel). State machine flips back to Realtime. Verify no further poll requests during a 60 s observation window.

---

## 6. Sub-PR 7D · verification closure

The 7D PR is verification-only (no code change beyond the harnesses and report).

### 6.1 File-level scope

| File | Change |
| --- | --- |
| `tests/chapter-02/rerun-conformance.mjs` | New · 10-run rerun harness covering v1 + v2 sources |
| `tests/chapter-02/bell-realtime.mjs` | New · Playwright harness for §5.4 acceptance |
| `chapter-02/verification/step-7-closure-report-<timestamp>.md` | Closure report · sub-PR ledger + acceptance gate summary + forward notes if any new ones surfaced |

### 6.2 Harness inheritance

Both new harnesses inherit the step 6 harness-hardening posture (per step 6 closure §3.6):
- `AbortController`-backed fetch timeouts (30 s default).
- Inter-run cooldown where rapid loops against Supabase admin or Vercel are involved (10 s default).

---

## 7. Acceptance criteria (consolidated)

Per §3.5 + §4.3 + §5.4:

1. **Rerun conformance 10/10** · v1 source × 5 + v2 source × 5, all SUCCESS with correct version bump, `parent_artifact_id` linkage, `qbp_source` snapshot match, `dispatch_jobs.kind='regenerate'`, `agent_runs.trigger='regenerate'`.
2. **Replay-target proof** · `/api/agent-runs/<v4-run-id>/replay` returns v4's snapshot when the source is v2.
3. **Repo-wide grep gate** · output captured verbatim in 7A report. Retirement proceeds OR defers to step 14 per the decision rule in §3.4.
4. **`feedback` runtime arg** · POST with feedback writes `agent_runs.runtime_args.feedback`; POST without feedback writes runtime_args without the field.
5. **Realtime subscription confirmation** · bell observes `SUBSCRIBED` on the channel within mount + 2 s.
6. **Zero poll requests during Realtime** · `bell-realtime.mjs` verifies no `GET /api/notifications` fires while the channel is healthy.
7. **INSERT triggers badge update under 2 s** · cross-device propagation verified.
8. **UPDATE triggers badge decrement under 2 s** · the cross-device read-state consistency the override is for.
9. **Realtime error → poll within 30 s** · state-machine fallback verified.
10. **No regression on step 6 capture matrix** · all 15 capture states from step 6E re-fire green.

---

## 8. Verification matrix (no new capture states · per adjudication #6)

The existing 15-state matrix from step 6E covers regression detection. Two additional findings land as text in the 7A verification report (no PNGs):

- Replay-target proof for mid-chain rerun (§3.3).
- Forward note for step 9 · Archive UI tree-view rendering for branched chains.

If sub-PR 7B introduces a visible feedback dialog modal at implementation time (which the spec does not currently require · per adjudication #2 the framework only ships the runtime_arg pipe), add one capture state then. Otherwise the contact sheet stays at 15 tiles.

---

## 9. Out of scope

Explicit:

- Phase 02+ agent retrofit (Chapter 4).
- Agent registry expansion (Chapter 4).
- `/api/agents/dispatch.js` retirement (step 14 regardless of `regenerate.js` retirement timing).
- Notification preferences UI (CHAPTER_02_SPEC.md §14.4 explicit out-of-scope).
- DAG view in Agent Console (CHAPTER_02_SPEC.md §14.3 explicit out-of-scope).
- Loop counter / revision tracking at framework layer (per adjudication #2 · agent author responsibility).
- Prompt-template changes for feedback-aware revisions (agent author responsibility).
- Archive UI tree-view for branched version chains (forward note to step 9).
- Notification email template changes (no new notification kinds in step 7).
- Foundation `?upgrade=success` banner (step 13).

---

## 10. Build sequence inside step 7

Per the autonomous-chain posture from step 6 closure:

1. **Sub-PR 7A** opens · code commit + verification report commit. Gate: 10/10 rerun harness + grep output captured + (retirement proceeded OR deferred). Auto-merge on gates green.
2. **Sub-PR 7B** opens against main (post-7A merge). Gate: feedback runtime arg trace. Auto-merge on gates green.
3. **Sub-PR 7C** opens. Gate: `bell-realtime.mjs` 5 acceptance items (subscribe + zero-poll + insert + update + error-fallback). Auto-merge on gates green.
4. **Sub-PR 7D** opens. Closure report + harness commits if not already shipped with each sub-PR. Auto-merge on gates green.
5. **Step 7 closes.** Surface to Nizzar at the closure report only.

---

## 11. Open questions

None at spec-write time. All six outline-level open calls adjudicated in §2 above. Any new question that surfaces during sub-PR implementation gets captured in the affected sub-PR's verification report (per the autonomous-chain posture · blocker-only escalation).

---

## 12. Forward references

- **Step 8 · chain orchestration.** Depends on step 6 lock-foundation refactor (shipped) + step 7 rerun conformance (this spec). Chain triggers fire through the same `dispatch-pattern.js` helper.
- **Step 9 · Archive UI tree-view.** Captured forward note from §2 adjudication #4. Branched version chains (v2 → {v3, v4}) need a tree visualization.
- **Step 13 · Foundation `?upgrade=success` banner.** Deferred from step 6 closure.
- **Step 14 · `/api/agents/dispatch.js` retirement.** Plus `/api/artifacts/[id]/regenerate.js` retirement if step 7A grep gate defers it.

---

## 13. End of step 7 spec

Sub-PR 7A opens on a new branch off main once this spec lands and the hold gate releases.
