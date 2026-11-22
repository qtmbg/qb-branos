// Brand MRI · funnel events.
// Vercel Edge Function
//
// POST /api/mri-event   { event, visitor_id?, lang?, tier?, target?, focus?,
//                         utm?, referrer? }
//   -> 204 always. The page sends these with sendBeacon and never reads
//      the answer, so nothing useful can be returned and nothing is.
//
// Three events come from the browser: "view" (the page opened), "start"
// (the visitor began the ten questions) and "pay_click" (a Stripe button
// was pressed). "completed", "paid" and "review_order" are written by the
// server paths that know them to be true, never from here.
//
// One row per event in public.mri_events, when the ledger exists. With no
// ledger this endpoint is a quiet no-op.

import { clean, pickLang, originAllowed, mriEnv, ledgerInsert } from './_lib/mri.js';

export const config = { runtime: 'edge' };

const BROWSER_EVENTS = new Set(['view', 'start', 'pay_click']);
const TIERS = new Set(['free', 'flash', 'full', 'review']);

export default async function handler(req) {
  if (req.method !== 'POST' || !originAllowed(req)) return new Response(null, { status: 204 });

  let body = {};
  try { body = JSON.parse(await req.text()) || {}; } catch { return new Response(null, { status: 204 }); }
  if (!BROWSER_EVENTS.has(body.event)) return new Response(null, { status: 204 });

  const utm = body.utm || {};
  await ledgerInsert(mriEnv(), {
    event: body.event,
    visitor_id: clean(body.visitor_id, 80) || null,
    lang: pickLang(body.lang),
    tier: TIERS.has(body.tier) ? body.tier : 'free',
    utm_source: clean(utm.source, 80) || null,
    utm_medium: clean(utm.medium, 80) || null,
    utm_campaign: clean(utm.campaign, 120) || null,
    utm_content: clean(utm.content, 120) || null,
    referrer: clean(body.referrer, 300) || null,
    focus: clean(body.focus, 40) || null,
    data: body.event === 'pay_click' ? { target: clean(body.target, 40) } : {},
  });
  return new Response(null, { status: 204 });
}
