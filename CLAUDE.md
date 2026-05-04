# CLAUDE.md
## QB BrandOS · Repository Instructions for Claude Code

You are working inside the Quantum Branding QB BrandOS codebase. This file is the entry point. It is read automatically at the start of every session in this directory.

---

## CRITICAL · Self-check before sending every response

Before sending any response in this repository, run this five-point check on YOUR OWN draft. Not on the user's input. On the words you are about to send. If any check fails, rewrite the affected sentences before sending. Do not send the response and apologize for the violation afterward.

This check applies to every response in this repository. It applies to chat replies, code comments, generated copy, documentation, error messages, commit messages, and explanations of the voice rules themselves. The codex is enforced on its own explanations. There is no exception.

**Check 1. Em dashes.** Search your draft for the character `—` (em dash, U+2014). If present, rewrite. Replace with a period, a comma, or two sentences. The em dash is the AI tell of the moment. Its presence is a brand violation. This rule has no exceptions, including in sentences about the rule itself.

**Check 2. Banned phrases.** Search for: empower, unlock, supercharge, seamless, AI-powered, AI-driven, take to the next level, stand out from the crowd, in order to, at the end of the day, world-class, best-in-class, cutting-edge, robust, frictionless, effortless, leverage (as a verb), journey (as user path), really, very, just, literally. If any are present, rewrite.

**Check 3. Exclamation points.** Search for `!` outside literal in-product user-celebration moments. If any in marketing copy, prose, or explanation, remove.

**Check 4. Casing.** Confirm headlines are sentence case. Confirm "quantum branding" is lowercase italic, even at sentence start. Confirm "QB BrandOS" uses exact casing (never "QB Brandos," "QB Brand OS," "qb brandos").

**Check 5. Voice register.** Read the draft aloud. If it sounds like a corporate explanation rather than a thoughtful founder, rewrite.

If you finish writing a response and realize a violation is in it, do not send the response and apologize. Edit the response and send the corrected version.

---

## The canonical documents

Read these in order on first session in this repo. Re-read on demand when working on relevant files.

1. `/docs/brand/qb-brand-codex-v1.md`. The absolute brand truth. Identity, beliefs, the QBP, six phases, four doors, voice summary, visual language summary, brand mark, colours, illustrations, personas, pricing, platform, public credentials.

2. `/docs/brand/qb-design-system-v3.4.md`. The technical visual specification. Color tokens, typography, spacing, components, layout patterns. Part 21 contains the brand mark SVG paths.

3. `/docs/brand/qb-voice-codex-v1.md`. The written voice. Voice anchors, mechanics, banned word list, surface-by-surface guide, persona flexes, voice tests.

4. `/docs/brand/qb-illustration-style-lock-v1.md`. Illustration generation rules. Master prompt for the Character Machine. Brand mark relationship.

5. `/docs/brand/qb-master-instruction-v5.md`. The QB Thinking Machine system prompt. Strategic framing, tool inventory, ecosystem logic.

When these documents conflict, the order above is the priority order. The Brand Codex is the highest authority.

---

## Critical rules (always apply, never override)

These are the rules that are violated most often. They are non-negotiable.

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
- AI calls go to the Anthropic API with `claude-sonnet-4-20250514` or the latest Sonnet.
- Every agent tool includes the Content Approval Loop (up to 3 revision rounds per output).

### Voice

The voice rules at the top of this file are mandatory and self-applied. The full Voice Codex at `/docs/brand/qb-voice-codex-v1.md` adds detail, surface-specific guidance, and persona flexes. Both apply at all times.

Additional voice rules:

- The user is "you." The system is the speaker. The company recedes.
- The wordmark "quantum branding" is always lowercase italic Fraunces.
- "QB BrandOS" is the product name with exact casing.
- Sentence fragments with periods are encouraged. "Three steps. That's it." reads better than "Three steps; that is all there is."
- Contractions are allowed and encouraged. "Don't" reads warmer than "do not."
- Pronouns: "you" is the user, "we" is sparingly the company, "I" only in founder voice.

### Brand mark

- The brand mark SVG files live at `/img/brand/`. Do not invent paths. Do not redraw the mark.
- Four colourways exist and only four: ink, gold, rose, reverse. Files: `mark-ink.svg`, `mark-gold.svg`, `mark-rose.svg`, `mark-reverse.svg`.
- Two lockups exist: horizontal (mark left, wordmark right) and vertical (mark above, wordmark below). Files: `lockup-h-ink.svg`, `lockup-h-gold.svg`, `lockup-v-ink.svg`, `lockup-v-gold.svg`.
- Clear space around the mark equals the wordmark x-height. Nothing crosses that boundary.
- The wordmark is `quantum branding` set in Fraunces italic, weight 600, SOFT axis 60, lowercase.
- Web favicon and OG share image assets live at `/img/brand/web/` and `/img/brand/og/`. Reference the head template at `/HEAD-SNIPPET.html` for canonical wiring.

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
│       ├── multi-brand.png
│       ├── guide.png
│       ├── synergy.png
│       ├── three-steps.png
│       ├── start-building.png
│       ├── phase-04.png
│       ├── phase-05.png
│       └── founder-portrait.png
│
├── api/                       serverless functions (Vercel)
├── *.html                     the 25 production tool/page files
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
| `multi-brand.png` | The Multi-Brand persona (Door 04). Figure holding oversized framed portrait. | Persona cards, "I build for clients" door, agency tier. |
| `guide.png` | The Guide character. Figure on tandem bicycle, two riders, partnership. | journey-guide.html, navigation contexts. |
| `synergy.png` | Ecosystem scene. House cutaway with multiple figures. | ecosystem.html connection visualization. |
| `three-steps.png` | "How it works" scene. Figure with feet up, two figures stacked on shoulders. | index.html "Three steps. That's it." section. |
| `start-building.png` | Final CTA scene. Group photo shoot with plant headpiece. | index.html final CTA, "Start building" sections. |
| `phase-04.png` | Phase 04 Execution scene. Production studio with crew, spotlights, sticky notes. | ecosystem.html Phase 04 mock card. |
| `phase-05.png` | Phase 05 Intelligence scene. Group in park with phones, social moment. | ecosystem.html Phase 05 mock card. |
| `founder-portrait.png` | Founder block. Figure at desk with headphones, world map. | index.html "From the founder" section. Restricted: never use this file outside the founder block. |

### Rules of use for illustrations

- Every illustration sits inside a `qb-illus-card` frame (cream-card surface, 2px ink border, hard offset shadow). Never as a bare floating image.
- The illustration palette is locked. Do not recolor an illustration via CSS filters. Use the file as delivered.
- Persona illustrations are paired with their door: `blank-slate` with Door 01, `doubter` with Door 02, `player` with Door 03, `multi-brand` with Door 04. Do not swap.
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

*CLAUDE.md · QB BrandOS · April 2026*
*Read this. Run the self-check. Read the canonical docs. Build accordingly.*
