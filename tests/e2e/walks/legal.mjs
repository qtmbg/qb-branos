// The two legal pages. They state the offer exactly as it is sold and
// nothing else, their contents lists lead somewhere, the privacy policy
// names what the site keeps in the browser, and both say which provider
// reads a founder's work as the code has it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const page = 'terms.html';
export const title = 'terms and privacy: the offer as sold, no plan that is not, contents lead somewhere';
export const timeout = 60;

// A plan, a price or a promise that is not sold, in either language.
const NOT_SOLD = [
  /\$\s?(79|247|1[,.\s]?497)\b/, /\b(79|247|1[,.\s]?497)\s?\$/,
  /white-label/i, /marque blanche/i, /client workspaces/i, /espaces clients/i,
  /\bAgency plan\b/i, /\boffre Agence\b/i, /\bPro plan\b/i, /\boffre Pro\b/i, /lifetime deal/i,
  /\bPhase 0\d\b/i, /six phases/i,
];

// The six agents Starter opens. The provider behind each is read from the
// agent's own META, so the legal pages are held to what the product does
// and not to what an earlier plan intended. The pages once said "anything
// you pay for is processed by Anthropic" while all six ran on Gemini.
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const STARTER_AGENTS = ['sensescape', 'visual-dna', 'war-table', 'logo-direction', 'logo-evaluation', 'voice-guide'];
const starterOnGoogle = STARTER_AGENTS.filter(a => /^\s*model:\s*'gemini-/m.test(readFileSync(`${ROOT}agents/${a}.js`, 'utf8')));
// Who answers inside the tools: the one constant the tool route reads.
const toolsOnGoogle = /^export const TOOL_PROVIDER = 'google';/m.test(readFileSync(`${ROOT}api/_lib/tool-provider.js`, 'utf8'));

export async function walk(w) {
  const p = w.page;
  const origin = () => new URL(p.url()).origin;
  const text = () => p.evaluate(() => document.body.innerText);
  const visit = async file => {
    await p.goto(`${origin()}/${file}?lang=${w.lang}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => !!window.QBI18N, null, { timeout: 8000 });
    await p.waitForTimeout(500);
  };
  const contentsLead = async where => {
    const broken = await p.evaluate(() => [...document.querySelectorAll('a[href^="#"]')]
      .map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.getElementById(decodeURIComponent(h.slice(1)))));
    w.check(broken.length === 0, `${where}: these contents links lead nowhere: ${broken.join(', ')}`);
  };
  const nothingUnsold = async where => {
    const t = await text();
    for (const re of NOT_SOLD) { const m = re.exec(t); w.check(!m, `${where} mentions ${JSON.stringify(m && m[0])}, which is not sold`); }
  };
  // Owner decision, 15 November 2026: the legal pages list the providers and
  // no longer describe what each one does with a founder's work. Nothing
  // here asks them to say more. What they do say has to stay true to the
  // routing, which is read from the code above.
  const providersAsBuilt = async where => {
    const t = await text();
    const onGoogle = toolsOnGoogle || starterOnGoogle.length > 0;
    if (!onGoogle) {
      w.note(`${where}: nothing runs on Google any more. Reread the provider lines against api/_lib/tool-provider.js and agents/model-call.js.`);
      return;
    }
    const ran = starterOnGoogle.length ? `these Starter agents run on Gemini: ${starterOnGoogle.join(', ')}` : 'the tools run on Gemini';
    // A promise the routing does not keep.
    const promise = /Anything you pay for|Tout ce que vous payez|come from Anthropic|viennent d’Anthropic/i.exec(t);
    w.check(!promise, `${where} says ${JSON.stringify(promise && promise[0])}, but ${ran}`);
    // Google's free tier does use what it is sent, so no page may say the
    // providers keep a founder's work out of training.
    const kept = /not retained for training|pas conservées à des fins d’entraînement|never used (for|to) train|jamais utilisées pour entraîner/i.exec(t);
    w.check(!kept, `${where} says ${JSON.stringify(kept && kept[0])}, which is not true of the provider that answers (${ran})`);
    // The list of processors is the one place the provider must be named.
    if (where === 'privacy') w.check(/Gemini/.test(t) && /Google/.test(t), `the privacy policy does not list Google among the processors, but ${ran}`);
  };
  // The runner reads untranslated text off the last page only. The first
  // page is read here, before the walk leaves it.
  const translated = async where => {
    const misses = await p.evaluate(() => (window.QBI18N.lang !== window.QBI18N.source ? window.QBI18N.misses() : []));
    w.check(misses.length === 0, `${where}: ${misses.length} line(s) with no French, first: ${JSON.stringify(misses[0] && misses[0].text)}`);
  };

  await w.step('terms: the offer as sold', async () => {
    await w.open();
    const t = await text();
    w.check(/\$\s?97|97\s?\$/.test(t), 'the terms do not state the price of Starter');
    w.check(/14/.test(t), 'the terms do not state the 14-day refund');
    w.check(/Archetype Compass/.test(t) && /Brand Soul Map/.test(t) && /Sensescape/.test(t), 'the terms do not name the three free exercises');
    w.check(/BrandOS/.test(t) && !/QB BrandOS|BRANDOS|Brand OS/.test(t), 'the terms use a second name for the product');
    await nothingUnsold('terms');
    await providersAsBuilt('terms');
    await contentsLead('terms');
    await translated('terms');
  });

  await w.step('privacy: what is kept in the browser, and the date', async () => {
    await visit('privacy.html');
    const t = await text();
    for (const key of ['qb_session', 'qb_qbp', 'qb_lang']) w.check(t.includes(key), `the privacy policy does not name ${key}`);
    // The eyebrow is painted in capitals, so the case is not compared.
    w.check(/15 (november|novembre) 2026/i.test(t), 'the privacy policy does not carry the date of its last change');
    w.check(/BrandOS/.test(t) && !/QB BrandOS|BRANDOS|Brand OS/.test(t), 'the privacy policy uses a second name for the product');
    await nothingUnsold('privacy');
    await providersAsBuilt('privacy');
    await translated('privacy');
    await contentsLead('privacy');
  });
}
