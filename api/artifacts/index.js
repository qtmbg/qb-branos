// QB BrandOS — GET /api/artifacts
// Returns the user's artifact list with computed `locked` flags. Never
// returns `content` (see /api/artifacts/[id] for the body).

import { cors, json, resolveUser, readProfile, svcHeaders, requireEnv } from '../_lib/auth.js';
import { canReadArtifact } from '../_lib/tier-gating.js';

export const config = { runtime: 'edge' };

const PHASE_RE = /^(00|01|02|03|04|05)$/;
const STATUS_RE = /^(queued|generating|delivered|failed)$/;

function titleFromContent(content, status) {
  if (status === 'queued' || status === 'generating') return 'Artifact (generating)';
  if (status === 'failed') return 'Artifact (failed)';
  if (content && typeof content === 'object' && content?.header?.title) {
    return String(content.header.title);
  }
  return 'Artifact';
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const corsH = cors(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' }, corsH);

  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const missing = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  if (missing) return json(503, { error: `Not configured: ${missing}` }, corsH);

  const authResult = await resolveUser(req, env);
  if (!authResult.ok) return json(authResult.status, { error: authResult.error }, corsH);

  const profile = await readProfile(authResult.user.id, env);
  if (!profile) return json(404, { error: 'Profile not found' }, corsH);

  const url = new URL(req.url);
  const phase = url.searchParams.get('phase') || '';
  const status = url.searchParams.get('status') || '';
  const mode = url.searchParams.get('mode') || '';
  let limit = parseInt(url.searchParams.get('limit') || '50', 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  limit = Math.min(limit, 200);

  if (phase && !PHASE_RE.test(phase)) {
    return json(400, { error: 'Invalid phase' }, corsH);
  }
  if (status && !STATUS_RE.test(status)) {
    return json(400, { error: 'Invalid status' }, corsH);
  }
  if (mode && mode !== 'chains') {
    return json(400, { error: 'Invalid mode' }, corsH);
  }

  // Step 11A · chain-traversal mode. When mode=chains, we ignore the
  // phase/status filters (chains are returned whole) but still respect
  // the user_id RLS + limit. Returns { chains, legacy } per spec §3.1.
  if (mode === 'chains') {
    return await handleChainsMode({
      env, userId: authResult.user.id, profile, limit, corsH,
    });
  }

  const params = new URLSearchParams({
    select: 'id,artifact_type,phase,status,version,content,created_at,updated_at',
    user_id: `eq.${authResult.user.id}`,
    order: 'created_at.desc',
    limit: String(limit),
  });
  if (phase) params.set('phase', `eq.${phase}`);
  if (status) params.set('status', `eq.${status}`);

  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/artifacts?${params.toString()}`, {
    headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    console.error('[artifacts] list fetch', r.status, t.slice(0, 200));
    return json(500, { error: 'Could not list artifacts' }, corsH);
  }
  const rows = await r.json().catch(() => []);

  const artifacts = rows.map(row => ({
    id: row.id,
    title: titleFromContent(row.content, row.status),
    agent_slug: row.artifact_type,
    phase: row.phase || null,
    status: row.status,
    version: row.version,
    created_at: row.created_at,
    locked: !canReadArtifact(profile.tier, row.artifact_type),
  }));

  return json(200, { artifacts }, corsH);
}

// Step 11A · chain-traversal mode handler. Per chapter-02/step-11-spec.md
// §3.1, returns the user's artifacts grouped into chain trees:
//   { chains: [{ chain_id, root_dispatch_id, lock_at, agents_count,
//                nodes: [{ agent_slug, artifacts, children }] }],
//     legacy: [{ id, artifact_type, version, status, created_at, title }] }
//
// Chain membership is determined by dispatch_jobs.chain_id, joined to
// artifacts via artifacts.dispatch_id. Artifacts whose dispatch has no
// chain_id (or whose dispatch row is missing) go to `legacy`. Branched
// reruns nest under their parent via parent_artifact_id.
async function handleChainsMode({ env, userId, profile, limit, corsH }) {
  // 1. Fetch all artifacts for the user (no phase/status filter in chain mode)
  const artifactParams = new URLSearchParams({
    select: 'id,artifact_type,phase,status,version,content,created_at,updated_at,dispatch_id,parent_artifact_id',
    user_id: `eq.${userId}`,
    order: 'created_at.desc',
    limit: String(limit),
  });
  const artR = await fetch(`${env.SUPABASE_URL}/rest/v1/artifacts?${artifactParams.toString()}`, {
    headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
  });
  if (!artR.ok) {
    console.error('[artifacts] chains mode · artifacts fetch', artR.status);
    return json(500, { error: 'Could not list artifacts' }, corsH);
  }
  const artifacts = await artR.json().catch(() => []);

  // 2. Fetch dispatch_jobs for those artifacts' dispatch_ids · we need
  //    chain_id per artifact to group, plus kind='lock' rows per chain
  //    for lock_at + root_dispatch_id metadata.
  const dispatchIds = Array.from(new Set(artifacts.map(a => a.dispatch_id).filter(Boolean)));
  let dispatchById = new Map();
  let chainIds = new Set();
  if (dispatchIds.length > 0) {
    const inList = dispatchIds.map(encodeURIComponent).join(',');
    const dispParams = new URLSearchParams({
      select: 'id,kind,chain_id,created_at,agent_slug',
      id: `in.(${inList})`,
    });
    const dR = await fetch(`${env.SUPABASE_URL}/rest/v1/dispatch_jobs?${dispParams.toString()}`, {
      headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
    });
    if (dR.ok) {
      const rows = await dR.json().catch(() => []);
      for (const row of rows) {
        dispatchById.set(row.id, row);
        if (row.chain_id) chainIds.add(row.chain_id);
      }
    }
  }

  // 3. Fetch the lock dispatch (kind='lock') per chain_id for lock_at
  //    metadata. chain_id seeds at the lock-foundation parent (step 8),
  //    so the lock dispatch has chain_id = its own id.
  let chainMeta = new Map(); // chain_id → { lock_at, root_dispatch_id }
  if (chainIds.size > 0) {
    const chainInList = Array.from(chainIds).map(encodeURIComponent).join(',');
    const lockParams = new URLSearchParams({
      select: 'id,chain_id,created_at,kind',
      user_id: `eq.${userId}`,
      chain_id: `in.(${chainInList})`,
      kind: 'eq.lock',
    });
    const lockR = await fetch(`${env.SUPABASE_URL}/rest/v1/dispatch_jobs?${lockParams.toString()}`, {
      headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
    });
    if (lockR.ok) {
      const lockRows = await lockR.json().catch(() => []);
      for (const row of lockRows) {
        chainMeta.set(row.chain_id, {
          lock_at: row.created_at,
          root_dispatch_id: row.id,
        });
      }
    }
  }

  // 4. Group artifacts by chain_id (via their dispatch). Legacy = no
  //    chain_id (dispatch missing OR chain_id NULL).
  const chainsMap = new Map(); // chain_id → artifact[]
  const legacy = [];
  for (const art of artifacts) {
    const disp = art.dispatch_id ? dispatchById.get(art.dispatch_id) : null;
    const chainId = disp?.chain_id || null;
    if (!chainId) {
      legacy.push({
        id: art.id,
        artifact_type: art.artifact_type,
        version: art.version,
        status: art.status,
        created_at: art.created_at,
        title: titleFromContent(art.content, art.status),
        locked: !canReadArtifact(profile.tier, art.artifact_type),
      });
      continue;
    }
    if (!chainsMap.has(chainId)) chainsMap.set(chainId, []);
    chainsMap.get(chainId).push(art);
  }

  // 5. Build the per-chain tree. Group artifacts by agent_slug; within
  //    each agent_slug, nest by parent_artifact_id linkage (branched
  //    reruns become children of their parent).
  const chains = [];
  for (const [chainId, chainArtifacts] of chainsMap.entries()) {
    // Group by agent_slug (artifact_type)
    const bySlug = new Map();
    for (const a of chainArtifacts) {
      if (!bySlug.has(a.artifact_type)) bySlug.set(a.artifact_type, []);
      bySlug.get(a.artifact_type).push(a);
    }

    const nodes = [];
    for (const [agentSlug, slugArtifacts] of bySlug.entries()) {
      // Sort by version ascending; v1 is the canonical "root", v2+ are
      // either reruns of v1 or branches (parent_artifact_id linkage).
      slugArtifacts.sort((a, b) => (a.version || 0) - (b.version || 0));
      // Find roots (no parent_artifact_id in this slug's set) and build
      // child trees recursively. Most chains have just one artifact per
      // slug; branched reruns produce v2+ with parent_artifact_id.
      const artifactIdSet = new Set(slugArtifacts.map(a => a.id));
      const roots = slugArtifacts.filter(a =>
        !a.parent_artifact_id || !artifactIdSet.has(a.parent_artifact_id)
      );
      function buildArtifactNode(art) {
        const children = slugArtifacts.filter(c => c.parent_artifact_id === art.id);
        return {
          id: art.id,
          version: art.version,
          status: art.status,
          delivered_at: art.updated_at || art.created_at,
          title: titleFromContent(art.content, art.status),
          locked: !canReadArtifact(profile.tier, art.artifact_type),
          children: children.map(buildArtifactNode),
        };
      }
      nodes.push({
        agent_slug: agentSlug,
        artifacts: roots.map(buildArtifactNode),
      });
    }

    const meta = chainMeta.get(chainId) || { lock_at: null, root_dispatch_id: null };
    chains.push({
      chain_id: chainId,
      root_dispatch_id: meta.root_dispatch_id,
      lock_at: meta.lock_at,
      agents_count: nodes.length,
      nodes,
    });
  }

  // 6. Sort chains by lock_at descending (newest first); legacy already
  //    sorted by created_at desc from the SQL ORDER BY.
  chains.sort((a, b) => {
    const aT = a.lock_at ? new Date(a.lock_at).getTime() : 0;
    const bT = b.lock_at ? new Date(b.lock_at).getTime() : 0;
    return bT - aT;
  });

  return json(200, { ok: true, chains, legacy }, corsH);
}
