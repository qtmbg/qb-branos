# WCAG 2.1 A/AA audit · findings

Ran 2026-07-05 against production (`quantumbranding.ai`) with axe-core 4.12 through Playwright, at 390 px and 1280 px. Harness: `tests/site-audit/wcag-audit.mjs`. Raw data: `wcag-report.json`. This cures the live-render half of the chapter-4 deferral (section 7 item 5) and runs the accessibility half that had never run.

## Coverage

74 page-views: 31 public routes plus five app routes and the artifact reading surface under a seeded starter identity (torn down debris-free), each at both widths. Zero navigation errors. Rule set: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.

## Result

Four serious rule types, zero moderate or minor. Two were surgical and are fixed in this pass. Two touch locked or shared surfaces and are surfaced for an operator decision, not auto-changed.

| Rule | Impact | Nodes | Views | Status |
|---|---|---|---|---|
| `aria-progressbar-name` | serious | 2 | 2 | Fixed |
| `aria-prohibited-attr` | serious | 7 | 1 | Fixed |
| `color-contrast` | serious | 585 | 67 | Surfaced (locked `:root` tokens) |
| `link-in-text-block` | serious | 6 | 6 | Surfaced (system banner + 404 footer) |

## Fixed in this pass

**`aria-progressbar-name`** · `brand-document.html`, the completion meter. A `role="progressbar"` with value attributes but no accessible name. Added `aria-label="Brand document completion"`.

**`aria-prohibited-attr`** · `js/qb-agents-console.js`, the agent health dot. A `<span>` carried `aria-label` with no role, which ARIA forbids on a generic element. Added `role="img"` so the status label is announced. The dot is a status indicator, so `img` is the correct role.

Both are additive attributes on non-dispatch-path files. Neither changes layout, behavior, or the `:root` block. They deploy with the next push and will read clean on the next audit run.

## Surfaced for the operator

### `color-contrast` (585 nodes, 67 views)

Every failure sits within a hair of the threshold. axe reports the ratios as exactly `4.5` (need 4.5:1) or `3` (need 3:1), meaning the true value rounds up but falls short. These are not scattered mistakes; they are a small set of brand tokens used site-wide, so one token change clears hundreds of nodes. The failing foregrounds, all on cream backgrounds (`#fbf5e6`, `#f2ebd3`, and warmer card tints):

| Foreground | Token | Failing count | Note |
|---|---|---|---|
| `#948584`, `#90807a`, `#7c6b68`, `#867571`, `#8d796d`, `#8a7a7a` | muted / secondary text (computed warm grey, `--text-2` family) | ~190 | The dominant cluster. Muted body and caption text just under 4.5:1. |
| `#b58840` | `--gold-deep` | ~35 | Gold used as text on cream. Below 4.5:1 for normal text. |
| `#e0b069` | `--gold` | ~14 | Gold on cream. Below 3:1 even for large/graphical use in places. |
| `#a8862e` | a darker gold variant | ~22 | Same family. |
| `#ca6180` | `--rose` | ~8 | Rose as text or on tinted cards. |
| `#5b7e6a` | `--illus-forest` | ~4 | Forest green used as text. |

**Why this is not auto-fixed.** CLAUDE.md marks the `:root` token block do-not-touch without operator sign-off, and darkening `--gold`, `--gold-deep`, or the muted-text grey changes the brand's look everywhere, not one page. That is a brand decision.

**Recommended remediation (operator).** Nudge the offending tokens just past AA, keeping hue:
- Muted / secondary text grey: darken until it clears 4.5:1 on `#fbf5e6` (roughly `#8a7a78` → about `#6f625f`). This single change clears the largest cluster.
- `--gold-deep` for any text use: darken to clear 4.5:1 on cream (about `#8a6410`), or reserve gold for non-text accents and set text-on-cream to `--ink`.
- `--gold`, `--rose`, `--illus-forest` as text: same treatment, or stop using them as text on cream and keep them for fills and rules where the 3:1 graphical threshold applies.
Re-run `node tests/site-audit/wcag-audit.mjs` after; the count should collapse toward zero.

### `link-in-text-block` (6 nodes, 6 views)

Links sitting inside a text block, distinguished from surrounding text by color alone (WCAG 1.4.1). Two contexts:
- The Signal Scan banner link "Run yours →" where the banner reads as a text block (flagged on `/terms` and `/privacy`).
- The 404 footer link to `quantumbranding.ai`.

**Why this is not auto-fixed.** The banner is a system constant rendered inline across 28 self-contained pages; changing its link styling is a site-wide sweep that belongs with the contrast pass, not a one-file edit. The copy is untouched either way.

**Recommended remediation (operator).** Add a non-color signal to in-text links: `text-decoration: underline` on `.banner a` and on the 404 footer link. Bundle it with the contrast token change so the whole a11y CSS pass ships once across the 28 pages.

## Definition of done for Task 4

Two of four serious rules are cleared in code here. The remaining two are single, well-scoped changes to the locked `:root` block and the shared banner, quantified above, ready for one operator CSS pass. When that pass lands and the audit re-runs clean, the chapter-4 WCAG deferral closes fully.

## Remediation applied · 2026-07-06 go-live pass

Executed under the operator's go-live directive (PRs #218, #220, plus the legal-page link fix):

- **`--ink-50` alpha 0.50 to 0.62** across 35 files. Composites to ~#7B6A6C on cream, ratio ~4.6:1, clears AA. Hue unchanged. This was the dominant muted-text cluster.
- **`link-in-text-block` cleared entirely**: persistent underline on the privacy/terms banner link and the 404 footer link. The rule no longer fires anywhere.
- **privacy/terms page-local `--gold-deep` #A8862E to #8A6410** for body links (was 3.15:1, now clears 4.5:1; hue kept; those links also carry underlines).
- Re-audit 2026-07-06 (74 views): serious rules down from four to one. `color-contrast` down from 585 nodes on 67 views to 338 nodes on 34 views.

**Still open, deliberately**: the remaining ~338 nodes are the gold-as-text family (`#B58840` eyebrows and tags on cream and cream-warm) plus ink-on-rose fills at 4.45:1. Globally darkening `--gold` or `--gold-deep` breaks ink-on-gold fills (drops below 4.5:1 the other way) and changes the brand's signature eyebrow treatment sitewide. This is a per-use design pass on the eyebrow/tag/rose-fill components, an operator brand decision, not a token swap.

*WCAG findings · QB BrandOS · 2026-07-05 · remediation record 2026-07-06*
