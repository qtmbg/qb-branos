// Brand Performance Dashboard: the profile prefill, the inputs, the two
// error states, the reading, its six tabs and the colour of every pill.
export const page = 'brand-performance-dashboard.html';
export const title = 'inputs, error states, model reading, six tabs, pill colours';

const norm = s => String(s).replace(/\s+/g, ' ').trim();
const wait = ms => new Promise(r => setTimeout(r, ms));

// The profile the founder arrives with. The Lover is the twelfth archetype
// and the one the select used to leave out.
const QBP = {
  brandName: 'Maison Levain',
  brandEssence: 'Bread, and nothing else.',
  archetype: 'The Lover',
  primaryPersona: 'Neighbours who cook on Sundays.',
  offer: 'A weekly loaf subscription.',
  voiceNotes: 'Plain, warm, short sentences.',
  contentGoal: 'Fill the Saturday bake.',
};

// What the model answers. Enum values are spelled as the prompt spells them.
const reading = alignment => ({
  overallHealthScore: 80,
  brandCoherenceScore: 60,
  voiceConsistencyScore: 30,
  audienceAlignmentScore: 75,
  momentumScore: 50,
  executiveSummary: 'Walk summary: the brand holds where it bakes and drifts where it explains.',
  signals: [
    { title: 'Walk signal: crust posts travel', type: 'On-identity resonance', urgency: 'High', finding: 'Walk finding one.', evidence: 'Walk evidence one.', brandInterpretation: 'Walk interpretation one.', recommendation: 'Walk recommendation one.' },
    { title: 'Walk signal: tips drift', type: 'Voice drift warning', urgency: 'Medium', finding: 'Walk finding two.', evidence: 'Walk evidence two.', brandInterpretation: 'Walk interpretation two.', recommendation: 'Walk recommendation two.' },
    { title: 'Walk signal: new bakers', type: 'Breakthrough moment', urgency: 'Low', finding: 'Walk finding three.', evidence: 'Walk evidence three.', brandInterpretation: 'Walk interpretation three.', recommendation: 'Walk recommendation three.' },
  ],
  platformReadings: [
    { platform: 'LinkedIn Personal', healthScore: 80, primarySignal: 'Walk platform signal one.', onBrandPerformers: 'Walk on-brand one.', offBrandPerformers: 'Walk off-brand one.', recommendation: 'Walk platform move one.' },
    { platform: 'Instagram', healthScore: 60, primarySignal: 'Walk platform signal two.', onBrandPerformers: 'Walk on-brand two.', offBrandPerformers: 'Walk off-brand two.', recommendation: 'Walk platform move two.' },
    { platform: 'Newsletter', healthScore: 30, primarySignal: 'Walk platform signal three.', onBrandPerformers: 'Walk on-brand three.', offBrandPerformers: 'Walk off-brand three.', recommendation: 'Walk platform move three.' },
  ],
  contentPatterns: { whatIsWorking: 'Walk pattern working.', whatIsDrifting: 'Walk pattern drifting.', unexploredTension: 'Walk pattern unexplored.', voiceFindings: 'Walk pattern voice.' },
  audienceSignals: { whoIsActuallyEngaging: 'Walk audience: home bakers.', personaAlignment: alignment, personaAlignmentExplanation: 'Walk audience explanation.', emergingAudience: 'Walk audience: cafe owners.' },
  strategicDirections: [
    { direction: 'Walk direction one', rationale: 'Walk rationale one.', implementation: 'Walk implementation one.', risk: 'Walk risk one.' },
    { direction: 'Walk direction two', rationale: 'Walk rationale two.', implementation: 'Walk implementation two.', risk: 'Walk risk two.' },
    { direction: 'Walk direction three', rationale: 'Walk rationale three.', implementation: 'Walk implementation three.', risk: 'Walk risk three.' },
  ],
  next30Days: { singleBiggestMove: 'Walk move: one loaf, one story, every Friday.', contentFocus: 'Walk content focus.', platformFocus: 'Walk platform focus.', whatToStop: 'Walk stop.', whatToTest: 'Walk test.' },
  qbpUpdateFlags: ['Walk flag: the persona is widening.', 'Walk flag: the voice got shorter.'],
});

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

  // A field is found by its label, as painted. nth picks a platform card.
  const field = async (label, nth = 0) => {
    const t = norm(await w.say(label));
    return p.locator(`xpath=//div[@id="root"]//div[div[normalize-space(translate(text(), " ", " "))="${t}"]]/*[self::input or self::textarea or self::select]`).nth(nth);
  };
  // A colour token, resolved by the browser in the page as it stands.
  const token = name => p.evaluate(n => {
    const probe = document.createElement('span');
    probe.style.color = `var(${n})`;
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, name);
  const run = p.locator('#root button.btn-primary');

  // The model: 'message' (500 with a reason), 'down' (502), 'slow' or 'ok'.
  let model = 'ok';
  let alignment = 'high';
  const bodies = [];
  await w.mockModel(async body => { bodies.push(body); if (model === 'slow') await wait(1500); return reading(alignment); });
  w.note('Model overloaded');
  await w.mock('**/api/claude', route => {
    if (model === 'message') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Model overloaded' } }) });
    if (model === 'down') return route.fulfill({ status: 502, contentType: 'application/json', body: '{}' });
    return route.fallback();
  });

  await w.step('open with the profile', async () => {
    await w.open();
    await w.see('Brand Performance Dashboard', { within: '#root main', timeout: 20000 });
    await w.see('Hold', { within: '#root header' });
    await w.see('Intelligence Agent Ready');
    await expect('Feed your performance data. The agent reads it through the brand lens - not as a metrics report, but as brand intelligence.');
    await w.see('Brand Performance Dashboard / Hold');
    w.check(!/Phase\s*0\d/.test(await p.locator('#root').innerText()), 'a numbered phase is still painted');

    // Nothing is asked twice: the profile fills the form.
    w.check(await (await field('Brand Name *')).inputValue() === QBP.brandName, 'brand name was not prefilled');
    w.check(await (await field('Brand Essence *')).inputValue() === QBP.brandEssence, 'brand essence was not prefilled');
    w.check(await (await field('Content Goal')).inputValue() === QBP.contentGoal, 'content goal was not prefilled');
    const arch = await field('Archetype');
    w.check(await arch.inputValue() === 'The Lover', 'the archetype from the profile is not selected');
    w.check(await arch.evaluate(s => s.options[s.selectedIndex].text) === 'The Lover', 'the archetype select does not show the profile value');
    w.check(await arch.locator('option').count() === 13, 'the archetype select does not offer the twelve archetypes');
    w.check(await (await field('Period')).locator('option').count() === 6, 'five periods expected');
    w.check(await (await field('Platform 1')).locator('option').count() === 9, 'eight platforms expected');
    w.check(await run.isDisabled(), 'Analyze is enabled with no platform data');
  });

  await w.step('inputs', async () => {
    const period = await field('Period');
    await period.selectOption('Last 30 days');
    w.check(await period.evaluate(s => s.options[s.selectedIndex].text) === await w.say('Last 30 days'), 'the period option is not in the page language');

    const platform = await field('Platform 1');
    await platform.selectOption('LinkedIn Personal');
    w.check(await run.isDisabled(), 'Analyze is enabled with a platform and no data');
    // Any data on the platform counts, as the page says: "at least one platform with data".
    await w.fill(await field('Low performing posts / content'), 'Generic baking tips, 40 views each.');
    w.check(await run.isEnabled(), 'a platform with data did not enable Analyze');
    await w.fill(await field('Top performing posts / content'), 'The crust close-up, 4,200 views.');
    await w.fill(await field('Key metrics'), 'Reach 2.4K, engagement 4.2%.');
    await w.fill(await field('Your own observations'), 'Short posts land. Long ones do not.');

    // A second platform, then a third that is removed again.
    await w.click('+ Add Platform');
    await w.see('Platform 2');
    await (await field('Platform 2')).selectOption('Instagram');
    await w.fill(await field('Key metrics', 1), 'Reach 900, saves 60.');
    await w.click('+ Add Platform');
    await w.see('Platform 3');
    await p.locator('#root .btn-remove-platform').nth(2).click();
    w.check(await p.locator('#root .btn-remove-platform').count() === 2, 'the third platform was not removed');
    w.check(await (await field('Key metrics', 1)).inputValue() === 'Reach 900, saves 60.', 'removing a platform lost the data of another');

    await w.fill(await field('Overall observations'), 'The bake itself is the content.');
    await w.fill(await field('Unexpected findings'), 'Cafe owners started writing in.');
    await w.fill(await field('Audience feedback / notable comments'), 'Three people asked for the starter.');
    await w.fill(await field('Conversion / business data'), 'Twelve new subscriptions.');

    if (w.lang === 'fr') {
      const hint = await (await field('Top performing posts / content')).getAttribute('placeholder');
      w.check(hint === await w.say('Describe the posts that performed best - topic, format, angle, and rough numbers'), 'a textarea placeholder is not translated');
    }
  });

  await w.step('error states', async () => {
    model = 'message';
    await run.click();
    await expect('Agent error: Model overloaded');
    await w.see('Brand Performance Dashboard', { within: '#root main' });
    w.check(await (await field('Key metrics', 1)).inputValue() === 'Reach 900, saves 60.', 'an error lost what was typed');

    model = 'down';
    await run.click();
    await expect('Synthesis was unavailable. The reading could not be generated. Try again in a moment.');
    w.check(!(await shows('Agent error: Model overloaded', { timeout: 500 })), 'the first error was not replaced');
    w.check(await (await field('Period')).inputValue() === 'Last 30 days', 'an error lost the selected period');
  });

  await w.step('reading', async () => {
    model = 'slow';
    alignment = 'high';
    await run.click();
    await w.see('Intelligence Agent Processing');
    await w.see('Reading performance data...');
    await w.see('Scoring health dimensions...');
    await w.see('Analysis Complete', { timeout: 15000 });
    await w.see(QBP.brandName, { painted: true, within: '#root main' });
    await w.see('Last 30 days', { within: '#root main' });
    await w.see('· Interpreted through QBP');
    await w.see(reading(alignment).executiveSummary, { painted: true });

    // Five gauges. Each counts up to its score and takes the colour of its band.
    const gauges = ['Overall Health', 'Brand Coherence', 'Voice Consistency', 'Audience Alignment', 'Momentum'];
    for (const g of gauges) await w.see(g);
    await p.waitForFunction(() => [...document.querySelectorAll('#root svg text')].map(t => t.textContent).join() === '80,60,30,75,50', null, { timeout: 6000 })
      .catch(() => w.check(false, 'the gauges did not reach 80, 60, 30, 75, 50'));
    const strokes = await p.evaluate(() => [...document.querySelectorAll('#root svg')].map(s => s.querySelectorAll('circle')[1].getAttribute('stroke')));
    w.check(strokes.join() === 'var(--patina),var(--brass),var(--error),var(--patina),var(--brass)', `gauge colours: ${strokes.join()}`);

    // What goes to the model stays English in both languages.
    const sent = String(bodies[bodies.length - 1].messages[0].content);
    w.check(sent.includes('PERFORMANCE PERIOD: Last 30 days') && sent.includes('Platform 1: LinkedIn Personal') && sent.includes('Platform 2: Instagram'), 'option values were not sent in English');
    w.check(sent.includes('Archetype: The Lover') && sent.includes(`Brand: ${QBP.brandName}`), 'the profile was not sent to the model');
    w.check(sent.includes('Low performing posts/content: Generic baking tips, 40 views each.'), 'what was typed did not reach the model');
  });

  await w.step('signals tab', async () => {
    await w.see('Signals (3)');
    const cards = p.locator('#root .signal-card');
    w.check(await cards.count() === 3, 'three signals expected');
    // The first signal is open. The others open on a click.
    await w.see('Evidence from data');
    await w.see('Brand interpretation');
    await w.see('Recommended action');
    await cards.nth(1).locator('> div').first().click();
    await cards.nth(2).locator('> div').first().click();
    for (const s of reading(alignment).signals) for (const v of [s.title, s.finding, s.evidence, s.brandInterpretation, s.recommendation]) await expect(v, { painted: true, timeout: 3000 });
    for (const t of ['On-identity resonance', 'Voice drift warning', 'Breakthrough moment']) await w.see(t);

    // Urgency: High, Medium, Low. Each has its pill, its word and its colour.
    // (The card edge is not checked: the page chassis paints every card
    // border in ink, over the urgency colour the component asks for.)
    const want = [
      { cls: 'pill-error', fill: '--rose-deep', en: 'HIGH', fr: 'ÉLEVÉE' },
      { cls: 'pill-brass', fill: '--gold', en: 'MEDIUM', fr: 'MOYENNE' },
      { cls: 'pill-patina', fill: '--phase-discovery', en: 'LOW', fr: 'FAIBLE' },
    ];
    const seen = [];
    for (let i = 0; i < 3; i++) {
      const pill = cards.nth(i).locator('.pill').first();
      w.check((await pill.getAttribute('class')).includes(want[i].cls), `urgency ${want[i].en}: pill class is ${await pill.getAttribute('class')}`);
      w.check(norm(await pill.textContent()) === want[i][w.lang], `urgency ${want[i].en} reads ${JSON.stringify(await pill.textContent())}`);
      const fill = await pill.evaluate(el => getComputedStyle(el).backgroundColor);
      w.check(fill === await token(want[i].fill), `urgency ${want[i].en}: pill is ${fill}`);
      seen.push(fill);
    }
    w.check(new Set(seen).size === 3, `the three urgency pills are not three colours: ${seen.join(' / ')}`);
  });

  await w.step('platforms tab', async () => {
    await w.click('Platforms');
    await w.see('LinkedIn Personal', { within: '#root main' });
    await w.see('Instagram', { within: '#root main' });
    await w.see('Newsletter', { within: '#root main' });
    for (const l of ['health', 'On-brand performers', 'Off-brand performers', 'Recommended next move']) await w.see(l);
    for (const r of reading(alignment).platformReadings) for (const v of [r.primarySignal, r.onBrandPerformers, r.offBrandPerformers, r.recommendation]) await expect(v, { painted: true, timeout: 3000 });
    // Health 80, 60, 30: one colour per band.
    const scores = await p.evaluate(() => [...document.querySelectorAll('#root main .glass-card')].map(c => {
      const n = [...c.querySelectorAll('div')].find(d => /^\d+$/.test(d.textContent.trim()) && !d.children.length);
      return n ? [n.textContent.trim(), n.style.color] : null;
    }).filter(Boolean).map(x => x.join(':')));
    w.check(scores.join() === '80:var(--patina),60:var(--brass),30:var(--error)', `platform health colours: ${scores.join()}`);
  });

  await w.step('content patterns tab', async () => {
    await w.click('Content Patterns');
    for (const l of ['What is working', 'What is drifting', 'Unexplored territory - biggest opportunity', 'Voice findings']) await w.see(l);
    for (const v of Object.values(reading(alignment).contentPatterns)) await expect(v, { painted: true, timeout: 3000 });
  });

  await w.step('audience tab, each alignment', async () => {
    await w.click('Audience');
    await w.see('Who is actually engaging');
    await expect('Persona alignment:');
    await w.see('Alignment explanation + action');
    await w.see('Emerging audience segment');
    const a = reading(alignment).audienceSignals;
    for (const v of [a.whoIsActuallyEngaging, a.personaAlignmentExplanation, a.emergingAudience]) await expect(v, { painted: true, timeout: 3000 });

    const want = {
      high: { cls: 'pill-patina', en: 'HIGH', fr: 'ÉLEVÉ' },
      medium: { cls: 'pill-brass', en: 'MEDIUM', fr: 'MOYEN' },
      low: { cls: 'pill-error', en: 'LOW', fr: 'FAIBLE' },
    };
    const seen = [];
    const readPill = async level => {
      const pill = p.locator('#root main .pill').first();
      w.check((await pill.getAttribute('class')).includes(want[level].cls), `alignment ${level}: pill class is ${await pill.getAttribute('class')}`);
      w.check(norm(await pill.textContent()) === want[level][w.lang], `alignment ${level} reads ${JSON.stringify(await pill.textContent())}`);
      seen.push(await pill.evaluate(el => getComputedStyle(el).backgroundColor));
    };
    await readPill('high');
    // The two other values need a new reading each. The inputs are kept.
    model = 'ok';
    for (const level of ['medium', 'low']) {
      alignment = level;
      await w.click('New Analysis');
      await w.see('Analyze Performance →');
      w.check(await (await field('Key metrics', 1)).inputValue() === 'Reach 900, saves 60.', 'New Analysis lost the inputs');
      await run.click();
      await w.see('Analysis Complete', { timeout: 15000 });
      await w.click('Audience');
      await w.see('Who is actually engaging');
      await readPill(level);
    }
    w.check(new Set(seen).size === 3, `the three alignment pills are not three colours: ${seen.join(' / ')}`);
  });

  await w.step('strategic directions tab', async () => {
    await w.click('Strategic Dirs');
    w.check(await p.locator('#root main .glass-card').filter({ hasText: /DIR\s*0\d/ }).count() === 3, 'three directions expected');
    await w.see('Implementation');
    await w.see('Risk');
    for (const d of reading(alignment).strategicDirections) for (const v of Object.values(d)) await expect(v, { painted: true, timeout: 3000 });
  });

  await w.step('next 30 days tab', async () => {
    await w.click('Next 30 Days');
    for (const l of ['Single biggest move - next 30 days', 'Content focus', 'Platform focus', 'What to stop', 'What to test', 'QBP Update Flags - Profile Evolution']) await w.see(l);
    const r = reading(alignment);
    for (const v of [...Object.values(r.next30Days), ...r.qbpUpdateFlags]) await expect(v, { painted: true, timeout: 3000 });
  });
}
