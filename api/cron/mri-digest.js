// Brand MRI · daily numbers.
// Vercel Edge Function, fired by Vercel Cron at 07:00 UTC.
//
// GET /api/cron/mri-digest
//   user-agent: vercel-cron/1.0
//   authorization: Bearer <CRON_SECRET>
//
//   -> 200 { ok: true, sent, truncated, yesterday, week }
//   -> 200 { ok: false, reason, sent }   ledger missing or unreadable
//   -> 401 { error: 'unauthorized_cron_trigger', reason }
//
// Reads public.mri_events and sends one plain-text email to the practice
// inbox: yesterday's funnel (UTC day), the last seven days, the brands that
// finished the diagnostic, the sales. The numbers reach the inbox so that
// every agent reading it works from the same figures.
//
// It stays silent on a day with no activity, except on Mondays, when the
// week is reported even if it is empty. Silence on a Tuesday means nothing
// happened. Silence on a Monday means this job is broken.
//
// A ledger that cannot be read is said on Mondays too, with its reason. The
// usual one is that migration 025 was never applied, and without this line
// nobody would learn why the numbers do not come.
//
// The week is read page by page, to the last row. If the reader's ceiling
// is ever reached the email says the figures are incomplete.

import { verifyCronTrigger } from '../_lib/inter-edge-auth.js';
import { PRACTICE_INBOX, json, mriEnv, ledgerSelectAll, sendMail, pillarName, tierLabel } from '../_lib/mri.js';

export const config = { runtime: 'edge' };

const DAY = 86400000;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function tally(rows) {
  const visitors = new Set();
  let anonymousViews = 0;
  const t = { starts: 0, completions: 0, payClicks: 0, sales: 0, revenue: 0, reviewOrders: 0 };
  for (const r of rows) {
    if (r.event === 'view') { if (r.visitor_id) visitors.add(r.visitor_id); else anonymousViews++; }
    else if (r.event === 'start') t.starts++;
    else if (r.event === 'completed') t.completions++;
    else if (r.event === 'pay_click') t.payClicks++;
    else if (r.event === 'paid') { t.sales++; t.revenue += Number.isFinite(r.amount_total) ? r.amount_total : 0; }
    else if (r.event === 'review_order') t.reviewOrders++;
  }
  return { visits: visitors.size + anonymousViews, ...t };
}

function pct(part, whole) {
  return whole > 0 ? Math.round(part / whole * 100) + ' %' : 'sans objet';
}

function block(title, t) {
  return [
    title,
    `  Visites : ${t.visits}`,
    `  Diagnostics commencés : ${t.starts}`,
    `  Diagnostics terminés : ${t.completions}`,
    `  Clics vers Stripe : ${t.payClicks}`,
    `  Ventes : ${t.sales}` + (t.sales ? ` (${(t.revenue / 100).toFixed(0)} $)` : ''),
    `  Commandes de review : ${t.reviewOrders}`,
  ];
}

