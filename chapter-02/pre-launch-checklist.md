# QB BrandOS · Pre-launch checklist

Durable register of named pre-launch deliverables surfaced during chapter-2 verification. Each entry must clear before the chapter-2 surfaces go to general-availability launch.

Format: one row per deliverable. Owner is operator/Cod by default unless a specific human is named. Status moves from `OPEN` → `IN PROGRESS` → `CLOSED` with a dated note.

---

## Open items

### PL-001 · Real-Stripe upgrade-flow seam check (`/foundation?upgrade=success`)

**Status:** OPEN
**Surfaced in:** step 13A E2E QA (this chapter close)
**Owner:** operator/Cod
**Why it's pre-launch:** the prod deploy is configured with `STRIPE_SECRET_KEY=rk_live_*` only. No Stripe test-mode key is provisionable in prod env. The step 13A E2E harness mocked the upgrade flow via direct DB tier flip + URL navigation to `/foundation?upgrade=success` (authorized fallback per step-13 spec §2.3 / adj #3). The actual Stripe → checkout → redirect → banner seam was NOT exercised end-to-end in step 13.

**What clears this item:**

A real-Stripe seam check covering:
1. Free user clicks "Upgrade to Starter" on `/foundation`
2. POST `/api/stripe/checkout` returns a real Stripe checkout URL
3. Browser navigates to the Stripe checkout page
4. Test card `4242 4242 4242 4242` submitted (Stripe test mode required)
5. Stripe redirects to `/foundation?upgrade=success`
6. The 12A upgrade-success banner renders with the verbatim Starter copy (per the 12C harness · `UPGRADE_BANNER_COPY.starter`)
7. URL stripped to `/foundation` via `history.replaceState` after first render

**Possible execution paths:**
- Stand up a preview/staging Vercel deployment with `STRIPE_SECRET_KEY=sk_test_*` configured, run a one-off Playwright script against that URL
- Add `STRIPE_TEST_SECRET_KEY` alongside the live key in prod + dual-mode `api/stripe/checkout.js` (not recommended · mixes envs)
- Manual smoke: operator opens an incognito browser, completes the upgrade flow with a test card against a staging deploy

**Verification artifact required for CLOSED:**
- A run log (manual or automated) capturing screenshots / DOM dumps confirming step 6 banner copy verbatim match + URL strip in step 7.

---

## Closed items

(none yet)

---

## Notes

- This file is the canonical register for any "verified-via-fallback-in-chapter-2, must-clear-before-launch" item.
- Adding a row requires referencing the closure or session that surfaced the gap.
- Closing a row requires the verification artifact path.
