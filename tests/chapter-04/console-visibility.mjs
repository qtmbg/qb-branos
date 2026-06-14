/* Chapter 4 · Step 4 · Console-visibility verification (released-state)
 *
 * Confirms the PROMPT_HOLD_SLUGS release took effect in production: a
 * Starter identity's GET /api/agents/console payload now carries the three
 * Phase 02 agents in agents[] (logo_direction_agent, logo_evaluation_agent,
 * voice_guide_agent), and Phase 02 is no longer a locked_phase_cards entry
 * (retired in favor of the live cards). Phase 03 stays locked.
 *
 * Usage: node tests/chapter-04/console-visibility.mjs
 * Env: .env.qb-branos.live (repo root, gitignored) or QB_ENV_FILE.
 */

import fs from 'node:fs';

const ENV_PATH = process.env.QB_ENV_FILE || '.env.qb-branos.live';
const BASE = process.env.QB_BASE || 'https://quantumbranding.ai';
const fileEnv = fs.existsSync(ENV_PATH)
  ? Object.fromEntries(fs.readFileSync(ENV_PATH, 'utf8').split('\n')
      .map(l => l.match(/^([A-Z0-9_]+)="?([^"]*)"?$/)).filter(Boolean).map(m => [m[1], m[2]]))
  : {};
const env = { ...process.env, ...fileEnv };
const SU = env.SUPABASE_URL, SK = env.SUPABASE_SERVICE_ROLE_KEY, AK = env.SUPABASE_ANON_KEY;
if (!SU || !SK || !AK) { console.error('MISSING ENV'); process.exit(2); }
const svc = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Accept: 'application/json' };
const uuid = () => crypto.randomUUID();
async function must(r, what) { if (!r.ok) throw new Error(`${what}: ${r.status} ${(await r.text().catch(()=> '')).slice(0,200)}`); return r; }

async function makeStarter() {
  const email = `qb-ch4s4-cv-${uuid().slice(0,8)}@qb-harness.test`;
  const password = `Qb-${uuid()}`;
  const u = await (await must(await fetch(`${SU}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) }), 'createUser')).json();
  await must(await fetch(`${SU}/rest/v1/profiles`, { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: u.id, email, tier: 'starter', foundation_locked_at: new Date().toISOString() }) }), 'profile');
  const tok = (await (await must(await fetch(`${SU}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: AK, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }), 'signin')).json()).access_token;
  return { id: u.id, token: tok };
}
async function teardown(user) {
  await fetch(`${SU}/rest/v1/profiles?id=eq.${user.id}`, { method: 'DELETE', headers: svc }).catch(()=>{});
  await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: svc }).catch(()=>{});
  return !(await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { headers: svc })).ok;
}

async function main() {
  const out = { harness: 'console-visibility', started_at: new Date().toISOString(), base_url: BASE };
  let user = null;
  try {
    user = await makeStarter();
    const r = await fetch(`${BASE}/api/agents/console`, { headers: { Authorization: `Bearer ${user.token}` } });
    const payload = await r.json().catch(() => ({}));
    const slugs = (payload.agents || []).map(a => a.slug);
    const lockedPhases = (payload.locked_phase_cards || []).map(c => c.phase);
    out.http = r.status;
    out.agent_slugs = slugs;
    out.locked_phases = lockedPhases;
    out.logo_direction_visible = slugs.includes('logo_direction_agent');
    out.logo_evaluation_visible = slugs.includes('logo_evaluation_agent');
    out.voice_guide_visible = slugs.includes('voice_guide_agent');
    out.phase02_locked_card_retired = !lockedPhases.includes('02');
    out.phase03_still_locked = lockedPhases.includes('03');
    console.error(`[console] http=${r.status} agents=${JSON.stringify(slugs)} locked=${JSON.stringify(lockedPhases)}`);
  } catch (e) {
    out.failure_reason = String(e?.message || e);
  } finally {
    if (user) out.teardown_ok = await teardown(user);
  }
  out.pass = !out.failure_reason && out.http === 200
    && out.logo_direction_visible && out.logo_evaluation_visible && out.voice_guide_visible
    && out.phase02_locked_card_retired && out.phase03_still_locked && out.teardown_ok;
  out.completed_at = new Date().toISOString();
  fs.writeFileSync('tests/chapter-04/console-visibility.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
