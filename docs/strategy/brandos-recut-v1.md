# BrandOS recut · brand only, free steak
## Strategy note v1 · 2026-09-20

Status: v1.1, 2026-09-20. Parts 5 to 8 revised after the operator dropped the Studio tier and
named the real second rung. Parts 1 to 4 stand as written.

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

## 5. The offer ladder

Studio and white-label are cut. They serve an audience that does not exist yet and they
are slow to sell. Four rungs remain, and every rung is the same object at more depth.

| Rung | Price | What it is |
|---|---|---|
| **The exercises** | Free, one brand per account | Observe, Collapse and Build, run in full, on screen. No card, no teaser. |
| **The Platform** | $79 one time, per brand | The document. Their foundation argued, designed and rendered to A4, in their hands. |
| **The Reading** | ~$490 one time | Ninety minutes with Nizzar on their own Platform, recorded, closing with a Direction Note appended to the document. |
| **Atelier** | Quote | Unchanged. The practice, one engagement at a time. |

Nothing recurs. Nobody has ever bought a subscription, so the three Stripe subscription
prices get archived and there is nothing to migrate.

### The constraint that shapes everything below

The Rapp &amp; Esen platform is 54 pages and it is the right benchmark for craft. It is not
the right benchmark for depth, and the difference matters. That document was built from
262 minutes of recorded working sessions with Nizzar in the room, pushing back, killing
"wealthy" as a client criterion at S2 01:07:45 and resolving the fake-promise objection at
S1 01:10:07. The exercises produce structured answers. They do not produce an argument.

So the generated Platform cannot be the Rapp &amp; Esen document, and pretending otherwise
would be the fastest way to burn the $79. It can carry the same architecture, the same
typographic craft, the same A4 discipline and the same honesty. What it cannot carry is
the part that came from a human disagreeing with the founder.

That gap is not a defect to hide. It is the product.

---

## 6. What the second rung actually sells

The operator named the problem precisely: someone receives a beautiful document and
cannot act on it. Three things answer that, and only one of them costs Nizzar time.

### 6.1 The document teaches its own reading · free, template work

Rapp &amp; Esen opens with "What this is" and "Three kinds of statement" and closes with
"How to use these three." Every generated Platform gets the same treatment: a **How to
read this** spread at the front that explains the difference between a statement that
decides something, a statement that describes something and a statement that is an
instruction, and a **What to do Monday** page at the back. This is written once into the
template and costs nothing per customer. It removes a large share of the confusion
without a call.

### 6.2 The Open Questions engine · one new agent

A new brand-level agent reads the locked foundation and produces, per section, what the
exercises **settled** and what they **left open**. It runs on the free path, and its
output lands in the Platform as a closing section.

It does three jobs at once:

1. **It makes the document honest.** A section the exercises genuinely settled reads as
   settled. A section they did not reads as open, instead of being padded with confident
   prose the data does not support.
2. **It gives the reader a way in.** "You have not decided who this is not for" is a
   sentence a founder can act on. Twenty-eight pages of positioning is not.
3. **It is the sales surface, generated from their own data.** The list of things they
   cannot resolve alone is the reason to book the Reading, in their words, about their
   brand, with no marketing attached to it.

This agent earns more than anything else in the plan for what it costs. It sits above the
content line, it deepens the asset rather than draining it, and it converts.

### 6.3 The Reading · the human, time-boxed

Ninety minutes, live, recorded. Not a discovery call and not a rewrite of the Platform.
Nizzar reads their document with them, pushes on the open questions, and the session
closes with a **Direction Note**: four to six pages appended to their Platform, signed and
dated, covering what the reading changed, the decisions they were avoiding, and the first
ninety days. It lands in their archive and re-renders into the same PDF.

Total operator time is about two and a half hours, because the system hands Nizzar a
**pre-read brief** before the call: their answers, their contradictions, their flags and
their open questions on one screen. That brief is what makes ninety minutes profitable
instead of ninety minutes of catching up.

