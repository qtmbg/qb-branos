# BrandOS recut · brand only, free steak
## Strategy note v1 · 2026-09-20

Status: proposal, operator-approved in principle. Two numbers still open (see Part 8).

---

## 1. The decision

BrandOS stops being a toolkit of twenty things and becomes one thing: the tool that
gets a brand decided. Everything at or below the level of an Instagram post leaves
the public product. The content agents stay in the codebase and stay runnable by the
operator, but no visitor ever sees them.

The money inverts at the same time. Today the valuable work sits behind a
subscription wall and the free tier is a teaser. That is backwards. The foundation
runs free, in full, for everyone. What gets paid for is keeping it, exporting it,
versioning it, and acting on it. Free steak, paid fries.

---

## 2. What the cut removes

Seventeen production agents. The content line takes exactly seven, and they sit in
two contiguous phases.

| Agent | Phase | Page |
|---|---|---|
| `newsletter_architecture_agent` | 03 | newsletter-architecture-agent.html |
| `linkedin_strategy_agent` | 03 | linkedin-strategy-agent.html |
| `instagram_seed_agent` | 03 | instagram-seed-agent.html |
| `youtube_strategy_agent` | 03 | youtube-strategy-agent.html |
| `content_bridge_agent` | 03 | content-bridge.html |
| `content_repurposing_agent` | 04 | content-repurposing-engine.html |
| `content_scheduler_agent` | 04 | content-scheduler.html |

Phase 03 empties. Phase 04 empties. Nothing else moves.

### Why they were costing more than they earned

1. **They set the price.** A foundation is worth what a strategist charges. A caption
   is worth cents. Put them in one product and the buyer prices the whole thing at
   the caption.
2. **They competed with the buyer.** The agency customer sells content for a living.
   Shipping Instagram Seed to that customer puts BrandOS on the wrong side of the
   table.
3. **They drained the asset.** The QBP is the moat. Brand agents write into it.
   Content agents only read from it.

---

## 3. What is left, and why it is cleaner

Ten agents, and they map one to one onto The Collapse. Today the site has to explain
why six phases implement four movements. After the recut there is nothing to explain,
because the product is the method.

| Movement | Surfaces |
|---|---|
| **Observe** | Signal Scan, Sensescape Synthesizer, Soul Map Synthesizer |
| **Collapse** | War Table, Visual DNA, Archetype Compass, the lock at `foundation.html` |
| **Build** | Logo Direction, Logo Evaluation, Voice Guide, Brand Document |
| **Hold** | Brand Performance, Quarterly Review, Predictive Panel |

### The public surface is one tool, not ten

A visitor should not meet a grid of ten agents. They meet one flow with four
movements, and the agents are steps inside it. `tools.html` stops being a catalogue
and becomes one page describing one thing. That is where the offer gets light.

### Content comes back as governance, not production

The replacement for the content agents is not another agent. It is the **Brand Spec
export**: the locked positioning, voice rules, banned words, visual DNA and archetype
rendered as JSON plus a prompt pack, dropped into whatever the customer already writes
with. BrandOS stops making the posts and starts governing everyone who does. The data
is already in the QBP, so the build cost is a renderer and an endpoint.

---

## 4. Park depth · operator keeps the keys

The seven agents are not deleted and not archived. They go **operator-only**.

- A new `OPERATOR_ONLY_SLUGS` set beside the existing `PROMPT_HOLD_SLUGS` in
  `api/agents/console.js`, checked against the authenticated user id rather than an
  env flag, so the operator dispatches them normally and every other account gets a
  404 at the handler.
- The seven pages stay on disk and stay deployable, but come off the nav, off
  `tools.html`, off `ecosystem.html`, off `scripts/seo/urls.mjs` and therefore off the
  sitemap, with `noindex` on each.
- The registry keeps all seven entries, so `assertAgentMetaOrThrow` still validates
  them and they cannot silently rot.

Reversal is a one-line change to the set.

---

## 5. The revenue model · free steak, paid fries

No subscription anywhere. One-time purchases, priced per brand.

