// Brand Document: what the page assembles from the Brand Profile, in every
// state a founder can be in, and every way the document leaves the page.
//
// States: nothing done · a free account (Visual DNA and War Table need
// Starter) · everything done · tools done with no synthesis in the profile ·
// the values the Brand Soul Map stores with an English prefix.
// Exits: back, the two decks, the PDF, send by email (anonymous, signed in,
// failing, across a language switch), paper.
export const page = 'brand-document.html';
export const title = 'profile states, free and paying, decks, PDF, email, print';
export const switchesLanguage = true;

const BRAND = 'Maison Levain';
const FULL = {
  brandName: BRAND, naturalForce: 'A slow tide', offer: 'One loaf, baked once a day', voiceNotes: 'Say the time it took | Name the grain',
  // Archetype Compass
  archetypeCompassComplete: true, archetypeHeadline: 'The carer who makes', archetypePrimary: 'The Caregiver', archetypeSecondary: 'The Creator', archetypeTension: 'The Sage',
  archetypeFusion: 'Care that shows its working', archetypeCoreMotivation: 'To feed people properly', archetypeCoreFear: 'Being hurried into carelessness', archetypeToneRegister: '',
  archetypeCentralParadox: { statement: 'Generous and exacting at once' }, archetypeDecisionFilter: 'Would we serve this to a neighbour', archetypeFirstMove: 'Print the bake time on the bag',
  // Brand Soul Map
  soulMapComplete: true, brandEssence: 'Bread for people who are done being hurried.', spark: 'It moves at the pace of a starter and refuses the shortcut.',
  archetype: 'The Caregiver + The Creator', manifesto: 'We believe that time is an ingredient', antiBrand: 'We refuse to: sell day-old bread as fresh',
  paradox: 'patient yet exacting', alwaysNever: 'Always: bake before dawn | Never: sell day-old bread as fresh', primaryPersona: 'She reads the label before the price.',
  // Sensescape
  sensescapeCompletedAt: '2026-11-01T08:00:00Z', colorTerritory: 'Warm flour white', visualTerritoryNote: 'Linen, steam, enamel', typographyNote: 'A quiet serif', exemplarWords: 'A paper bag at seven in the morning',
  // Visual DNA
  visualDnaCompletedAt: '2026-11-02T08:00:00Z', visualDnaKeepCount: 12, visualDnaDiscardRate: 40, visualDnaFastDiscards: ['img-03', 'img-17'], visualDnaKeptImages: ['img-01'],
  // War Table
  warTableCompletedAt: '2026-11-03T08:00:00Z', warTableBrief: { challenge: 'One oven, three ideas', goal: 'Sell out by noon, every day' }, warTableTopInitiatives: ['Saturday preorders', 'The counter card'],
  // The Profiles
  profilesComplete: true, bindingInsight: 'They all buy time back',
  personaProfiles: [
    { name: 'Camille', role: 'Nurse on night shifts', hook: 'Breakfast that waited for you', mindset: 'Tired and precise', painPoints: [{ category: 'No time to queue' }], marketingApproach: ['Preorder by text'], keyTakeaways: ['She plans a day ahead'] },
    { role: 'Courier between drops', hook: 'Eat it standing', mindset: 'Always moving' },
  ],
  commonThemes: ['Time is the price'], sharedKeyTakeaways: ['Say when it is ready'],
};
const DONE = { 'archetype-compass': 1, 'soul-map': 1, sensescape: 1, 'visual-dna': 1, 'war-table': 1, profiles: 1 };

