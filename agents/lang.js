// agents/lang.js
// One place that knows which languages BrandOS speaks and how a model is
// told to answer in one of them.
//
// The browser sends X-QB-Lang on same-origin /api/ calls (js/qb-i18n.js).
// Endpoints read it with langFromRequest. Agent runs carry it as
// runtime_args.lang, so a chained or regenerated run answers in the
// language of the run that started it.
//
// Prompts stay in English. The directive below is appended to the system
// prompt, which keeps one prompt per agent and one voice to maintain.

export const LANGS = ['en', 'fr'];
export const DEFAULT_LANG = 'en';

export function normalizeLang(value) {
  const v = String(value || '').trim().slice(0, 2).toLowerCase();
  return LANGS.includes(v) ? v : DEFAULT_LANG;
}

// Works with a Fetch Request (Edge) and with a Node request object.
export function langFromRequest(req) {
  const h = req && req.headers;
  if (!h) return DEFAULT_LANG;
  const get = name => (typeof h.get === 'function' ? h.get(name) : h[name]) || '';
  const header = get('x-qb-lang');
  if (header) return normalizeLang(header);
  const m = /(?:^|;\s*)qb_lang=(en|fr)\b/.exec(get('cookie'));
  return m ? m[1] : DEFAULT_LANG;
}

const DIRECTIVES = {
  fr: [
    'LANGUAGE OF THE OUTPUT.',
    'The reader is French-speaking. Write every piece of prose the reader will see in French, addressing the reader as "vous". This overrides any earlier instruction about the language of the output, and nothing else.',
    'Keep exactly as specified: JSON keys and field names, and every value the instructions restrict to a fixed list or format (ids, slugs, enum values, hex colours, dates, URLs, numbers).',
    'Return exactly as spelled, in English, every label the instructions spell out literally: verdicts, statuses, ratings, category names, section headings and line prefixes such as "POST 1:" or "Caption:". The interface matches them and shows them in French itself.',
    'Keep proper nouns as written: BrandOS, Quantum Branding, The Collapse, the movement names Observe, Collapse, Build and Hold, tool names, archetype names, and the founder\'s own brand, product and people names.',
    'Quote the founder\'s own words in the language they were written in.',
    'The voice rules above hold in French: short sentences, sentence case, no em dash, no exclamation points. Use the typographic apostrophe and French punctuation spacing.',
  ].join('\n'),
};

export function languageDirective(lang) {
  return DIRECTIVES[normalizeLang(lang)] || '';
}

// Returns the system prompt with the directive appended. English returns
// the prompt untouched, byte for byte.
export function withLanguage(system, lang) {
  const directive = languageDirective(lang);
  if (!directive) return system;
  return system ? `${system}\n\n${directive}` : directive;
}
