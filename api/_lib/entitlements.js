// api/_lib/entitlements.js
// Recut Phase 5 · docs/strategy/brandos-recut-v1.md
//
// Entitlement stopped being a tier string on a profile and became a fact
// about a purchase: does this user own the Platform for this brand.
//
// The old tier ladder (free / starter / pro / agency) is still read by
// api/_lib/tier-gating.js for the agents, and is left alone here. This
// module answers one question, and only for the paid document.
//
// FAILS CLOSED, deliberately and in every direction:
//   - table missing (migration 024 not applied in production yet)
//   - query error
//   - no session
// all resolve to "owns nothing". A misconfigured deploy must sell
// nothing rather than give the document away, and the reason is
// returned so the caller can tell a real "not purchased" from a broken
// database.

import { svcHeaders } from './auth.js';

export const DEFAULT_BRAND_KEY = 'default';

/**
 * @returns {Promise<{owned: boolean, reason: string}>}
 */
export async function ownsPlatform(userId, env, brandKey = DEFAULT_BRAND_KEY) {
  if (!userId) return { owned: false, reason: 'no_user' };
  if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) {
    return { owned: false, reason: 'not_configured' };
  }

  let res;
  try {
    res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/platform_purchases` +
      `?select=id&user_id=eq.${encodeURIComponent(userId)}` +
      `&brand_key=eq.${encodeURIComponent(brandKey)}&limit=1`,
      { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
    );
  } catch (e) {
    console.error('[entitlements] purchase lookup threw', e?.message);
    return { owned: false, reason: 'lookup_threw' };
  }

  // 404 with PGRST205 is PostgREST saying the table is not in the schema
  // cache, which is exactly the state production is in until migration
  // 024 is applied. Name it rather than reporting a generic failure.
  if (res.status === 404) {
    console.error('[entitlements] platform_purchases is missing · migration 024 not applied');
    return { owned: false, reason: 'table_missing' };
  }
  if (!res.ok) {
    console.error('[entitlements] purchase lookup failed', res.status);
    return { owned: false, reason: `lookup_failed_${res.status}` };
  }

  const rows = await res.json().catch(() => null);
  if (!Array.isArray(rows)) return { owned: false, reason: 'lookup_unparseable' };
  return rows.length > 0
    ? { owned: true, reason: 'purchased' }
    : { owned: false, reason: 'not_purchased' };
}
