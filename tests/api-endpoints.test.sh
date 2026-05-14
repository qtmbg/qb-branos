#!/usr/bin/env bash
# QB BrandOS — Chapter 1 / step 7 endpoint smoke test.
#
# Exercises every new endpoint against production. Mints a Supabase JWT
# for the existing test user using SUPABASE_JWT_SECRET (pulled via
# `vercel env pull`). Flips the test user's tier between free and starter
# to cover both gate paths, then restores to free.
#
# Required env (in /tmp/qb-prod.env from `vercel env pull --environment=production`):
#   SUPABASE_URL
#   SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#
# Auth: uses admin generate_link (type=magiclink) + /auth/v1/verify to
# mint a real Supabase session for the test user without triggering a
# production email. The action_link is returned to the API caller by
# admin generate_link; we exchange its token_hash directly via /verify.
#
# Usage:
#   bash tests/api-endpoints.test.sh

set -u

# ─── Config ────────────────────────────────────────────────────────────────
BASE="https://quantumbranding.ai"
ENV_FILE="/tmp/qb-prod.env"
USER_ID="3a92ffba-abce-4149-be0c-d593c84efdb3"
TEST_EMAIL="nizzar.ben+kvtest-srv-1037@gmail.com"

# ─── Helpers ───────────────────────────────────────────────────────────────
PASS=0
FAIL=0
LOG=()

assert_status() {
  local label="$1" want="$2" got="$3"
  if [ "$got" = "$want" ]; then
    PASS=$((PASS+1)); LOG+=("PASS  $label  ($got)")
  else
    FAIL=$((FAIL+1)); LOG+=("FAIL  $label  expected=$want got=$got")
  fi
}

assert_contains() {
  local label="$1" pattern="$2" body="$3"
  if printf '%s' "$body" | grep -q -- "$pattern"; then
    PASS=$((PASS+1)); LOG+=("PASS  $label  (contains: $pattern)")
  else
    FAIL=$((FAIL+1)); LOG+=("FAIL  $label  expected-contains=$pattern body=$(printf '%s' "$body" | head -c 200)")
  fi
}

# ─── Env load ──────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Run: vercel env pull $ENV_FILE --environment=production --yes"
  exit 2
fi
SUPABASE_URL=$(grep '^SUPABASE_URL=' "$ENV_FILE" | head -1 | sed -e 's/^[^=]*=//' -e 's/^"\(.*\)"$/\1/')
ANON_KEY=$(grep '^SUPABASE_ANON_KEY=' "$ENV_FILE" | head -1 | sed -e 's/^[^=]*=//' -e 's/^"\(.*\)"$/\1/')
SERVICE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | head -1 | sed -e 's/^[^=]*=//' -e 's/^"\(.*\)"$/\1/')

if [ -z "$SUPABASE_URL" ] || [ -z "$ANON_KEY" ] || [ -z "$SERVICE_KEY" ]; then
  echo "Missing one of SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY"
  exit 2
fi

# ─── Mint a real Supabase session for the test user (no email sent) ───────
mint_session() {
  node --no-warnings -e '
    (async () => {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const ANON_KEY     = process.env.ANON_KEY;
      const SERVICE_KEY  = process.env.SERVICE_KEY;
      const EMAIL        = process.env.EMAIL;
      // 1. admin generate_link returns the action_link in-band.
      const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "magiclink", email: EMAIL }),
      });
      const linkData = await linkRes.json();
      if (!linkRes.ok) { console.error("generate_link", linkRes.status, JSON.stringify(linkData).slice(0, 300)); process.exit(3); }
      // Supabase admin generate_link returns hashed_token at the top level
      // of the response (legacy shape used `properties.hashed_token`).
      const token_hash = linkData?.hashed_token || linkData?.properties?.hashed_token;
      if (!token_hash) { console.error("no hashed_token in admin response", Object.keys(linkData).join(",")); process.exit(3); }
      // 2. verify token_hash → session.
      const verRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: "POST",
        headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "magiclink", token_hash }),
      });
      const verData = await verRes.json();
      if (!verRes.ok || !verData.access_token) {
        console.error("verify", verRes.status, JSON.stringify(verData).slice(0, 300));
        process.exit(3);
      }
      process.stdout.write(verData.access_token);
    })().catch(e => { console.error(e?.message || e); process.exit(3); });
  '
}
TOKEN=$(SUPABASE_URL="$SUPABASE_URL" ANON_KEY="$ANON_KEY" SERVICE_KEY="$SERVICE_KEY" EMAIL="$TEST_EMAIL" mint_session)
if [ -z "$TOKEN" ]; then echo "Failed to mint session"; exit 2; fi
echo "Minted Supabase session token, length=${#TOKEN}"

