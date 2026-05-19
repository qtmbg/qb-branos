# Chapter 2 · Step 9 spec outline · SUPERSEDED

> **Status: superseded by `step-9-spec.md` after Nizzar adjudication.** This outline defaulted to archive UI tree-view as the step 9 scope. Open call #1 (sequencing) was OVERRIDDEN · step 9 instead ships the Agent Console Phase view per master spec §13.10. Open call #5 (Realtime on the surface) was OVERRIDDEN · Realtime is enabled for the Phase view via the bell's existing channel. Calls #2/#3 captured as preferences for whenever archive tree-view ships. Call #4 reframed for Phase view scope. Call #6 moot for Phase view. See `step-9-spec.md` for the canonical step 9 specification.
>
> Retained below as historical record of the pre-adjudication framing.

---

Status: draft outline. Awaiting Nizzar adjudication on the open calls in §5 below. Full spec follows on the same branch once the outline lands.

Source authority: `CHAPTER_02_SPEC.md` §13.10 (canonical sequencing) + step 7 closure §7 forward note + step 8 closure §6 forward note (chapter-mid-flight scope evolution).

Branch: `chapter-2/step-9-spec`. PR opens on a hold gate until the outline is approved.

---

## 1. Bundle framing

Step 9 surfaces the chain topology that step 8 made queryable. With `chain_id` seeding at lock-foundation root and inheriting down each chain hop, the archive surface can now render artifacts as **chain-grouped trees** instead of the current flat-list-by-version. Branched reruns (`parent_artifact_id` semantics from step 7A) become visual sub-trees within their parent chain.

This is a chapter-mid-flight scope evolution: master spec §13 sequencing has step 10 as the Agent Console Phase view. The archive tree-view was surfaced as a forward note across steps 7+8 closures because the chain_id primitive made it obvious that the existing flat archive renders chain topology unreadably. Open call #1 below surfaces this sequencing tension for adjudication.

Three sources of work:

| Item | Source | Action |
| --- | --- | --- |
| Archive UI tree rendering | Step 8 closure §6 forward note | Replace flat list with chain_id-grouped tree |
| Chain-history query API | Step 8 chain_id primitive | New GET endpoint returns chain-tree JSON for a user |
| Legacy-artifact accommodation | Chapter 1 artifacts have no chain_id | Render as flat list under a "Pre-chain history" section |

Prerequisites met (carried from step 8):
- Migration 016 chain columns shipped + verified.
- `chain_id` tree-grouping verified end-to-end (5/5 PASS in 8C harness).
- Branched-rerun semantics (`parent_artifact_id`) verified in step 7A.

---

## 2. Deliverable surfaces

### 2.1 Archive UI tree-view rendering · `archive.html`

Default outline: replace the existing flat-list rendering with a grouped-tree view. Each top-level group is a `chain_id`. Within a chain, each agent's delivered artifacts render as nested nodes ordered by version. Branched reruns (rows with `parent_artifact_id != null`) render as visual children of their parent.

Visual treatment options surfaced in open call #2 below. Default: depth-indented nested cards using the existing `qb-card` system. The tree is read-only at this step (no drag-to-reorganize, no inline rerun CTAs · those remain on the per-artifact reading surface).

Chapter 1 legacy artifacts (no `chain_id`) render in a separate section labeled "Pre-chain history" below the chain-grouped section. Visual treatment open in call #4.

### 2.2 Chain-history query endpoint · `/api/chain-history`

New GET endpoint, RLS-scoped to caller. Returns a chain-tree JSON shape:

```json
{
  "chains": [
    {
      "chain_id": "uuid",
      "root_dispatch_id": "uuid",
      "lock_at": "iso8601",
      "nodes": [
        { "agent_slug": "...", "artifacts": [{...}, {...}], "children": [{...}] }
      ]
    }
  ],
  "legacy": [
    { "agent_slug": "...", "artifacts": [...] }
  ]
}
```

Endpoint logic: query `artifacts` joined to `dispatch_jobs` on `dispatch_id`, group by `chain_id`, nest by `parent_artifact_id`. Returns the full tree in one round-trip · no pagination at this step (chain depth caps at 8, agent count ~10, branched reruns expected to be rare). Pagination open call deferred to step 10 if real volume surfaces.

### 2.3 Archive client wiring · fetch + render + reduced-motion + empty state

`archive.html` calls `/api/chain-history` on mount, renders the chain-grouped tree, falls back to existing flat-list on endpoint error. Empty state copy per the QB voice surface ("Nothing chained yet. Run a Phase 01 exercise to build your first chain."). Reduced-motion respected on any tree-expand animations.

---

## 3. Sub-PR breakdown

Step 9 is moderate-scope. Proposed phasing:

| Sub-PR | Topic |
| --- | --- |
| 9A | `/api/chain-history` endpoint + RLS verification + harness |
| 9B | `archive.html` tree rendering + reduced-motion + empty state |
| 9C | Verification harness · chain-grouped render PASS, legacy section PASS, empty state PASS |
| 9D | Step 9 closure report |

