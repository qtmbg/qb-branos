// Brand Soul Map: the whole tool, the way a founder goes through it.
//
// Six modules and six checkpoints answered by hand, the manifesto quote,
// the sign-off step, the synthesis (model mocked), the save step, the Codex
// and its exits (Markdown copy, print, the two decks), a reload, then every
// way the synthesis can fail, the raw session download, and the retry that
// brings the Codex back.
import fs from 'node:fs';

export const page = 'brand-soul-map.html';
export const title = '15 exercises, 6 checkpoints, synthesis, Codex, exports, every error kind';

const BRAND = 'Maison Levain';
const FOUNDER = { first: 'Ines', last: 'Okafor', email: 'ines@maison-levain.example' };

// What the model returns. Ten principles and three moves, as the prompt asks.
const CODEX = {
  verdict: 'Maison Levain is a bakery that behaves like a library. The pattern under every answer is patience used as authority.',
  essence: 'Bread for people who are done being hurried.',
  spark: 'Maison Levain exists for the neighbour who stopped buying bread by habit. It moves at the pace of a starter and it refuses the shortcut.',
  identityPortrait: { energy: 'A slow tide that still moves the whole shore.', aesthetic: 'A reading room that smells of flour.', archetype: 'The carer who also makes, held in check by the sage.' },
  purposeLegacy: { legacyRewritten: 'It proved that slow can be a business.', beliefRewritten: 'Time is an ingredient.', transformation: 'The customer goes from grabbing a loaf to choosing one.' },
  positioningSpine: { dnaReading: 'Care plus craft closes the door on scale for its own sake.', claimedTerritory: 'The slow loaf in a fast street.', refusedTerritory: 'The discount shelf.', defensibility: 'Nobody can copy a schedule this stubborn.' },
  communitySoul: {
    personPortrait: 'She reads the label before she reads the price.',
    essentialWords: [
      { word: 'PATIENT', cost: 'It costs the morning rush.' },
      { word: 'EXACTING', cost: 'It costs the easy yes.' },
    ],
    unsaidPromise: 'You will never be rushed here.',
  },
  voiceToneCode: {
    principles: ['Say the time it took.', 'Never apologise for the price.', 'One idea per sentence.', 'Name the grain.', 'No slogans.'],
    samples: [{ label: 'headline', text: 'Baked before you were awake.' }, { label: 'founder note', text: 'We closed on Monday to get Tuesday right.' }],
  },
  culturalPosition: { movementInheritance: 'It inherits the idea that craft is a form of dignity.', contemporaryStance: 'It says no to delivery apps.', refusal: 'It refuses bread as a commodity.', signature: 'This is not a bakery. It is a schedule kept.' },
  tensionsToManage: [{ tension: 'Slow against growth.', managementNote: 'Grow the queue, not the oven.' }],
  risksAndBlindSpots: [{ risk: 'Patience read as arrogance.', mitigation: 'Explain the wait at the counter.' }],
  operatingPrinciples: [
    'Open when the bread is ready, not before.', 'One new loaf a season.', 'Sell out rather than sell old.', 'Write the bake time on the bag.',
    'Train one apprentice at a time.', 'Refuse wholesale that needs par-baking.', 'Answer every complaint in person.', 'Keep one price for everyone.',
    'Close one day a week, always the same.', 'Publish the sourcing list.',
  ],
  nextThreeMoves: [
    { move: 'Give the loaf its senses.', rationale: 'The smell is doing work the copy is not.', tool: 'Sensescape' },
    { move: 'Rank the next sixty days.', rationale: 'Three initiatives compete for one oven.', tool: 'War Table' },
    { move: 'Write the counter voice.', rationale: 'The queue hears the brand before it reads it.', tool: 'Voice Guide' },
  ],
  closingDirective: 'Decide the closing day and print it on the door.',
};

