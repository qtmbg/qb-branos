# Chapter 3 · Step 3 spec · Asset Layer (MINIMUM scope)

**Status:** spec with all six adjudications baked. Two divergences from default taken (Call 5 sharpened to flat 25MB across all tiers · Call 6 synthetic file agent). Step 3 runs per chapter-3 long-leash posture with two always-surface hold points: 3A (bucket + RLS) before MCP apply · 3C (sign-url Edge function) before merge.

Source authority: `chapter-03/step-3-outline.md` (open-call outline · merged in PR #159) · the six adjudications surfaced in chat 2026-05-22 · `QB_BUILD_STATE_AND_ROADMAP_v1.md` Chapter 3 · `CHAPTER_02_COMPLETION.md` §5 inheritance.

---

## 0. Adjudications baked

| # | Call | Adjudication | Notes |
|---|---|---|---|
| 1 | Storage scope | **Default** | Single bucket `user-uploads`, per-user UUID folder, RLS on `auth.uid()`. Tier/phase semantics live elsewhere. No bucket sprawl. |
| 2 | Upload UI placement | **Default** | Foundation-page upload card. Weakest-persona surface. No `/files` page (defers until versioning/ZIP work earns its complexity). Chapter-4 clunkiness revisited when ch4 ships. |
| 3 | File reference contract | **Default** | Stateless `runtime_args.files: [{type, file_id, signed_url, mime}]`. Matches ch2 dispatch discipline. Extends existing `agent_runs.file_refs` (run.js:521) for replay fidelity. No new schema, no snapshot bloat. |
| 4 | Auth on file reads | **Default** | 1-hour signed URL TTL · read-only · file-path-scoped · via `/api/files/sign-url` with JWT ownership verify. 15-min override rejected (re-sign complexity, near-zero gain). Service-role override rejected (bypasses RLS). **3C surfaces before merge** per always-surface carve-out. |
| 5 | Tier gating | **SHARPENED override** | Flat 25MB cap across ALL tiers (NOT free-tier-only). Single constant checked per upload. No tier lookup. PL-003 later raises the cap per tier from this baseline. Less code, less scope than free-only. |
| 6 | First-agent integration | **Override** | Synthetic `file_test_agent` under `FILE_TEST_AGENT=1` env flag. Mirrors `chain_test_agent` precedent. Flag ON for verification window only, OFF before step 3 closes, removal confirmed in 3Z. Operator routes set + remove (same as step 8C/13). |

### Always-surface obligations (binding)

- **3A · Supabase Storage bucket + RLS policies** · auth-adjacent surface · SURFACES before MCP apply.
- **3C · `/api/files/sign-url` Edge function** · JWT decode + auth-resolution path · SURFACES before merge.
- Other sub-PRs (3B UI, 3D plumbing, 3E synthetic agent + harness, 3Z closure) run on long-leash autonomy.

### Synthetic agent lifecycle (binding)

`FILE_TEST_AGENT=1` follows the chapter-2 `CHAIN_TEST_AGENT=1` pattern exactly:

1. Operator sets `FILE_TEST_AGENT=1` in Vercel Production env when 3E is ready to fire.
2. AI runs 3E repro gate harness against production with the synthetic agent loaded.
3. Operator removes `FILE_TEST_AGENT` from Vercel env.
4. AI confirms removal in 3Z closure (read the env-list or run a verifier query).

A synthetic agent must never be live in steady-state.

---

## 1. Bundle framing

Chapter 3 ships the MINIMUM Asset Layer: a founder uploads a file via the foundation page, and an agent can read it via runtime_args. Six sub-PRs, three of which run with no surface (3B UI, 3D plumbing, 3E synthetic gate), two of which surface for operator review at always-surface hold points (3A bucket+RLS, 3C sign-url), and one closure (3Z).

No new tables. No DB migration. Supabase Storage handles persistence with bucket-level RLS and a 25MB file_size_limit. Original filenames live in Storage object metadata (no separate user_files table). The agent contract field `inputs.files` is already declared in `agents/contract.js`; the runtime field `agent_runs.file_refs` is already written by `/api/agents/run.js:521`. Step 3 just plumbs the user-upload path into both surfaces.

The synthetic `file_test_agent` proves the end-to-end seam (upload → sign → dispatch with runtime_args.files → agent reads metadata) in step 3 itself, so chapter 4's Logo Evaluation Agent inherits a verified pipeline rather than a half-tested one.

### Bucket + RLS architecture (informs 3A surface)

| Element | Decision |
|---|---|
| Bucket name | `user-uploads` |
| Bucket visibility | Private (not public) |
| File path layout | `user-uploads/{user_id}/{file_id}.{ext}` where `{file_id}` is a UUID generated client-side at upload time |
| `file_size_limit` | 25 MB (26,214,400 bytes) · flat across all tiers |
| `allowed_mime_types` | `image/png`, `image/jpeg`, `image/svg+xml`, `image/webp`, `application/pdf` (Phase 02 + brand-document baseline) |
| Original filename | Stored in Storage object `metadata.original_filename` |
| RLS · SELECT | `auth.uid()::text = (storage.foldername(name))[1]` |
| RLS · INSERT | `auth.uid()::text = (storage.foldername(name))[1]` |
| RLS · UPDATE | `auth.uid()::text = (storage.foldername(name))[1]` |
| RLS · DELETE | `auth.uid()::text = (storage.foldername(name))[1]` |
| Service role | Bypasses RLS (used by `/api/files/sign-url` to issue signed URLs after the Edge has verified JWT ownership independently) |

The four RLS policies enforce: the auth'd user can only operate on files whose path's first folder segment equals their UUID. Same shape as Supabase's documented per-user bucket pattern.

### File reference flow (informs 3C, 3D, 3E)

```
1. UI (foundation page · 3B)
   - Uses supabase-js client-side with the user JWT
   - Uploads to user-uploads/{user_id}/{new-uuid}.{ext}
   - RLS enforces user_id ownership on upload
   - Lists the user's files via Supabase Storage list API

2. Agent dispatch (3D · extends api/agents/rerun.js or new endpoint)
   - User selects file_ids to include in the agent run
   - Edge function takes file_ids in the request body
   - For each file_id, calls /api/files/sign-url → 1-hour signed URL
   - Embeds [{type, file_id, signed_url, mime}] in runtime_args.files
   - Dispatches to /api/agents/run

3. Agent runtime (3D · api/agents/run.js)
   - Reads runtime_args.files from the dispatch body
   - Validates inputs against agent's META.inputs.files contract
   - Passes runtime_args.files through to the agent's run() call
   - Writes agent_runs.file_refs = files snapshot (per run.js:521 contract)
   - Agent fetches signed URLs at its discretion

4. Sign-url Edge function (3C · api/files/sign-url.js)
   - Accepts { file_id, user_id_path } in body
   - Verifies JWT (or HMAC for inter-edge calls from dispatch endpoints)
   - Confirms user owns the file path (path's first folder = user_id)
   - Generates signed URL via Supabase admin API
   - Returns { signed_url, expires_at }
```

---

## 2. Sub-PR sequence

| Sub-PR | Branch | Output | Surfaces? |
|---|---|---|---|
| Spec | `chapter-3/step-3-spec` (this) | spec with adjudications baked | No (this PR merges directly) |
| **3A** | `chapter-3/step-3a-bucket` | Bucket creation SQL + RLS policy SQL · committed as `supabase/migrations/019_user_uploads_bucket.sql` for review | **SURFACE before MCP apply** |
| 3B | `chapter-3/step-3b-upload-ui` | Upload card on `foundation.html` · supabase-js client-side · drag-drop + click-to-browse + file list | No |
| **3C** | `chapter-3/step-3c-file-api` | `api/files/sign-url.js` Edge function | **SURFACE before merge** |
| 3D | `chapter-3/step-3d-agent-pipe` | runtime_args.files plumbing in `api/agents/run.js` + `api/agents/rerun.js` | No |
| 3E | `chapter-3/step-3e-test-agent` | `agents/file-test-agent.js` (under FILE_TEST_AGENT=1) + `tests/chapter-03/file-upload-pipeline.mjs` repro gate harness | No (operator coordinates flag set/remove) |
| 3Z | `chapter-3/step-3z-closure` | Closure report + step 4 outline (chapter 4 Phase 02 territory) | No |

### 3A · what surfaces (binding)

Before any MCP apply, AI surfaces:

1. The complete bucket-creation SQL (or MCP `apply_migration` call payload)
2. The four RLS policies (SELECT/INSERT/UPDATE/DELETE) with plain-English alongside each
3. The `file_size_limit` constant and `allowed_mime_types` array
4. The MCP project_id and operation
5. Idempotency posture (the operation is `CREATE BUCKET IF NOT EXISTS` · re-runs are no-ops)

Operator reviews · gives explicit go in chat · AI then applies via MCP.

### 3C · what surfaces (binding)

Before merge of the 3C PR, AI surfaces:

1. The full `api/files/sign-url.js` source
2. The JWT decode path (must use `/auth/v1/user` round-trip per chapter-2 #105 cure, NOT self-decoded JWT)
3. The ownership-verification logic (path's first segment must equal `user.id`)
4. The signed-URL TTL (1 hour, hard-coded constant)
5. Error paths and response shapes

Operator reviews · gives explicit go in chat · AI then merges.

---

## 3. Files added in this step

```
supabase/migrations/019_user_uploads_bucket.sql       · 3A · bucket + RLS
api/files/sign-url.js                                  · 3C · Edge function
api/files/_lib/file-config.js                          · 3C · shared constants (25MB cap, MIME types)
foundation.html                                         · 3B · add upload card (edit existing)
api/agents/run.js                                       · 3D · extract runtime_args.files (edit existing)
api/agents/rerun.js                                     · 3D · accept file_ids in body, sign URLs (edit existing)
agents/file-test-agent.js                               · 3E · synthetic agent (gated by env)
agents/registry.js                                      · 3E · register file-test-agent under flag (edit existing)
tests/chapter-03/file-upload-pipeline.mjs              · 3E · repro gate harness
chapter-03/verification/step-3-closure-report.md       · 3Z · closure
chapter-03/step-4-outline.md                            · 3Z · chapter 4 entry
```

### Files NOT touched

- Any chapter-2 working code outside the named edits in 3D (Fence: edits restricted to the file_refs flow)
- The QBP (qbp.files is NOT used per Call 3 default; runtime_args.files is the path)
- The `artifacts` table (no schema change)
- The `agent_runs` table (no schema change; file_refs field is already present)
- `api/agents/rerun.js` rerun semantics (only the body parsing extends to accept file_ids)

---

## 4. Out of scope

- File versioning (PL-003)
- ZIP / bulk download (PL-003)
- Per-tier size caps (PL-003 raises from the 25MB flat baseline)
- Logo Evaluation Agent · chapter 4 (Call 6 default · synthetic agent in 3E is the placeholder)
- Voice Guide Agent · chapter 4
- Phase 03 content agents · chapter 5
- Video / audio MIME types (chapter 5 territory)
- `/files` page · deferred to a future chapter when versioning/ZIP earn the surface
- Step 2 backfill migration (PARKED on PL-002)
- Pricing reconciliation
- WCAG audit

---

## 5. Definition of done

Step 3 closes when ALL the following are true:

1. Bucket `user-uploads` exists on prod with the four RLS policies + 25MB limit + the named MIME types.
2. Upload UI card is live on the foundation page · a user can drag-drop a file and see it in their list.
3. `/api/files/sign-url` is deployed · returns 1-hour signed URLs for files the JWT owns · 401 for non-owners.
4. `api/agents/run.js` extracts runtime_args.files and passes them through to agent run() · agent_runs.file_refs captures the frozen file metadata.
5. `agents/file-test-agent.js` exists in the codebase, gated by `FILE_TEST_AGENT=1`.
6. `tests/chapter-03/file-upload-pipeline.mjs` PASSES against production with the flag ON: synthetic file upload → signed URL issuance → dispatch with runtime_args.files → agent receives metadata.
7. **`FILE_TEST_AGENT` env var is REMOVED from Vercel Production** (operator-confirmed in chat).
8. 3Z closure report confirms (a) all steps above, (b) step 3 is independent of parked step 2 — version-race invariant stays EXPECTED-RED, (c) step 4 outline is committed.

---

## 6. Step 3 / Step 2 independence (binding for closure)

Step 3 ships entirely independently of step 2's parked migration:

- Step 2 migration (chain_id backfill + artifacts uniqueness constraint) operates on `dispatch_jobs` and `artifacts` tables. Step 3 operates on Supabase Storage bucket + RLS, with no schema additions.
- The version-race shape (concurrent artifact reruns producing duplicate versions) is unrelated to file uploads. Files create new file_id UUIDs per upload; there is no max-version-based contention in the file storage layer.
- `tests/chapter-03/invariants-version-race.mjs` continues to go EXPECTED-RED on sub-invariant B. Step 3 does nothing to change this. The closure re-confirms.
- When step 2 resumes (post-PL-002), it lands as a clean migration with no rebase against step 3 work.

The 3Z closure explicitly confirms: "Step 3 ships do not change step 2 park status. Version-race harness re-confirmed EXPECTED-RED."

---

## 7. Branch hygiene (binding through all sub-PRs)

- `git branch --show-current` before every commit.
- Each commit body names the verified branch.
- No commits on `main` directly.
- Sub-PR PRs are squash-merged; branches deleted after merge.

---

## 8. Hold points

Two holds in step 3:

1. **3A hold** · before MCP apply of the bucket + RLS. AI surfaces the full SQL and policies; operator reviews; gives go.
2. **3C hold** · before merge of the sign-url PR. AI surfaces the Edge function source; operator reviews; gives go.

Plus the operator-coordinated flag toggle at 3E:

3. **3E flag set** · before AI runs the file-upload-pipeline gate, operator sets `FILE_TEST_AGENT=1` in Vercel Production env.
4. **3E flag remove** · after gate passes, operator removes `FILE_TEST_AGENT` from Vercel env.
5. **3Z confirms** removal in the closure report.

All other sub-PRs (3B, 3D, 3E code/harness) run on long-leash autonomy.

---

## 9. End of spec

`Spec ready · branch chapter-3/step-3-spec`
