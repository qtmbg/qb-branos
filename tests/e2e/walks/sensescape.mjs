// Sensescape, start to finish: the ten chapters, the lead form, the Codex
// both ways (derived when the model fails, written by the model when it
// answers), a second reading, print, a reload, and a new scan.
//
// The walk also holds the tool to its own numbers. The intro says "Ten
// chapters, thirty spectrums" and the Codex says "Derived from your 38
// answers": the walk counts what it meets and fails if the copy drifts.
export const page = 'sensescape.html';
export const title = 'ten chapters, lead form, derived and AI Codex, second reading, print';
export const timeout = 180;   // seconds. The walk takes about one minute.

/* The tool as it is built: chapter numeral, title, how many spectrums, and
   the written questions by id. Thirty spectrums and eight written answers. */
export const CHAPTERS = [
  { n: 'I',    title: 'Emotional Frequency', sliders: 5, text: [] },
  { n: 'II',   title: 'The Color World',     sliders: 4, text: ['cstorydom', 'cstorynever'] },
  { n: 'III',  title: 'Type Architecture',   sliders: 3, text: ['tvoice'] },
  { n: 'IV',   title: 'Visual Language',     sliders: 3, text: [] },
  { n: 'V',    title: 'Shape & Form',        sliders: 3, text: [] },
  { n: 'VI',   title: 'Motion & Rhythm',     sliders: 2, text: [] },
  { n: 'VII',  title: 'The Sensory World',   sliders: 2, text: ['swobj', 'swmoment'] },
  { n: 'VIII', title: 'Voice & Pace',        sliders: 3, text: ['vbvoicefail'] },
  { n: 'IX',   title: 'Sound & Silence',     sliders: 2, text: ['sdsignature'] },
  { n: 'X',    title: 'Ritual & Gesture',    sliders: 3, text: ['rtsignaturerit'] },
];

/* A French founder's answers. Three of them are read by keyword: the colour
   emotion, the object and the hour must each land on a specific reading,
   in French as in English. */
export const FRENCH_ANSWERS = {
  cstorydom: 'le calme, une paix profonde',
  cstorynever: 'un vert fluo, parce qu’il crie',
  tvoice: 'grave, lente, un léger accent',
  swobj: 'Une lourde boussole en laiton',
  swmoment: '6 h, première lumière',
  vbvoicefail: 'crier',
  sdsignature: 'une seule cloche, tenue',
  rtsignaturerit: 'le mot écrit à la main',
};
export const LEAD = { name: 'Ada Test', company: 'Maison Test', email: 'ada@maisontest.example' };

const READING = {
  compass: 'Your brand is a compass - wayfinding, oriented, sure of north. Your primary job is to help the customer locate themselves. Every product feature is a bearing, not a decoration.',
  preDawn: 'A pre-dawn brand - built on quiet conviction before the world arrives. Your discipline is your differentiator. Communication should feel like it was there before the reader, waiting.',
  stillness: 'Your dominant colour emotion is stillness. This is a discipline. Do not let anyone inside the brand argue for a louder shade "just this once." The moment you allow energy to enter, the stillness is gone - and with it, the brand.',
  glass: 'Your brand is glass - transparent, fragile if mishandled, beautiful when lit. Design for respect. The customer should feel the seriousness of what they are holding without needing it explained.',
  night: 'A night brand - intimate, honest, unafraid of shadows. Your communication says the things daytime cannot. Reserve plain language for difficult truths; reserve beauty for the ones worth hearing twice.',
  warmth: 'Your dominant colour emotion is warmth. Every surface should feel lit from behind - by lamplight, not a screen. Avoid cold whites and fluorescents. Your photography lives in 2500–3500K light.',
};

