/* BrandOS · server language test
 *
 * The browser sends X-QB-Lang. This checks that the server honours it in
 * every place a founder reads the result:
 *
 *   1. agents/lang.js reads the header, then the cookie, and falls back to English
 *   2. English prompts reach the model byte-identical; French gets one directive
 *   3. every agent module hands its run language to the model call
 *   4. /api/claude appends the directive from the header
 *   5. French emails: every replacement pair still matches its English
 *      template, no English sentence survives, every agent has French copy
 *
 * No network. fetch is replaced for the duration of the run.
 * Usage: node tests/i18n/server-lang.mjs
 * Exit:  0 pass · 1 fail
 */
import fs from 'node:fs';
import path from 'node:path';

const fails = [];
const ok = (cond, label, detail = '') => { if (!cond) fails.push(detail ? `${label}: ${detail}` : label); };

const { normalizeLang, langFromRequest, withLanguage, languageDirective } = await import('../../agents/lang.js');

// 1. Reading the language.
ok(normalizeLang('fr') === 'fr' && normalizeLang('FR-CA') === 'fr', 'normalizeLang accepts fr and fr-CA');
ok(normalizeLang('de') === 'en' && normalizeLang('') === 'en' && normalizeLang(undefined) === 'en', 'normalizeLang falls back to en');
const reqWith = h => new Request('https://x.test/api/claude', { method: 'POST', headers: h });
ok(langFromRequest(reqWith({ 'x-qb-lang': 'fr' })) === 'fr', 'header fr is read');
ok(langFromRequest(reqWith({ cookie: 'a=1; qb_lang=fr; b=2' })) === 'fr', 'cookie fr is read');
ok(langFromRequest(reqWith({ 'x-qb-lang': 'en', cookie: 'qb_lang=fr' })) === 'en', 'header wins over cookie');
ok(langFromRequest(reqWith({})) === 'en', 'no signal means en');
ok(langFromRequest({ headers: { 'x-qb-lang': 'fr' } }) === 'fr', 'node-style headers are read');

// 2. The directive.
const PROMPT = 'You are the Voice Guide Agent.\nReturn only the JSON object.';
ok(withLanguage(PROMPT, 'en') === PROMPT, 'English prompt is byte-identical');
ok(withLanguage(PROMPT, undefined) === PROMPT, 'missing lang leaves the prompt alone');
const frPrompt = withLanguage(PROMPT, 'fr');
ok(frPrompt.startsWith(PROMPT) && frPrompt.length > PROMPT.length, 'French appends to the prompt');
ok(/French/.test(frPrompt) && /"vous"/.test(frPrompt), 'directive asks for French and vous');
ok(/JSON keys/.test(frPrompt), 'directive protects JSON keys');
ok(languageDirective('en') === '', 'no directive for English');