| Line | Price | What it is |
|---|---|---|
| **Foundation** | Free, one brand per account | The complete run. Observe, Collapse and Build, on screen, in full. No card, no teaser, no watermark. |
| **Keep** | ~$79 one time, per brand | The designed Brand Document, the Brand Spec export, permanent archive, version history, re-collapse when the brand moves. |
| **Intelligence** | ~$249 one time, per brand | Adds Hold. Brand Performance, Quarterly Review, and five Predictive Panel runs. Top-up packs after that. |
| **Studio** | ~$990 one time | Five brands, Keep and Intelligence on all five, the agency's own brand on every output. |
| **Atelier** | Quote | Unchanged. Nizzar, the practice, one engagement at a time. |

### Why this is the right shape for this business

The real business is the practice. A free, complete, genuinely good brand foundation
is the strongest qualification instrument an independent strategist can own: it does
the diagnostic work for free and hands over a prospect who has already articulated
their own positioning. The paid lines cover infrastructure and separate the serious
from the curious. Atelier converts at the top.

It also removes every piece of subscription engineering. Entitlement becomes a fact
per brand, "Keep purchased" and "Intelligence purchased", rather than a tier string on
an account. Since nobody has ever bought a subscription, there is nothing to migrate
and no one to grandfather. The three Stripe subscription prices get archived.

---

## 6. The portion problem

Free and unlimited are different words. A complete foundation is nine agent runs on
Sonnet 4.6. At roughly 8k input and 4k output per agent, a full foundation is about
72k input and 36k output tokens, which comes to somewhere near **$0.75 per
foundation** at current Sonnet pricing. That estimate needs verifying against real
runs before launch, but if it holds, the steak is affordable.

What keeps it affordable:

- One free brand per account. A second brand is a Studio purchase.
- Each agent runs at most twice on the free path. The Content Approval Loop already
  caps revision rounds at three.
- Re-collapse after the foundation locks is a Keep feature, not a free one.
- Sensescape already runs on Haiku 4.5. Any other agent that holds quality on Haiku
  moves there on the free path.
- Rate limit per account per day, and a hard monthly ceiling on total free runs with
  an operator alert before it is reached.

---

## 7. Build plan

Five phases, each with a gate. Phases 1 and 2 are independent of the pricing numbers
and can start immediately.

**Phase 1 · Operator-only gate.** `OPERATOR_ONLY_SLUGS`, pages off every public
surface, `noindex`, sitemap rebuild.
Gate: `node scripts/registry-smoke.mjs` output pasted verbatim into the PR body, then
an unauthenticated probe of `POST /api/agents/run` and `GET /api/agents/console`
confirming handler-level 401 post-deploy. Registry merge gate applies in both halves.

**Phase 2 · One tool, four movements.** Rewrite `tools.html`, `ecosystem.html` and
`index.html` around Observe, Collapse, Build, Hold, with the ten agents as steps
inside one flow.
Gate: `tests/site-audit/audit.mjs` and `tests/brand-casing/casing-audit.mjs` green.

**Phase 3 · Brand Spec export.** The export surface on `foundation.html` plus the
endpoint. JSON spec, prompt pack, rules file. This is what makes Keep worth paying for.
Gate: a real foundation exported and pasted into a fresh Claude project, producing
on-brand copy with no other context.

**Phase 4 · The money.** Free path opened end to end, per-brand entitlements replacing
tier strings in `api/_lib/tier-gating.js`, one-time payment mode in
`api/stripe/checkout.js` and the webhook, `payment.html` rebuilt on three lines plus
Atelier, the three subscription prices archived in Stripe.
Gate: test-mode purchase of Keep, Intelligence and Studio, each verified to grant the
right entitlement on the right brand and nothing else.

**Phase 5 · Re-audit and resubmit.** Sitemap drops seven URLs, IndexNow push,
`tests/seo-bing/bing-audit.mjs`, `tests/auth-flow/`.
Side benefit: the open SEO problem is sixteen tool pages shipping 103 static words.
This cut reduces it to nine before a single word of static copy is written.

---

## 8. Open numbers

1. **Keep at $79, or lower.** $79 is impulse-priced against a free steak. $49 converts
   harder to argue with. $149 treats the Brand Document as the deliverable it is.
2. **Free brands per account.** One is the safe answer. Two makes the free tier feel
   generous at roughly double the API cost.

Everything else in this note is decided.

---

*docs/strategy/brandos-recut-v1.md · BrandOS · September 2026*
