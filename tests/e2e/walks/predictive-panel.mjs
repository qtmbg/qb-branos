// Predictive Panel: parameters read from the Brand Profile, the three ways a
// run can fail, the model's answer, all six tabs, and the verdict badge in its
// three states.
//
// The tool sits in Hold, which is not open yet. The walk enters the way the
// helper lets every walk enter a gated page, with a paid tier in storage, and
// checks that the public head of the page says "Not open yet".
export const page = 'predictive-panel..html';
export const title = 'parameters, error states, model answer, six tabs, three verdicts';
export const settle = 2500;   // React and Babel compile the tool in the browser

// What the founder brings. The first five come from the Brand Profile.
const PROFILE = {
  brandName: 'Maison Levain',
  brandEssence: 'Bread first, nothing added to impress.',
  primaryPersona: 'Camille, 38, runs two restaurants and buys bread at dawn.',
  naturalForce: 'Tide',
  archetype: 'The Caregiver',
};
const LAUNCH = {
  concept: 'A weekly loaf subscription for restaurant kitchens, delivered before six.',
  price: '$140 per kitchen per month',
  channel: 'Chef to chef introductions',
  rivals: 'Wholesale bakeries with next-day vans.',
  context: 'Flour costs rose twice this year.',
};

// The model's answer. Verdict, statuses, effort and price direction are the
// literal values the prompt asks for; everything else is the model's prose,
// which the page must paint untouched in both languages.
const answer = (verdict, direction) => ({
  overallConfidenceScore: 72,
  verdict,
  verdictReason: 'Kitchens already trust the loaf; the subscription only moves the hour.',
  panelSummary: 'Most kitchens said yes once delivery before six was certain.',
  scenarios: [
    { name: 'Dawn route fills in a month', probability: 55, description: 'Thirty kitchens sign after the first tasting.', conditions: 'Two vans on the road by March.', isHighConfidence: true },
    { name: 'Slow start, steady climb', probability: 30, description: 'Chefs wait for a colleague to go first.', conditions: 'One anchor kitchen per district.', isHighConfidence: false },
  ],
  highConfidenceZones: [
    { finding: 'Chefs buy on the crust, not on the label.', probability: 81, implication: 'Lead every visit with a warm loaf.', exploitable: true },
  ],
  failurePoints: [
    { risk: 'A late van on day one', probability: 60, trigger: 'A single missed morning in the first fortnight.', mitigation: 'Keep one spare driver on call.' },
  ],
  personaSegments: [
    { segment: 'Bistro owners at the pass', size: '40% of the panel', response: 'They sign when the sous-chef nods.', conversionProbability: 52, insight: 'The sous-chef is the buyer.' },
  ],
  brandFitScore: 44,
  brandFitAnalysis: 'The offer keeps the bakery in its own lane.',
  pricingAnalysis: { priceResistanceProbability: 35, optimalPriceDirection: direction, priceInsight: 'A kitchen compares it to one cover a night.' },
  channelAnalysis: 'Introductions carry further than any listing.',
  pivotDirections: [
    { direction: 'Offer a two-week trial route', expectedConfidenceGain: 'from 72% to 80%', effort: 'low' },
    { direction: 'Add a rye for tasting menus', expectedConfidenceGain: 'from 72% to 76%', effort: 'medium' },
    { direction: 'Open a second oven line', expectedConfidenceGain: 'from 72% to 85%', effort: 'high' },
  ],
  topExploitableAdvantage: 'Nobody else bakes within the ring road.',
  launchReadinessChecklist: [
    { item: 'Dawn delivery rehearsed twice', status: 'ready' },
    { item: 'Invoice template for kitchens', status: 'needs work' },
    { item: 'Second van insured', status: 'critical gap' },
  ],
  finalDirective: 'Sign the first ten kitchens by hand, then let them carry the name.',
});

const VERDICTS = [
  { key: 'go',          model: 'GO - Launch Ready',               label: 'GO - Launch Ready',            direction: 'on target',     shown: 'ON TARGET' },
  { key: 'conditional', model: 'CONDITIONAL GO - Pivot Required', label: 'CONDITIONAL - Pivot Required', direction: 'slightly high', shown: 'SLIGHTLY HIGH' },
  { key: 'no-go',       model: 'NO-GO - Fundamental Issues',      label: 'NO-GO - Do Not Launch',        direction: 'too low',       shown: 'TOO LOW' },
];

