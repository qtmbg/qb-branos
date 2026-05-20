# Chapter 2 · Step 11 spec outline · SUPERSEDED

> **Status: superseded by `step-11-spec.md` after Nizzar adjudication.** Five defaults accepted, one extension on call #1 (extend `/api/artifacts` rather than new endpoint), one refinement on call #6 ("Earlier work" copy + flat visible rows + backfill migration logged as chapter-3 candidate). See `step-11-spec.md` for the canonical step 11 specification.
>
> Retained below as historical record of the pre-adjudication framing.

---

Status: draft outline. Awaiting Nizzar adjudication on the open calls in §5 below. Full spec follows on the same branch once the outline lands.

Source authority: step 9 sequencing override (archive tree-view deferred from step 9) + step 8 closure §3.4 (chain_id + parent_artifact_id primitives) + step 9 spec §2.2-2.3 (visual treatment + chain-root preferences captured) + step 10 closure §6 forward reference.

Branch: `chapter-2/step-11-spec`. PR opens on a hold gate until the outline is approved.

---

## 1. Bundle framing

Step 11 ships the **archive UI tree-view** that surfaces the chain topology step 8 made queryable. The flat-list rendering at `/archive` currently shows artifacts in chronological order with no signal of which artifacts belong to which chain. With chain_id seeded at lock-foundation root and inherited down each chain hop (step 8), and `parent_artifact_id` carrying rerun + chain-branch lineage (step 7A + step 8), the archive can now render artifacts as chain-grouped trees · users can see "this chain produced these N artifacts" at a glance.

The step 9 sequencing override deferred this work because surface order needed to mirror user value order · Phase view (action) shipped first. Now that step 10 closed the action + audit + replay loop, the back-of-house chain visualization becomes the appropriate next step.

Three sources of work:

| Item | Source | Action |
| --- | --- | --- |
| `/api/chain-history` endpoint (or extension) | step 9 spec §2.2 deferred | RLS-scoped GET returning chain-tree JSON |
| `archive.html` + `qb-archive.js` tree rendering | step 9 spec §2.2 + visual prefs §2.2-2.3 | Replace flat list with chain-grouped tree |
| Realtime extension to archive (inherited from 9C) | step 9 closure §3.1 canonical pattern | Subscribe to shared manager; refresh on notification |

§13 items unchanged · deferred out:

- Step 13 · Foundation `?upgrade=success` banner.
- Step 14 · `/api/agents/dispatch.js` retirement.
- Pagination + filtering on archive at the row level (chapter 3+ unified design pass).
- Drag-to-reorganize, inline rerun CTAs (post-launch enhancements; rerun stays on Phase view per single-canonical-surface discipline from step 10 §3.2).

Prerequisites met (carried from steps 6-10):
- `chain_id` + `chain_depth` + `parent_agent_slug` columns on `dispatch_jobs` (migration 016, step 8).
- `parent_artifact_id` column on `artifacts` (Chapter 1 + step 7A semantics).
- `qb-realtime-manager.js` shared (step 9C).
- Run history view + replay panel locked (step 10).

---

## 2. Adjudications carried forward from step 9 + step 10

These preferences were captured during prior adjudications and apply directly to step 11:

- **Step 9 §2.2 visual treatment preference:** depth-indented nested `qb-card`s. Simplest treatment for the weakest persona (Blank Slate, first chain). Carried forward as the default for step 11 unless overridden.

- **Step 9 §2.3 chain root anchor preference:** `lock_at` + `"Locked YYYY-MM-DD · N agents"` as the visual root anchor for each chain. Carried forward as default.

- **Step 10 §3.2 single-canonical-surface discipline:** rerun stays on Phase view. Archive rows route to the artifact reading surface (`/artifact/[id]`) for consumption; no rerun CTAs in archive rows.

- **Step 10 §3.3 bell-only Realtime indicator:** no per-surface "Live" pill on archive. Bell carries the canonical signal.

- **Step 10 §3.6 harness-determinism pattern:** step 11 verification harness will wait for bell-mounted + `data-realtime='true'` before any view-interaction assertions.

---

## 3. Deliverable surfaces

### 3.1 `/api/chain-history` endpoint (or `/api/artifacts` extension)

