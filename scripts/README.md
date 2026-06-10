# scripts/

Tooling for QB BrandOS image asset pipelines, plus the registry merge gate.

## registry-smoke.mjs

The executable half of the standing registry merge gate (see
`docs/patterns/registry-merge-gate.md`). Required before ANY merge that
touches `agents/`, the registry, or the dispatch path:

```
node scripts/registry-smoke.mjs
```

Sets all test-agent flags, imports the registry (module-load META
validation included), asserts every agent resolves, every test META
passes the contract standalone, and every slug appears in the
artifact-schema allowlist. Paste the output verbatim into the PR body.
Exit 0 = gate passes. After deploy, probe `/api/agents/run` and
`/api/agents/console` unauthenticated and confirm 401, not 500.

## import-images.mjs

Imports a folder of photos, optimizes them, and writes a manifest the tools read.

### Why

Phase 01 tools that show curated reference imagery (Visual DNA, Archetype
Compass) need a stable on-brand image set. Manually resizing, renaming, and
copying 200 photos is friction. This script does it in one command.

### Setup

ImageMagick 7 must be on PATH:

```
brew install imagemagick
magick --version | head -1   # → Version: ImageMagick 7.x.x …
```

That's it. No npm install — the script is a single-file ESM module with no
deps beyond Node 18+ and the `magick` CLI.

### Usage

```
node scripts/import-images.mjs <slot> <source-dir> [--prefix=xx] [--dry]
```

| Arg | What |
|---|---|
| `<slot>` | Subfolder name under `/img/`. Existing slots: `visual-dna`, `archetype`. |
| `<source-dir>` | Folder on your laptop holding the original photos. `~/` expands. |
| `--prefix=xx` | Optional. Filename prefix for the output (default: first 6 chars of slot). |
| `--dry` | Optional. Lists what would happen without writing files. |

### What it does to each photo

1. Auto-orients based on EXIF (so phone shots aren't sideways)
2. Strips EXIF + ICC + thumbnail metadata
3. Resizes to max 1920px on the long edge (preserves aspect)
4. Converts to JPG, quality 85, mozjpeg-style progressive, sRGB
5. Renames to `<prefix>-NNN.jpg` with zero-padded index
6. Writes to `/img/<slot>/`
7. Updates `/img/<slot>/manifest.json` with the full list

Typical drop: 3MB heic → 280KB jpg. 80–90% size reduction with no visible loss.

### Examples

**Visual DNA — 200-image session set**

```
# Drop your photos in ~/Desktop/vd-2026/  (200 files)
node scripts/import-images.mjs visual-dna ~/Desktop/vd-2026
```

Result:
```
/img/visual-dna/vd-001.jpg
/img/visual-dna/vd-002.jpg
…
/img/visual-dna/vd-200.jpg
/img/visual-dna/manifest.json
```

After commit + push, `visual-dna.html` auto-detects the manifest and uses
your curated set instead of the demo Unsplash photos. No code change.

**Archetype Compass — 36 archetype reference images**

```
node scripts/import-images.mjs archetype ~/Desktop/archetype-photos --prefix=ar
```

For Archetype Compass, names need to match specific slots (e.g.
`magician-personality-01.jpg`). After running the optimizer, rename the
output files to the expected slugs. (Future: extend this script to read a
slug-mapping JSON, but not yet needed.)

### Common gotchas

- HEIC/HEIF input requires ImageMagick built with libheif. Check with
  `magick --list format | grep -i heic`. If missing: `brew reinstall
  imagemagick --with-heif` or convert to JPG first (Preview → Export).
- Filenames with spaces or special chars are fine — the script quotes them.
- Re-running on the same source overwrites the previous output. The
  manifest reflects the latest run.

### What the manifest looks like

```json
{
  "slot": "visual-dna",
  "prefix": "vd",
  "generated_at": "2026-05-11T15:42:00.000Z",
  "count": 200,
  "images": [
    { "src": "/img/visual-dna/vd-001.jpg", "bytes": 264512 },
    { "src": "/img/visual-dna/vd-002.jpg", "bytes": 281634 },
    …
  ]
}
```

`visual-dna.html` reads this at session start. If the manifest is missing
or returns 404, it silently falls back to the demo Unsplash set so the
tool keeps working.
