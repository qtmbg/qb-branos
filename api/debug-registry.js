// TEMP DIAGNOSTIC PROBE · chapter-3 step 3E · 2026-05-22
//
// Per chat 2026-05-22 rule #3 + operator-approved scope:
//   - Reads ONLY two test-flag env vars: FILE_TEST_AGENT, CHAIN_TEST_AGENT
//   - Returns key-presence (boolean) + type + length + char codes
//   - Does NOT return raw values
//   - Does NOT enumerate Object.keys(process.env)
//   - Does NOT touch any other env var
//   - Returns Object.keys(AGENTS) to compare against the registry's view
//
// Diagnostic purpose: pinpoint why FILE_TEST_AGENT === '1' evaluates
// false at module-init on a production deploy where the dashboard shows
// the var as set + clean.
//
// LIFECYCLE: This file deploys ONLY to a PR preview deploy. The PR closes
// without merging. This file NEVER lands on main.

export const config = { runtime: 'edge' };

import { AGENTS } from '../agents/registry.js';

function inspect(name) {
  const value = process.env[name];
  return {
    present: name in process.env,
    type: typeof value,
    length: typeof value === 'string' ? value.length : null,
    charCodes: typeof value === 'string' ? value.split('').map(c => c.charCodeAt(0)) : null,
  };
}

export default async function handler(req) {
  return new Response(JSON.stringify({
    agents: Object.keys(AGENTS),
    file_test: inspect('FILE_TEST_AGENT'),
    chain_test: inspect('CHAIN_TEST_AGENT'),
  }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
