# Phase 02–05 Migration Audit
## Current state, common patterns, and a path to Claude-agent architecture

> Written after the Phase 01 funnel was verified clean (commit 7f7f463).
> Goal: give you a real picture of what Phase 02–05 actually is today
> and what it costs to make it operate the way you described — Claude
> agents that read the QBP, reason over it, and write back to it.

---

## TL;DR

- **13 Phase 02+ tools currently exist.** ~50–60kb each, ~13MB total.
- **12 of 13 still use React + Babel** (in-browser JSX transpile via Babel Standalone). One — `content-scheduler.html` — is already vanilla and has no Claude integration.
- **All Claude-using tools share one pattern.** A single `window.QB_AI(system, user, maxTokens)` helper that POSTs to `/api/claude`, single-shot prompt, no streaming, no tool use, no agentic loop. The QBP is read once at page load via a `window.QB_QBP` snapshot.
- **Two model versions in production.** Most tools target `claude-sonnet-4-20250514` (a retired legacy date-suffixed ID). A few are on `claude-sonnet-4-6`. None are on `claude-opus-4-7`.
- **None of them write QBP back through `QB.setQBP`.** They're read-only against QBP and dump output to the UI without enriching the brand profile that downstream tools depend on. This is the biggest single architectural debt — the system isn't compounding the way Phase 01 sets up.
- **Recommended path: Light migration first** (vanilla JS + cloud-synced QBP + writeback + standardized model). Heavy "true Claude Agents" path comes after, once funnel data is in.

---

## 1. Inventory

| Tool | Phase | Size | React? | Claude calls | QBP read | QBP write | Notes |
|---|---|---|---|---|---|---|---|
| logo-direction-agent | 02 | 30kb | yes | 1× single-shot | yes (`window.QB_QBP`) | no | Smallest. Generates a logo brief from QBP fields. |
| logo-evaluation-agent | 02 | 58kb | yes | 1× single-shot | yes | no | Upload concepts → Claude scores against identity. Image input flow. |
| voice-guide-agent | 02 | 57kb | yes | 1× | yes | **no** ← biggest gap | Voice tone modes + live copy generator. Should write `qbp.voice*` fields back. |
| instagram-seed-agent | 03 | 49kb | yes | 1× | yes | partial | First 12 IG posts. Writes some completion markers. |
| linkedin-strategy-agent | 03 | 61kb | yes | 1× | yes | partial | Profile rewrites + 20 posts. |
| youtube-strategy-agent | 03 | 55kb | yes | 1× | yes | partial | 6 scripts + short-form briefs. Most Claude calls per session. |
| newsletter-architecture-agent | 03 | 55kb | yes | 1× | yes | partial | First 4 issues drafted. |
| content-bridge | 03 | 56kb | yes | 1× | yes | minimal | Translates scripts → production briefs (HeyGen, Canva). |
| content-repurposing-engine | 04 | 51kb | yes | 1× | yes | no | 1 long-form → 25 native pieces. |
| content-scheduler | 04 | 38kb | **no** | **none** | yes (read-only) | no | Already vanilla. No Claude. Pure organizational UI. |
| brand-performance-dashboard | 05 | 51kb | yes | 1× | yes | no | Translates analytics into brand signals. |
| quarterly-brand-review-agent | 05 | 60kb | yes | 1× | yes | yes (some) | Updates QBP, grades the quarter. The one tool that does write back. |
| predictive-panel.. | 05 | 55kb | yes | 1× | yes | no | Pro-tier tool. Simulates brand moves. Note: filename has double dot (`predictive-panel..html`) — known oddity, `/panel` route handles it. |

**Total Claude calls per session across the whole stack:** roughly 13. Mostly single-shot. No tool use. No streaming.

---

## 2. The pattern every Phase 02+ tool follows

Every Claude-using tool shares this skeleton:

```js
// 1. Snapshot QBP at boot
try { window.QB_QBP = JSON.parse(localStorage.getItem('qb_qbp') || '{}'); }
catch(e) { window.QB_QBP = {}; }

// 2. AI helper
window.QB_AI = async function(systemPrompt, userPrompt, maxTokens) {
  var res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',  // ← legacy retired ID in most tools
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });
  var json = await res.json();
  return json.content[0].text;
};

// 3. React component renders, on submit calls QB_AI(...)
// 4. Output rendered to UI. Done.
```

