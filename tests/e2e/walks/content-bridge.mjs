// Content Bridge: three production layers, their platforms, the consent
// gate, the call through /api/claude with the reader's language (no key is
// asked for), every way that call can fail, the four tabs of the brief,
// and copy.
//
// The page has no Content Approval Loop and no .txt pack, so neither is
// walked here.
import { languageDirective } from '../../../agents/lang.js';

export const page = 'content-bridge.html';
export const title = 'layers, consent, no key asked, the shared model route and its language, every error, brief tabs, copy';

const SCRIPT = 'Four in the morning. The starter sets the pace. We bake until the street wakes.';
const OWN_PROMPT_END = 'Return ONLY valid JSON. No markdown, no preamble.';

// What the page offers, read from its own layer table.
const LAYERS = [
  { label: 'Branded Static Content', consent: false, guide: 5,
    platforms: [['Canva', 'Free / Pro', 'https://canva.com', true], ['Adobe Firefly', 'Free / CC', 'https://firefly.adobe.com', false], ['Glorify', 'Paid', 'https://glorifyapp.com', false]],
    fields: ['Content type', 'Dimensions / format', 'Brand colors', 'Key message', 'Call to action'] },
  { label: 'UGC Video & Face Clone', consent: true, guide: 6, walked: 'HeyGen',
    platforms: [['HeyGen', 'Paid', 'https://heygen.com', true], ['Creatify', 'Paid', 'https://creatify.ai', true], ['Synthesia', 'Paid', 'https://synthesia.io', true]],
    fields: ['Script source', 'Video format', 'Target duration', 'Delivery tone', 'Call to action'] },
  { label: 'AI Avatar / Digital Twin', consent: true, guide: 6, walked: 'D-ID',
    platforms: [['HeyGen Avatar', 'Paid', 'https://heygen.com/avatar', true], ['Tavus', 'Paid', 'https://tavus.io', true], ['D-ID', 'Free/Paid', 'https://d-id.com', true]],
    fields: ['Script source', 'Target platform', 'Delivery tone', 'Language', 'Personalization level'] },
];
const CONSENT = [
  "I am uploading my own face and voice. I am not uploading another person's likeness.",
  'I have read and agree to the terms of service of the platform I am using.',
  'I understand my digital likeness will be processed by a third-party AI platform.',
  'I take full responsibility for how this content is distributed and used commercially.',
];

// What the model answers.
export const brief = {
  platformReadyTitle: 'Slow bread, one loaf per frame',
  executiveSummary: 'A square post that shows one loaf and one line. It should make the bakery read as a point of view.',
  productionInstructions: [
    { step: 1, action: 'Open a square design', detail: 'Choose the 1080 by 1080 preset from the home screen.' },
    { step: 2, action: 'Place the loaf photo', detail: 'Drag the photo in and crop to the crust.' },
  ],
  scriptFormatted: 'Four in the morning.\n[pause]\nThe starter sets the pace.',
  platformSettings: { format: '1080 by 1080, square', duration: 'Not applicable to a still', style: 'Warm crust tones on slate', exportSettings: 'PNG at full size' },
  brandApplication: { colors: 'Crust brown for the line, slate for the ground.', typography: 'One serif, one size.', voiceGuidance: 'Short sentences. No superlatives.' },
  qualityChecklist: [{ check: 'The loaf is sharp at full size', why: 'A soft crust reads as a stock photo' }],
  nextStep: 'Open the home screen and choose the square preset.',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const flat = s => String(s).replace(/\s+/g, ' ').trim();
const strings = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out));
  return out;
};

