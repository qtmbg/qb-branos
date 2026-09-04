#!/usr/bin/env node
/* QB BrandOS · test-client provisioner
 *
 * Gives an operator a real, signed-in browser session as a test client
 * without waiting on an email and without running a live Stripe charge.
 *
 * It does three things:
 *   1. Ensures the auth user exists (admin API, email pre-confirmed, so the
 *      handle_new_user trigger writes the profiles row).
 *   2. Sets profiles.tier + profiles.subscription_status directly, which is
 *      what every gate reads. Server side: TIER_RANK in api/_lib/chain-trigger.js
 *      and the tier_insufficient checks in run.js / dispatch.js / rerun.js.
 *      Client side: QB.hasAccess() in qb-cloud.js needs status 'active' and a
 *      non-free tier.
 *   3. Mints a single-use magic link via /auth/v1/admin/generate_link and
 *      prints it. Supabase does NOT send mail for generate_link, so no inbox
 *      is involved. Paste the URL into a browser and you land authenticated
 *      on /foundation via auth-callback.html.
 *
 * Commands:
 *   login   ensure user + tier, print a fresh sign-in URL   (default)
 *   status  read back the profile and its live artifacts
 *   reset   wipe the client's work, keep the account
 *   delete  remove the client entirely (rows + auth user)
 *
 * Flags:
 *   --email <addr>    default qb-testclient@quantumbranding.ai
 *   --tier  <t>       free | starter | pro | agency | atelier   (default agency)
 *   --name  <first>   default Test
 *   --base  <origin>  default https://quantumbranding.ai
 *   --reset           on login: clear prior work before minting the link
 *   --yes             skip the confirmation prompt on delete
 *
 * Env: .env.qb-branos.live (repo root, gitignored · vercel env pull) or
 * QB_ENV_FILE, else process.env. Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import fs from 'node:fs';
import readline from 'node:readline';

const ENV_PATH = process.env.QB_ENV_FILE || '.env.qb-branos.live';
const fileEnv = fs.existsSync(ENV_PATH)
  ? Object.fromEntries(
      fs.readFileSync(ENV_PATH, 'utf8').split('\n')
        .map(l => l.match(/^([A-Z0-9_]+)="?([^"]*)"?$/)).filter(Boolean).map(m => [m[1], m[2]])
    )
  : {};
const env = { ...process.env, ...fileEnv };
const SU = env.SUPABASE_URL, SK = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SU || !SK) {
  console.error(`MISSING ENV · need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
Run \`vercel env pull ${ENV_PATH}\` or export them, then retry.`);
  process.exit(2);
}

const argv = process.argv.slice(2);
const cmd = (argv[0] && !argv[0].startsWith('--')) ? argv.shift() : 'login';
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const has  = (n) => argv.includes(`--${n}`);

const EMAIL = (flag('email', 'qb-testclient@quantumbranding.ai') || '').trim().toLowerCase();
const TIER  = (flag('tier', 'agency') || '').trim().toLowerCase();
const NAME  = flag('name', 'Test');
const BASE  = (flag('base', 'https://quantumbranding.ai') || '').replace(/\/$/, '');
const TIERS = ['free', 'starter', 'pro', 'agency', 'atelier'];

if (!/.+@.+\..+/.test(EMAIL)) { console.error(`Bad --email: ${EMAIL}`); process.exit(2); }
if (!TIERS.includes(TIER))    { console.error(`Bad --tier: ${TIER} · one of ${TIERS.join(', ')}`); process.exit(2); }

const svc = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Accept: 'application/json' };
const q = encodeURIComponent;

async function must(r, what) {
  if (!r.ok) throw new Error(`${what} · ${r.status} ${(await r.text().catch(() => '')).slice(0, 300)}`);
  return r;
}
async function rest(path, init = {}) {
  return fetch(`${SU}/rest/v1/${path}`, { ...init, headers: { ...svc, ...(init.headers || {}) } });
}

async function findUser(email) {
  // GoTrue admin list supports a filter on email. Falls back to a page scan.
  const r = await fetch(`${SU}/auth/v1/admin/users?filter=${q(email)}&per_page=200`, { headers: svc });
  if (!r.ok) return null;
  const d = await r.json().catch(() => ({}));
  return (d.users || []).find(u => (u.email || '').toLowerCase() === email) || null;
}

async function ensureUser() {
  const existing = await findUser(EMAIL);
  if (existing) return { user: existing, created: false };
  const r = await must(await fetch(`${SU}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({
      email: EMAIL, email_confirm: true,
      user_metadata: { first_name: NAME, signup_source: 'qb-test-client' },
    }),
  }), 'create user');
  return { user: await r.json(), created: true };
}

async function setTier(userId) {
  // Upsert rather than PATCH: the handle_new_user trigger owns row creation,
  // but an account created before the trigger existed would have no row.
  const status = TIER === 'free' ? 'inactive' : 'active';
  await must(await rest('profiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: userId, email: EMAIL, first_name: NAME,
      tier: TIER, subscription_status: status,
      tier_started_at: new Date().toISOString(),
      signup_source: 'qb-test-client',
    }),
  }), 'set tier');
  return status;
}

async function magicLink() {
  const r = await must(await fetch(`${SU}/auth/v1/admin/generate_link`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({
      type: 'magiclink', email: EMAIL,
      redirect_to: `${BASE}/auth-callback.html`,
      data: { first_name: NAME, signup_source: 'qb-test-client' },
    }),
  }), 'generate_link');
  const d = await r.json();
  const link = d?.properties?.action_link || d?.action_link;
  if (!link) throw new Error('generate_link returned no action_link');
  return link;
}

async function readProfile(userId) {
  const r = await rest(`profiles?select=email,first_name,tier,subscription_status,foundation_locked_at,qbp,tool_completions&id=eq.${q(userId)}`);
  if (!r.ok) return null;
  return (await r.json().catch(() => []))[0] || null;
}

async function listArtifacts(userId) {
  const r = await rest(`artifacts?select=artifact_type,status,version,phase,updated_at&user_id=eq.${q(userId)}&order=updated_at.desc`);
  return r.ok ? await r.json().catch(() => []) : [];
}

async function wipeWork(userId) {
  const wiped = [];
  // agent_runs is the post-011 name; artifact_runs is the pre-rename name.
  for (const t of ['agent_runs', 'artifact_runs', 'artifacts', 'dispatch_jobs', 'notifications', 'qbp_revisions']) {
    const r = await rest(`${t}?user_id=eq.${q(userId)}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
    if (!r.ok) continue; // table absent under this name, or no delete grant
    const rows = await r.json().catch(() => []);
    wiped.push(`${t}:${Array.isArray(rows) ? rows.length : 0}`);
  }
  await rest(`profiles?id=eq.${q(userId)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ qbp: {}, tool_completions: {}, foundation_locked_at: null, drip_stage: 'pre_signup' }),
  });
  // Best-effort: uploaded logos and briefs under the user's storage prefix.
  try {
    const l = await fetch(`${SU}/storage/v1/object/list/user-uploads`, {
      method: 'POST', headers: svc, body: JSON.stringify({ prefix: `${userId}/`, limit: 200 }),
    });
    if (l.ok) {
      const objs = (await l.json().catch(() => [])).map(o => `${userId}/${o.name}`);
      if (objs.length) {
        await fetch(`${SU}/storage/v1/object/user-uploads`, {
          method: 'DELETE', headers: svc, body: JSON.stringify({ prefixes: objs }),
        });
        wiped.push(`uploads:${objs.length}`);
      }
    }
  } catch (_) { /* storage cleanup is not load-bearing */ }
  return wiped;
}

