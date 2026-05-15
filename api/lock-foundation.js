// QB BrandOS. Lock Foundation.
// Vercel Edge Function
//
// POST /api/lock-foundation
//   Authorization: Bearer <supabase-access-token>
//   Body: (none)
//
//   → { ok: true, lockedAt } on success
//   → { ok: false, error } on failure
//
// Locks the user's Phase 01 foundation:
//   1. Verifies the Supabase JWT.
//   2. Verifies Phase 01 is complete (soul-map + sensescape + visual-dna +
//      war-table all present in profiles.tool_completions JSONB).
//   3. Reads the user's qbp snapshot.
//   4. Writes foundation_locked_at = now() and foundation_lock_qbp = qbp to
//      profiles.
//   5. Sends a confirmation email via Resend.
//
// Idempotent: re-calling on a locked profile returns the existing lockedAt
// without re-sending the email or re-aggregating the qbp.
//
// Day 3: after the lock writes, fan out to the agentic dispatcher.
// The Soul Map Synthesizer is the only registered agent for now; future
// agents plug into AGENT_REGISTRY in api/agents/dispatch.js without
// touching this file. We await the dispatch call so the Edge invocation
// stays open for its full 25s budget; the agent's Sonnet call runs
// inside that window and the artifact row lands as 'ready' before we
// respond to the dashboard. The lock email goes out first so the user
// still gets confirmation even if the agent later times out.
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_ANON_KEY    For /auth/v1/user + RLS read/patch.
//   RESEND_API_KEY                     Confirmation email send.

import { sendEmail, renderTemplate, EMAIL_TEMPLATES } from './_lib/email.js';

export const config = { runtime: 'edge' };

// Free tier must complete the three free-tier exercises to lock.
// Visual DNA and War Table are paid-tier exercises and intentionally NOT
// required for lock. The lock dispatches all four synthesizers regardless;
// Visual DNA and War Table run against whatever data exists in qbp at lock
// time and are tier-gated at read. Post-upgrade, those exercises become
// completable and trigger artifact regeneration with the new data.
// Slugs are the canonical tool_completions keys written by the exercise
// pages via QB.openGate({ toolId: ... }).
const REQUIRED_TOOLS = ['archetype-compass', 'soul-map', 'sensescape'];
const FOUNDATION_URL = 'https://app.quantumbranding.ai/foundation';

const ALLOWED_ORIGINS = new Set([
  'https://quantumbranding.ai',
  'https://www.quantumbranding.ai',
  'https://app.quantumbranding.ai',
]);

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://quantumbranding.ai';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Vary': 'Origin',
  };
}

async function sendLockEmail({ email, firstName }) {
  const vars = { first_name: firstName || 'there', foundation_url: FOUNDATION_URL };
  const tpl = EMAIL_TEMPLATES.FOUNDATION_LOCKED;
  const result = await sendEmail({
    to: email,
    subject: tpl.subject,
    html: renderTemplate(tpl.html, vars),
    text: renderTemplate(tpl.text, vars),
    refId: tpl.refId,
  });
  if (!result.ok) {
    console.error('[lock-foundation] email send failed', result.status || '', String(result.error || '').slice(0, 300));
  }
  return result;
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const cors_h = cors(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors_h });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors_h });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'Lock service not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...cors_h },
    });
  }

  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors_h },
    });
  }

  // Step 1: resolve the JWT to a user.
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors_h },
    });
  }
  const user = await userRes.json();
  if (!user?.id) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors_h },
    });
  }

  // Step 2: read the profile. RLS limits to the caller's own row.
  const profRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=email,first_name,qbp,tool_completions,foundation_locked_at&id=eq.${encodeURIComponent(user.id)}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  );
  if (!profRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: 'Profile read failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors_h },
    });
  }
  const profiles = await profRes.json();
  const profile = profiles?.[0];
  if (!profile) {
    return new Response(JSON.stringify({ ok: false, error: 'Profile not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...cors_h },
    });
  }

  // Idempotent: if already locked, return current state. Do not re-send email.
  if (profile.foundation_locked_at) {
    return new Response(
      JSON.stringify({ ok: true, lockedAt: profile.foundation_locked_at, alreadyLocked: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...cors_h } }
    );
  }

  // Step 3: enforce Phase 01 completion. The four tools the synthesis agents
  // will consume are soul-map, sensescape, visual-dna, war-table. Archetype
  // Compass and The Profiles are entry/reference surfaces, not data captures.
  const completions = profile.tool_completions && typeof profile.tool_completions === 'object'
    ? profile.tool_completions
    : {};
  const missing = REQUIRED_TOOLS.filter(t => !completions[t]);
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Phase 01 incomplete', missing }),
      { status: 409, headers: { 'Content-Type': 'application/json', ...cors_h } }
    );
  }

  // Step 4: lock. PATCH writes both columns in one request; RLS ensures only
  // the user's own row can be touched.
  const lockedAt = new Date().toISOString();
  const lockQbp = profile.qbp && typeof profile.qbp === 'object' ? profile.qbp : {};

  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        foundation_locked_at: lockedAt,
        foundation_lock_qbp: lockQbp,
      }),
    }
  );
  if (!patchRes.ok) {
    const errText = await patchRes.text().catch(() => '');
    console.error('[lock-foundation] patch failed', patchRes.status, errText.slice(0, 300));
    return new Response(JSON.stringify({ ok: false, error: 'Lock write failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors_h },
    });
  }

  // Step 5: confirmation email. Non-blocking. We do not fail the lock if the
  // email send fails; the dashboard is the source of truth.
  if (RESEND_API_KEY && profile.email) {
    await sendLockEmail({
      email: profile.email,
      firstName: profile.first_name || '',
    });
  }

  // Step 6: agent dispatch. Enqueues every Phase 01 synthesizer in parallel.
  // Each dispatch call hits /api/agents/dispatch which is its own Edge
  // function with its own ~25 s budget — running them concurrently means the
  // total wall time stays close to the slowest single agent. Dispatch errors
  // do not roll back the lock; the dashboard surfaces a Retry on stuck rows.
  //
  // Append future agents here as steps 5 (visual_dna) and 6 (war_table) ship.
  const AGENTS_TO_ENQUEUE = [
    'soul_map_synthesizer',
    'sensescape_synthesizer',
    'visual_dna_synthesizer',
    'war_table_synthesizer',
  ];

  const dispatchResults = await Promise.all(
    AGENTS_TO_ENQUEUE.map(agentName =>
      runAgentDispatch({
        req,
        token,
        userId: user.id,
        qbp: lockQbp,
        agentName,
      })
    )
  );

  return new Response(JSON.stringify({ ok: true, lockedAt, dispatch: dispatchResults }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors_h },
  });
}

async function runAgentDispatch({ req, token, userId, qbp, agentName }) {
  try {
    const base = new URL(req.url).origin;
    const res = await fetch(`${base}/api/agents/dispatch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, qbp, agentName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[lock-foundation] dispatch non-OK', res.status, JSON.stringify(data).slice(0, 300));
      return { ok: false, status: res.status, error: data?.error || 'dispatch failed' };
    }
    return data;
  } catch (e) {
    console.error('[lock-foundation] dispatch threw', e && e.message);
    return { ok: false, error: e && e.message || 'dispatch threw' };
  }
}
