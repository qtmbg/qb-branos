// Brand MRI · lead capture and review orders.
// Vercel Edge Function
//
// POST /api/mri-lead
//
//   type "lead" (default). A visitor finished the free diagnostic.
//     Body: { email, brand?, website?, phrase?, target?, answers[10], tier?,
//             lang?, visitor_id?, utm?, referrer?, focus?, prev_score? }
//     1. One email to the practice inbox, with the full diagnostic.
//     2. One email to the visitor with their score. The form field reads
//        "Email, to receive your score", so the score is sent.
//     3. One "completed" row in the ledger, when the ledger exists.
//
//   type "review". A buyer of the video review sends their questions.
//     Body: { session_id, email, brand?, website?, questions, answers?[10],
//             phrase?, target?, extras? }
//     The Stripe session is checked first. An order reaches the inbox only
//     for a session that is paid and carries the review tier.
//
//   -> { ok: true, ... } on success
//   -> { ok: false, error } on failure
//
// Scores are recomputed here from the answers. A browser still running the
// previous script sends { score, frein } with no answers: that payload is
// accepted and reported as it was before.
//
// Env: RESEND_API_KEY (required). STRIPE_SECRET_KEY (review orders).
//      SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ledger, optional).

import {
  PRACTICE_INBOX, clean, isEmail, pickLang, sanitizeAnswers, scoreAnswers,
  corsHeaders, originAllowed, json, mriEnv, sendMail, ledgerInsert,
  latestCompletion, verifyPaidSession, leadText, reviewText, scoreMail, scoreMailKey,
} from './_lib/mri.js';

export const config = { runtime: 'edge' };

const TIERS = new Set(['free', 'flash', 'full', 'review']);

function utmOf(body) {
  const u = (body && body.utm) || {};
  return {
    utm_source: clean(u.source, 80) || null,
    utm_medium: clean(u.medium, 80) || null,
    utm_campaign: clean(u.campaign, 120) || null,
    utm_content: clean(u.content, 120) || null,
  };
}

async function handleLead(body, env, cors) {
  const email = clean(body.email, 200).toLowerCase();
  if (!isEmail(email)) return json(400, { ok: false, error: 'Valid email required' }, cors);

  const answers = sanitizeAnswers(body.answers);
  const score = answers ? scoreAnswers(answers) : null;
  const lead = {
    email,
    brand: clean(body.brand, 120),
    website: clean(body.website, 300),
    phrase: clean(body.phrase, 400),
    target: clean(body.target, 200),
    tier: TIERS.has(body.tier) ? body.tier : 'free',
    lang: pickLang(body.lang),
    visitorId: clean(body.visitor_id, 80) || null,
    referrer: clean(body.referrer, 300) || null,
    focus: clean(body.focus, 40) || null,
    prevScore: Number.isFinite(body.prev_score) ? Math.round(body.prev_score) : null,
    answers,
    score,
    // Previous script: no answers, a score and a brake name sent as is.
    legacyScore: !score && Number.isFinite(body.score) ? Math.round(body.score) : null,
    legacyBrake: !score ? clean(body.frein, 120) : '',
    ...utmOf(body),
  };

  const shown = score ? score.global : lead.legacyScore;
  const operator = await sendMail(env, {
    to: PRACTICE_INBOX,
    replyTo: email,
    subject: 'Brand MRI lead : ' + (lead.brand || email) + (shown == null ? '' : ' (' + shown + '/100)'),
    text: leadText(lead),
    refId: 'qb-brand-mri-lead',
  });
  if (!operator.ok) {
    console.error('[mri-lead] operator email failed', operator.status || '', operator.error || '');
    return json(502, { ok: false, error: 'Email send failed' }, cors);
  }

  // The visitor's copy. One per address per UTC day, which keeps this
  // endpoint from being used to flood an inbox. The mail provider holds the
  // ceiling (scoreMailKey), so it applies with or without the ledger. A
  // second diagnostic the same day changes the email body, the provider
  // answers 409, and nothing is sent: the score is on the page.
  let scoreEmail = false;
  if (score) {
    const mail = scoreMail({ lang: lead.lang, brand: lead.brand, score });
    const sent = await sendMail(env, { to: email, ...mail, refId: 'qb-brand-mri-score', idempotencyKey: await scoreMailKey(email) });
    scoreEmail = sent.ok;
    if (!sent.ok && sent.status !== 409) console.error('[mri-lead] score email failed', sent.status || '', sent.error || '');
  }

  const ledger = await ledgerInsert(env, {
    event: 'completed',
    visitor_id: lead.visitorId,
    lang: lead.lang,
    tier: lead.tier,
    email,
    brand: lead.brand || null,
    website: lead.website || null,
    score: shown,
    brake: score ? score.brake : null,
    utm_source: lead.utm_source,
    utm_medium: lead.utm_medium,
    utm_campaign: lead.utm_campaign,
    utm_content: lead.utm_content,
    referrer: lead.referrer,
    focus: lead.focus,
    data: { answers, phrase: lead.phrase || null, target: lead.target || null, prev_score: lead.prevScore },
  });

  return json(200, { ok: true, emailId: operator.id || null, scoreEmail, ledger: ledger.ok }, cors);
}