// The browser carries its own copy of the directive, for the tools that
// call the model without a server in between. Both must say the same thing.
{
  const src = fs.readFileSync(path.join(process.cwd(), 'js/qb-i18n.js'), 'utf8');
  const m = /var DIRECTIVE = \{\s*fr: \[([\s\S]*?)\]\.join\('\\n'\)/.exec(src);
  ok(!!m, 'browser directive found in js/qb-i18n.js');
  if (m) {
    const browser = Function(`return [${m[1]}].join('\\n')`)();
    ok(browser === languageDirective('fr'), 'browser directive equals the server directive',
      browser === languageDirective('fr') ? '' : 'js/qb-i18n.js and agents/lang.js differ');
  }
}

// 3. Agents hand the language on.
const agentDir = path.join(process.cwd(), 'agents');
const callers = fs.readdirSync(agentDir).filter(f => f.endsWith('.js') && f !== 'model-call.js')
  .filter(f => /callModel\(/.test(fs.readFileSync(path.join(agentDir, f), 'utf8')));
ok(callers.length > 0, 'found agent modules that call the model');
for (const f of callers) {
  const src = fs.readFileSync(path.join(agentDir, f), 'utf8');
  const calls = src.match(/callModel\(\{[^\n]*/g) || [];
  for (const c of calls) ok(/lang:\s*runtime_args\?\.lang/.test(c), `agents/${f} passes lang to callModel`, c);
}

// callModel itself: capture what would be sent upstream.
const realFetch = globalThis.fetch;
let sent = null;
globalThis.fetch = async (_url, init) => {
  sent = JSON.parse(init.body);
  return new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 });
};
const { callModel } = await import('../../agents/model-call.js');
await callModel({ model: 'claude-sonnet-4-6', system: PROMPT, userContent: 'hi', apiKey: 'k' });
ok(sent && sent.system === PROMPT, 'callModel without lang sends the prompt untouched', JSON.stringify(sent && sent.system));
await callModel({ model: 'claude-sonnet-4-6', system: PROMPT, userContent: 'hi', apiKey: 'k', lang: 'fr' });
ok(sent && sent.system === frPrompt, 'callModel with lang fr sends the directive');
await callModel({ model: 'gemini-3.5-flash', system: PROMPT, userContent: 'hi', geminiKey: 'g', lang: 'fr' }).catch(() => {});
ok(sent && sent.systemInstruction && sent.systemInstruction.parts[0].text === frPrompt, 'Google path carries the directive too');

// 4. /api/claude.
process.env.ANTHROPIC_API_KEY = 'test-key';
const claude = (await import('../../api/claude.js')).default;
const post = headers => new Request('https://x.test/api/claude', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({ system: PROMPT, messages: [{ role: 'user', content: 'hi' }] }),
});
await claude(post({}));
ok(sent.system === PROMPT, '/api/claude in English passes the system prompt through');
await claude(post({ 'X-QB-Lang': 'fr' }));
ok(sent.system === frPrompt, '/api/claude in French appends the directive');
globalThis.fetch = realFetch;

// 5. Emails.
const email = await import('../../api/_lib/email.js');
const en = email.emailTemplates('en'), fr = email.emailTemplates('fr');
ok(en === email.EMAIL_TEMPLATES, 'English templates are the originals');
for (const name of Object.keys(email.FR_PAIRS)) {
  for (const [from, to] of email.FR_PAIRS[name]) {
    const inSource = en[name].html.includes(from) || en[name].text.includes(from);
    ok(inSource, `email ${name}: pair no longer matches the English template`, JSON.stringify(from));
    if (!to.includes(from)) {
      ok(!fr[name].html.includes(from) && !fr[name].text.includes(from), `email ${name}: English survives in French`, JSON.stringify(from));
    }
  }
}
for (const slug of Object.keys(email.AGENT_EMAIL_VARS)) {
  const v = email.getAgentEmailVars(slug, 'fr');
  ok(v && v.ready_line && v.cta_line && v.paragraph_one && v.preheader && v.agent_eyebrow, `email vars in French for ${slug}`);
  const rendered = email.renderTemplate(fr.ARTIFACT_READY.html, { ...v, greeting: email.greetingFor('fr', ''), artifact_url: 'https://x' });
  ok(!/\{\{\w+\}\}/.test(rendered), `French artifact email renders with no empty slot for ${slug}`);
  ok(!/Your |is ready|Read your|Hi /.test(rendered.replace(/<style[\s\S]*?<\/style>/, '')), `no English sentence in the French artifact email for ${slug}`);
}
const results = await import('../../api/_lib/results-email-fr.js');
const resultsSrc = fs.readFileSync(path.join(process.cwd(), 'api/send-results.js'), 'utf8');
for (const [from] of results.RESULTS_FR_PAIRS) {
  // The pairs are stored with real newlines; the source has them as written.
  ok(resultsSrc.includes(from), 'results email: pair no longer matches api/send-results.js', JSON.stringify(from));
}
ok(/form\.set\('locale', 'fr'\)/.test(fs.readFileSync(path.join(process.cwd(), 'api/stripe/checkout.js'), 'utf8')), 'checkout sets the French locale');

if (fails.length) { console.log(fails.map(f => 'FAIL · ' + f).join('\n')); console.log(`\nserver language test FAILED · ${fails.length} failure(s)`); process.exit(1); }
console.log('server language test passed');
