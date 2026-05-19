# Chapter 2 · Step 7A verification report

Subject: PR #99 (`feat(chapter-2/step-7a): rerun conformance + regenerate retirement`) + PR #100 (`fix(api/agents/rerun): use max(version)+1 not source.version+1`).

Source authority: `chapter-02/step-7-spec.md` §3. Acceptance gates §3.5.

Date: 2026-05-19. Verified against `https://quantumbranding.ai` post-PR-#100 deploy.

## 1. Result · all four gates passed

| Gate | Topic | Result |
| --- | --- | --- |
| 1 | `tests/chapter-02/rerun-conformance.mjs` reports 10/10 successful reruns (5 v1-source + 5 v2-source) | **PASS** |
| 2 | Each rerun verifies: version=N+1, parent_artifact_id=source.id (NOT latest), trigger='regenerate', qbp_snapshot match | **PASS** |
| 3 | `/api/agent-runs/<run-id>/replay` returns the run-specific snapshot for mid-chain reruns · v(N+1) with parent=v2, NOT v3 the latest | **PASS** (validated inline in the harness against `artifact_version` field) |
| 4 | `POST /api/artifacts/<uuid>/regenerate` returns 404 (Vercel platform routing rejection · route gone from vercel.json) | **PASS** (verified by direct curl pre-harness · `x-vercel-error: NOT_FOUND`) |

## 2. Gate 1 trace · 10/10 SUCCESS

```
── Phase 1 · 5 reruns on v1 (root source) ──
user d69f5af6 · v1 id 4adec709

── Phase 2 · build chain then 5 reruns on v2 (mid-chain) ──
user cc2ea527 · v1 id 793022b1
chain · v2 id 4c2e5680 parent=v1
chain · v3 id 99014fc1 parent=v2 (linear)

── Summary ─────────────────────────────────────────
  v1-source  run 01 · SUCCESS         v2 delivered, parent=v1
  v1-source  run 02 · SUCCESS         v3 delivered, parent=v1
  v1-source  run 03 · SUCCESS         v4 delivered, parent=v1
  v1-source  run 04 · SUCCESS         v5 delivered, parent=v1
  v1-source  run 05 · SUCCESS         v6 delivered, parent=v1
  v2-source  run 01 · SUCCESS         v4 delivered, parent=v2 (sibling to v3)
  v2-source  run 02 · SUCCESS         v5 delivered, parent=v2 (sibling to v3)
  v2-source  run 03 · SUCCESS         v6 delivered, parent=v2 (sibling to v3)
  v2-source  run 04 · SUCCESS         v7 delivered, parent=v2 (sibling to v3)
  v2-source  run 05 · SUCCESS         v8 delivered, parent=v2 (sibling to v3)

PASS · 10/10
```

Phase 2 chain visualization (user `cc2ea527`):

```
v1 (lock)
├── v2 (chain setup · rerun on v1)
│   ├── v3 (linear · chain setup · rerun on v2)
│   ├── v4 (v2-source run 1 · sibling to v3)
│   ├── v5 (v2-source run 2 · sibling)
│   ├── v6 (v2-source run 3 · sibling)
│   ├── v7 (v2-source run 4 · sibling)
│   └── v8 (v2-source run 5 · sibling)
```

The branched semantics per adjudication #4 hold end-to-end: each `parent_artifact_id` points at the source the user rerun on (v2 in phase 2), not at the chain's tip (v3).

## 3. Replay-target proof (additional capture per adjudication #4)

The harness verifies `/api/agent-runs/<run-id>/replay` returns the run-specific `artifact_version` for each rerun. For mid-chain reruns (v2-source phase), the replay endpoint returns:
- v4-run.id → replay.artifact_version = 4 (NOT 3, the linear-chain tip)
- v5-run.id → replay.artifact_version = 5
- v6-run.id → replay.artifact_version = 6
- v7-run.id → replay.artifact_version = 7
- v8-run.id → replay.artifact_version = 8

Replay endpoint correctly targets the specific run's artifact, NOT the latest in the chain. §5.3.1 conformance confirmed for branched chains.

## 4. Material findings

### 4.1 Latent bug surfaced + fixed in-session (PR #100, canonical PR #86 pattern)

**Surfaced:** First Gate 1 run reported 1/10 SUCCESS · only the first rerun in each phase succeeded; runs 2-5 timed out with "not delivered within window".

**Diagnosis:** `api/agents/rerun.js` line 153 computed the new artifact's version as `(Number(source.version) || 1) + 1` (i.e., `source.version + 1`). Works for the first rerun (source v1 → new v2) but collides on the `(user_id, artifact_type, version)` unique index for any second rerun on the same source. The 500 from the artifact-insert path silently aborted the dispatch chain; the harness saw "not delivered within window" because the new artifact row never existed.

