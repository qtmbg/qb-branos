// QB BrandOS · POST /api/agents/rerun
//
// Per PR #78 audit item 3 (structural call B). Routes Console rerun CTAs
// through the contract-conformant runtime path instead of the legacy
// /api/artifacts/[id]/regenerate endpoint, so reruns during the step 5 →
// step 6 gap write agent_runs and dispatch_jobs rows that conform to the
// §3.5 contract (model field, retry_budget=0 semantics, structured
// error_payload, agent_version writes).
//
// This is effectively the minimum-viable surface of §13 step 7 (regenerate
// endpoint refactor). When step 7 opens, its spec starts from this
// endpoint and hardens it (full Content-Approval-Loop semantics, feedback
// runtime_args, etc); /api/artifacts/[id]/regenerate retires at that point.
//
// Flow per spec §5.3:
//   1. Verify JWT, extract user_id
//   2. Parse body { artifact_id, qbp_source } · qbp_source defaults 'current'
//   3. Load source artifact, verify ownership + status='delivered'
//   4. Resolve agent_slug from artifacts.artifact_type, look up META
//   5. Insert dispatch_jobs row · kind='regenerate', agents_count=1,
//      trigger='regenerate', agent_version=META.version
//   6. Insert new artifacts row · version=source.version+1,
//      parent_artifact_id=source.id, status='queued', dispatch_id=new
//   7. context.waitUntil(fetch /api/agents/run with JWT) · same-user JWT
//      flows through · /api/agents/run authMode='user', force_error
//      stays HMAC-gated and ignored (per PR #75 fix)
//   8. Return 202 with { ok, dispatch_id, artifact_id, version }
//
// /api/agents/run does NOT insert artifact rows · it PATCHes the existing
// row through queued → generating → delivered/failed. This endpoint owns
// the artifact-creation step; the runtime owns the lifecycle thereafter.

import { cors, json, resolveUser, svcHeaders, requireEnv } from '../_lib/auth.js';
import { AGENTS, getAgent } from '../../agents/registry.js';
import { VISION_READABLE_MIME, VISION_MAX_FILE_SIZE_BYTES, CANONICAL_TIERS } from '../../agents/contract.js';
import { waitUntil } from '@vercel/functions';
import { parseUserUploadPath, mimeFromExt, fileIdFromSegment, ALLOWED_MIME_TYPES, BUCKET } from '../files/_lib/file-config.js';

