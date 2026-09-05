# lisadoc · dossier de marque

Deliverables for Mouncef's agency: an editor of websites for French specialist physicians.
Method: <span>quantum branding</span>, Phase 01 Discovery.

## Files

| File | What it is |
|---|---|
| `plateforme-de-marque.pdf` | **v2.0** · the brand platform. 43 A4 pages, French. Identity, values, voice, visual direction, the name, the competitive position. |
| `anatomie-site-gagnant.pdf` | The competitive audit of webesthetique.fr plus the lisadoc template blueprint. 27 A4 pages. |
| `BUILD-SPEC.md` | Machine-readable companion to the audit. Give it to a coding agent to build the template. |
| `*.html` | The sources. Edit these, never the PDFs. |
| `render.mjs` | Renderer and layout guard, shared by both documents. |

## Regenerate

```
node docs/clients/mouncef/render.mjs                        # plateforme-de-marque
node docs/clients/mouncef/render.mjs anatomie-site-gagnant  # the audit
```

Prints one line per page that would clip its sheet, then writes the PDF.
`no overflow` means every `.page` fits A4 with nothing cut.

## How the three documents relate

- **Cadrage de l'offre** (Mouncef's own, `cadrage_1.html`, 2 Sept 2026): what lisadoc sells.
  Formulas, prices, production method, deontological frame, sales language.
- **Plateforme de marque** (this repo): who sells. Authority on voice, values, refusals, visual direction.
- **Anatomie d'un site qui gagne** (this repo): authority on the architecture of delivered sites.

When the platform and the cadrage disagree, identity questions settle here, commercial detail settles there.

## Layout contract

- One `<section class="page">` equals one A4 sheet. Print box is `296mm`, one millimetre under A4,
  which absorbs sub-pixel rounding; without it Chromium spills every full page onto a second sheet.
- `.page--dense` is the one-notch-tighter type variant, used where a page runs 2 to 4 percent long.
- Page numbers in footers, contents and inline cross-references are hand-written.
  Adding or removing a page means updating them. Page count is currently 43 and 27.
- Fonts load from the canonical Google Fonts URL in `HEAD-SNIPPET.html`, so rendering needs network.

## Content notes

- The name is **lisadoc**, it preexisted this work. v1 of the platform recommended "Anamnèse";
  those ten name routes were repurposed in v2 as the naming reservoir for ecosystem objects (page 36).
- No trademark search has been run, on lisadoc or on the proposed object names. Page 33 says so.
- The English attribute pools on page 13 are the client's own verbatim exercise material and stay as
  written, banned vocabulary included.
- The audit is a dated snapshot: crawl of 127 pages on 5 September 2026. Raw crawl data was not kept
  in the repo; re-run the crawl before citing its figures again.
- Deontology framing stays jurisdiction-aware but defers to counsel. Neither document gives legal advice.
