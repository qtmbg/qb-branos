// Brand MRI · shared server helpers.
// Pure ESM, Edge-runtime safe. Used by api/mri-lead.js, api/mri-verify.js,
// api/mri-event.js, api/cron/mri-digest.js and the MRI branch of
// api/stripe-webhook.js.
//
// Three rules hold everywhere in this file:
//   1. A paid tier is a fact about a Stripe Checkout Session, never about a
//      URL parameter. tierFromSession() reads the brand_mri_tier metadata
//      the payment links carry, and only a session Stripe reports as paid
//      counts.
//   2. Scores are recomputed here from the ten answers. Nothing the browser
//      says about a score reaches an email or the ledger unchecked.
//   3. The ledger (public.mri_events, migration 025) is optional. Every
//      helper reports a missing table and carries on, because migrations in
//      this repo are not always applied to production.

export const PRACTICE_INBOX = 'me@qtmbg.com';
export const MRI_FROM = 'Brand MRI <auth@quantumbranding.ai>';
export const SITE = 'https://quantumbranding.ai';

const ALLOWED_ORIGINS = new Set([
  'https://quantumbranding.ai',
  'https://www.quantumbranding.ai',
  'https://app.quantumbranding.ai',
  'https://qb-branos.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
// Preview deployments of this project, so a branch can be tested end to end.
const PREVIEW_ORIGIN = /^https:\/\/qb-branos-[a-z0-9-]+\.vercel\.app$/;

export function requestOrigin(req) {
  const origin = req.headers.get('origin');
  if (origin) return origin;
  const referer = req.headers.get('referer');
  if (referer) {
    try { return new URL(referer).origin; } catch { /* fall through */ }
  }
  return '';
}

export function originAllowed(req) {
  const origin = requestOrigin(req);
  return ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN.test(origin);
}

export function corsHeaders(req) {
  const origin = requestOrigin(req);
  const allowed = originAllowed(req) ? origin : SITE;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
}

export function mriEnv() {
  return {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/* ── Input hygiene ─────────────────────────────────────────── */

export function clean(v, max) {
  return (v == null ? '' : String(v)).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

export function isEmail(s) {
  return typeof s === 'string' && s.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function pickLang(v) {
  return String(v || '').toLowerCase().slice(0, 2) === 'fr' ? 'fr' : 'en';
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ── The diagnostic, server side ───────────────────────────── */

// Same five pillars and the same arithmetic as js/mri.js. The harness in
// tests/mri/mri.mjs runs both on the same answers and fails on any drift.
export const PILLARS = [
  { id: 'phrase',          questions: [0, 1], en: 'The sentence',    fr: 'La phrase',
    shortEn: 'positioning in one sentence',     shortFr: 'le positionnement en une phrase' },
  { id: 'logo',            questions: [2, 3], en: 'The logo test',   fr: 'Le test du logo',
    shortEn: 'recognizable without the logo',   shortFr: 'reconnaissable sans logo' },
  { id: 'coherence',       questions: [4, 5], en: 'Coherence',       fr: 'Cohérence',
    shortEn: 'the same promise everywhere',     shortFr: 'la même promesse partout' },
  { id: 'differentiation', questions: [6, 7], en: 'Differentiation', fr: 'Différenciation',
    shortEn: 'what competitors cannot say',     shortFr: 'ce que les concurrents ne peuvent pas dire' },
  { id: 'preuve',          questions: [8, 9], en: 'Proof',           fr: 'Preuve',
    shortEn: 'what proves the promise',         shortFr: 'ce qui prouve la promesse' },
];

const VALID_ANSWERS = new Set([0, 3, 7, 10]);

export function sanitizeAnswers(a) {
  if (!Array.isArray(a) || a.length !== 10) return null;
  const out = a.map(Number);
  return out.every(n => VALID_ANSWERS.has(n)) ? out : null;
}

export function scoreAnswers(answers) {
  const clean10 = sanitizeAnswers(answers);
  if (!clean10) return null;
  const pillars = PILLARS.map(p => {
    const raw = Math.round((clean10[p.questions[0]] + clean10[p.questions[1]]) / 2 * 10) / 10;
    return { id: p.id, score: Math.round(raw * 10) };
  });
  const global = Math.round(pillars.reduce((s, p) => s + p.score, 0) / pillars.length);
  const sorted = pillars.slice().sort((a, b) => a.score - b.score);
  return { global, pillars, brake: sorted[0].id, strongest: sorted[sorted.length - 1].id };
}

export function pillarName(id, lang) {
  const p = PILLARS.find(x => x.id === id);
  return p ? p[pickLang(lang)] : '';
}

function pillarShort(id, lang) {
  const p = PILLARS.find(x => x.id === id);
  if (!p) return '';
  return pickLang(lang) === 'fr' ? p.shortFr : p.shortEn;
}

/* ── Tiers ─────────────────────────────────────────────────── */

export const TIER_RANK = { free: 0, flash: 1, full: 2, review: 3 };

// brand_mri_tier metadata on the six live payment links → the tier it opens.
const STRIPE_TIER = {
  flash: 'flash',
  full: 'full',
  upgrade60: 'full',
  review211: 'review',
  reviewFull: 'review',
  retest39: 'retest',
};

export function tierFromSession(session) {
  const key = session && session.metadata && session.metadata.brand_mri_tier;
  // Own keys only: "constructor" is a property of every object and names no tier.
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(STRIPE_TIER, key) ? STRIPE_TIER[key] : null;
}

const TIER_LABEL = {
  flash:  { en: 'MRI Flash',                   fr: 'MRI Flash' },
  full:   { en: 'full report',                 fr: 'rapport complet' },
  review: { en: 'report with video review',    fr: 'rapport avec review vidéo' },
  retest: { en: '90-day re-test',              fr: 're-test 90 jours' },
};

export function tierLabel(tier, lang) {
  const t = TIER_LABEL[tier];
  return t ? t[pickLang(lang)] : String(tier || '');
}

/* ── Stripe ────────────────────────────────────────────────── */

export function isSessionId(s) {
  return typeof s === 'string' && s.length <= 200 && /^cs_(live|test)_[A-Za-z0-9]+$/.test(s);
}

// Fails closed in every direction: a session opens a tier only when Stripe
// answers, says it is paid, and it carries MRI metadata.
export async function verifyPaidSession(env, id) {
  if (!isSessionId(id)) return { ok: false, reason: 'bad_session_id' };
  if (!env.STRIPE_SECRET_KEY) return { ok: false, reason: 'not_configured' };
  let res;
  try {
    res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
  } catch {
    return { ok: false, reason: 'stripe_unavailable' };
  }
  if (res.status === 404) return { ok: false, reason: 'not_found' };
  if (res.status === 401 || res.status === 403) return { ok: false, reason: 'stripe_forbidden' };
  if (!res.ok) return { ok: false, reason: 'stripe_unavailable' };
  let session;
  try { session = await res.json(); } catch { return { ok: false, reason: 'stripe_unavailable' }; }
  if (!session || session.id !== id) return { ok: false, reason: 'stripe_unavailable' };
  if (session.payment_status !== 'paid') return { ok: false, reason: 'unpaid' };
  const tier = tierFromSession(session);
  if (!tier) return { ok: false, reason: 'not_mri' };
  return { ok: true, tier, session };
}

// The id a browser draws for itself and sends to Stripe as
// client_reference_id. Eighty random bits: it cannot be guessed. The range
// leaves room for the longer id a browser without crypto falls back to.
export function isVisitorId(s) {
  return typeof s === 'string' && /^v_[0-9a-f]{12,48}$/.test(s);
}

// How far back a lookup reads, and how many pages of a hundred it turns.
export const LOOKUP_WINDOW_SECONDS = 3 * 86400;
const LOOKUP_PAGES = 3;

// The payment links return a buyer to /mri?paid=<tier> with no session id.
// The page still knows who it is: it sent its visitor id to Stripe with the
// payment. This lists recent completed sessions and keeps the ones that
// carry that id, are paid, and are Brand MRI. Same rule as above: Stripe
// answers or nothing opens.
export async function findPaidSessions(env, visitorId) {
  if (!isVisitorId(visitorId)) return { ok: false, reason: 'bad_visitor_id' };
  if (!env.STRIPE_SECRET_KEY) return { ok: false, reason: 'not_configured' };
  const since = Math.floor(Date.now() / 1000) - LOOKUP_WINDOW_SECONDS;
  const sessions = [];
  let after = '';
  for (let page = 0; page < LOOKUP_PAGES; page++) {
    const url = 'https://api.stripe.com/v1/checkout/sessions?limit=100&status=complete'
      + `&created%5Bgte%5D=${since}` + (after ? `&starting_after=${encodeURIComponent(after)}` : '');
    let res;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
    } catch {
      return { ok: false, reason: 'stripe_unavailable' };
    }
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'stripe_forbidden' };
    if (!res.ok) return { ok: false, reason: 'stripe_unavailable' };
    let body;
    try { body = await res.json(); } catch { return { ok: false, reason: 'stripe_unavailable' }; }
    const rows = body && Array.isArray(body.data) ? body.data : null;
    if (!rows) return { ok: false, reason: 'stripe_unavailable' };
    for (const s of rows) {
      if (!s || s.client_reference_id !== visitorId || s.payment_status !== 'paid' || !isSessionId(s.id)) continue;
      const tier = tierFromSession(s);
      if (tier) sessions.push({ tier, session: s });
    }
    if (!body.has_more || !rows.length) break;
    after = rows[rows.length - 1].id;
  }
  return { ok: true, sessions };
}

/* ── Ledger (public.mri_events) ────────────────────────────── */

function ledgerConfig(env) {
  return env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY }
    : null;
}

export async function ledgerInsert(env, row) {
  const c = ledgerConfig(env);
  if (!c) return { ok: false, reason: 'not_configured' };
  try {
    const r = await fetch(`${c.url}/rest/v1/mri_events`, {
      method: 'POST',
      headers: {
        apikey: c.key,
        Authorization: `Bearer ${c.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (r.ok) return { ok: true };
    // The unique index on paid sessions turns a Stripe retry, or the
    // webhook and the return page racing each other, into a no-op.
    if (r.status === 409) return { ok: true, duplicate: true };
    if (r.status === 404) return { ok: false, reason: 'table_missing' };
    return { ok: false, reason: `insert_failed_${r.status}` };
  } catch {
    return { ok: false, reason: 'insert_threw' };
  }
}

export async function ledgerSelect(env, query) {
  const c = ledgerConfig(env);
  if (!c) return { ok: false, reason: 'not_configured', rows: [] };
  try {
    const r = await fetch(`${c.url}/rest/v1/mri_events?${query}`, {
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, Accept: 'application/json' },
    });
    if (r.status === 404) return { ok: false, reason: 'table_missing', rows: [] };
    if (!r.ok) return { ok: false, reason: `select_failed_${r.status}`, rows: [] };
    const rows = await r.json().catch(() => null);
    if (!Array.isArray(rows)) return { ok: false, reason: 'select_unparseable', rows: [] };
    return { ok: true, rows };
  } catch {
    return { ok: false, reason: 'select_threw', rows: [] };
  }
}

// Every row a query matches, page after page. The API returns at most a
// thousand rows a request whatever limit is asked, so a count read in one
// request goes quietly wrong the week traffic picks up. The query must not
// carry its own limit or offset, and must carry an order.
// truncated: true means the last page allowed was still full. The caller
// has to say so wherever the count is shown.
export const LEDGER_PAGE = 1000;
export const LEDGER_MAX_PAGES = 50;
export async function ledgerSelectAll(env, query) {
  const rows = [];
  for (let page = 0; page < LEDGER_MAX_PAGES; page++) {
    const part = await ledgerSelect(env, `${query}&limit=${LEDGER_PAGE}&offset=${page * LEDGER_PAGE}`);
    if (!part.ok) return { ok: false, reason: part.reason, rows: [], truncated: false };
    for (const r of part.rows) rows.push(r);
    if (part.rows.length < LEDGER_PAGE) return { ok: true, rows, truncated: false };
  }
  return { ok: true, rows, truncated: true };
}

// The last completed diagnostic for a visitor, falling back to their email.
export async function latestCompletion(env, { visitorId, email }) {
  const cols = 'select=created_at,lang,email,brand,website,score,brake,data&event=eq.completed&order=created_at.desc&limit=1';
  if (visitorId) {
    const byVisitor = await ledgerSelect(env, `${cols}&visitor_id=eq.${encodeURIComponent(visitorId)}`);
    if (byVisitor.ok && byVisitor.rows[0]) return byVisitor.rows[0];
  }
  if (email) {
    const byEmail = await ledgerSelect(env, `${cols}&email=eq.${encodeURIComponent(email)}`);
    if (byEmail.ok && byEmail.rows[0]) return byEmail.rows[0];
  }
  return null;
}

/* ── Email ─────────────────────────────────────────────────── */

// idempotencyKey: Resend sends one email per key per 24 hours. A second
// request with the same key and the same body returns the first email's id
// and sends nothing. With a different body it answers 409, reported here as
// { ok: false, status: 409 }.
export async function sendMail(env, { to, subject, text, html, replyTo, refId, idempotencyKey }) {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'not_configured' };
  if (!to || !subject) return { ok: false, error: 'to and subject required' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: MRI_FROM,
        to: [to],
        reply_to: replyTo || PRACTICE_INBOX,
        subject,
        text,
        ...(html ? { html } : {}),
        headers: { 'X-Entity-Ref-ID': refId || 'qb-brand-mri' },
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      // Sliced for the log line only. Nothing is compared against it.
      return { ok: false, status: res.status, error: errText.slice(0, 300) };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, id: (data && data.id) || null };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'send threw' };
  }
}

function shell({ lang, eyebrow, title, paragraphs, ctaUrl, ctaLabel }) {
  const e = escapeHtml;
  const body = paragraphs.map(p => `<p style="margin:0 0 16px;">${p}</p>`).join('\n        ');
  const cta = ctaUrl
    ? `<p style="margin:8px 0 28px;"><a href="${e(ctaUrl)}" style="display:inline-block;padding:14px 26px;background:#E0B069;color:#2D1521;text-decoration:none;font-weight:600;border-radius:999px;border:2px solid #2D1521;box-shadow:0 6px 0 #2D1521;font-family:'Inter','Helvetica Neue',Arial,sans-serif;letter-spacing:0.04em;font-size:14px;">${e(ctaLabel)} &rarr;</a></p>`
    : '';
  return `<!DOCTYPE html>
<html lang="${e(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${e(title)}</title>
</head>
<body style="margin:0;padding:0;background:#FBF5E6;color:#2D1521;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FBF5E6;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#F2EBD3;border:2px solid #2D1521;border-radius:24px;">
      <tr><td style="padding:36px 36px 8px;">
        <p style="font-family:'Courier New',Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#2D1521;margin:0 0 14px;font-weight:700;">${e(eyebrow)}</p>
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:30px;line-height:1.1;color:#2D1521;margin:0 0 24px;letter-spacing:-0.01em;">${e(title)}</h1>
      </td></tr>
      <tr><td style="padding:0 36px 28px;font-size:16px;line-height:1.6;color:#2D1521;">
        ${body}
        ${cta}
      </td></tr>
      <tr><td style="padding:18px 36px 28px;border-top:1px solid rgba(45,21,33,0.10);font-family:'Courier New',Menlo,monospace;font-size:11px;letter-spacing:0.10em;color:rgba(45,21,33,0.55);">
        Quantum Branding &middot; quantumbranding.ai/mri
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/* The score, sent to the visitor. The form promises it. */
// One score email per address per UTC day. The endpoint that sends it is
// public, and without a ceiling it could be pointed at any mailbox. The
// ceiling is this key: the mail provider enforces it, so it holds with or
// without the ledger. The address is hashed to keep the key short and
// well-formed, whatever characters the address holds.
export async function scoreMailKey(email, now = new Date()) {
  const bytes = new TextEncoder().encode(String(email || '').trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return `mri-score/${hex}/${now.toISOString().slice(0, 10)}`;
}

// A brand name that reads like a link. The visitor's copy leaves such a
// name out, so the form cannot be used to send someone a link from this
// domain. The practice inbox still receives the name as typed.
export function looksLikeLink(s) {
  return /(https?:|www\.|[a-z0-9-]\.[a-z]{2,}(\/|\b))/i.test(String(s || ''));
}

export function scoreMail({ lang, brand: typedBrand, score }) {
  const l = pickLang(lang);
  const brand = looksLikeLink(typedBrand) ? '' : typedBrand;
  const brake = pillarName(score.brake, l);
  const short = pillarShort(score.brake, l);
  const url = `${SITE}/mri?lang=${l}`;
  if (l === 'fr') {
    const subject = `Votre score Brand MRI : ${score.global}/100`;
    const lines = [
      `Votre score Brand MRI : ${score.global}/100`,
      '',
      brand ? `Marque : ${brand}` : null,
      `Frein principal : ${brake} (${short}).`,
      '',
      'Le score mesure cinq piliers : la phrase, le test du logo, la cohérence, la différenciation, la preuve. Votre frein principal est le pilier qui retient les autres.',
      '',
      `Votre résultat reste ouvert sur l'appareil utilisé : ${url}`,
      'Le détail de vos trois tensions commence à 19 $. Le rapport complet avec le plan 90 jours est à 79 $.',
      '',
      'Une question ? Répondez à cet email.',
      '',
      'Quantum Branding',
      'quantumbranding.ai/mri',
    ].filter(x => x !== null);
    const html = shell({
      lang: l,
      eyebrow: 'Brand MRI · Score gratuit',
      title: `Votre score : ${score.global}/100`,
      paragraphs: [
        (brand ? `Marque : <strong>${escapeHtml(brand)}</strong><br>` : '') +
          `Frein principal : <strong>${escapeHtml(brake)}</strong> (${escapeHtml(short)}).`,
        'Le score mesure cinq piliers : la phrase, le test du logo, la cohérence, la différenciation, la preuve. Votre frein principal est le pilier qui retient les autres.',
        'Le détail de vos trois tensions commence à 19&nbsp;$. Le rapport complet avec le plan 90 jours est à 79&nbsp;$.',
        'Une question ? Répondez à cet email.',
      ],
      ctaUrl: url,
      ctaLabel: 'Rouvrir mon résultat',
    });
    return { subject, text: lines.join('\n'), html };
  }
  const subject = `Your Brand MRI score: ${score.global}/100`;
  const lines = [
    `Your Brand MRI score: ${score.global}/100`,
    '',
    brand ? `Brand: ${brand}` : null,
    `Main brake: ${brake} (${short}).`,
    '',
    'The score measures five pillars: the sentence, the logo test, coherence, differentiation, proof. Your main brake is the pillar that holds the others back.',
    '',
    `Your result stays open on the device you used: ${url}`,
    'The detail of your three tensions starts at $19. The full report with the 90-day plan is $79.',
    '',
    'A question? Reply to this email.',
    '',
    'Quantum Branding',
    'quantumbranding.ai/mri',
  ].filter(x => x !== null);
  const html = shell({
    lang: l,
    eyebrow: 'Brand MRI · Free score',
    title: `Your score: ${score.global}/100`,
    paragraphs: [
      (brand ? `Brand: <strong>${escapeHtml(brand)}</strong><br>` : '') +
        `Main brake: <strong>${escapeHtml(brake)}</strong> (${escapeHtml(short)}).`,
      'The score measures five pillars: the sentence, the logo test, coherence, differentiation, proof. Your main brake is the pillar that holds the others back.',
      'The detail of your three tensions starts at $19. The full report with the 90-day plan is $79.',
      'A question? Reply to this email.',
    ],
    ctaUrl: url,
    ctaLabel: 'Reopen my result',
  });
  return { subject, text: lines.join('\n'), html };
}

/* The access link, sent to the buyer once Stripe confirms. */
export function accessUrl(tier, sessionId) {
  return tier === 'retest'
    ? `${SITE}/mri?retest=1&session_id=${sessionId}`
    : `${SITE}/mri?paid=${tier}&session_id=${sessionId}`;
}

export function buyerMail({ lang, tier, sessionId }) {
  const l = pickLang(lang);
  const url = accessUrl(tier, sessionId);
  const label = tierLabel(tier, l);
  if (l === 'fr') {
    const next = tier === 'review'
      ? 'Prochaine étape : envoyez vos deux ou trois questions depuis la page du rapport. Nizzar enregistre la review sous 72 h ouvrées.'
      : 'Gardez cet email : le lien rouvre votre palier.';
    const paragraphs = [
      `Paiement reçu, merci. Votre ${label} est ouvert.`,
      'Si la page redemande vos réponses, répondez une fois aux dix questions et votre palier s\'ouvre.',
      next,
      tier === 'review'
        ? 'Remboursement sous 7 jours sur simple réponse à cet email, avant l\'enregistrement de la review.'
        : 'Remboursement sous 7 jours sur simple réponse à cet email.',
    ];
    return {
      subject: `Brand MRI : votre ${label} est ouvert`,
      text: [...paragraphs.slice(0, 1), '', `Ouvrir : ${url}`, '', ...paragraphs.slice(1), '', 'Quantum Branding', 'quantumbranding.ai/mri'].join('\n'),
      html: shell({ lang: l, eyebrow: 'Brand MRI · Paiement reçu', title: `Votre ${label} est ouvert`, paragraphs: paragraphs.map(escapeHtml), ctaUrl: url, ctaLabel: 'Ouvrir mon rapport' }),
    };
  }
  const next = tier === 'review'
    ? 'Next step: send your two or three questions from the report page. Nizzar records the review within 72 working hours.'
    : 'Keep this email. The link reopens your tier.';
  const paragraphs = [
    `Payment received, thank you. Your ${label} is open.`,
    'If the page asks for your answers again, answer the ten questions once and your tier opens.',
    next,
    tier === 'review'
      ? 'Refund within 7 days on a simple reply to this email, before the review is recorded.'
      : 'Refund within 7 days on a simple reply to this email.',
  ];
  return {
    subject: `Brand MRI: your ${label} is open`,
    text: [...paragraphs.slice(0, 1), '', `Open it: ${url}`, '', ...paragraphs.slice(1), '', 'Quantum Branding', 'quantumbranding.ai/mri'].join('\n'),
    html: shell({ lang: l, eyebrow: 'Brand MRI · Payment received', title: `Your ${label} is open`, paragraphs: paragraphs.map(escapeHtml), ctaUrl: url, ctaLabel: 'Open my report' }),
  };
}

/* Operator emails. French, plain text, same register as before. */

function diagnosticLines({ score, answers, phrase, target, extras }) {
  const out = [];
  if (score) {
    out.push(`Score : ${score.global}/100`);
    const brake = score.pillars.find(p => p.id === score.brake);
    out.push(`Frein principal : ${pillarName(score.brake, 'fr')} (${brake ? brake.score : '?'}/100)`);
    out.push('Piliers : ' + score.pillars.map(p => `${pillarName(p.id, 'fr')} ${p.score}`).join(' · '));
  }
  if (answers) out.push(`Réponses (Q1 à Q10) : ${answers.join(', ')}`);
  if (phrase) out.push(`Phrase actuelle : ${phrase}`);
  if (target) out.push(`Cible : ${target}`);
  if (extras && extras.difference) out.push(`Différence déclarée : ${extras.difference}`);
  if (extras && extras.proof) out.push(`Preuve déclarée : ${extras.proof}`);
  return out;
}

export function leadText(lead) {
  const utm = [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(' / ');
  return [
    'Nouveau diagnostic Brand MRI terminé.',
    '',
    `Email : ${lead.email}`,
    `Marque : ${lead.brand || '(non renseignée)'}`,
    `Site : ${lead.website || '(non renseigné)'}`,
    ...(lead.score
      ? diagnosticLines(lead)
      : [
        `Score : ${lead.legacyScore == null ? '(inconnu)' : lead.legacyScore + '/100'}`,
        `Frein principal : ${lead.legacyBrake || '(inconnu)'}`,
      ]),
    `Palier : ${lead.tier}`,
    `Langue : ${lead.lang}`,
    utm ? `Source : ${utm}` : null,
    lead.referrer ? `Référent : ${lead.referrer}` : null,
    lead.focus ? `Focus : ${lead.focus}` : null,
    lead.prevScore != null ? `Score précédent (re-test) : ${lead.prevScore}/100` : null,
    `Date : ${new Date().toISOString()}`,
  ].filter(x => x !== null).join('\n');
}

export function reviewText({ email, brand, website, sessionId, questions, completion }) {
  return [
    'Commande de review vidéo Brand MRI. Paiement vérifié chez Stripe.',
    'Délai annoncé au client : 72 h ouvrées.',
    '',
    `Email : ${email}`,
    `Marque : ${brand || '(non renseignée)'}`,
    `Site : ${website || '(non renseigné)'}`,
    ...(completion ? diagnosticLines(completion) : ['Diagnostic : non retrouvé côté serveur, le demander au client.']),
    '',
    'Questions du client pour la review :',
    questions,
    '',
    `Session Stripe : ${sessionId}`,
    `Date : ${new Date().toISOString()}`,
  ].join('\n');
}

function money(amountTotal, currency) {
  if (!Number.isFinite(amountTotal)) return '';
  const value = (amountTotal / 100).toFixed(amountTotal % 100 === 0 ? 0 : 2);
  return `${value} ${(currency || 'usd').toUpperCase() === 'USD' ? '$' : String(currency).toUpperCase()}`;
}

/* ── A sale, as the webhook sees it ────────────────────────── */

// Called from api/stripe-webhook.js for a paid checkout.session.completed
// that carries brand_mri_tier. Never throws: the webhook must always be
// able to answer Stripe.
export async function handleMriSale(session, env) {
  const tier = tierFromSession(session);
  if (!tier) return { ok: false, reason: 'not_mri' };
  if (session.payment_status !== 'paid') return { ok: false, reason: 'unpaid' };

  const email = clean((session.customer_details && session.customer_details.email) || session.customer_email, 200).toLowerCase();
  const visitorId = clean(session.client_reference_id, 80) || null;
  const completion = await latestCompletion(env, { visitorId, email });
  const lang = pickLang((completion && completion.lang) || session.locale);
  const data = (completion && completion.data) || {};
  const answers = sanitizeAnswers(data.answers);
  const score = answers ? scoreAnswers(answers) : null;
  const brand = clean(completion && completion.brand, 120);
  const website = clean(completion && completion.website, 300);

  const ledger = await ledgerInsert(env, {
    event: 'paid',
    visitor_id: visitorId,
    lang,
    tier,
    email: email || null,
    brand: brand || null,
    website: website || null,
    score: score ? score.global : null,
    brake: score ? score.brake : null,
    stripe_session_id: session.id,
    amount_total: Number.isFinite(session.amount_total) ? session.amount_total : null,
    data: { source: 'webhook', link_tier: session.metadata.brand_mri_tier },
  });

  // Reviews paid over the last seven days, this one included. The page
  // promises five places a week and Stripe does not count them.
  let reviewLine = null;
  if (tier === 'review') {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const recent = await ledgerSelect(env, `select=id&event=eq.paid&tier=eq.review&created_at=gte.${encodeURIComponent(since)}`);
    reviewLine = recent.ok
      ? `Reviews payées sur 7 jours : ${recent.rows.length} sur 5.`
      : 'Reviews payées sur 7 jours : compteur indisponible, vérifier dans Stripe.';
  }

  const amount = money(session.amount_total, session.currency);
  const subject = `Brand MRI vente : ${brand || email || 'client'} · ${tierLabel(tier, 'fr')}${amount ? ' · ' + amount : ''}`;
  const text = [
    'Vente Brand MRI. Paiement confirmé par Stripe.',
    '',
    `Palier : ${tierLabel(tier, 'fr')} (lien ${session.metadata.brand_mri_tier})`,
    amount ? `Montant : ${amount}` : null,
    `Email : ${email || '(inconnu)'}`,
    brand ? `Marque : ${brand}` : null,
    website ? `Site : ${website}` : null,
    ...(score ? diagnosticLines({ score, answers, phrase: clean(data.phrase, 400), target: clean(data.target, 200) }) : ['Diagnostic : non retrouvé côté serveur.']),
    tier === 'review' ? '' : null,
    tier === 'review' ? 'Review vidéo payée. Délai annoncé au client : 72 h ouvrées.' : null,
    reviewLine,
    tier === 'review' ? 'Les questions du client arrivent dans un second email dès qu\'il les envoie depuis la page.' : null,
    '',
    `Session Stripe : ${session.id}`,
    `Date : ${new Date().toISOString()}`,
  ].filter(x => x !== null).join('\n');

  const operator = await sendMail(env, { to: PRACTICE_INBOX, subject, text, replyTo: email || undefined, refId: 'qb-brand-mri-sale' });
  let buyer = { ok: false, error: 'no_email' };
  if (isEmail(email)) {
    const mail = buyerMail({ lang, tier, sessionId: session.id });
    buyer = await sendMail(env, { to: email, ...mail, refId: 'qb-brand-mri-access' });
  }
  if (!operator.ok) console.error('[mri-sale] operator email failed', operator.error || operator.status);
  if (!buyer.ok) console.error('[mri-sale] buyer email failed', buyer.error || buyer.status);
  return { ok: true, tier, ledger: ledger.ok, operator: operator.ok, buyer: buyer.ok };
}