export async function walk(w) {
  const p = w.page;
  p.setDefaultTimeout(8000);          // a step that cannot land fails in seconds, not in 30
  const calls = [];
  let mode = 'ok', hold = 0, reply = brief;
  strings(brief).forEach(w.note);

  await w.mockModel(async (body, route) => {
    const request = route.request();
    calls.push({ body, url: request.url(), method: request.method(), headers: request.headers() });
    if (hold) await sleep(hold);
    return reply;
  });
  // Registered after the model mock, so it is asked first. It answers only
  // while a failure is being staged, in the shapes /api/claude answers in.
  const BUSY = 'The AI service is busy right now. Try again in a minute.';
  await w.mock('**/api/claude', route => {
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (mode === 'refused') return json(429, { type: 'error', error: { type: 'overloaded_error', message: BUSY } });
    if (mode === 'bare') return json(500, {});
    if (mode === 'soft') return json(200, { error: { message: 'Quota reached' } });
    if (mode === 'soft-plain') return json(200, { error: 'Quota reached, plainly' });
    if (mode === 'empty') return json(200, { content: [] });
    if (mode === 'offline') return route.abort();
    return route.fallback();
  });
  // The page must never go to a provider on its own. It once called
  // Anthropic from the browser with a key the operator had to paste in.
  const direct = [];
  p.on('request', r => { if (/api\.anthropic\.com|generativelanguage\.googleapis\.com/.test(r.url())) direct.push(r.url()); });

  // w.see flattens a no-break space before it searches and XPath does not,
  // so a French line that holds one ("Erreur de génération du brief\u00a0:")
  // never matches there. Lines are looked up here, inside a scope when one
  // is given.
  const find = async (english, opts = {}) => {
    const painted = flat(opts.painted ? english : await w.say(english));
    const lit = painted.includes("'") ? `concat('${painted.split("'").join(`', "'", '`)}')` : `'${painted}'`;
    return (opts.in || p).locator(`xpath=.//*[text()[normalize-space(translate(., '\u00a0', ' '))=${lit}]]`).filter({ visible: true }).first();
  };
  const see = async (english, opts = {}) => (await find(english, opts)).waitFor({ state: 'visible', timeout: opts.timeout ?? 8000 });
  const click = async (english, opts = {}) => { await (await find(english, opts)).click({ timeout: 8000 }); await p.waitForTimeout(200); };
  const absent = async (english, opts = {}) => (await find(english, opts)).waitFor({ state: 'hidden', timeout: 8000 });
  const text = async locator => flat(await locator.innerText());
  // As written in the page, for a label the stylesheet paints in capitals.
  const written = async locator => flat(await locator.textContent());

  const generate = p.locator('#root main button.btn-primary').last();
  const script = p.locator('#root main textarea');
  const platforms = p.locator('#root .platform-btn');
  const guide = p.locator('#root .quality-item');
  const consent = p.locator('#root .consent-box');
  const fieldOf = async label => (await find(label)).locator('xpath=following-sibling::input[1]');
  const stored = () => p.evaluate(() => localStorage.getItem('qb-api-key'));

  await w.step('open: three layers, and no key is asked for', async () => {
    await w.open();
    await see('Phase 03 - Production Layer', { timeout: 30000 });
    await see('Content Bridge');
    w.check(await p.locator('#root .layer-card').count() === LAYERS.length, 'the page does not offer three production layers');
    for (const layer of LAYERS) await see(layer.label);
    const named = /API key|clé API|Anthropic|sk-ant/i.exec(await p.locator('#root').innerText());
    w.check(!named, `the page asks for a key or names a provider: ${JSON.stringify(named && named[0])}`);
    w.check(await p.locator('#root header button.icon-btn').count() === 0, 'the header still carries a key button');
    w.check(await p.locator('.modal-overlay').count() === 0, 'a key modal is on the page');
    w.check(await stored() === null, 'a provider key is kept in this browser');
    await see('v1.0 · System Operational');
  });

  const first = LAYERS[0];
  await w.step('first layer: its platforms, its guide, its brief fields', async () => {
    await click(first.label);
    await see('02 - Select platform');
    w.check(await platforms.count() === 3, `the layer offers ${await platforms.count()} platforms`);
    for (const [i, [name, tier, url, api]] of first.platforms.entries()) {
      const row = platforms.nth(i);
      await see(name, { painted: true, in: row });
      await see(tier, { in: row });
      w.check(await row.locator('a').getAttribute('href') === url, `${name} opens ${await row.locator('a').getAttribute('href')}`);
      w.check(await text(row.locator('a')) === await w.say('Open ↗'), `the link on ${name} reads ${await text(row.locator('a'))}`);
      w.check(await (await find('API', { in: row })).count() === (api ? 1 : 0), `the API mark on ${name} is not what the layer table says`);
    }
    await click('Canva');
    w.check(await consent.count() === 0, 'a layer with no likeness asks for consent');
    await see('Source quality guide - read before uploading');
    w.check(await guide.count() === first.guide, `the guide holds ${await guide.count()} lines`);
    await see('Product photos: minimum 1000×1000px, white or neutral background, sharp focus, good lighting');
    await see('03 - Paste your QB agent output');
    await see('Script or content from QB agent');
    w.check(await script.getAttribute('placeholder') === await w.say('Paste the script, caption, or strategy output from your QB Content agent here. The Bridge will format it precisely for Canva.'), 'the script field placeholder is not in the page language, or does not name the platform');
    await see('This comes directly from LinkedIn Strategy Agent, Instagram Seed Agent, YouTube Strategy Agent, or the Repurposing Engine.');
    await see('04 - Brief details (optional but improves precision)');
    for (const label of first.fields) await see(label);
    w.check(await (await fieldOf('Key message')).getAttribute('placeholder') === await w.say('The one thing this piece of content must communicate'), 'a brief field placeholder is not in the page language');
    const line = await text((await find('Brand not set')));
    w.check(line === `${await w.say(first.label)} → Canva · ${await w.say('Brand not set')}`, `the line beside the button reads ${JSON.stringify(line)}`);
    w.check(await generate.isDisabled(), 'the brief button is live with no script');
  });

  await w.step('a script in place: the brief button comes on, nothing was asked yet', async () => {
    await w.fill(script, SCRIPT);
    await w.fill(await fieldOf('Key message'), 'One loaf, one line');
    w.check(await generate.isEnabled(), 'the brief button stays off with a script in place');
    w.check(calls.length === 0, 'the model was called before a brief was asked for');
  });

  // Each failure leaves the founder on the form, script intact, with the
  // reason on screen.
  const fails = async (name, message, stage) => {
    await w.step(`error: ${name}`, async () => {
      stage();
      await generate.click();
      // Named here, before the wait below can time out on it.
      await p.waitForTimeout(400);
      w.check(direct.length === 0, `the page called a provider itself: ${direct[0]}`);
      await see(typeof message === 'function' ? await message() : message, { timeout: 12000 });
      w.check(await script.inputValue() === SCRIPT, 'the script was emptied by the failure');
      w.check(await generate.isEnabled(), 'the brief button did not come back after the failure');
      w.check(await (await find('Production brief ready')).count() === 0, 'a brief is on screen after a failed run');
      mode = 'ok'; reply = brief;
    });
  };
  const parseError = text => p.evaluate(t => { try { JSON.parse(t); return ''; } catch (e) { return e.message; } }, text);
  await fails('provider busy', 'Brief generation error: ' + BUSY, () => { mode = 'refused'; });
  await fails('refusal with no message', 'Brief generation error: The AI service did not answer.', () => { mode = 'bare'; });
  await fails('error inside a 200', 'Brief generation error: Quota reached', () => { mode = 'soft'; });
  await fails('error as plain text inside a 200', 'Brief generation error: Quota reached, plainly', () => { mode = 'soft-plain'; });
  await fails('answer with no text', 'Brief generation error: The AI service did not answer.', () => { mode = 'empty'; });
  await fails('no network', 'Brief generation error: Failed to fetch', () => { mode = 'offline'; });
  await fails('prose instead of a brief', async () => `Brief generation error: ${await parseError('I can not write that brief.')}`, () => { reply = 'I can not write that brief.'; });

  await w.step('the call: through the shared route, saying the reader\'s language', async () => {
    hold = 1800; calls.length = 0;
    await generate.click();
    await see('Processing…');
    w.check(await generate.isDisabled(), 'the brief button can be pressed twice while a brief is being written');
    await see('Production brief ready', { timeout: 12000 });
    hold = 0;
    w.check(calls.length === 1, `the model was called ${calls.length} times for one brief`);
    const call = calls[0] || { body: {}, headers: {}, url: '' };
    w.check(/\/api\/claude$/.test(call.url) && call.method === 'POST', `the call went to ${call.method} ${call.url}`);
    w.check(direct.length === 0, `the page called a provider itself: ${direct[0]}`);
    w.check(!('x-api-key' in call.headers), 'the browser sent a provider key');
    w.check((call.headers['x-qb-lang'] === 'fr') === (w.lang === 'fr'), `the call tells the server the reader's language is ${call.headers['x-qb-lang']}`);
    w.check(call.body.model === 'claude-sonnet-4-6' && call.body.max_tokens === 3000, `the call asked for ${call.body.model}, ${call.body.max_tokens} tokens`);
    const system = call.body.system || '';
    w.check(system.startsWith('You are the QB Content Bridge inside the BrandOS ecosystem.'), 'the system prompt is not the page’s own');
    // The server appends the language directive once, from that header.
    w.check(system.endsWith(OWN_PROMPT_END) && !system.includes('LANGUAGE OF THE OUTPUT'), 'the browser changed the system prompt; the server adds the language directive itself');
    const asked = (call.body.messages && call.body.messages[0] && call.body.messages[0].content) || '';
    for (const part of [`PRODUCTION LAYER: ${first.label}`, 'TARGET PLATFORM: Canva', SCRIPT, 'keyMessage: One loaf, one line', 'Brand: not specified'])
      w.check(asked.includes(part), `the request does not carry ${JSON.stringify(part)}`);
  });

  await w.step('brief: production steps', async () => {
    await see(brief.platformReadyTitle, { painted: true });
    const ready = await text((await find(w.lang === 'fr' ? 'prêt' : 'Ready', { painted: true })));
    w.check(ready === (w.lang === 'fr' ? 'Canva prêt' : 'Canva Ready'), `the mark beside the title reads ${JSON.stringify(ready)}`);
    await see('Executive Summary');
    await see(brief.executiveSummary, { painted: true });
    await see('Platform specifications');
    for (const [key, shown] of [['format', 'format'], ['duration', 'duration'], ['style', 'style'], ['exportSettings', 'export Settings']]) {
      await see(shown);
      await see(brief.platformSettings[key], { painted: true });
    }
    const steps = await written((await find('Step-by-step execution in')));
    w.check(steps === `${await w.say('Step-by-step execution in')} Canva`, `the steps are headed ${JSON.stringify(steps)}`);
    for (const [i, step] of brief.productionInstructions.entries()) {
      await see(String(i + 1).padStart(2, '0'), { painted: true });
      await see(step.action, { painted: true });
      await see(step.detail, { painted: true });
    }
    const start = await written((await find('Start here in')));
    w.check(start === `${await w.say('Start here in')} Canva`, `the next step is headed ${JSON.stringify(start)}`);
    await see(brief.nextStep, { painted: true });
    const open = p.locator('#root main a.btn-primary');
    w.check(await open.getAttribute('href') === 'https://canva.com' && await text(open) === `${await w.say('Open')} Canva ↗`, `the platform button reads ${JSON.stringify(await text(open))}`);
  });

  await w.step('brief: formatted script, copy, and a clipboard that refuses', async () => {
    await click('Formatted Script');
    await see(brief.scriptFormatted, { painted: true });
    await click('Copy formatted script');
    await see('Copied ✓');
    const copied = await p.evaluate(() => navigator.clipboard.readText());
    w.check(copied === brief.scriptFormatted, `the clipboard holds ${JSON.stringify(copied)}`);
    await see('Copy formatted script', { timeout: 6000 });       // the mark clears by itself
    await p.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('denied')); });
    await click('Copy formatted script');
    await see('Clipboard access denied. Please copy the text manually.');
  });

  await w.step('brief: brand application, quality checklist', async () => {
    await click('Brand Application');
    for (const [key, shown] of [['colors', 'colors'], ['typography', 'typography'], ['voiceGuidance', 'voice Guidance']]) {
      await see(shown);
      await see(brief.brandApplication[key], { painted: true });
    }
    await click('Quality Checklist');
    await see('Pre-export verification');
    await see(brief.qualityChecklist[0].check, { painted: true });
    await see(brief.qualityChecklist[0].why, { painted: true });
    await click('Production Steps');
    await see('Executive Summary');
  });

  // The two layers that clone a face: nothing below the consent box shows
  // until the box is ticked, and the tick does not carry to another layer.
  for (const layer of LAYERS.slice(1)) {
    const [name, , url] = layer.platforms.find(row => row[0] === layer.walked);
    await w.step(`consent layer: ${layer.label} on ${name}`, async () => {
      await click(layer.label);
      await absent('Production brief ready');
      w.check(await platforms.count() === 3, `the layer offers ${await platforms.count()} platforms`);
      for (const [i, [other, otherTier, otherUrl]] of layer.platforms.entries()) {
        await see(other, { painted: true, in: platforms.nth(i) });
        await see(otherTier, { in: platforms.nth(i) });
        w.check(await platforms.nth(i).locator('a').getAttribute('href') === otherUrl, `${other} opens ${await platforms.nth(i).locator('a').getAttribute('href')}`);
      }
      w.check(await consent.count() === 0, 'consent is asked before a platform is chosen');
      await click(name);
      await see('Consent required - face & likeness');
      await see('This production layer involves cloning your face, voice, or creating a digital likeness. You must confirm the following before proceeding:');
      for (const line of CONSENT) await see(line, { in: consent });
      await see('I confirm the above. I am consenting to use of my own likeness.');
      const box = consent.locator('input[type="checkbox"]');
      w.check(!(await box.isChecked()), 'the consent box is already ticked');
      w.check(await guide.count() === 0 && await script.count() === 0, 'the guide or the script field shows before consent');
      await box.check({ force: true });
      await see('Source quality guide - read before uploading');
      w.check(await guide.count() === layer.guide, `the guide holds ${await guide.count()} lines`);
      for (const label of layer.fields) await see(label);
      w.check(await script.inputValue() === SCRIPT, 'the script was lost when the layer changed');
      w.check(await script.getAttribute('placeholder') === await w.say(`Paste the script, caption, or strategy output from your QB Content agent here. The Bridge will format it precisely for ${name}.`), 'the script field placeholder does not name the platform');

      calls.length = 0;
      await w.fill(await fieldOf('Delivery tone'), 'Plain and warm');
      await generate.click();
      await see('Production brief ready', { timeout: 12000 });
      const asked = (calls[0] && calls[0].body.messages[0].content) || '';
      for (const part of [`PRODUCTION LAYER: ${layer.label}`, `TARGET PLATFORM: ${name}`, 'tone: Plain and warm'])
        w.check(asked.includes(part), `the request does not carry ${JSON.stringify(part)}`);
      const ready = await text((await find(w.lang === 'fr' ? 'prêt' : 'Ready', { painted: true })));
      w.check(ready === (w.lang === 'fr' ? `${name} prêt` : `${name} Ready`), `the mark beside the title reads ${JSON.stringify(ready)}`);
      const open = p.locator('#root main a.btn-primary');
      w.check(await open.getAttribute('href') === url && await text(open) === `${await w.say('Open')} ${name} ↗`, `the platform button reads ${JSON.stringify(await text(open))}`);

      await box.uncheck({ force: true });
      w.check(await guide.count() === 0 && await script.count() === 0, 'the guide or the script field stays up once consent is withdrawn');
    });
  }
}
