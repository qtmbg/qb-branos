# QB BrandOS — Visual Identity for Video

## Style Prompt

Warm, archival, craft-luxury. Cream parchment canvas with deep patina-green and aged-brass accents. Editorial serif headlines paired with a clean humanist sans for body. Subtle paper grain over everything. Movement is unhurried, elegant — entrances ease in like turning a page, never bounce or snap. Think: a private library, a master craftsman's workshop, a leather-bound archive — not a tech dashboard.

## Colors

### Light theme (default)

| Role | Hex | Use |
|------|-----|-----|
| `--cream` | `#F4F0EB` | canvas / background |
| `--cream-soft` | `#EDE8E2` | secondary surfaces |
| `--cream-deep` | `#E6E0D8` | tertiary / borders |
| `--ink` | `#1A1610` | primary text, headlines |
| `--ink-soft` | `#5A5040` | secondary text |
| `--ink-mute` | `#8A7E70` | muted captions, meta |
| `--patina` | `#3A5F4A` | primary accent (cards, CTAs) |
| `--patina-lit` | `#4A7A5E` | hover / lit accent |
| `--brass` | `#A8903E` | gold accents, dot, dividers |
| `--brass-lit` | `#C4A84E` | highlights, marker sweeps |
| `--terra` | `#C4654A` | warm callouts |
| `--plum` | `#7A5A6E` | rare emphasis |

### Dark theme

| Role | Hex |
|------|-----|
| `--cream` (bg) | `#0E0C09` |
| `--cream-soft` | `#0A0806` |
| `--ink` (text) | `#DDD4C4` |
| `--pill-ink` (gold text) | `#D4BA62` |

## Typography

- **Display / headlines**: `EB Garamond` (serif) — `font-weight: 500–600`, tight letter-spacing on large sizes (`-1px` to `-2px`).
- **Body / UI**: `Figtree` (humanist sans) — `font-weight: 400–500`.
- **Mono / data**: `JetBrains Mono` — only for QBP codes, IDs, technical readouts.

Google Fonts URL:
```
https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500;600&family=Figtree:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap
```

## Motion rules

- Easing: `cubic-bezier(.22, 1, .36, 1)` — same `--ease` as the site.
- Entrances: fade + small Y rise (12–24px), 0.6–0.9s. Never slide in 100% off-screen.
- Headlines: stagger words with 0.04–0.06s offset, `power2.out`.
- Brass underlines / dividers: draw left-to-right with `scaleX` from 0 to 1.
- Paper grain: subtle, 8–12% opacity, animated noise (steps).

## What NOT to do

1. **No bright/cold tech blues, no neon.** Stay warm — cream/ink/patina/brass.
2. **No bouncy / elastic eases.** This is craft, not toys. `power2.out`, `power3.inOut`, never `back.out` or `elastic`.
3. **No drop shadows on text.** Use ink color contrast on cream surfaces.
4. **No generic Inter / Roboto / system sans.** Always Figtree.
5. **No emoji or stock-photo people.** Use brand logos or illustration.
