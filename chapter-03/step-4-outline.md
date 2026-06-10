# Chapter 3 · Step 4 · Outline · real-agent file read

## 0. Frame

Chapter 3's exit condition (roadmap reconciliation note, 2026-05-21): a founder uploads a file, an agent reads it. Step 3 delivered the founder upload (3B card on /foundation) and a synthetic agent receiving file METADATA end to end (3E, 5/5 GREEN). Step 4 is the last increment: a REAL production agent reads file CONTENT and uses it in generation. That also makes Ch4 ready: the Phase 02 Logo Evaluation Agent is file-centric, and it copies whatever contract shape step 4 proves on a Phase 01 agent.

Everything below inherits the standing registry merge gate (smoke + 401 probes) because it touches agents/ and the dispatch path.

## 1. The six calls

### Call 1 · Which production agent reads files first — **HELD · genuine fork**

- **Option A (semantic fit):** `visual_dna_synthesizer`. An uploaded reference image is exactly what a visual identity synthesis should ground on. Tradeoff: the fleet's tightest latency margin (worst case 22900ms against the 24000ms deployed timeout, 1100ms headroom, retry_budget already forced to 0). Vision input adds model latency on file-present runs; the realistic failure mode is edge_timeout on a production agent.
- **Option B (latency safety):** `sensescape_synthesizer` on Haiku 4.5, fast with real headroom, vision-capable. Tradeoff: weaker semantic fit, and Ch4 copies the file pattern from an agent whose use of the file is decorative rather than load-bearing.
- Mitigation available under either option: file-absent runs are byte-identical to today (optional slot, call 3), so the latency risk applies only to the new file-present path, which the call-6 harness measures before any UI exposure.
- **Why held:** the choice changes which production agent's behavior changes, and both options carry a real tradeoff (timeout risk vs wrong-template risk). This is the operator's call. Everything downstream is shaped but not started.

### Call 2 · Read mechanism — default + tradeoff

- **Default:** Claude vision image content block sourced from the 1-hour signed URL (url-source block, no payload inflation), for `image/png`, `image/jpeg`, `image/webp` only.
- **Tradeoff:** vision tokens and added latency on file-present runs. The alternatives are worse: base64 embedding inflates Edge memory and request size; metadata-only echo does not satisfy "an agent reads it."

### Call 3 · Contract shape — default + tradeoff

- **Default:** one optional files slot on the chosen agent's META: `{ type: 'reference-image', source: 'user-upload', optional: true }`. File absent = behavior identical to today, zero risk to existing runs, no forced migration.
- **Tradeoff:** optional means the exit path only exercises when a founder actually attaches a file. Acceptable: the harness (call 6) exercises it deterministically.

### Call 4 · Founder wiring from upload to dispatch — default + tradeoff

- **Default:** extend the existing 3B upload card on /foundation with an attach affordance that carries `{ file_id, path, type: 'reference-image' }` into `runtime_args.files` on the next dispatch of the chosen agent. No new page, no file browser (PL-003 stays deferred).
- **Tradeoff:** console-adjacent minimal UI versus a fuller attach flow inside the Console run panel. The minimal card extension serves the weakest persona (one obvious affordance) and keeps step 4 small; the Console flow is better long-term UX but is Ch4+ surface area.

### Call 5 · SVG and non-image MIME in the read path — default + tradeoff

- **Default:** agent-readable set is png/jpeg/webp only. SVG uploads remain allowed at the bucket but are never passed to vision and never rendered inline in any DOM (forward risk re-logged in 3Z §9; display, if ever, is `<img src=signed-url>` only). PDF read waits for Ch4 document agents.
- **Tradeoff:** a founder can attach a file type the agent will not read. Cure is explicit copy on the attach affordance, not silent acceptance.

### Call 6 · Verification gate — default + tradeoff

- **Default:** new harness `tests/chapter-03/file-upload-real-agent.mjs`: real user JWT path, real agent dispatch with an attached reference image, asserts delivered artifact plus agent_runs.file_refs, self-teardown per the step-3E pattern (zero debris), plus latency capture on the file-present run for the call-1 risk. Standing gate applies to the merge (registry smoke verbatim in PR, post-deploy 401 probes). FILE_TEST_AGENT is NOT needed by this harness, so the flag-removal operator item stays independent.
- **Tradeoff:** every harness fire costs one real model call. Acceptable as a merge gate fire, not a polling loop.

## 2. Disposition

Calls 2 through 6 land on clean defaults. Call 1 is a genuine fork (production agent choice with a real latency-vs-template tradeoff). Per the long-leash ruling at step 3 open, the fork holds the step: this outline is committed, no step 4 implementation begins until the operator rules call 1 in chat.

## 3. Out of scope (step 4)

- File versioning, ZIP export, tier caps (PL-003)
- /files browser page
- Video/audio MIME (chapter 5)
- Step 2 migration (PARKED on PL-002)
- Multi-file attach (single file proves the seam; Ch4 generalizes)