async function confirm(question) {
  if (has('yes')) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = await new Promise(res => rl.question(`${question} (yes/no) `, res));
  rl.close();
  return a.trim().toLowerCase() === 'yes';
}

const rule = (s) => console.log(`\n${s}\n${'─'.repeat(s.length)}`);

(async () => {
  if (cmd === 'login') {
    const { user, created } = await ensureUser();
    if (has('reset')) {
      const wiped = await wipeWork(user.id);
      console.log(`reset · ${wiped.join('  ') || 'nothing to clear'}`);
    }
    const status = await setTier(user.id);
    const link = await magicLink();
    rule('QB BrandOS · test client ready');
    console.log(`email    ${EMAIL}`);
    console.log(`user_id  ${user.id}`);
    console.log(`account  ${created ? 'created' : 'existing'}`);
    console.log(`tier     ${TIER} · subscription_status ${status}`);
    console.log(`target   ${BASE}`);
    rule('Sign-in URL · single use, expires in 60 minutes');
    console.log(link);
    console.log(`
Paste that into a browser. It lands on /auth-callback.html and forwards to
/foundation already signed in. Re-run this command for a fresh URL whenever
the link is spent. To start the run clean, add --reset.
`);
    return;
  }

  if (cmd === 'status') {
    const user = await findUser(EMAIL);
    if (!user) { console.log(`No account for ${EMAIL}.`); process.exit(1); }
    const p = await readProfile(user.id);
    const arts = await listArtifacts(user.id);
    rule(`QB BrandOS · test client status`);
    console.log(`email     ${EMAIL}`);
    console.log(`user_id   ${user.id}`);
    console.log(`tier      ${p?.tier || '—'} · ${p?.subscription_status || '—'}`);
    console.log(`foundation_locked_at  ${p?.foundation_locked_at || 'not locked'}`);
    console.log(`qbp keys  ${Object.keys(p?.qbp || {}).length}`);
    console.log(`completions  ${Object.keys(p?.tool_completions || {}).join(', ') || 'none'}`);
    rule(`artifacts · ${arts.length}`);
    for (const a of arts) console.log(`${String(a.phase || '--').padEnd(3)} ${a.artifact_type.padEnd(28)} v${a.version} ${a.status}`);
    return;
  }

  if (cmd === 'reset') {
    const user = await findUser(EMAIL);
    if (!user) { console.log(`No account for ${EMAIL}.`); process.exit(1); }
    if (!await confirm(`Clear all work for ${EMAIL}? The account survives.`)) return console.log('Aborted.');
    const wiped = await wipeWork(user.id);
    console.log(`reset · ${wiped.join('  ') || 'nothing to clear'}`);
    return;
  }

  if (cmd === 'delete') {
    const user = await findUser(EMAIL);
    if (!user) { console.log(`No account for ${EMAIL}.`); process.exit(1); }
    if (!await confirm(`Delete ${EMAIL} (${user.id}) and every row it owns?`)) return console.log('Aborted.');
    const wiped = await wipeWork(user.id);
    await rest(`profiles?id=eq.${q(user.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    await must(await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: svc }), 'delete user');
    console.log(`deleted ${EMAIL} · ${wiped.join('  ')}`);
    return;
  }

  console.error(`Unknown command: ${cmd} · use login | status | reset | delete`);
  process.exit(2);
})().catch(e => { console.error(`FAILED · ${e.message}`); process.exit(1); });
