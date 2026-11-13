#!/usr/bin/env node
/**
 * Narrow nav fix, second half of scripts/fix-mobile-nav.mjs.
 *
 * fix-mobile-nav.mjs hid the two nav buttons under 1000px on the tool
 * pages. The marketing, blog and legal pages were not in its list. Under
 * about 520px their pill cannot hold the lockup, [Sign in], [Start free]
 * and the menu button, so the menu button is pushed outside the pill and
 * off the screen: on a phone the mobile menu cannot be opened at all.
 * Measured at 390px on 14 pages, in English and in French.
 *
 * Two changes, both idempotent:
 *   1. On pages without the earlier fix, hide the two nav buttons under
 *      560px. Between 560 and 999px they fit, and stay.
 *   2. On every page with this nav, add "Sign in" to the mobile menu,
 *      under "Start free". Until now it lived only in the pill, so hiding
 *      it there would have left a phone with no way to sign in.
 *
 * Usage: node scripts/fix-narrow-nav.mjs          write
 *        node scripts/fix-narrow-nav.mjs --check  exit 1 if a page needs it
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CHECK = process.argv.includes('--check');
const EARLIER = '/* QB mobile nav fix */';
const NARROW = '/* QB narrow nav fix */';
const MENU = '/* QB mobile menu sign-in */';
const NARROW_RULE = `${NARROW}
@media (max-width:559.98px){
  .nav-wrap .nav-actions > a,
  .nav .nav-actions > a { display:none !important; }
}
`;
const MENU_RULE = `${MENU}
.mobile-menu_foot { display:flex; flex-direction:column; gap:var(--space-xs, 0.875rem); }
`;
const SIGN_IN = '<a href="https://app.quantumbranding.ai/login" class="qb-button is-expand"><span class="qb-button_content">Sign in</span></a>';

const pages = [
  ...fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !/^HEAD-SNIPPET/.test(f)),
  ...fs.readdirSync(path.join(ROOT, 'blog')).filter(f => f.endsWith('.html')).map(f => 'blog/' + f),
].sort();

const pending = [];
let wrote = 0;
for (const file of pages) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, 'utf8');
  if (!/class="hamburger/.test(html) || !/class="mobile-menu_foot"/.test(html)) continue;
  const before = html;
  const styleEnd = () => html.toLowerCase().indexOf('</style>');

  if (!html.includes(EARLIER) && !html.includes(NARROW) && styleEnd() > -1) {
    const i = styleEnd();
    html = html.slice(0, i) + NARROW_RULE + html.slice(i);
  }
  // "Sign in" goes right after the first link in the menu footer.
  const foot = /(<div class="mobile-menu_foot">\s*<a [^>]*>[\s\S]*?<\/a>)(\s*<\/div>)/;
  const m = foot.exec(html);
  if (m && !/login/.test(m[1])) {
    const indent = /\n(\s*)<a /.exec(m[1]);
    html = html.replace(foot, `$1\n${indent ? indent[1] : '    '}${SIGN_IN}$2`);
    if (!html.includes(MENU) && styleEnd() > -1) {
      const i = styleEnd();
      html = html.slice(0, i) + MENU_RULE + html.slice(i);
    }
  }
  if (html === before) continue;
  if (CHECK) { pending.push(file); continue; }
  fs.writeFileSync(full, html);
  wrote++;
}
if (CHECK) {
  if (pending.length) { console.error('Pages that still need the narrow nav fix:\n  ' + pending.join('\n  ')); process.exit(1); }
  console.log('Narrow nav fix is in place on every page with this nav.');
} else console.log(`Narrow nav fix written to ${wrote} page(s).`);
