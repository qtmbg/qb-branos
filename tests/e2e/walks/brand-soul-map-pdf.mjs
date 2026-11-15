// Brand Soul Map, PDF view: the sheet a founder prints or saves.
//
// Empty first (nothing in the profile), then filled three ways: from the
// ?qbp= link with a one-sentence essence, with the older "Name - line"
// essence, and with a single archetype. Then the print path.
export const page = 'brand-soul-map-pdf.html';
export const title = 'empty and filled, five sheets, cover and colophon, readable in print';

const BRAND = 'Maison Levain';
const PROFILE = {
  brandName: BRAND,
  brandEssence: 'A well-made loaf for people who are done being hurried.',
  spark: 'Maison Levain exists for the neighbour who stopped buying bread by habit. It refuses the shortcut.',
  archetype: 'The Caregiver + The Creator',
  alwaysNever: 'Always: bake before dawn | Never: sell day-old bread as fresh',
  primaryPersona: 'She reads the label before she reads the price.',
  naturalForce: 'A slow tide',
  paradox: 'Humble yet exacting',
};
const ANSWERS = { fanSurprise: 'She kept the paper bag', fanTarget: 'One thing in her day that was not rushed', movementName: 'The Harlem Renaissance', leadChoice: 'Gandhi', innChoice: 'Steve Jobs' };