# ─── Pre-flight: capture artifact ids for the test user ───────────────────
fetch_artifacts() {
  curl -s -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
    "$SUPABASE_URL/rest/v1/artifacts?user_id=eq.$USER_ID&select=id,artifact_type,status,version&status=eq.delivered&order=version.desc"
}
ARTIFACTS_JSON=$(fetch_artifacts)
SOUL_ID=$(printf '%s' "$ARTIFACTS_JSON" | node --no-warnings -e "
  const a = JSON.parse(require('fs').readFileSync(0,'utf8'));
  const m = a.find(r => r.artifact_type === 'soul_map_synthesizer');
  process.stdout.write(m ? m.id : '');
")
SENS_ID=$(printf '%s' "$ARTIFACTS_JSON" | node --no-warnings -e "
  const a = JSON.parse(require('fs').readFileSync(0,'utf8'));
  const m = a.find(r => r.artifact_type === 'sensescape_synthesizer');
  process.stdout.write(m ? m.id : '');
")
VDNA_ID=$(printf '%s' "$ARTIFACTS_JSON" | node --no-warnings -e "
  const a = JSON.parse(require('fs').readFileSync(0,'utf8'));
  const m = a.find(r => r.artifact_type === 'visual_dna_synthesizer');
  process.stdout.write(m ? m.id : '');
")
echo "soul_map_synthesizer  id=$SOUL_ID"
echo "sensescape_synthesizer id=$SENS_ID"
echo "visual_dna_synthesizer id=$VDNA_ID"

# ─── 1. GET /api/qbp without JWT → 401 ────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/qbp")
assert_status "GET /api/qbp without JWT" 401 "$STATUS"

# ─── 2. GET /api/qbp with valid JWT → 200 + qbp ───────────────────────────
BODY=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/qbp")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/qbp")
assert_status   "GET /api/qbp (JWT)"             200 "$STATUS"
assert_contains "GET /api/qbp body has qbp"      '"qbp"' "$BODY"
assert_contains "GET /api/qbp body has lock ts"  '"foundation_locked_at"' "$BODY"

# ─── 3. GET /api/artifacts (free) → all 4, soul unlocked, others locked ───
BODY=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/artifacts")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/artifacts")
assert_status   "GET /api/artifacts (free)"      200 "$STATUS"
SOUL_LOCKED=$(printf '%s' "$BODY" | node --no-warnings -e "
  const a=JSON.parse(require('fs').readFileSync(0,'utf8')).artifacts||[];
  const m=a.find(r=>r.agent_slug==='soul_map_synthesizer');
  process.stdout.write(String(m?m.locked:''));")
SENS_LOCKED=$(printf '%s' "$BODY" | node --no-warnings -e "
  const a=JSON.parse(require('fs').readFileSync(0,'utf8')).artifacts||[];
  const m=a.find(r=>r.agent_slug==='sensescape_synthesizer'&&r.status==='delivered');
  process.stdout.write(String(m?m.locked:''));")
if [ "$SOUL_LOCKED" = "false" ]; then PASS=$((PASS+1)); LOG+=("PASS  GET /api/artifacts soul unlocked"); else FAIL=$((FAIL+1)); LOG+=("FAIL  GET /api/artifacts soul locked=$SOUL_LOCKED"); fi
if [ "$SENS_LOCKED" = "true" ];  then PASS=$((PASS+1)); LOG+=("PASS  GET /api/artifacts sensescape locked (free)"); else FAIL=$((FAIL+1)); LOG+=("FAIL  GET /api/artifacts sensescape locked=$SENS_LOCKED"); fi

# ─── 4. GET /api/artifacts/<soul_id> (free) → 200 with content ────────────
if [ -n "$SOUL_ID" ]; then
  STATUS=$(curl -s -o /tmp/qb-soul.json -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/artifacts/$SOUL_ID")
  assert_status "GET /api/artifacts/soul_id (free)" 200 "$STATUS"
  assert_contains "GET /api/artifacts/soul_id has content.header" '"header"' "$(cat /tmp/qb-soul.json)"
  rm -f /tmp/qb-soul.json
fi

# ─── 5. GET /api/artifacts/<sens_id> (free) → 402 with artifact_meta ──────
if [ -n "$SENS_ID" ]; then
  BODY=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/artifacts/$SENS_ID")
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/artifacts/$SENS_ID")
  assert_status "GET /api/artifacts/sens_id (free)" 402 "$STATUS"
  assert_contains "GET /api/artifacts/sens_id artifact_locked"  '"artifact_locked"' "$BODY"
  assert_contains "GET /api/artifacts/sens_id artifact_meta"    '"artifact_meta"'   "$BODY"
fi

# ─── 6. GET /api/artifacts/<wrong-uuid> → 404 (no existence leak) ─────────
WRONG_ID="00000000-0000-0000-0000-000000000000"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/artifacts/$WRONG_ID")
assert_status "GET /api/artifacts/<wrong-uuid>" 404 "$STATUS"

# ─── 7. POST /api/qbp/export (free) → 402 export_gated ────────────────────
BODY=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" "$BASE/api/qbp/export")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" "$BASE/api/qbp/export")
assert_status   "POST /api/qbp/export (free)"   402 "$STATUS"
assert_contains "POST /api/qbp/export gated"    '"export_gated"' "$BODY"

# ─── 8. POST /api/stripe/checkout (Pro price) → 501 tier_not_yet_available ─
PRO_PRICE="price_1TGZtsEHEAcWrG55IaXsFRd9"
BODY=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"price_id\":\"$PRO_PRICE\"}" "$BASE/api/stripe/checkout")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"price_id\":\"$PRO_PRICE\"}" "$BASE/api/stripe/checkout")
assert_status   "POST /api/stripe/checkout (Pro)" 501 "$STATUS"
assert_contains "POST /api/stripe/checkout tier_not_yet_available" '"tier_not_yet_available"' "$BODY"

# ─── 9. Regenerate Soul Map (free) → 200 ──────────────────────────────────
# Use a short delay then check; this kicks the real dispatch chain.
# Skip the regenerate call if a regeneration is already in flight (idempotent).
if [ -n "$SOUL_ID" ]; then
  BODY=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" "$BASE/api/artifacts/$SOUL_ID/regenerate")
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" "$BASE/api/artifacts/$SOUL_ID/regenerate")
  # Accept 200 (kicked) or 409 (in-flight from a prior test run).
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "409" ]; then
    PASS=$((PASS+1)); LOG+=("PASS  POST regenerate soul (free) status=$STATUS")
  else
    FAIL=$((FAIL+1)); LOG+=("FAIL  POST regenerate soul (free) status=$STATUS body=$(printf '%s' "$BODY" | head -c 200)")
  fi
