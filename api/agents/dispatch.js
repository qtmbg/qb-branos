// QB BrandOS · POST /api/agents/dispatch
//
// Chapter 4 · step 4 · the founder dispatch entry (outline §4 call 1,
// RULED YES). The first production UI path that can fire a Phase 02
// agent FIRST-RUN. Until this endpoint, a founder could only rerun an
// agent that had already delivered (api/agents/rerun.js needs a source
// artifact) or wait for the Phase 01 lock fan-out (Phase 01 only). A
// founder who finishes Phase 01 and wants their first logo direction had
// no button to press.
//
// This endpoint owns the row-creation step for a first run; the runtime
// (api/agents/run.js) owns the lifecycle thereafter. Same split as
// rerun.js: dispatch + artifact rows here, queued → generating →
// delivered/failed there.
//
// THE FOUR RULED CONSTRAINTS (operator, this run):
//   1. JWT-authenticated. resolveUser gates every request; the same JWT
//      is forwarded to run.js so the runtime resolves authMode='user'.
//   2. Tier enforcement pre-row, fails closed. Phase >= '02' agents
//      require Starter+. The gate runs BEFORE any dispatch or artifact
//      row is written, so an unentitled attempt leaves zero debris. An
//      unreadable profile rejects with its own named detail (fail
//      closed), never opens the gate. Identical gate to run.js + rerun.js.
//   3. Dependency check with the user-fixable missing_dependency path.
//      The agent's declared artifact_dependencies are checked pre-row.
//      A founder who has not finished Phase 01 gets a clean 422
//      missing_dependency naming the missing slug, with no debris, so the
//      Console can route them back to the exercise that produces it.
//   4. Single-in-flight guard · one producing dispatch per agent per
//      user. Enforced in two layers so a race cannot slip two through:
//        (a) a pre-check read rejects when a non-terminal artifact
//            (status queued | generating) already exists for this
//            (user, agent). Catches the common sequential double-click.
//        (b) the artifacts insert lands at version = max + 1 against the
//            DB unique index (user_id, artifact_type, version). Two truly
//            simultaneous requests both compute the same next version, so
//            the second insert violates the unique index (Postgres 23505)
//            and is rejected; its just-created dispatch row is deleted so
//            no orphan producing dispatch survives. The DB index is the
//            atomic backstop the read pre-check cannot provide.
//
// Uploaded files are agent-read only (operator ruling): they are signed
// and passed to the runtime in runtime_args.files for the agent's vision
// read. They are never rendered inline anywhere. The file-validation +
// signing block mirrors api/agents/rerun.js verbatim (vision MIME + 5 MB
// cap, ownership, PNG-export instruction on SVG); a future refactor can
// extract the shared block, deferred this run to keep the proven rerun
// path untouched.

import { cors, json, resolveUser, svcHeaders, requireEnv } from '../_lib/auth.js';
import { getAgent } from '../../agents/registry.js';
import { VISION_READABLE_MIME, VISION_MAX_FILE_SIZE_BYTES, CANONICAL_TIERS } from '../../agents/contract.js';
import { waitUntil } from '@vercel/functions';
import { parseUserUploadPath, mimeFromExt, fileIdFromSegment, ALLOWED_MIME_TYPES, BUCKET } from '../files/_lib/file-config.js';

export const config = { runtime: 'edge' };

// Read the stored object's size from the storage list API. Mirrors
// rerun.js fetchObjectSize. Returns the byte size, or null when not found.
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

