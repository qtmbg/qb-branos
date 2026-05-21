# Chapter 3 · Step 3 outline · Asset Layer (MINIMUM scope)

**Status:** OUTLINE. Six open calls for adjudication. Step 3 spec follows on this branch once adjudications land.

**Source authority:**
- `QB_BUILD_STATE_AND_ROADMAP_v1.md` Chapter 3 ("The Asset Layer") · scope MINIMUM per the PR #150 reconciliation note: "a founder uploads a file, an agent reads it. Deferred: versioning, ZIP export, tier-based storage limits (logged to pre-launch as PL-003)"
- `CHAPTER_02_COMPLETION.md` §5 (Chapter-3 inheritance notes) · the Agent Framework primitives that asset references plug into
- `chapter-03/verification/step-2-parked-report.md` · step 2 is PARKED on PL-002 (Pro upgrade), step 3 proceeds independently

**Step 2 / Step 3 independence:** step 3 does not require step 2's migration to land. The asset layer touches Supabase Storage (new infrastructure) and the agent contract's `inputs.files` field (already defined in `agents/contract.js` per the chapter-2 framework). Step 2's chain_id backfill and artifacts uniqueness constraint do not gate step 3.

**Chapter-3 posture binding:** per the operator instruction · "From step 3 onward: when you open a step's outline, if ALL six open calls land on their defaults, take the defaults and proceed into the spec + build WITHOUT holding for my release." Step 3 may run straight through if all six calls below land on default; surface only if any call warrants override OR a genuine blocker fires.

**Always-surface triggers (per operator):** any migration / every-user data write / destructive deletion / pricing / auth change ALWAYS surfaces regardless of default-shape. Step 3's storage bucket creation, RLS policy setup, and file-ref schema additions count as auth-adjacent surface work · operator-touch likely required on RLS, possibly on bucket policies.

---

## 1. Source-of-truth · chapter scope

Per the pinned roadmap (Chapter 3 · "The Asset Layer"):
> Goal: file management that supports Phase 03 production.

Per the PR #150 reconciliation note's MINIMUM scope:
> Chapter 3 = Asset Layer, scoped to MINIMUM to unblock Chapter 4: a founder uploads a file, an agent reads it. Deferred: versioning, ZIP export, tier-based storage limits (logged to pre-launch as PL-003).

This step 3 ships the minimum: a founder uploads a file, an agent reads it. Versioning + ZIP export + tier caps are deferred to PL-003.

---

## 2. Six open calls for adjudication

### Call 1 · Storage scope (Supabase Storage bucket layout)

- **Default · single bucket `user-uploads`, per-user folder by UUID.** One bucket. Files live at `user-uploads/{user_id}/{file_id}.{ext}`. Bucket RLS reads `auth.uid()` for ownership. Smallest blast radius; simplest auth model.
- **Override · per-tier bucket layout.** Separate buckets for free / starter / pro / agency, with different size limits per bucket. Forces tier gating at the bucket level. Matches the deferred PL-003 (tier-based storage limits) shape. Premature since PL-003 is deferred.
- **Override · per-phase bucket layout.** Separate buckets for Phase 02 inputs (logo references) / Phase 03 inputs (footage, photos) / Phase 04 inputs (templates). Forces phase gating. Doesn't match the chapter-3 MINIMUM scope.

### Call 2 · Upload UI placement

- **Default · `/foundation` page upload card.** A new card on the foundation page sits below the QBP. Drag-drop + click-to-browse. Single screen for upload. Reuses existing layout. Minimum new surface area.
- **Override · dedicated `/files` page.** A new page in the app under `app.quantumbranding.ai/files`. Full file browser. More UI work; better long-term ergonomics.
- **Override · upload inside the agent run dialog.** Files attach at agent-run time (e.g., a "drop logo references here" surface when invoking the Logo Evaluation Agent). Tight coupling; doesn't support the "upload now, use later" pattern.

### Call 3 · File reference contract (how agents consume files)

The agent contract at `agents/contract.js` already names `inputs.files` with `CANONICAL_FILE_SOURCES = ['user-upload', 'agent-output']`. The contract is in place; the question is how files surface in the agent's runtime args.

- **Default · `runtime_args.files: [{ type, file_id, signed_url, mime }]` array.** The runtime computes signed URLs at dispatch time and passes them to the agent's `run()` call. Stateless from the agent's perspective. Matches the `inputs.files` shape already declared in contract.js.
- **Override · `qbp.files` array on the profile.** Files live on the QBP itself, traveling with every snapshot. Bigger snapshots; reusable across agents without re-resolution.
- **Override · per-artifact `source_files` linkage.** Each artifact tracks which files it consumed via a join table. Higher fidelity for replay; more schema.

