# Email deliverability

How QB BrandOS configures transactional email for Primary-tab placement in Gmail, and how to verify it.

## Header decision matrix

Every email QB BrandOS sends falls into one of two categories. The header set differs.

| Email | Category | `List-Unsubscribe` | Reasoning |
| --- | --- | :---: | --- |
| Magic link (sign-in) | transactional | no | The most transactional message there is. Unsub header pushes it toward Promotions. |
| Foundation locked | transactional | no | One-time confirmation of a user action. No marketing intent. |
| Artifact ready (×4) | transactional | no | One-time delivery confirmation. No marketing intent. |
| Stripe payment confirmation | transactional | (Stripe-sent) | Stripe handles this email itself; we don't render it. |
| Welcome / signup | marketing-adjacent | yes | First-touch email after signup. Includes a path back into the product. Gmail treats it as Promotions-adjacent regardless; the unsub header is the right signal for that category. |
| Future drip / nurture | marketing | yes | Anything sent on cadence rather than triggered by a user action. |

All emails carry:
- `From: Quantum Branding <auth@quantumbranding.ai>` · verified Resend domain.
- `Reply-To: me@qtmbg.com` · replies go to the founder inbox.
- `X-Entity-Ref-ID: qb-brandos-*` · per-template identifier for log filtering.

Transactional emails skip:
- `List-Unsubscribe: <mailto:…>`
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click`

## How the code enforces this

`api/_lib/email.js` exports `sendEmail({ ..., transactional })` with `transactional: true` as the default. When true, the unsubscribe headers are omitted. Callers that need marketing-class headers pass `transactional: false`.

`api/send-magic-link.js` and `api/agents/dispatch.js` and `api/lock-foundation.js` (artifact-ready + foundation-locked) all flow through this code path with the transactional default.

`api/send-welcome-email.js` keeps its inlined Resend call with the unsubscribe headers; it's the only marketing-adjacent send and ships with its own headers.

## How to verify Primary-tab placement

This procedure is human-driven. Cod cannot create Gmail accounts or read Gmail tab classifications via API. Run it once per chapter or whenever email header logic changes.

### Setup

1. Provision a fresh Gmail account dedicated to QB testing.
   - Recommended: `qb-deliverability-<initials>@gmail.com` (real Gmail, not a plus-alias of an existing inbox, because Gmail learns tab patterns per-account and plus-aliases inherit the parent's history).
   - Store credentials in 1Password under "QB BrandOS · Test Gmail."
2. Sign in to the test Gmail in a clean browser profile (no extensions, no prior QB interactions).
3. Confirm the inbox has the default tab layout enabled: Settings → Inbox → Categories → at least Primary, Social, Promotions, Updates ticked.

### Trigger the 5 transactional emails

Step through the production signup → lock → upgrade flow:

| # | Action | Email triggered |
| --- | --- | --- |
| 1 | Visit `https://quantumbranding.ai/signal-scan`, enter the test Gmail, submit | Magic link |
| 2 | Open Gmail, click the magic link | Welcome (sent after auth-callback completes) |
| 3 | Complete Archetype Compass + Brand Soul Map + Sensescape with minimal valid input | (no email) |
| 4 | Navigate to `/foundation`, click "Lock Foundation," confirm in modal | Foundation locked → 4× artifact ready (one per agent) |
| 5 | (Optional) From `/paywall`, complete Stripe Checkout with a real card | Stripe payment confirmation (sent by Stripe, not us) |

Expected delivery window: magic link <10 s, welcome <30 s, foundation locked <5 s after click, four artifact ready emails over the following 20–30 s.

### Record placement

For each delivered email, in a single table:

| # | Subject | Tab | Sender mark | Notes |
| --- | --- | --- | --- | --- |
| 1 | Your sign-in link to Quantum Branding | (Primary / Promotions / Updates / Social / Spam) | (verified / unverified) | any visible Gmail banner? |
| 2 | Welcome to Quantum Branding | … | … | … |
| 3 | Your foundation is locked. Your artifacts are being prepared. | … | … | … |
| 4a | Your Soul Map is ready | … | … | … |
| 4b | Your Sensory World is ready | … | … | … |
| 4c | Your Visual Language is ready | … | … | … |
| 4d | Your Strategic Position is ready | … | … | … |
| 5 | (Stripe subject varies) | … | … | … |

Target: all five user-driven emails (#1 magic link, #3 foundation locked, #4a–d artifact ready) land in Primary. Welcome (#2) may land in Promotions per Gmail's heuristics for first-touch promotional emails; that is acceptable. Stripe (#5) is out of our control.

### If anything misses Primary

The two levers, in order of effect:

1. **`List-Unsubscribe` headers.** Confirm the misplaced email is going through the transactional code path. Magic link, foundation-locked, and artifact-ready should NOT carry the header. Trigger one of those, view source in Gmail, search for `List-Unsubscribe`. If present, the code change to remove it didn't deploy yet, or a different code path is being used.

2. **Sender history.** Gmail learns per-account. The first email from `auth@quantumbranding.ai` to a fresh inbox often lands in Promotions regardless of headers. Click the email, mark "Move to Primary," reply with a short message, and re-trigger. Subsequent emails should learn.

3. **DKIM/SPF/DMARC.** Verify in Resend dashboard that `quantumbranding.ai` shows ALL THREE as passing. A failing DKIM signature is a deliverability cliff.

4. **Content signals.** Excessive CTAs, image-heavy HTML, link shorteners, and "100% off"-type promotional language push toward Promotions. The current templates are clean of these.

5. **Subject line.** If a transactional email lands in Promotions despite all the above, A/B the subject. Some patterns Gmail's classifier reads as promotional even on transactional content: subjects starting with imperative verbs, promotional-sounding nouns, exclamation marks. Our current subjects are descriptive and short, which is the right register.

### After verification

- Update this file's "Header decision matrix" table if any header changed.
- Update this file's "Verification log" section below with the date, who ran the test, the test Gmail, and the result.
- If any email still misses Primary after the above interventions, open a follow-up issue.

## Verification log

| Date | Tester | Test inbox | Result | Notes |
| --- | --- | --- | --- | --- |
| 2026-05-15 | Cod synthetic | `nizzar.ben+c1qa-…@gmail.com` (plus-alias) | Resend reports all 5 `delivered`; tab placement not verified | API-only step 17; visual confirmation deferred to step 18 PR 3 manual run |
| _pending_ | Nizzar (step 18 PR 3 manual) | fresh Gmail | _pending_ | After PR 1 merges, run the 5-email procedure above and fill this row |

## Headers reference (what Resend sends)

Per Resend's API, the request body has top-level fields `from`, `to`, `reply_to`, `subject`, `html`, `text` and a `headers` object that gets merged into the SMTP DATA section. We use this for:
- `X-Entity-Ref-ID` · per-template tag for searching logs and Resend dashboard
- `List-Unsubscribe` (marketing only)
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (marketing only; pairs with the mailto: form)

We do NOT set:
- `Precedence: bulk` · would tank Primary placement for any send
- `Auto-Submitted: auto-generated` · appropriate for automated replies, NOT for triggered confirmations
- `X-Auto-Response-Suppress` · for outbound responder logic, not us
- `Feedback-ID` · useful for bulk; not needed for our scale
