# Rapp &amp; Esen · brand platform

Deliverable for the maison founded by Françoise Rapp and Anna Esen. Natural perfume, composed for
one person. Method: The Collapse (Observe, Collapse, Build, Hold), Phase 01 Discovery.

## Files

| File | What it is |
|---|---|
| `brand-platform.pdf` | **v1.0** · 54 A4 pages, English. The material, the platform, the expression, the name, into service. |
| `brand-platform.html` | The source. Edit this, never the PDF. |
| `render.mjs` | Renderer and layout guard. |

## Regenerate

```
node docs/clients/rapp-esen/render.mjs
```

Prints one line per page that would clip its sheet, then writes the PDF.
`no overflow` means every `.page` fits A4 with nothing cut.

## Source material

Two recorded working sessions, nine exercises and a closing forced choice.

| | Date | Length | Exercises |
|---|---|---|---|
| **S1** | 17 September 2026 | 166 min | Brands you stand with · brands you refuse · eight pairs of people |
| **S2** | 18 September 2026 | 96 min | Brand DNA · culture · the client · tone of voice · look and feel · value proposition · the joker |

Time codes in the document are prefixed `S1` or `S2` and every quotation can be found at its mark.

## What the sessions settled

- **Name.** Rapp &amp; Esen. It predates this work, is used by all three participants throughout both
  recordings, and Section IV explains what it already committed the house to. No alternatives are
  proposed.
- **The five words**, from the joker round: entrepreneurial (culture), conscious (client),
  iconoclastic (voice), chic (look and feel), recognised (value).
- **The doctrine.** *You never sell the aftermath. You sell the truth.* S1 01:01:26. It governs the
  club, the giving back, the second line and the whole of Section III.
- **The device.** The drop and the ripple, proposed by Nizzar at S1 01:26:06 and recognised instantly
  by Anna, who had recorded a podcast episode on the same image eighteen months earlier.
- **The palette.** Vert profond and Rubis come from the card Françoise pulled for the house at
  S1 00:09:43, before any exercise began. Ivory is the operator's decision, argued on pages 36 and 38.
- **The positioning triangle.** Gucci, Cartier, Oenobiol. *Scientists that are high-end luxury.*
  S2 01:24:00.

## Two corrections against the earlier draft

1. **Wealthy is not a client criterion.** It was proposed, agreed for about ninety seconds, and then
   taken apart by Nizzar and Anna together at S2 01:07:45. The five client words are influential,
   passionate, conscious, change agents, consideration.
2. **A lighter, cheaper line is permitted.** Nizzar resolved Françoise's fake-promise objection at
   S1 01:10:07: it can be sold with no promise at all. *It smells good and we like it.* An earlier
   draft banned candles outright, which contradicted the record.

## Content notes

- **No trademark search has been run.** Not in class 3, not in any jurisdiction. Page 46 says so.
- **Eleven commissions a year is an illustration**, used consistently so the arithmetic holds. It is
  almost certainly wrong. Decision 01.
- The example formula on page 44 (Marguerite L., formula 0041) is invented to show the object.
- One entry on the 18 September archetype board, the Caregiver, is not legible in the recording and
  is recorded as unknown rather than guessed.
- Six objects still need names. Page 48 sets the rules and deliberately proposes no words.

## Documented deviations from CLAUDE.md

1. **Ivory, not cream.** The sheet is `--paper:#FBFAF6` rather than Design System v3.4's
   `--cream:#FBF5E6`, per operator direction. Everything else in the chassis is v3.4 verbatim: ink,
   the gold/rose triad, the eyebrow rhythm, the two-layer card, the hard offset shadow.
2. **Supplementary fonts.** The canonical `HEAD-SNIPPET.html` font URL loads unchanged and carries the
   document. Instrument Serif, Instrument Sans and Geist Mono load from **separate** `<link>` elements
   so a failure there cannot break the chassis. They are the house's proposed faces and every specimen
   and sample in the document is set in the real face, which is the point. Same pattern as
   `war-table.html`'s supplementary Caveat link.
3. **Banned vocabulary inside verbatim material.** *Empowering*, *cutting edge*, *just*, *really*,
   *very* and *literally* appear only inside quotations from the sessions, a brand's own published
   tagline, or the lexicon entry that bans them. House prose uses none of them.
4. **Exclamation marks on page 35**, inside the deliberately-bad "before" column, annotated as the breach.

There are no em dashes in page text. The one in the `<title>` is covered by check 1's title-tag exemption.

## Layout contract

- One `<section class="page">` equals one A4 sheet. Print box is `296mm`, one millimetre under A4,
  which absorbs sub-pixel rounding; without it Chromium spills every full page onto a second sheet.
- `.page--dense`, `.page--tight` and `.page--xtight` are the progressively tighter type variants, used
  where a page runs 2 to 10 percent long.
- **Page numbers and cross-references are generated, not hand-set.** Each page carries an `id`; footers
  use `<span class="pn">` and references use `<a class="xr" href="#id">`. A script at the end of the
  body resolves both from document order, so inserting a page cannot rot a reference. A reference to a
  page that does not exist renders as `??`, which fails visibly.
- The ripple in the outer margin is generated from each page's index: the drop is small at the front and
  the rings widen to the last page. It is the house's own device, and its radius always reports position.
- Rendering needs network, for the font URLs.

## Where the two documents will sit

- **Brand platform** (this repo): who sells. Identity, voice, refusals, the visual system, the object.
- **Commercial frame** (does not exist yet, days 61 to 90 on page 52): what is sold. Prices, formulas,
  capacity, terms, and the lighter line.

When the two disagree, identity settles here and commercial detail settles there.