// What the mocked model sends back: one of everything the Codex can show.
const MODEL = {
  essence: 'Maison Test holds a brass compass at first light. It points before anyone asks.',
  positioning: ['For founders who decide before the room wakes.', 'We are a bearing, held steady.', 'We are not a megaphone.'],
  manifesto: ['We believe in north.', 'We refuse noise.', 'We build before dawn.', 'We keep one note.', 'We write by hand.', 'We hold the line.', 'We wait well.', 'We point, then walk.'],
  narrative: { whoWeAre: 'We are the instrument on the desk.', howWeShowUp: 'We arrive early and speak low.', whatWeRefuse: 'We refuse to shout.' },
  paletteNames: [
    { role: 'Primary', poeticName: 'Low-Tide Brass', hex: '#111111', usageRule: 'Anchor of every surface.' },
    { role: 'Shadow', poeticName: 'Lamp Soot', hex: '#222222', usageRule: 'Depth behind the anchor.' },
    { role: 'Accent', poeticName: 'First Ember', hex: '#333333', usageRule: 'Interactive states only.' },
    { role: 'Surface', poeticName: 'Chart Paper', hex: '#444444', usageRule: 'Cards and sheets.' },
    { role: 'Neutral', poeticName: 'Harbour Fog', hex: '#555555', usageRule: 'Body text.' },
  ],
  typographyRationale: 'A quiet serif for the bearing, a plain sans for the log.',
  typographyRules: ['Headlines never exceed two lines.', 'Body stays at sixteen.', 'No third family.'],
  shapeRules: ['Corners stay under six.', 'Hairlines stay at one.', 'Circles are for instruments.'],
  motionTokens: { durationFast: '140ms', durationBase: '250ms', durationSlow: '430ms', curve: 'cubic-bezier(.3,0,.1,1)', rule: 'Nothing moves unless it points somewhere.' },
  voice: {
    sayNotThat: [{ say: 'North is this way.', notThat: 'Explore your options.' }, { say: 'We will be there at six.', notThat: 'We aim to be responsive.' }],
    taglines: ['Before the room wakes.', 'One bearing.', 'Held steady.'],
  },
  competitiveMap: { xAxisLabel: 'Restrained ← → Expressive', yAxisLabel: 'Ceremonial ← → Spontaneous', brandPosition: [32, 71], competitors: [{ name: 'Aesop', x: 20, y: 80 }, { name: 'Muji', x: 15, y: 40 }] },
  firstCampaign: {
    title: 'The Six O’Clock Bearing', premise: 'One letter, posted at first light, to one person who needs a direction.',
    // The page inlines this drawing. It must drop the script and the handler.
    heroSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340"><script>window.__pwned = true</script><rect width="600" height="340" fill="#111111" onclick="window.__pwned = true"/><circle cx="300" cy="170" r="90" fill="#333333"/></svg>',
    scenes: [
      { title: 'The desk', copy: 'A compass, a lamp, a letter.', visualDirection: 'Low light, one object.' },
      { title: 'The door', copy: 'The letter leaves.', visualDirection: 'Hand, envelope, cold air.' },
      { title: 'The road', copy: 'It travels.', visualDirection: 'A single line across a map.' },
      { title: 'The reader', copy: 'It arrives.', visualDirection: 'A second lamp.' },
    ],
  },
  sprint30: [
    { week: 'Week 1', focus: 'Fix the bearing', tasks: ['Name north.', 'Write the refusal.', 'Lock the palette.', 'Set the type.'] },
    { week: 'Week 2', focus: 'Build the instrument', tasks: ['Tokens.', 'Templates.', 'First letter.', 'Sound mark.'] },
    { week: 'Week 3', focus: 'Send', tasks: ['Post.', 'Listen.', 'Adjust.', 'Post again.'] },
    { week: 'Week 4', focus: 'Hold', tasks: ['Audit.', 'Train.', 'Document.', 'Rest.'] },
  ],
};

const norm = s => String(s).replace(/\s+/g, ' ').trim();

/* The shared helper finds text with XPath, which does not count a no-break
   space as a space. French puts one before : ; ? and inside « ». For a
   string that carries one, this reads the painted text nodes instead. */
