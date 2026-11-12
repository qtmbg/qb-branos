// Brand MRI · payment check.
// Vercel Edge Function
//
// GET /api/mri-verify?session_id=cs_live_...
//
//   -> 200 { ok: true, tier, restore? }
//        tier: "flash" | "full" | "review" | "retest"
//        restore: the buyer's last diagnostic, when the ledger holds it, so
//                 a report bought on one device opens on another.
//   -> 200 { ok: false, reason }
//        "bad_session_id" | "not_found" | "unpaid" | "not_mri": final.
//        "stripe_unavailable" | "stripe_forbidden" | "not_configured":
//        the check could not run. The page keeps what it already knew and
//        tries again on the next load.
//
// Stripe redirects a buyer to /mri?paid=<tier>&session_id={CHECKOUT_SESSION_ID}.
// The paid parameter alone opens nothing. The page calls this endpoint and
// shows a paid tier only on ok:true.
//
// Env: STRIPE_SECRET_KEY (required). Ledger env optional.

import {
  clean, pickLang, sanitizeAnswers, corsHeaders, json, mriEnv,
  verifyPaidSession, ledgerInsert, latestCompletion,
} from './_lib/mri.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return json(405, { ok: false, reason: 'method_not_allowed' }, cors);

  const env = mriEnv();
  const id = new URL(req.url).searchParams.get('session_id') || '';
  const paid = await verifyPaidSession(env, id);
  if (!paid.ok) return json(200, { ok: false, reason: paid.reason }, cors);

  const session = paid.session;
  const email = clean((session.customer_details && session.customer_details.email) || session.customer_email, 200).toLowerCase();
  const visitorId = clean(session.client_reference_id, 80) || null;

  const completion = await latestCompletion(env, { visitorId, email });
  const answers = completion && completion.data ? sanitizeAnswers(completion.data.answers) : null;

  // The webhook records the sale too. Whichever arrives second meets the
  // unique index on paid sessions and becomes a no-op.
  await ledgerInsert(env, {
    event: 'paid',
    visitor_id: visitorId,
    lang: pickLang((completion && completion.lang) || session.locale),
    tier: paid.tier,
    email: email || null,
    brand: (completion && completion.brand) || null,
    website: (completion && completion.website) || null,
    score: completion && Number.isFinite(completion.score) ? completion.score : null,
    brake: (completion && completion.brake) || null,
    stripe_session_id: session.id,
    amount_total: Number.isFinite(session.amount_total) ? session.amount_total : null,
    data: { source: 'return', link_tier: session.metadata.brand_mri_tier },
  });

  const out = { ok: true, tier: paid.tier };
  if (answers) {
    out.restore = {
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
  return json(200, out, cors);
}