// Verifiable row rollback (step-4 adversarial-review finding). A fire-and-
// forget DELETE that transient-fails would strand a 'producing' dispatch
// with zero children, which the reaper can never reap (it bails on a
// zero-child dispatch and the terminal-flip sees nothing outstanding), or a
// 'queued' artifact. So we DELETE and, only if that fails, flip the row to a
// terminal, console-invisible, reaper-invisible state instead of leaving it
// stranded. 'partial' for the dispatch is read by neither the Console
// (producing | failed_permanently) nor the reaper (producing); a 'failed'
// artifact is excluded from the delivered-only Console read.
async function rollbackDispatch(env, dispatchId) {
  if (!dispatchId) return;
  const del = await fetch(
    `${env.SUPABASE_URL}/rest/v1/dispatch_jobs?id=eq.${encodeURIComponent(dispatchId)}`,
    { method: 'DELETE', headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  ).catch(() => null);
  if (del && del.ok) return;
  console.error('[agents/dispatch] dispatch rollback DELETE failed · flipping terminal', dispatchId, del?.status);
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/dispatch_jobs?id=eq.${encodeURIComponent(dispatchId)}`,
    { method: 'PATCH', headers: { ...svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY), Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'partial', agents_settled: 0, completed_at: new Date().toISOString() }) }
  ).catch(() => {});
}
async function rollbackArtifact(env, artifactId) {
  if (!artifactId) return;
  const del = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts?id=eq.${encodeURIComponent(artifactId)}`,
    { method: 'DELETE', headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  ).catch(() => null);
  if (del && del.ok) return;
  console.error('[agents/dispatch] artifact rollback DELETE failed · flipping failed', artifactId, del?.status);
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts?id=eq.${encodeURIComponent(artifactId)}`,
    { method: 'PATCH', headers: { ...svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY), Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'failed', updated_at: new Date().toISOString() }) }
  ).catch(() => {});
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

  // Forward the same JWT to /api/agents/run so the runtime resolves
  // authMode='user' (and force_error stays HMAC-gated, never honored here).
  const authHeader = req.headers.get('authorization') || '';

  // ─── 2. Parse body ─────────────────────────────────────────────────────
  let body;
  try { body = await req.json(); }
  catch { return json(400, { error: 'invalid_body' }, corsH); }

  const { agent_slug, qbp_source, feedback, files: bodyFiles } = body || {};
  if (typeof agent_slug !== 'string' || !agent_slug) {
    return json(400, { error: 'invalid_agent_slug' }, corsH);
  }
  // First-run dispatch always reads the live QBP. 'original' is meaningless
  // without a source artifact, so it collapses to 'current' here.
  const resolvedSource = 'current';
  const resolvedFeedback = typeof feedback === 'string' && feedback.trim() ? feedback.trim() : null;

  // ─── 3. Resolve agent META ────────────────────────────────────────────
  // getAgent reads test-agent env flags at REQUEST time (chapter-3 step-3E).
  const agent = getAgent(agent_slug);
  if (!agent) return json(400, { error: 'unknown_agent', agent_slug }, corsH);
  const meta = agent.META;
  const slug = meta.artifact_type || agent_slug;

  // ─── 4. Tier gate · pre-row, fails closed (constraint 2) ──────────────
  // Identical to run.js + rerun.js. Runs before any row is written.
  if (meta.phase >= '02') {
    const tierRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?select=tier&id=eq.${encodeURIComponent(userId)}`,
      { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
    );
    const tierRows = tierRes.ok ? await tierRes.json().catch(() => null) : null;
    const tier = tierRows?.[0]?.tier;
    const userRank = CANONICAL_TIERS.indexOf(tier);
    const requiredRank = CANONICAL_TIERS.indexOf(meta.tier_required);
    if (!tierRes.ok || !Array.isArray(tierRows) || userRank === -1) {
      console.error('[agents/dispatch] tier gate could not verify profile tier', userId, tierRes.status);
      return json(403, { error: 'tier_unverified',
                          detail: `profile tier unreadable for paid agent ${slug} · failing closed` }, corsH);
    }
    if (userRank < requiredRank) {
      return json(403, { error: 'tier_insufficient',
                          detail: `${slug} requires tier ${meta.tier_required} or above · profile tier is ${tier}` }, corsH);
    }
  }

  // ─── 5. Dependency pre-check · clean missing_dependency (constraint 3) ─
  // The agent's declared dependencies must be delivered before a first
  // run. Checked pre-row so a Phase-01-incomplete founder gets a clean
  // 422 with the missing slug and zero debris. run.js re-validates this
  // defensively; surfacing it here is what lets the Console route back.
  const depSlugs = meta.inputs?.artifact_dependencies || [];
  for (const depSlug of depSlugs) {
    const r = await fetch(
      `${env.SUPABASE_URL}/rest/v1/artifacts` +
      `?user_id=eq.${encodeURIComponent(userId)}` +
      `&artifact_type=eq.${encodeURIComponent(depSlug)}` +
      `&status=eq.delivered&select=id&limit=1`,
      { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
    );
    if (!r.ok) {
      // A read failure must not masquerade as a missing dependency (that
      // would route a founder who DID finish Phase 01 back to it). Fail
      // closed with a distinct code so the Console shows a retry, not a
      // dead end.
      console.error('[agents/dispatch] dependency read failed', depSlug, r.status);
      return json(503, { error: 'dependency_unverified',
                          detail: `could not verify dependency ${depSlug} · try again` }, corsH);
    }
    const rows = await r.json().catch(() => []);
    if (!rows?.length) {
      return json(422, { error: 'missing_dependency', missing_slug: depSlug,
                          detail: `${slug} needs your delivered ${depSlug} first · finish that Phase 01 exercise, then run this` }, corsH);
    }
  }

  // ─── 6. Required-file pre-check + file validation/signing ──────────────
  // Required-by-META files must be present in the body, pre-row, so a
  // founder who forgot to attach their logo gets a clean 422 instead of a
  // failed artifact. Then every supplied file is validated and signed.
  // This block mirrors api/agents/rerun.js (vision discipline, ownership,
  // size cap). Uploaded files are agent-read only · never rendered inline.
  const resolvedFiles = Array.isArray(bodyFiles) ? bodyFiles : [];
  const requiredFileTypes = (meta.inputs?.files || [])
    .filter(f => f && f.optional === false)
    .map(f => f.type);
  const presentTypes = new Set(resolvedFiles.map(f => f?.type));
  const missingFileTypes = requiredFileTypes.filter(t => !presentTypes.has(t));
  if (missingFileTypes.length > 0) {
    return json(422, { error: 'missing_inputs', missing_files: missingFileTypes,
                        detail: `${slug} needs ${missingFileTypes.join(', ')} · attach it and run again` }, corsH);
  }

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
    // Vision discipline for every file an agent reads through Claude
    // vision. Narrower than the bucket allowlist (no SVG, no PDF) and the
    // 5 MB per-image cap. The logo-image detail is founder-facing: it
    // says what to do, not just what went wrong.
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
      const size = await fetchObjectSize({ env, parsed });
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

  // ─── 7. Single-in-flight pre-check · read layer (constraint 4a) ───────
  // Reject if a non-terminal artifact already exists for this (user,
  // agent). Catches the sequential double-click before any row is written.
  const inflightRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&artifact_type=eq.${encodeURIComponent(slug)}` +
    `&status=in.(queued,generating)&select=id,status,version&limit=1`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (inflightRes.ok) {
    const inflight = (await inflightRes.json().catch(() => []))?.[0];
    if (inflight) {
      return json(409, { error: 'dispatch_in_flight', agent_slug: slug,
                          artifact_id: inflight.id, status: inflight.status,
                          detail: `${meta.display_name} is already producing for you (v${inflight.version}, ${inflight.status}) · wait for it to finish before running it again` }, corsH);
    }
  } else {
    console.error('[agents/dispatch] in-flight pre-check read failed', slug, inflightRes.status);
    // Do not block on a read failure · the DB unique index (7b) is the
    // hard guard. Fall through.
  }

  // ─── 8. Insert dispatch_jobs row ──────────────────────────────────────
  const djRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/dispatch_jobs`,
    {
      method: 'POST',
      headers: { ...svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userId,
        kind: 'manual',
        status: 'producing',
        agents_count: 1,
        agents_settled: 0,
        trigger: 'manual',
        agent_version: meta.version,
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

  // ─── 9. Insert artifacts row · version = max+1 (constraint 4b) ─────────
  // Version is GLOBAL per (user_id, artifact_type) · max+1. For a true
  // first run max is null → version 1. The DB unique index on
  // (user_id, artifact_type, version) is the atomic single-in-flight
  // backstop: two simultaneous requests compute the same next version and
  // the loser violates the index (23505). On any insert failure we delete
  // the dispatch row created above so no orphan producing dispatch
  // survives, then return the named conflict.
  const verRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&artifact_type=eq.${encodeURIComponent(slug)}` +
    `&select=version&order=version.desc&limit=1`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  // Fail closed on a version-read failure (step-4 review finding). Falling
  // back to version 1 here would collide with a delivered v1 on the unique
  // index and surface a misleading 'dispatch_in_flight' on settled work.
  // Roll back the dispatch row created above, then ask the founder to retry.
  if (!verRes.ok) {
    console.error('[agents/dispatch] version read failed', slug, verRes.status);
    await rollbackDispatch(env, dispatchId);
    return json(503, { error: 'version_unverified',
                        detail: `could not read the current version for ${slug} · try again` }, corsH);
  }
  const verRows = await verRes.json().catch(() => []);
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
        parent_artifact_id: null,
        phase: meta.phase,
        content: {},
        error: null,
        dispatch_id: dispatchId,
      }),
    }
  );
  if (!artRes.ok) {
    const t = await artRes.text().catch(() => '');
    // Roll back the dispatch row so the race-loser leaves no debris. Verifiable
    // (DELETE, else flip terminal) so a transient DELETE failure cannot strand
    // a zero-child 'producing' dispatch the reaper can never reap.
    await rollbackDispatch(env, dispatchId);
    const isUniqueViolation = artRes.status === 409 || /23505|duplicate key/i.test(t);
    if (isUniqueViolation) {
      return json(409, { error: 'dispatch_in_flight', agent_slug: slug,
                          detail: `${meta.display_name} is already producing for you · wait for it to finish before running it again` }, corsH);
    }
    return json(500, { error: 'artifact_insert_failed', detail: t.slice(0, 200) }, corsH);
  }
  const newArt = (await artRes.json().catch(() => []))?.[0];
  if (!newArt?.id) return json(500, { error: 'artifact_insert_returned_no_id' }, corsH);

  // ─── 9b. Race resolution · single-in-flight, the cross-version case ─────
  // The (user, type, version) unique index only collides when two concurrent
  // requests compute the SAME next version. When one request's version-read
  // happens to see the other's just-committed row, it computes a HIGHER
  // version and its insert does NOT collide, so a second in-flight dispatch
  // would slip through (caught empirically by the founder-dispatch harness'
  // simultaneous-race case). Close it without a migration: after our own
  // insert, re-read non-terminal artifacts for (user, agent). If any exists at
  // a LOWER version than ours, that request won the race, so we roll our rows
  // back and report dispatch_in_flight. The lowest version in a concurrent set
  // sees nothing below it and proceeds, so exactly one survives. A higher
  // version necessarily read after the lower one committed, so it WILL see the
  // lower row here. Terminal prior rows (delivered/failed) are excluded, so a
  // legitimate sequential re-run is never blocked. This also closes the gap
  // where the step-7 pre-check read failed and fell through.
  const raceRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&artifact_type=eq.${encodeURIComponent(slug)}` +
    `&status=in.(queued,generating)&select=id,version&order=version.asc`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (raceRes.ok) {
    const rows = await raceRes.json().catch(() => []);
    const lower = Array.isArray(rows)
      ? rows.find(a => a.id !== newArt.id && Number(a.version) < Number(newArt.version))
      : null;
    if (lower) {
      await rollbackArtifact(env, newArt.id);
      await rollbackDispatch(env, dispatchId);
      return json(409, { error: 'dispatch_in_flight', agent_slug: slug,
                          detail: `${meta.display_name} is already producing for you · wait for it to finish before running it again` }, corsH);
    }
  } else {
    console.error('[agents/dispatch] race-resolution read failed', slug, raceRes.status);
    // Non-fatal: the same-version unique index still holds; the cross-version
    // window reverts to the pre-fix exposure only on this rare read failure.
  }

  // ─── 10. Sign files, then fire /api/agents/run via waitUntil ──────────
  const base = new URL(req.url).origin;
  const signedFiles = [];
  for (const f of resolvedFiles) {
    const signRes = await fetch(`${base}/api/files/sign-url`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: f.path }),
    });
    if (!signRes.ok) {
      const detail = await signRes.text().catch(() => '');
      // Verifiable cleanup so a sign failure strands neither a 'queued'
      // artifact nor a 'producing' dispatch (DELETE, else flip terminal).
      await rollbackArtifact(env, newArt.id);
      await rollbackDispatch(env, dispatchId);
      return json(signRes.status === 404 ? 404 : 500, {
        error: 'sign_failed', path: f.path, detail: detail.slice(0, 200),
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
    trigger: 'manual',
    runtime_args: runtimeArgs,
  });

  const runFetch = fetch(`${base}/api/agents/run`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: runBody,
  }).catch(e => {
    // The artifact stays queued and the reaper (§5.5) picks it up.
    console.error('[agents/dispatch] runFetch threw', e?.message);
  });

  try {
    waitUntil(runFetch);
  } catch (e) {
    console.error('[agents/dispatch] waitUntil unavailable, awaiting inline', e?.message);
    await runFetch;
  }

  // ─── 11. Return 202 ────────────────────────────────────────────────────
  return json(202, {
    ok: true,
    dispatch_id: dispatchId,
    artifact_id: newArt.id,
    version: newArt.version,
    agent_slug: slug,
    trigger: 'manual',
    qbp_source: resolvedSource,
  }, corsH);
}
