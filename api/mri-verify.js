// Brand MRI · payment check.
// Vercel Edge Function
//
// Two questions, one rule: a paid tier is whatever Stripe says it is.
//
// GET /api/mri-verify?session_id=cs_live_...
//   "Is this session paid?" Used by the access link in the buyer's email
//   and by the quiet re-check of sessions the browser already holds.
//
//   -> 200 { ok: true, tier, restore? }
//        tier: "flash" | "full" | "review" | "retest"
//   -> 200 { ok: false, reason }
//        "bad_session_id" | "not_found" | "unpaid" | "not_mri": final.
//
// GET /api/mri-verify?visitor_id=v_...
//   "Which paid sessions carry my visitor id?" Used on the return from
//   Stripe. The payment links send a buyer back to /mri?paid=<tier> with no
//   session id, so the page asks with the id it sent as
//   client_reference_id. Nobody else knows that id.
//
//   -> 200 { ok: true, sessions: [{ id, tier }], restore? }
//        sessions is empty when Stripe holds no paid MRI session for the id.
//   -> 200 { ok: false, reason: "bad_visitor_id" }: final.
//
// Both:
//   restore: the buyer's last diagnostic, when the ledger holds it, so a
//            report bought on one device opens on another.
//   "stripe_unavailable" | "stripe_forbidden" | "not_configured": the check
//   could not run. The page keeps what it already knew and tries again.
//
// The paid parameter alone opens nothing.
//
// Env: STRIPE_SECRET_KEY (required). Ledger env optional.

import {
  clean, pickLang, sanitizeAnswers, corsHeaders, json, mriEnv,
  verifyPaidSession, findPaidSessions, ledgerInsert, latestCompletion,
} from './_lib/mri.js';

export const config = { runtime: 'edge' };

function buyerOf(session) {
  return {
    email: clean((session.customer_details && session.customer_details.email) || session.customer_email, 200).toLowerCase(),
    visitorId: clean(session.client_reference_id, 80) || null,
  };
}

// The webhook records the sale too. Whichever arrives second meets the
// unique index on paid sessions and becomes a no-op.
function recordPaid(env, session, tier, completion, source) {
  const who = buyerOf(session);
  return ledgerInsert(env, {
    event: 'paid',
    visitor_id: who.visitorId,
    lang: pickLang((completion && completion.lang) || session.locale),
    tier,
    email: who.email || null,
    brand: (completion && completion.brand) || null,
    website: (completion && completion.website) || null,
    score: completion && Number.isFinite(completion.score) ? completion.score : null,
    brake: (completion && completion.brake) || null,
    stripe_session_id: session.id,
    amount_total: Number.isFinite(session.amount_total) ? session.amount_total : null,
    data: { source, link_tier: session.metadata.brand_mri_tier },
  });
}

function restoreOf(completion) {
  const answers = completion && completion.data ? sanitizeAnswers(completion.data.answers) : null;
  if (!answers) return null;
  return {
    answers,
    lang: pickLang(completion.lang),
    form: {
      brand: clean(completion.brand, 120),
      website: clean(completion.website, 300),
      email: clean(completion.email, 200),
      phrase: clean(completion.data.phrase, 400),
      target: clean(completion.data.target, 200),
    },
  };
}

export default async function handler(req) {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return json(405, { ok: false, reason: 'method_not_allowed' }, cors);

  const env = mriEnv();
  const query = new URL(req.url).searchParams;
  const sessionId = query.get('session_id');
  const visitorParam = query.get('visitor_id');

  // A session id wins when both are sent: it names one payment exactly.
  if (sessionId !== null || visitorParam === null) {
    const paid = await verifyPaidSession(env, sessionId || '');
    if (!paid.ok) return json(200, { ok: false, reason: paid.reason }, cors);
    const who = buyerOf(paid.session);
    const completion = await latestCompletion(env, { visitorId: who.visitorId, email: who.email });
    await recordPaid(env, paid.session, paid.tier, completion, 'return');
    const out = { ok: true, tier: paid.tier };
    const restore = restoreOf(completion);
    if (restore) out.restore = restore;
    return json(200, out, cors);
  }

  const found = await findPaidSessions(env, visitorParam);
  if (!found.ok) return json(200, { ok: false, reason: found.reason }, cors);
  const out = { ok: true, sessions: found.sessions.map(x => ({ id: x.session.id, tier: x.tier })) };
  if (found.sessions.length) {
    const who = buyerOf(found.sessions[0].session);
    const completion = await latestCompletion(env, { visitorId: visitorParam, email: who.email });
    for (const x of found.sessions) await recordPaid(env, x.session, x.tier, completion, 'return_lookup');
    const restore = restoreOf(completion);
    if (restore) out.restore = restore;
  }
  return json(200, out, cors);
}
