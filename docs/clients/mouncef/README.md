# Plateforme de marque · agence de référencement pour médecins spécialistes

Client deliverable, Phase 01 Discovery. Built from five brand exercises run with Mouncef
(brand affinities, anti-brands, personification, archetype DNA, attribute columns).

## Files

| File | What it is |
|---|---|
| `plateforme-de-marque.html` | Source. Self-contained, print-first, 43 A4 pages. QB v3.4 tokens in `:root`. |
| `plateforme-de-marque.pdf` | The deliverable. Regenerated from the HTML, never edited by hand. |
| `render.mjs` | Renderer and layout guard. |

## Regenerate

```
node docs/clients/mouncef/render.mjs
```

It prints one line per page that runs longer than its sheet, then writes the PDF.
`no overflow` means every `.page` fits its A4 sheet with nothing clipped.

## Layout contract

- One `<section class="page">` equals one A4 sheet. In print the box is `296mm`, one millimetre
  under A4, which absorbs sub-pixel rounding. Without it Chromium spills every full page onto a
  second sheet.
- `.page--dense` is the one-notch-tighter type variant, applied to pages 5, 23, 28 and 33 only.
- Page numbers in footers, the contents page and inline cross-references are written by hand.
  Adding or removing a page means updating them.
- Fonts load from the canonical Google Fonts URL in `HEAD-SNIPPET.html`, so rendering needs network.

## Content notes

- Recommended name: **Anamnèse**. Fallbacks: Repère, Primum. No trademark search has been run,
  and the document says so on page 33.
- The English attribute pools on page 13 and the "Empowering / Empowered / Empowerment" entries are
  the client's own verbatim exercise material. They stay as written even though the voice codex bans
  those words in QB copy.
- Deontology framing is jurisdiction-neutral on purpose. Page 38 defers the legal check to counsel.