export async function walk(w) {
  const p = w.page;
  // French sets a no-break space before : ? and %, and inside numbers, so
  // painted text is compared with every run of white space folded to one.
  const flat = s => String(s).replace(/\s+/g, ' ').trim();
  const painted = async english => flat(await w.say(english));
  const sees = async (english, opts = {}) => {
    const want = opts.painted ? flat(english) : await painted(english);
    await p.waitForFunction(text => {
      const el = document.querySelector('#root');
      return !!el && el.innerText.replace(/\s+/g, ' ').toLowerCase().includes(text.toLowerCase());
    }, want, { timeout: opts.timeout ?? 8000 });
  };
  const button = async english => p.locator('#root').getByRole('button', { name: await painted(english), exact: true });
  const fields = () => p.locator('#root input[type="text"], #root textarea');

  let mode = 'ok';          // 'ok' | 'http-500' | 'gateway' | 'prose'
  let run = VERDICTS[0];
  let delay = 0;
  const asked = [];
  // Unicode-safe, URL-safe base64, the form the page's ?qbp= reader expects.
  const qbp = Buffer.from(JSON.stringify(PROFILE)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  Object.values(PROFILE).forEach(w.note);

  await w.mockModel(async (body, route) => {
    asked.push({ body, lang: route.request().headers()['x-qb-lang'] });
    if (delay) await new Promise(r => setTimeout(r, delay));
    return mode === 'prose' ? 'I could not seat the kitchens today.' : answer(run.model, run.direction);
  });
  // Registered after the model mock, so it is asked first; it steps aside
  // unless the walk wants the server itself to fail.
  await w.mock('**/api/claude', async route => {
    if (mode === 'http-500') return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    if (mode === 'gateway') return route.fulfill({ status: 504, contentType: 'text/plain', body: 'upstream timed out' });
    return route.fallback();
  });

  await w.step('opens for a paid session, and says in public that it is not open', async () => {
    await w.open('qbp=' + qbp);
    w.check(/predictive-panel/.test(p.url()), `the gate sent the session to ${p.url()}`);
    await w.see('Simulation Parameters', { timeout: 20000 });
    const head = await p.evaluate(() => ({
      description: document.querySelector('meta[name="description"]').content,
      og: document.querySelector('meta[property="og:description"]').content,
      twitter: document.querySelector('meta[name="twitter:description"]').content,
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent).description).join(' '),
    }));
    const said = await w.say('The Predictive Panel runs a launch past a synthetic audience built from your Brand Profile before it ships: scenarios, failure points, a go or no-go verdict. Part of Hold in BrandOS. Not open yet.');
    w.check(head.description === said && head.og === said && head.twitter === said, `the three descriptions do not all read: ${said}`);
    w.check(/Not open yet\.$|Pas encore ouvert\.$/.test(head.description), 'the description does not end on "Not open yet."');
    w.check(/Part of Hold\. Not open yet\.$/.test(head.ld), `the JSON-LD description reads: ${head.ld}`);
    for (const stage of ['Parameters', 'Simulating', 'Results']) await w.see(stage, { within: '#root header' });
    w.check(!/Intelligence/i.test(await p.locator('#root header').innerText()), 'the header still carries the retired phase label');
  });

  await w.step('identity comes from the Brand Profile', async () => {
    const values = await fields().evaluateAll(els => els.map(e => e.value));
    w.check(values[0] === PROFILE.brandName && values[1] === PROFILE.naturalForce && values[2] === PROFILE.brandEssence && values[3] === PROFILE.archetype,
      `identity fields hold ${JSON.stringify(values.slice(0, 4))}`);
    w.check(values[4] === PROFILE.primaryPersona, `the persona field holds ${JSON.stringify(values[4])}`);
    await w.see('Sourced from QBP');
    // A textarea placeholder is copy too.
    const hint = await fields().nth(5).getAttribute('placeholder');
    w.check(hint === await w.say('Define the exact intervention. What is it, and what transformation does it enforce?'), `placeholder reads ${JSON.stringify(hint)}`);
  });

  await w.step('the run waits for the four required fields', async () => {
    const start = await button('Initialize Panel');
    w.check(await start.isDisabled(), 'the panel can start without a concept or a price');
    await w.fill(fields().nth(5), LAUNCH.concept);
    w.check(await start.isDisabled(), 'the panel can start without a price');
    await w.fill(fields().nth(6), LAUNCH.price);
    w.check(await start.isEnabled(), 'the panel cannot start with all four required fields filled');
    await w.fill(fields().nth(7), LAUNCH.channel);
    await w.fill(fields().nth(8), LAUNCH.rivals);
    await w.fill(fields().nth(9), LAUNCH.context);
    const sizes = [await button('1,000 personas'), await button('5,000 personas'), await button('10,000 personas')];
    w.check(/\bactive\b/.test(await sizes[1].getAttribute('class')), '5,000 is not the panel size the page starts on');
    await sizes[2].click();
    w.check(/\bactive\b/.test(await sizes[2].getAttribute('class')), '10,000 was not selected');
    w.check(!/Fast|Standard|Deep|Rapide|Approfondi/.test(await p.locator('#root main').innerText()), 'the size buttons still promise a speed the code does not have');
  });

  await w.step('three ways a run fails, each said plainly, nothing lost', async () => {
    const cases = [
      ['http-500', 'Panel disruption: API Error: 500 Internal Server Error'],
      ['gateway', 'The panel was unavailable. No simulation was generated. Try again in a moment.'],
      ['prose', 'The panel was unavailable. No simulation was generated. Try again in a moment.'],
    ];
    for (const [kind, message] of cases) {
      mode = kind;
      await (await button('Initialize Panel')).click();
      await sees(message);
      await w.see('Simulation Parameters');
      const kept = await fields().evaluateAll(els => els.map(e => e.value));
      w.check(kept[0] === PROFILE.brandName && kept[5] === LAUNCH.concept && kept[6] === LAUNCH.price, `after "${kind}" the form lost what was typed`);
    }
    w.check(!/diagnostic was scored|deep reading/i.test(await p.locator('#root').innerText()), 'the error still talks about a diagnostic this tool does not run');
    mode = 'ok';
  });

  await w.step('a run: loading lines, then the result', async () => {
    delay = 2900;           // long enough for the second loading line
    asked.length = 0;
    await (await button('Initialize Panel')).click();
    await w.see('Processing');
    await sees('Instantiating synthetic persona architecture...');
    const count = (10000).toLocaleString(w.lang === 'fr' ? 'fr-FR' : 'en-US');
    await sees((await w.say('Seeding {0} synthetic personas from profile parameters...')).replace('{0}', count), { painted: true });
    await sees('Simulation Complete /', { timeout: 12000 });
    delay = 0;
    await sees(`${count} ${await w.say('Personas')}`, { painted: true });
    await w.see(PROFILE.brandName, { painted: true, within: '#root main' });
    for (const metric of ['Overall Confidence', 'Brand Alignment', 'Price Resistance']) await w.see(metric);
    await p.waitForFunction(() => {
      const n = [...document.querySelectorAll('#root .glass-card span.title-serif')].map(e => parseInt(e.textContent, 10));
      return n.length === 3 && n[0] === 72 && n[1] === 44 && n[2] === 35;
    }, null, { timeout: 8000 });
    await w.see('Kitchens already trust the loaf; the subscription only moves the hour.', { painted: true });
  });

  await w.step('the model was asked once, in English, with the language header', async () => {
    w.check(asked.length === 1, `${asked.length} model call(s) for one run`);
    const { body = {}, lang } = asked[0] || {};
    const prompt = (body.messages && body.messages[0] && body.messages[0].content) || '';
    w.check(body.model === 'claude-sonnet-4-6', `model asked for was ${body.model}`);
    w.check(/Predictive Panel Engine/.test(body.system || ''), 'the system prompt did not reach the model');
    w.check(prompt.includes('Brand: ' + PROFILE.brandName) && prompt.includes(LAUNCH.concept) && prompt.includes('Price point: ' + LAUNCH.price), 'the founder\'s parameters did not reach the model');
    w.check(prompt.includes('Panel size: 10000 synthetic personas'), 'the chosen panel size did not reach the model');
    w.check(lang === w.lang, `the call asked for language ${lang}`);
  });

  const openTab = async name => { await (await button(name)).click(); await p.waitForTimeout(200); };

  await w.step('tab: scenarios', async () => {
    await w.see('Most kitchens said yes once delivery before six was certain.', { painted: true });
    await w.see('Dawn route fills in a month', { painted: true });
    await w.see('Slow start, steady climb', { painted: true });
    await w.see('PRIMARY VECTOR');
    w.check(await p.getByText(await painted('PRIMARY VECTOR'), { exact: true }).count() === 1, 'the primary vector tag is not on exactly one scenario');
    await sees('Conditions:');
    await w.see('Two vans on the road by March.', { painted: true });
  });

  await w.step('tab: high confidence', async () => {
    await openTab('High Confidence');
    await w.see('Structural invariants. These findings maintain stability across all tested scenarios.');
    await w.see('EXPLOITABLE');
    await w.see('Chefs buy on the crust, not on the label.', { painted: true });
    await w.see('Strategic Edge');
    await w.see('Nobody else bakes within the ring road.', { painted: true });
  });

  await w.step('tab: segments', async () => {
    await openTab('Segments');
    await w.see('Behavioral divergence across the simulated population.');
    await w.see('Bistro owners at the pass', { painted: true });
    await sees('Population Share:');
    await w.see('Conversion');
    await w.see('The sous-chef is the buyer.', { painted: true });
  });

  await w.step('tab: failure points and pivots', async () => {
    await openTab('Failure Points');
    await w.see('Identified systemic vulnerabilities. Pre-solve these before execution.');
    await w.see('A late van on day one', { painted: true });
    await sees('60' + await w.say('% Risk'), { painted: true });
    for (const label of ['Trigger Condition', 'Required Mitigation', 'Recommended Pivots']) await w.see(label);
    await sees('Gain:');
    await sees('Friction:');
    for (const effort of ['low', 'medium', 'high']) await w.see(effort);
  });

  await w.step('tab: price and channel', async () => {
    await openTab('Price & Channel');
    await w.see('Economic Elasticity');
    await sees('Vector:');
    await w.see(run.shown);
    await w.see('Tolerance Threshold (Resistance)');
    await w.see('Distribution Fit');
    await w.see('Brand Coherence');
    await w.see('Introductions carry further than any listing.', { painted: true });
  });

  await w.step('tab: directive, copy, readiness', async () => {
    await openTab('Directive');
    await w.see('Executive Summary');
    await w.see('Sign the first ten kitchens by hand, then let them carry the name.', { painted: true });
    await w.click('Copy Directive');
    const copied = await p.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    if (copied !== null) w.check(copied === 'Sign the first ten kitchens by hand, then let them carry the name.', `the clipboard holds ${JSON.stringify(copied)}`);
    await w.see('Pre-Flight Protocol');
    for (const status of ['ready', 'needs work', 'critical gap']) await w.see(status);
    const chips = await p.evaluate(() => [...document.querySelectorAll('#root main span')]
      .filter(s => s.style.borderRadius === '4px' && s.style.letterSpacing === '0.1em')
      .map(s => ({ ink: getComputedStyle(s).color, fill: getComputedStyle(s).backgroundColor })));
    w.check(chips.length === 3, `${chips.length} status chips for three checklist lines`);
    w.check(chips.every(c => !/rgba\(0, 0, 0, 0\)|transparent/.test(c.fill)), `a status chip has no fill: ${JSON.stringify(chips)}`);
    w.check(new Set(chips.map(c => c.ink)).size === 3, 'ready, needs work and critical gap do not read as three colours');
  });

  // Reads the badge as painted: label, its colour, the dot, the fill, the edge.
  const badge = () => p.evaluate(() => {
    const label = [...document.querySelectorAll('#root main span')].find(s => s.style.textTransform === 'uppercase' && s.style.fontWeight === '700' && s.style.fontSize === '13px');
    if (!label) return null;
    const box = label.parentElement, cs = getComputedStyle(box);
    return { label: label.textContent, ink: getComputedStyle(label).color, dot: getComputedStyle(box.firstElementChild).backgroundColor,
      fill: cs.backgroundColor, edge: `${cs.borderTopWidth} ${cs.borderTopStyle}`, edgeColour: cs.borderTopColor };
  });
  const seen = [];

  await w.step('verdict badge: go', async () => {
    const b = await badge();
    w.check(!!b && flat(b.label) === await painted(run.label), `the badge reads ${b && b.label}`);
    seen.push(b);
  });

  for (const next of VERDICTS.slice(1)) {
    await w.step(`verdict badge: ${next.key}`, async () => {
      run = next;
      await w.click('Configure New');
      await w.see('Simulation Parameters');
      w.check((await fields().first().inputValue()) === PROFILE.brandName, 'a new run starts from an empty form');
      await (await button('Initialize Panel')).click();
      await sees('Simulation Complete /', { timeout: 12000 });
      const b = await badge();
      w.check(!!b && flat(b.label) === await painted(next.label), `the model said "${next.model}", the badge reads ${b && b.label}`);
      seen.push(b);
      await openTab('Price & Channel');
      await w.see(next.shown);
    });
  }

  await w.step('the three verdicts look like three verdicts', async () => {
    w.check(seen.length === 3 && seen.every(Boolean), 'a badge was not found');
    const b = seen.filter(Boolean);
    w.check(new Set(b.map(x => x.ink)).size === 3, `go, conditional and no-go share a label colour: ${b.map(x => x.ink).join(' · ')}`);
    w.check(new Set(b.map(x => x.fill)).size === 3, `go, conditional and no-go share a fill: ${b.map(x => x.fill).join(' · ')}`);
    for (const x of b) {
      w.check(x.ink === x.dot, `the dot (${x.dot}) and the label (${x.ink}) of "${x.label}" disagree`);
      w.check(x.edge === '1px solid' && !/rgba\(0, 0, 0, 0\)/.test(x.edgeColour), `"${x.label}" has no border: ${x.edge} ${x.edgeColour}`);
    }
  });
}