Each sub-PR gates on the prior. Per autonomous-chain posture, sub-PRs merge autonomously after their gates pass.

---

## 4. Acceptance criteria

Per chain-history surface goals (no §11 entry yet · proposed):

1. **Chain-history endpoint returns correctly nested tree** · for a test user with 1 completed lock chain + 1 chain-test-agent fire, the response groups all five agents under one `chain_id`, with chain_test_agent as a child of its upstream deps.
2. **Branched-rerun sub-trees render correctly** · for a test user with a rerun on a mid-chain v2 producing v3-v8, the tree shows v1→v2→{v3,v4,v5,v6,v7,v8} under the correct chain root.
3. **Legacy artifacts surface in dedicated section** · chapter-1 legacy artifacts (no chain_id) render under "Pre-chain history" below the chain section.
4. **Empty state passes** · brand-new user with no artifacts shows the empty-state copy + Phase 01 CTA.
5. **No regression on existing archive surfaces** · per-artifact reading view still loads, rerun CTAs still fire, the archive route still serves under the same auth gate.

---

## 5. Six open calls for Nizzar adjudication

1. **Sequencing tension · step 9 = archive tree-view vs master spec §13.10 = Agent Console Phase view.** Default outline ships the archive tree-view because steps 7+8 forward notes consistently flagged it as the next obvious surface, AND step 8's chain_id primitive makes the data shape queryable. Override: defer the tree-view to a later step and ship the Agent Console Phase view next per master sequencing (this is a more substantial surface · 4 Phase 02-05 cards as locked rows, two-button rerun semantics on prior-delivered agents, Console state machine integration with the bell). Either path closes a real surface; the question is which carries more chapter-leverage now.

2. **Tree visual treatment.** Default: depth-indented nested `qb-card`s. Two more complex options surfaced: (a) actual SVG tree with connector lines (highest visual fidelity but most code), (b) collapsible nested accordion (medium fidelity, requires expand-state localStorage persistence). For the weakest persona (Blank Slate, first chain), the simplest depth-indented list reads cleanest. Override if you want higher visual fidelity.

3. **Chain root identification in the rendered tree.** Default: each chain renders with its `lock_at` timestamp as the visual root + lock-foundation event ("Locked 2026-05-15 · 5 agents"). Override if you want a different root anchor (e.g., user-provided chain name when manually started, or the first delivered artifact as root).

4. **Chapter 1 legacy artifact treatment.** Default: separate "Pre-chain history" section below the chain section. The default reads correctly because chapter 1 had no chain_id semantics. Override if you want legacy artifacts back-filled into synthetic chains (would require migration to assign a single legacy chain_id to all chapter-1 artifacts per user · meaningful one-time migration cost for cleaner long-term UI).

5. **Realtime updates on the archive surface.** Default: refresh-only for v1 of the tree-view. The archive is read-mostly; the bell already surfaces chain-delivery events. Override: subscribe to Realtime (same pattern as bell) so an active archive view updates as chain-triggered deliveries land. Would add ~1 day of work plus the Realtime gating fall-back logic from step 7C.

6. **Pagination / depth limits in the rendered tree.** Default: render the full tree in one pass · chain depth caps at 8 (step 8 framework guardrail), agent count expected ~10 per chain, branched reruns expected rare. No pagination. Override if you want to cap rendered depth (e.g., show first 5 levels, "Show more" CTA) for visual hygiene on extreme chains.

---

## 6. Out of scope

Explicit:

- Agent Console Phase view (master spec §13.10 · sequencing call #1 above).
- Run history view + replay panel (master spec §13.11).
- Foundation `?upgrade=success` banner (step 13).
- `/api/agents/dispatch.js` retirement (step 14).
- Realtime updates on archive (open call #5 defaults to refresh-only).
- Pagination on chain tree (open call #6 defaults to no limit).
- Drag-to-reorganize, inline rerun CTAs, or chain-level annotation editing (post-launch enhancements).
- Per-chain analytics (e.g., "this chain took 47s end-to-end") · forward note for a later analytics surface.

---

## 7. Forward references

- **Step 10 (per master spec §13.10)** Agent Console Phase view. Locked rows for Phase 02-05 with tier-unlock copy. Two-button rerun semantics on prior-delivered Phase 01 agents.
- **Step 11 (per master spec §13.11)** Run history view + replay panel. Surfaces frozen inputs (`qbp_snapshot`, `file_refs`, `runtime_args`, `agent_version`) per `agent_runs` row.
- **Step 13** Foundation `?upgrade=success` banner.
- **Step 14** `/api/agents/dispatch.js` retirement.
- **Step 15** End-to-end QA pass.
- **Step 16** Final sign-off + `CHAPTER_02_COMPLETION.md`.

---

## 8. End of outline

Hold-open PR opens on this branch. Awaiting adjudication on §5 open calls. Full spec follows in a second commit on the same branch.