fi

# ─── 10. Regenerate Visual DNA (free) → 402 ───────────────────────────────
if [ -n "$VDNA_ID" ]; then
  BODY=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" "$BASE/api/artifacts/$VDNA_ID/regenerate")
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" "$BASE/api/artifacts/$VDNA_ID/regenerate")
  assert_status   "POST regenerate visual_dna (free)" 402 "$STATUS"
  assert_contains "POST regenerate visual_dna body"   '"artifact_locked"' "$BODY"
fi

# ─── Starter-tier checks: flip tier, repeat the gates, restore ────────────
flip_tier() {
  local tier="$1"
  curl -s -X PATCH \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
    -H 'Content-Type: application/json' -H 'Prefer: return=minimal' \
    -d "{\"tier\":\"$tier\"}" \
    "$SUPABASE_URL/rest/v1/profiles?id=eq.$USER_ID" >/dev/null
}

echo ""
echo "Flipping test user tier → starter for starter-tier checks..."
flip_tier "starter"

# 11. GET /api/artifacts (starter) → all unlocked
BODY=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/artifacts")
ANY_LOCKED=$(printf '%s' "$BODY" | node --no-warnings -e "
  const a=JSON.parse(require('fs').readFileSync(0,'utf8')).artifacts||[];
  const locked=a.filter(r=>r.locked).length;
  process.stdout.write(String(locked));")
if [ "$ANY_LOCKED" = "0" ]; then PASS=$((PASS+1)); LOG+=("PASS  GET /api/artifacts (starter) all unlocked"); else FAIL=$((FAIL+1)); LOG+=("FAIL  GET /api/artifacts (starter) locked_count=$ANY_LOCKED"); fi

# 12. GET /api/artifacts/<sens_id> (starter) → 200 with content
if [ -n "$SENS_ID" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/artifacts/$SENS_ID")
  assert_status "GET /api/artifacts/sens_id (starter)" 200 "$STATUS"
fi

# 13. POST /api/qbp/export (starter) → 200 with signed_url
BODY=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" "$BASE/api/qbp/export")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" "$BASE/api/qbp/export")
assert_status   "POST /api/qbp/export (starter)"      200 "$STATUS"
assert_contains "POST /api/qbp/export signed_url"     '"signed_url"' "$BODY"

# Restore
echo ""
echo "Restoring test user tier → free..."
flip_tier "free"

# ─── Summary ──────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "QB BrandOS step-7 API smoke test"
echo "============================================================"
for line in "${LOG[@]}"; do echo "$line"; done
echo "------------------------------------------------------------"
echo "$PASS pass, $FAIL fail"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
