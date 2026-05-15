# Stripe upgrade flow · manual regression checklist

A reproducible script for re-running the step-15 end-to-end test in the
future. Use this when changing the webhook handler, the checkout
endpoint, the tier-gating module, or the schema of `profiles` /
`stripe_events`.

## Prerequisites

- Stripe test mode secret key (`sk_test_...`).
- Test mode webhook signing secret (created when you register the
  test webhook endpoint).
- Test mode Starter price ID, $97/month, recurring. Create with:
  `POST /v1/products` then `POST /v1/prices` with `product`,
  `currency=usd`, `unit_amount=9700`, `recurring[interval]=month`.
- Test card: `4242 4242 4242 4242`, any future expiry, any 3-digit CVC,
  any postal.
- Test user with foundation already locked. Canonical:
  `3a92ffba-abce-4149-be0c-d593c84efdb3`.

## Path A: prod-env swap (the path step 15 used)

The simplest path. Brief outage on payments during the test window.

1. Back up the live `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` values.
2. Register a test mode webhook endpoint pointing at
   `https://app.quantumbranding.ai/api/stripe-webhook`. Capture the
   `secret` from the response.
3. Replace `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
   `STRIPE_STARTER_PRICE_ID` in Vercel production. Force redeploy
   (`vercel redeploy <latest-prod-url> --target production`).
4. Run the checks below.
5. Restore the live `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
   Delete `STRIPE_STARTER_PRICE_ID` (live code uses the hardcoded
   fallback).
6. Delete the test webhook endpoint. Deactivate the test product +
   price.

## Path B: preview environment (blocked in Chapter 1)

Vercel preview deployments are gated by deployment protection
(default 401). Stripe webhooks can't authenticate, so Path B is
blocked until either deployment protection is disabled for the
project or a bypass token is wired into the Stripe webhook URL as
a query param. Deferred to Chapter 10.

## Checks to run after every reconfiguration

### Pre-checkout (baseline)

- `GET /api/qbp` → `tier=free`
- `GET /api/artifacts` → 9 rows, 6 locked (1 sensescape + 3 visual_dna
  + 2 war_table)
- `POST /api/qbp/export` → HTTP 402, `error=export_gated`
- `GET /api/artifacts/<war_table_id>` → HTTP 402, `error=artifact_locked`
- `POST /api/stripe-webhook` (unsigned body) → HTTP 400

### Checkout (browser)

- Hit `POST /api/stripe/checkout` with `{ price_id: <test_price_id> }`,
  expect 200 with `checkout_url`.
- Open the URL in a browser. Fill the test card. Submit.
- Stripe redirects to `https://app.quantumbranding.ai/foundation?upgrade=success`.

### Post-checkout (within ~5 s of submit)

- `profiles.tier` flipped to `starter`.
- `profiles.tier_started_at` set to a fresh timestamp.
- `profiles.stripe_customer_id` populated.
- `profiles.subscription_status` = `active`.
- `stripe_events` table has one row for `checkout.session.completed`,
  one for `customer.subscription.created`.

### Post-upgrade API

- `GET /api/qbp` → `tier=starter`
- `GET /api/artifacts` → 9 rows, 0 locked
- `POST /api/qbp/export` → HTTP 200, returns `signed_url`
- `GET /api/artifacts/<any_locked_id>` → HTTP 200 with full content

### Idempotency

- Fetch the original `checkout.session.completed` event payload via
  `GET /v1/events/<event_id>`.
- HMAC-SHA256 sign with the test webhook secret, header
  `stripe-signature: t=<unix>,v1=<hex>`.
- POST to `/api/stripe-webhook` with the signed body.
- Expect HTTP 200 with `{ "received": true, "deduped": true,
  "event_id": "<original_event_id>" }`.
- `profiles.updated_at` should not have advanced.

### Downgrade

- `DELETE /v1/subscriptions/<sub_id>` via Stripe API (or "Cancel
  immediately" in Dashboard).
- Wait ~5 s for `customer.subscription.deleted` to deliver.
- `profiles.tier` reverts to `free`. `subscription_status` = `canceled`.
- `tier_started_at` is preserved (audit of when starter started).
- Artifact rows in `public.artifacts` table are preserved (per spec
  10.3 · the artifacts exist; only access is revoked).
- `GET /api/qbp/export` → 402.
- `GET /api/artifacts/<war_table>` → 402.

### Re-subscribe

- Open a new `/api/stripe/checkout` session, complete with test card.
- Stripe creates a fresh customer (the cancelled customer object stays
  but Checkout mints a new one · Stripe's behavior, not ours).
- New webhook events fire. Tier flips back to starter.

### Cleanup

- Cancel the active subscription via `DELETE /v1/subscriptions/<id>`.
- Restore `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to live values.
- Remove `STRIPE_STARTER_PRICE_ID` from prod env.
- Delete test webhook endpoint.
- Deactivate test product + price.
- Force redeploy production.
- Confirm `profiles.tier = free`.
- Confirm `/api/stripe-webhook` POST (unsigned) returns 400 with the
  live signing secret active again.

## Known gaps

- The success_url is `/foundation?upgrade=success` but the post-checkout
  redirect lands at the bare `/foundation` page. If the browser's
  localStorage session is stale or absent, the foundation page bounces
  to signal-scan. Step 15 hit this. Not a paywall bug; surface-level
  session-restore issue. Documented for a separate UI patch.
- Downgrade flips tier to free immediately. Spec 10.3 wanted artifacts
  to stay readable post-downgrade ("the artifacts were already paid
  for"). Chapter 1 ships the simpler logic. Document the spec deviation
  in the step report. Re-evaluate in Chapter 10 hardening.
