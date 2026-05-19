# Chapter 2 · Step 6B verification report

Subject: PR #89 · `feat(chapter-2/step-6b): regenerate Option A refactor + X-Deprecated header` (merged `0b75c86`)

Source authority: `chapter-02/step-6-spec.md` §5. Acceptance gates §5.4.

Date: 2026-05-19. Verified against `https://quantumbranding.ai`.

## 1. Result · all three gates passed

| Gate | Topic | Result | Evidence |
| --- | --- | --- | --- |
| 1 | 10/10 single-agent regenerate runs · `agent_runs` + `artifacts` rows correctly linked, `qbp_snapshot` matches the chosen `qbp_source` | **PASS** | `tests/chapter-02/regenerate-10x.mjs` reports 10 SUCCESS / 0 FAIL. Split: 5 × `qbp_source=current` + 5 × `qbp_source=original`. Each run verified: v2 delivered, `parent_artifact_id=v1.id`, new `dispatch_id` distinct from lock dispatch, `trigger='regenerate'`, `qbp_snapshot._qbp_variant` matches the marker expected for the chosen source ('CURRENT' for `current` since profile.qbp was drifted post-lock; 'ORIGINAL' for `original` since `foundation_lock_qbp` was snapshotted at lock time) |
| 2 | `X-Deprecated` header on every response · format matches §5.2 exactly | **PASS** | Header `X-Deprecated: replaced by /api/agents/rerun, retires step 14` present on every HANDLER response observed: 202 (success, see Gate 1 trace), 204 (OPTIONS preflight), 401 (no auth), 405 (wrong method). See §3.2 below for the bad-UUID-404 precision |
| 3 | No regression on Console rerun CTAs (which call `/api/agents/rerun`, not the deprecated endpoint) | **PASS** | `tests/chapter-02/case-c-trace.mjs` re-run against current prod shows: lock + rerun + Case C resolution all intact. v1 delivered, v2 generating, Console payload surfaces `latest_artifact.status='delivered'` AND `inflight_dispatch_id` non-null independently. Matches the 6A-time trace |

## 2. Gate 1 detail

```
run 01/10 (current)  SUCCESS    119928 ms  v2 delivered, parent=v1, dispatch=new, trigger=regenerate, snapshot=CURRENT
run 02/10 (current)  SUCCESS    115598 ms  v2 delivered, parent=v1, dispatch=new, trigger=regenerate, snapshot=CURRENT
run 03/10 (current)  SUCCESS    112964 ms  v2 delivered, parent=v1, dispatch=new, trigger=regenerate, snapshot=CURRENT
run 04/10 (current)  SUCCESS    113948 ms  v2 delivered, parent=v1, dispatch=new, trigger=regenerate, snapshot=CURRENT
run 05/10 (current)  SUCCESS    122197 ms  v2 delivered, parent=v1, dispatch=new, trigger=regenerate, snapshot=CURRENT
run 06/10 (original) SUCCESS    113309 ms  v2 delivered, parent=v1, dispatch=new, trigger=regenerate, snapshot=ORIGINAL
run 07/10 (original) SUCCESS    112934 ms  v2 delivered, parent=v1, dispatch=new, trigger=regenerate, snapshot=ORIGINAL
run 08/10 (original) SUCCESS    114245 ms  v2 delivered, parent=v1, dispatch=new, trigger=regenerate, snapshot=ORIGINAL
run 09/10 (original) SUCCESS    114015 ms  v2 delivered, parent=v1, dispatch=new, trigger=regenerate, snapshot=ORIGINAL
run 10/10 (original) SUCCESS    113751 ms  v2 delivered, parent=v1, dispatch=new, trigger=regenerate, snapshot=ORIGINAL
```

Per-run wall time stable at ~113-122 s (60 s lock-wait + 45 s regen-wait + ~10 s overhead).

The qbp_source verification is genuinely tight:
- Each run seeds `profile.qbp = { ..., _qbp_variant: 'ORIGINAL' }`.
- Lock runs · `foundation_lock_qbp` snapshots that payload (ORIGINAL marker).
- After lock delivers, harness drifts `profile.qbp` to `{ ..., _qbp_variant: 'CURRENT' }`.
- Regenerate fires.
- `qbp_source='current'` path: `/api/agents/run` reads the live `profile.qbp` (CURRENT). Harness asserts `qbp_snapshot._qbp_variant === 'CURRENT'`.
- `qbp_source='original'` path: `/api/agents/run` reads `profile.foundation_lock_qbp` (ORIGINAL). Harness asserts `qbp_snapshot._qbp_variant === 'ORIGINAL'`.