export async function shown(w, english, { timeout = 8000 } = {}) {
  const text = norm(await w.say(english));
  await w.page.waitForFunction(t => [...document.querySelectorAll('body *')].some(el =>
    el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' &&
    [...el.childNodes].some(n => n.nodeType === 3 && n.data.replace(/\s+/g, ' ').trim() === t)), text, { timeout });
}

/* Clicks what the walk names, and says at once what is in the way when
   something is. Left to itself the click would be retried for its whole
   timeout against an element that sits under another one, and the failure
   would read "timeout" instead of naming the cover. This is how the walk
   found the empty nav strip over the chapter nav. */
export async function press(w, english, opts = {}) {
  const target = await w.locate(english, opts);
  await target.waitFor({ state: 'visible', timeout: opts.timeout ?? 8000 });
  await target.scrollIntoViewIfNeeded({ timeout: 3000 });
  const cover = await target.evaluate(el => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!top || top === el || el.contains(top) || top.contains(el)) return null;
    return top.tagName.toLowerCase() + (typeof top.className === 'string' && top.className.trim() ? '.' + top.className.trim().split(/\s+/).join('.') : '');
  });
  if (cover) throw new Error(`"${english}" cannot be clicked: ${cover} sits on top of it`);
  await target.click({ timeout: 3000 });
  await w.page.waitForTimeout(opts.wait ?? 250);
}

/* Third parties the page reaches for pictures. Nothing a walk does may
   touch a real backend, and the walk records any POST that leaves the site. */
export async function isolate(w) {
  const posts = [];
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  await w.mock(/logo\.clearbit\.com|upload\.wikimedia\.org/, route => route.fulfill({ status: 200, contentType: 'image/png', body: pixel }));
  await w.mock(/hooks\.zapier\.com/, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  w.page.on('request', r => {
    if (r.method() !== 'POST') return;
    const host = new URL(r.url()).host;
    if (host !== new URL(w.page.url()).host) posts.push(r.url());
  });
  return posts;
}

export const modelDown = w => w.mock('**/api/claude', route => route.fulfill({ status: 502, contentType: 'application/json', body: '{}' }));

/* Moves the spectrums of the chapter on screen and reports what did not
   follow: the side named above the score, the score itself, the preview. */
async function moveSliders(w, valueFor) {
  return w.page.evaluate(async values => {
    const problems = [];
    for (const wrap of document.querySelectorAll('.question-list .qwrap-slider')) {
      const id = wrap.getAttribute('data-qid');
      const v = values[id] != null ? values[id] : values['*'];
      const range = wrap.querySelector('input[type=range]');
      range.value = String(v);
      range.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 30));          // let the label be painted in the page's language
      const heading = wrap.querySelector('.q-title');
      const side = v < 5 ? heading.firstChild.data.trim() : v > 5 ? heading.lastChild.data.trim() : null;
      const label = wrap.querySelector('.active-label').textContent.trim();
      const score = wrap.querySelector('.q-score .value').textContent.trim();
      if (side && label !== side) problems.push(`${id}: set to ${v}, label reads "${label}", expected "${side}"`);
      if (score !== String(Math.abs(v - 5))) problems.push(`${id}: set to ${v}, score reads ${score}`);
      if (!wrap.querySelector('.q-preview .viz-body')) problems.push(`${id}: no live preview`);
    }
    return problems;
  }, valueFor);
}

/* From the first chapter to the lead form. `answers` are typed where given;
   a written question with no new answer must already hold one.
   `sliders` maps a question id to 0..10, with '*' for the rest.
   `at(chapter, index)` runs before the chapter is left.
   Returns what was met, so the caller can hold the copy to it. */