export async function walk(w) {
  const p = w.page;
  const app = p.locator('#app');
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const dialogs = [];
  p.on('dialog', d => dialogs.push(d.message()));
  w.note(BRAND.toUpperCase());                      // the Codex paints the name in capitals

  // Text is looked up the way the dictionary is keyed, one text node at a
  // time. French punctuation carries no-break spaces, which XPath's
  // normalize-space() does not fold, so they are folded here on both sides.
  const flat = s => String(s).replace(/\s+/g, ' ').trim();
  const lit = t => (t.includes("'") ? `concat('${t.split("'").join(`', "'", '`)}')` : `'${t}'`);
  const find = async (english, opts = {}) => {
    const text = flat(opts.painted ? english : await w.say(english));
    const node = "normalize-space(translate(., '\u00a0', ' '))";
    const test = opts.exact === false ? `contains(${node}, ${lit(text)})` : `${node}=${lit(text)}`;
    return (opts.within ? p.locator(opts.within) : p).locator(`xpath=./descendant-or-self::*[text()[${test}]]`).filter({ visible: true }).first();
  };
  // A miss names the text, so a failure says what was not on screen.
  const see = async (english, opts = {}) => (await find(english, opts)).waitFor({ state: 'visible', timeout: opts.timeout ?? 5000 })
    .catch(() => { throw new Error(`not on screen${opts.within ? ' in ' + opts.within : ''}: ${JSON.stringify(english)}`); });
  const tap = async (english, opts = {}) => {
    await (await find(english, opts)).click({ timeout: opts.timeout ?? 5000 }).catch(() => { throw new Error(`could not click${opts.within ? ' in ' + opts.within : ''}: ${JSON.stringify(english)}`); });
    await p.waitForTimeout(opts.wait ?? 150);
  };

  // Fields are found the way a founder finds them: by placeholder or label,
  // in whichever language is on screen.
  const ph = async (english, n = 0) => app.getByPlaceholder(await w.say(english), { exact: true }).nth(n);
  const labelled = async english => app.locator('.form-field').filter({ has: p.getByText(flat(await w.say(english)), { exact: true }) }).locator('textarea, input').first();
  const type = async (locator, text) => w.fill(await locator, text);
  const next = async english => { await tap(english, { within: '#dock' }); };
  const stored = key => p.evaluate(k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, key);

  // The model. Counted, and its request kept, so the walk can say what was sent.
  const calls = [];
  const answerWith = (answer, wait = 0) => w.mockModel(async (body, route) => {
    calls.push({ body, lang: route.request().headers()['x-qb-lang'] });
    if (wait) await delay(wait);
    return answer;
  });
  const failWith = handler => w.mock('**/api/claude', async route => { calls.push({ failed: true }); await handler(route); });
  // The save step is a shared component (qb-gate.js). The walk goes through
  // it by its ids, so a change to its wording is not a failure here.
  const saveStep = p.locator('.qb-gate-overlay .qb-gate-card');
  const dismissSaveStep = async () => {
    await saveStep.waitFor({ state: 'visible', timeout: 8000 });
    await p.locator('#qb-gate-skip').click();
    await p.locator('.qb-gate-overlay').waitFor({ state: 'detached', timeout: 5000 });
  };

  await w.step('open: nothing can be skipped', async () => {
    await w.open();
    await see('Name what you are uncovering.');
    await see('Observe · Soul Map · The start');
    w.check(await p.locator('#stepNav .step-btn').count() === 15, 'the step list does not hold 15 steps');
    w.check(await p.locator('#stepNav .step-btn[disabled]').count() === 14, 'steps ahead are not locked at the start');
    w.check(await p.locator('#dockNext').isDisabled(), 'Next is enabled before a brand name is given');
    await see('Requirements not met');
  });

  await w.step('step 0: name the brand', async () => {
    await type(ph('e.g. Acme Corp'), BRAND);
    await w.gone('Requirements not met');
    await next('Next module →');
  });

  await w.step('module I: identity, exercises 1 to 4', async () => {
    await see('Module I · Identity');
    w.check(await app.locator('.panel-h').count() === 4, 'module I does not show 4 exercises');
    await type(ph('Describe the force…'), 'A slow tide');
    await type(ph('Describe the aesthetic and artifacts…'), 'A reading room with flour on the shelves');
    await type(ph('e.g. Prometheus bringing fire…'), 'Hestia keeping the hearth');
    await type(ph('Combine them into a cohesive identity…'), 'A hearth that keeps its own hours');
    await next('View diagnostic →');
  });

  await w.step('checkpoint I shows the answers back', async () => {
    await see('Checkpoint I');
    await see('Identity portrait');
    await see('A slow tide', { painted: true });
    await see('Hestia keeping the hearth', { painted: true });
    await next('Next module →');
  });

  await w.step('module II: purpose, the documentary and the manifesto quote', async () => {
    await see('Module II · Purpose');
    await type(ph('Title here…'), 'The long rise');
    await type(ph('Describe the opening shot…'), 'A hand lifting a cloth at four in the morning');
    await type(ph('…'), 'slow can pay the rent');
    await type(ph('Who they were before, what happened, who they became…'), 'A nurse, a courier and a retired teacher');
    await type(ph('Quote…'), 'We were never late. We were on time for bread.');
    await type(ph('A private note to yourself…'), 'I wrote more about time than about bread');
    w.check(await app.locator('.quote-card').count() === 5, 'there are not 5 manifesto quotes');
    w.check(await p.locator('#dockNext').isDisabled(), 'the step is valid before a manifesto line exists');
    // Choosing a quote has to repaint the step: the manifesto fields follow it.
    await tap('“To exist is to resist.”', { within: '.quote-grid' });
    await p.locator('.quote-card.selected').waitFor({ timeout: 4000 });
    w.check(await app.locator('.quote-card.selected').count() === 1, 'the chosen quote is not marked');
    await see('Write your own manifesto line');
    w.check(await (await ph('Title here…')).inputValue() === 'The long rise', 'the repaint lost what was already typed');
    await type(labelled('What is the specific belief encoded in this line?'), 'Staying is a decision');
    await type(ph('We believe that…'), 'We believe that time is an ingredient');
    await type(ph('We prove this by…'), 'We prove this by closing when the bread runs out');
    await type(ph('We reject the idea that…'), 'We reject the idea that fresh means fast');
    await next('View diagnostic →');
  });

  await w.step('checkpoint II', async () => {
    await see('Checkpoint II');
    await see('Purpose declaration');
    await see('exists to prove that');
    await see('slow can pay the rent', { painted: true });
    await see('“We believe that time is an ingredient”');
    await next('Next module →');
  });

  await w.step('module III: craft, three archetypes and the anti-brand', async () => {
    await see('Module III · Craft');
    w.check(await app.locator('.archetype-card').count() === 12, 'there are not 12 archetype cards');
    for (const name of ['The Caregiver', 'The Creator', 'The Sage']) await tap(name, { within: '.archetype-grid' });
    w.check(await app.locator('.archetype-card.role-primary').count() === 1, 'no primary archetype after the first tap');
    w.check(await app.locator('.archetype-card.role-secondary').count() === 1, 'no secondary archetype after the second tap');
    w.check(await app.locator('.archetype-card.role-tension').count() === 1, 'no tension archetype after the third tap');
    await see('Complete: Only we can be The Caregiver and The Creator at the same time because…');
    await type(labelled('The fusion'), 'we feed people and we make the thing ourselves');
    await type(ph('This archetype disciplines us by…'), 'This archetype disciplines us by asking for proof');
    await type(ph('NAME…'), 'Pain Rapide');
    await type(ph('Beliefs about people…'), 'people only want it now');
    await type(ph('Your beliefs about people…'), 'people can tell when time was spent');
    await type(ph('ADJ 1'), 'patient');
    await type(ph('ADJ 2'), 'exacting');
    await type(ph('ADJ 3'), 'warm');
    await next('View diagnostic →');
  });

  await w.step('checkpoint III', async () => {
    await see('Checkpoint III');
    await see('Positioning spine');
    await see(`${BRAND} operates with the core architecture of`);
    await see('. Pain Rapide believes');
    await see('patient, exacting, warm', { painted: true });
    await next('Next module →');
  });

  await w.step('module IV: tribe, words, one essential each, the fan letter', async () => {
    await see('Module IV · Tribe');
    w.check(await app.locator('.word-selector').count() === 5, 'there are not 5 word banks');
    const pick = async (bank, words, essential) => {
      const scope = `#app .word-selector >> nth=${bank}`;
      for (const word of words) await tap(word, { within: `${scope} >> .word-chips >> nth=0` });
      await tap(essential, { within: `${scope} >> .essential-row` });
    };
    await pick(0, ['Devoted', 'Rigorous', 'Warm'], 'Rigorous');
    await see('Why Rigorous?');
    await pick(1, ['Seeker', 'Devotee'], 'Devotee');
    await pick(2, ['Honest', 'Calm'], 'Calm');
    await pick(3, ['Handcrafted', 'Earthy'], 'Handcrafted');
    await pick(4, ['Dignity', 'Belonging'], 'Belonging');
    // A sixth word is refused: five at most per bank.
    const first = `#app .word-selector >> nth=0 >> .word-chips >> nth=0`;
    for (const word of ['Sacred', 'Radical', 'Elegant']) await tap(word, { within: first });
    w.check(await p.locator(first).locator('.word-chip.selected, .word-chip.essential').count() === 5, 'a bank accepted more than 5 words');
    await type(ph('Dear team, ten years ago…'), 'Dear team, ten years ago I bought a loaf and kept the bag.');
    await type(labelled('What detail surprised you?'), 'She kept the paper bag');
    await type(labelled('One sentence describing their inner life:'), 'She wants one thing in her day that was not rushed');
    await type(labelled('What does this person need?'), 'Permission to wait');
    await next('View diagnostic →');
  });

  await w.step('checkpoint IV: the five essential words', async () => {
    await see('Checkpoint IV');
    await see('Community soul');
    await see('Rigorous · Devotee · Calm · Handcrafted · Belonging');
    await see('She wants one thing in her day that was not rushed', { painted: true });
    await next('Next module →');
  });

  await w.step('module V: signal, brands, five figures, five songs', async () => {
    await see('Module V · Signal');
    await type(ph('Brand A…'), 'Aesop');
    await type(ph('Brand C…'), 'Subway');
    w.check(await app.locator('.binary-card').count() === 5, 'there are not 5 figure pairs');
    for (const [card, name] of [[0, 'Gandhi'], [1, 'Anna Wintour'], [2, 'Steve Jobs'], [3, 'Frida Kahlo'], [4, 'Michael Jordan']]) {
      await tap(name, { within: `#app .binary-card >> nth=${card}` });
    }
    w.check(await app.locator('.binary-opt.selected').count() === 5, 'not every figure pair has a choice');
    w.check(await app.locator('.song-row').count() === 5, 'there are not 5 song rows');
    await type(ph('SONG NAME…'), 'Clair de lune');
    await type(ph('ARTIST…'), 'Debussy');
    await next('View diagnostic →');
  });

  await w.step('checkpoint V', async () => {
    await see('Checkpoint V');
    await see('Voice & tone');
    await see(`${BRAND} leads like`);
    await see('Gandhi', { within: '.checkpoint' });
    await see('Michael Jordan', { within: '.checkpoint' });
    await next('Next module →');
  });

  await w.step('module VI: world, always and never, the movement', async () => {
    await see('Module VI · World');
    await type(app.locator('.always-block input.glass-input').first(), 'bake before dawn');
    await type(app.locator('.never-block input.glass-input').first(), 'sell day-old bread as fresh');
    await app.locator('.always-block input[type="radio"]').first().check({ force: true });
    await app.locator('.never-block input[type="radio"]').first().check({ force: true });
    w.check(await p.locator('#dockNext').isDisabled(), 'the step is valid before a movement is chosen');
    w.check(await app.locator('.movement-card').count() === 9, 'there are not 9 movements');
    await tap('The Harlem Renaissance', { within: '.movement-grid' });
    await see('Your lineage · The Harlem Renaissance');
    await type(ph('We refuse…'), 'We refuse bread as a commodity');
    await next('View diagnostic →');
  });

  await w.step('checkpoint VI', async () => {
    await see('Checkpoint VI');
    await see('Cultural position');
    await see('bake before dawn', { painted: true });
    await see(`${BRAND} is the contemporary heir to`);
    await see('The Harlem Renaissance', { within: '.checkpoint' });
    await next('Next module →');
  });

  await w.step('step 13: who it is for', async () => {
    await see('Authorization required');
    await see('Say who this Brand Soul Map is for. The synthesis comes next.');
    w.check(await p.locator('#dockNext').isDisabled(), 'the synthesis can start without a name and an email');
    await type(ph('you@example.com'), FOUNDER.email);
    await type(ph('First name'), FOUNDER.first);
    await type(ph('Last name'), FOUNDER.last);
    w.check(!(await p.locator('#dockNext').isDisabled()), 'a name and an email do not open the synthesis');
  });

  await w.step('synthesis: the wait, then the save step', async () => {
    await answerWith(CODEX, 1500);
    await next('Initiate synthesis →');
    await see('Distilling your identity.');
    await see('· Synthesis engine');
    await see('Reading the fifteen exercises back-to-back');
    await see('Keep this tab open · Do not reload');
    await saveStep.waitFor({ state: 'visible', timeout: 8000 });
  });

  await w.step('the save step already holds the name and email from step 13', async () => {
    w.check(await p.locator('#qb-gate-fname').inputValue() === FOUNDER.first, 'the save step asks for the first name again');
    w.check(await p.locator('#qb-gate-email').inputValue() === FOUNDER.email, 'the save step asks for the email again');
    await dismissSaveStep();
  });

  await w.step('the model was asked once, with the session, in this language', async () => {
    const sent = calls.filter(c => c.body);
    w.check(sent.length === 1, `the model was called ${sent.length} times for one synthesis`);
    const body = sent[0] ? sent[0].body : {};
    const payload = body.messages && body.messages[0] ? String(body.messages[0].content) : '';
    w.check(/SYNTHESIS ENGINE/.test(String(body.system || '')), 'the system prompt did not go out');
    w.check(payload.includes('Brand name: ' + BRAND), 'the brand name is not in the payload');
    w.check(payload.includes('Founder: ' + FOUNDER.first + ' ' + FOUNDER.last), 'the founder name is not in the payload');
    w.check(payload.includes('Primary archetype: The Caregiver'), 'the primary archetype is not in the payload');
    w.check(payload.includes('Essential: Rigorous'), 'the essential word went out translated or not at all');
    w.check(payload.includes('Cultural movement chosen: The Harlem Renaissance'), 'the movement went out translated or not at all');
    w.check(sent[0] && sent[0].lang === w.lang, `X-QB-Lang was ${sent[0] && sent[0].lang}, expected ${w.lang}`);
  });

  await w.step('what the synthesis saved', async () => {
    const qbp = await stored('qb_qbp') || {};
    w.check(qbp.brandName === BRAND && qbp.brandEssence === CODEX.essence, 'the Brand Profile did not take the name and the essence');
    w.check(qbp.archetype === 'The Caregiver + The Creator', `the archetype was stored as ${JSON.stringify(qbp.archetype)}`);
    w.check(qbp.soulMapComplete === true, 'soulMapComplete is not set');
    w.check(Array.isArray(qbp.operatingPrinciples) && qbp.operatingPrinciples.length === 10, 'the ten operating principles were not stored');
    const pdf = await stored('qb_soul_map_data') || {};
    w.check(pdf.fanSurprise === 'She kept the paper bag' && pdf.movementName === 'The Harlem Renaissance' && pdf.leadChoice === 'Gandhi' && pdf.innChoice === 'Steve Jobs',
      'the PDF view was not handed its five answers: ' + JSON.stringify(pdf));
    w.check(((await stored('qb_completions')) || {})['soul-map'], 'the completion was not recorded');
  });

  await w.step('the Codex is on screen, with what the model wrote', async () => {
    await see('Brand Soul Map · Codex');
    await see(BRAND.toUpperCase(), { painted: true });
    for (const text of [CODEX.verdict, CODEX.essence, CODEX.spark, CODEX.communitySoul.unsaidPromise, CODEX.culturalPosition.signature, CODEX.closingDirective]) {
      await see(text, { painted: true });
    }
    for (const heading of ['The Essence', 'The Spark', '01 · Identity portrait', '02 · Purpose & legacy', '03 · Positioning spine', '04 · Community soul',
      '05 · Voice & tone code', '06 · Cultural position', '07 · Tensions to manage', '08 · Risks & blind spots', '09 · Operating principles',
      '10 · Next three moves', 'Closing directive', 'Ten rules. Each testable. Each defensible.']) {
      await see(heading);
    }
    w.check(await p.locator('#cx-principles li').count() === 10, 'the Codex does not list the ten rules its heading announces');
    w.check(await p.locator('.cx-move').count() === 3, 'the Codex does not show three next moves');
    w.check(await p.locator('.cx-word-row').count() === 2, 'the essential words were not laid out one per row');
    await see('Open Sensescape →');
    w.check(await p.locator('.move-cta').first().getAttribute('href') === 'sensescape.html', 'the first move does not link to its tool');
    // The product name keeps its casing inside an upper-case line.
    w.check(await p.evaluate(() => [...document.querySelectorAll('.cx-footer, .cx-brandline')].every(el => !/BRANDOS/.test(el.innerText))), 'the product name was recased in the Codex');
  });

  await w.step('a free account is told which moves need Starter', async () => {
    w.check(await p.locator('.move-starter').count() === 0, 'a paying account is shown a Starter note');
    await p.evaluate(() => { localStorage.setItem('qb_user_tier', 'free'); localStorage.setItem('qb_sub_status', 'inactive'); document.querySelectorAll('#stepNav .step-btn')[14].click(); });
    await see('War Table opens with Starter.');
    await see('Voice Guide opens with Starter.');
    w.check(await p.locator('.move-starter').count() === 2, 'Sensescape, which is free, carries a Starter note');
    await p.evaluate(() => { localStorage.setItem('qb_user_tier', 'agency'); localStorage.setItem('qb_sub_status', 'active'); document.querySelectorAll('#stepNav .step-btn')[14].click(); });
    await p.locator('.move-starter').first().waitFor({ state: 'detached', timeout: 4000 });
  });

  await w.step('copy as Markdown', async () => {
    dialogs.length = 0;
    await tap('Copy as Markdown');
    await p.waitForTimeout(400);
    w.check(dialogs.includes(await w.say('Copied Codex as Markdown.')), `the copy was not confirmed: ${JSON.stringify(dialogs)}`);
    const md = await p.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    w.check(md !== null, 'the clipboard could not be read back');
    if (md !== null) {
      const has = line => md.split('\n').includes(line);
      w.check(has(`# ${BRAND} - Brand Soul Map Codex`), 'the Markdown has no title line');
      for (const [mark, english] of [['## ', 'Verdict'], ['## ', 'Spark'], ['## ', '01 · Identity portrait'], ['### ', 'Energy'], ['### ', 'Legacy claim'],
        ['## ', '05 · Voice & tone code'], ['### ', 'Principles'], ['### ', 'Samples'], ['## ', '09 · Operating principles'], ['## ', '10 · Next three moves'], ['## ', 'Closing directive']]) {
        const line = mark + await w.say(english);
        w.check(has(line), `the Markdown lacks the line ${JSON.stringify(line)}`);
      }
      w.check(has(CODEX.verdict) && has('> ' + CODEX.essence), 'the model text was altered on its way to the clipboard');
      w.check(has('10. ' + CODEX.operatingPrinciples[9]), 'the tenth rule is missing from the Markdown');
    }
  });

  await w.step('print, and the two decks', async () => {
    await p.evaluate(() => {
      window.__printed = 0; window.print = () => { window.__printed++; };
      window.__decks = []; window.QB_exportPPTX = (tool, data, opts) => { window.__decks.push({ tool, mode: opts.mode, filename: opts.filename, verdict: data.verdict }); return Promise.resolve(); };
    });
    await tap('Download as PDF');
    w.check(await p.evaluate(() => window.__printed) === 1, 'Download as PDF did not open the print dialog');
    await tap('Download PPTX');
    await tap('Marketing deck');
    const decks = await p.evaluate(() => window.__decks);
    w.check(decks.length === 2 && decks[0].tool === 'brand-soul-map' && decks[0].mode === 'studio' && decks[1].mode === 'editorial', `the decks were asked for as ${JSON.stringify(decks)}`);
    w.check(decks[0] && decks[0].filename === 'brand-soul-map-' + BRAND && decks[1] && decks[1].filename === 'brand-soul-map-' + BRAND + '-marketing', 'the deck filenames are not the brand name');
    w.check(decks[0] && decks[0].verdict === CODEX.verdict, 'the deck was not handed the Codex');
    // The exporter not loaded yet, then failing.
    dialogs.length = 0;
    await p.evaluate(() => { window.QB_exportPPTX = undefined; });
    await tap('Download PPTX');
    w.check(dialogs.includes(await w.say('PPTX export still loading - try again in a second.')), 'no message when the deck exporter is not loaded');
    await p.evaluate(() => { window.QB_exportPPTX = () => Promise.reject(new Error('walk')); });
    await tap('Marketing deck');
    await p.waitForTimeout(300);
    w.check(dialogs.includes(await w.say('Could not generate the PPTX. Check the console for details.')), 'no message when the deck fails');
  });

  await w.step('reload: the session and the Codex are still there', async () => {
    await p.waitForTimeout(1200);                     // the save is debounced
    const before = calls.length;
    await w.open();
    await see(CODEX.verdict, { painted: true });
    w.check(flat(await p.locator('#saveIndicator').textContent()) === flat(await w.say('✓ Saved locally')), 'the save indicator does not say the session is saved');
    w.check(calls.length === before, 'reopening the tool called the model again');
  });

  // ── Every way the synthesis can fail ──
  const json = (status, body) => route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const asText = text => json(200, { content: [{ type: 'text', text }] });
  const failures = [
    ['the key is not configured (503)', json(503, {}), 'Synthesis unavailable', 'Full synthesis requires the QB API key.', 'The AI service is not configured. Full synthesis requires the QB API key.'],
    ['the endpoint is missing (404)', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }), 'Synthesis unavailable', 'Full synthesis requires the QB API key.',
      'The /api/claude endpoint is not running here. Deploy to Vercel (or run `vercel dev`) to generate the Codex.'],
    ['an answer that is not JSON (502)', route => route.fulfill({ status: 502, contentType: 'text/html', body: '<html></html>' }), 'Synthesis pending', 'Synthesis is being finalised.', 'Non-JSON response from /api/claude (status 502).'],
    ['an upstream error with no message (500)', json(500, {}), 'Synthesis pending', 'Synthesis is being finalised.', 'Unexpected response from the AI service.'],
    ['an upstream error with a message', json(500, { error: { message: 'Upstream error' } }), 'Synthesis pending', 'Synthesis is being finalised.', 'Upstream error'],
    ['prose instead of JSON', asText('I could not do that.'), 'Synthesis pending', 'Synthesis is being finalised.', 'AI response was not valid JSON.'],
    ['broken JSON', asText('{ "verdict": '), 'Synthesis pending', 'Synthesis is being finalised.', 'AI response was not valid JSON.'],
    ['JSON that does not parse', asText('{ not json }'), 'Synthesis pending', 'Synthesis is being finalised.', 'Could not parse the AI response as JSON.'],
    ['the network drops', route => route.abort('failed'), 'Synthesis pending', 'Synthesis is being finalised.', 'Failed to fetch'],
  ];
  for (let i = 0; i < failures.length; i++) {
    const [name, handler, badge, headline, detail] = failures[i];
    await w.step(`synthesis fails: ${name}`, async () => {
      await failWith(handler);
      const before = calls.length;
      await tap(i === 0 ? 'Regenerate' : 'Retry synthesis');
      await see(detail, { within: '.cx-pending' });
      await see(badge, { within: '.cx-pending' });
      await see(headline);
      w.check(calls.length === before + 1, 'the retry did not call the model exactly once');
      if (i > 0) await see(`Retry attempt ${i}`);
      w.check(await p.locator('.qb-gate-overlay').count() === 0, 'the save step opened on a failed synthesis');
      w.check(await p.locator('.codex-shell').count() === 0, 'a Codex is shown although the synthesis failed');
      await see('Export my raw session');
    });
  }

  await w.step('the raw session downloads as JSON, untouched', async () => {
    const [download] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), w.click('Export my raw session')]);
    w.check(download.suggestedFilename() === BRAND + '_soulmap_session.json', `the file is named ${download.suggestedFilename()}`);
    const file = await download.path();
    const session = JSON.parse(fs.readFileSync(file, 'utf8'));
    w.check(session.brandName === BRAND && session.data && session.data.mod1Force === 'A slow tide', 'the download does not hold the session');
    w.check(session.data.cEss === 'Rigorous' && session.data.movementId === 'harlem' && session.data.leadChoice === 'Gandhi', 'stored choices were translated in the download');
    w.check(session.data.always[0] === 'bake before dawn' && session.data.email === FOUNDER.email, 'typed answers are missing from the download');
  });

  await w.step('retry brings the Codex back', async () => {
    await answerWith(CODEX);
    await tap('Retry synthesis');
    await dismissSaveStep();
    await see(CODEX.verdict, { painted: true });
    await w.gone('Retry synthesis');
    w.check(await p.locator('#cx-principles li').count() === 10, 'the Codex came back incomplete after the retry');
  });
}
