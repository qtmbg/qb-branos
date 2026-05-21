# Chapter 2 · Step 14 spec outline · TERMINAL · Final sign-off + CHAPTER_02_COMPLETION.md

Status: draft outline. Awaiting Nizzar adjudication on the open calls in §5 below. Full spec follows on the same branch once the outline lands.

Source authority: `CHAPTER_02_SPEC.md` §13.16 ("Final sign-off + CHAPTER_02_COMPLETION.md.") + step 12 closure §6 (chapter-close shape · step 14 confirmed terminal) + step 13 closure §12 (handoff to step 14).

Branch: `chapter-2/step-14-spec`. PR opens on a hold gate until the outline is approved.

**Step 14 is the TERMINAL step of chapter 2.** No more chapter-2 build work follows. Chapter close is the artifact.

---

## 1. Bundle framing

Step 14 produces the formal closeout: a chapter-completion document that catalogs every shipped surface, every harness, every captured pattern, the framework defect-rate ledger, and a chapter-3 inheritance map. The document is the durable reference that chapter 3 (and every future chapter) reads when asking "what shipped, what stabilized, what carries forward."

This is pure documentation work. No new product surfaces. No new harnesses. No schema changes. The only code-adjacent question is whether to clean up the orphaned `agents/*.js` backward-compat re-export statements (whose target — `api/agents/dispatch.js` — was retired in step 12B). That's open call #6.

Three sources of work:

| Item | Source | Action |
| --- | --- | --- |
| `CHAPTER_02_COMPLETION.md` | §13.16 + step 12/13 closure forward references | Write the chapter-close catalog · location + scope per open calls #1-#2 |
| Pattern-library decision | step 6-13 forward notes accumulated patterns | Extract major patterns as separate docs vs inline in completion doc · open call #3 |
| Optional · orphaned re-export cleanup | step 12B audit residue | Remove or leave the `export { run as runXxxSynthesizer }` orphans · open call #6 |

§13 items remaining after step 14: NONE. This is the terminal step.

Prerequisites met (carried from all chapter-2 work):
- All chapter-2 surfaces shipped + verified (12 surfaces, 14 harnesses).
- Step 13 closure documents the 13/13 E2E PASS + 5-step clean streak + zero Cat B seam defects.
- Pre-launch checklist (PL-001 Stripe seam) established at `chapter-02/pre-launch-checklist.md`.
- Chapter-2 product surgical-fix total: 8 (3 weeks ago: ~5; chapter stabilized).

---

## 2. What CHAPTER_02_COMPLETION.md must contain (the durable record)

Regardless of open-call decisions, the document includes:

1. **Closeout statement** · formal "Chapter 2 closes" + signed-off-by line (format per open call #5)
2. **Shipped surfaces ledger** · every user-facing surface added/modified across steps 1-13, with the PR ledger linked
3. **Harness suite catalog** · all 14 harnesses with their last gate result + the run-artifact JSON path
4. **Framework defect-rate ledger** · final tally · 8 product surgical fixes total, distributed across steps 6-8, then 5 clean steps · streak ended chapter
5. **Captured patterns ledger** · all major patterns from step closure notes (see §3 for the candidate list and the extract-vs-inline decision in open call #3)
6. **Chapter-3 inheritance notes** · what carries forward (patterns + harnesses + primitives) vs what resets (CHAIN_TEST_AGENT will need re-enable for any future synthetic-agent verification, etc.)
7. **Pre-launch register pointer** · link to `chapter-02/pre-launch-checklist.md` · PL-001 + any future entries
8. **Open items handed to chapter 3** · explicit list with owners (synthetic chain_id backfill migration · bracketed hardening sub-PR · any other forward references)

---

## 3. Captured-patterns candidate list (for open call #3 decision)

Across steps 6-13 the closures accumulated these patterns. Open call #3 decides which become standalone reference docs vs stay inline in `CHAPTER_02_COMPLETION.md`:

**Major patterns (candidates for extraction):**
- `qb-realtime-manager.js` · single-channel-many-consumers pattern (step 9C origin · validated 3 consumers in step 11C)
- Harness-determinism · wait for mount + data-realtime + data-bucket before assertions (step 10C origin · refined 11C/12C/13A)
- Harness-seed schema discipline · check INSERT/PATCH r.ok or throw with body (step 11C origin · 12C/13A reinforced)
- Three-consumer Realtime · bell + Phase view + archive on one manager (step 11C origin · single source of truth for connection)
- Single-canonical-surface discipline · rerun on Phase view, audit on run history, output on artifact reading surface (step 10 + 11 reinforced)
- Bell-only Realtime indicator · `data-realtime` is the canonical signal (step 10 §3.3 origin)
- Category-gated surgical-fix policy · Cat A test-infra vs Cat B seam (step 13 adj #6 origin · validated this chapter only)

**Minor patterns (candidates for inline only):**
- Vocabulary discipline · no system/build vocab leaking to user copy (step 11 §3.2 + step 12 12A copy-check)
- Backfill-migration discipline · own step, own repro gate, own SQL review (step 11 §3.3)
- Branch-state verification · `git branch --show-current` before every commit (step 7 origin · breaches in step 9/11)
- Audit-then-delete · deletion-moment re-audit, not spec-time alone (step 12B exercise)
- Operator-coordination dependency · surface before harness run, not mid-flight (step 13 § 3.3 validated)
- Loading-state vs data-painted-state selector (harness pattern · 10C origin · 13A reinforced)

The extraction decision in open call #3 names which become `docs/patterns/<name>.md` files vs inline ledger entries.

---

## 4. Sub-PR breakdown

Step 14 is small-scope (documentation only, plus optional cleanup per open call #6).

| Sub-PR | Topic |
|---|---|
| 14A | `CHAPTER_02_COMPLETION.md` + any extracted pattern docs per open call #3 · the chapter-close artifact |
| 14B (optional · per open call #6) | Orphaned `agents/*.js` re-export cleanup |
| 14Z | Step 14 closure · final sign-off · chapter 2 closes |

The cycle could collapse to 14A + 14Z if open call #6 defaults to "leave the re-exports." Or 14A + 14B + 14Z if cleanup ships. 14Z is the chapter-close sign-off, NOT a verification report shape (no acceptance gates · documentation review).

---

## 5. Six open calls for Nizzar adjudication

1. **CHAPTER_02_COMPLETION.md location.** Default: repo root (mirrors `CHAPTER_02_SPEC.md`'s location · scans naturally in `ls` + chapter-3 reads it from the same level). Override: `chapter-02/CHAPTER_02_COMPLETION.md` (mirrors verification reports' location · keeps chapter docs co-located). Default favors discoverability over co-location since the completion doc is read across chapter boundaries, not within.

2. **CHAPTER_02_COMPLETION.md scope · terse vs comprehensive.** Default: comprehensive. Includes all eight content blocks from §2, plus inline pattern ledger (whatever didn't get extracted per open call #3). Estimated 5-10 pages of markdown. The chapter-close artifact is the durable reference for years; weighting toward thorough is worth the write cost. Override: terse · just the closeout statement + shipped surfaces ledger + harness catalog + defect-rate. Patterns and inheritance notes get extracted to separate docs. Estimated 1-2 pages. Default favors fewer-files-with-more-context over many-thin-files.

3. **Pattern-library extraction · which patterns become standalone docs.** Default: extract ONLY the three major architectural patterns as `docs/patterns/*.md` files: `qb-realtime-manager-pattern.md` (single-channel-many-consumers), `harness-determinism.md` (mount + data-state wait pattern), `harness-seed-schema-discipline.md` (INSERT/PATCH r.ok check). Everything else stays inline in `CHAPTER_02_COMPLETION.md`. Override A: extract all 13 patterns (more reference value but more files). Override B: extract NONE · everything stays inline (one file, less indexing surface). Default favors keeping the truly cross-chapter architectural patterns reachable from a `docs/patterns/` index while keeping vocabulary/discipline guidance in the chapter-close artifact.

4. **Chapter-3 spec opener timing.** Default: defer to a separate session. Step 14 closes chapter 2; chapter 3 spec opens fresh, in a new session, with a clean slate. Override: open chapter-3 spec in the same session as step 14 close (no break · momentum preserved). Default favors a clean break · the closeout artifact deserves to be its own moment + chapter 3's first decisions (hardening sub-PR shape, scope reset, etc.) benefit from fresh framing.

5. **Sign-off format · simple PR merge vs structured signed-off-by.** Default: structured. The 14Z closeout includes a formal "Chapter 2 closes · Signed-off-by: Nizzar Ben Chekroune <nizzar.ben@gmail.com>" line at the bottom of `CHAPTER_02_COMPLETION.md` + a brief announcement-style closeout in the 14Z PR body. Override: simple · 14Z PR merge marks the close, no special sign-off line. Default matches the weight of a chapter close · the document gets referenced for years, the signature carries meaning.

6. **Orphaned `agents/*.js` re-export cleanup.** Per step 12B audit, four files carry orphaned `export { run as runXxxSynthesizer }` statements (soul-map.js, sensescape.js, visual-dna.js, war-table.js) with attached "Backward-compat re-export for api/agents/dispatch.js · Removed in step 14 when dispatch.js is deprecated" comments on two of them. Dispatch.js was deleted in step 12B. The exports have no consumer. Default: clean them up as part of step 14 (matches the comments' own "Removed in step 14" prophecy · cleanest end state · 4 small edits · low risk). Override: leave them as documented dead code (matches the user's 12B directive that "comment-only references" stay; the exports were borderline · leaving means clean chapter-3 inherits one less ambiguity, but the orphans persist). Default favors literal fulfillment of the comments' own contract · the chapter-close moment IS the natural time to honor the "Removed in step 14" note.

---

## 6. Out of scope

Explicit:

- New features (no new surfaces ship in step 14).
- Bracketed hardening sub-PR (chapter-3 first step · not part of chapter-2 close).
- Synthetic chain_id backfill migration (chapter-3 candidate · referenced in completion doc inheritance notes only).
- WCAG accessibility audit (post-launch · noted in inheritance).
- Stripe pre-launch seam check execution (PL-001 in pre-launch register · not in step 14 scope).

---

## 7. Forward references

After step 14 there ARE no chapter-2 forward references (terminal step). The forward references in `CHAPTER_02_COMPLETION.md` point at **chapter 3**:

- **Chapter 3 first step** Bracketed hardening sub-PR · small + focused per 5-step clean streak evidence
- **Chapter 3 candidate** Synthetic chain_id backfill migration (per step 11 adj #6 · own step, own repro gate, own SQL review)
- **Pre-launch deliverables** PL-001 (real-Stripe upgrade seam) + any future register entries
- **Pattern inheritance** all patterns named in CHAPTER_02_COMPLETION.md inheritance section apply

---

## 8. End of outline

Hold-open PR opens on this branch. Awaiting adjudication on §5 open calls. Full spec follows in a second commit on the same branch.

Step 14 is the TERMINAL step of chapter 2. After 14Z merges, chapter 2 closes.