export async function answerChapters(w, { answers = {}, sliders = { '*': 3 }, at } = {}) {
  const met = { chapters: 0, sliders: 0, written: 0 };
  for (const [i, ch] of CHAPTERS.entries()) {
    await w.see('Section ' + ch.n);
    await w.see(ch.title + '.');
    const count = await w.page.evaluate(() => ({
      sliders: document.querySelectorAll('.question-list .qwrap-slider').length,
      written: document.querySelectorAll('.question-list .qwrap-text').length,
    }));
    w.check(count.sliders === ch.sliders && count.written === ch.text.length,
      `chapter ${ch.n} shows ${count.sliders} spectrums and ${count.written} written questions, expected ${ch.sliders} and ${ch.text.length}`);
    const total = ch.sliders + ch.text.length;
    await w.see(`Question 1 of ${total}`);
    await w.see(`Question ${total} of ${total}`);
    met.chapters++; met.sliders += count.sliders; met.written += count.written;

    const problems = await moveSliders(w, sliders);
    w.check(!problems.length, `chapter ${ch.n}: ${problems.join(' · ')}`);

    if (at) await at(ch, i);
    for (const id of ch.text) {
      const field = w.page.locator(`[data-qid="${id}"] textarea`);
      if (answers[id] != null) await w.fill(field, answers[id]);
      else w.check((await field.inputValue()).trim() !== '', `chapter ${ch.n}: the answer to ${id} was not kept`);
    }
    await press(w, i === CHAPTERS.length - 1 ? 'Execute' : 'Proceed', { within: '.chap-actions' });
  }
  await w.see('Identity Lock.');
  return met;
}

export async function fillLead(w, lead = LEAD) {
  await w.fill('.lead-form input[type=email]', lead.email);
  await w.fill(w.page.locator('.lead-form input[type=text]').nth(0), lead.name);
  await w.fill(w.page.locator('.lead-form input[type=text]').nth(1), lead.company);
  // The brand name is painted in capitals and as a handle: data, not copy.
  w.note(lead.company.toUpperCase());
  w.note('@' + lead.company.toLowerCase().replace(/\s+/g, ''));
}

/* The soft gate from qb-gate.js opens the first time a Codex appears. A
   founder who wants the result first takes the way out it offers. */
export async function passGate(w, { expected = true } = {}) {
  const gate = w.page.locator('.qb-gate-overlay');
  const opened = await gate.waitFor({ state: 'visible', timeout: expected ? 5000 : 1500 }).then(() => true, () => false);
  if (expected) w.check(opened, 'the save-your-profile gate did not open on the first Codex');
  if (!opened) return false;
  await w.page.locator('#qb-gate-skip').click();
  await gate.waitFor({ state: 'detached', timeout: 5000 });
  return true;
}

const present = (w, selector) => w.page.locator(selector).count().then(n => n > 0);