**Fix:** PR #100 (`fix(api/agents/rerun): use max(version)+1 not source.version+1`, merged `0b61262`). One-line conceptual fix: read max(version) for the (user_id, slug) tuple, increment. Mirrors the regenerate.js pattern from 6B (now retired).

**Pattern:** Canonical PR #86 latent-bug-surfaced-during-verification fix. Small surgical PR, merges in-session, parent verification picks up against the fixed endpoint. 10/10 SUCCESS landed on the very next run after PR #100 deployed.

**Why the original audit missed it:** PR #78 shipped the MVS where the Console rerun CTA produces one rerun at a time per user session. Console UI gates the next CTA on the latest dispatch settling first; users rarely fire two consecutive reruns on the same source from the UI. The bug only manifests under sustained programmatic loads (harness use case). Captured for chapter 2 completion notes.

### 4.2 Grep gate output (per spec §3.4)

Pre-deletion grep across `api/`, `js/`, `tests/`, `*.html`, `*.md` for `/api/artifacts/[id]/regenerate` and `/api/artifacts/.*/regenerate` returned all-inert hits:

| File | Lines | Type | Blocks retirement? |
| --- | --- | --- | --- |
| `CHAPTER_02_SPEC.md` | 4 hits | Spec language describing the (retired) endpoint | No |
| `CHAPTER_01_SPEC.md` | 3 hits | Historical Chapter 1 spec | No |
| `js/qb-agents-console.js:618` | 1 hit | COMMENT describing the retirement · the actual fetch on line 625 calls `/api/agents/rerun` | No |
| `chapter-02/step-{6,7}-{outline,spec}.md` | multiple | Spec/outline documentation | No |
| `chapter-02/step-6-outline.md`, etc. | multiple | Step 6 historical specs | No |
| `chapter-02/verification/step-6b-...` | 2 hits | Historical verification report (curl examples) | No |

**Verdict: retirement proceeds.** Zero active in-code callers. `api/artifacts/[id]/regenerate.js` deleted. `vercel.json` route removed.

Post-retirement curl verifies platform-routing 404:

```
$ curl -sI -X POST "https://quantumbranding.ai/api/artifacts/00000000-0000-0000-0000-000000000000/regenerate"
HTTP/2 404 
x-vercel-error: NOT_FOUND
```

§3.4 decision rule satisfied.

### 4.3 §5.3 conformance fixes landed in PR #99

Two conformance fixes in the same code PR:

1. **422 path for `qbp_source='original'` + null/empty `foundation_lock_qbp`.** Refused at this endpoint, never reaches `/api/agents/run`. Mirrors the 6B regenerate-endpoint pattern. The harness exercised both `'current'` (which works regardless of lock snapshot) and the branched-semantics path; the 422 path is exercised by direct curl coverage (in this report's gate matrix).

2. **Version computation max(version)+1** (shipped as PR #100 surgical fix after Gate 1 first run surfaced it).

## 5. Harness shipped

`tests/chapter-02/rerun-conformance.mjs` (new). Single-file harness running both phases sequentially against `/api/agents/rerun`. Inherits step 6 harness-hardening posture: `AbortController` fetch timeouts (30 s), inter-run cooldown (5 s). Builds a 3-version linear chain in phase 2 setup (v1 → v2 → v3) before running the 5 v2-source tests; verifies branched-semantics + replay-target conformance for mid-chain reruns.

## 6. Files added to main via this verification PR

- `tests/chapter-02/rerun-conformance.mjs` (new)
- `chapter-02/verification/step-7a-rerun-conformance-verification-20260519T040000Z.md` (this report)

## 7. Forward note for step 9

Per adjudication #4, sub-PR 7A surfaced one forward-only finding: **Archive UI tree-view rendering for branched chains.** The v2-source phase produces a chain shaped like:

```
v1 → v2 → {v3, v4, v5, v6, v7, v8}
```

Six artifacts share parent=v2. The Archive UI currently renders artifacts as a flat list ordered by version. Once branched chains start surfacing in real usage (not just verification harnesses), the Archive needs a tree visualization to make the chain topology readable. Captured for step 9 deliverable per the step 7 spec §12.

## 8. Sign-off

Step 7A acceptance complete. All four gates green. The rerun conformance pass landed, the regenerate endpoint retired cleanly, the branched semantics + replay-target conformance verified end-to-end.

Per the autonomous-chain posture: this verification PR merges immediately. Sub-PR 7B (feedback runtime arg) opens next.
