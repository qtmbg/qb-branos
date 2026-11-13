/* BrandOS · end-to-end walks, shared helper
 *
 * A walk drives one page the way a founder would: open it, answer, submit,
 * read the result, export. It is written once, in the language the page is
 * written in (English, or French for mri.html), and run in both languages.
 * In the other language the helper translates what the walk looks for, so
 * `await w.see('Your results')` waits for « Vos résultats ».
 *
 * A walk file exports:
 *   export const page = 'signal-scan.html';
 *   export const title = 'eight questions, lead form, report';
 *   export const session = false;          // true for account pages
 *   export const switchesLanguage = false; // true if the walk uses the switch
 *   export async function walk(w) { ... }
 *
 * What `w` offers:
 *   w.page, w.lang                 the Playwright page and 'en' | 'fr'
 *   await w.open(query)            go to the page (?lang= is added)
 *   await w.say(english)           the string as painted in this language
 *   await w.see(english, opts)     wait until that text is visible
 *                                  ({ painted: true } when the text is given
 *                                  as painted, not as written in English)
 *   await w.gone(english)          wait until that text is not visible
 *   await w.click(english, opts)   click the element showing that text
 *   await w.fill(selector, text)   type into a field; the text is remembered
 *                                  as the founder's own, never a "miss"
 *   w.mockModel(answer)            answer every model call (/api/claude,
 *                                  /api/gemini, api.anthropic.com) with this
 *                                  object or function(body) -> object
 *   w.mock(pattern, handler)       any other route, Playwright style
 *   w.note(text)                   mark text that is data, not copy
 *   await w.step(name, fn)         name a stretch, so a failure says where
 *   w.check(cond, message)         record a failure without stopping
 *
 * The runner then fails the walk when:
 *   · the page threw an uncaught error
 *   · a step threw or timed out, or a check was false
 *   · French: text was painted with no dictionary entry, other than what
 *     the founder typed or the model answered
 *   · English: a dictionary loaded, or <html lang> is not "en"
 */
const norm = s => String(s).replace(/\s+/g, ' ').trim();

