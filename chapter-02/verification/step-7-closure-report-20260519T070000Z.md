# Chapter 2 · Step 7 closure report

Subject: Chapter 2 Step 7 close. Rerun §5.3 conformance + `/api/artifacts/[id]/regenerate` retirement + `feedback` runtime arg plumbing + Realtime INSERT+UPDATE subscriptions with poll-on-error state machine. All shipped to prod, all verified, step closed.

Source authority: `chapter-02/step-7-outline.md`, `chapter-02/step-7-spec.md`, `CHAPTER_02_SPEC.md` §5.3 + §5.3.1 + §7, step 6 closure report §7 forward references.

Date: 2026-05-19.

## 1. PR ledger

Step 7 shipped via ten pull requests:

| PR | Hash | Scope | Status |
| --- | --- | --- | --- |
| #94 | `3199e5d` | Step 7 spec · outline + full spec | Merged |
| #99 | `ab39bec` | 7A · rerun conformance (422 path) + `/api/artifacts/[id]/regenerate` retirement | Merged |
| #100 | `0b61262` | 7A · `max(version)+1` surgical fix (latent bug surfaced during gate 1) | Merged |
| #101 | `cbb5f09` | 7A verification · 4 gates PASS | Merged |
| #102 | `b6b4c34` | 7B · `feedback` runtime arg plumbing | Merged |
| #103 | `3de0dc0` | 7B verification · 2 shapes PASS | Merged |
| #104 | `c1e60e0` | 7C · Realtime INSERT+UPDATE subscriptions, poll-on-error state machine | Merged |
| #105 | `9f558b1` | 7C · JWT `sub` claim decode for `userId` (latent bug surfaced during gate 1) | Merged |
| #107 | (commit) | 7C · SUBSCRIBED grace timeout for blocked-WSS resilience (latent bug surfaced during gate 5) | Merged |
| #108 | (this PR's predecessor) | 7C verification · 5 gates PASS | Merged |
| #109 | (this PR) | 7D · step 7 closure report + worktree cleanup | Pending |

11 of 11 acceptance gates green across the three step 7 sub-PRs:

| Sub-PR | Code PR(s) | Verification PR | Gates |
| --- | --- | --- | --- |
| 7A · rerun conformance + retirement | #99 + #100 surgical | #101 | 4/4 PASS |
| 7B · `feedback` runtime arg | #102 | #103 | 2/2 PASS |
| 7C · Realtime + state machine | #104 + #105 + #107 surgical | #108 | 5/5 PASS |

## 2. Spec amendments / migrations shipped

### 2.1 `vercel.json` route removal (in PR #99)

Removed the `/api/artifacts/<uuid>/regenerate` route entry. The base `/api/artifacts/<uuid>` route stays for the artifact read endpoint.

### 2.2 Migration 015 · `notifications` added to `supabase_realtime` publication (in PR #108)

Surfaced during 7C gate 3/4 verification. Migration 013 created the `notifications` table + RLS but did NOT add it to the Supabase Realtime publication. The `postgres_changes` replication source had no notifications-table data flowing through; client subscriptions returned `SUBSCRIBED` but no events ever invoked the handlers. Step 6D shipped the bell as a poll-only consumer, so the publication gap stayed hidden until step 7C wired the Realtime path.

Idempotent `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications` applied via Supabase MCP. File committed for migration-history correctness.

## 3. Captured forward notes

Five material findings surfaced during step 7 verification cycles. All captured here for chapter-completion reference and future-step guidance.

### 3.1 Latent-bug-surfaced-during-verification pattern (PRs #100, #105, #107)

Three more applications of the canonical PR #86 pattern this step:

- **PR #100** · `rerun.js` used `source.version+1` instead of `max(version)+1`. Worked for the first rerun but collided on the UNIQUE index for any second rerun against same source. Surfaced when the rerun-conformance harness sequenced multiple reruns against the same user/slug.
- **PR #105** · `userId` undefined in the bell's Realtime scope. The mount opts only carried `{ authToken }`; the bell needed `user_id` for channel filter. Surfaced when the Realtime SUBSCRIBED callback never fired (channel filter was `user_id=eq.undefined`).
- **PR #107** · SUBSCRIBED grace timeout. The Supabase JS SDK does not surface `CHANNEL_ERROR` cleanly on blocked WebSocket upgrades; it retries silently. The bell's state machine waited indefinitely. Added a 10 s grace timeout so the bell always reaches a usable state within bounded time. Real-world resilience improvement for users behind WSS-blocking firewalls.