Default outline (open call #1): new GET endpoint `/api/chain-history` returning RLS-scoped chain-tree JSON:

```jsonc
{
  "chains": [
    {
      "chain_id": "uuid",
      "root_dispatch_id": "uuid",
      "lock_at": "iso8601",
      "agents_count": 5,
      "nodes": [
        {
          "agent_slug": "soul_map_synthesizer",
          "artifacts": [{ "id", "version", "status", "delivered_at" }],
          "children": []
        }
      ]
    }
  ],
  "legacy": [
    { "agent_slug": "...", "artifacts": [...] }
  ]
}
```

Endpoint logic: query `artifacts` joined to `dispatch_jobs` on `dispatch_id`, group by `chain_id`, nest by `parent_artifact_id`. Returns the full tree in one round-trip. No pagination at this step (chain depth caps at 8 via step 8 framework guardrail; agent count per chain ~5-10; branched reruns rare).

Override (open call #1): extend `/api/artifacts` to include `chain_id` + `parent_artifact_id` + `dispatch_kind` fields, group client-side. Lighter API surface, more client logic.

### 3.2 `archive.html` + `qb-archive.js` tree rendering

Replace the flat-list `buildList()` with `buildChainTree()`. Each chain renders as a `qb-card` with:
- Header: `qb-tag` "Chain" + Fraunces title `"Locked 2026-05-15 · 5 agents"` + duration metadata
- Body: depth-indented nested rows, one per delivered artifact, with status pill + version + click-through to the artifact reading surface
- Branched reruns render as visual children of their parent artifact (using `parent_artifact_id` linkage)

Legacy section (chapter 1 artifacts, no `chain_id`) renders below the chain section under a sub-heading. Default copy per open call #6.

Filter affordances (existing in `qb-archive.js`) preserve their semantic role: filtering by phase still works against the flattened set; the tree-view is the default presentation, filter is a power-user override.

### 3.3 Realtime extension to archive

Archive subscribes to the shared `qb-realtime-manager.js` (per step 9C canonical pattern). On `chain_ready` notification arrival, refetch `/api/chain-history` and re-paint the tree. Poll-fallback at 30s when manager state='poll'.

The archive's Realtime hook is identical in pattern to Phase view + run history view · same `mgr.onNotification(refetchAndRepaint)` registration, same `mgr.onState` handling. This is exactly the pattern step 9 closure §3.1 named as the architectural payoff.

### 3.4 Verification harness · `tests/chapter-02/archive-tree.mjs`

5-gate Playwright harness covering:
1. Archive renders chain-grouped tree (one chain with delivered artifacts → one tree card)
2. Branched reruns render as visual children of their parent artifact
3. Legacy artifacts (no `chain_id`) surface in the dedicated section
4. Empty-state copy for brand-new user (no foundation locked yet)
5. Realtime live-update on archive · notification INSERT triggers re-paint within 5s

Harness inherits step 10 §3.6 harness-determinism pattern: wait for bell-mounted + `data-realtime='true'` before view assertions.

---

## 4. Sub-PR breakdown

Step 11 is moderate-scope (new endpoint + meaningful client rewrite). Proposed phasing:

| Sub-PR | Topic |
| --- | --- |
| 11A | `/api/chain-history` endpoint (or `/api/artifacts` extension, per open call #1) + smoke harness |
| 11B | `archive.html` + `qb-archive.js` tree rendering (replaces `buildList`) + legacy section + Realtime subscription |
| 11C | `tests/chapter-02/archive-tree.mjs` 5-gate Playwright harness |
| 11D | Step 11 closure report |

Each sub-PR gates on the prior. Per autonomous-chain posture, sub-PRs merge autonomously after their gates pass.

---

## 5. Six open calls for Nizzar adjudication

1. **Endpoint shape · new `/api/chain-history` vs extend `/api/artifacts`.** Default: new endpoint, returns the structured tree JSON shape in §3.1 above. Override: extend `/api/artifacts` to include `chain_id` + `parent_artifact_id` + `dispatch_kind` fields, group client-side. New endpoint = cleaner separation, easier RLS reasoning. Extension = lighter API surface, more client work.

2. **Backward compatibility · tree-only vs dual-mode toggle.** Default: archive renders tree-only after step 11. The flat-list rendering goes away entirely. Override: add a view-toggle (similar to the run history / phase view toggle on `/agents`) so users can switch between tree and flat list. More code, more state to maintain, slightly more flexibility for power users who liked the chronological flat list.

3. **Realtime updates on archive.** Default: subscribe to shared manager, refresh on notification arrival, poll-fallback at 30s. Free inheritance from step 9C, no new wiring beyond the consumer-side hook. Override: refresh-only (no Realtime) since archive is read-mostly. The mgr.onNotification registration is one line of code; cost is negligible. Default favors consistency.

4. **In-flight chain rendering.** Default: render in-flight chains as a tree showing delivered artifacts + pending placeholders (status pill = "Producing" or "Queued") for downstream agents that haven't finished. Override: only render chains where ALL agents have delivered (cleaner UI, no in-flight noise). Default favors showing live state · matches the Phase view + bell semantics from step 9.

5. **Pagination on chain count.** Default: render all chains returned by the endpoint (200-row /api/artifacts cap means ~5-20 chains for typical users). No "Show more" CTA. Override: paginate at 10 chains with infinite-scroll or "Show more" CTA · necessary only if real users hit the cap. Master spec defers row-level pagination to chapter 3; this is chain-count pagination, slightly different.

6. **Legacy-artifact section heading + treatment.** Default: section labeled `"Pre-chain history"` below the chain section, sub-headed, same row treatment as before (each legacy artifact as a single row, no tree nesting). Override options: (a) "Older work" or "Chapter 1 artifacts" copy variants; (b) collapsed accordion (cleaner main view, click to expand); (c) backfill migration that assigns a synthetic chain_id to all chapter-1 artifacts per user (cleaner data model, one-time migration cost).

---

## 6. Out of scope

Explicit:

- Pagination + filtering at the artifact row level (chapter 3+ per master spec).
- Drag-to-reorganize, inline rerun CTAs (post-launch; rerun stays on Phase view).
- Per-chain annotation editing (post-launch enhancement).
- DAG view of the chain dependency graph (master spec §14.3 explicit out-of-scope for chapter 2 · this is a tree view of EXECUTION history, not dependency design).
- Backfill migration for legacy artifacts (open call #6 override option, not default).
- Foundation `?upgrade=success` banner (step 13).
- `/api/agents/dispatch.js` retirement (step 14).
- Full WCAG accessibility audit on the new tree-view DOM (step 15 E2E QA).

---

## 7. Forward references

- **Step 13** Foundation `?upgrade=success` banner.
- **Step 14** `/api/agents/dispatch.js` retirement.
- **Step 15** End-to-end QA pass · full WCAG accessibility audit lives here.
- **Step 16** Final sign-off + `CHAPTER_02_COMPLETION.md`.
- **Chapter 3** Bracketed hardening sub-PR at first step (per step 8 + step 10 closure recommendations); unified pagination + filtering design pass; potential `artifact_delivered` notification kind.

---

## 8. End of outline

Hold-open PR opens on this branch. Awaiting adjudication on §5 open calls. Full spec follows in a second commit on the same branch.