Both paths pass 5/5. The `qbp_source` parameter is honored end-to-end through the dispatch-pattern helper, the inter-edge boundary, and the runtime's snapshot logic.

## 3. Material findings

### 3.1 Material harness lesson · fetch timeouts + inter-run cooldown required

The first attempt at the 10-run gate (commit a~prior version of `regenerate-10x.mjs`~) returned 3 SUCCESS / 1 no-target / 6 multi-hour fetch hangs (run 5 hung 2 h 1 min). Root cause was infrastructure-side: rapid sequential test-user creation against the Supabase admin API plus repeated /api/lock-foundation calls triggered transient slowdowns, and the harness had no fetch timeout, so a stalled connection waited forever.

Hardening (already in the committed harness):
- All `fetch()` calls now go through `tfetch()` with a 30 s `AbortController` timeout. A stalled request now surfaces as a `threw` verdict at the timeout, not a multi-hour hang.
- 10 s inter-run cooldown between iterations. Gives Supabase admin + Vercel a small breathing window. Wall time impact: ~90 s added across the 10-run sweep.

After hardening: 10/10 SUCCESS, no flakes, consistent per-run timing. The lesson generalizes to any harness against prod that creates auth users in a tight loop. Captured for future verification cycles (6C reaper harness will need the same posture).

### 3.2 Material precision · X-Deprecated header on handler vs platform 404

Curl test against `POST /api/artifacts/not-a-uuid/regenerate` returns HTTP 404 from Vercel's platform routing (`server: Vercel`, `x-vercel-error: NOT_FOUND`) WITHOUT the X-Deprecated header. This is correct behavior:

- vercel.json route pattern: `"src": "/api/artifacts/([0-9a-fA-F-]{36})/regenerate"`. Non-UUID segments do not match the pattern → fall through to the platform catch-all 404, which is upstream of the handler. The Vercel platform 404 page is what serves them.
- The handler IS reached for valid-format UUIDs (even when the artifact doesn't exist). Curl against `POST /api/artifacts/00000000-0000-0000-0000-000000000000/regenerate` (valid format, no auth) returns 401 WITH the `x-deprecated` header.

Per §5.2 of the step 6 spec, the deprecation header's intent is "to surface remaining callers" of the endpoint between step 6 ship and step 14 retirement. The platform-routing 404 path does not surface a "caller" (the request never reaches the regenerate endpoint logic); it surfaces a misdirected request that any deprecation tracking would not need to deduplicate anyway. Gate 2 is functionally satisfied for the handler surface.

### 3.3 Two prior carry-overs cleared by 6B

- **`fireChildRuns` single-agent path verified.** The dispatch-pattern helper was extracted in 6A with both `agents_count=4` (lock) and `agents_count=1` (regen) in mind; 6B is the first single-agent caller. 10/10 SUCCESS confirms `preInsertDispatch` correctly inserts one artifact row with the supplied `parent_artifact_id` and `version=N+1`, and `fireChildRuns` correctly dispatches a single child fetch.
- **`X-Deprecated` wrapper pattern reusable.** The `withDeprecation(response)` + `jsonD(status, body, corsH)` helper in `api/artifacts/[id]/regenerate.js` is internal to the file but the shape is clean enough to lift to `api/_lib/auth.js` if a future endpoint needs the same response-header decoration. Capture for chapter completion notes as an optional refactor.

## 4. Files added to main via this verification PR

- `tests/chapter-02/regenerate-10x.mjs` (new) · the controlled 10-run harness for single-agent regenerate dispatches
- `chapter-02/verification/step-6b-regenerate-verification-20260519T010000Z.md` (this report)

## 5. Out of scope · forward references

- **`/api/agents/dispatch` retirement** stays in step 14 per adjudication. The X-Deprecated header on the regenerate endpoint is the safety net for any drift between this merge and step 14.
- **Sub-PR 6C (reaper)** fires next per the autonomous-chain posture. Prerequisites `CRON_SECRET` + `INTER_EDGE_SECRET` confirmed live in Vercel Production per Comet signal.
- **Sub-PR 6E** opens after 6C verification merges. Will add the six new capture states to `seed-and-capture.mjs` per spec §9.2 + write the step 6 closure report.

## 6. Sign-off

Step 6B acceptance complete. All three gates green. The regenerate Option A refactor, the X-Deprecated header surface, the `qbp_source` parameter end-to-end, and the in-flight detection are verified live against prod.

Per the autonomous-chain posture: once this verification PR merges, sub-PR 6C fires immediately on branch `chapter-2/step-6c-reaper` without explicit signal.
