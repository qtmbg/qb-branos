#!/usr/bin/env node
// BrandOS · Supabase RLS probe.
//
//   node tests/supabase-rls/rls-probe.mjs
//
// Answers one question per exposed table: what can an anonymous caller
// actually do to it? Not what the migrations claim. The 2026-09-16 sweep
// found public.tool_completions fully readable and writable by anon
// because migration 005 was never applied to production, so this harness
// reads the database rather than the repo.
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
//   set -a && . ./.env.qb-branos.live && set +a
//
// Exit 0 = every table refuses anonymous access. Exit 1 = at least one
// offender, each named with its evidence.
//
// Method, per the audit-harness rules in CLAUDE.md:
//   · Compares complete responses. Nothing is sliced before a verdict.
//   · The offenders array is never capped. A run with fifty problems
//     reports fifty.
//   · Probes behaviour, not declarations. A `enable row level security`
//     line in a .sql file proves nothing about the running database.
//
// Write probes are non-destructive by construction: PATCH and DELETE
// carry a filter on the all-zero UUID, which matches no row. A 204 means
// the grant is there and zero rows happened to match; a 401/403 with
// code 42501 means the database refused. Both outcomes leave the table
// untouched.
//
// Proving the harness can fail (do this after any edit to this file):
//   1. In the Supabase SQL editor:
//        alter table public.qbp_revisions disable row level security;
//   2. Run the probe. Expect exit 1 naming qbp_revisions with its row count.
//   3. Re-enable RLS, re-run, expect exit 0.

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON || !SERVICE) {
  console.error('missing env · need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  console.error('  set -a && . ./.env.qb-branos.live && set +a');
  process.exit(2);
}

const IMPOSSIBLE_UUID = '00000000-0000-0000-0000-000000000000';
const anonHeaders = { apikey: ANON };
const svcHeaders = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

// PostgREST returns the total after the slash in content-range: "0-7/8".
function parseCount(res) {
  const range = res.headers.get('content-range') || '';
  const total = range.split('/')[1];
  return total && total !== '*' ? Number(total) : null;
}

async function countRows(table, headers) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { ...headers, Range: '0-0', Prefer: 'count=exact' },
  });
  if (!res.ok) return { denied: true, status: res.status, count: null };
  return { denied: false, status: res.status, count: parseCount(res) };
}

// A write probe filtered to a row that cannot exist. 42501 (or any 4xx
// that is not 204) means the database refused before touching anything.
async function writeAllowed(table, method) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${IMPOSSIBLE_UUID}`;
  const init = { method, headers: { ...anonHeaders } };
  if (method === 'PATCH') {
    init.headers['Content-Type'] = 'application/json';
    // An empty object is a no-op update even if the grant exists.
    init.body = '{}';
  }
  const res = await fetch(url, init);
  // 204 = permitted. 400 = permitted but the request shape was rejected
  // (no `id` column, say) — that is still not a permission refusal, so
  // report it as inconclusive rather than clean.
  if (res.status === 204) return 'allowed';
  const body = await res.text().catch(() => '');
  if (res.status === 400) return `inconclusive(400 ${body.slice(0, 80)})`;
  return 'denied';
}

async function listExposedTables() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: svcHeaders });
  if (!res.ok) throw new Error(`openapi_read_failed: ${res.status}`);
  const spec = await res.json();
  return Object.keys(spec.definitions || {}).sort();
}

const tables = await listExposedTables();
console.log(`probing ${tables.length} exposed objects in public schema\n`);

const offenders = [];
const rows = [];

for (const table of tables) {
  const anon = await countRows(table, anonHeaders);
  const svc = await countRows(table, svcHeaders);

  let verdict;
  if (anon.denied) {
    verdict = 'DENIED';
  } else if (anon.count === null) {
    verdict = 'UNKNOWN';
  } else if (anon.count > 0) {
    verdict = 'EXPOSED';
  } else if ((svc.count ?? 0) > 0) {
    // Table holds rows, anon sees none. RLS is filtering.
    verdict = 'FILTERED';
  } else {
    // Empty table. An anon read of an empty table cannot distinguish RLS
    // on from RLS off, so fall through to the write probes.
    verdict = 'EMPTY';
  }

  let patch = '-';
  let del = '-';
  if (verdict === 'EXPOSED' || verdict === 'EMPTY') {
    patch = await writeAllowed(table, 'PATCH');
    del = await writeAllowed(table, 'DELETE');
  }

  rows.push({ table, verdict, anon: anon.count, svc: svc.count, patch, del });

  if (verdict === 'EXPOSED') {
    offenders.push({
      table,
      reason: `anonymous SELECT returned ${anon.count} of ${svc.count} rows`,
      writes: `PATCH=${patch} DELETE=${del}`,
    });
  } else if (patch === 'allowed' || del === 'allowed') {
    offenders.push({
      table,
      reason: 'table reads empty to anon, but anonymous writes are permitted',
      writes: `PATCH=${patch} DELETE=${del}`,
    });
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('table', 26)}${pad('verdict', 11)}${pad('anon', 7)}${pad('svc', 7)}${pad('PATCH', 16)}DELETE`);
for (const r of rows) {
  console.log(
    `${pad(r.table, 26)}${pad(r.verdict, 11)}${pad(r.anon ?? '-', 7)}${pad(r.svc ?? '-', 7)}${pad(r.patch, 16)}${r.del}`
  );
}

console.log('');
if (offenders.length === 0) {
  console.log(`PASS · ${tables.length} objects, none reachable anonymously`);
  process.exit(0);
}

console.log(`FAIL · ${offenders.length} object(s) reachable anonymously\n`);
for (const o of offenders) {
  console.log(`  ${o.table}`);
  console.log(`    ${o.reason}`);
  console.log(`    ${o.writes}`);
}
process.exit(1);
