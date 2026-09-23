# CLAUDE.md
## BrandOS · Repository Instructions for Claude Code

You are working inside the Quantum Branding BrandOS codebase. This file is the entry point. It is read automatically at the start of every session in this directory.

---

## CRITICAL · Self-check before sending every response

Before sending any response in this repository, run this five-point check on YOUR OWN draft. Not on the user's input. On the words you are about to send. If any check fails, rewrite the affected sentences before sending. Do not send the response and apologize for the violation afterward.

This check applies to every response in this repository. It applies to chat replies, code comments, generated copy, documentation, error messages, commit messages, and explanations of the voice rules themselves. The codex is enforced on its own explanations. There is no exception.

**Check 1. Em dashes.** Search your draft for the character `—` (em dash, U+2014). In page text, rewrite it. Replace with a period, a comma, or two sentences. The em dash is the AI tell of the moment, and in body copy its presence is a brand violation. This applies to sentences about the rule itself.

Page text means body copy, headlines, UI strings, generated copy, documentation, error messages, commit messages, and chat replies. Three surfaces sit outside the rule and keep the em dash where the brand calls for it: title tags, navigation separators, and breadcrumbs.

**Check 2. Banned phrases.** Search for: empower, unlock, supercharge, seamless, AI-powered, AI-driven, take to the next level, stand out from the crowd, in order to, at the end of the day, world-class, best-in-class, cutting-edge, robust, frictionless, effortless, leverage (as a verb), journey (as user path), really, very, just, literally. If any are present, rewrite.

**Check 3. Exclamation points.** Search for `!` outside literal in-product user-celebration moments. If any in marketing copy, prose, or explanation, remove.

**Check 4. Casing.** Confirm headlines are sentence case. Confirm the parent practice is written "Quantum Branding" in title case. Confirm the method is written "The Collapse" in title case, and its cycle as "Observe, Collapse, Build, Hold." Confirm the wordmark glyph "quantum branding" is lowercase italic, even at sentence start.

**The name BrandOS never takes a case transform.** The internal capital carries the meaning. `uppercase`, `lowercase` and `capitalize` are all forbidden on it, in CSS and in prose. Write it "BrandOS" and nothing else: never "BRANDOS," "brandos," "Brandos," "Brand OS," or "QB BrandOS."

This binds CSS as much as copy. An element that sets `text-transform: uppercase` recases the name even when the markup is correct, so the markup reads right while the screen reads wrong. When the surrounding label wants upper case, isolate the name:

```html
<div class="tools-hero_eye">The <span class="brandos-name">BrandOS</span> toolkit</div>
```

The global rule lives after each page's own uppercase styles, and in `css/qb-components.css` for pages that load it:

```css
.brandos-name, .qb-lockup_name { text-transform: none !important; }
```

Every wordmark span carries `brandos-name` alongside `qb-lockup_name`. Enforced by `node tests/brand-casing/casing-audit.mjs`, which renders all 48 pages at 390px and 1280px and fails if "BRANDOS" or "brandos" reaches the painted text. Run it before shipping any change that touches a label, an eyebrow, or a caption.

**Check 5. Voice register.** Read the draft aloud. If it sounds like a corporate explanation rather than a thoughtful founder, rewrite.

If you finish writing a response and realize a violation is in it, do not send the response and apologize. Edit the response and send the corrected version.

---

## The canonical documents

**0. `/docs/strategy/brandos-recut-v1.md`.** Read this first. The 2026-09-20 recut
decided what the product is and what it costs, and it supersedes the phase model and
the pricing in every document below. Two prices, $0 and $79. Four movements, not six
phases. Eleven public agents, not twenty.

Read the rest in order on a first session in this repo. Re-read on demand when working on relevant files.

1. `/docs/brand/qb-brand-codex-v1.md`. The absolute brand truth. Identity, beliefs, the QBP, the phase model (superseded by the recut, see 6 below), four doors, voice summary, visual language summary, brand mark, colours, illustrations, personas, pricing, platform, public credentials.

