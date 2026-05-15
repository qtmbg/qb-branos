# Chapter 1 · Completion

**Shipped:** 2026-05-15.
**Spec:** [`CHAPTER_01_SPEC.md`](/CHAPTER_01_SPEC.md).
**Verification trail:** [`chapter-01/verification/`](./verification/) (18 step reports + final smoke).

Chapter 1 puts the free-tier user end-to-end. Cold signup, three Phase 01 exercises, foundation lock, four AI synthesis artifacts delivered. Stripe upgrade unlocks the three paid artifacts plus QBP export. The four canonical surfaces (Foundation, Archive, QBP, Account) plus Paywall and Artifact reader all render at mobile + desktop. The infrastructure for the next chapter is in place: 10 migrations applied, RLS enforced, webhook idempotency proven, transactional email deliverability tuned for Gmail.

## The 18 steps

| # | Step | PR(s) |
| --- | --- | --- |
| 1 | Schema audit + naming reconciliation | PRs from steps 1-3 |
| 2 | Migration set (001-008) | applied to prod |
| 3 | Agent dispatcher (status vocabulary refactor + soul-map synthesizer) | merged early in chapter |
| 4 | Sensescape synthesizer | merged |
| 5 | Visual DNA synthesizer | merged |
| 6 | War Table synthesizer | merged |
| 7 | API tier-gating + Stripe checkout + webhook idempotency (migration 009) | #35, #36, #37 |
| 8 | Design tokens + component library + JS factories + visual gallery | #38, #39 |
| 9 | Artifact reading surface | #40, #41 |
| 10 | QBP rendering surface | #42, #43, #44 |
| 11 | Brand Archive | #45, #46 |
| 12 | Foundation page (replaces /dashboard, /hub, /journey-guide) | #47, #48 |
| 13 | Paywall + Account pages | #49, #50 |
| 14 | Email templates (foundation locked + artifact ready) | #51, #52 |
| 15 | Stripe end-to-end test mode swap + signed-webhook idempotency | #53, #54 |
| 16 | Deprecation cleanup (file archive + spec section 15 status column) | #55, #56 |
| 17 | End-to-end QA pass · 2 critical lock-flow bugs fixed inline | #57, #58 |
| 18 | Final sign-off · 3 sub-PRs · 1 reverted | #59 (reverted #63), #60, #61, #62, #63 |

Total PRs merged across Chapter 1: 30+. Every PR is squash-merged to `main` with a verification report PR adjacent.

## What shipped

### Surfaces (6)
- `/foundation` · post-login landing, four states (cold / in-progress / lock-ready / locked) plus three locked sub-states
- `/archive` · filterable artifact list with version toggle, paywall on locked rows
- `/qbp` · four-section live document with section-level paywall for paid sections
- `/paywall` · reason-aware headline (8 explicit cases), three-tier plan grid, Stripe Checkout wired
- `/account` · email, tier badge, tier_started_at, sign out
- `/artifact?id=…` · 5 render functions for the artifact body, full content for free Soul Map, locked frost for paid synth

