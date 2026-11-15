// War Table: the Starter gate, the ten steps, the dossier, every way the
// synthesis can fail, the exports, the signature and print.
export const page = 'war-table.html';
export const title = 'Starter gate, ten steps, dossier, error paths, exports, signature';
export const session = true;    // the exercise opens with Starter, so the founder is signed in
export const timeout = 180;     // seconds; a clean run takes about 70

const norm = s => String(s).replace(/\s+/g, ' ').trim();
const wait = ms => new Promise(r => setTimeout(r, ms));

const BRAND = 'Maison Levain';
const PERSONA = 'Lea, 34, bakery owner';
const EMAIL = 'lea@example.com';
const SERVER_SAID = 'Walk server message: the model is overloaded.';

// Five initiatives, one per band edge: two NOW, one NEXT, one LATER, one PARK.
const INITIATIVES = [
  { name: 'Alpha', pillar: 'Revenue',    score: 10, band: 'NOW',   final: 100 },
  { name: 'Beta',  pillar: 'Awareness',  score: 9,  band: 'NOW',   final: 90 },
  { name: 'Gamma', pillar: 'Delight',    score: 7,  band: 'NEXT',  final: 70 },
  { name: 'Delta', pillar: 'Automation', score: 5,  band: 'LATER', final: 50 },
  { name: 'Epsilon', pillar: 'Reputation', score: 2, band: 'PARK', final: 20 },
];

// What the model answers. The second handoff names an operator-only tool
// and must never reach the page. The third names a Hold tool: it is shown,
// marked "not open yet" and never linked.
const DOSSIER = {
  diagnosis: {
    posture: 'Walk posture read: two bets, one persona.',
    hiddenPattern: 'Walk hidden pattern: the list is all revenue.',
    glossedGap: 'Walk glossed gap: the timing answer was thin.',
    challenge: 'Walk challenge: Beta has no named client.',
  },
  postureStatement: 'You are choosing depth over reach, for one quarter.',
  fieldPlan: [
    { week: 1, initiatives: [{ name: 'Alpha', action: 'Walk action one', owner: 'Walk owner one', leadingIndicator: 'Walk indicator one', killCondition: 'Walk kill one', dependency: 'Beta' }] },
    { week: 2, initiatives: [{ name: 'Beta', action: 'Walk action two', owner: 'Walk owner two', leadingIndicator: 'Walk indicator two', killCondition: 'Walk kill two' }] },
  ],
  nextList: [{ name: 'Gamma', prerequisite: 'Walk prerequisite', triggerMilestone: 'Walk milestone' }],
  laterList: [{ name: 'Delta', conditionToMove: 'Walk condition to move' }],
  parkList: [{ name: 'Epsilon', honestReason: 'Walk honest reason', revisitWhen: 'Walk revisit date' }],
  principles: ['Walk principle one.', 'Walk principle two.', 'Walk principle three.'],
  personaContract: 'Walk letter: you finally made the thing I kept asking for.',
  accountabilityPack: {
    kickoffEmail: { subject: 'Walk kickoff subject', body: 'Walk kickoff body, first line.' },
    weeklyRitual: ['Walk ritual question one', 'Walk ritual question two'],
    day60Retro: ['Walk retro question one', 'Walk retro question two'],
  },
  handoffs: [
    { tool: 'visual-dna.html', toolLabel: 'A name the model made up', reason: 'Walk reason: the look comes next.', priority: 'immediate' },
    { tool: 'instagram-seed-agent.html', toolLabel: 'Instagram Seed Agent', reason: 'Walk reason: an operator-only tool.', priority: 'week 2' },
    { tool: 'predictive-panel..html', toolLabel: 'Predictive Panel', reason: 'Walk reason: test the plan on a panel.', priority: 'day 30' },
    { tool: 'voice-guide-agent.html', toolLabel: 'Voice Guide', reason: 'Walk reason: the voice follows the plan.', priority: 'week 2' },
  ],
  qbpFieldsWritten: ['warTablePosture'],
};

// The seven content agents are operator-only. None may be offered to the
// model as a handoff, and none may be painted.
const OPERATOR_ONLY = ['instagram-seed-agent', 'linkedin-strategy-agent', 'youtube-strategy-agent', 'newsletter-architecture-agent',
  'content-bridge', 'content-repurposing-engine', 'content-scheduler'];

// Stands in for PptxGenJS, which the page loads from a CDN. It keeps what
// each deck was given, so the walk can read the slides and the file name
// without a network call. The library itself is not exercised.
const DECK_STAND_IN = `
window.__decks = window.__decks || [];
window.PptxGenJS = function () {
  var deck = { texts: [], file: null, slides: 0 };
  window.__decks.push(deck);
  var grab = function (v) {
    if (typeof v === 'string') { if (v.trim()) deck.texts.push(v); }
    else if (Array.isArray(v)) v.forEach(grab);
    else if (v && typeof v === 'object' && 'text' in v) grab(v.text);
  };
  this.defineSlideMaster = function (def) { if (def && def.objects) def.objects.forEach(function (o) { if (o && o.text) grab(o.text); }); };
  this.addSlide = function () {
    deck.slides++;
    var slide = {
      addText: function (t) { grab(t); return slide; },
      addTable: function (rows) { grab(rows); return slide; },
      addShape: function () { return slide; },
      addImage: function () { return slide; }
    };
    return slide;
  };
  this.ShapeType = new Proxy({}, { get: function (t, k) { return String(k); } });
  this.shapes = this.ShapeType;
  this.writeFile = function (o) { deck.file = o && o.fileName; return Promise.resolve(deck.file); };
};`;