### 6.4 The capacity math, stated plainly

The Reading does not scale and should not be expected to. Four a month at $490 is about
$2,000. The revenue engine at volume is $79 multiplied by traffic, which is why the Bing
and AI-answer position already built matters more than any pricing decision in this note.
The Reading is a qualification instrument that feeds Atelier, and it should be priced for
velocity rather than for margin. $490 is the recommendation. $690 is defensible and will
sell more slowly.

---

## 7. The portion problem

Free and unlimited are different words. A complete foundation is nine Sonnet runs, plus
the Open Questions agent. At roughly 8k input and 4k output per agent, that is near
**$0.80 per foundation** at current Sonnet pricing. The estimate needs verifying against
real runs before launch.

What keeps it affordable: one free brand per account, each agent capped at two runs on the
free path, re-collapse reserved for Platform owners, Sensescape already on Haiku 4.5 with
any other agent that holds quality moving there, a per-account daily rate limit, and a
hard monthly ceiling on free runs with an operator alert before it is reached.

---

## 8. Build plan

**Phase 1 · Operator-only gate.** `OPERATOR_ONLY_SLUGS` keyed on authenticated user id,
the seven pages off every public surface, `noindex`, sitemap rebuild.
Gate: `node scripts/registry-smoke.mjs` output pasted verbatim into the PR body, then an
unauthenticated probe of `POST /api/agents/run` and `GET /api/agents/console` confirming
handler-level 401 post-deploy.

**Phase 2 · One tool, four movements.** `tools.html`, `ecosystem.html` and `index.html`
rewritten around Observe, Collapse, Build, Hold, with the ten agents as steps inside one
flow rather than a catalogue.
Gate: `tests/site-audit/audit.mjs` and `tests/brand-casing/casing-audit.mjs` green.

**Phase 3 · The Open Questions agent.** New agent, brand level, reads the locked
foundation, emits settled and open per section. Registry merge gate applies.
Gate: run against three real foundations of different completeness and confirm the open
list actually differs between them.

**Phase 4 · The Platform renderer.** The $79 artifact. The Rapp &amp; Esen HTML architecture
turned into a template driven by the locked QBP, ivory `#FBFAF6` per the client-document
rule, with the How to read this spread and the What to do Monday page built in.
`docs/clients/rapp-esen/render.mjs` is the starting point: it already reports per-page
A4 overflow, and that check becomes a standing harness rather than a script someone
remembers to run.
Gate: no page clips its sheet, on three real foundations, at A4.

**Phase 5 · The money.** Per-brand entitlements replacing tier strings in
`api/_lib/tier-gating.js`, one-time payment mode in `api/stripe/checkout.js` and the
webhook, `payment.html` rebuilt on two purchasable lines plus Atelier, subscription prices
archived.
Gate: test-mode purchase of the Platform verified to grant the right entitlement on the
right brand and nothing else.

**Phase 6 · The Reading apparatus.** Booking link, the operator pre-read brief screen, the
Direction Note template appended to the Platform and re-rendered.
Gate: one Reading run end to end with a real person.

**Phase 7 · Re-audit and resubmit.** Sitemap drops seven URLs, IndexNow push,
`tests/seo-bing/bing-audit.mjs`, `tests/auth-flow/`.

---

## 9. Deferred, deliberately

- **Studio and white-label.** No audience yet, slow to sell.
- **The Brand Spec export** (JSON plus prompt pack). A good idea for an audience that
  arrives later. It folds into the Platform as an extra file when it does.
- **Hold as a paid line.** Brand Performance, Quarterly Review and Predictive Panel stay
  built and stay operator-reachable. They are not sold until the Platform has volume,
  because Intelligence about a brand nobody has locked yet is a product without a user.

---

## 10. Open

One number: the Reading at $490 or $690. The Platform is settled at $79.

---

*docs/strategy/brandos-recut-v1.md · v1.1 · BrandOS · September 2026*