### API endpoints (8)
- `GET /api/qbp` · returns qbp + tier + tier_started_at + foundation_locked_at
- `POST /api/qbp/export` · JSON export, tier-gated 402 on free
- `GET /api/artifacts` · list with per-row `locked` flag computed from tier-gating module
- `GET /api/artifacts/[id]` · full content for unlocked, 402 with paywall payload for locked
- `POST /api/artifacts/[id]/regenerate` · version chain via parent_artifact_id
- `POST /api/lock-foundation` · synchronous (post PR #63 revert); writes foundation_locked_at + dispatches 4 agents
- `POST /api/agents/dispatch` · per-agent execution + artifact_runs logging
- `POST /api/stripe-webhook` · HMAC-verified, stripe_events dedup, tier-flip on checkout.session.completed + customer.subscription.deleted
- `POST /api/stripe/checkout` · price-allowlist validation, returns `checkout_url`

### Agents (4)
- `soul_map_synthesizer` · always-free
- `sensescape_synthesizer` · tier-gated
- `visual_dna_synthesizer` · tier-gated
- `war_table_synthesizer` · tier-gated

Each writes a schema-validated artifact and an `artifact_runs` row with tokens_in/tokens_out/duration_ms.

### Email templates (5 transactional + 1 welcome)
- Magic link · no List-Unsubscribe
- Welcome · keeps List-Unsubscribe (marketing-adjacent)
- Foundation locked · no List-Unsubscribe
- Artifact ready · per-agent subject + body, no List-Unsubscribe

### Database (10 migrations on prod)
- 001 profiles tier + tier_started_at columns
- 002 artifacts schema extension (phase, version, parent_artifact_id)
- 003 artifact_runs table
- 004 qbp_revisions table
- 005 tool_completions unique constraint
- 006 indexes
- 007 backfill (legacy status values)
- 008 artifacts.status strict CHECK
- 009 stripe_events dedup table
- 010 dispatch_jobs (applied; code reverted but table stays for the Chapter 2 async-dispatch revival)

All have RLS policies; service role bypasses where the API needs it.

## Open items entering Chapter 2

Per `CHAPTER_01_SPEC.md §16`:

**From the original spec:**
- The four synthesizers are one-off implementations. Chapter 2 refactors onto a shared agent framework.
- No agent run history UI. Data exists in artifact_runs but is not surfaced. Chapter 2 adds the Agent Console.
- No file upload UI. Required for Phase 02 logo evaluation. Chapter 3 builds the asset layer.
- The Profiles exercise is in the schema but not built. Deferred.
- No retention email sequence post-signup. Chapter 10.
- No error monitoring (Sentry). Console logs only. Chapter 10.
- No legal pages (terms, privacy, refund). Required before public launch. Chapter 10.
- Atelier tier exists in the enum but no Atelier surface. Chapter 9.
- Pro and Agency tiers exist; Stripe price IDs are wired but return 501 `tier_not_yet_available`. Chapter 10 turns them on.
- Illustration CSS tinting may produce mediocre results. SVG conversion deferred indefinitely.

**Added across Chapter 1 build:**
- **Lock endpoint 504 on contention.** Async dispatch shipped in PR #59, reverted in PR #63 (1/10 stuck dispatch). Fire-and-forget on Vercel Edge is unreliable. Chapter 2 picks up with either a durable job runner (Vercel Queues, Inngest, Trigger.dev) or pre-inserted artifact rows + reliable background dispatch. Migration 010 (`dispatch_jobs` table) is already on prod for the revival.
- **`?upgrade=success` browser auth-gate.** Foundation page's initial auth gate uses localStorage. If session is stale at redirect, user bounces to signal-scan. Tier-display path is fixed (PR #60); auth-gate path is not.
- **Stripe customer reuse on re-subscribe.** Currently Checkout mints a fresh customer object on every re-subscribe. Hygiene issue; doesn't affect tier-flip correctness.
- **Customer portal link.** Cancellations currently route through `me@qtmbg.com`. Chapter 10 wires Stripe Billing Portal.
- **SVG positioning_map label wrapping** for long competitor names. War Table polish.
- **Auto-include illustrations in agent outputs.** Schema supports `illustration_slot` but no agent emits one.
- **Vercel preview deployment-protection bypass.** Stripe webhook tests can't use preview URLs (401). Chapter 10 stages this.

## Three explicit Chapter 1 deferrals

These were intentionally deferred during the build, not surfaced as bugs:

1. **PDF rendering for QBP export.** `/api/qbp/export` ships JSON. The signed_url returns a JSON file, not a PDF. PDF generation is a Chapter 10 task. Documented in step 7 verification.
2. **Grace period on downgrade.** Spec §10.3 calls for paid artifacts to remain readable for the rest of the billing period after a downgrade. Chapter 1 ships immediate re-lock on `customer.subscription.deleted`. Documented in step 15 §7.2.
3. **Three-Gmail-account deliverability verification.** Step 14 tested against one Gmail account via Resend `delivered` events. Step 18 PR #61 shipped the header strip code. Real Primary-tab verification across three accounts is a manual task per `EMAIL_DELIVERABILITY.md` and stays open as a Chapter 10 hardening item.

## Final E2E smoke result (post-merge)

See [`step-18-final-smoke-20260515T180121Z.md`](./verification/step-18-final-smoke-20260515T180121Z.md). End-to-end path verified against fresh test user `88f0c701-…` with synthetic Stripe webhook. All API gates work in both directions. The lock endpoint returns 504 under load (the known sync-await regression from PR #63 revert), but the work succeeds server-side and the artifacts deliver. The user-visible 504 toast is a Chapter 2 fix away.

## Closing

Chapter 1 is closed. The build proceeds to Chapter 2: the agent framework refactor.