export async function walk(w) {
  const p = w.page;

  // w.see matches through XPath, whose normalize-space leaves a no-break
  // space alone. French lines that carry one (before ? : ;) are read here.
  const shows = async (written, { painted = false, within = 'body', exact = true, timeout = 8000 } = {}) => {
    const text = norm(painted ? written : await w.say(written));
    try {
      await p.waitForFunction(([t, sel, ex]) => {
        const n = s => s.replace(/\s+/g, ' ').trim();
        const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node; (node = tw.nextNode());) {
          const v = n(node.data);
          if (!v || !(ex ? v === t : v.includes(t))) continue;
          const el = node.parentElement;
          if (el && el.closest(sel) && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden') return true;
        }
        return false;
      }, [text, within, exact], { timeout });
      return true;
    } catch (e) { return false; }
  };
  // need() waits for a screen to arrive and stops the step when it does not.
  // expect() reads a screen that is already there, so it gives up quickly:
  // a broken screen fails in seconds, not in eight seconds per line.
  const expect = async (written, opts = {}) => w.check(await shows(written, { timeout: 2500, ...opts }), `not on screen: ${JSON.stringify(written)}`);
  const need = async (written, opts) => { if (!(await shows(written, opts))) throw new Error(`not on screen: ${JSON.stringify(written)}`); };
  const absent = async (written, opts = {}) => w.check(!(await shows(written, { timeout: 300, ...opts })), `should not be on screen: ${JSON.stringify(written)}`);
  const count = sel => p.locator(sel).count();
  const execute = () => p.locator('#actionbar .btn-primary');

  // A real pointer press on a button while a field still has the caret.
  // mousedown blurs the field, its change event fires, and the button must
  // still be the one under the pointer when the mouse comes up.
  const press = async locator => {
    const box = await locator.boundingBox();
    if (!box) throw new Error('nothing to press');
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down();
    await p.mouse.up();
    await p.waitForTimeout(350);
  };
  // Real keystrokes, with the caret left in the field.
  const type = async (selector, text) => {
    w.note(text);
    const field = typeof selector === 'string' ? p.locator(selector).first() : selector;
    await field.click();
    await p.keyboard.type(text);
  };
  const stepIs = async n => w.check(await p.evaluate(() => {
    const dots = [...document.querySelectorAll('.wt-phase-dot')];
    return dots.findIndex(d => d.classList.contains('active'));
  }) === n, `the step dots do not show step ${n} as the current one`);
  const qbp = () => p.evaluate(() => JSON.parse(localStorage.getItem('qb_qbp') || '{}'));
  const clipboard = () => p.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  const toast = async written => expect(written, { within: '.wt-toast', timeout: 4000 });

  // The helper gives every page load a paid tier. While the flag below is
  // set, the tier keys are dropped and kept out, so the page opens as a
  // free account, with or without a session.
  await p.addInitScript(() => {
    let mode = null;
    try { mode = sessionStorage.getItem('walk_free'); } catch (e) {}
    if (!mode) return;
    const blocked = mode === 'anon' ? ['qb_user_tier', 'qb_sub_status', 'qb_session'] : ['qb_user_tier', 'qb_sub_status'];
    const setItem = Storage.prototype.setItem;
    if (mode === 'session') setItem.call(localStorage, 'qb_session', JSON.stringify({ token: 'walk', userId: '00000000-0000-4000-8000-000000000000' }));
    blocked.forEach(k => localStorage.removeItem(k));
    Storage.prototype.setItem = function (k, v) { if (this === localStorage && blocked.includes(k)) return; return setItem.call(this, k, v); };
  });
  const landAsFree = async (mode, target) => {
    await p.evaluate(m => sessionStorage.setItem('walk_free', m), mode);
    await p.goto(target, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await p.waitForURL(u => u.pathname !== new URL(target).pathname, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(400);
    const landed = new URL(p.url());
    await p.evaluate(() => sessionStorage.removeItem('walk_free')).catch(() => {});
    return landed;
  };

  // The model: one handler for every way the call can go wrong, then the
  // dossier. Each request body and language header is kept.
  let mode = 'ok';
  let calls = 0;
  // Each call is held until the walk has read the loading screen, so that
  // screen is checked on every attempt and never raced.
  let held = false;
  let release = () => {};
  const letGo = async () => {
    const t0 = Date.now();
    while (!held && Date.now() - t0 < 8000) await wait(20);
    held = false;
    release();
  };
  const asked = [];
  await w.mockModel(async (body, route) => { asked.push({ body, lang: route.request().headers()['x-qb-lang'] }); return DOSSIER; });
  await w.mock('**/api/claude', async route => {
    calls++;
    await new Promise(r => { release = r; held = true; });
    const json = (status, obj) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });
    const said = text => json(200, { content: [{ type: 'text', text }] });
    switch (mode) {
      case '404':     return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
      case '502':     return route.fulfill({ status: 502, contentType: 'text/plain', body: 'bad gateway' });
      case 'html':    return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>a proxy page</html>' });
      case 'garbled': return route.fulfill({ status: 200, contentType: 'application/json', body: 'not json at all' });
      case '503':     return json(503, { error: 'not configured' });
      case 'shape':   return json(200, {});
      case 'server':  return json(500, { error: { message: SERVER_SAID } });
      case 'prose':   return said('I could not produce the dossier.');
      case 'broken':  return said('{ broken }');
      default:        return route.fallback();
    }
  });
  await w.mock(/unpkg\.com\/pptxgenjs/, route => route.fulfill({ status: 200, contentType: 'application/javascript', body: DECK_STAND_IN }));
  const sent = [];
  await w.mock('**/api/send-results', route => { sent.push(JSON.parse(route.request().postData() || '{}')); return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
  w.note(SERVER_SAID);
  w.note(BRAND.toUpperCase());

  await w.step('a free account is sent away', async () => {
    await w.open();
    const target = p.url();
    const here = new URL(target);

    // No session: the sign-in page, carrying the way back.
    const anon = await landAsFree('anon', target);
    w.check(anon.pathname === '/login', `with no session the browser landed on ${anon.pathname}${anon.search}, not /login`);
    w.check(anon.searchParams.get('reason') === 'paywall', `sign-in reason is ${anon.searchParams.get('reason')}`);
    w.check(anon.searchParams.get('return_to') === here.pathname + here.search, `return_to is ${anon.searchParams.get('return_to')}`);

    // A session on the free plan: the server confirms the tier, then the plan page.
    const profile = route => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ qbp: {}, first_name: null, tier: 'free', subscription_status: 'inactive', tool_completions: {} }]) });
    await p.route(/supabase\.co\/rest\/v1\/profiles/, profile);
    const free = await landAsFree('session', target);
    await p.unroute(/supabase\.co\/rest\/v1\/profiles/, profile);
    w.check(free.pathname === '/payment.html', `a signed-in free account landed on ${free.pathname}${free.search}, not /payment.html`);
    w.check(free.searchParams.get('reason') === 'upgrade' && free.searchParams.get('tool') === 'war-table', `plan page query is ${free.search}`);

    await p.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  });

  await w.step('step 0 · intro', async () => {
    await w.open();
    await need('Every resource you deploy');
    await expect('Collapse · War Table · Strategic prioritization');
    w.check(new URL(p.url()).pathname === '/war-table.html', 'a Starter account did not stay on the War Table');
    // What the page says about itself, against what it holds.
    w.check(await count('.wt-phase-dot') === 10, `ten steps expected on the step dots, found ${await count('.wt-phase-dot')}`);
    w.check(await count('.wt-intro-philosophy .phil-row') === 3, 'the design philosophy does not hold three principles');
    await expect('est. 3 min');
    await stepIs(0);
    w.check(await p.locator('.wt-back').isDisabled(), 'Return is live on the first step');
    w.check(await execute().isEnabled(), 'Execute is not ready on the intro');
    await press(execute());
  });

  await w.step('step 1 · the brief', async () => {
    await need('The Brief');
    await expect('Step 1');
    await stepIs(1);
    w.check(await execute().isDisabled(), 'Execute is live before the brief is filled');
    await expect('System halt: complete all diagnostic fields.');
    await w.fill('#brief-brand-name', BRAND);
    await w.fill('#brief-primary-target', PERSONA);
    w.check(norm(await p.locator('#persona-gap-label').textContent()) === PERSONA, 'the gap label does not follow the persona field');
    await w.fill('#brief-bottleneck', 'Walk bottleneck: weekday footfall.');
    await w.fill('#brief-next-month', 'Walk delay: the wholesale offer.');
    await w.fill('#brief-months-delayed', '4');
    await w.fill('#brief-working', 'Walk vector: word of mouth.');
    await w.fill('#brief-persona-gap', 'Walk gap: no weekday reason to come.');
    await w.fill('#brief-revenue', '400k');
    await w.fill('#brief-team-size', '6');
    w.check(await count('#brief-constraint option') === 5, 'the binding constraint does not offer five options');
    await p.locator('#brief-constraint').selectOption('Clarity');
    w.check(await execute().isDisabled(), 'Execute is live with the primary metric still empty');
    // The last field is typed, then Execute is pressed with the caret still in it.
    await type('#brief-key-metric', 'Weekday revenue');
    await absent('System halt: complete all diagnostic fields.');
    await press(execute());
  });

  await w.step('step 2 · audience', async () => {
    await need('Audience Intelligence.');
    await expect('Step 2');
    await stepIs(2);
    w.check(await count('.wt-audience-field textarea') === 4, 'the audience step does not hold four fields');
    await expect('System halt: map all four audience layers before advancing.');
    await w.fill('#audience-fears', 'Walk fear: being one more bakery.');
    await w.fill('#audience-desires', 'Walk desire: a place that knows her order.');
    await w.fill('#audience-language', 'Walk language: plain, warm, no jargon.');
    w.check(norm(await p.locator('#audience-fears-count').innerText()) === `${'Walk fear: being one more bakery.'.length} / 600`, 'the character counter does not count');
    await type('#audience-friction', 'Walk friction: the price of a loaf.');
    const saved = await qbp();
    w.check(saved.audienceFears === 'Walk fear: being one more bakery.' && saved.audienceFriction === 'Walk friction: the price of a loaf.', 'the audience fields were not saved to the profile as they were typed');
    await press(execute());
  });

  await w.step('step 3 · brainstorm', async () => {
    await need('The Brainstorm');
    await expect('Step 3');
    await stepIs(3);
    await expect('Memory bank empty');
    await expect('Initiate upload sequence across the 5 pillars.');
    w.check(await count('.wt-input-card select option') === 5, 'the pillar list does not hold five pillars');
    const add = async (name, pillar, persona) => {
      await w.fill(p.locator('.wt-input-card input.glass-input').nth(0), name);
      await p.locator('.wt-input-card select').selectOption(pillar);
      await w.fill(p.locator('.wt-input-card textarea'), `Walk description of ${name}.`);
      if (persona) await w.fill(p.locator('.wt-input-card input.glass-input').nth(1), persona);
      await w.click('Write to memory');
    };
    await add('Alpha', 'Revenue', 'Lea');
    await add('Beta', 'Awareness');
    await expect('System halt: insufficient data. Add 3 initiatives. (2/3)');
    w.check(await execute().isDisabled(), 'Execute is live with two initiatives');
    await add('Gamma', 'Delight');
    w.check(await execute().isEnabled(), 'Execute is not ready with three initiatives');
    await add('Delta', 'Automation');
    await add('Epsilon', 'Reputation');
    await add('Zeta', 'Revenue');
    w.check(await count('.wt-initiative-card') === 6, 'six initiatives were written and the list does not show six');
    // Remove the sixth.
    await p.locator('.wt-initiative-card').nth(5).locator('.wt-delete-btn').click();
    w.check(await count('.wt-initiative-card') === 5, 'deleting an initiative did not remove it');
    await expect('USR: Lea');
    await expect('Awareness', { within: '.wt-initiative-card' });
    await press(execute());
  });

  await w.step('step 4 · interrogation', async () => {
    await need('⚡ Interrogation');
    await expect('Step 4');
    await stepIs(4);
    await expect('System halt: complete all interrogation protocols.');
    w.check(await count('.wt-interrogate-row') === 5, 'not every initiative is up for interrogation');
    for (let i = 0; i < 5; i++) {
      await p.locator('.wt-interrogate-head').nth(i).click();
      const fields = p.locator('.wt-interrogate-row.active textarea');
      w.check(await fields.count() === 4, 'an initiative is not asked four questions');
      if (i === 0) for (const q of ['01. The Utility Test', '02. The Timing Test', '03. Persona & Brand Test', '04. Cost of Inaction']) await expect(q, { within: '.wt-interrogate-row.active' });
      for (let f = 0; f < 3; f++) await w.fill(fields.nth(f), `Walk answer ${f + 1} for ${INITIATIVES[i].name}.`);
      if (i < 4) {
        await w.fill(fields.nth(3), `Walk answer 4 for ${INITIATIVES[i].name}.`);
        await w.click('Commit block', { within: '.wt-interrogate-row.active' });
        w.check(await count('.wt-interrogate-row.active') === 0, 'Commit block did not close the initiative');
      } else {
        // The last answer is typed, then Execute is pressed with the block still open.
        await type(fields.nth(3), 'Walk answer 4 for Epsilon.');
      }
    }
    // The tick is drawn when a block closes. Four are closed, the fifth is still open.
    w.check(await count('.wt-interrogate-check') === 4, 'a committed initiative does not carry its tick');
    await press(execute());
  });

  await w.step('step 5 · scoring', async () => {
    await need('Scoring Engine');
    await expect('Step 5');
    await stepIs(5);
    // The weights on the table are the weights in the formula.
    const weights = await p.evaluate(() => [...document.querySelectorAll('.wt-scoring thead .mult')].map(e => e.textContent.replace(',', '.').trim()));
    w.check(weights.join(' ') === '× 2.0 × 1.0 × 2.0 × 1.5 × 1.5 × 1.0 +5', `weights shown: ${weights.join(' ')}`);
    for (let i = 0; i < 5; i++) {
      const row = p.locator('.wt-scoring tbody tr').nth(i);
      const inputs = row.locator('input[type=number]');
      w.check(await inputs.count() === 6, 'a row does not hold six scores');
      for (let k = 0; k < 6; k++) await inputs.nth(k).fill(String(INITIATIVES[i].score));
      w.check(norm(await row.locator('.score').innerText()) === String(INITIATIVES[i].final), `${INITIATIVES[i].name}: score ${await row.locator('.score').innerText()}, expected ${INITIATIVES[i].final}`);
      w.check(norm(await row.locator('.band').innerText()) === (await w.say(INITIATIVES[i].band)), `${INITIATIVES[i].name}: band ${await row.locator('.band').innerText()}, expected ${INITIATIVES[i].band}`);
    }
    // Lead capture adds five points, and takes them back.
    const gamma = p.locator('.wt-scoring tbody tr').nth(2);
    await gamma.locator('.capture-cb').check();
    w.check(norm(await gamma.locator('.score').innerText()) === '75', 'lead capture did not add five points');
    await gamma.locator('.capture-cb').uncheck();
    w.check(norm(await gamma.locator('.score').innerText()) === '70', 'unticking lead capture did not take the five points back');
    await press(execute());
  });

  await w.step('step 6 · trade-offs', async () => {
    await need('Trade-off Arena');
    await expect('Step 6');
    await stepIs(6);
    w.check(await count('.wt-arena') === 3, 'the arena does not hold three conflicts');
    // The close call sets the two NOW initiatives against each other.
    const slots = await p.evaluate(() => [...document.querySelectorAll('.wt-vs .slot')].map(e => e.textContent.trim()));
    w.check(slots.join() === 'Alpha,Beta', `the close call shows ${slots.join(' vs ')}`);
    await expect('System halt: resolve all strategic conflicts.');
    const inputs = p.locator('.wt-arena input.glass-input');
    w.check(await inputs.count() === 7, 'the three conflicts do not ask seven answers');
    for (let i = 0; i < 6; i++) await w.fill(inputs.nth(i), `Walk trade-off answer ${i + 1}`);
    await type(inputs.nth(6), 'Walk trade-off answer 7');
    await press(execute());
  });

  await w.step('step 7 · unlock', async () => {
    await need('System ready');
    await stepIs(7);
    await expect('Authorization required: submit credentials to unlock.');
    const submit = p.locator('#wt-submit-btn');
    w.check(await submit.isDisabled(), 'the form can be sent empty');
    await w.fill('#lead-name', 'Lea');
    await w.fill('#lead-surname', 'Martin');
    await w.fill('#lead-company', BRAND);
    await type('#lead-email', 'lea@example');
    w.check(await submit.isDisabled(), 'the form accepts an address with no domain');
    await p.keyboard.type('.com');
    await press(submit);
    await need('Compiling output');
  });

  await w.step('step 8 · roadmap', async () => {
    await need('Roadmap', { timeout: 6000 });
    await expect('Step 8');
    await stepIs(8);
    await expect('The NOW list');
    w.check(await count('.wt-now-card') === 2, 'the NOW list does not hold the two NOW initiatives');
    w.check(await count('.wt-next-card') === 1, 'the NEXT list does not hold the one NEXT initiative');
    const tail = await p.evaluate(() => [...document.querySelectorAll('.wt-later-park li')].map(e => e.textContent.trim()));
    w.check(tail.join() === 'Delta,Epsilon', `LATER and PARK show ${tail.join()}`);
    const saved = await qbp();
    w.check(JSON.stringify(saved.warTableTopInitiatives) === JSON.stringify(['Alpha', 'Beta', 'Gamma']), `top initiatives saved: ${JSON.stringify(saved.warTableTopInitiatives)}`);
    w.check(saved.brandName === BRAND && saved.warTableBrief && saved.warTableBrief.constraint === 'Clarity', 'the brief was not saved to the profile');
    await need('Send me my results', { within: '#qb-float-results', timeout: 4000 });
  });

  // Step 9 is reached once. Every failure is then played on the same
  // screen through Retry and Regenerate, the way a founder would meet it.
  const retry = async (next, label) => {
    const before = calls;
    mode = next;
    await w.click(label);
    await need('Composing your Dossier');
    await letGo();
    await p.waitForFunction(() => !document.querySelector('.d-loading-status'), null, { timeout: 8000 });
    w.check(calls === before + 1, `"${label}" did not call the model again (${next})`);
  };
  const UNAVAILABLE = 'Synthesis was unavailable. The diagnostic was scored but the deep reading could not be generated. Try again in a moment.';
  const baseline = async () => {
    await need('Strategic Command · Dossier generated');
    w.check(await count('.d-section') === 8, `the dossier does not hold eight sections (${await count('.d-section')})`);
    for (const pending of ['Pending posture read.', 'Pending pattern read.', 'Pending gap surface.', 'Pending honest challenge.',
      'Pending posture statement.', 'No principles extracted yet.', 'No handoffs generated.', 'Queue empty.', 'Nothing parked here.',
      'Nothing parked this year.']) await expect(pending, { within: '.dossier' });
    w.check(await count('.d-week-block') === 8, `the empty field plan does not show eight weeks (${await count('.d-week-block')})`);
    await expect(`Dear ${BRAND}, I wanted to write this because something changed. You finally built the thing I was waiting for.`);
    await expect('2 initiatives NOW · 1 parked');
  };

  await w.step('step 9 · no endpoint, then the baseline', async () => {
    mode = '404';
    await press(execute());
    await stepIs(9);
    await need('Composing your Dossier');
    await expect('Analyzing your NOW list against the binding constraint');
    await expect('Please keep this tab open · 20–40 seconds · Do not reload');
    await letGo();
    await need('Full synthesis needs the QB API key.');
    await expect('AI synthesis unavailable');
    await expect('This environment cannot call the AI service.');
    await w.click('Show baseline dossier');
    await baseline();
  });

  await w.step('step 9 · every other failure', async () => {
    await retry('502', 'Regenerate');
    await need('We hit a snag.');
    await expect(UNAVAILABLE);
    await expect('The baseline dossier is available. Retry the synthesis, or continue with the baseline.');
    await retry('html', 'Retry synthesis');
    await expect(UNAVAILABLE);
    await retry('garbled', 'Retry synthesis');
    await expect(UNAVAILABLE);
    await retry('503', 'Retry synthesis');
    await need('Full synthesis needs the QB API key.');
    await retry('shape', 'Retry synthesis');
    await expect('Unexpected response from AI service.');
    await retry('server', 'Retry synthesis');
    await expect(SERVER_SAID, { painted: true });
    await retry('prose', 'Retry synthesis');
    await expect('AI response was not valid JSON.');
    await retry('broken', 'Retry synthesis');
    await expect('Could not parse the AI response as JSON.');
    await w.click('Continue with baseline');
    await baseline();
  });

  await w.step('step 9 · the dossier', async () => {
    await retry('ok', 'Regenerate');
    await need('Strategic Command · Dossier generated');
    w.check(norm(await p.locator('.dossier-head h1').innerText()) === BRAND.toUpperCase(), 'the dossier is not headed with the brand');
    const today = await p.evaluate(() => new Date().toISOString().split('T')[0]);
    await expect(`Prepared ${today} · primary target: ${PERSONA}`);
    for (const k of ['01 · Diagnosis', '02 · Posture statement', '03 · 8-week field plan', '04 · Queues', '05 · Principles',
      '06 · Persona contract', '07 · Accountability pack', '08 · Handoffs']) await expect(k);

    // What the model wrote is on the page.
    for (const said of [DOSSIER.diagnosis.posture, DOSSIER.diagnosis.hiddenPattern, DOSSIER.diagnosis.glossedGap, DOSSIER.diagnosis.challenge,
      DOSSIER.postureStatement, 'Walk action one', 'Walk owner two', 'Walk indicator one', 'Walk kill two', 'Walk condition to move',
      ...DOSSIER.principles, DOSSIER.personaContract]) await expect(said, { painted: true, within: '.dossier' });
    await expect('Unlocks: Beta');
    await expect('Walk prerequisite · trigger: Walk milestone');
    await expect('Walk honest reason · revisit: Walk revisit date');
    w.check(await count('.d-week-block') === 2, 'the field plan does not show the two planned weeks');
    await expect('Week 1'); await expect('Week 2');
    w.check(norm(await p.locator('.d-letter .printed').innerText()).toLowerCase() === PERSONA.toLowerCase(), 'the letter is not signed by the persona');

    // The model was asked in the page language, and was not offered a tool
    // a founder cannot reach.
    const last = asked[asked.length - 1];
    w.check(last && last.lang === w.lang, `the model call carried X-QB-Lang ${last && last.lang}`);
    const prompt = last ? String(last.body.messages[0].content) : '';
    for (const slug of OPERATOR_ONLY) w.check(!prompt.includes(slug), `the prompt still offers ${slug} as a handoff`);
    for (const file of ['signal-scan.html', 'the-profiles.html', 'brand-document.html', 'voice-guide-agent.html', 'predictive-panel..html']) {
      w.check(prompt.includes(file), `the prompt no longer offers ${file}`);
    }
    w.check(/not open yet/.test(prompt), 'the prompt does not tell the model that the Hold tools are not open yet');

    // Three handoffs reach the page: the operator-only one is gone.
    const cards = await p.evaluate(() => [...document.querySelectorAll('.d-handoff')].map(c => ({
      tag: c.tagName, href: c.getAttribute('href'), name: c.querySelector('h4').textContent.trim(),
      priority: c.querySelector('.priority').textContent.trim(), go: (c.querySelector('.goto') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(),
    })));
    w.check(cards.length === 3, `handoffs on the page: ${cards.map(c => c.name).join(', ')}`);
    const [look, hold, voice] = cards;
    w.check(look && look.tag === 'A' && look.href === 'visual-dna.html?from=war-table' && look.name === 'Visual DNA', `first handoff: ${JSON.stringify(look)}`);
    w.check(look && look.priority === (await w.say('IMMEDIATE')) && look.go === `${await w.say('Open Visual DNA')} →`, `first handoff reads: ${JSON.stringify(look)}`);
    w.check(hold && hold.tag === 'DIV' && !hold.href && hold.name === 'Predictive Panel', `a Hold tool is linked or misnamed: ${JSON.stringify(hold)}`);
    w.check(hold && hold.priority === (await w.say('NOT OPEN YET')) && hold.go === '', `a Hold tool does not say it is not open yet: ${JSON.stringify(hold)}`);
    w.check(voice && voice.tag === 'A' && voice.href === 'voice-guide-agent.html?from=war-table' && voice.name === 'Voice Guide', `third handoff: ${JSON.stringify(voice)}`);
    const handoffText = norm(await p.locator('.d-handoffs').innerText());
    w.check(!/instagram|made up|operator-only/i.test(handoffText), 'an operator-only handoff, or the model\'s own name for a tool, reached the page');

    const saved = await qbp();
    w.check(saved.warTablePosture === DOSSIER.postureStatement && saved.warTableNextHandoff === 'visual-dna.html', 'the dossier was not saved to the profile');
    w.check(Array.isArray(saved.warTablePrinciples) && saved.warTablePrinciples.length === 3, 'the principles were not saved to the profile');
  });

  await w.step('accountability pack and its copy buttons', async () => {
    w.check(await count('.d-acc-item') === 3, 'the accountability pack does not hold three tools');
    const heads = p.locator('.d-acc-head');
    const copy = () => p.locator('.d-acc-item.active .d-acc-copy');

    await heads.nth(0).click();
    w.check(await count('.d-acc-item.active') === 1, 'the kickoff email did not open');
    await expect('Walk kickoff subject', { painted: true, within: '.d-acc-item.active' });
    await expect('Walk kickoff body, first line.', { painted: true, within: '.d-acc-item.active' });
    await copy().click();
    await toast('Copied.');
    const mail = await clipboard();
    if (mail !== null) w.check(mail.includes('Walk kickoff subject') && mail.includes('Walk kickoff body, first line.') && mail.startsWith(await w.say('Subject')), `kickoff copy: ${JSON.stringify(mail)}`);

    await heads.nth(1).click();
    await expect('Walk ritual question two', { painted: true, within: '.d-acc-item.active' });
    await copy().click();
    const ritual = await clipboard();
    if (ritual !== null) w.check(ritual === '1. Walk ritual question one\n2. Walk ritual question two', `ritual copy: ${JSON.stringify(ritual)}`);

    await heads.nth(2).click();
    await expect('Walk retro question one', { painted: true, within: '.d-acc-item.active' });
    await copy().click();
    const retro = await clipboard();
    if (retro !== null) w.check(retro === '1. Walk retro question one\n2. Walk retro question two', `retro copy: ${JSON.stringify(retro)}`);

    await heads.nth(2).click();
    w.check(await count('.d-acc-item.active') === 0, 'an open tool did not close');
  });

  let copied = null;     // the Markdown as it left the page, in this language
  await w.step('copy as Markdown', async () => {
    await w.click('Copy as Markdown');
    await toast('Dossier copied as Markdown.');
    const md = copied = await clipboard();
    if (md === null) return;
    const lines = md.split('\n');
    w.check(lines[0] === `# ${await w.say('Strategic Command Dossier')}`, `first line of the copy: ${JSON.stringify(lines[0])}`);
    w.check(md.includes(BRAND) && md.includes(DOSSIER.postureStatement) && md.includes('Walk kickoff body, first line.'), 'the copy is missing the brand or the model\'s text');
    for (const h of ['01 · Diagnosis', '03 · Field plan', '04 · Queues', '05 · Principles', '07 · Accountability pack', '08 · Handoffs']) {
      w.check(lines.includes(`## ${await w.say(h)}`), `the copy has no "${h}" heading in this language`);
    }
    w.check(lines.includes(`  - ${await w.say('Not open yet')}`), 'the copy does not say the Hold tool is not open yet');
    w.check(md.includes('`visual-dna.html`') && !md.includes('predictive-panel..html'), 'the copy points at a Hold tool, or lost the open one');
    w.check(!/instagram|made up/i.test(md), 'the copy carries an operator-only handoff');
    if (w.lang === 'fr') w.check(!lines.some(l => /^#+ .*(Diagnosis|Principles|Handoffs|Queues)/.test(l)), 'a heading of the French copy is still in English');
  });

  await w.step('email to self', async () => {
    // A mailto opens the founder's mail client. The link is read instead.
    await p.evaluate(() => {
      const click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { if (/^mailto:/i.test(this.href)) { window.__mailto = this.href; return; } return click.apply(this, arguments); };
    });
    await w.click('Email to self');
    const href = await p.evaluate(() => window.__mailto || '');
    w.check(href.startsWith('mailto:' + encodeURIComponent(EMAIL) + '?subject='), `the link is addressed to ${href.slice(0, 60)}`);   // sliced for the message only
    const q = new URLSearchParams(href.split('?')[1] || '');
    w.check(q.get('subject') === `${await w.say('Strategic Command Dossier')} · ${BRAND}`, `subject: ${q.get('subject')}`);
    w.check((q.get('body') || '').startsWith(`# ${await w.say('Strategic Command Dossier')}`), 'the body does not open with the dossier title in this language');
    // A mail link holds 1,800 characters of the dossier. Past that the page says so.
    if (copied !== null) {
      w.check(q.get('body') === copied.slice(0, 1800), 'the body is not the first 1,800 characters of the Markdown');
      if (copied.length > 1800) await toast('Email preview is long. Consider Copy as Markdown instead.');
      else await absent('Email preview is long. Consider Copy as Markdown instead.', { within: '.wt-toast' });
    }
  });

  await w.step('deck buttons', async () => {
    const decks = () => p.evaluate(() => (window.__decks || []).map(d => ({ file: d.file, slides: d.slides, text: d.texts.join('\n') })));
    await w.click('Download PPTX');
    await p.waitForFunction(() => window.__decks && window.__decks[0] && window.__decks[0].file, null, { timeout: 8000 });
    await w.click('Marketing deck');
    await p.waitForFunction(() => window.__decks && window.__decks[1] && window.__decks[1].file, null, { timeout: 8000 });
    const [studio, marketing] = await decks();
    w.check(studio.file === 'war-table-Maison-Levain.pptx' || /^war-table-maison[-_ ]levain\.pptx$/i.test(studio.file), `deck file: ${studio.file}`);
    w.check(/-marketing\.pptx$/.test(marketing.file), `marketing deck file: ${marketing.file}`);
    for (const d of [studio, marketing]) {
      w.check(d.slides >= 8, `a deck holds ${d.slides} slides`);
      w.check(d.text.includes(DOSSIER.postureStatement) && d.text.includes('Walk kickoff subject'), 'a deck is missing the model\'s text');
      w.check(d.text.includes('Predictive Panel') && d.text.includes(await w.say('not open yet')), 'a deck names the Hold tool without saying it is not open yet');
      w.check(!/instagram|made up/i.test(d.text), 'a deck carries an operator-only handoff');
    }
    await absent('Could not generate the PPTX. Check the console.', { within: '.wt-toast' });
  });

  await w.step('signature', async () => {
    await expect('You are choosing this plan. Sign it.');
    await expect('Signing writes this dossier to a commitment log kept in this browser. The version you sign today is preserved, so you can tell yourself, honestly, six months from now, what you chose to believe on this day.');
    await w.click('Sign & commit');
    await toast('Type your name first.');
    w.check(await count('.d-signature .signed') === 0, 'the dossier was signed with no name');
    await type('.d-signature input', 'Lea Martin');
    await press(p.locator('.d-signature .btn-primary'));
    await toast('Commitment signed + recorded.');
    w.check(norm(await p.locator('.d-signature .signed .scrawl').innerText()) === 'Lea Martin', 'the signature is not on the page');
    const today = await p.evaluate(() => new Date().toISOString().split('T')[0]);
    await expect(`Signed ${today} · ${BRAND}`);
    const log = await p.evaluate(() => JSON.parse(localStorage.getItem('qb_war_table_commitments') || '[]'));
    w.check(log.length === 1 && log[0].signedName === 'Lea Martin' && log[0].nowCount === 2 && log[0].parkCount === 1 && log[0].dossier && log[0].dossier.postureStatement === DOSSIER.postureStatement,
      `commitment log: ${JSON.stringify(log.map(l => ({ signedName: l.signedName, nowCount: l.nowCount, parkCount: l.parkCount })))}`);
  });

  await w.step('print', async () => {
    await p.evaluate(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
    await w.click('Download as PDF');
    await w.click('⤓ Print record');
    w.check(await p.evaluate(() => window.__prints) === 2, 'the two print buttons did not each open the print dialog');
  });

  await w.step('send me my results', async () => {
    // The button mails the results to the address on the session.
    await p.evaluate(email => { const s = JSON.parse(localStorage.getItem('qb_session') || '{}'); s.email = email; localStorage.setItem('qb_session', JSON.stringify(s)); }, EMAIL);
    await p.locator('#qb-float-results').click();
    await need('Sent ✓', { within: '#qb-float-results', timeout: 5000 });
    w.check(sent.length === 1 && sent[0].toolId === 'war-table' && sent[0].email === EMAIL, `results request: ${JSON.stringify(sent.map(s => ({ toolId: s.toolId, email: s.email })))}`);
  });

  await w.step('back through the steps', async () => {
    await w.click('← Return');
    await need('Roadmap');
    await stepIs(8);
    // A finished step can be reopened from the dots, and keeps its answers.
    await p.locator('.wt-phase-dot').nth(1).click();
    await need('The Brief');
    w.check(await p.locator('#brief-brand-name').inputValue() === BRAND, 'the brief lost the brand name');
    w.check(await count('.wt-phase-dot.locked') === 0, 'a step is locked after the whole run');
  });
}
