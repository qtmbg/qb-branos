# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ABSOLUTE SOURCES OF TRUTH — READ FIRST (in order)

1. **[`qb-design-system-v3.3.md`](qb-design-system-v3.3.md)** is the SOT for **visual, motion, and interaction design**. v3.3 is Pomegranate-derived (cream + aubergine ink, two-layer 3D pill button, hard offset shadow, eyebrow-tag-then-Fraunces-headline structure, fluid clamp scales, New Yorker editorial illustrations inside cream-card frames). It supersedes v3.0/v3.1/v3.2 and the design block in Part 5 of `QB_THINKING_MACHINE.md`. Drop in the full `:root` block from Part 11 verbatim — no deviation. Components (`qb-button`, `qb-tag`, `qb-card`, `qb-field`, `qb-switch`, `qb-bubble`, `qb-illus-card`, `qb-hover-video`, `qb-marquee`, `qb-faq`, `qb-phone`, `qb-mock-card`, `qb-progress`) live in Parts 9, 17.5, 18, 19. Migration plan + waves live in Part 13.

2. **[`QB_THINKING_MACHINE.md`](QB_THINKING_MACHINE.md)** is the SOT for **product, identity, strategy, operations**: the Quantum Branding Thinking Machine identity, QBP, four doors, six phases, weakest persona principle, illustration asset library (Part 6), pricing tiers, code production standards (vanilla JS, self-contained files, mobile-first, reduced-motion, localStorage, Anthropic API), and operating principles. The design block in Part 5 of this doc is **superseded by v3.3** — when they disagree on visual / motion / interaction, v3.3 wins.

When something below contradicts either SOT, the SOT wins — and update this file.

**Model note:** the v3.3 spec's Part 15 prompt mentions `claude-sonnet-4-20250514`; that is stale. The locked default in `api/claude.js` is `claude-sonnet-4-6` (the retired ID is kept in `ALLOWED_MODELS` only for transition). Do not change API code based on the v3.3 prompt.

## Project

QB BrandOS — a Brand Operating System by Quantum Branding (built by Nizzar Ben Chekroune). Static, no-build multi-page site of 20 AI agents across 6 phases, backed by two Vercel Edge Functions. Sole product. Domain `quantumbranding.ai` (marketing) + `app.quantumbranding.ai` (the OS hub).

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

**Assets:** `/img` holds the 11-illustration library inventoried in Part 6 of `QB_THINKING_MACHINE.md`. Always reference an illustration by filename — never invent. If a slot needs an illustration that does not exist in the inventory, flag it as missing rather than substituting an unrelated one.

## Conventions when editing (locked — see `qb-design-system-v3.3.md` for design, `QB_THINKING_MACHINE.md` Part 15 for code/product)

- **Agent count is 20.** Not 19. Update every visible reference if you touch a page that mentions it.
- **Live `quantumbranding.ai` is the SOT** for marketing copy, section ordering, pricing, testimonials. Diff before inventing.
- **`:root` block from v3.3 Part 11 is verbatim.** Drop it into every HTML file `<style>` head — no deviation, no inventing token names. CSS variables only outside that block.
- **Vanilla JS only.** No framework. No JSX. No build step.
- **Self-contained files.** No external deps beyond Google Fonts.
- **Mobile-first responsive. Always.**
- **Reduced-motion respected** on every animation.
- **localStorage** is the persistence layer for tool state and the QBP.
- **Never hardcode API keys** — proxy through `/api/claude` or `/api/send-results`.
- **Anthropic model:** `claude-sonnet-4-6` (current default in `api/claude.js`). The retired `claude-sonnet-4-20250514` is kept in `ALLOWED_MODELS` for transition; do not write new code against it. Update `ALLOWED_MODELS` when adding any new model.
- **No invented social proof.** Real testimonials verbatim, or honest placeholder, never fabricated.
- **No chassis-without-soul.** A technically clean implementation that drops the editorial / illustration layer is a regression, not a refactor.
- **Voice is aphoristic and declarative.** Reject folksy headlines (e.g. *"Free fries. Paid steaks."*).
- **Banner copy** across pages: *"**Signal Scan is live.** Free brand diagnostic. 5 minutes to your first insight. Run yours →"* — older banners are deprecated.
- **Illustration filenames** must come from the Part 6 inventory of `QB_THINKING_MACHINE.md`. Never invent filenames; never use the founder portrait outside the founder block.
- **`predictive-panel..html`** has a real double-dot in the filename — `vercel.json` rewrite expects `predictive-panel.html` (single dot). Don't "fix" the typo.
