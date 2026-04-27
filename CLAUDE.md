# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

QB BrandOS — a Brand Operating System by Quantum Branding (built by Nizzar Ben Chekroune). It is a static, no-build multi-page site of branding "tools" and "agents" (soul map, sensescape, visual DNA, war table, signal scan, content engines, etc.) backed by two Vercel Edge Functions.

## Deploy / run

- No build step. `vercel.json` sets `buildCommand: null` and `outputDirectory: "."` — Vercel serves the repo root as-is.
- Deploy: push to `main`. Vercel auto-deploys.
- Local preview: open HTML files directly, or run any static server from the repo root (e.g. `python3 -m http.server 8000`). Routes like `/os`, `/scan`, `/panel`, `/tools` are Vercel rewrites (see `vercel.json`) and will not resolve under a plain static server — use the mapped `.html` filenames locally.
- No tests, no linter, no package manager. There is no `package.json`.

## Architecture

**Pages are self-contained HTML files at the repo root.** Each tool/agent is one `*.html` file that inlines its own CSS (mix of Tailwind CDN + custom styles) and JS. Pages do not share a build pipeline; shared behavior is duplicated or pulled via `<script src="qb-results-modal.js">`.

**Routing is declarative in `vercel.json`:**
- `app.quantumbranding.ai/` → `qb-branidos-hub.html` (app subdomain → the "OS" hub)
- Root domain `/` → `index.html` (marketing site)
- Friendly aliases: `/os`, `/scan`, `/panel`, `/tools`
- SPA-style fallback: any unmatched path → `/index.html`
- CSP allows inline scripts/styles, Tailwind CDN, Google Fonts, cdnjs, unpkg, and Klaviyo — add any new third-party origin here before using it.
- `*-pdf.html` variants are print-optimized versions of the same tools (e.g. `sensescape.html` ↔ `sensescape-pdf.html`).

**Two Edge Functions in `/api`** (set `export const config = { runtime: 'edge' }`):
- `api/claude.js` — proxy to Anthropic. All client-side tools POST to `/api/claude` so the `ANTHROPIC_API_KEY` never reaches the browser. Allowed models are whitelisted in `ALLOWED_MODELS` — update that array when adding a new model.
- `api/send-results.js` — handles the "send me my results" flow: Resend email (required `RESEND_API_KEY`), optional Klaviyo lead sync (`KLAVIYO_PRIVATE_KEY`), optional Supabase logging (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). Tool IDs are mapped to human labels in `TOOL_LABELS`; add new tools there.

**Shared results modal:** `qb-results-modal.js` exposes `window.QB_showResultsModal({ toolId, qbp, results })`. Phase-01 tools load it via `<script src="qb-results-modal.js">` and call it to capture lead info → POST to `/api/send-results`. The `qbp` object is a shared Quantum Brand Profile payload passed between tools.

**QBP fields written by tools** (read via `localStorage["qb_qbp"]`; tools merge their outputs in):
- Brand Soul Map: `brandName`, `archetype`, `brandEssence`, `manifesto`, `primaryPersona`, `fanLetter`
- War Table: `warTableBrief`, `strategicPriorities`, `warTableCompletedAt`
- The Profiles: `personaProfiles` — array of 3 buyer briefs, each `{ name, role, opening, coreIdentity, mindset, hook, painPoints[5], marketingApproach[5], journey[5], xray, keyTakeaways[5] }` — plus `commonThemes[]`, `bindingInsight`, `sharedKeyTakeaways[]`, `profilesComplete`, `profilesTimestamp`

**Assets:** `/img` holds shared imagery and `.mov`/`.png` hero media. Everything else (per-tool illustrations, data) is inlined.

## Conventions when editing

- Never hardcode API keys — always route through `/api/claude` or `/api/send-results`.
- When adding a new tool page, mirror an existing one (styles, fonts, modal integration) rather than inventing structure — there is no component system to inherit from.
- When adding a new route alias or subdomain behavior, edit `vercel.json`; do not rely on client-side routing.
- When adding a new Anthropic model, add it to `ALLOWED_MODELS` in `api/claude.js`.
- `predictive-panel..html` has a double-dot filename; the `/panel` rewrite targets `/predictive-panel.html` (single dot) — be careful not to break the mismatch when renaming.