### Call 4 · Auth on file reads (signed URL contract)

- **Default · signed URL with 1-hour TTL · scope = read-only on the specific file path.** Edge function (`/api/files/sign-url`) takes a `file_id`, verifies the JWT user owns the file, returns a 1-hour signed URL. Agent caller embeds the URL in `runtime_args.files`. Matches the chapter-2 inter-edge HMAC posture (Edge resolves auth, agent doesn't).
- **Override · 15-minute TTL.** Shorter window. Tighter security. Adds re-sign overhead if an agent run takes longer than 15 min (Visual DNA agent runs are ~22s · well within either window, but defensive).
- **Override · direct service-role read (no signed URL).** Agent runs use service role to read files directly via storage admin API. Avoids URL signing but bypasses RLS. Higher risk; not recommended for user-uploaded content.

### Call 5 · Tier gating (free-tier file size cap)

- **Default · no tier gating in step 3 · defer to PL-003.** All tiers can upload. No size cap. PL-003 is the canonical home for tier-based storage limits per the reconciliation note. Smallest scope for step 3.
- **Override · soft cap at 25MB per file · free tier only.** Implement a single soft cap as a baseline. PL-003 still ships the full tier matrix later.
- **Override · hard cap matrix in step 3.** Free 25MB / Starter 100MB / Pro 500MB / Agency unlimited. Locks in the PL-003 matrix early. Over-scope per the MINIMUM directive.

### Call 6 · First-agent integration (which agent reads files first)

- **Default · Logo Evaluation Agent (Phase 02 · chapter 4).** This is the first agent in the QB BrandOS roadmap that requires user file input (logo files for evaluation). Step 3 stops at "files are ready"; the integration ships in chapter 4. Smallest step 3 scope; matches MINIMUM.
- **Override · ship a synthetic file-reading agent in step 3.** A test agent that just echoes the file's metadata. Proves the end-to-end path empirically in step 3. Adds test scaffolding to the agent registry.
- **Override · land both upload + Logo Evaluation Agent in step 3.** Compresses chapter-3-step-3 + chapter-4-step-1 into one step. Over-scope; violates chapter boundaries.

---

## 3. Sub-PR shape (provisional · finalized in spec)

| Sub-PR | Branch | Output |
|---|---|---|
| Spec | `chapter-3/step-3-spec` | spec with 6 adjudications baked |
| 3A | `chapter-3/step-3a-bucket` | Supabase Storage bucket creation via MCP + RLS policy SQL · committed for review (operator-touch) |
| 3B | `chapter-3/step-3b-upload-ui` | Upload UI on `/foundation` (or wherever Call 2 lands) |
| 3C | `chapter-3/step-3c-file-api` | `/api/files/upload` + `/api/files/sign-url` Edge functions |
| 3D | `chapter-3/step-3d-agent-pipe` | `runtime_args.files` plumbing into the agent contract |
| 3E | `chapter-3/step-3e-harness` | Repro gate · synthetic file upload → agent reads metadata |
| 3Z | `chapter-3/step-3z-closure` | Closure + step 4 outline (chapter 4 territory · Phase 02 agents) |

If Call 6 default holds (no synthetic agent in step 3), 3D and 3E compress to one PR.

---

## 4. Out of scope (step 3)

- File versioning (PL-003)
- ZIP / bulk download (PL-003)
- Tier-based size caps (PL-003)
- Logo Evaluation Agent · chapter 4 (Call 6 default)
- Voice Guide Agent · chapter 4
- Phase 03 content agents · chapter 5
- Step 2 work (PARKED on PL-002)
- Pricing reconciliation
- WCAG audit

---

## 5. Always-surface triggers (per operator)

Step 3 carries always-surface obligations on the following sub-PRs regardless of default-shape:

- **3A · Supabase Storage bucket + RLS** · auth-adjacent surface · ALWAYS surfaces for operator review before MCP apply.
- **3C · file API Edge functions** · auth-handling code · always surfaces if any change touches the JWT decode path.
- **Any storage policy SQL** · counts as schema/auth change · ALWAYS surfaces for operator review and plain-English-translated SQL.

Other sub-PRs (3B UI, 3D plumbing, 3E harness) can run on default-shape autonomy if all six calls land on default.

---

## 6. Hold gate

This outline holds at the gate until adjudicated. Per chapter-3 posture: if all six calls land on default, AI takes defaults and proceeds into the spec + build without further hold. Otherwise surface the forks for adjudication.

The always-surface obligations from §5 are non-negotiable: even on full-default, 3A and any 3C auth-touching changes surface to operator before apply/merge.

---

## 7. End of outline

`Outline ready · branch chapter-3/step-2c-branch-dry-run (rides with step 2 PARKED report)`
