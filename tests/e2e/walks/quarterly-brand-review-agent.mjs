// Quarterly Brand Review: the profile prefill, the inputs, three error
// states, the review, its six tabs, the colour of every grade, change type
// and band, then Copy Directive and Export Text.
import fs from 'node:fs';

export const page = 'quarterly-brand-review-agent.html';
export const title = 'inputs, error states, review, six tabs, enum colours, copy and export';

const norm = s => String(s).replace(/\s+/g, ' ').trim();
const wait = ms => new Promise(r => setTimeout(r, ms));

// The profile the founder arrives with. The Lover is the twelfth archetype
// and the one the select used to leave out.
const QBP = {
  brandName: 'Maison Levain',
  brandEssence: 'Bread, and nothing else.',
  spark: 'A bakery that refuses the menu.',
  naturalForce: 'Lightning',
  archetype: 'The Lover',
  manifesto: 'One loaf, done right.',
  antiBrand: 'The supermarket aisle.',
  primaryPersona: 'Neighbours who cook on Sundays.',
  offer: 'A weekly loaf subscription.',
  voiceNotes: 'Plain, warm, short sentences.',
};

// What the model answers. Enum values are spelled as the prompt spells them.
const REVIEW = {
  quarterNarrative: 'Walk narrative: the quarter proved the loaf sells itself when it is shown.',
  quarterGrade: { overall: 'A', brandCoherence: 'B', contentQuality: 'C', audienceAlignment: 'D', commercialProgress: 'A', gradeExplanation: 'Walk grade explanation: strong core, thin reach.' },
  keyLearnings: [
    { learning: 'Walk learning one: close-ups beat recipes.', evidence: 'Walk evidence one.', implication: 'Walk implication one.' },
    { learning: 'Walk learning two: Friday is the day.', evidence: 'Walk evidence two.', implication: 'Walk implication two.' },
  ],
  whatToCarryForward: ['Walk carry: the crust close-up.', 'Walk carry: the Friday post.'],
  whatToLeave: ['Walk leave: generic baking tips.', 'Walk leave: the long captions.'],
  qbpUpdates: [
    { field: 'Brand Essence', changeType: 'strengthen', currentValue: 'Walk current essence.', proposedValue: 'Walk proposed essence.', reasoning: 'Walk reasoning essence.' },
    { field: 'Voice Notes', changeType: 'evolve', currentValue: 'Walk current voice.', proposedValue: 'Walk proposed voice.', reasoning: 'Walk reasoning voice.' },
    { field: 'Primary Persona', changeType: 'add', proposedValue: 'Walk proposed persona.', reasoning: 'Walk reasoning persona.' },
    { field: 'Anti-Brand', changeType: 'recalibrate', currentValue: 'Walk current anti-brand.', proposedValue: 'Walk proposed anti-brand.', reasoning: 'Walk reasoning anti-brand.' },
  ],
  nextQuarterTheme: 'Walk theme: show the bake.',
  nextQuarterNorthStar: 'Walk north star: 60 subscriptions.',
  initiatives: [
    { name: 'Walk initiative: Friday film', band: 'now', platform: 'Instagram', pillar: 'Walk pillar craft', rationale: 'Walk rationale now.', effort: 'low', score: 92, successMetric: 'Walk metric now.' },
    { name: 'Walk initiative: starter kit', band: 'Now', platform: 'Newsletter', pillar: 'Walk pillar offer', rationale: 'Walk rationale now two.', effort: 'medium', score: 81, successMetric: 'Walk metric now two.' },
    { name: 'Walk initiative: cafe pilot', band: 'next', platform: 'LinkedIn', pillar: 'Walk pillar reach', rationale: 'Walk rationale next.', effort: 'high', score: 70, successMetric: 'Walk metric next.' },
    { name: 'Walk initiative: second oven', band: 'later', rationale: 'Walk rationale later.', effort: 'high', score: 55 },
    { name: 'Walk initiative: merchandise', band: 'park', rationale: 'Walk rationale park.', effort: 'low', score: 41 },
  ],
  contentFocus: { primaryFormat: 'Walk format: short film.', primaryAngle: 'Walk angle: the hands.', voiceEvolution: 'Walk voice: shorter still.', platformPriority: ['Walk priority one: Instagram, where it lands.', 'Walk priority two: Newsletter, where it sells.'] },
  offerSignals: 'Walk offer signals: the subscription is understood.',
  identityCheck: { driftAssessment: 'Walk drift: the tips were not us.', recalibration: 'Walk recalibration: back to the oven.', coreToProtect: 'Walk core: one loaf.' },
  warTableSummary: { constraint: 'Time', nowList: ['Friday film', 'Starter kit'], nextList: ['Cafe pilot'], parkList: ['Merchandise'] },
  closingDirective: 'Walk directive: bake in public every Friday and let the loaf do the talking.',
};

