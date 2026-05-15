#!/usr/bin/env node
/**
 * Mobile responsive audit. Visits every production page at iPhone 13
 * viewport (390x844), screenshots top + bottom, captures any horizontal
 * scroll overflow as a hard signal of a layout breakage.
 *
 * Outputs:
 *   /tmp/mobile-audit/<slug>--top.png
 *   /tmp/mobile-audit/<slug>--bottom.png
 *   /tmp/mobile-audit/report.json   (overflow + console errors)
 *
 * Usage: node scripts/mobile-audit.mjs [base-url]
 *   base-url defaults to https://quantumbranding.ai
 */
import { chromium } from '/Users/drazicq/drazicq/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] || 'https://quantumbranding.ai';
const OUT  = '/tmp/mobile-audit';
if(!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['index','/'],
  ['signal-scan','/signal-scan.html'],
  ['ecosystem','/ecosystem.html'],
  ['payment','/payment.html'],
  ['tools','/tools.html'],
  // /journey-guide and /qb-branidos-hub deprecated in step 12.
  // Source files archived under /_archive/chapter-1-deprecations/ in step 16.
  ['foundation','/foundation.html'],
  ['archive','/archive.html'],
  ['qbp','/qbp.html'],
  ['paywall','/paywall.html'],
  ['account','/account.html'],
  ['the-profiles','/the-profiles.html'],
  ['archetype-compass','/archetype-compass.html'],
  ['visual-dna','/visual-dna.html'],
  ['war-table','/war-table.html'],
  ['sensescape','/sensescape.html'],
  ['brand-soul-map','/brand-soul-map.html'],
  ['logo-direction-agent','/logo-direction-agent.html'],
  ['logo-evaluation-agent','/logo-evaluation-agent.html'],
  ['voice-guide-agent','/voice-guide-agent.html'],
  ['instagram-seed-agent','/instagram-seed-agent.html'],
  ['linkedin-strategy-agent','/linkedin-strategy-agent.html'],
  ['youtube-strategy-agent','/youtube-strategy-agent.html'],
  ['newsletter-architecture-agent','/newsletter-architecture-agent.html'],
  ['content-bridge','/content-bridge.html'],
  ['content-repurposing-engine','/content-repurposing-engine.html'],
  ['content-scheduler','/content-scheduler.html'],
  ['predictive-panel','/predictive-panel..html'],
  ['brand-performance-dashboard','/brand-performance-dashboard.html'],
  ['quarterly-brand-review-agent','/quarterly-brand-review-agent.html'],
  ['terms','/terms.html'],
  ['privacy','/privacy.html'],
  ['404','/non-existent-route-for-404-test'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});

const report = [];
for(const [slug, path] of PAGES){
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push({ kind:'pageerror', text:String(e) }));
  page.on('console', m => { if(m.type()==='error') consoleErrors.push({ kind:'console', text:m.text() }); });

  try {
    const url = BASE + path;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(600);

    // Horizontal overflow check
    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const offenders = [];
      for(const el of document.querySelectorAll('*')){
        const r = el.getBoundingClientRect();
        if(r.width > 0 && r.right > docW + 1){
          const tag = el.tagName.toLowerCase();
          const cls = (el.className||'').toString().trim().slice(0,80);
          offenders.push(`${tag}${cls?'.'+cls.replace(/\s+/g,'.'):''} right=${Math.round(r.right)} docW=${docW}`);
          if(offenders.length >= 8) break;
        }
      }
      return { docW, scrollW: document.documentElement.scrollWidth, offenders };
    });

    await page.screenshot({ path: resolve(OUT, `${slug}--top.png`), fullPage: false });

    // Scroll to bottom for bottom-frame screenshot
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(OUT, `${slug}--bottom.png`), fullPage: false });

    const status = page.url().includes('non-existent') || path === '/non-existent-route-for-404-test'
      ? '(404 test)' : 'ok';

    report.push({ slug, url, overflow, consoleErrors, status });
    const overflowFlag = overflow.scrollW > overflow.docW + 1 ? ` OVERFLOW(+${overflow.scrollW - overflow.docW}px)` : '';
    const errFlag = consoleErrors.length ? ` ERR(${consoleErrors.length})` : '';
    console.log(`  ${slug.padEnd(30)} ${status}${overflowFlag}${errFlag}`);
  } catch (e) {
    report.push({ slug, url: BASE+path, error: String(e) });
    console.log(`  ${slug.padEnd(30)} FAILED ${e.message}`);
  }
  await page.close();
}

await browser.close();
writeFileSync(resolve(OUT,'report.json'), JSON.stringify(report, null, 2));
console.log(`\nReport: ${OUT}/report.json`);

const broken = report.filter(r => r.error || (r.overflow && r.overflow.scrollW > r.overflow.docW + 1));
console.log(`\nBroken / overflowing: ${broken.length}`);
for(const b of broken){
  console.log(`  ${b.slug}: ${b.error || `+${b.overflow.scrollW - b.overflow.docW}px scroll`}`);
  if(b.overflow?.offenders?.length){
    for(const o of b.overflow.offenders.slice(0,3)) console.log(`     -> ${o}`);
  }
}
