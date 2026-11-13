/* BrandOS · exported text test
 *
 * A downloaded pack, a "copy" button and an email link build their text
 * from English labels and never pass through the DOM, so the render audit
 * cannot see them. This checks the three exits in a real browser:
 *
 *   French  · a .txt Blob, the clipboard and QBI18N.text() come out in French
 *           · a line with no entry (the founder's words) is left untouched
 *           · an application/json Blob is never altered
 *   English · every exit returns its input byte for byte
 *
 * Usage: node tests/i18n/exports.mjs
 * Exit:  0 pass · 1 fail
 */
import { serve, launch } from './_browser.mjs';

const CASES = [
  { page: 'linkedin-strategy-agent.html', lines: [
    ['LINKEDIN STRATEGY PACK - Maison Levain', 'PACK DE STRATÉGIE LINKEDIN · Maison Levain'],
    ['HEADLINE:', 'TITRE :'],
    ['Type: carousel', 'Type : carousel'],
  ] },
  { page: 'quarterly-brand-review-agent.html', lines: [
    ['KEY LEARNINGS:', 'ENSEIGNEMENTS CLÉS :'],
    ['   Evidence: sales held', '   Preuve : sales held'],
    ['PARK:', 'EN RÉSERVE :'],
  ] },
  { page: 'the-profiles.html', lines: [
    ['### Pain Points', '### Points de douleur'],
    ['### Hook', '### Accroche'],
  ] },
  { page: 'war-table.html', lines: [
    ['# Strategic Command Dossier', '# Dossier de commandement stratégique'],
    ['### Later', '### Plus tard'],
  ] },
];
const UNTOUCHED = 'Le pain, rien d’autre. Notre promesse tient en une ligne.';

const fails = [];
const ok = (cond, label, detail = '') => { if (!cond) fails.push(detail ? `${label}: ${detail}` : label); };
const server = await serve(0);
const port = server.address().port;
const browser = await launch();

for (const c of CASES) {
  for (const lang of ['fr', 'en']) {
    const ctx = await browser.newContext();
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await ctx.addInitScript(() => { try { localStorage.setItem('qb_user_tier', 'agency'); localStorage.setItem('qb_sub_status', 'active'); } catch (e) {} });
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${port}/${c.page}?lang=${lang}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await p.waitForTimeout(1200);
    const input = c.lines.map(l => l[0]).concat([UNTOUCHED]).join('\n');
    const r = await p.evaluate(async text => {
      const viaText = window.QBI18N.text(text);
      const viaBlob = await new Blob([text], { type: 'text/plain' }).text();
      const json = JSON.stringify({ label: 'HEADLINE:', note: text });
      const viaJson = await new Blob([json], { type: 'application/json' }).text();
      let viaClip = null;
      try { await navigator.clipboard.writeText(text); viaClip = await navigator.clipboard.readText(); } catch (e) { viaClip = null; }
      return { viaText, viaBlob, viaClip, jsonSame: viaJson === json, blobIsBlob: new Blob(['x'], { type: 'text/plain' }) instanceof Blob };
    }, input);
    const want = lang === 'fr' ? c.lines.map(l => l[1]).concat([UNTOUCHED]).join('\n') : input;
    const where = `${c.page} [${lang}]`;
    ok(r.viaText === want, `${where} QBI18N.text`, JSON.stringify(r.viaText));
    ok(r.viaBlob === want, `${where} text Blob`, JSON.stringify(r.viaBlob));
    if (r.viaClip !== null) ok(r.viaClip === want, `${where} clipboard`, JSON.stringify(r.viaClip));
    ok(r.jsonSame, `${where} JSON Blob left alone`);
    ok(r.blobIsBlob, `${where} Blob is still a Blob`);
    await ctx.close();
  }
}
await browser.close();
server.close();
if (fails.length) { console.log(fails.map(f => 'FAIL · ' + f).join('\n')); console.log(`\nexported text test FAILED · ${fails.length} failure(s)`); process.exit(1); }
console.log(`exported text test passed · ${CASES.length} pages × 2 languages`);