export async function walk(w) {
  const p = w.page;
  Object.values(QBP).forEach(w.note);
  await p.addInitScript(q => { try { localStorage.setItem('qb_qbp', JSON.stringify(q)); } catch (e) {} }, QBP);

  // w.see matches through XPath, whose normalize-space leaves a no-break
  // space alone. French lines that carry one (before ? : ;) are read here.
  const shows = async (written, { painted = false, within = '#root', exact = true, timeout = 8000 } = {}) => {
    const text = norm(painted ? written : await w.say(written));
    try {
      await p.waitForFunction(([t, sel, ex]) => {
        const n = s => s.replace(/\s+/g, ' ').trim();
        const root = document.querySelector(sel);
        if (!root) return false;
        const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node; (node = tw.nextNode());) {
          const v = n(node.data);
          if (!v || !(ex ? v === t : v.includes(t))) continue;
          const el = node.parentElement;
          if (el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden') return true;
        }
        return false;
      }, [text, within, exact], { timeout });
      return true;
    } catch (e) { return false; }
  };
  const expect = async (written, opts) => w.check(await shows(written, opts), `not on screen: ${JSON.stringify(written)}`);
  const all = async (values, opts) => { for (const v of values) await expect(v, { painted: true, timeout: 3000, ...opts }); };

  // A field is found by its label, as painted.
  const field = async label => {
    const t = norm(await w.say(label));
    return p.locator(`xpath=//div[@id="root"]//div[div[normalize-space(translate(text(), " ", " "))="${t}"]]/*[self::input or self::textarea or self::select]`).first();
  };
  // The element showing this text, as painted, inside the tool.
  const byText = async written => {
    const t = norm(await w.say(written));
    return p.locator(`xpath=//div[@id="root"]//main//*[text()[normalize-space(translate(., " ", " "))="${t}"]]`).first();
  };
  const run = p.locator('#root button.btn-primary');
  const year = String(new Date().getFullYear());

  // The model: 'message' (500 with a reason), 'http' (500, no reason),
  // 'down' (502), 'slow' or 'ok'.
  let model = 'ok';
  const bodies = [];
  await w.mockModel(async body => { bodies.push(body); if (model === 'slow') await wait(3200); return REVIEW; });
  w.note('Model overloaded');
  await w.mock('**/api/claude', route => {
    if (model === 'message') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Model overloaded' } }) });
    if (model === 'http') return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    if (model === 'down') return route.fulfill({ status: 502, contentType: 'application/json', body: '{}' });
    return route.fallback();
  });

  await w.step('open with the profile', async () => {
    await w.open();
    await w.see('Quarterly Brand Review', { within: '#root main', timeout: 20000 });
    await w.see('Quarterly Review', { within: '#root header' });
    await w.see('Hold', { within: '#root main' });
    await expect("Feed the quarter's data. The agent reads it through your brand identity, proposes updates to the QBP from what it learned, and sets the strategic direction for the next 90 days.");
    await w.see('Quarterly Brand Review / Hold');
    w.check(!/Phase/.test(await p.locator('#root').innerText()), 'the phase vocabulary is still painted');
    w.check(await p.locator('#root header button').count() === 0, 'the header still carries a control');

    // Nothing is asked twice: the profile fills the form.
    const filled = { 'Brand Name *': QBP.brandName, 'Brand Essence *': QBP.brandEssence, 'The Spark (Narrative)': QBP.spark, 'Manifesto Line': QBP.manifesto,
      'Primary Persona': QBP.primaryPersona, 'Core Offer': QBP.offer, 'Anti-Brand': QBP.antiBrand, 'Voice Notes': QBP.voiceNotes, Year: year };
    for (const [label, value] of Object.entries(filled)) w.check(await (await field(label)).inputValue() === value, `${label} was not prefilled`);
    const force = await field('Natural Force');
    w.check(await force.inputValue() === 'Lightning' && await force.evaluate(s => s.options[s.selectedIndex].text) === await w.say('Lightning'), 'the natural force from the profile is not shown');
    const arch = await field('Archetype');
    w.check(await arch.inputValue() === 'The Lover' && await arch.evaluate(s => s.options[s.selectedIndex].text) === 'The Lover', 'the archetype from the profile is not shown');
    w.check(await arch.locator('option').count() === 13, 'the archetype select does not offer the twelve archetypes');
    w.check(await (await field('Quarter *')).locator('option').count() === 5, 'four quarters expected');
    w.check(await run.isDisabled(), 'the run is enabled with no quarter');
  });

  await w.step('inputs', async () => {
    const quarter = await field('Quarter *');
    await quarter.selectOption('Q2 (Apr–Jun)');
    w.check(await quarter.evaluate(s => s.options[s.selectedIndex].text) === await w.say('Q2 (Apr–Jun)'), 'the quarter option is not in the page language');
    w.check(await run.isDisabled(), 'the run is enabled with no quarter data');
    // Any data field counts, as the page says: "at least one data field".
    await w.fill(await field('Content Produced'), '24 posts, 6 newsletters.');
    w.check(await run.isEnabled(), 'one data field did not enable the run');

    const typed = {
      'Top Performers': 'The crust close-up, 4,200 views.',
      'Lowest Performers': 'Generic baking tips.',
      'Key Metrics': 'Followers +310, list +84.',
      'Business Outcomes': 'Twelve new subscriptions.',
      'Audience Evolution': 'Cafe owners started writing in.',
      'What Worked (Honest Read)': 'Showing the bake.',
      "What Didn't (Honest Read)": 'Explaining the bake.',
      'Biggest Lesson': 'The loaf is the content.',
      'Brand Feeling': 'It felt like us on Fridays only.',
      'Identity Drift': 'The tips series.',
      'Emerging Opportunities': 'Wholesale to two cafes.',
      'Goal for Q+1': 'Sixty subscriptions.',
    };
    for (const [label, value] of Object.entries(typed)) await w.fill(await field(label), value);
    if (w.lang === 'fr') {
      const hint = await (await field('Biggest Lesson')).getAttribute('placeholder');
      w.check(hint === await w.say('The single most important thing you learned this quarter - about your brand, your audience, or yourself'), 'a textarea placeholder is not translated');
    }
  });

  await w.step('error states', async () => {
    model = 'message';
    await run.click();
    await expect('Agent anomaly: Model overloaded');
    model = 'http';
    await run.click();
    await expect('Agent anomaly: API error: HTTP 500');
    model = 'down';
    await run.click();
    await expect('Synthesis was unavailable. The review could not be generated. Try again in a moment.');
    w.check(!(await shows('Agent anomaly: API error: HTTP 500', { timeout: 500 })), 'the earlier error was not replaced');
    // The founder is back on the form with everything still there.
    await w.see('Quarterly Brand Review', { within: '#root main' });
    w.check(await (await field('Biggest Lesson')).inputValue() === 'The loaf is the content.' && await (await field('Quarter *')).inputValue() === 'Q2 (Apr–Jun)', 'an error lost what was entered');
  });

  await w.step('review', async () => {
    model = 'slow';
    await run.click();
    await w.see('Processing Intelligence');
    const lines = await p.evaluate(() => LOADING_MESSAGES);
    w.check(lines.length === 6 && !lines.some(l => /Re-calibrating/.test(l)), 'the loading lines still say the profile is rewritten');
    await w.see(lines[0]);
    await w.see(lines[1], { timeout: 5000 });
    await w.see('// Hold · Review complete', { timeout: 15000 });
    await w.see(QBP.brandName, { painted: true, within: '#root main' });
    await w.see('Q2 (Apr–Jun)', { within: '#root main' });
    w.check(norm(await p.locator('#root main h1').textContent()) === `${QBP.brandName} - ${await w.say('Q2 (Apr–Jun)')}`, 'the heading does not name the brand and the quarter');
    await w.see('Brand analyzed · QBP updates proposed · Directives set');

    // Five grades. A, B, C and D each take their own colour.
    const want = [['Overall', 'A', 'var(--patina)'], ['Coherence', 'B', 'var(--info)'], ['Content', 'C', 'var(--brass)'], ['Audience', 'D', 'var(--error)'], ['Commercial', 'A', 'var(--patina)']];
    const painted = [];
    for (const [label, letter, colour] of want) {
      const card = (await byText(label)).locator('xpath=..');
      const grade = card.locator('div').first();
      w.check(norm(await grade.textContent()) === letter, `${label} grade reads ${await grade.textContent()}`);
      w.check(await grade.evaluate(el => el.style.color) === colour, `${label} ${letter} is coloured ${await grade.evaluate(el => el.style.color)}`);
      painted.push(await grade.evaluate(el => getComputedStyle(el).color));
    }
    w.check(new Set(painted.slice(0, 4)).size === 4, `the four grades are not four colours: ${painted.join(' / ')}`);

    // What goes to the model stays English in both languages.
    const sent = String(bodies[bodies.length - 1].messages[0].content);
    w.check(sent.includes(`QUARTER UNDER REVIEW: Q2 (Apr–Jun) ${year}`) && sent.includes('Natural Force: Lightning') && sent.includes('Archetype: The Lover'), 'option values were not sent in English');
    w.check(sent.includes('Content produced: 24 posts, 6 newsletters.') && sent.includes('Goal for next quarter: Sixty subscriptions.'), 'what was typed did not reach the model');
  });

  await w.step('narrative tab', async () => {
    for (const l of ['Quarter Narrative', 'Grade Rationale', 'Carry Forward', 'Leave Behind']) await w.see(l);
    await all([REVIEW.quarterNarrative, REVIEW.quarterGrade.gradeExplanation, ...REVIEW.whatToCarryForward, ...REVIEW.whatToLeave]);
  });

  await w.step('learnings tab', async () => {
    await w.click('Learnings');
    await w.see('Evidence');
    await w.see('Implication');
    for (const l of REVIEW.keyLearnings) await all(Object.values(l));
  });

  await w.step('QBP updates tab', async () => {
    await w.click('QBP Updates (4)');
    await expect('These are proposed updates to the QBP, drawn from what the quarter taught. They reflect what the brand has become - not what it was designed to be. Nothing is applied for you. Keep the changes that feel true. Leave those that feel reactive.');
    // strengthen, evolve, add, recalibrate: a word and a colour each.
    const want = { strengthen: 'var(--patina)', evolve: 'var(--info)', add: 'var(--content)', recalibrate: 'var(--error)' };
    const painted = [];
    for (const u of REVIEW.qbpUpdates) {
      const pill = await byText(u.changeType.toUpperCase());
      await pill.waitFor({ state: 'visible', timeout: 4000 });
      w.check(await pill.evaluate(el => el.style.color) === want[u.changeType], `${u.changeType} is coloured ${await pill.evaluate(el => el.style.color)}`);
      painted.push(await pill.evaluate(el => getComputedStyle(el).color));
      await w.see(u.field, { within: '#root main' });
      await all([u.currentValue, u.proposedValue, u.reasoning].filter(Boolean));
    }
    w.check(new Set(painted).size === 4, `the four change types are not four colours: ${painted.join(' / ')}`);
    const count = async written => p.locator(`xpath=//div[@id="root"]//main//*[text()[normalize-space(.)="${norm(await w.say(written))}"]]`).count();
    w.check(await count('CURRENT STATE') === 3, 'the current state should show for the three updates that have one');
    w.check(await count('PROPOSED STATE') === 4, 'every update should show a proposed state');
    await expect('Intelligence trace:');
    // Proposed, never applied: the profile is exactly what it was.
    const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('qb_qbp') || '{}'));
    w.check(stored.brandEssence === QBP.brandEssence && stored.voiceNotes === QBP.voiceNotes, 'the review changed the profile on its own');
  });

  await w.step('Q+1 direction tab', async () => {
    await w.click('Q+1 Direction');
    for (const l of ['Next Quarter Theme', 'Content Focus', 'Primary format', 'Primary angle', 'Voice evolution', 'Platform Priority', 'Offer Signals', 'Identity Check', 'Core To Protect']) await w.see(l);
    await expect('North Star Metric:');
    const c = REVIEW.contentFocus, i = REVIEW.identityCheck;
    await all([REVIEW.nextQuarterTheme, REVIEW.nextQuarterNorthStar, c.primaryFormat, c.primaryAngle, c.voiceEvolution, ...c.platformPriority, REVIEW.offerSignals, i.driftAssessment, i.recalibration, i.coreToProtect]);
  });

  await w.step('War Table tab', async () => {
    await w.click('War Table', { within: '#root main' });
    await w.see('Primary Constraint');
    await w.see('The binding resource for Q+1 execution');
    await w.see('Time', { within: '#root main' });
    // now, next, later, park: a heading and a colour each, in that order.
    const want = [['NOW', 'var(--patina)', 2], ['NEXT', 'var(--info)', 1], ['LATER', 'var(--brass)', 1], ['PARK', 'var(--text-3)', 1]];
    const painted = [];
    for (const [band, colour] of want) {
      const head = await byText(band);
      await head.waitFor({ state: 'visible', timeout: 4000 });
      w.check(await head.evaluate(el => el.style.color) === colour, `${band} is coloured ${await head.evaluate(el => el.style.color)}`);
      painted.push(await head.evaluate(el => getComputedStyle(el).color));
    }
    w.check(new Set(painted).size === 4, `the four bands are not four colours: ${painted.join(' / ')}`);
    const order = await p.evaluate(() => [...document.querySelectorAll('#root main div')].filter(d => !d.children.length && d.textContent.startsWith('Walk initiative')).map(d => d.textContent));
    w.check(order.join('|') === REVIEW.initiatives.map(i => i.name).join('|'), `initiatives are out of band order: ${order.join(' | ')}`);
    for (const ini of REVIEW.initiatives) await all([ini.name, ini.rationale, ini.platform, ini.pillar, ini.successMetric].filter(Boolean));
    // Effort: low, medium, high.
    const pills = (await p.locator('#root main .pill').allTextContents()).map(norm);
    for (const level of ['low', 'medium', 'high']) {
      const text = w.lang === 'fr' ? `${await w.say(level)} ${await w.say('effort')}` : `${level} effort`;
      w.check(pills.includes(norm(text)), `effort "${level}" should read ${JSON.stringify(text)}; pills are ${JSON.stringify(pills)}`);
    }
    await w.see('conviction');
    await expect('Metric:');
    await expect('92');
  });

  await w.step('directive tab and copy', async () => {
    await w.click('Directive');
    await w.see('Strategic Directive - Execute The Following');
    await w.see(REVIEW.closingDirective, { painted: true });
    await w.click('Copy Directive');
    const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(e => `clipboard unreadable: ${e.message}`);
    w.check(clip === REVIEW.closingDirective, `clipboard holds ${JSON.stringify(String(clip).slice(0, 120))}`);
  });

  await w.step('export text', async () => {
    const [download] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), w.click('Export Text')]);
    w.check(/^maison-levain-.*-review\.txt$/.test(download.suggestedFilename()), `file is named ${download.suggestedFilename()}`);
    const lines = fs.readFileSync(await download.path(), 'utf8').split('\n').map(norm);
    const has = line => lines.includes(norm(line));
    const want = w.lang === 'fr'
      ? [`REVUE DE MARQUE TRIMESTRIELLE · T2 (avr.–juin) ${year}`, 'Généré par BrandOS · Revue de marque trimestrielle', 'Marque : Maison Levain',
        'RÉCIT DU TRIMESTRE :', 'NOTES :', 'Global : A', 'Cohérence : B', 'Contenu : C', 'Audience : D', 'Commercial : A', 'ENSEIGNEMENTS CLÉS :',
        'Preuve : Walk evidence one.', 'Implication : Walk implication one.', 'À POURSUIVRE :', 'À LAISSER DERRIÈRE :', 'MISES À JOUR DU QBP :',
        'Essence de marque (renforcer) :', 'Persona principal (ajouter) :', 'Actuel : Walk current essence.', 'Actuel : -', 'Proposé : Walk proposed essence.',
        'Pourquoi : Walk reasoning essence.', 'TRIMESTRE SUIVANT :', 'Thème : Walk theme: show the bake.', 'Cap : Walk north star: 60 subscriptions.',
        'WAR TABLE :', 'Contrainte : Temps', 'MAINTENANT :', 'ENSUITE :', 'EN RÉSERVE :', 'DIRECTIVE FINALE :']
      : [`QUARTERLY BRAND REVIEW - Q2 (Apr–Jun) ${year}`, 'Generated by BrandOS - Quarterly Brand Review Agent', 'Brand: Maison Levain',
        'QUARTER NARRATIVE:', 'GRADES:', 'Overall: A', 'Coherence: B', 'Content: C', 'Audience: D', 'Commercial: A', 'KEY LEARNINGS:',
        'Evidence: Walk evidence one.', 'Implication: Walk implication one.', 'CARRY FORWARD:', 'LEAVE BEHIND:', 'QBP UPDATES:',
        'Brand Essence (strengthen):', 'Primary Persona (add):', 'Current: Walk current essence.', 'Current: -', 'Proposed: Walk proposed essence.',
        'Why: Walk reasoning essence.', 'NEXT QUARTER:', 'Theme: Walk theme: show the bake.', 'North Star: Walk north star: 60 subscriptions.',
        'WAR TABLE:', 'Constraint: Time', 'NOW:', 'NEXT:', 'PARK:', 'CLOSING DIRECTIVE:'];
    for (const line of want) w.check(has(line), `the exported text has no line ${JSON.stringify(line)}`);
    // The founder's words and the model's are written as they are, in both languages.
    for (const line of [REVIEW.quarterNarrative, REVIEW.quarterGrade.gradeExplanation, '1. Walk learning one: close-ups beat recipes.', '+ Walk carry: the crust close-up.',
      '- Walk leave: generic baking tips.', 'Friday film, Starter kit', REVIEW.closingDirective]) w.check(has(line), `the exported text lost ${JSON.stringify(line)}`);
    w.check(!lines.some(l => /^(brandCoherence|contentQuality|audienceAlignment|commercialProgress)\b/.test(l)), 'the export prints internal grade keys');
    if (w.lang === 'fr') {
      const english = ['QUARTER NARRATIVE:', 'GRADES:', 'KEY LEARNINGS:', 'CARRY FORWARD:', 'LEAVE BEHIND:', 'QBP UPDATES:', 'NEXT QUARTER:', 'NOW:', 'NEXT:', 'PARK:', 'CLOSING DIRECTIVE:'];
      w.check(!english.some(has), `English headings are left in the French export: ${english.filter(has).join(', ')}`);
    }
  });

  await w.step('new run keeps the inputs', async () => {
    await w.click('New Run');
    await w.see('Initialize Intelligence Run');
    w.check(await (await field('Biggest Lesson')).inputValue() === 'The loaf is the content.' && await (await field('Brand Name *')).inputValue() === QBP.brandName, 'New Run lost the inputs');
  });
}
