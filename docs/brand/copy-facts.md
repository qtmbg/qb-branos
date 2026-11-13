# Copy facts · what every page may say

One sheet. Every claim on the site is checked against it, in English and in
French. When copy and this sheet disagree, the copy is wrong. When this sheet
and the code disagree, stop and ask the owner: the strategy record is private
and is not reconstructed from old documents.

Sources: `CLAUDE.md` (commercial model, owner decision of 3 October 2026),
`agents/registry.js`, `api/_lib/operator-only.js`, `qb-cloud.js` (access),
`api/_lib/tier-gating.js`, `tools.html`.

## The offer

| | |
|---|---|
| **Brand Profile** | Free, forever. No card. |
| **Starter** | $97 a month. Cancel anytime. Full refund within 14 days of the first payment. |
| Nothing else | No other plan is sold. No Pro, no Agency, no Studio, no one-time Platform document, no white-label, no client workspaces, no lifetime deal. |

Free covers: Signal Scan, three foundation exercises (Archetype Compass,
Brand Soul Map, Sensescape), The Profiles, the Soul Map reading, the Brand
Document. Those three exercises are what it takes to lock the foundation.

Starter adds: the two other foundation exercises (Visual DNA, War Table),
the three other foundation readings (Sensescape, Visual DNA, War Table),
the three Build agents (Logo Direction, Logo Evaluation, Voice Guide), and
the full Brand Profile export.

**Never write "every exercise is free" or "the foundation is free".** Three
exercises are. Owner decision, 13 November 2026: Visual DNA and War Table
open with Starter. `qb-cloud.js` gates both pages, `/foundation` shows them
locked, and the copy says so everywhere.

The foundation has five exercises: Archetype Compass, Brand Soul Map,
Sensescape, Visual DNA, War Table. Not four, not six.

**Hold is not open yet.** Performance Dashboard, Quarterly Brand Review and
Predictive Panel exist, are shown, and cannot be bought: Starter does not
open them and no plan that does is on sale. Copy may describe what they do.
It may not say or imply that a visitor can use them today. The app's own
words for this are "not open yet". Do not write "coming soon" or give a date.

Working with Nizzar directly is a door with no number: "Write to
me@qtmbg.com". Never a price.

## The product

- **BrandOS**, by Quantum Branding. Written exactly "BrandOS".
- **The Collapse** is the method. Its cycle: **Observe, Collapse, Build, Hold.**
- BrandOS is those four movements. It is not six phases.
- **Ten brand agents.** That is the number the site uses. Never 20, never
  "twenty". The seven content agents are operator-only and appear nowhere
  public.
- **Fourteen tools** on the tools page.
- One **Brand Profile** (the QBP, Quantum Brand Profile) behind all of them.
  Nothing is asked twice.

### Which tool sits in which movement

| Movement | Tools |
|---|---|
| **Observe** | Signal Scan, Brand Soul Map, Sensescape, The Profiles |
| **Collapse** | Archetype Compass, Visual DNA, War Table |
| **Build** | Brand Document, Logo Direction, Logo Evaluation, Voice Guide |
| **Hold** | Performance Dashboard, Quarterly Brand Review, Predictive Panel |

## One vocabulary

The numbered phases are retired from everything a visitor reads. They
contradicted each other (Logo Direction called itself "Phase 03", the
dashboard "Phase 06") and they contradicted the four movements.

| Was | Now |
|---|---|
| Phase 01, as the label of one tool | that tool's movement: "Observe" or "Collapse" |
| Phase 01, as the group ("Phase 01 tools", "every Phase 01 exercise") | "the foundation", "the foundation exercises" |
| Phase 01 reading | "foundation reading" |
| Phase 02, Brand Creation | "Build" |
| Phase 02 agents | "the Build agents" |
| Phase 05, Intelligence | "Hold" |
| Phase 03, Phase 04, Phase 06, Content Creation, Execution | gone from public copy |
| the six phases | "the four movements" |
| "Continue to Phase 02" | "Continue to Build" |

In French the movement names stay in English. "The foundation" is « la
fondation », "foundation exercises" « les exercices de la fondation »,
"foundation reading" « lecture de la fondation », "the Build agents"
« les agents Build », "the four movements" « les quatre mouvements ».

Internal names do not change: storage keys, slugs, CSS classes
(`--phase-discovery`), agent META (`phase: '01'`), comments. Only what is
painted, exported, emailed or put in a meta tag.

## Numbers

- A number stays only if the page itself makes it true: count the questions,
  the chapters, the spectrums, the steps, and write what is there.
- Durations ("5 minutes", "an hour") stay unless the page contradicts them.
- **No usage or popularity figure the repo cannot back.** Report such a line
  to the owner; do not keep it on trust and do not delete it on suspicion.
  Decided 13 November 2026: "Used by 1,000+ founders and brand builders" is
  replaced by "Built on 20 years of brand practice." (« Bâti sur 20 ans de
  pratique de marque. »), which the site already states and can stand behind.
- Verbatim and untouched: the featured-by list, the testimonials (real
  people's words, in English in both languages), "150+ reviews" with its link.

## What a rewrite may and may not do

- It may correct a false or contradicted statement, align a name, a number or
  a term, and remove a promise the product does not keep.
- It may not add a benefit, a feature, a figure, a date or a testimonial.
- It keeps the voice: short sentences, sentence case, no em dash in page
  text, no exclamation points, no banned words. A thoughtful founder, not a
  company.
- English source and French dictionary change together. A French key is the
  English text node, so a rewritten sentence needs its key rewritten too.
- The legal pages state the offer exactly as above and nothing more.