2. `/docs/brand/qb-design-system-v3.4.md`. The technical visual specification. Color tokens, typography, spacing, components, layout patterns. Part 21 contains the brand mark SVG paths.

3. `/docs/brand/qb-voice-codex-v1.md`. The written voice. Voice anchors, mechanics, banned word list, surface-by-surface guide, persona flexes, voice tests.

4. `/docs/brand/qb-illustration-style-lock-v1.md`. Illustration generation rules. Master prompt for the Character Machine. Brand mark relationship.

5. `/docs/brand/qb-master-instruction-v5.md`. The QB Thinking Machine system prompt. Strategic framing, tool inventory, ecosystem logic.

When these documents conflict, the order above is the priority order. The Brand Codex is the highest authority.

---

## Critical rules (always apply, never override)

These are the rules that are violated most often. They are non-negotiable.

### Merge gate protocol

When the user issues a hold instruction such as "branch only", "do not merge", "wait for approval", "do not touch main", or any equivalent phrasing, that instruction is a hard gate. The following rules apply until the user explicitly releases the gate in chat:

1. Do not merge the working branch to main. Not via direct merge, fast-forward, squash, rebase-and-merge, or PR auto-merge.
2. Do not commit to main directly.
3. If a commit lands on main from any other source (another agent, the user, a CI process) while the gate is active, STOP. Do not continue work on top of those changes. Report the new commit hashes to the user in chat and wait for instructions.
4. Do not bundle the held work into an unrelated commit on main, even if the unrelated commit is small or appears safe.
5. The gate releases only when the user types "approved, merge" or equivalent explicit release language. Inferred approval from context does not count.
6. Apologizing for a breach after the fact does not retroactively authorize the merge. If a breach occurs, the response is: report, stop, wait.

### Registry merge gate (standing, all chapters)

Any merge touching `agents/`, the registry, or the dispatch path requires both halves, in order:

1. Pre-merge: run `node scripts/registry-smoke.mjs` locally (it sets all test flags itself) and record its output verbatim in the PR body. A "verified" claim without this output is invalid.
2. Post-deploy: probe `POST /api/agents/run` and `GET /api/agents/console` unauthenticated and confirm handler-level 401. Any 500 FUNCTION_INVOCATION_FAILED means revert immediately, then surface.