export async function walk(w) {
  const p = w.page;
  const other = w.lang === 'en' ? 'fr' : 'en';
  const dialogs = [];
  p.on('dialog', d => dialogs.push(d.message()));

  // One text node at a time, the way the dictionary is keyed. French
  // punctuation carries no-break spaces; they are folded on both sides.
  const flat = s => String(s).replace(/\s+/g, ' ').trim();
  const lit = t => (t.includes("'") ? `concat('${t.split("'").join(`', "'", '`)}')` : `'${t}'`);
  const find = async (english, opts = {}) => {
    const text = flat(opts.painted ? english : await w.say(english));
    const node = "normalize-space(translate(., ' ', ' '))";
    return (opts.within ? p.locator(opts.within) : p).locator(`xpath=./descendant-or-self::*[text()[${node}=${lit(text)}]]`).filter({ visible: true }).first();
  };
  // A miss names the text, so a failure says what was not on screen.
  const see = async (english, opts = {}) => (await find(english, opts)).waitFor({ state: 'visible', timeout: opts.timeout ?? 5000 })
    .catch(() => { throw new Error(`not on screen${opts.within ? ' in ' + opts.within : ''}: ${JSON.stringify(english)}`); });
  const painted = async english => flat(await w.say(english));
  const text = sel => p.locator(sel).first().textContent().then(flat);
  const leaves = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(x => leaves(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach(x => leaves(x, out)); return out; };

  // A profile state: what the tools wrote, which tools are recorded as done,
  // and which account is looking. The page is repainted, not reloaded.
  const show = async ({ qbp = {}, done = {}, plan = 'agency' } = {}) => {
    leaves(qbp).forEach(w.note);
    await p.evaluate(([q, c, t]) => {
      localStorage.setItem('qb_qbp', JSON.stringify(q));
      localStorage.setItem('qb_completions', JSON.stringify(c));
      if (t) { localStorage.setItem('qb_user_tier', t); localStorage.setItem('qb_sub_status', 'active'); }
      else { localStorage.removeItem('qb_user_tier'); localStorage.setItem('qb_sub_status', 'inactive'); }
      render();
    }, [qbp, done, plan]);
  };
  const meter = async (pct, line, starter) => {
    await see(`${pct}% complete`, { within: '#completion-pct' });
    w.check(await p.locator('#meter-container').getAttribute('aria-valuenow') === String(pct), `the progress bar does not say ${pct}`);
    await see(line, { within: '#completion-sub' });
    if (starter) await see(starter, { within: '#completion-starter' });
    else w.check(await p.locator('#completion-starter').count() === 0, 'a Starter note is shown to an account that does not need one');
  };
  const sectionText = id => p.locator(`#${id}-content`).innerText().then(flat);

  // The PDF library comes from a CDN. The walk answers for it and keeps
  // what the page asked it to do.
  await w.mock(/html2pdf/, route => route.fulfill({ contentType: 'text/javascript', body: `
    window.__pdf = [];
    window.html2pdf = function () {
      var job = {}, btn = document.getElementById('dl-btn');
      var api = {
        set: function (o) { job.filename = o.filename; return api; },
        from: function (el) { job.from = el.id; job.flattened = el.classList.contains('pdf-render'); return api; },
        save: function () {
          job.label = btn.textContent; job.aria = btn.getAttribute('aria-label'); job.disabled = btn.disabled;
          window.__pdf.push(job);
          return window.__pdfFails ? Promise.reject(new Error('walk')) : new Promise(function (r) { setTimeout(r, 120); });
        }
      };
      return api;
    };` }));

  await w.step('open: nothing done yet', async () => {
    await w.open();
    await see('Brand Document', { within: '.completion-meter' });
    await meter(0, 'Complete the foundation exercises and The Profiles to fill your Brand Document.');
    // Cover: the product, what this is, when.
    await see('· Brand operating system');
    w.check(/BrandOS/.test(await p.locator('.doc-cover-label').innerText()), 'the product name is recased on the cover label');
    await see('Your Brand', { within: '.doc-cover' });
    await see('Brand Document · Assembled from your Brand Profile');
    // Today, as the page's own clock has it (the runner's may sit in another zone).
    const today = await p.evaluate(() => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    await see(`Generated: ${today} ·`);
    w.check(await p.locator('.doc-section').count() === 7, 'the document does not have seven sections');
    for (const heading of ['Archetype Trinity', 'Identity Core', 'Sensory Universe', 'Strategic Direction', 'Buyer Personas', 'Brand Profile summary']) await see(heading, { within: '.doc-section-title' });
    // Six sections are filled by a tool, and the meter counts those six.
    w.check(await p.locator('#section-dots > div').count() === 6, 'the meter does not count six sections');
    w.check(await p.locator('.status-badge.status-pending').count() === 6, 'not every tool section reads Pending');
    for (const tool of ['Archetype Compass', 'Brand Soul Map', 'Sensescape', 'Visual DNA', 'War Table', 'The Profiles']) await see(`Open ${tool} →`);
    await see('to populate this section');
    await see('Complete brand name in the tool to fill this field');
  });

  await w.step('an empty section opens its tool, carrying the profile', async () => {
    await show({ qbp: { brandName: BRAND } });
    await p.evaluate(() => { window.__opened = []; window.open = url => { window.__opened.push(url); return null; }; });
    await (await find('Open Archetype Compass →')).click();
    const url = (await p.evaluate(() => window.__opened))[0] || '';
    w.check(url.startsWith('archetype-compass.html?qbp='), `the tool was opened as ${JSON.stringify(url)}`);
    const carried = JSON.parse(Buffer.from(decodeURIComponent(url.split('?qbp=')[1] || ''), 'base64').toString('utf8') || '{}');
    w.check(carried.brandName === BRAND, 'the profile did not travel with the link');
  });

  await w.step('a free account: what is out of reach, and why', async () => {
    await show({ plan: null });
    await meter(0, 'Complete the foundation exercises and The Profiles to fill your Brand Document.', 'Visual DNA and War Table open with Starter.');
    for (const [id, tool, slug] of [['visual', 'Visual DNA', 'visual-dna'], ['strategy', 'War Table', 'war-table']]) {
      await see('opens with Starter. Complete it to populate this section.', { within: `#${id}-content` });
      await see('Upgrade to Starter', { within: `#${id}-content` });
      w.check((await p.locator(`#${id}-content button`).getAttribute('onclick')).includes(`/paywall?reason=upgrade&tool=${slug}`), `the ${tool} section does not lead to the plan page`);
      w.check(!/→/.test(await sectionText(id)), `${tool} is still offered as something to open`);
    }
    // The four a free account can do are still offered.
    for (const tool of ['Archetype Compass', 'Brand Soul Map', 'Sensescape', 'The Profiles']) await see(`Open ${tool} →`);
  });

  await w.step('a free account with its four done: the meter says what is missing', async () => {
    const four = Object.assign({}, FULL);
    for (const k of ['visualDnaCompletedAt', 'visualDnaKeepCount', 'visualDnaDiscardRate', 'visualDnaFastDiscards', 'visualDnaKeptImages', 'warTableCompletedAt', 'warTableBrief', 'warTableTopInitiatives']) delete four[k];
    await show({ qbp: four, plan: null });
    await meter(67, '4 of 6 sections complete.', 'Visual DNA and War Table open with Starter.');
    // One of the two done before the gate: the note names the other.
    await show({ qbp: Object.assign({}, four, { visualDnaCompletedAt: FULL.visualDnaCompletedAt, visualDnaKeepCount: 12, visualDnaDiscardRate: 40 }), plan: null });
    await meter(83, '5 of 6 sections complete.', 'War Table opens with Starter.');
  });

  await w.step('five tools done without Archetype Compass is not a full document', async () => {
    const noCompass = Object.assign({}, FULL);
    for (const k of Object.keys(noCompass)) if (k.startsWith('archetype') && k !== 'archetype') delete noCompass[k];
    await show({ qbp: noCompass });
    await meter(83, '5 of 6 sections complete.');
    await see('Open Archetype Compass →');
    await see('Pending', { within: '#compass-status' });
  });

  await w.step('everything done: the document, section by section', async () => {
    await show({ qbp: FULL, done: DONE });
    await meter(100, 'Every section is complete. Your Brand Document is ready to download.');
    w.check(await p.locator('.status-badge.status-done').count() === 6, 'not every tool section reads Complete');
    await see(BRAND, { painted: true, within: '#cover-brand' });
    // 01 Archetype Compass
    for (const [label, value] of [['Headline', FULL.archetypeHeadline], ['Primary Archetype', FULL.archetypePrimary], ['Tension Archetype', FULL.archetypeTension], ['The Fusion', FULL.archetypeFusion],
      ['Core Fear', FULL.archetypeCoreFear], ['Central Paradox', FULL.archetypeCentralParadox.statement], ['Decision Filter', FULL.archetypeDecisionFilter], ['First Move (this week)', FULL.archetypeFirstMove]]) {
      await see(label, { within: '#compass-content' });
      await see(value, { painted: true, within: '#compass-content' });
    }
    await see('Complete tone register in the tool to fill this field', { within: '#compass-content' });
    // 02 Brand Soul Map. Two values carry an English prefix the tool stored.
    for (const label of ['Brand Essence', 'The Spark', 'Manifesto Line', 'Anti-Brand', 'Always / Never', 'Primary Persona']) await see(label, { within: '#identity-content' });
    await see(FULL.brandEssence, { painted: true, within: '#identity-content' });
    await see('Always: bake before dawn | Never: sell day-old bread as fresh', { within: '#identity-content' });
    await see('We refuse to: sell day-old bread as fresh', { within: '#identity-content' });
    // 03 Sensescape
    for (const [label, value] of [['Color Territory', FULL.colorTerritory], ['Visual Territory', FULL.visualTerritoryNote], ['Typography Direction', FULL.typographyNote], ['Brand Object + Moment', FULL.exemplarWords]]) {
      await see(label, { within: '#sensory-content' });
      await see(value, { painted: true, within: '#sensory-content' });
    }
    // 04 Visual DNA: counts and notes. The document holds no image.
    await see('12 reference images selected');
    await see('40% · indicates visual selectivity');
    await see('Fast Discards · Your Visual Blocklist');
    await see('Images rejected in under 3 seconds. These define what the brand is NOT.');
    await see('Your Visual DNA Brief is complete. The kept images define your visual world. The fast discards define your visual blocklist.');
    w.check(await p.locator('#visual-content img').count() === 0, 'the Visual DNA section holds images its text no longer needs to explain');
    // 05 War Table
    await see(FULL.warTableBrief.challenge, { painted: true, within: '#strategy-content' });
    await see('Top Initiatives (by score)');
    w.check(await p.locator('#strategy-content .doc-tag').count() === 2, 'the two initiatives are not listed');
    await see('War Table complete. Your full 60-day field plan and Strategic Command Dossier are available in the War Table tool.');
    // 06 The Profiles
    await see('Persona 1 - Camille');
    await see('Persona 2');
    for (const label of ['Hook', 'Mindset', 'Pain points', 'Marketing approach', 'Key takeaways', 'Binding insight', 'Common themes across all three', 'Shared key takeaways']) await see(label, { within: '#personas-content' });
    await see(FULL.bindingInsight, { painted: true });
    // 07 Summary: six fields, not the whole profile.
    w.check(await p.locator('#summary-content .doc-field').count() === 6, 'the summary does not show six fields');
    await see(FULL.offer, { painted: true, within: '#summary-content' });
    w.check(!/→/.test(flat(await p.locator('#doc-preview').innerText())), 'a full document still offers a tool to open');
  });

  await w.step('tools done, no synthesis in the profile', async () => {
    await show({ qbp: { brandName: BRAND }, done: DONE });
    await meter(100, 'Every section is complete. Your Brand Document is ready to download.');
    for (const [id, tool] of [['compass', 'Archetype Compass'], ['identity', 'Brand Soul Map'], ['sensory', 'Sensescape'], ['visual', 'Visual DNA'], ['strategy', 'War Table'], ['personas', 'The Profiles']]) {
      await see("is recorded as complete, but the synthesis output isn't in your profile yet. Re-run to generate it.", { within: `#${id}-content` });
      await see(`Re-run ${tool} →`, { within: `#${id}-content` });
    }
    await (await find('Re-run Sensescape →')).click();
    w.check((await p.evaluate(() => window.__opened)).some(u => u.startsWith('sensescape.html')), 'Re-run did not open the tool');
  });

  await w.step('stored values with only one half', async () => {
    await show({ qbp: { brandName: BRAND, brandEssence: FULL.brandEssence, alwaysNever: 'Always: bake before dawn' } });
    await see('Always: bake before dawn', { within: '#identity-content' });
    await show({ qbp: { brandName: BRAND, brandEssence: FULL.brandEssence, alwaysNever: ' | Never: sell day-old bread as fresh' } });
    await see('| Never: sell day-old bread as fresh', { within: '#identity-content' });
  });

  await w.step('back', async () => {
    await show({ qbp: FULL, done: DONE });
    await p.evaluate(() => history.pushState({}, '', location.pathname + location.search + '#walk'));
    await (await find('← Back')).click();
    await p.waitForFunction(() => location.hash === '', null, { timeout: 4000 });
  });

  await w.step('the two decks', async () => {
    await p.evaluate(() => {
      window.__decks = [];
      window.QB_exportPPTX = (tool, data, opts) => new Promise(resolve => { window.__decks.push({ tool, brand: data.brandName, mode: opts.mode, filename: opts.filename, title: opts.deckTitle, release: resolve }); });
    });
    for (const [id, idle, mode, file] of [['dl-pptx-btn', '↓ Download PPTX', 'studio', BRAND + '-brand-document'], ['dl-marketing-btn', '↓ Marketing deck', 'editorial', BRAND + '-brand-document-marketing']]) {
      await p.locator('#' + id).click();
      await see('Generating…', { within: '#' + id });
      w.check(await p.locator('#' + id).isDisabled(), 'the deck button stays live while the deck is built');
      const deck = await p.evaluate(() => { const d = window.__decks[window.__decks.length - 1]; d.release(); return { tool: d.tool, brand: d.brand, mode: d.mode, filename: d.filename, title: d.title }; });
      w.check(deck.tool === 'brand-document' && deck.mode === mode && deck.filename === file && deck.title === 'Brand Document' && deck.brand === BRAND, `the deck was asked for as ${JSON.stringify(deck)}`);
      await see(idle, { within: '#' + id });
      w.check(!(await p.locator('#' + id).isDisabled()), 'the deck button stays disabled after the deck');
    }
    dialogs.length = 0;
    await p.evaluate(() => { window.QB_exportPPTX = undefined; });
    await p.locator('#dl-pptx-btn').click();
    w.check(dialogs.includes(await w.say('PPTX export still loading - try again in a second.')), 'no message when the deck exporter is not loaded');
    await p.evaluate(() => { window.QB_exportPPTX = () => Promise.reject(new Error('walk')); });
    await p.locator('#dl-marketing-btn').click();
    await see('↓ Marketing deck', { within: '#dl-marketing-btn' });
    w.check(dialogs.includes(await w.say('PPTX generation failed. See console for details.')), 'no message when the deck fails');
  });

  await w.step('the PDF', async () => {
    w.check(await p.evaluate(() => typeof window.html2pdf === 'function'), 'the PDF library did not load');
    await p.locator('#dl-btn').click();
    await p.waitForFunction(() => window.__pdf.length === 1, null, { timeout: 4000 });
    await see('↓ Download PDF', { within: '#dl-btn' });
    const job = (await p.evaluate(() => window.__pdf))[0];
    w.check(job.filename === 'maison-levain-brand-document.pdf', `the PDF is named ${job.filename}`);
    w.check(job.from === 'doc-preview' && job.flattened, 'the PDF is not taken from the document, flattened for the snapshot');
    w.check(flat(job.label) === await painted('Generating…') && job.disabled && job.aria === await w.say('Generating PDF, please wait'), 'the button does not say it is working while the PDF is made');
    w.check(!(await p.locator('#doc-preview').evaluate(el => el.classList.contains('pdf-render'))), 'the document stays in its snapshot state after the PDF');
    w.check(await p.locator('#dl-btn').getAttribute('aria-label') === await w.say('Download brand document as PDF') && !(await p.locator('#dl-btn').isDisabled()), 'the PDF button did not come back');
    // The library fails: say so, and give the button back.
    dialogs.length = 0;
    await p.evaluate(() => { window.__pdfFails = true; });
    await p.locator('#dl-btn').click();
    await p.waitForFunction(() => window.__pdf.length === 2, null, { timeout: 4000 });
    await see('↓ Download PDF', { within: '#dl-btn' });
    w.check(dialogs.includes(await w.say('PDF generation failed. Use Ctrl+P / Cmd+P to print as PDF instead.')), 'no message when the PDF fails');
    w.check(!(await p.locator('#dl-btn').isDisabled()), 'the PDF button stays disabled after a failure');
  });

  await w.step('paper: the document, on a light ground, without the page around it', async () => {
    await p.emulateMedia({ media: 'print' });
    for (const sel of ['.banner', '.nav-wrap', 'body > header', '.completion-meter', 'footer.footer', '.qb-lang']) {
      w.check(!(await p.locator(sel).first().isVisible()), `${sel} would print`);
    }
    w.check(await p.locator('#doc-preview').isVisible(), 'the document would not print');
    await see(BRAND, { painted: true, within: '#cover-brand' });
    const ground = await p.evaluate(() => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).backgroundColor); return m ? (+m[1] + +m[2] + +m[3]) / 3 : 255; });
    w.check(ground > 200, `the page would print on a dark ground (${Math.round(ground)})`);
    await p.emulateMedia({ media: 'screen' });
  });

  // ── Send by email ──
  // The button shows a result for three seconds, then its label again. The
  // walk shortens that wait to under one; the last step puts the real one back.
  const email = p.locator('#dl-email-btn');
  const label = () => email.textContent().then(flat);
  const sent = [];
  let answer = { status: 200, body: '{"ok":true}' };
  await w.mock('**/api/send-results', async route => {
    sent.push({ body: JSON.parse(route.request().postData() || '{}'), lang: route.request().headers()['x-qb-lang'] });
    if (answer === 'drop') return route.abort('failed');
    await route.fulfill({ status: answer.status, contentType: 'application/json', body: answer.body });
  });
  const signIn = withEmail => p.evaluate(e => {
    localStorage.setItem('qb_session', JSON.stringify(Object.assign({ token: 'walk', userId: '00000000-0000-4000-8000-000000000000' }, e ? { email: 'ines@maison-levain.example' } : {})));
    localStorage.setItem('qb_first_name', 'Ines');
  }, withEmail);
  const idle = async () => { await p.waitForFunction(() => !document.getElementById('dl-email-btn').disabled, null, { timeout: 5000 }); await see('✉ Send to inbox', { within: '#dl-email-btn' }); };
  w.note('ines@maison-levain.example'); w.note('Ines');

  await w.step('send by email: not signed in', async () => {
    await p.evaluate(() => { window.__setTimeout = window.setTimeout; window.setTimeout = (fn, ms, ...rest) => window.__setTimeout(fn, ms >= 3000 ? 900 : ms, ...rest); });
    await see('✉ Send to inbox', { within: '#dl-email-btn' });
    await email.click();
    await see('✗ Sign in to receive', { within: '#dl-email-btn' });
    await idle();
    w.check(sent.length === 0, 'an email went out for a visitor who is not signed in');
    // Signed in, but the session holds no address.
    await signIn(false);
    await email.click();
    await see('✗ Sign in to receive', { within: '#dl-email-btn' });
    await idle();
    w.check(sent.length === 0, 'an email went out with no address to send it to');
  });

  await w.step('send by email: signed in', async () => {
    await signIn(true);
    await email.click();
    await see('✓ Sent to inbox', { within: '#dl-email-btn' });
    w.check(sent.length === 1, `the document was sent ${sent.length} times`);
    const call = sent[0] || { body: {} };
    w.check(call.body.email === 'ines@maison-levain.example' && call.body.firstName === 'Ines' && call.body.toolId === 'brand-document', `the email was asked for as ${JSON.stringify({ email: call.body.email, firstName: call.body.firstName, toolId: call.body.toolId })}`);
    w.check(call.body.qbp && call.body.qbp.brandName === BRAND && call.body.qbp.brandEssence === FULL.brandEssence, 'the profile did not go with the email');
    w.check(call.lang === w.lang, `X-QB-Lang was ${call.lang}, expected ${w.lang}`);
    await idle();
  });

  await w.step('send by email: the server refuses, then the network drops', async () => {
    answer = { status: 500, body: '{"error":"Email delivery failed"}' };
    await email.click();
    await see('✗ Try again', { within: '#dl-email-btn' });
    await idle();
    answer = 'drop';
    await email.click();
    await see('✗ Try again', { within: '#dl-email-btn' });
    await idle();
    w.check(sent.length === 3, 'a retry did not reach the server');
  });

  await w.step('send by email: the label survives a language switch', async () => {
    await p.evaluate(() => { window.setTimeout = window.__setTimeout; });      // the real three seconds
    answer = { status: 200, body: '{"ok":true}' };
    await email.click();
    await see('✓ Sent to inbox', { within: '#dl-email-btn' });
    // Switch while the result is still showing. The label that comes back
    // has to be the one for the language now on screen.
    await p.locator(`.nav-actions .qb-lang_opt[data-lang-set="${other}"]`).click();
    await p.waitForFunction(l => document.documentElement.lang === l, other, { timeout: 4000 });
    w.check(await label() === await painted('✓ Sent to inbox'), `after the switch the result reads ${JSON.stringify(await label())}`);
    await p.waitForFunction(() => !document.getElementById('dl-email-btn').disabled, null, { timeout: 6000 });
    w.check(await label() === await painted('✉ Send to inbox'), `in ${other} the button came back as ${JSON.stringify(await label())}`);
    // And back: a label restored in one language must follow the next switch.
    await p.locator(`.nav-actions .qb-lang_opt[data-lang-set="${w.lang}"]`).click();
    await p.waitForFunction(l => document.documentElement.lang === l, w.lang, { timeout: 4000 });
    w.check(await label() === await painted('✉ Send to inbox'), `back in ${w.lang} the button reads ${JSON.stringify(await label())}`);
    await see('Every section is complete. Your Brand Document is ready to download.');
  });
}