function leaves(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach(v => leaves(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach(v => leaves(v, out));
  return out;
}

export async function runWalk(mod, lang, { browser, port, shotsDir }) {
  const failures = [];
  const notes = [];
  const foreign = new Set();
  const remember = text => { for (const part of String(text).split('\n')) { const n = norm(part); if (n.length >= 3) foreign.add(n); } };
  const ctx = await browser.newContext({ viewport: { width: mod.width || 1280, height: 900 }, locale: 'en-US' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await ctx.addInitScript(session => {
    window.__QB_I18N_AUDIT = true;
    try {
      localStorage.setItem('qb_user_tier', 'agency'); localStorage.setItem('qb_sub_status', 'active');
      if (session) localStorage.setItem('qb_session', JSON.stringify({ token: 'walk', userId: '00000000-0000-4000-8000-000000000000' }));
    } catch (e) {}
  }, !!mod.session);
  // Nothing a walk does may reach a real backend. Unmocked API calls get an
  // empty answer; a walk overrides what it needs.
  await ctx.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route(/supabase\.co/, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await ctx.route(/api\.anthropic\.com|api\.resend\.com|api\.stripe\.com|a\.klaviyo\.com|api\.bufferapp\.com/, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

  const page = await ctx.newPage();
  const dictRequests = [];
  page.on('request', r => { if (/\/js\/i18n\//.test(r.url())) dictRequests.push(r.url()); });
  page.on('pageerror', e => failures.push(`uncaught error: ${String(e.message).split('\n')[0]}`));
  page.on('console', m => { if (m.type() === 'error') notes.push(`console: ${m.text().split('\n')[0].slice(0, 200)}`); });
  page.on('dialog', async d => { notes.push(`dialog: ${d.message().slice(0, 160)}`); await d.accept().catch(() => {}); });

  let current = 'start';
  const w = {
    page, lang,
    async open(query = '') {
      const q = query ? (query.startsWith('?') ? query.slice(1) + '&' : query + '&') : '';
      await page.goto(`http://localhost:${port}/${mod.page}?${q}lang=${lang}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!window.QBI18N, null, { timeout: 15000 });
      await page.waitForTimeout(mod.settle ?? 800);
    },
    // A walk is written in the language its page is written in: English
    // everywhere, French for mri.html. In that language the text is used as
    // is; in the other one it goes through the dictionary.
    async say(written) { return page.evaluate(s => (window.QBI18N && window.QBI18N.lang !== window.QBI18N.source ? window.QBI18N.t(s) : s), written); },
    async locate(english, opts = {}) {
      const text = norm(opts.painted ? english : await w.say(english));
      const scope = opts.within ? page.locator(opts.within) : page;
      const exact = opts.exact !== false;
      if (opts.role) return scope.getByRole(opts.role, { name: text, exact }).filter({ visible: true }).first();
      // Matched on text nodes, the way the dictionary is keyed: "Idea in,"
      // is its own node inside a heading that also holds an <em>.
      const lit = text.includes("'") ? `concat('${text.split("'").join(`', "'", '`)}')` : `'${text}'`;
      const test = exact ? `normalize-space(.)=${lit}` : `contains(normalize-space(.), ${lit})`;
      return scope.locator(`xpath=.//*[text()[${test}]]`).filter({ visible: true }).first();
    },
    async see(english, opts = {}) { await (await w.locate(english, opts)).waitFor({ state: 'visible', timeout: opts.timeout ?? 8000 }); },
    async gone(english, opts = {}) {
      const text = await w.say(english);
      await page.waitForFunction(t => ![...document.querySelectorAll('body *')].some(el => !el.children.length && el.offsetParent !== null && (el.innerText || '').trim() === t), text, { timeout: opts.timeout ?? 8000 });
    },
    async click(english, opts = {}) { await (await w.locate(english, opts)).click({ timeout: opts.timeout ?? 8000 }); await page.waitForTimeout(opts.wait ?? 250); },
    async fill(selector, text) { remember(text); const loc = typeof selector === 'string' ? page.locator(selector).first() : selector; await loc.fill(text); },
    note: remember,
    mock(pattern, handler) { return ctx.route(pattern, handler); },
    async mockModel(answer) {
      const reply = async route => {
        let body = {};
        try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
        const out = typeof answer === 'function' ? await answer(body, route) : answer;
        leaves(out).forEach(remember);
        const text = typeof out === 'string' ? out : JSON.stringify(out);
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 'walk', type: 'message', role: 'assistant', model: 'walk', stop_reason: 'end_turn',
            content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } }) });
      };
      await ctx.route('**/api/claude', reply);
      await ctx.route('**/api/gemini', reply);
      await ctx.route(/api\.anthropic\.com/, reply);
    },
    async step(name, fn) {
      current = name;
      try { await fn(); }
      catch (e) {
        failures.push(`step "${name}": ${String(e.message).split('\n')[0].slice(0, 220)}`);
        if (shotsDir) await page.screenshot({ path: `${shotsDir}/${mod.page.replace(/[^a-z0-9]+/gi, '-')}.${lang}.${name.replace(/[^a-z0-9]+/gi, '-')}.png` }).catch(() => {});
        throw e;
      }
    },
    check(cond, message) { if (!cond) failures.push(`check failed in "${current}": ${message}`); },
  };

  try { await mod.walk(w); }
  catch (e) { if (!failures.some(f => f.startsWith('step "'))) failures.push(`walk stopped in "${current}": ${String(e.message).split('\n')[0].slice(0, 220)}`); }

  const state = await page.evaluate(() => ({
    htmlLang: document.documentElement.getAttribute('lang'),
    source: window.QBI18N ? window.QBI18N.source : null,
    misses: window.QBI18N ? window.QBI18N.misses() : [],
  })).catch(() => ({ htmlLang: null, source: null, misses: [] }));

  if (state.htmlLang !== lang) failures.push(`<html lang> is ${JSON.stringify(state.htmlLang)}, expected "${lang}"`);
  if (state.source && lang === state.source && dictRequests.length && !mod.switchesLanguage) failures.push(`the page loaded a dictionary in its own language: ${dictRequests[0]}`);
  if (state.source && lang !== state.source) {
    const mine = [...foreign];
    for (const m of state.misses) {
      const text = norm(m.text);
      const isForeign = mine.some(f => text.includes(f) || (text.length >= 3 && f.includes(text)));
      if (!isForeign) failures.push(`untranslated: ${JSON.stringify(text.slice(0, 160))}  at  ${m.at}`);
    }
  }
  await ctx.close();
  return { failures, notes };
}