export const config = { runtime: 'edge' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Chapter 3 step 4 · read the stored object's size from the storage list
// API (the object info endpoint's response shape varies across storage-api
// versions; the list endpoint is the one this repo already relies on).
// Returns the byte size, or null when the object is not found.
async function fetchObjectSize({ env, parsed }) {
  const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
    body: JSON.stringify({ prefix: parsed.userId, search: parsed.fileSegment, limit: 10 }),
  });
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  const hit = Array.isArray(rows) ? rows.find(o => o?.name === parsed.fileSegment) : null;
  const size = hit?.metadata?.size;
  return typeof size === 'number' ? size : null;
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const corsH = cors(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' }, corsH);

  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const missing = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  if (missing) return json(503, { error: `Not configured: ${missing}` }, corsH);

  // ─── 1. JWT verify ─────────────────────────────────────────────────────
  const authResult = await resolveUser(req, env);
  if (!authResult.ok) return json(authResult.status, { error: authResult.error }, corsH);
  const userId = authResult.user.id;

  // Pass the original Authorization header through to /api/agents/run so
  // the runtime sees the same JWT and resolves authMode='user'.
  const authHeader = req.headers.get('authorization') || '';

  // ─── 2. Parse body ─────────────────────────────────────────────────────
  let body;
  try { body = await req.json(); }
  catch { return json(400, { error: 'invalid_body' }, corsH); }

  const { artifact_id, qbp_source, feedback, files: bodyFiles } = body || {};
  if (!artifact_id || !UUID_RE.test(artifact_id)) {
    return json(400, { error: 'invalid_artifact_id' }, corsH);
  }
  const resolvedSource = qbp_source === 'original' ? 'original' : 'current';
  // §3.5 Content Approval Loop runtime arg per step 7B. Framework ships
  // the pipe · agent prompt builders read runtime_args.feedback at
  // construction time. No loop counter at framework layer per
  // adjudication #2.
  const resolvedFeedback = typeof feedback === 'string' && feedback.trim() ? feedback.trim() : null;

  // Chapter 3 step 3D · files plumbing. Body accepts files: [{path, type}].
  // Each path is validated against the user_id ownership before signing.
  // Signed URLs come from /api/files/sign-url (the user JWT path · the
  // sign-url endpoint runs /auth/v1/user round-trip independently).
  const resolvedFiles = Array.isArray(bodyFiles) ? bodyFiles : [];
  for (const f of resolvedFiles) {
    if (!f || typeof f !== 'object') {
      return json(400, { error: 'invalid_files', detail: 'each file must be an object with path + type' }, corsH);
    }
    const parsed = parseUserUploadPath(f.path);
    if (!parsed) {
      return json(400, { error: 'invalid_files', detail: 'invalid path' }, corsH);
    }
    if (parsed.userId !== userId) {
      return json(401, { error: 'unauthorized', detail: 'file does not belong to caller' }, corsH);
    }
    if (typeof f.type !== 'string' || !f.type) {
      return json(400, { error: 'invalid_files', detail: 'each file must declare a type matching the agent contract' }, corsH);
    }
    const mime = mimeFromExt(f.path);
    if (!mime || !ALLOWED_MIME_TYPES.has(mime)) {
      return json(400, { error: 'invalid_files', detail: 'file mime not allowed' }, corsH);
    }

    // Chapter 3 step 4 + chapter 4 step 2 · vision discipline for every
    // file type an agent reads through Claude vision. The readable set is
    // narrower than the bucket allowlist (no SVG per the 3Z §9 forward
    // risk · logged as deferred debt at chapter-4 step 2 · no PDF until
    // the document agents) and the per-image size cap is the Anthropic
    // vision input limit (5 MB), tighter than the 25 MB bucket cap.
    // Rejected here, loudly, before any dispatch row is written and
    // before any agent fires. The logo-image detail is founder-facing:
    // it says what to do, not just what went wrong.
    if (f.type === 'reference-image' || f.type === 'logo-image') {
      if (!VISION_READABLE_MIME.has(mime)) {
        const fix = f.type === 'logo-image'
          ? ' · export your logo as PNG and upload that file'
          : '';
        return json(400, {
          error: 'invalid_files',
          detail: `${f.type} must be one of ${[...VISION_READABLE_MIME].join(', ')} · got ${mime}${fix}`,
        }, corsH);
      }
      const parsedRef = parseUserUploadPath(f.path);
      const size = await fetchObjectSize({ env, parsed: parsedRef });
      if (size == null) {
        return json(404, { error: 'invalid_files', detail: `${f.type} not found in storage` }, corsH);
      }
      if (size > VISION_MAX_FILE_SIZE_BYTES) {
        const fix = f.type === 'logo-image'
          ? ' · export a smaller PNG and upload that file'
          : '';
        return json(400, {
          error: 'invalid_files',
          detail: `${f.type} exceeds the ${Math.floor(VISION_MAX_FILE_SIZE_BYTES / 1048576)} MB vision cap (got ${size} bytes)${fix}`,
        }, corsH);
      }
    }
  }

  // ─── 3. Load source artifact ──────────────────────────────────────────
  const srcRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts` +
    `?id=eq.${encodeURIComponent(artifact_id)}` +
    `&user_id=eq.${encodeURIComponent(userId)}` +
    `&select=id,user_id,artifact_type,phase,version,status`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (!srcRes.ok) return json(500, { error: 'source_lookup_failed' }, corsH);
  const srcRows = await srcRes.json().catch(() => []);
  const source = srcRows?.[0];
  if (!source) return json(404, { error: 'artifact_not_found' }, corsH);
  if (source.status !== 'delivered') {
    return json(409, { error: 'source_not_delivered', current_status: source.status }, corsH);
  }

  // ─── 4. Resolve agent META ────────────────────────────────────────────
  // getAgent reads test-agent env flags at REQUEST time per chapter-3
  // step-3E flag-runtime-fix.
  const slug = source.artifact_type;
  const agent = getAgent(slug);
  if (!agent) return json(400, { error: 'unknown_agent', agent_slug: slug }, corsH);

  // ─── 4.2 Tier gate · chapter-4 ruling 2 ───────────────────────────────
  // Same gate as /api/agents/run, enforced here BEFORE the dispatch and
  // artifact rows are created so an unentitled rerun writes nothing.
  // Fails closed on an unreadable profile.
  if (agent.META.phase >= '02') {
    const tierRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?select=tier&id=eq.${encodeURIComponent(userId)}`,
      { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
    );
    const tierRows = tierRes.ok ? await tierRes.json().catch(() => null) : null;
    const tier = tierRows?.[0]?.tier;
    const userRank = CANONICAL_TIERS.indexOf(tier);
    const requiredRank = CANONICAL_TIERS.indexOf(agent.META.tier_required);
    if (!tierRes.ok || !Array.isArray(tierRows) || userRank === -1) {
      console.error('[agents/rerun] tier gate could not verify profile tier', userId, tierRes.status);
      return json(403, { error: 'tier_unverified',
                          detail: `profile tier unreadable for paid agent ${slug} · failing closed` }, corsH);
    }
    if (userRank < requiredRank) {
      return json(403, { error: 'tier_insufficient',
                          detail: `${slug} requires tier ${agent.META.tier_required} or above · profile tier is ${tier}` }, corsH);
    }
  }

  // ─── 4.5 §5.3 conformance · qbp_source='original' requires lock snapshot ─
  // Refused at this endpoint (not in /api/agents/run) so the runtime never
  // receives an empty snapshot. Chapter 1 legacy artifacts have null
  // foundation_lock_qbp; the Console two-button rerun already disables the
  // "original" button for them per §6.4, but server-side enforcement is
  // the canonical guard. Step 7A conformance fix.
  if (resolvedSource === 'original') {
    const lockRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?select=foundation_lock_qbp&id=eq.${encodeURIComponent(userId)}`,
      { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
    );
    const lockRows = lockRes.ok ? (await lockRes.json().catch(() => [])) : [];
    const lockSnap = lockRows?.[0]?.foundation_lock_qbp;
    if (!lockSnap || (typeof lockSnap === 'object' && Object.keys(lockSnap).length === 0)) {
      return json(422, {
        ok: false,
        error: { code: 'no_original_snapshot', message: 'foundation_lock_qbp is empty; use qbp_source=current' },
      }, corsH);
    }
  }

  // ─── 5. Insert dispatch_jobs row ──────────────────────────────────────
  const djRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/dispatch_jobs`,
    {
      method: 'POST',
      headers: { ...svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userId,
        kind: 'regenerate',
        status: 'producing',
        agents_count: 1,
        agents_settled: 0,
        trigger: 'regenerate',
        agent_version: agent.META.version,
      }),
    }
  );
  if (!djRes.ok) {
    const t = await djRes.text().catch(() => '');
    return json(500, { error: 'dispatch_insert_failed', detail: t.slice(0, 200) }, corsH);
  }
  const dj = (await djRes.json().catch(() => []))?.[0];
  const dispatchId = dj?.id;
  if (!dispatchId) return json(500, { error: 'dispatch_insert_returned_no_id' }, corsH);

  // ─── 6. Insert new artifacts row ─────────────────────────────────────
  // Version is GLOBAL per (user_id, artifact_type) · max+1. The branched
  // semantics per adjudication #4 keep parent_artifact_id pointing at the
  // SOURCE artifact (which can be mid-chain), while version proceeds in
  // the linear sequence across all reruns. Using source.version+1 here
  // would collide on the (user_id, artifact_type, version) unique index
  // for any second rerun on the same source. Surfaced during step 7A
  // gate 1 verification · this comment is the conformance-fix marker.
  const verRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&artifact_type=eq.${encodeURIComponent(slug)}` +
    `&select=version&order=version.desc&limit=1`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  const verRows = verRes.ok ? (await verRes.json().catch(() => [])) : [];
  const nextVersion = (verRows?.[0]?.version || 0) + 1;

  const artRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts`,
    {
      method: 'POST',
      headers: { ...svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userId,
        artifact_type: slug,
        status: 'queued',
        version: nextVersion,
        parent_artifact_id: source.id,
        phase: source.phase || agent.META.phase,
        content: {},
        error: null,
        dispatch_id: dispatchId,
      }),
    }
  );
  if (!artRes.ok) {
    const t = await artRes.text().catch(() => '');
    return json(500, { error: 'artifact_insert_failed', detail: t.slice(0, 200) }, corsH);
  }
  const newArt = (await artRes.json().catch(() => []))?.[0];
  if (!newArt?.id) return json(500, { error: 'artifact_insert_returned_no_id' }, corsH);

  // ─── 7. Fire /api/agents/run via waitUntil (Option A pattern) ────────
  // Same-origin call · the runtime sees the user's JWT and resolves
  // authMode='user'. force_error is gated to authMode='service' and stays
  // un-honored here (the rerun path never triggers synthetic failures).
  const base = new URL(req.url).origin;

  // Chapter 3 step 3D · sign each file's read URL before dispatch. The
  // sign-url endpoint verifies the user's JWT independently via
  // /auth/v1/user and asserts path-matches-user. We forward the same
  // JWT here.
  const signedFiles = [];
  for (const f of resolvedFiles) {
    const signRes = await fetch(`${base}/api/files/sign-url`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: f.path }),
    });
    if (!signRes.ok) {
      const detail = await signRes.text().catch(() => '');
      return json(signRes.status === 404 ? 404 : 500, {
        error: 'sign_failed',
        path: f.path,
        detail: detail.slice(0, 200),
      }, corsH);
    }
    const signed = await signRes.json().catch(() => ({}));
    if (!signed?.signed_url) {
      return json(500, { error: 'sign_no_url', path: f.path }, corsH);
    }
    const parsed = parseUserUploadPath(f.path);
    signedFiles.push({
      type: f.type,
      file_id: fileIdFromSegment(parsed.fileSegment),
      path: `user-uploads/${parsed.objectName}`,
      signed_url: signed.signed_url,
      mime: mimeFromExt(f.path),
    });
  }

  const runtimeArgs = { qbp_source: resolvedSource };
  if (resolvedFeedback) runtimeArgs.feedback = resolvedFeedback;
  if (signedFiles.length > 0) runtimeArgs.files = signedFiles;

  const runBody = JSON.stringify({
    user_id: userId,
    agent_slug: slug,
    dispatch_id: dispatchId,
    artifact_id: newArt.id,
    trigger: 'regenerate',
    runtime_args: runtimeArgs,
    source_artifact_id: source.id,
  });

  const runFetch = fetch(`${base}/api/agents/run`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: runBody,
  }).catch(e => {
    // Logged for operator visibility · the artifact row stays in queued
    // state and the reaper (§5.5) picks it up at the next tick.
    console.error('[agents/rerun] runFetch threw', e?.message);
  });

  // waitUntil from @vercel/functions keeps the Edge function alive past
  // the 202 return so the runFetch can establish + complete. Vercel Edge
  // does NOT pass context as a second handler arg (verified against the
  // Edge runtime docs 2026-05-19). The import-based pattern is canonical.
  try {
    waitUntil(runFetch);
  } catch (e) {
    // Local dev fallback: await inline so the response is delayed but
    // correct on non-Vercel runtimes.
    console.error('[agents/rerun] waitUntil unavailable, awaiting inline', e?.message);
    await runFetch;
  }

  // ─── 8. Return 202 ─────────────────────────────────────────────────────
  return json(202, {
    ok: true,
    dispatch_id: dispatchId,
    artifact_id: newArt.id,
    version: newArt.version,
    agent_slug: slug,
    qbp_source: resolvedSource,
  }, corsH);
}