What's missing:
- **No QBP refresh** — the `window.QB_QBP` snapshot is stale the moment another tab updates QBP. Phase 01 has `QB.pullQBPFromCloud` for this.
- **No QBP writeback** — output stays in the UI. Downstream tools can't read what the upstream tool just produced.
- **No completion tracking** — tool runs aren't logged in `tool_completions`, so journey-guide/hub/Klaviyo never know.
- **No gate** — anonymous users can run paid Phase 02+ tools without ever hitting `QB.openGate`. (The paywall via `QB_HAS_ACCESS` does block them, but the UX doesn't connect to the funnel.)
- **No streaming** — every Phase 02+ tool spends 8–30s spinning while Claude generates. Streaming would feel materially better.
- **No tool use** — Claude can't reach into QBP, can't browse the web for context, can't call other agents.

---

## 3. Two migration paths

### Path A — Light migration (matches Phase 01 vanilla pattern)

This is what Phase 01 went through. Same pattern, applied to 12 more tools.

**Per-tool changes:**
1. **Drop React + Babel.** Rewrite the React component as vanilla DOM (the same way `brand-soul-map.html`, `sensescape.html`, etc. were rewritten). Removes the in-browser Babel transpile (~150kb script, slow page load).
2. **Load `qb-cloud.js` and `qb-gate.js`** in `<head>`. Replace `window.QB_QBP` with `QB.getQBP()` so the QBP is always fresh.
3. **Replace `window.QB_AI`** with a thin helper that POSTs to `/api/claude` using `claude-sonnet-4-6` (or `opus-4-7` for high-quality tools like Voice Guide and Predictive Panel).
4. **Add QBP writeback.** When the tool finishes, call `QB.setQBP({ ...newFields })`. Voice Guide should write `qbp.voiceGuideRules`, `qbp.voiceSamples`. Logo Direction should write `qbp.logoBrief`. And so on.
5. **Add completion tracking.** Call `QB.recordCompletion(toolId)` when the user accepts the output.
6. **Wire to the gate.** If you want Phase 02+ tools to also surface the soft-gate for anonymous users (currently they're paywall-blocked but a different first-touch could work), call `QB.openGate({ toolId, toolName, brandName })`. Optional — paywall already covers it.
7. **Streaming.** Use SSE on `/api/claude` (already supported by Anthropic API; needs proxy update) so output renders progressively. Massive UX win for low cost.

**Per-tool effort:** roughly 4–6 hours for a tool of this size, going by the Phase 01 conversion experience. Voice Guide and Predictive Panel might take longer because their flows are more complex; Logo Direction would be fastest.

**Total effort estimate:** **~60 hours of focused work** for all 12 Phase 02+ tools, sequenced as below.

### Path B — Heavy migration (true Claude Agents)

This is the architectural rewrite Nizzar described. Each Phase 02+ tool becomes a long-running Claude Agent (per the [Managed Agents API](https://docs.claude.com/en/docs/agents) or Claude API's agentic loop).

**What changes:**
- Each tool runs as a stateful agent with persistent context across sessions
- Claude can use tools: `read_qbp(field)`, `write_qbp(field, value)`, `search_brand_kb(query)`, `generate_image(prompt)`, etc.
- Multi-turn refinement: the user can iterate with the agent ("make the voice less corporate")
- Agents can hand off to other agents (Logo Direction → Logo Evaluation chain, end-to-end)
- Server-side execution (per-session container in Anthropic's sandbox, OR your own Vercel Edge Functions with state)
- Streaming UI is native, not bolted-on

**Cost-side reality:**
- Higher per-call cost (multi-turn = more tokens), offset by better UX and tool use efficiency
- Stateful infrastructure: Supabase already covers QBP storage; agent state (conversation history, tool state) needs a new table
- Heavier engineering: each agent needs its own system prompt, tool definitions, and integration tests
- Output quality: substantially better. A Voice Guide that can iterate with the user produces meaningfully better voice rules than a single-shot prompt.

**Effort estimate:** **~150 hours** to convert all 12 tools to the heavy pattern. Per-tool cost roughly 10–15 hours including system prompt refinement and tool wiring.

### Recommendation

**Do Path A first, then Path B selectively.**

Reasoning:
- Path A is incremental, low-risk, immediately ships consistent UX with Phase 01
- Path A unlocks the QBP writeback that compounds — the very thing that makes the funnel valuable
- Path A removes React+Babel from the entire codebase, which simplifies everything downstream
- Path B then operates on a clean foundation, not on top of Babel-transpiled React mess
- Some Phase 02+ tools may never need Path B (Logo Direction is plausibly always single-shot; Voice Guide absolutely benefits from Path B)

---

## 4. Recommended sequencing

Order Path A by **value-of-writeback** first. Tools whose output other tools will consume go first.

| # | Tool | Why this order |
|---|---|---|
| 1 | **voice-guide-agent** | Voice rules feed Instagram, LinkedIn, YouTube, Newsletter, Content Bridge — five downstream tools depend on this. Highest writeback ROI. |
| 2 | **logo-direction-agent** | Logo brief feeds Logo Evaluation. Smallest tool, fastest to migrate. |
| 3 | **logo-evaluation-agent** | Reads Logo Direction output. Pair with #2. |
| 4 | **content-bridge** | Connects scripts to production tools (HeyGen, Canva). Feeds repurposing engine. |
| 5 | **content-repurposing-engine** | Operates on bridge output. Pair with #4. |
| 6 | **content-scheduler** | Already vanilla. Just needs cloud-aware QBP integration. Fastest of the bunch. |
| 7 | **instagram-seed-agent** | Reads voice. |
| 8 | **linkedin-strategy-agent** | Reads voice. |
| 9 | **youtube-strategy-agent** | Reads voice. |
| 10 | **newsletter-architecture-agent** | Reads voice. |
| 11 | **brand-performance-dashboard** | Reads everything. |
| 12 | **quarterly-brand-review-agent** | Reads everything + writes back. |
| 13 | **predictive-panel** | Pro-tier. Most complex. Strongest candidate for going straight to Path B (heavy Claude Agent) instead of Path A. |

Predictive Panel is the natural first Path B candidate — it's the tool where multi-turn iteration ("simulate this with a 30% price increase instead") materially improves the output. Save it for last and migrate it heavy.

---

## 5. Two foundational improvements that benefit ALL Phase 02+ tools

Independent of which migration path you pick, two things would benefit every tool downstream and aren't tool-specific:

### A. SSE streaming on `/api/claude`

Currently the proxy at `api/claude.js` is request/response. Anthropic supports SSE; with a 30-line change to the proxy and a small client-side helper, every Phase 02+ tool gets progressive output. UX win is enormous (8–30s spinner → text appearing in real-time).

Effort: ~2 hours. High leverage.

### B. Shared `QB_AI` helper module

Right now every tool has its own copy of the `window.QB_AI` function inline. Centralize it in `qb-cloud.js` (or a new `qb-claude.js`) with:
- Always uses the latest QBP via `QB.getQBP()` (no stale snapshot)
- Standardized model selection (default `sonnet-4-6`, `opus-4-7` for opt-in tools)
- Built-in `QB.recordCompletion(toolId)` after success
- Built-in QBP writeback hook
- Optional streaming flag

Then each Phase 02+ tool just calls `QB.runClaudeAgent({ toolId, system, user, writeback: { fieldName: response => parsed } })` and gets all the funnel mechanics for free.

Effort: ~3 hours for the helper, then 1 hour saved per tool migration thereafter (~12 hours saved). Net positive after 4 tool migrations.

**Doing both A + B before the per-tool migrations would mean each tool migration is faster and cleaner.**

---

## 6. What to do BEFORE any Phase 02+ migration starts

Three things that are cheap and unblock a lot:

1. **Update model IDs.** The retired `claude-sonnet-4-20250514` is being read by 11 of 13 tools. The proxy's `ALLOWED_MODELS` whitelist still permits it but Anthropic could deprecate it any deploy. One-shot find-and-replace to `claude-sonnet-4-6` across all tools.
2. **Centralize the AI helper** (improvement B above).
3. **Add SSE streaming** (improvement A above).

Three changes, ~5 hours of work, and the codebase is meaningfully better positioned for whatever comes next.

---

## 7. What this audit deliberately does NOT recommend

- **Don't rewrite Phase 02+ tools speculatively.** Wait for funnel data. If Logo Direction has 5 monthly users and Voice Guide has 500, only Voice Guide deserves the heavy treatment.
- **Don't go Path B (Claude Agents) on Logo Direction.** Single-shot is the right pattern for "give me a brief based on this profile."
- **Don't deprecate `predictive-panel..html` to fix the double-dot filename until Path B migration.** The Vercel `/panel` rewrite handles it; renaming would require updating pricing, signal-scan recommendations, war-table handoffs, the hub TOOLS array, and journey-guide. Not worth the churn alone.
- **Don't try to share React state across Phase 02+ tools.** Doesn't compose well with vanilla JS and the cloud-synced QBP makes it unnecessary.

---

## 8. Reasonable next move

If you want a single concrete step right now without committing to the full migration:

**Centralize the AI helper + add streaming to the proxy.**

That's a 5-hour job, ships something useful immediately (every Phase 02+ tool gets faster perceived output), and creates the foundation that every subsequent migration sits on. No tool-by-tool work yet — just the substrate.

After that lands, you could pick one tool — Voice Guide is the highest-ROI candidate — and migrate it as a proof of concept. If the new pattern feels right, scale to the rest.

If the new pattern reveals issues, only one tool got rewritten, not twelve.

That's the cheapest way to de-risk the bigger Phase 02+ effort while still making real progress.
