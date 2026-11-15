// The Profiles: seven chapters from three empty seats to three approved
// briefs, then every way the work leaves the page.
//
// Everything is typed or clicked the way a founder would. The model is
// answered by the walk. The founder is never asked for a key: the page
// calls /api/claude like every other tool, and the server decides who
// answers (api/_lib/tool-provider.js).
import fs from 'node:fs';

export const page = 'the-profiles.html';
export const title = 'seven chapters, model calls, approval loop, four exports';

// Typed text avoids the tool's own vocabulary on purpose, so a label left
// in English can never hide behind something the founder wrote.
const PEOPLE = [
  { name: 'Paul',  role: 'Head of estates at a teaching hospital',  opening: 'Half the budget is signed and the deadline did not move.' },
  { name: 'Inès',  role: 'Operations lead for a regional clinic group', opening: 'Four sites, one inspector, and a board that wants dates.' },
  { name: 'Tomas', role: 'Finance partner on the capital programme', opening: 'Every overrun lands on a spreadsheet with his initials.' },
];
const bio = person => ({
  formalRole: `${person.name} leads capital works for the trust.`,
  undertaking: `${person.name} is moving two wards while both stay open to patients.`,
  teamSays: `${person.name} reads every drawing twice.`,
  prideAndPressure: `${person.name} opened the last wing early and is now held to that date.`,
  mindset: `${person.name} trusts a walked site over a slide.`,
  hookInstinct: `${person.name} keeps wards open while rebuilding them around the beds.`,
  hookCut: `${person.name} keeps wards open, rebuilds around beds.`,
  hookFinal: `${person.name} rebuilds wards without closing a single bed.`,
});
const strain = (person, n) => `${person.name} · strain ${n} · three sites wait on one signature`;
const moment = (person, s, c) => `${person.name} · moment ${s}.${c} · the lift contractor calls again`;
const sixteen = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen';
const fifteen = sixteen.replace(/ sixteen$/, '');

// What the model returns, by call.
const pattern = (who, n) => `${who} checks the ward plan before breakfast, note ${n}.`;
const XRAY = Object.fromEntries(['p1', 'p2', 'p3'].map((k, i) => [k, {
  microControl: pattern(PEOPLE[i].name, 1), rationalizations: pattern(PEOPLE[i].name, 2), hiddenDrivers: pattern(PEOPLE[i].name, 3),
  defenseMech: pattern(PEOPLE[i].name, 4), emotionalContradiction: pattern(PEOPLE[i].name, 5), aspirationalUndercurrent: pattern(PEOPLE[i].name, 6),
}]));
const COMMON = {
  themes: ['All three carry a date someone else announced.', 'All three answer to an inspector they never chose.', 'All three keep a private list of what could slip.', 'All three would trade budget for certainty.'],
  bindingInsight: 'They buy whoever makes the date safe to say out loud.',
};
const moves = (who, tag) => [1, 2, 3, 4, 5].map(n => `${tag} ${n} for ${who}: walk the ward with the nurse in charge.`);
const SYNTHESIS = {
  profiles: PEOPLE.map(person => ({ marketingApproach: moves(person.name, 'Move'), keyTakeaways: moves(person.name, 'Lesson') })),
  sharedKeyTakeaways: [1, 2, 3, 4, 5].map(n => `Shared lesson ${n}: certainty sells before speed.`),
};
const REFINED = { marketingApproach: moves('Paul', 'Sharper move'), keyTakeaways: moves('Paul', 'Sharper lesson') };

