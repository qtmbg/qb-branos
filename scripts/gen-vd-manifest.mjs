#!/usr/bin/env node
/**
 * Generate /img/visual-dna/manifest.json from the existing files.
 *
 * - Discovers all *.jpg / *.jpeg / *.png / *.webp in /img/visual-dna/
 * - Sorts numerically by trailing index (VISUAL-DNA1.jpg < VISUAL-DNA2.jpg < VISUAL-DNA10.jpg)
 * - Re-encodes each as JPG q=85 (strip EXIF, auto-orient, max 1920px long edge)
 *   so previously un-optimized originals shrink to a consistent web format
 * - Writes the manifest visual-dna.html reads at runtime
 *
 * Usage: node scripts/gen-vd-manifest.mjs [--no-optimize]
 */
import { readdirSync, statSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR  = resolve(ROOT, 'img', 'visual-dna');
const noOptimize = process.argv.includes('--no-optimize');

if(!existsSync(DIR)){ console.error('Not found:', DIR); process.exit(1); }

const SUPPORTED = new Set(['.jpg','.jpeg','.png','.webp']);
const files = readdirSync(DIR)
  .filter(f => !f.startsWith('.') && SUPPORTED.has(extname(f).toLowerCase()) && f !== 'manifest.json')
  .sort((a,b) => {
    const na = parseInt((a.match(/(\d+)(?=\.\w+$)/)||[0,0])[1], 10);
    const nb = parseInt((b.match(/(\d+)(?=\.\w+$)/)||[0,0])[1], 10);
    return (na - nb) || a.localeCompare(b);
  });

if(files.length === 0){ console.error('No images found in', DIR); process.exit(1); }
console.log(`Found ${files.length} images. Optimize=${!noOptimize}`);

const images = [];
let beforeTotal = 0, afterTotal = 0;
for(const f of files){
  const path = join(DIR, f);
  beforeTotal += statSync(path).size;
  if(!noOptimize){
    try {
      const tmp = path + '.tmp.jpg';
      execFileSync('magick', [
        path, '-auto-orient', '-strip',
        '-resize', '1920x1920>',
        '-quality', '85',
        '-sampling-factor', '4:2:0',
        '-interlace', 'JPEG',
        '-colorspace', 'sRGB',
        tmp
      ], { stdio: 'pipe' });
      // Replace original with optimized copy
      renameSync(tmp, path);
    } catch(e){
      console.error(`  skip optimize ${f}: ${e.message}`);
    }
  }
  afterTotal += statSync(path).size;
  images.push({ src: `/img/visual-dna/${f}` });
}

const manifest = {
  slot: 'visual-dna',
  generated_at: new Date().toISOString(),
  count: images.length,
  images,
};

const out = join(DIR, 'manifest.json');
writeFileSync(out, JSON.stringify(manifest, null, 2));

console.log(`\nWrote ${images.length} entries to ${out}`);
if(!noOptimize){
  const dropPct = Math.round((1 - afterTotal/beforeTotal) * 100);
  console.log(`Optimization: ${(beforeTotal/1024/1024).toFixed(1)}MB -> ${(afterTotal/1024/1024).toFixed(1)}MB (${dropPct>=0?'-':'+'}${Math.abs(dropPct)}%)`);
}
