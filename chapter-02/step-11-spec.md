# Chapter 2 · Step 11 spec · Archive tree-view (full)

Status: full spec. All six adjudications baked in (see §2 — five defaults accepted, one extension on call #1, one refined treatment on call #6). Outline file `chapter-02/step-11-outline.md` retained as historical record; this spec supersedes its endpoint default and refines the legacy-section treatment. Hold-open PR #130 stays on hold-gate until explicit release (or merges at step 11 close per established pattern).

Source authority: step 9 sequencing override + step 8 closure §3.4 (`chain_id` + `parent_artifact_id` primitives) + step 9 spec §2.2-2.3 (visual treatment + chain-root preferences) + step 10 closure forward references + Nizzar adjudication (this session).

Branch: `chapter-2/step-11-spec`.

---

## 1. Bundle framing

Step 11 ships the **archive UI tree-view** that surfaces the chain topology step 8 made queryable. The current `/archive` renders artifacts as a flat chronological list with no signal of which artifacts belong to which chain. With `chain_id` seeded at lock-foundation root and inherited down each chain hop (step 8), and `parent_artifact_id` carrying rerun + chain-branch lineage (step 7A + step 8), the archive can now render artifacts as chain-grouped trees · users see "this chain produced these N artifacts" at a glance.

Per the sequencing override at step 9, this deferred work resumes now. The visual treatment (depth-indented nested `qb-card`s), the chain root anchor (`Locked YYYY-MM-DD · N agents`), and the step 10 patterns (single-canonical-surface, bell-only Realtime indicator, harness-determinism) all carry forward and apply.

Three sources of work:

| Item | Source | Action |
| --- | --- | --- |
| `/api/artifacts` chain-traversal extension | Nizzar adj #1 | Extend existing endpoint, no new endpoint · `mode=chains` returns tree-shaped JSON |
| `archive.html` + `qb-archive.js` tree rendering | step 9 spec §2.2 + Nizzar adj #2 | Replace flat list with tree-only render. Earlier work section below. |
| Realtime extension to archive (inherited) | step 9 closure §3.1 + Nizzar adj #3 | Subscribe to shared `qb-realtime-manager.js`; refresh on notification |

§13 items unchanged · deferred out:

- Step 12 (TBD) · Foundation `?upgrade=success` banner OR dispatch retirement OR E2E QA · scope decided at step 11 close.
- Step 13+ · remaining `/api/agents/dispatch.js` retirement, E2E QA pass, final sign-off + `CHAPTER_02_COMPLETION.md`.
- **Synthetic chain_id backfill migration · LOGGED as chapter-3 candidate** per Nizzar adj #6. Not part of step 11. When it runs in chapter 3 it gets its own step, its own reproduction gate, its own human-eyes-on-SQL review (like migration 017 hotfix). Do not fold a data-backfill migration into a UI step.

Prerequisites met (carried from steps 6-10):
- `chain_id` + `chain_depth` + `parent_agent_slug` columns on `dispatch_jobs` (migration 016, step 8).
- `parent_artifact_id` column on `artifacts` (Chapter 1 + step 7A semantics).
- `qb-realtime-manager.js` shared singleton (step 9C).
- Chapter has stabilized: 8 surgical fixes total across steps 6-10, two clean steps in a row (9 + 10).

---

## 2. Adjudicated decisions · baked into this spec

Per Nizzar's six-point adjudication against `step-11-outline.md`:

### 2.1 EXTENSION (not new endpoint) · adj #1

**Decision:** Extend `/api/artifacts` with a `mode=chains` (or similar) query parameter that returns the tree-shaped JSON. No new `/api/chain-history` endpoint.

**Reasoning (Nizzar):** Single-canonical-surface discipline carried over from step 10 §3.2. Volume from call-5 (~5-20 chains under the 200-row cap) gives no performance case for endpoint isolation. One artifacts endpoint with two response shapes is cleaner than two endpoints with overlapping concerns.

**Implementation shape:**
- `GET /api/artifacts?mode=chains` returns `{ chains: [...], legacy: [...] }` tree shape
- `GET /api/artifacts` (existing default, no mode) returns the flat array unchanged for any callers that still depend on it (Chapter 1 legacy tools, etc.)
- RLS reasoning unchanged · the endpoint already filters by `auth.uid()` via JWT; the new mode just reshapes the same RLS-scoped rowset

### 2.2 Tree-only render · adj #2 default accepted

**Decision:** Archive renders tree-only after step 11. The flat-list rendering goes away entirely. No view-toggle.

**Reasoning (Nizzar):** The power-user who liked the flat list does not exist pre-launch · don't carry two render paths for a phantom preference. The tree IS the chronology, nested.

**Implementation shape:** `buildList()` in `qb-archive.js` is replaced by `buildChainTree()`. Filter affordances (phase filter) preserve their semantic role across the tree · filtering flattens the tree to matching nodes only.

### 2.3 Realtime subscription · adj #3 default accepted

**Decision:** Archive subscribes to the shared `qb-realtime-manager.js`. On `chain_ready` / `dispatch_failed` notification arrival, refetch `/api/artifacts?mode=chains` and re-paint the tree. Poll-fallback at 30s when manager state='poll'.

**Reasoning (Nizzar):** Archive stays consistent with bell + Phase view. One-line `mgr.onNotification` cost is worth the coherence.

**Implementation shape:** Same pattern as Phase view (`js/qb-agents-console.js` 9C wiring) and bell. Lazy-load `/js/qb-realtime-manager.js` before `qb-archive.js` in archive.html (the script already exists from step 9C; just include it).

### 2.4 In-flight chain rendering · adj #4 default accepted

**Decision:** Render in-flight chains as a tree showing delivered artifacts + pending placeholders for `queued` / `producing` agents that haven't finished. Status pill on the placeholder reads "Producing" or "Queued".

**Reasoning (Nizzar):** This is the weakest-persona moment that matters most · a user who just locked needs to see the chain producing, not a blank archive. Matches Phase view + bell semantics from step 9.

**Implementation shape:** The endpoint returns ALL artifacts for a chain (including `queued` + `producing`), not just `delivered`. Tree renderer paints status pill per node; in-flight nodes are click-disabled (no replay/artifact reading yet, no row href).

### 2.5 No pagination · adj #5 default accepted

**Decision:** Render all chains returned by the endpoint. No "Show more" CTA, no infinite scroll. Volume is under cap (~5-20 chains for typical users vs 200-row /api/artifacts cap).

**Reasoning (Nizzar):** Row-level pagination already deferred to chapter 3 unified design pass. Revisit chain-count pagination with real data if users hit the cap.

### 2.6 Earlier work section · adj #6 with two refinements

**Decision:** Default treatment (legacy section below chains) with two refinements:

1. **Copy: "Earlier work"** (not "Pre-chain history" · system vocabulary leaking; not "Chapter 1 artifacts" · build vocabulary leaking).
2. **Flat rows, no tree nesting, visible** (not an accordion · don't bury a new user's only artifacts).

The synthetic chain_id backfill migration (open call #6 option (c)) is **LOGGED as a chapter-3 candidate**. Not part of step 11. When it ships in chapter 3 it gets its own step, its own reproduction gate, its own human-eyes-on-SQL review (per the migration 017 security hotfix discipline). After it lands in chapter 3, the "Earlier work" section disappears and the UI collapses to one chain model permanently. That's the end state, reached the disciplined way.

**Implementation shape:**
- After all chain trees render, if any `legacy` artifacts exist in the endpoint response, render a section with:
  - Section header: `<h3 class="qb-archive-legacy-title">Earlier work</h3>`
  - Optional one-line subhead in QB voice (e.g., `"Artifacts from before chain history started tracking."`)
  - Flat rows below, same `createArtifactRow()` treatment as current archive
- Section is visible (not collapsed); no accordion behavior

---

## 3. Deliverable surfaces

### 3.1 `/api/artifacts` chain-traversal extension (11A)

Query parameter: `?mode=chains` (other modes possible later · for now just default + chains).

Response shape when `mode=chains`:

```jsonc
{
  "ok": true,
  "chains": [
    {
      "chain_id": "uuid",
      "root_dispatch_id": "uuid",
      "lock_at": "iso8601",
      "agents_count": 4,
      "nodes": [
        {
          "agent_slug": "soul_map_synthesizer",
          "artifacts": [
            {
              "id": "uuid",
              "version": 1,
              "status": "delivered",
              "delivered_at": "iso8601",
              "title": "Soul Map · v1"
            }
          ],
          "children": [/* recursive nodes for parent_artifact_id-linked branches */]
        }
      ]
    }
  ],
  "legacy": [
    {
      "id": "uuid",
      "artifact_type": "string",
      "version": 1,
      "status": "delivered",
      "created_at": "iso8601",
      "title": "..."
    }
  ]
}
```

Endpoint logic:
1. Read all artifacts for `auth.uid()` (RLS-scoped, already in place)
2. Join to `dispatch_jobs` on `dispatch_id` to get `chain_id` + `lock_at` (from kind='lock' rows)
3. Group artifacts by `chain_id`; chain_id IS NULL goes to `legacy`
4. Within each chain, sort artifacts by `delivered_at` (with `parent_artifact_id` linkage for branched reruns)
5. Build the nested `children` structure from `parent_artifact_id` relationships
6. Return `{ ok, chains, legacy }`

Existing `GET /api/artifacts` (no `mode`) returns the same flat-array shape it does today · zero breaking change for Chapter 1 legacy tool callers.

### 3.2 `archive.html` + `qb-archive.js` tree rendering (11B)

**Client load sequence in `archive.html`:**
- Load `/js/qb-realtime-manager.js` before `/js/qb-archive.js` (already in `/agents` flow from step 9C; add to archive.html `<head>`)
- `load()` calls `fetch('/api/artifacts?mode=chains', ...)` instead of the existing flat fetch
- Hands the tree-shaped response to a new `renderArchiveTree()` export

**New `qb-archive.js` exports:**
- `renderArchiveTree(container, response, opts)` · top-level
- `buildChainCard(chain)` · per-chain `qb-card` with header + nested artifact rows
- `buildEarlierWork(legacyArtifacts)` · "Earlier work" section with flat rows

**Visual treatment:**
- Each chain renders as a `qb-card` with offset shadow (per Design System v3.3)
- Header: phase-discovery accent · `qb-tag` "Chain" + Fraunces headline `Locked 2026-05-15 · 4 agents` + meta line with `lock_at` relative time
- Body: depth-indented rows · agent display name + version + status pill + click-through to `/artifact/[id]` (existing behavior; rerun stays on Phase view per single-canonical-surface)
- In-flight nodes: status pill "Producing" or "Queued", row click-disabled, neutral color
- Branched reruns (rows with `parent_artifact_id`): visually nested as children of their parent artifact via padding-left indentation

**Earlier work section:**
- Renders after all chain cards if `legacy.length > 0`
- Section header `<h3>Earlier work</h3>` + one-line subhead
- Each legacy artifact as a single `createArtifactRow()` (existing helper, no nesting)

**Filter behavior:**
- Existing phase filter stays. When a phase filter is active, the tree flattens to matching nodes only · chains with zero matching artifacts collapse out. Empty-state copy if no matches.

### 3.3 Realtime subscription on archive (11B)

Same pattern as Phase view in `js/qb-agents-console.js` (step 9C):

```js
const mgr = window.QBRealtimeManager;
if (mgr && session?.token) {
  mgr.start({ authToken: session.token });
  mgr.onNotification(() => refetchAndRepaintArchive());
  mgr.onState(s => {
    if (s === 'realtime') { /* clear poll */ }
    else if (s === 'poll') { /* set 30s poll */ }
  });
}
```

`refetchAndRepaintArchive()` re-fetches `/api/artifacts?mode=chains` and re-paints via `renderArchiveTree()`. Idempotent guard via `refetchInFlight` flag (same pattern as Phase view).

### 3.4 Verification harness · `tests/chapter-02/archive-tree.mjs` (11C)

5-gate Playwright harness:

1. **Archive renders chain-grouped tree.** Test user with foundation locked + at least one delivered chain → one chain card with delivered artifact rows present.
2. **Branched reruns render as nested children.** Seed a v1 + v2 artifact pair (v2 has `parent_artifact_id=v1.id`) → v2 renders as a visual child of v1.
3. **Earlier work section surfaces legacy artifacts.** Seed a legacy artifact (no `chain_id` on its dispatch) → section labeled "Earlier work" appears below chains with the legacy row.
4. **In-flight chain renders placeholder for queued agent.** Seed a chain with 1 delivered + 1 queued artifact → both render; queued has status pill "Queued".
5. **Realtime live-update.** Notification INSERT triggers re-fetch + re-paint within 5s.

**Harness-determinism pattern (from step 10 §3.6):** wait for `.qb-notification-bell[data-mounted="true"]` AND `data-realtime="true"` before any tree-view assertions. Mandatory baseline for any harness against a Realtime-aware surface.

---

## 4. Sub-PR breakdown

| Sub-PR | Topic |
| --- | --- |
| 11A | `/api/artifacts?mode=chains` extension + smoke verification (smoke harness or curl-based inspection) |
| 11B | `archive.html` script-load update + `qb-archive.js` tree rendering (replaces `buildList`) + Earlier work section + Realtime subscription |
| 11C | `tests/chapter-02/archive-tree.mjs` · 5-gate Playwright harness |
| 11D | Step 11 closure report · confirms step 12 outline scope OR chapter-2 close report |

Each sub-PR gates on the prior. Per autonomous-chain posture, sub-PRs merge autonomously after their gates pass.

**Branch-state discipline reminder (post step-11-outline breach):** `git branch --show-current` before every commit. The cherry-pick + `reset --hard origin/main` recovery pattern only works because origin stays clean.

---

## 5. Acceptance criteria

1. **`/api/artifacts?mode=chains` returns the documented tree shape.** Chain rows grouped by `chain_id`, legacy rows separated, JSON shape matches §3.1.
2. **Archive renders chain-grouped tree.** Each chain is a `qb-card` with header + nested rows. Branched reruns nest correctly via `parent_artifact_id`.
3. **In-flight chains render with placeholders.** Queued / producing agents render with status pill + click-disabled state.
4. **Earlier work section surfaces legacy artifacts.** Section labeled "Earlier work" appears below chains when legacy artifacts exist. Flat rows, visible (not collapsed).
5. **Realtime live-update inherited cleanly.** Notification INSERT triggers re-fetch + re-paint within 5s. Bell `data-realtime` remains the canonical Realtime indicator.

---

## 6. Out of scope

Explicit:

- Pagination + filtering at the artifact row level (chapter 3+ per master spec).
- Drag-to-reorganize, inline rerun CTAs (post-launch; rerun stays on Phase view per step 10 §3.2 single-canonical-surface discipline).
- Per-chain annotation editing (post-launch enhancement).
- DAG view of the chain dependency graph (master spec §14.3 explicit out-of-scope for chapter 2).
- **Synthetic chain_id backfill migration** (per Nizzar adj #6 · chapter-3 candidate, gets its own step + reproduction gate + SQL review).
- View-toggle between tree + flat list (per Nizzar adj #2 · no phantom-preference scaffolding).
- "Live" pill on archive (per step 10 §3.3 · bell-only Realtime indicator pattern).
- Foundation `?upgrade=success` banner (deferred to next step).
- `/api/agents/dispatch.js` retirement (later).
- Full WCAG accessibility audit on the new tree-view DOM (step 15 E2E QA).

---

## 7. Forward references (renumbered after step 11 ships)

- **Step 12 (next, scope TBD at step 11 close)** Foundation `?upgrade=success` banner OR `/api/agents/dispatch.js` retirement OR E2E QA, depending on bundling decision.
- **Step 13** (whatever isn't in step 12).
- **Step 14** End-to-end QA pass.
- **Step 15** Final sign-off + `CHAPTER_02_COMPLETION.md`.
- **Chapter 3 first step** Bracketed hardening sub-PR (per step 8 + step 10 closure recommendations).
- **Chapter 3 candidate work** Synthetic chain_id backfill migration (per Nizzar adj #6) · own step, own reproduction gate, own SQL review.

---

## 8. Captures for the step 11 closure report

Carryforward + new:

- **Framework defect-rate continuation.** Aggregate across chapter 2. Step 11 expected outcome: zero or minimal surgical fixes given chapter has stabilized (8/12 running total).
- **Step 12 scope confirmation.** Step 11 closure decides whether step 12 is Foundation banner, dispatch retirement, or E2E QA. Likely Foundation banner + dispatch retirement bundled (both small) leaving step 13 = E2E QA + step 14 = sign-off.
- **Tooling discipline** (carryforward · permanent). Comet operator-only.
- **Conformance-audit-pattern** (carryforward). May not apply to step 11 since this IS a new build, not an audit step.
- **Single-canonical-surface discipline** (carryforward · reinforced by adj #1 endpoint-extension and adj #2 tree-only render).
- **Bell-only Realtime indicator pattern** (carryforward · reinforced by adj #3 sticking with shared manager).
- **Harness-determinism pattern** (carryforward · applied to 11C harness mandatorily).
- **Branch-state verification discipline** (REINFORCED · the step-11-outline branch landed on local main, recovered via cherry-pick + reset · `git branch --show-current` before every commit · reset works only because origin stays clean).
- **Vocabulary discipline** (NEW · candidate). Adj #6 rejected "Pre-chain history" (system vocabulary) and "Chapter 1 artifacts" (build vocabulary). Capture: user-facing copy should not leak internal system/build vocabulary. Each candidate string runs the QB voice test before shipping.
- **Backfill-migration discipline** (NEW · candidate). Adj #6 rejected folding the backfill into step 11. Capture: data-backfill migrations get their own step + reproduction gate + SQL review · they do NOT ride along inside UI steps.

---

## 9. End of spec

Hold-open PR #130 stays on hold-gate until step 11 close (per established pattern · spec PR merges at chapter rhythm closeout). Autonomous chain resumes IMMEDIATELY with sub-PR 11A per the user's "Hold released" directive.