async function handleReview(body, env, cors) {
  const email = clean(body.email, 200).toLowerCase();
  const questions = clean(body.questions, 3000);
  if (!isEmail(email)) return json(400, { ok: false, error: 'Valid email required' }, cors);
  if (!questions) return json(400, { ok: false, error: 'Questions required' }, cors);

  const paid = await verifyPaidSession(env, body.session_id);
  if (!paid.ok) {
    const transient = paid.reason === 'stripe_unavailable' || paid.reason === 'not_configured' || paid.reason === 'stripe_forbidden';
    return json(transient ? 503 : 402, { ok: false, error: paid.reason }, cors);
  }
  if (paid.tier !== 'review') return json(402, { ok: false, error: 'not_review_tier' }, cors);

  const visitorId = clean(paid.session.client_reference_id, 80) || null;
  const sent = sanitizeAnswers(body.answers);
  let completion = null;
  if (sent) {
    completion = {
      score: scoreAnswers(sent), answers: sent,
      phrase: clean(body.phrase, 400), target: clean(body.target, 200),
      extras: {
        difference: clean(body.extras && body.extras.difference, 300),
        proof: clean(body.extras && body.extras.proof, 300),
      },
    };
  } else {
    const row = await latestCompletion(env, { visitorId, email });
    const stored = row && row.data ? sanitizeAnswers(row.data.answers) : null;
    if (stored) {
      completion = { score: scoreAnswers(stored), answers: stored, phrase: clean(row.data.phrase, 400), target: clean(row.data.target, 200) };
    }
  }

  const brand = clean(body.brand, 120);
  const website = clean(body.website, 300);
  const operator = await sendMail(env, {
    to: PRACTICE_INBOX,
    replyTo: email,
    subject: 'Brand MRI review : ' + (brand || email),
    text: reviewText({ email, brand, website, sessionId: paid.session.id, questions, completion }),
    refId: 'qb-brand-mri-review',
  });
  if (!operator.ok) {
    console.error('[mri-lead] review email failed', operator.status || '', operator.error || '');
    return json(502, { ok: false, error: 'Email send failed' }, cors);
  }

  await ledgerInsert(env, {
    event: 'review_order',
    visitor_id: visitorId,
    tier: 'review',
    email,
    brand: brand || null,
    website: website || null,
    score: completion && completion.score ? completion.score.global : null,
    brake: completion && completion.score ? completion.score.brake : null,
    data: { questions, session: paid.session.id },
  });

  return json(200, { ok: true, emailId: operator.id || null }, cors);
}

export default async function handler(req) {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only' }, cors);
  if (!originAllowed(req)) return json(403, { ok: false, error: 'Origin not allowed' }, cors);

  const env = mriEnv();
  if (!env.RESEND_API_KEY) return json(503, { ok: false, error: 'Email not configured' }, cors);

  let body = {};
  try { body = (await req.json()) || {}; } catch { /* empty body falls through to validation */ }

  return body.type === 'review' ? handleReview(body, env, cors) : handleLead(body, env, cors);
}