export async function walk(w) {
  const posts = await isolate(w);
  let met;

  await w.step('intro', async () => {
    await w.open();
    await w.see('Before a brand speaks,');
    await w.see('it is felt.');
    await w.see('Observe · Sensescape · The sensory layer');
    await w.see('Ten chapters, thirty spectrums. You will rate where your brand sits between two anchors. Every spectrum carries a real cultural reference. The first read is the truthful one.');
    await w.see('Protocol 03');
    const text = await w.page.evaluate(() => document.body.innerText);
    w.check(!/Phase\s*0\d/i.test(text), 'a numbered phase is still painted on the intro');
    await press(w, 'Initialize diagnostics');
  });

  await w.step('ten chapters, the empty-question toast, one step back', async () => {
    met = await answerChapters(w, {
      answers: FRENCH_ANSWERS,
      sliders: { '*': 3, vphotoill: 1, vcontgrad: 1, vfutnost: 9, tserifsans: 8, mstatkin: 8 },
      at: async (ch) => {
        if (ch.n === 'I') {
          const disabled = await w.page.getByRole('button', { name: await w.say('Previous chapter'), exact: true }).isDisabled();
          w.check(disabled, 'the previous-chapter button is live on the first chapter');
        }
        if (ch.n === 'II') {
          // Leave with a written question empty: the tool says so and stays.
          await press(w, 'Proceed', { within: '.chap-actions' });
          await w.see('Question still empty - scrolling you to it.');
          w.check(await present(w, '.q-text.unanswered'), 'the empty question was not marked');
          await w.see('Section II');
          await w.fill('[data-qid="cstorydom"] textarea', FRENCH_ANSWERS.cstorydom);
          await w.gone('Question still empty - scrolling you to it.');
        }
        if (ch.n === 'III') {
          // One chapter back, and forward again: nothing typed is lost.
          await press(w, 'Previous chapter', { role: 'button' });
          await w.see('Section II');
          const kept = await w.page.locator('[data-qid="cstorynever"] textarea').inputValue();
          w.check(kept === FRENCH_ANSWERS.cstorynever, `going back lost an answer: ${JSON.stringify(kept)}`);
          await press(w, 'Proceed', { within: '.chap-actions' });
          await w.see('Section III');
        }
      },
    });
    w.check(met.chapters === 10 && met.sliders === 30,
      `the intro says ten chapters and thirty spectrums; the walk met ${met.chapters} and ${met.sliders}`);
    w.check(met.written === 8, `eight written questions expected, met ${met.written}`);
  });

  await w.step('lead form refuses an empty email, name and company', async () => {
    await press(w, 'Generate final codex');
    await w.see('Enter a valid email address.');
    await w.fill('.lead-form input[type=email]', LEAD.email);
    await press(w, 'Generate final codex');
    await w.see('Name is required.');
    await w.fill(w.page.locator('.lead-form input[type=text]').nth(0), LEAD.name);
    await press(w, 'Generate final codex');
    await w.see('Company is required.');
    await fillLead(w);
  });

  await w.step('the model fails: the tool says so and offers the derived Codex', async () => {
    await modelDown(w);
    await press(w, 'Generate final codex');
    await w.see('We hit a snag.');
    await w.see('Could not reach Claude. The network call failed - try again in a moment.');
    await press(w, 'Try again');
    await w.see('We hit a snag.');
    w.check(posts.length === 0, `the lead form posted outside the site: ${posts.join(', ')}`);
    const saved = await w.page.evaluate(() => JSON.parse(localStorage.getItem('qb_qbp') || '{}'));
    w.check(saved.brandObject === FRENCH_ANSWERS.swobj && saved.soundSignature === FRENCH_ANSWERS.sdsignature && !!saved.sensescapeCompletedAt,
      'the answers were not written to the Brand Profile');
    await press(w, 'Continue without AI synthesis');
    await passGate(w);
  });

  await w.step('derived Codex, read from French answers', async () => {
    await w.see('Diagnostic complete · Derived Codex');
    await w.see('The Codex.');
    await w.see(`Prepared for ${LEAD.name} · ${LEAD.company}`);
    await w.see('Reading A · Derived only');
    await w.see('Derived from your 38 answers');
    w.check(met.sliders + met.written === 38, `the Codex says 38 answers; the walk gave ${met.sliders + met.written}`);
    // The three keyword readings, from answers written in French.
    await w.see(READING.compass);
    await w.see(READING.preDawn);
    await shown(w, READING.stillness);
    await shown(w, `"${FRENCH_ANSWERS.swobj}"`);
    await w.see('The Colour Territory');
    await w.see('The Typographic System');
    await w.see('The Shape Language');
    await w.see('The Motion Signature');
    await w.see('Paradoxes as Signature');
    await w.see('Your First Three Moves');
    w.check(await w.page.locator('.cdx-move-card').count() === 3, 'the Codex promises three first moves and shows another number');
    w.check(await w.page.locator('.cdx-swatch').count() === 5, 'the palette is announced as five chips and shows another number');
    w.check(!(await present(w, '.cdx-positioning')) && !(await present(w, '.cdx-sprint')), 'model-only sections appear in the derived Codex');
    const text = await w.page.evaluate(() => document.getElementById('app').innerText);
    w.check(!/\bBRANDOS\b/.test(text), 'the product name is painted in capitals');
  });

  await w.step('the toolbar stays in reach while the Codex is read', async () => {
    // Pinned below the nav, not under it: the button under the pointer must
    // be the toolbar's own. (On a phone the toolbar is not pinned.)
    await w.page.evaluate(() => window.scrollTo({ top: 2400, behavior: 'instant' }));
    await w.page.waitForTimeout(400);
    const hit = await w.page.evaluate(() => {
      const b = document.querySelector('.cdx-toolbar .right button').getBoundingClientRect();
      const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return { top: Math.round(b.top), own: !!el && !!el.closest('.cdx-toolbar'), under: el ? el.tagName + '.' + el.className : null };
    });
    w.check(hit.own, `the Codex toolbar is covered once the page is scrolled (${hit.under} at ${hit.top}px)`);
  });

  await w.step('regeneration modal opens where it can be seen, and cancels', async () => {
    await press(w, 'Generate second reading');
    w.check(await present(w, '#regen-modal.open'), 'the modal did not open');
    const card = await w.page.evaluate(() => { const r = document.querySelector('.regen-modal-card').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: innerHeight }; });
    w.check(card.top >= 0 && card.bottom <= card.height, `the dialog opened outside the window: ${JSON.stringify(card)}`);
    await shown(w, 'Generate a second reading?');
    await w.see('Generation takes 20–40 seconds. Please keep this tab open.');
    await press(w, 'Cancel', { within: '#regen-modal' });
    w.check(!(await present(w, '#regen-modal.open')), 'Cancel did not close the modal');
    await w.see('Reading A · Derived only');
  });

  const asked = {};
  await w.step('second reading, written by the model', async () => {
    await w.mockModel(async (body, route) => {
      asked.lang = route.request().headers()['x-qb-lang'];
      asked.prompt = String(body && body.messages && body.messages[0] && body.messages[0].content);
      await new Promise(r => setTimeout(r, 1500));          // long enough to read the waiting screen
      return MODEL;
    });
    await press(w, 'Generate second reading');
    await press(w, 'Yes, generate a second reading');
    await w.see('Composing your Codex');
    await w.see('Please keep this tab open · Generation takes 20–40 seconds · Do not reload');
    await w.see('Diagnostic complete · Codex generated by AI', { timeout: 15000 });
    w.check(asked.lang === w.lang, `the model was asked to answer in ${JSON.stringify(asked.lang)}, the page is in ${w.lang}`);
    w.check(asked.prompt.includes(FRENCH_ANSWERS.swobj) && asked.prompt.includes(LEAD.company), 'the founder’s answers did not reach the model');
    await w.see('Synthesized by AI strategist');
    await w.see(MODEL.essence, { painted: true });
    await w.see('The Positioning');
    await w.see(MODEL.positioning[0], { painted: true });
    await w.see('The Manifesto');
    w.check(await w.page.locator('.cdx-manifesto .line').count() === 8, 'the manifesto is announced as eight declarations and shows another number');
    await w.see('The Narrative');
    await w.see(MODEL.narrative.howWeShowUp, { painted: true });
    await w.see(MODEL.paletteNames[0].poeticName, { painted: true });
    await w.see('Say this · not that');
    await w.see(MODEL.voice.sayNotThat[0].say, { painted: true });
    await w.see('Tagline candidates');
    await w.see('The Competitive Map');
    await w.see(LEAD.company, { painted: true, within: '.cdx-compmap-point.mine' });
    await w.see('The First Campaign');
    await w.see(MODEL.firstCampaign.title, { painted: true });
    await w.see('Scene 04');
    w.check(await w.page.locator('.cdx-campaign-scene').count() === 4, 'the campaign is announced as four scenes and shows another number');
    await w.see('30-Day Implementation Sprint');
    await w.see('Week 4');
    const hero = await w.page.evaluate(() => {
      const svg = document.querySelector('.cdx-campaign-hero svg');
      return { drawn: !!svg, script: !!(svg && svg.querySelector('script')), handler: !!(svg && svg.querySelector('[onclick]')), ran: !!window.__pwned };
    });
    w.check(hero.drawn, 'the campaign drawing was not inlined');
    w.check(!hero.script && !hero.handler && !hero.ran, 'the campaign drawing kept a script or a handler');
    w.check(!(await present(w, '.cdx-moves')), 'the derived first moves appear in the model’s Codex');
  });

  await w.step('two readings, and no third', async () => {
    await w.see('Reading A');
    await w.see('Reading B');
    w.check(await w.page.locator('.reading-pill.active').innerText().then(t => /B\s*$/.test(t.trim())), 'the new reading is not the one shown');
    w.check(await w.page.getByRole('button', { name: await w.say('Generate second reading'), exact: true }).count() === 0, 'a third reading is offered');
    await press(w, 'Reading A');
    await w.see('Diagnostic complete · Derived Codex');
    await w.see('Derived from your 38 answers');
    await press(w, 'Reading B');
    await w.see('Diagnostic complete · Codex generated by AI');
  });

  await w.step('export as PDF prints the Codex and nothing else', async () => {
    await w.page.evaluate(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
    await press(w, 'Export as PDF');
    w.check(await w.page.evaluate(() => window.__prints) === 1, 'Export as PDF did not call print');
    await w.page.emulateMedia({ media: 'print' });
    const paper = await w.page.evaluate(() => {
      const on = sel => [...document.querySelectorAll(sel)].some(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
      return { codex: on('.codex-head h1'), toolbar: on('.cdx-toolbar'), banner: on('.banner'), nav: on('.nav-wrap'), footer: on('footer.footer'), lang: on('.qb-lang') };
    });
    await w.page.emulateMedia({ media: null });
    w.check(paper.codex, 'the Codex is missing from the printed page');
    w.check(!paper.toolbar && !paper.lang, 'the toolbar or the language switch prints');
    w.check(!paper.banner && !paper.nav && !paper.footer, `the site chassis prints with the Codex: ${JSON.stringify(paper)}`);
  });

  await w.step('a reload brings the readings back', async () => {
    await w.open();
    await w.see('The Codex.');
    await w.see('Reading A');
    await w.see('Reading B');
    await w.see(`Prepared for ${LEAD.name} · ${LEAD.company}`);
    w.note(LEAD.company.toUpperCase());
    w.note('@' + LEAD.company.toLowerCase().replace(/\s+/g, ''));
  });

  await w.step('new scan, answered in English, model still down', async () => {
    await modelDown(w);
    await press(w, 'New scan');
    await w.see('Before a brand speaks,');
    await press(w, 'Initialize diagnostics');
    await answerChapters(w, {
      answers: { cstorydom: 'warmth', swobj: 'a thin sheet of glass', swmoment: 'midnight' },
      sliders: { '*': 7 },
    });
    const prefilled = await w.page.locator('.lead-form input[type=email]').inputValue();
    w.check(prefilled === LEAD.email, 'the lead form forgot the founder');
    await press(w, 'Generate final codex');
    await w.see('We hit a snag.');
    await press(w, 'Continue without AI synthesis');
    await passGate(w);
    await w.see('Reading A · Derived only');
    await w.see(READING.glass);
    await w.see(READING.night);
    await w.see(READING.warmth);
    w.check(await w.page.getByRole('button', { name: await w.say('Generate second reading'), exact: true }).count() === 1, 'a new scan does not offer a second reading');
    w.check(posts.length === 0, `something was posted outside the site: ${posts.join(', ')}`);
  });
}