export default async function handler(req) {
  const trigger = verifyCronTrigger(req);
  if (!trigger.ok) return json(401, { error: 'unauthorized_cron_trigger', reason: trigger.reason });

  const env = mriEnv();
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const yesterdayStart = todayStart - DAY;
  const weekStart = todayStart - 7 * DAY;

  const isMonday = now.getUTCDay() === 1;
  const cols = 'created_at,event,tier,email,brand,website,score,brake,utm_source,amount_total,visitor_id';
  const read = await ledgerSelectAll(env,
    `select=${cols}&created_at=gte.${encodeURIComponent(new Date(weekStart).toISOString())}` +
    `&created_at=lt.${encodeURIComponent(new Date(todayStart).toISOString())}&order=created_at.asc,id.asc`);
  if (!read.ok) {
    let told = false;
    if (isMonday) {
      const why = read.reason === 'table_missing'
        ? 'La table public.mri_events n\'existe pas : la migration supabase/migrations/025_mri_events.sql n\'est pas appliquée.'
        : `Le registre n'a pas pu être lu (${read.reason}).`;
      const mail = await sendMail(env, {
        to: PRACTICE_INBOX,
        subject: 'Brand MRI chiffres : registre illisible',
        text: [
          'Brand MRI, pas de chiffres cette semaine.',
          '',
          why,
          '',
          'Ce qui marche sans le registre : la page, le score par email, la vérification des paiements, les alertes de lead et de vente.',
          'Ce qui attend le registre : ce rapport quotidien, le compteur de reviews, la reprise d\'un rapport sur un autre appareil.',
        ].join('\n'),
        refId: 'qb-brand-mri-digest',
      });
      told = mail.ok;
    }
    return json(200, { ok: false, reason: read.reason, sent: told });
  }

  const week = read.rows;
  const yesterday = week.filter(r => Date.parse(r.created_at) >= yesterdayStart);
  const y = tally(yesterday);
  const w = tally(week);

  if (!yesterday.length && !isMonday) return json(200, { ok: true, sent: false, truncated: read.truncated, yesterday: y, week: w });

  const d = new Date(yesterdayStart);
  const dateLabel = `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

  const sources = {};
  for (const r of week) {
    if (r.event !== 'view') continue;
    const k = r.utm_source || '(direct ou non tagué)';
    sources[k] = (sources[k] || 0) + 1;
  }
  const sourceLine = Object.keys(sources).sort((a, b) => sources[b] - sources[a]).map(k => `${k} : ${sources[k]}`).join(' · ');

  const completed = yesterday.filter(r => r.event === 'completed').map(r =>
    `  - ${r.brand || r.email || '(sans nom)'}` + (r.website ? ` · ${r.website}` : '') +
    (Number.isFinite(r.score) ? ` · ${r.score}/100` : '') +
    (r.brake ? ` · frein : ${pillarName(r.brake, 'fr')}` : '') +
    (r.utm_source ? ` · source : ${r.utm_source}` : ''));
  const sold = yesterday.filter(r => r.event === 'paid').map(r =>
    `  - ${r.brand || r.email || '(client)'} · ${tierLabel(r.tier, 'fr')}` +
    (Number.isFinite(r.amount_total) ? ` · ${(r.amount_total / 100).toFixed(0)} $` : ''));

  const text = [
    `Brand MRI, chiffres du ${dateLabel} (journée UTC).`,
    read.truncated ? `Attention : lecture arrêtée à ${week.length} lignes. Les chiffres ci-dessous sont incomplets.` : null,
    '',
    ...block('Hier', y),
    '',
    ...block('7 derniers jours', w),
    `  Visite vers diagnostic terminé : ${pct(w.completions, w.visits)}`,
    `  Diagnostic terminé vers vente : ${pct(w.sales, w.completions)}`,
    '',
    completed.length ? 'Diagnostics terminés hier' : null,
    ...completed,
    sold.length ? 'Ventes hier' : null,
    ...sold,
    sourceLine ? `Sources des visites sur 7 jours : ${sourceLine}` : null,
    '',
    'Source : table public.mri_events. Les liens des posts doivent porter ?utm_source= pour que la source apparaisse ici.',
  ].filter(x => x !== null).join('\n');

  const subject = `Brand MRI chiffres · ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} : ` +
    `${y.visits} visite${y.visits > 1 ? 's' : ''}, ${y.completions} diagnostic${y.completions > 1 ? 's' : ''}, ${y.sales} vente${y.sales > 1 ? 's' : ''}`;
  const mail = await sendMail(env, { to: PRACTICE_INBOX, subject, text, refId: 'qb-brand-mri-digest' });
  if (!mail.ok) console.error('[mri-digest] email failed', mail.status || '', mail.error || '');
  return json(200, { ok: true, sent: mail.ok, truncated: read.truncated, yesterday: y, week: w });
}
