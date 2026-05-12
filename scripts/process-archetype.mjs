#!/usr/bin/env node
/**
 * Process the user-supplied archetype illustrations.
 *
 * Reads /img/archetype/<source>.png (12 transparent PNGs, 2000x2000 each),
 * renames to the canonical slug used in archetype-compass.html, and emits
 * both an optimized .webp (modern browsers) and an optimized .png (fallback)
 * at 600x600 with alpha preserved.
 *
 * Usage: node scripts/process-archetype.mjs
 */
import { readdirSync, statSync, unlinkSync, existsSync, renameSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR  = resolve(ROOT, 'img', 'archetype');

// Source filename -> canonical slug. If a source name is missing (already
// renamed on a prior run), the script falls back to <slug>.png in the same
// folder so it can be re-run idempotently to apply framing fixes.
const MAP = {
  'cousteau.png': 'cousteau',
  'hanks.png':    'hanks',
  'albert.png':   'einstein',
  'Coco.png':     'chanel',
  'lama.png':     'dalai',
  'chaplin.png':  'chaplin',
  'frida.png':    'kahlo',
  'jordan.png':   'jordan',
  'mandela.png':  'mandela',
  'ali.png':      'ali',
  'king.png':     'mlk',
  'teresa.png':   'teresa',
};

let webpTotal = 0, pngTotal = 0, srcTotal = 0;

for(const [src, slug] of Object.entries(MAP)){
  let srcPath = join(DIR, src);
  if(!existsSync(srcPath)){
    // Fallback: re-process the already-slug-named PNG so the framing fix
    // can be applied in a subsequent run.
    srcPath = join(DIR, `${slug}.png`);
    if(!existsSync(srcPath)){ console.log(`SKIP missing ${src}`); continue; }
  }

  const srcSize = statSync(srcPath).size;
  srcTotal += srcSize;

  const webpOut = join(DIR, `${slug}.webp`);
  const pngOut  = join(DIR, `${slug}.png`);

  // Pipeline:
  //   1. Trim to alpha bounding box (removes any transparent margin built into source)
  //   2. Resize so figure fills 600x600 (preserves aspect; one edge touches frame)
  //   3. Re-canvas to 600x600 with -gravity south so figure bottom sits at canvas bottom
  //
  // Result: each figure fills the gradient frame as much as its aspect ratio
  // permits. Tall portraits touch top + bottom, wide ones touch sides + bottom.
  // No more uniform horizontal padding -- figures occupy the frame they sit in.
  const COMMON = [
    '-strip',
    '-background', 'none', '-alpha', 'set',
    '-trim', '+repage',
    '-resize', '600x600',
    '-background', 'none', '-gravity', 'south',
    '-extent', '600x600',
  ];

  const pngTmp = join(DIR, `_${slug}.png`);
  execFileSync('magick', [srcPath, ...COMMON, '-quality', '90', pngTmp]);

  execFileSync('magick', [
    srcPath, ...COMMON,
    '-quality', '85',
    '-define', 'webp:alpha-quality=90',
    webpOut,
  ]);

  // Move tmp PNG into place (overwrites source if same name; otherwise drops the source)
  if(existsSync(pngOut) && pngOut !== srcPath) unlinkSync(pngOut);
  renameSync(pngTmp, pngOut);
  if(srcPath !== pngOut && existsSync(srcPath)) unlinkSync(srcPath);

  const pngSize  = statSync(pngOut).size;
  const webpSize = statSync(webpOut).size;
  pngTotal  += pngSize;
  webpTotal += webpSize;

  console.log(`  ${src.padEnd(15)} -> ${slug.padEnd(10)} png=${(pngSize/1024).toFixed(0)}KB  webp=${(webpSize/1024).toFixed(0)}KB  (src=${(srcSize/1024).toFixed(0)}KB)`);
}

console.log(`\nSource total:    ${(srcTotal/1024/1024).toFixed(1)} MB`);
console.log(`Optimized PNG:   ${(pngTotal/1024/1024).toFixed(1)} MB`);
console.log(`Optimized WebP:  ${(webpTotal/1024/1024).toFixed(1)} MB`);

// Remove stray "Untitled 3.png" if present
const untitled = join(DIR, 'Untitled 3.png');
if(existsSync(untitled)){
  unlinkSync(untitled);
  console.log(`\nRemoved orphan: Untitled 3.png`);
}