**Pattern continues to hold:** small surgical PRs merged in-session against the failing acceptance gate, then the verification harness re-runs against the fixed code. Cumulative across step 6 + step 7: five latent bugs caught and fixed by this pattern (PR #86 in step 6, PRs #100/#105/#107 in step 7).

### 3.2 `agent_slug` join key pattern carried forward (from step 6A)

The 7A rerun conformance verification confirmed that `agent_slug` remains the canonical join key for cross-status dispatch state. The Case C resolution from PR #79 + step 6A continues to hold under the branched-chain semantics shipped in 7A: rerun on a mid-chain v2 produces a v(N+1) with `parent_artifact_id=v2.id`, and the Console correctly identifies the inflight dispatch via the `agent_slug`-keyed map. No regression.

### 3.3 Branch-state verification discipline (per goal directive)

During the step 7 spec-write phase, the full-spec commit landed on local `main` by mistake (the developer thought they were on `chapter-2/step-7-spec`). Caught immediately when `git push origin chapter-2/step-7-spec` reported `Everything up-to-date` even though a new commit had been made. Recovery path:
1. `git checkout chapter-2/step-7-spec`
2. `git cherry-pick <stray-commit-hash>`
3. `git push origin chapter-2/step-7-spec`
4. `git checkout main && git reset --hard origin/main` (origin hadn't pulled the wrong commit)

Same pattern recurred briefly in 7C when a surgical bell fix also landed on local main. Same recovery worked.

**Pattern for forward chapters:** branch-state verification before commit is non-negotiable. Recovery via cherry-pick + reset works ONLY because origin stays clean. Confirm `git branch --show-current` before every commit. The harness pattern that caught both incidents: a stray local-main commit prevents `git push` from advancing the intended branch · the `Everything up-to-date` response is the alarm bell.

### 3.4 Platform-layer vs handler-layer responses (carried from step 6B)

The 7A retirement of `/api/artifacts/[id]/regenerate` re-applied the step-6B lesson: route entries in `vercel.json` removed → `POST /api/artifacts/<uuid>/regenerate` returns 404 with `x-vercel-error: NOT_FOUND` from the Vercel platform, NOT from the handler. Curl-verified inline. Pattern remains: response-header surfaces only on handler responses; platform 404s are upstream.

### 3.5 Gate 5 testing methodology · state-machine determinism

The 7C gate 5 (poll fallback on Realtime error) revealed three testing-methodology pitfalls:

1. **Playwright `page.route('**/realtime/v1/**', ...)`** · ineffective for WebSocket upgrades. `page.route()` intercepts HTTP/fetch only; WSS bypasses the route handler.
2. **CDP `Network.setBlockedURLs`** · partial. CDP blocks the WebSocket upgrade at the request level, but the Supabase SDK retries silently and does not surface `CHANNEL_ERROR` within bounded observation. The PR #107 SUBSCRIBED-grace timeout handles this in real-world deployments; the test still requires bounded observation.
3. **Config-disable via init script** · deterministic. Override `window.QB.SUPA_URL = null` before page navigation. The bell's `startRealtime()` checks `if (!url || !anon)` and immediately calls `flipToPoll()`. Tests the state-machine transition directly.

**Pattern for forward chapters:** test state-machine transitions deterministically when the underlying error path is non-deterministic or silently swallowed by upstream SDKs.

## 4. Harnesses shipped across step 7

Three new harnesses under `tests/chapter-02/`, all inheriting the step 6 harness-hardening posture (`AbortController` fetch timeouts, inter-run cooldown, deterministic state setup):

- `tests/chapter-02/rerun-conformance.mjs` · 10-run rerun harness, 5 v1-source + 5 v2-source (mid-chain branched semantics)
- `tests/chapter-02/rerun-feedback-arg.mjs` · two-shape verification for `feedback` runtime arg plumbing
- `tests/chapter-02/bell-realtime.mjs` · Playwright harness for the five-gate Realtime + state-machine acceptance

Step 7 verification harness suite total: 3 new. Combined with steps 6 + 7: 8 harnesses available for chapter close + future regression.

## 5. Local cleanup performed in this PR

Per goal · "Local cleanup of completed-agent worktree branches ... Your call which is cleaner." Cleanup done in this PR commit:

- `git worktree remove -f -f` on four completed-agent worktrees under `.claude/worktrees/` (locked by harness; force-removed)
- `git branch -D` on four merged branches: `chapter-2/step-6a-lock-foundation`, `chapter-2/step-6c-reaper`, `chapter-2/step-6d-notification-bell`, `worktree-agent-a33648343fbc59dd4`
- Remaining `chapter-2/*` local branches: `chapter-2/step-4-code` (Chapter 2 historical · separate cleanup at chapter close), `chapter-2/step-7d-closure` (this branch).

## 6. PR #78 rerun-blocking bug · permanent reference

Captured in step 6 closure report §6: PR #78 (Agent Console code, 2026-05-16) shipped the `context.waitUntil` Edge bug that PR #86 fixed on 2026-05-19 for lock-foundation. The rerun path was incidentally fixed in PR #86. User impact during that window (2026-05-16 → 2026-05-19): Console rerun CTAs blocked on response for ~22 s. No data loss. Resolved.

Step 7A's rerun conformance pass verified that the post-PR-#86 rerun path returns 202 promptly + child fetch fires via `waitUntil`. No regression observed in the 10/10 rerun harness.

## 7. Out of scope · forward references

Items deferred to subsequent chapter steps:

- **Step 8** chain orchestration. Depends on step 6 lock-foundation refactor (shipped) + step 7 rerun conformance (shipped). Chain triggers fan out via the same `dispatch-pattern.js` helper.
- **Step 9** archive UI tree-view rendering. Surfaced as forward note during 7A · the v2-source phase produces branched chains shaped like `v1 → v2 → {v3, v4, v5, v6, v7, v8}`. The current Archive UI renders artifacts as a flat list ordered by version. Once branched chains hit real usage (not just verification harnesses), the Archive needs a tree visualization to surface the chain topology.
- **Step 13** Foundation `?upgrade=success` banner. Deferred from step 6.
- **Step 14** `/api/agents/dispatch.js` retirement. `/api/artifacts/[id]/regenerate.js` retired in step 7A; only the `dispatch.js` retirement remains for step 14.

## 8. Sign-off

Step 7 closes with all 11 acceptance gates green, three sub-PR cycles complete, one master-spec migration (015) landed, five forward notes captured, branch-state discipline pattern documented.

Per the autonomous-chain posture: this PR merges immediately. Step 8 spec opens next on branch `chapter-2/step-8-spec` per §13.8 forward references. Outline first, six adjudications surfaced, standard chapter rhythm resumes.