export async function walk(w) {
  const p = w.page;
  const flat = s => String(s).replace(/\s+/g, ' ').trim();
  const lit = t => (t.includes("'") ? `concat('${t.split("'").join(`', "'", '`)}')` : `'${t}'`);
  // One text node at a time, no-break spaces folded on both sides.
  const see = async (english, opts = {}) => {
    const text = flat(opts.painted ? english : await w.say(english));
    const node = "normalize-space(translate(., ' ', ' '))";
    await (opts.within ? p.locator(opts.within) : p).locator(`xpath=./descendant-or-self::*[text()[${node}=${lit(text)}]]`).filter({ visible: true }).first()
      .waitFor({ state: 'visible', timeout: opts.timeout ?? 5000 })
      .catch(() => { throw new Error(`not on screen${opts.within ? ' in ' + opts.within : ''}: ${JSON.stringify(english)}`); });
  };
  const text = sel => p.locator(sel).first().textContent().then(flat);
  const link = profile => 'qbp=' + encodeURIComponent(Buffer.from(JSON.stringify(profile), 'utf8').toString('base64'));
  const remember = value => Object.values(value).forEach(v => w.note(v));

  // Text against the ground it really sits on. 4.5 is the usual floor for
  // body text; the dark sheets were at 1.0 in English before the fix.
  const contrast = sel => p.evaluate(s => {
    const el = document.querySelector(s);
    if (!el) return 0;
    const parse = c => { const m = /rgba?\(([^)]+)\)/.exec(c); const v = m[1].split(/[,\s\/]+/).filter(Boolean).map(parseFloat); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
    const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    let bg = [255, 255, 255, 1];
    for (let n = el; n; n = n.parentElement) { const b = parse(getComputedStyle(n).backgroundColor); if (b[3] > 0.5) { bg = b; break; } }
    const a = lum(parse(getComputedStyle(el).color)), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, sel);
  const readable = async (where, selectors) => {
    for (const sel of selectors) {
      const ratio = await contrast(sel);
      w.check(ratio >= 4.5, `${where}: ${sel} reads at ${ratio.toFixed(2)}:1 against its ground`);
    }
  };
  const DARK = ['.cover-brand-name', '.cover-subtitle', '.cover-meta-value', '.cover-meta-label', '.cover-meta-cycle', '.spark-text', '.spark-essence'];

  // The sheet prints through window.print(); the walk counts the calls.
  await p.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

  await w.step('empty: the cover', async () => {
    await w.open();
    await see('Brand Soul Map · Observe');
    await see('Your Brand', { within: '.cover' });
    await see('Strategic Brand Identity Report');
    await see('Generated');
    // Today, as the page's own clock has it (the runner's may sit in another zone).
    await see(await p.evaluate(() => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })));
    await see('Prepared for');
    await see('Founder');
    // Cover meta: the method, with its cycle beneath.
    w.check(/^(Methodology|Méthode) The Collapse Observe · Collapse · Build · Hold$/.test(await text('.cover-meta-item:last-child')),
      'the cover meta does not read method, The Collapse, then the cycle: ' + await text('.cover-meta-item:last-child'));
  });

  await w.step('empty: every field says what will go there', async () => {
    for (const line of ['Your Brand Spark will appear here once the Brand Soul Map is complete.', 'Brand Essence will appear here.', 'The Archetype', 'The Complement',
      'Your primary audience - defined by who they are becoming, not who they are.', 'Hidden baggage and surprise', "What they're moving toward",
      'The force the brand embodies', 'The tension that makes you real', 'The lineage and movement the brand belongs to', 'How the brand moves through the world', 'Who it innovates like']) {
      await see(line);
    }
    w.check(await p.locator('.code-item').count() === 0, 'commitments are listed although the profile is empty');
  });

  await w.step('five sheets, numbered as five', async () => {
    w.check(await p.locator('.cover, .spark-page, .page, .closing-page').count() === 5, 'the document is not five sheets');
    const numbers = await p.locator('.page-num').allTextContents();
    w.check(numbers.map(flat).join(' | ') === '03 / 05 | 04 / 05 | 05 / 05', `the sheets are numbered ${numbers.map(flat).join(' | ')}`);
    w.check(await text('.cover-page-num') === '01', 'the cover is not sheet 01');
  });

  await w.step('closing sheet and colophon', async () => {
    await see('Document Complete');
    await see('The Brand Soul Map is part of Observe, the first movement in BrandOS. Your outputs have been saved to your Quantum Brand Profile and will automatically inform every tool, agent, and strategy that follows. Nothing gets repeated. Everything compounds.');
    await see('Continue your foundation →');
    w.check(/\/os$/.test(await p.locator('.closing-cta').getAttribute('href')), 'the closing link no longer points at /os, which redirects to the foundation');
    const colophon = flat(await p.locator('.closing-page').innerText());
    const method = await w.say('Methodology');
    const at = s => colophon.toLowerCase().indexOf(s.toLowerCase());
    w.check(at(method) > -1 && at(method) < at('The Collapse') && at('The Collapse') < at('Observe · Collapse · Build · Hold'),
      'the colophon does not read method, The Collapse, then the cycle beneath');
    await see('Created by');
    await see('Nizzar Ben Chekroune');
  });

  await w.step('empty: the dark sheets can be read', async () => {
    await readable('screen', DARK);
  });

  await w.step('filled from the ?qbp= link', async () => {
    remember(PROFILE); remember(ANSWERS);
    w.note('Ines Okafor'); w.note('bake before dawn'); w.note('sell day-old bread as fresh');
    await p.evaluate(a => localStorage.setItem('qb_soul_map_data', JSON.stringify(a)), ANSWERS);
    await w.open(link(PROFILE) + '&fn=Ines&ln=Okafor');
    await see(BRAND, { painted: true, within: '.cover' });
    w.check((await p.locator('.page-brand').allTextContents()).every(t => flat(t) === BRAND), 'the brand name is not on every sheet header');
    await see('Ines Okafor', { painted: true });
    await see(PROFILE.spark, { painted: true });
    await see(PROFILE.brandEssence, { painted: true, within: '.spark-page' });
    // The cover line is the report line: a one-sentence essence is not a
    // "Name - line" pair, and "well-made" is not a separator.
    w.check(await text('#cover-subtitle') === flat(await w.say('Strategic Brand Identity Report')), `the cover line is ${JSON.stringify(await text('#cover-subtitle'))}`);
    await see('The Caregiver', { within: '#archetype-primary-block' });
    await see('The Creator', { within: '#archetype-secondary-block' });
    w.check(await p.locator('.code-item').count() === 2, 'the always and the never are not one line each');
    await see('bake before dawn', { painted: true, within: '#always-items' });
    await see('sell day-old bread as fresh', { painted: true, within: '#never-items' });
    await see(PROFILE.primaryPersona, { painted: true });
    await see(PROFILE.naturalForce, { painted: true });
    await see(PROFILE.paradox, { painted: true });
  });

  await w.step('filled: the five answers the tool hands over', async () => {
    await see(ANSWERS.fanSurprise, { painted: true, within: '#fan-surprise' });
    await see(ANSWERS.fanTarget, { painted: true, within: '#fan-target' });
    await see('The Harlem Renaissance', { within: '#movement' });
    await see('Gandhi', { within: '#lead-choice' });
    await see('Steve Jobs', { within: '#inn-choice' });
  });

  await w.step('filled: readable on screen', async () => {
    await readable('screen', DARK.concat(['.code-text', '.code-marker']));
  });

  await w.step('print: the sheet, not the preview chrome', async () => {
    await see('↓ Save as PDF');
    await p.locator('.print-btn').click();
    w.check(await p.evaluate(() => window.__printed) === 1, 'Save as PDF did not open the print dialog');
    await p.emulateMedia({ media: 'print' });
    w.check(!(await p.locator('.screen-controls').isVisible()), 'the preview controls would print');
    w.check(!(await p.locator('.qb-lang').first().isVisible()), 'the language switch would print');
    // On paper the French colour reversal is off, so the page's own colours
    // must hold, and the dark grounds must print with their light type.
    await readable('print', DARK.concat(['.code-text', '.code-marker']));
    const kept = await p.evaluate(() => ['.cover', '.spark-page', '.code-block'].map(s => { const cs = getComputedStyle(document.querySelector(s)); return cs.printColorAdjust || cs.webkitPrintColorAdjust; }));
    w.check(kept.every(v => v === 'exact'), `the dark grounds are not forced to print: ${kept.join(', ')}`);
    await p.emulateMedia({ media: 'screen' });
  });

  await w.step('an older "Name - line" essence still gives the cover its line', async () => {
    const legacy = Object.assign({}, PROFILE, { brandEssence: 'Maison Levain - Bread that takes its time' });
    remember(legacy); w.note('Bread that takes its time');
    await w.open(link(legacy));
    w.check(await text('#cover-subtitle') === 'Bread that takes its time', `the cover line is ${JSON.stringify(await text('#cover-subtitle'))}`);
    await see('Founder');
  });

  await w.step('one archetype: the second block is left out', async () => {
    const single = Object.assign({}, PROFILE, { archetype: 'The Sage' });
    await w.open(link(single));
    await see('The Sage', { within: '#archetype-primary-block' });
    w.check(!(await p.locator('#archetype-secondary-block').isVisible()), 'an empty secondary archetype block is shown');
  });

  await w.step('?autoprint=1 prints by itself', async () => {
    await w.open(link(PROFILE) + '&autoprint=1');
    await p.waitForFunction(() => window.__printed === 1, null, { timeout: 5000 });
  });
}
