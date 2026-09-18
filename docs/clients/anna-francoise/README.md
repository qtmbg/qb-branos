# Anna Esen &amp; Françoise Rapp · brand platform

Deliverable for the bespoke natural perfume house founded by Anna Esen and Françoise Rapp.
Method: The Collapse (Observe, Collapse, Build, Hold), Phase 01 Discovery.

## Files

| File | What it is |
|---|---|
| `plateforme-de-marque.pdf` | **v1.0** · the brand platform. 44 A4 pages, English. Archetypes, culture, client, beliefs, values, voice, visual direction, the object, the name, ninety days. |
| `plateforme-de-marque.html` | The source. Edit this, never the PDF. |
| `render.mjs` | Renderer and layout guard. |

## Regenerate

```
node docs/clients/anna-francoise/render.mjs
```

Prints one line per page that would clip its sheet, then writes the PDF.
`no overflow` means every `.page` fits A4 with nothing cut.

## Source material

One working session, 18 September 2026, ninety-six minutes, recorded. Three exercises ran:
brand DNA against a board of twelve archetypes, the culture five years forward, and the one
remaining client. **The available transcript ends at 01:06:49**, part-way through the fifth
client adjective.

Four things are therefore open, and the document flags each one where it belongs rather than
papering over it:

1. The fifth client adjective (page 11 proposes *self-possessed*).
2. Tone of voice, never run as an exercise (Section III is derived from how the founders
   actually speak, and is marked `proposal`).
3. Look and feel, same treatment.
4. The name, never raised (Section IV opens it; nine routes, recommendation *esen & rapp*).

Page 44 lists all five decisions that remain, with a recommendation and what each one unblocks.

## Content notes

- **No trademark search has been run**, on any of the nine name routes, in any class or
  jurisdiction. Pages 36 and 39 say so. Nothing here is a clearance.
- If a house name already exists and simply did not come up on 18 September, it wins.
  Section IV then becomes the naming reservoir for the objects on page 39.
- **Eleven commissions a year is an illustration**, used consistently throughout so the
  arithmetic holds. It is almost certainly wrong. Decision 05.
- Time codes in the body and in the appendix on page 43 are block markers from the recording,
  checked against it. If a founder spot-checks one, it should land.
- One entry on the archetype board, the Caregiver, is not legible in the recording. Page 06
  records its brand name as unknown rather than guessing.
- The example formula on page 35 (Marguerite L., formula 0041) is invented to show the object.
  No client exists under that name.

## Documented deviations from CLAUDE.md

Four, all deliberate, all narrow.

1. **Ivory, not cream.** The sheet is `--paper:#FBFAF6` rather than Design System v3.4's
   `--cream:#FBF5E6`. Requested by the operator, and argued on page 28 and page 29 as a
   positioning decision rather than a preference: cream is the default surface of the natural
   and botanical category. Everything else in the chassis is v3.4 verbatim, including ink,
   the gold/rose triad, the eyebrow rhythm, the two-layer card and the hard offset shadow.
2. **Supplementary fonts.** The canonical Google Fonts URL from `HEAD-SNIPPET.html` loads
   unchanged and carries the whole document. Three further faces load from **separate**
   `<link>` elements so a failure cannot break the chassis: Instrument Serif, Instrument Sans
   and Geist Mono, used only as live specimens on page 30 and inside the formula card on
   page 35. Same pattern as `war-table.html`'s supplementary Caveat link.
3. **Banned vocabulary inside verbatim material.** *Empowering* and *cutting edge* appear on
   pages 06, 09, 10, 12, 21, 26 and 43. Every instance is either a quotation from the session,
   a brand's own published tagline, or an entry in the lexicon that bans it. The house prose
   never uses either. Same precedent as the Mouncef attribute pools.
4. **Exclamation marks on page 27.** Two, inside the deliberately-bad "before" column, and the
   annotation beneath names them as the breach. The "after" column has none.

The em dash in the `<title>` is covered by check 1's title-tag exemption. There are none in
page text.

## Layout contract

- One `<section class="page">` equals one A4 sheet. Print box is `296mm`, one millimetre under
  A4, which absorbs sub-pixel rounding; without it Chromium spills every full page onto a
  second sheet.
- `.page--dense` and `.page--tight` are the one- and two-notch-tighter type variants, used
  where a page runs 2 to 5 percent long.
- Page numbers in footers, contents and inline cross-references are hand-written. Adding or
  removing a page means updating them. Page count is currently 44.
- The trail marker (the gold dot in the outer margin) is the one scripted element. It is
  positioned from each page's index so inserting a page does not rot 44 hand-set percentages.
- Rendering needs network, for the font URLs.

## Where the two documents will sit

- **Brand platform** (this repo): who sells. Authority on identity, voice, refusals, visual
  direction, the name.
- **Commercial frame** (does not exist yet, days 61 to 90 on page 42): what is sold. Prices,
  formulas, capacity, terms.

When the two disagree, identity questions settle here and commercial detail settles there.