Origin and full rationale: `docs/patterns/registry-merge-gate.md` (the 2026-06-10 cold-start outage, PRs #170 → #171 → #172 → #173). The load-time META validation stays unconditional; this gate moves detonation from production to a local terminal.

### Audit harnesses

Never truncate text before comparing it. A sweep that slices a string and then tests the slice reports a verdict about the part of the page that happened to fit, so a dirty page comes back clean. This is not hypothetical: `tests/auth-flow/auth-flow.mjs` matched its success-view regex against `innerText.slice(0, 200)`, and the match sat at index 182. Eighteen characters of margin, and one extra nav word would have turned a passing check into a false alarm.

The rules:

- Compare against the complete string. Slice only when building a human-readable failure line, and say so in a comment.
- Never cap a findings array (`.slice(0, 20)` on offenders, nodes, errors). Detection survives a cap, but counts and evidence do not, so a report shows `n: 20` for a page with fifty problems.
- Read what the browser paints (`innerText`), not what the markup says, whenever CSS can change the text. `text-transform` is invisible to a source grep.
- A harness that cannot fail is worth nothing. Prove both directions: break the thing on purpose, confirm the run exits 1 and names the offender, then restore and confirm it exits 0.

### Code

- Vanilla HTML, CSS, and JavaScript only. No frameworks, no JSX in raw HTML, no build step required.
- Every file is fully self-contained. No external dependencies beyond Google Fonts.
- All colours come from the `:root` CSS variable block. Never hardcode a hex value outside `:root`.
- All spacing comes from the `--space-*` clamp scale. Never hardcode rem or px values for spacing.
- All type sizes come from the `--step-*` clamp scale. Never hardcode font sizes.
- Mobile-first responsive. Always.
- `localStorage` is the persistence layer for tool state and the QBP.
- Reduced-motion is respected on every animation.
- All tools accept `?apikey=`, `?provider=`, and `?qbp=` URL parameters. White-label entry points additionally accept `?brand=`, `?color=`, `?client=`. Signal Scan additionally accepts `?kpk=` and `?kli=`.
- **Two providers, one call site.** Every agent reaches a model through `agents/model-call.js` and nothing else. The provider is chosen from the model id, so moving an agent is editing its `META.model`.
  - **Free path: Google, free tier.** The eleven public agents run `gemini-3.5-flash` on Google's free tier, because the foundation is free under the recut and model cost is the free tier's main variable cost. Google's free tier uses prompts and responses to improve their products; that is accepted, operator decision 2026-09-23. This narrows the older Anthropic-only rule.
  - **Paid path and operator tools: Anthropic.** The seven operator-only content agents stay on `claude-sonnet-4-6`. The $79 document is assembled from agent prose, so the purchase path re-runs the agents with `runtime_args.model_override` set to a Sonnet id. Overrides are validated against `CANONICAL_MODELS`; an unknown id falls back rather than reaching a provider.
  - `api/claude.js` keeps `claude-sonnet-4-6` as its default. Update it and `ALLOWED_MODELS` together when changing that, and add any new id to `CANONICAL_MODELS` in `agents/contract.js` or META validation will reject it.
  - Enforced by `node tests/model-routing/model-routing.mjs`.
- Every agent tool includes the Content Approval Loop (up to 3 revision rounds per output).

### Voice

The voice rules at the top of this file are mandatory and self-applied. The full Voice Codex at `/docs/brand/qb-voice-codex-v1.md` adds detail, surface-specific guidance, and persona flexes. Both apply at all times.

Additional voice rules:

- The user is "you." The system is the speaker. The company recedes.
- The product is **BrandOS**. Its full display name is "BrandOS by Quantum Branding". Use the short form in running copy.
- **Quantum Branding** is the parent practice, not the product. Every reference to the practice links to `https://thequantumbranding.com`.
- The method is **The Collapse**. Its cycle is Observe, Collapse, Build, Hold. It belongs to Quantum Branding, the practice, and since the recut BrandOS *is* the four movements rather than six phases that implement them.
- "quantum branding" in lowercase italic Fraunces is the wordmark glyph of the practice. It names the mark, and The Collapse names the method.
- "BrandOS" is the single product name. It is the name under which Quantum Branding contracts, so the legal copy in `terms.html` and `privacy.html` uses it and nothing else. Expanding it to "QB BrandOS" reopens a second name.
- Sentence fragments with periods are encouraged. "Three steps. That's it." reads better than "Three steps; that is all there is."
- Contractions are allowed and encouraged. "Don't" reads warmer than "do not."
- Pronouns: "you" is the user, "we" is sparingly the company, "I" only in founder voice.

### Brand mark

- The brand mark SVG files live at `/img/brand/`. Do not invent paths. Do not redraw the mark.
- Four colourways exist and only four: ink, gold, rose, reverse. Files: `mark-ink.svg`, `mark-gold.svg`, `mark-rose.svg`, `mark-reverse.svg`.
- Two lockups exist: horizontal (mark left, wordmark right) and vertical (mark above, wordmark below). Files: `lockup-h-ink.svg`, `lockup-h-gold.svg`, `lockup-v-ink.svg`, `lockup-v-gold.svg`.
- Clear space around the mark equals the wordmark x-height. Nothing crosses that boundary.
- The product wordmark is a two-line lockup: `BrandOS` in the surrounding display face, with `by Quantum Branding` set smaller directly beneath it. Markup and CSS are in `/HEAD-SNIPPET.html` and `/CHASSIS-MARKUP-SNIPPET.html` under `id="qb-lockup-css"`:

```html
<span class="qb-lockup">
  <span class="qb-lockup_name">BrandOS</span>
  <span class="qb-lockup_by">by Quantum Branding</span>
</span>
```

- The endorsement line is never dropped from the nav or footer lockup.
- The practice wordmark `quantum branding` remains Fraunces italic, weight 600, SOFT axis 60, lowercase. It belongs to thequantumbranding.com, not to the product chassis.
- Web favicon and OG share image assets live at `/img/brand/web/` and `/img/brand/og/`. Reference the head template at `/HEAD-SNIPPET.html` for canonical wiring.

### Naming and metadata

- Title tag on the homepage and in `HEAD-SNIPPET.html`: `BrandOS by Quantum Branding — Idea in, brand out`. The em dash there is deliberate and stays; check 1 covers page text. Other pages use `<page> · BrandOS`, page name first.
- `og:site_name` is `BrandOS by Quantum Branding` on every page.
- JSON-LD: the `Organization` node is Quantum Branding, the practice, with `url` pointing at `https://thequantumbranding.com/`. The `WebSite` and `SoftwareApplication` nodes are BrandOS on `quantumbranding.ai`.
- **No geolocation in metadata or JSON-LD.** No `address`, `areaServed`, `geo`, `geo.region`, `geo.placename`, or `ICBM`. Jurisdiction stays in the legal body copy of `privacy.html` and `terms.html`, where it is legally required, and nowhere else.
- Every page footer carries: "BrandOS is a product of Quantum Branding, the independent practice founded by Nizzar Ben Chekroune." with the practice name linked to `https://thequantumbranding.com`.
- Copyright lines stay `© Quantum Branding`. The practice owns the copyright; the product does not.
- The domain `quantumbranding.ai` does not change.

### The method

- The method is **The Collapse**. Cycle: **Observe, Collapse, Build, Hold.**
- Canonical phrasing, to adapt to context rather than paste verbatim: "The Collapse, the method used at Quantum Branding: Observe, Collapse, Build, Hold."
- PDF colophons and cover meta carry `Methodology · The Collapse` with the cycle beneath it.
- The four movements are the product. Observe covers Acquisition and Discovery, Collapse closes Discovery, Build is Brand Creation, Hold is Intelligence. The old Phase 03 (Content) and Phase 04 (Execution) are empty: their seven agents are operator-only behind `api/_lib/operator-only.js`.

### Typography

- The canonical type stack is **Fraunces** (display), **Inter** (body and UI), **JetBrains Mono** (labels and captions). Every web page in the repo loads the same canonical Google Fonts URL. The required `<link>` block lives in `/HEAD-SNIPPET.html` and is the single source of truth for the font import.
- The canonical URL is the minimal-superset of every weight and axis value actually used in CSS: Fraunces `ital 0+1, opsz 9..144, wght 300..800, SOFT 50..100, WONK 0..1` · Inter `wght 400..800` · JetBrains Mono `wght 400..700`. SOFT 50-70 is reserved for the wordmark and headline styles. Do not add weights outside this range without updating both the URL and `HEAD-SNIPPET.html` first.
- All font families must be referenced through CSS variables in `:root` (`--font-display`, `--font-body`, `--font-mono`, or any per-page synonyms already in use). Never hardcode a `font-family: 'Fraunces'` outside `:root`.
- **DM Serif Display is not a web font.** It is retained only inside `qb-pptx-export.js` for PowerPoint deck export, because PowerPoint variable-font support is inconsistent on older versions and a static fallback prevents broken decks. The web codex is Fraunces.
- Documented typography exceptions (do not copy the canonical block onto these pages):
  - `the-profiles.html` — eight archetype-themed fonts plus Caveat. Locked. Do not touch its font URLs.
  - `archetype-compass.html` — canonical Fraunces stack plus a supplementary archetype-themed set (Archivo Black, Cormorant Garamond, DM Sans, EB Garamond, Figtree, Lora, Playfair Display, Space Grotesk). Required to render the twelve archetype previews.
  - `war-table.html` — canonical Fraunces stack plus a supplementary Caveat link for signature-scrawl elements.
- Loading pattern is non-render-blocking: `<link rel="preload" ... onload="this.onload=null;this.rel='stylesheet'">` plus a `<noscript>` fallback. The pattern is in `HEAD-SNIPPET.html`. Do not regress to a blocking `rel="stylesheet"` link.

### Illustrations

- Illustration palette is locked to seven colours: forest #5B7E6A, peach #E89380, coral #DC6B52, mustard #D4B85A, rust #B8704D, lavender #B8A0C7, pink-soft #F4C4D0.
- Illustration outlines use ink #2D1521.
- Five named characters anchor the universe: The Blank Slate, The Doubter, The Player, The Multi-Brand, The Guide.
- New illustrations are generated through the QB Character Machine (the canonical generator). Manual additions follow the same Style Lock.
- Illustrations sit inside `qb-illus-card` frames. They never appear as bare floating images.

### Content production

- No invented testimonials, client quotes, statistics, or brand engagements.
- No manufactured urgency, countdown timers, or fake scarcity.
- The featured-by list is verbatim: USAID, TV5 Monde, LA Lakers, UM6P, UNIDO, The New York Times, Time Magazine, Google Arts & Culture.
- The banner copy is a system constant. Verbatim: "Signal Scan is live. Free brand diagnostic. 5 minutes to your first insight. Run yours →"

### Filenames

- `predictive-panel..html` has an intentional double-dot. Do not "fix" it.
- Asset names are kebab-case. No version numbers in filenames. Versions live in the repo, not the asset name.

---

## File locations reference

```
/                              repo root
├── CLAUDE.md                  this file
├── HEAD-SNIPPET.html          canonical <head> template for new pages
│
├── docs/brand/                canonical brand documentation (read on demand)
│   ├── qb-brand-codex-v1.md
│   ├── qb-design-system-v3.4.md
│   ├── qb-voice-codex-v1.md
│   ├── qb-illustration-style-lock-v1.md
│   └── qb-master-instruction-v5.md
│
├── img/
│   ├── brand/                 brand mark, lockups, favicons, OG image
│   │   ├── mark-ink.svg
│   │   ├── mark-gold.svg
│   │   ├── mark-rose.svg
│   │   ├── mark-reverse.svg
│   │   ├── mark-favicon.svg
│   │   ├── mark-favicon-32.png
│   │   ├── mark-app-icon-1024.png
│   │   ├── lockup-h-ink.svg
│   │   ├── lockup-h-gold.svg
│   │   ├── lockup-v-ink.svg
│   │   ├── lockup-v-gold.svg
│   │   ├── qb-logo-system.html
│   │   ├── web/               favicons, manifest, Safari pinned tab
│   │   └── og/                Open Graph share image
│   │
│   └── illus/                 editorial illustrations (closed inventory)
│       ├── blank-slate.png
│       ├── doubter.png
│       ├── player.png
│       ├── agency.png
│       ├── guide.png
│       ├── synergy.png
│       ├── three-steps.png
│       ├── start-building.png
│       ├── phase_4.png
│       ├── phase_5.png
│       └── nizzarfounder.png
│
├── api/                       serverless functions (Vercel)
├── *.html                     the production tool/page files (count not pinned · see below)
├── vercel.json                routing
├── stripe-webhook.ts          payment events
└── supabase-setup.sql         schema
```

---

## Illustration inventory

The QB illustration library is closed and lives at `/img/illus/`. Reference these files by their exact filenames. Do not invent variants. Do not substitute placeholders. Do not generate inline SVG when an inventoried illustration applies to the slot.

| File | Character or scene | Used in |
|---|---|---|
| `blank-slate.png` | The Blank Slate persona (Door 01). Solo skater with coffee, drink-in-hand pose. | Persona cards, "I have an idea" door. |
| `doubter.png` | The Doubter persona (Door 02). Seated figure at café table, hand-on-chin contemplative. | Persona cards, "Something feels off" door. |
| `player.png` | The Player persona (Door 03). Runner with dog on leash, forward motion. | Persona cards, "Competition coming fast" door. |
| `agency.png` | The Multi-Brand persona (Door 04). Figure holding oversized framed portrait. | Persona cards, "I build for clients" door, agency tier. |
| `guide.png` | The Guide character. Figure on tandem bicycle, two riders, partnership. | Navigation contexts. (Was used by `journey-guide.html`, retired in Chapter 1 step 12; file archived under `/_archive/chapter-1-deprecations/` step 16.) |
| `synergy.png` | Ecosystem scene. House cutaway with multiple figures. | ecosystem.html connection visualization. |
| `three-steps.png` | "How it works" scene. Figure with feet up, two figures stacked on shoulders. | index.html "Three steps. That's it." section. |
| `start-building.png` | Final CTA scene. Group photo shoot with plant headpiece. | index.html final CTA, "Start building" sections. |
| `phase_4.png` | Phase 04 Execution scene. Production studio with crew, spotlights, sticky notes. | ecosystem.html Phase 04 mock card. |
| `phase_5.png` | Phase 05 Intelligence scene. Group in park with phones, social moment. | ecosystem.html Phase 05 mock card. |
| `nizzarfounder.png` | Founder block. Figure at desk with headphones, world map. | index.html "From the founder" section. Restricted: never use this file outside the founder block. |

### Rules of use for illustrations

- Every illustration sits inside a `qb-illus-card` frame (cream-card surface, 2px ink border, hard offset shadow). Never as a bare floating image.
- The illustration palette is locked. Do not recolor an illustration via CSS filters. Use the file as delivered.
- Persona illustrations are paired with their door: `blank-slate` with Door 01, `doubter` with Door 02, `player` with Door 03, `agency` with Door 04. Do not swap.
- The founder portrait is restricted to the founder block. Using it elsewhere implies endorsement.
- If a slot needs an illustration that is not in this inventory, flag it as a missing asset and stop. Do not substitute an unrelated file.
- New illustrations enter the library only through the QB Character Machine using the master prompt in Illustration Style Lock Section 10. The inventory is not extended ad hoc.

### Standard usage pattern for illustrations

```html
<figure class="qb-illus-card">
  <img src="/img/illus/blank-slate.png"
       alt="Solo skater with coffee, the Blank Slate persona"
       loading="lazy">
</figure>
```

```css
.qb-illus-card {
  background: var(--cream-card);
  border: 2px solid var(--ink);
  border-radius: var(--radius-card);
  padding: var(--space-l);
  box-shadow: var(--shadow-card-mobile);
  overflow: hidden;
}
.qb-illus-card img {
  width: 100%;
  height: auto;
  display: block;
}
@media (min-width: 640px) {
  .qb-illus-card { box-shadow: var(--shadow-card-desktop); }
}
```

The `qb-illus-card` pattern is documented in Design System v3.4 Part 17.

---

## What "production-ready" means in this repo

A file is production-ready when:

- All visible UI uses CSS variables from `:root`. No hardcoded colours, spacing, or type sizes.
- Voice passes the tests in `qb-voice-codex-v1.md` Part 7. No em dashes. No banned phrases.
- The brand mark, where used, references `/img/brand/` files. Never inline-redrawn.
- Illustrations, where used, reference inventoried files from `/img/illus/`. Never substitute placeholders.
- The `<head>` follows `/HEAD-SNIPPET.html` for favicon, OG, and meta tags.
- Mobile-first responsive at minimum 360px viewport.
- Reduced-motion respected on every animation.
- API calls handle errors with the QB error empty-state pattern, not generic alerts.
- localStorage reads the QBP on load and writes back on completion where applicable.
- Self-contained: opens and runs without a build step beyond serving the file.

There is no intermediate state between "in progress" and "production-ready." A file is either shippable or it is being worked on.

---

## When in doubt

When the documentation does not cover a case:

1. Check the Brand Codex first. It is the highest authority.
2. Check the Design System for the visual implementation pattern.
3. Check the Voice Codex for any user-facing copy.
4. Search existing locked files (`signal-scan.html`, `index.html`, `ecosystem.html`) for the established pattern.
5. If still unresolved, ask before guessing. Do not invent brand decisions.

---

*CLAUDE.md · BrandOS · April 2026*
*Read this. Run the self-check. Read the canonical docs. Build accordingly.*
