#!/usr/bin/env node
// QB BrandOS — image import + optimization pipeline
//
// Usage:
//   node scripts/import-images.mjs <slot> <source-dir> [--prefix=xx] [--dry]
//
// Examples:
//   node scripts/import-images.mjs visual-dna ~/Downloads/vd-batch-1
//   node scripts/import-images.mjs archetype  ~/Downloads/archetype --prefix=mg
//
// What it does:
//   1. Reads every .jpg/.jpeg/.png/.webp/.heic/.heif in <source-dir>
//   2. Resizes each to max 1920px on the long edge (preserves aspect)
//   3. Strips EXIF, converts to JPG q=85 mozjpeg
//   4. Saves to /img/<slot>/<prefix or slot>-NNN.jpg with zero-padded index
//   5. Writes /img/<slot>/manifest.json — the list the tool reads at runtime
//
// Why this exists:
//   - Saves manual rename/resize/optimize loop
//   - Keeps repo size sane (avg drop from 3MB → 250KB per photo)
//   - Produces a stable manifest so visual-dna.html can swap BASE_URLS for it
//
// Requirements: ImageMagick 7 (`magick`) on PATH. brew install imagemagick.

import { readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { extname, basename, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
  console.error(`Usage: node scripts/import-images.mjs <slot> <source-dir> [--prefix=xx] [--dry]
Examples:
  node scripts/import-images.mjs visual-dna ~/Downloads/vd-batch-1
  node scripts/import-images.mjs archetype  ~/Downloads/archetype --prefix=mg`);
  process.exit(2);
}

const [slot, srcDirRaw] = args;
const prefixFlag = args.find(a => a.startsWith('--prefix='));
const prefix = prefixFlag ? prefixFlag.split('=')[1] : slot.replace(/[^a-z0-9]/gi, '').slice(0, 6);
const dryRun = args.includes('--dry');

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const srcDir = srcDirRaw.startsWith('~/')
  ? join(process.env.HOME, srcDirRaw.slice(2))
  : resolve(srcDirRaw);
const outDir = join(REPO_ROOT, 'img', slot);

if (!existsSync(srcDir)) {
  console.error(`✗ Source dir not found: ${srcDir}`);
  process.exit(1);
}
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const SUPPORTED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tiff', '.tif']);
const inputs = readdirSync(srcDir)
  .filter(f => SUPPORTED.has(extname(f).toLowerCase()))
  .filter(f => !f.startsWith('.'))
  .sort();

if (inputs.length === 0) {
  console.error(`✗ No images found in ${srcDir}`);
  console.error(`  Supported: ${[...SUPPORTED].join(' ')}`);
  process.exit(1);
}

console.log(`◆ Importing ${inputs.length} images → /img/${slot}/`);
console.log(`  prefix:    ${prefix}-NNN.jpg`);
console.log(`  optimize:  max 1920px long edge, JPG q=85, strip EXIF`);
if (dryRun) console.log(`  DRY RUN — no files written`);
console.log();

const pad = String(inputs.length).length;
const manifest = [];

for (let i = 0; i < inputs.length; i++) {
  const src = join(srcDir, inputs[i]);
  const idx = String(i + 1).padStart(pad, '0');
  const outName = `${prefix}-${idx}.jpg`;
  const out = join(outDir, outName);

  const srcSize = statSync(src).size;
  if (dryRun) {
    console.log(`  ${inputs[i].padEnd(36)} → ${outName}  (${(srcSize/1024).toFixed(0)}KB → ?)`);
    manifest.push({ src: `/img/${slot}/${outName}` });
    continue;
  }

  try {
    execFileSync('magick', [
      src,
      '-auto-orient',
      '-strip',
      '-resize', '1920x1920>',
      '-quality', '85',
      '-sampling-factor', '4:2:0',
      '-interlace', 'JPEG',
      '-colorspace', 'sRGB',
      out
    ], { stdio: 'pipe' });
  } catch (e) {
    console.error(`✗ Failed: ${inputs[i]} — ${e.stderr?.toString() || e.message}`);
    continue;
  }

  const outSize = statSync(out).size;
  const drop = Math.round((1 - outSize / srcSize) * 100);
  console.log(`  ${inputs[i].padEnd(36)} → ${outName}  (${(srcSize/1024).toFixed(0)}KB → ${(outSize/1024).toFixed(0)}KB · -${drop}%)`);
  manifest.push({ src: `/img/${slot}/${outName}`, bytes: outSize });
}

if (!dryRun) {
  const manifestPath = join(outDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify({
    slot,
    prefix,
    generated_at: new Date().toISOString(),
    count: manifest.length,
    images: manifest
  }, null, 2));
  console.log(`\n✓ Manifest written: img/${slot}/manifest.json (${manifest.length} entries)`);
}
console.log(`\nDone. Total: ${manifest.length} images.`);