export async function walk(w) {
  const p = w.page;
  const fr = w.lang === 'fr';
  // French sets a no-break space before : ? and ; so painted text is compared
  // with every run of white space, no-break included, folded to one space.
  const flat = s => String(s).replace(/\s+/g, ' ').trim();
  const painted = async english => flat(await w.say(english));
  const sees = async (english, where = '#app', opts = {}) => {
    const want = opts.painted ? flat(english) : await painted(english);
    await p.waitForFunction(([sel, text]) => {
      const el = document.querySelector(sel);
      return !!el && el.innerText.replace(/\s+/g, ' ').toLowerCase().includes(text.toLowerCase());
    }, [where, want], { timeout: opts.timeout ?? 8000 });
  };
  const button = async (english, where = '#app') => p.locator(where).getByRole('button', { name: await painted(english), exact: true }).first();
  const press = async (english, where) => { await (await button(english, where)).click(); await p.waitForTimeout(250); };
  // A loader is on screen only while the model answers, so the walk starts
  // watching for it before it presses the button.
  const pressAndSee = async (english, loader) => {
    const watching = w.see(loader);
    await press(english);
    await watching;
  };
  const field = n => p.locator('#app input, #app textarea').nth(n);
  const state = () => p.evaluate(() => ({ step: state.step, seats: state.seats, approved: state.approved, rounds: state.refineRound }));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const asked = [];
  let failing = false, delay = 0;
  await w.mockModel(async (body, route) => {
    const prompt = JSON.stringify(body.messages || []);
    const sent = route.request().headers();
    asked.push({ prompt, system: String(body.system || ''), model: body.model, url: route.request().url(), key: sent['x-api-key'], lang: sent['x-qb-lang'] });
    if (delay) await sleep(delay);
    if (/surface six psychological patterns/.test(prompt)) return XRAY;
    if (/What runs through all three/.test(prompt)) return COMMON;
    if (/Refine the marketing approach/.test(prompt)) return REFINED;
    return SYNTHESIS;
  });
  // Registered after the model mock, so it is asked first; it steps aside
  // unless the walk wants the provider to refuse, in the words the route uses.
  const BUSY = 'The AI service is busy right now. Try again in a minute.';
  await w.mock('**/api/claude', async route => {
    if (failing && route.request().method() === 'POST') return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: BUSY } }) });
    return route.fallback();
  });
  // The page must never go to a provider on its own.
  const direct = [];
  p.on('request', r => { if (/api\.anthropic\.com|generativelanguage\.googleapis\.com/.test(r.url())) direct.push(r.url()); });

  await w.step('intro says what the tool is, and how long it is', async () => {
    await w.open();
    await w.see('Observe · The Profiles');
    await w.see('Three buyers.');
    await w.see('Three lives.');
    await w.see('Built in coherence with Brand Soul Map. Writes to your QBP when complete.');
    const intro = await p.locator('#app').innerText();
    w.check(!/Phase\s*0?1|PHASE [IVX]/.test(intro), 'the intro still uses the retired phase vocabulary');
    w.check(!/Reads from your QBP|Lit votre QBP/.test(intro), 'the intro still says the tool reads the Brand Profile, which it does not');
    const cards = await p.locator('#app .intro-card').evaluateAll(els => els.map(e => ({ num: e.querySelector('.intro-card-num').textContent, minutes: parseInt(e.querySelector('.intro-card-time').textContent, 10) })));
    const chapters = await p.evaluate(() => PHASES.length);
    w.check(cards.length === 7 && chapters === 7, `${cards.length} chapter cards for ${chapters} chapters in the code`);
    w.check(cards.every((c, i) => c.num === `${fr ? 'CHAPITRE' : 'CHAPTER'} ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][i]}`), `chapter cards read ${cards.map(c => c.num).join(', ')}`);
    const total = cards.reduce((n, c) => n + c.minutes, 0);
    w.check(total >= 55 && total <= 70, `the chapters add up to ${total} minutes, the page says about an hour`);
    w.check(!/60 minutes/.test(intro), `the start button still says 60 minutes while the chapters add up to ${total}`);
    const head = await p.evaluate(() => ({
      description: document.querySelector('meta[name="description"]').content,
      og: document.querySelector('meta[property="og:description"]').content,
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent).description).join(' '),
    }));
    w.check(!/Phase 01|NORTH STAR|archetypes/i.test(head.description + head.og + head.ld), `the head still describes another tool: ${head.og} · ${head.ld}`);
    w.check(head.og === await w.say('Three full buyer personas, built across biography, pain, journey, and psychology.'), `og:description reads ${head.og}`);
  });

  await w.step('chapter I: a name can be typed, key by key', async () => {
    await press('Begin · about an hour');
    await w.see('Chapter I · The Three Seats');
    await w.see('Chapter I · Three Seats');
    await sees('Who is in the room?');
    w.check(await (await button('Continue')).isDisabled(), 'the seats can be left empty');
    w.note(PEOPLE[0].name);
    await field(0).click();
    await p.keyboard.type(PEOPLE[0].name, { delay: 25 });
    w.check(await field(0).inputValue() === PEOPLE[0].name, `typing "${PEOPLE[0].name}" left ${JSON.stringify(await field(0).inputValue())} in the field`);
    w.check(await p.evaluate(() => document.activeElement === document.querySelectorAll('#app input, #app textarea')[0]), 'the field lost focus while typing');
    // The same on a long screen: the page must not jump to the top.
    await field(8).scrollIntoViewIfNeeded();
    await field(8).click();
    const before = await p.evaluate(() => window.scrollY);
    w.note('abc');
    await p.keyboard.type('abc', { delay: 25 });
    await p.waitForTimeout(100);
    const after = await p.evaluate(() => window.scrollY);
    w.check(await field(8).inputValue() === 'abc' && Math.abs(after - before) < 40, `typing lower on the page moved it from ${before} to ${after} and left ${JSON.stringify(await field(8).inputValue())}`);
  });

  await w.step('progress is kept across a reload', async () => {
    await p.locator('#app button.icon-btn').click();
    await sees('Progress saved. You can return any time.', '#qb-flash');
    await w.open();
    await w.see('Chapter I · The Three Seats');
    w.check(await field(0).inputValue() === PEOPLE[0].name, 'the name typed before the reload is gone');
    await press('Back');
    await w.see('Three buyers.');
    w.check(await p.locator('#app .notice').count() === 0, 'the intro shows a notice');
    await w.see('Reset');
    await press('Begin · about an hour');
    await w.see('Chapter I · The Three Seats');
  });

  await w.step('chapter I: three seats', async () => {
    for (let i = 0; i < 3; i++) {
      await w.fill(field(i * 3), PEOPLE[i].name);
      await w.fill(field(i * 3 + 1), PEOPLE[i].role);
      await w.fill(field(i * 3 + 2), PEOPLE[i].opening);
    }
    for (const n of [1, 2, 3]) await w.see(`Seat ${n}`);
    w.check(await (await button('Continue')).isEnabled(), 'three full seats do not open the next chapter');
    await press('Continue');
  });

  for (let i = 0; i < 3; i++) {
    const person = PEOPLE[i], b = bio(person);
    await w.step(`chapter II: ${person.name}, biography and three-pass hook`, async () => {
      await w.see('Chapter II · Biographies and Hooks');
      await w.see('// Chapter II · Biography and Hook');
      await w.see(`Build ${person.name}'s profile.`);
      await w.see(`${i + 1} of 3`);
      const next = await button(i < 2 ? 'Next persona' : 'Continue to Pain Map');
      await w.fill(field(0), b.formalRole);
      await w.fill(field(1), b.undertaking);
      await w.fill(field(2), b.teamSays);
      await w.fill(field(3), b.prideAndPressure);
      await w.fill(field(4), b.mindset);
      if (i === 0) {
        // The passes open in order.
        w.check(await field(6).getAttribute('placeholder') === await w.say('Complete pass 1 first'), 'pass 2 is open before pass 1 is written');
        w.check(await field(7).getAttribute('placeholder') === await w.say('Complete pass 2 first'), 'pass 3 is open before pass 2 is written');
      }
      await w.fill(field(5), b.hookInstinct);
      if (i === 0) w.check(await field(6).getAttribute('placeholder') === await w.say('Rewrite pass 1 with no adjectives'), 'pass 2 did not open after pass 1');
      await w.fill(field(6), b.hookCut);
      if (i === 0) {
        // The rule the page states is the rule the code keeps: fifteen words pass, sixteen do not.
        await w.see('Pass 3 · Active, 15 words at most');
        await w.fill(field(7), sixteen);
        await w.see('16 words. Cut to 15 or fewer.');
        w.check(await next.isDisabled(), 'a sixteen-word hook is accepted');
        await w.fill(field(7), fifteen);
        await w.see('✓ 15 words');
        w.check(await next.isEnabled(), 'a fifteen-word hook is refused');
      }
      await w.fill(field(7), b.hookFinal);
      await w.see(`✓ ${b.hookFinal.split(/\s+/).length} words`);
      await next.click();
      await p.waitForTimeout(250);
    });
  }

  await w.step('chapter III: pain map, five rows by three buyers', async () => {
    await w.see('Chapter III · The Pain Map');
    await w.see('Chapter III · Pain Map');
    const rows = await p.locator('#app .pain-row').count();
    const cells = await p.locator('#app .pain-row textarea').count();
    w.check(rows === 5 && cells === 15, `${rows} pain rows and ${cells} cells, the page says five pains for three buyers`);
    for (const label of ['Time and capacity', 'Compliance and reputation', 'Stakeholder orchestration', 'Vendor and dependency', 'The existential pain underneath']) await w.see(label);
    w.check(await (await button('Continue to Journey Map')).isDisabled(), 'the pain map can be left empty');
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) await w.fill(p.locator('#app .pain-row textarea').nth(r * 3 + c), strain(PEOPLE[c], r + 1));
    await press('Continue to Journey Map');
  });

  const STAGES = ['Awareness', 'Realization of need', 'Shopping and comparing', 'Engage and delight', 'Share and return'];
  await w.step('chapter IV: journey map, five stages, four fields per buyer', async () => {
    for (let s = 0; s < 5; s++) {
      await w.see(`// Chapter IV · Journey Map · Stage ${s + 1} of 5`);
      await w.see(`STAGE 0${s + 1}`);
      await w.see(STAGES[s], { role: 'heading' });
      await w.see('Fill 4 fields per persona');
      const boxes = p.locator('#app .journey-persona-col textarea');
      w.check(await boxes.count() === 12, `stage ${s + 1} shows ${await boxes.count()} fields, the page says four per persona`);
      const next = await button(s < 4 ? 'Next stage' : 'Continue to Psychology');
      w.check(await next.isDisabled(), `stage ${s + 1} can be left empty`);
      for (let c = 0; c < 3; c++) for (let f = 0; f < 4; f++) await w.fill(boxes.nth(c * 4 + f), moment(PEOPLE[c], s + 1, f + 1));
      await next.click();
      await p.waitForTimeout(250);
    }
  });

  await w.step('chapter V: no key is asked for, then a failed call said plainly', async () => {
    await w.see('Chapter V · The Psychological X-Ray');
    await w.see('Now the layer underneath.');
    // This screen used to stop the founder and ask for an Anthropic key.
    w.check(await p.locator('#app input[type="password"]').count() === 0, 'the founder is asked for a key');
    const screen = await p.locator('#app').innerText();
    const named = /Anthropic|Claude|API key|clé API|sk-ant/i.exec(screen);
    w.check(!named, `the screen names a provider or a key: ${JSON.stringify(named && named[0])}`);
    w.check(await p.evaluate(() => localStorage.getItem('qb_anthropic_key')) === null, 'a provider key is kept in this browser');
    failing = true;
    await press('Generate');
    // Named here, before the wait below can time out on it.
    await p.waitForTimeout(500);
    w.check(direct.length === 0, `the page called a provider itself: ${direct[0]}`);
    await sees('X-Ray generation failed: ' + BUSY);
    failing = false;
  });

  await w.step('chapter V: x-ray generated, read per buyer, sharpened', async () => {
    delay = 1200;
    asked.length = 0;
    await pressAndSee('Generate', '// Generating psychological X-Ray');
    await w.see('Sharpen the language.', { timeout: 10000 });
    delay = 0;
    const boxes = p.locator('#app .field-block textarea');
    w.check(await boxes.count() === 6, `${await boxes.count()} patterns shown, the page says six per persona`);
    w.check(await boxes.nth(0).inputValue() === XRAY.p1.microControl, 'the first pattern is not what the model wrote');
    for (const label of ['Micro-behaviors of control', 'Rationalizations', 'Hidden drivers', 'Defense mechanisms', 'Emotional contradiction', 'Aspirational undercurrent']) await w.see(label);
    await p.locator('#app .tabs .tab').nth(1).click();
    w.check(await boxes.nth(0).inputValue() === XRAY.p2.microControl, 'the second tab does not show the second buyer');
    await p.locator('#app .tabs .tab').nth(0).click();
    await w.fill(boxes.nth(5), 'Paul wants the ward to carry no plaque at all.');
    await p.locator('#app .tabs .tab').nth(2).click();
    await p.locator('#app .tabs .tab').nth(0).click();
    w.check(await boxes.nth(5).inputValue() === 'Paul wants the ward to carry no plaque at all.', 'an edited pattern did not survive a tab change');
  });

  await w.step('the model was asked through the shared route, in English, and the reader\'s language was said', async () => {
    w.check(asked.length === 1, `${asked.length} model call(s) for one generation`);
    const call = asked[0] || { prompt: '', system: '' };
    w.check(/\/api\/claude$/.test(call.url || '') && !call.key, `the call went to ${call.url}${call.key ? ' with a key in the browser' : ''}`);
    w.check(direct.length === 0, `the page called a provider itself: ${direct[0]}`);
    w.check(call.prompt.includes('PERSONA 1 (Paul)') && call.prompt.includes('Time and capacity: ' + strain(PEOPLE[0], 1)) && call.prompt.includes('Awareness:'), 'the prompt does not carry the work in its English labels');
    w.check(/senior brand strategist/.test(call.system), 'the system prompt did not reach the model');
    // The server appends the language directive once, from this header.
    w.check((call.lang === 'fr') === fr, fr ? 'the call does not tell the server the reader is French (X-QB-Lang)' : `the English call is marked ${call.lang}`);
    w.check(!/LANGUAGE OF THE OUTPUT/.test(call.system), 'the browser added a language directive of its own; the server would add a second');
  });

  await w.step('chapter VI: common thread, themes added and removed', async () => {
    await press('Continue to Common Thread');
    await w.see('Chapter VI · The Common Thread');
    await sees('What runs through all three?');
    delay = 1200;
    await pressAndSee('Generate', '// Finding the common thread');
    await w.see('Sharpen the constants.', { timeout: 10000 });
    delay = 0;
    const themes = p.locator('#app textarea.theme-input');
    w.check(await themes.count() === 4 && await themes.nth(0).inputValue() === COMMON.themes[0], 'the themes are not the four the model wrote');
    await press('Add theme');
    w.check(await themes.count() === 5, 'a fifth theme could not be added');
    w.check(await p.locator('#app').getByRole('button', { name: await painted('Add theme'), exact: true }).count() === 0, 'a sixth theme is on offer, the page says three to five');
    await p.locator('#app .theme-remove').last().click();
    w.check(await themes.count() === 4, 'a theme could not be removed');
    w.check(await p.locator('#app .field-block').last().locator('textarea').inputValue() === COMMON.bindingInsight, 'the binding insight is not what the model wrote');
    await press('Build the deliverable');
  });

  await w.step('chapter VII: synthesis, three briefs revealed', async () => {
    await w.see('Chapter VII · Synthesis');
    await w.see('Final assembly.');
    delay = 1200;
    await pressAndSee('Build deliverable', '// Assembling the deliverable');
    await w.see('Your three buyers.', { timeout: 10000 });
    delay = 0;
    w.check(await p.locator('#app .reveal-card').count() === 4, 'the reveal does not show three briefs and the shared layer');
    const card = '#app .reveal-card.p1';
    for (const section of ['Core Identity', 'Professional Mindset', 'The Hook', 'Pain Points', 'Marketing Approach', 'Customer Journey', 'Psychological X-Ray', 'Key Takeaways']) await w.see(section, { within: card });
    await w.see(`"${bio(PEOPLE[0]).hookFinal}"`, { painted: true, within: card });
    await sees(`${await painted('Time and capacity:')} ${strain(PEOPLE[0], 1)}`, card, { painted: true });
    await sees(`${await painted('Aspirational undercurrent:')} Paul wants the ward to carry no plaque at all.`, card, { painted: true });
    await w.see('Move 1 for Paul: walk the ward with the nurse in charge.', { painted: true, within: card });
    const table = await p.locator(`${card} .j-table`).evaluate(t => ({ head: [...t.querySelectorAll('th')].map(c => c.textContent), rows: [...t.querySelectorAll('tbody tr')].map(r => [...r.children].map(c => c.textContent)) }));
    const wantHead = await Promise.all(['Stage', 'Initiating event', 'Feeling', 'Touchpoint', 'Strategy'].map(painted));
    w.check(JSON.stringify(table.head) === JSON.stringify(wantHead), `journey table header reads ${table.head.join(' | ')}`);
    w.check(table.rows.length === 5 && table.rows[0][0] === await painted('Awareness') && table.rows[0][1] === moment(PEOPLE[0], 1, 1) && table.rows[4][4] === moment(PEOPLE[0], 5, 4), 'the journey table does not hold the five stages as typed');
    const shared = '#app .reveal-card:not(.p1):not(.p2):not(.p3)';
    for (const section of ['Cross-cutting layer', 'Common Themes', 'The Binding Insight', 'Shared Key Takeaways']) await w.see(section, { within: shared });
    await w.see(COMMON.bindingInsight, { painted: true, within: shared });
    await w.see('Approve all three personas to save and finish');
  });

  await w.step('approval loop: refine once, approve all three', async () => {
    await press('Refine · round 1 of 3');
    await sees('Refine Paul', '#refine-modal');
    await press('Cancel', '#refine-modal');
    w.check(await p.locator('#refine-modal').count() === 0, 'Cancel did not close the refine box');
    await press('Refine · round 1 of 3');
    await w.fill('#refine-modal textarea', 'Lift the first move from the ward to the whole estate.');
    asked.length = 0;
    await press('Rebuild this persona', '#refine-modal');
    await w.see('Sharper move 1 for Paul: walk the ward with the nurse in charge.', { painted: true, timeout: 10000 });
    w.check(asked.length === 1 && asked[0].prompt.includes('Lift the first move from the ward to the whole estate.'), 'the feedback did not reach the model');
    await w.see('Refine · round 2 of 3');
    w.check(JSON.stringify((await state()).rounds) === '[1,0,0]', 'the refine round was not counted for the right buyer');
    for (let i = 0; i < 3; i++) await press('Approve');
    w.check(await p.getByText(await painted('✓ Approved'), { exact: true }).count() === 3, 'three approvals are not shown');
    await w.gone('Approve all three personas to save and finish');
    await press('Save and finish');
  });

  await w.step('finish: saved to the Brand Profile, in English underneath', async () => {
    // An anonymous founder is offered an account; the work is kept either way.
    await w.see('Save your Brand Profile');
    await p.locator('#qb-gate-skip').click();
    await w.see('Saved to QBP');
    await w.see('Done.');
    await sees('Three full persona briefs written into your QBP. Your Brand Document reads them from there. Below: the download formats and the branded export, ready to print.');
    w.check(!/Predictive Panel|War Table|Voice Guide/.test(await p.locator('#app').innerText()), 'the finish screen still names tools that do not read the profiles');
    const qbp = await p.evaluate(() => JSON.parse(localStorage.getItem('qb_qbp') || '{}'));
    const saved = qbp.personaProfiles || [];
    w.check(qbp.profilesComplete === true && saved.length === 3 && saved[0].name === 'Paul', 'the Brand Profile does not hold three finished profiles');
    w.check(saved[0] && saved[0].painPoints[0].category === 'Time and capacity' && saved[0].journey[0].stage === 'Awareness', 'labels were stored translated: stored values must stay English');
    w.check(qbp.bindingInsight === COMMON.bindingInsight && saved[0].marketingApproach[0] === REFINED.marketingApproach[0], 'the binding insight or the refined brief did not reach the Brand Profile');
  });

  const download = async english => {
    const [file] = await Promise.all([p.waitForEvent('download', { timeout: 45000 }), press(english)]);
    return { name: file.suggestedFilename(), path: await file.path() };
  };

  await w.step('export: Markdown, in the language of the page', async () => {
    const file = await download('Download Markdown');
    const md = fs.readFileSync(file.path, 'utf8');
    w.check(file.name === 'the-profiles.md', `Markdown file is named ${file.name}`);
    const expect = [
      '# The Profiles',
      fr ? '## Persona 1 : Paul · Head of estates at a teaching hospital' : '## Persona 1: Paul - Head of estates at a teaching hospital',
      '### ' + await w.say('Core Identity'),
      '### ' + await w.say('Hook'),
      '> ' + bio(PEOPLE[0]).hookFinal,
      '### ' + await w.say('Pain Points'),
      `- **${await w.say('Time and capacity')}${fr ? ' :' : ':'}** ${strain(PEOPLE[0], 1)}`,
      `| ${await w.say('Stage')} | ${await w.say('Initiating Event')} | ${await w.say('Feeling')} | ${await w.say('Touchpoint')} | ${await w.say('Strategy')} |`,
      `| ${await w.say('Awareness')} | ${moment(PEOPLE[0], 1, 1)} |`,
      '- Sharper move 1 for Paul: walk the ward with the nurse in charge.',
      '## ' + await w.say('Common Themes'),
      '> ' + COMMON.bindingInsight,
      '## ' + await w.say('Shared Key Takeaways'),
    ];
    for (const line of expect) w.check(md.includes(line), `the Markdown file is missing: ${line}`);
    if (fr) w.check(!/^#+ (Pain Points|Key Takeaways|Customer Journey|Marketing Approach)$/m.test(md), 'a Markdown heading stayed in English');
  });

  await w.step('export: JSON, untouched in either language', async () => {
    const file = await download('Download JSON');
    const data = JSON.parse(fs.readFileSync(file.path, 'utf8'));
    w.check(file.name === 'the-profiles.json', `JSON file is named ${file.name}`);
    w.check(data.profiles.length === 3 && data.profiles[2].name === 'Tomas' && data.commonThemes.length === 4 && data.sharedKeyTakeaways.length === 5, 'the JSON file does not hold the whole deliverable');
    w.check(data.profiles[0].painPoints.length === 5 && data.profiles[0].painPoints[0].category === 'Time and capacity' && data.profiles[0].journey[4].stage === 'Share and return', 'the JSON file was translated: data must stay as stored');
    w.check(Object.keys(data.profiles[0].xray).length === 6 && data.profiles[0].xray.aspirationalUndercurrent === 'Paul wants the ward to carry no plaque at all.', 'the JSON file lost the sharpened x-ray');
  });

  await w.step('export: PowerPoint, both decks', async () => {
    const deck = await download('Download PPTX');
    w.check(/^the-profiles-.+\.pptx$/.test(deck.name) && !/-marketing/.test(deck.name), `the deck is named ${deck.name}`);
    w.check(fs.statSync(deck.path).size > 20000 && fs.readFileSync(deck.path).subarray(0, 2).toString() === 'PK', 'the deck is not a PowerPoint file');
    const marketing = await download('Marketing deck');
    w.check(/-marketing\.pptx$/.test(marketing.name), `the marketing deck is named ${marketing.name}`);
    w.check(fs.statSync(marketing.path).size > 20000, 'the marketing deck is empty');
  });

  await w.step('export: the branded window, translated with the page', async () => {
    const [sheet] = await Promise.all([p.waitForEvent('popup'), press('Branded export (PDF)')]);
    await sheet.waitForLoadState('domcontentloaded').catch(() => {});
    await p.waitForTimeout(1400);                 // the runtime walks a new window over its first second
    const view = await sheet.evaluate(() => {
      const text = sel => [...document.querySelectorAll(sel)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
      return { lang: document.documentElement.getAttribute('lang'), title: document.title, print: text('.print-btn')[0], cover: text('.cover h1')[0],
        pages: document.querySelectorAll('section.page').length, hooks: text('.hook-page h2'), quote: text('.hook-page blockquote')[0],
        head: text('.jtable thead th').slice(0, 5), firstStage: text('.jtable tbody td')[0], firstEvent: text('.jtable tbody td')[1],
        themes: text('.themes-page h2')[0], sub: text('.takeaways-page .sub').pop(), labels: text('.pain-page li strong').slice(0, 5),
        identity: text('.identity-page h3').slice(0, 2) };
    });
    w.check(view.pages === 3 * 7 + 4, `the branded export has ${view.pages} pages, expected a cover, seven per buyer and three closing pages`);
    w.check(view.print === await painted('Print to PDF') && view.cover === 'THE PROFILES', `the cover reads "${view.cover}" with a "${view.print}" button`);
    w.check(view.hooks[0] === await painted("Paul's hook") && view.quote === `"${bio(PEOPLE[0]).hookFinal}"`, `the hook page reads ${view.hooks[0]} ${view.quote}`);
    const wantHead = await Promise.all(['Stage', 'Initiating Event', 'Feeling', 'Touchpoint', 'Strategy'].map(painted));
    w.check(JSON.stringify(view.head) === JSON.stringify(wantHead), `the journey table header reads ${view.head.join(' | ')}`);
    w.check(view.firstStage === await painted('Awareness') && view.firstEvent === moment(PEOPLE[0], 1, 1), 'the journey table lost a stage name or what was typed');
    w.check(JSON.stringify(view.identity) === JSON.stringify([await painted('Core Identity'), await painted('Professional Mindset')]), `the identity page reads ${view.identity.join(' / ')}`);
    w.check(view.labels[0] === await painted('Time and capacity:'), `the first pain label reads ${view.labels[0]}`);
    w.check(view.themes === (fr ? 'THÈMESCOMMUNSÀ TOUSLES PERSONAS' : 'COMMONTHEMESACROSSALL PERSONAS'), `the themes heading reads ${view.themes}`);
    w.check(view.sub === await painted('Across all three personas'), `the closing page reads ${view.sub}`);
    if (fr) w.check(view.lang === 'fr', `the branded window is marked lang="${view.lang}"`);
    await sheet.close();
  });

  await w.step('the way on', async () => {
    await w.see('Open Foundation');
    await w.see('Start over');
    w.check((await state()).step === 16, 'the tool is not resting on its last step');
  });
}
