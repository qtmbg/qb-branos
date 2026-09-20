# BrandOS recut · brand only, free steak
## Strategy note v1 · 2026-09-20

Status: v1.2, 2026-09-20. Parts 5 onward rewritten around one commercial decision: two prices,
one door, and no middle tier. Parts 1 to 4 stand as written.

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

## 5. What is cheap now, and what is not

Intelligence went to zero. A founder with a chat window can have a positioning statement, an
archetype, a tone-of-voice guide and a competitor read in twenty minutes, at no cost, tonight.
Any plan that sells brand thinking as information is selling something the market already
gives away.

So the question is not what BrandOS knows. It is what stays scarce.

| Cheap now | Still scarce |
|---|---|
| Analysis, synthesis, frameworks | Being forced to choose |
| Articulate prose about a brand | Judgment with someone accountable behind it |
| Options, endlessly | An artifact a designer or an investor will accept |
| Generic competence | Taste |

The middle column is what a chat window is structurally bad at. It never makes anyone decide.
It offers alternatives forever, which feels like help and produces nothing. The method is
named The Collapse for the opposite reason.

That sets the whole commercial position:

> **Everything a strategist knows is free now. Everything a strategist does is not.**

BrandOS gives away the knowing. It sells the doing.

---

## 6. The decision · two prices, one door

| | | |
|---|---|---|
| **The exercises** | Free, one brand per account | The sequence, built from years of client work, run in full. Not a sample. Not a teaser. |
| **The Platform** | $79 one time, per brand | The document. Designed, argued, A4, theirs. |
| **Working with Nizzar** | **No price** | A door at the end of the document. Written to, not checked out. Quoted per situation. |

There is no third tier. This is a decision, not a gap.

### Why a fixed price on the human rung would be a mistake

1. **It would damage the $79.** A $490 button sitting beside a $79 button turns the $79 into
   the cheap option. Buyers downgrade themselves against a visible premium, and the sale that
   was certain becomes the sale that was second best. With one price, the Platform is not a
   tier. It is the product.
2. **It throws away the range.** A solo founder and a funded company and a maison are three
   different quotes for the same ninety minutes. A number on the page collapses all three to
   the lowest one.
3. **It contradicts a page already on the site.** `atelier.html` says scope, depth and terms
   get shaped per engagement. Putting a price list on the operator's judgment argues against
   the practice's own positioning.
4. **It costs weeks to build.** Checkout, calendar, prep screens, a session ritual, a Direction
   Note template, a second entitlement path. All of it before a single person has asked for it.
   A form and an inbox cost an afternoon and answer the same question.
5. **It would be answering a question nobody has asked yet.** If ten people write in during the
   first month, the product builds itself out of what they actually asked for. If nobody writes
   in, that was learned for free instead of learned after Phase 6.

Ambition is the risk here, and the middle tier is where the ambition was hiding.

### What the door looks like

The last page of every Platform, and the last card in the app, carries the open questions the
exercises could not settle, then one line and a form. No price, no calendar, no package. The
operator answers, and the number gets decided in that exchange.

---

## 7. Where the money actually is

This has to be said plainly so nobody expects the wrong thing from $79.

The Platform is not the business. At any realistic near-term traffic, the Platform recovers
model cost, filters the serious from the curious, and pays for the infrastructure. A few
hundred dollars a month is the honest expectation at the start, not a few thousand.

The business is Atelier, and the practice behind it. What BrandOS produces that no lead list
can match is a stream of founders who have spent ninety minutes articulating their own brand,
seen where it is unresolved, and paid money to keep the result. There is no warmer prospect
in this category.

Read that way, every decision in this note gets easier. The free tier should be generous past
the point of comfort, because its job is qualification, not conversion. The $79 should stay at
$79, because its job is to filter for seriousness rather than to maximise revenue. And the
middle tier should not exist, because it sits between the qualifier and the business and
competes with both.

---

## 8. Why anyone pays $79 for something they already saw

The free path must not feel like a trailer, and the paid object must not feel like a
screenshot with a border. One boundary solves both:

> **The screen shows what was decided. The document shows why.**

On screen, free, complete: the positioning, the archetype, the five words, the voice rules,
the visual direction, the open questions. Every conclusion, nothing withheld, usable as it
stands.

In the document, paid: the argument. Which answers produced which conclusion, what was
considered and rejected, where the tension sits, what the founder said that settled it. The
Rapp &amp; Esen platform reads this way, and the reason it is worth 54 pages is not the
conclusions. It is the reasoning between them.

That boundary is a real product line rather than a paywall, and it is defensible in a sentence
to anyone who asks.

---

## 9. The constraint that shapes the document

The Rapp &amp; Esen platform is the benchmark for craft, not for depth. It came from 262 minutes
of recorded sessions with the operator in the room, pushing back. The exercises produce
structured answers. They do not produce an argument of that grade.

A generated Platform carries the architecture, the typography, the A4 discipline and the
honesty. It does not carry the part that came from a human disagreeing with the founder. That
difference is precisely what the door at the end is for, and the document should say so in its
own voice rather than pretend otherwise.

---

## 10. The Open Questions agent

One new brand-level agent reads the locked foundation and emits, per section, what the
exercises settled and what they left open. It runs on the free path. Its output appears on
screen free and closes the paid document.

It carries three jobs on one build:

1. **Honesty.** A section the answers settled reads as settled. A section they did not reads as
   open, rather than padded with confident prose the data does not support.
2. **A way in.** "You have not decided who this is not for" is a sentence a founder can act on.
   Twenty-eight pages of positioning is not. This is the direct answer to the operator's
   observation that a beautiful document can be unreadable.
3. **The door.** The list of what they cannot resolve alone is the reason to write in, phrased
   in their language, about their brand, with nothing promotional attached.

It should name the decision being avoided, not produce a neutral inventory of gaps.

---

## 11. The portion problem

A complete foundation is nine Sonnet runs plus the Open Questions agent, roughly 8k input and
4k output each, which lands near **$0.80 per foundation** at current Sonnet pricing. Verify
against real runs before launch.

Controls: one free brand per account, each agent capped at two runs on the free path,
re-collapse reserved for Platform owners, Sensescape already on Haiku 4.5 with any other agent
that holds quality moving there, a per-account daily rate limit, and a hard monthly ceiling on
free runs with an operator alert before it is reached.

---

## 12. Build plan

Six phases. The money phase is small now, because there is exactly one purchasable thing:
one price, one-time mode, one entitlement, no tiers, no calendar, no second checkout path.

**Phase 1 · Operator-only gate.** `OPERATOR_ONLY_SLUGS` keyed on authenticated user id, the
seven content pages off every public surface, `noindex`, sitemap rebuild.
Gate: `node scripts/registry-smoke.mjs` output verbatim in the PR body, then an unauthenticated
probe of `POST /api/agents/run` and `GET /api/agents/console` confirming handler-level 401
post-deploy.

**Phase 2 · One tool, four movements.** `tools.html`, `ecosystem.html` and `index.html` rebuilt
around Observe, Collapse, Build, Hold, with the ten agents as steps inside one flow. The page
argues the position in Part 5: the knowing is free, the doing is not.
Gate: `tests/site-audit/audit.mjs` and `tests/brand-casing/casing-audit.mjs` green.

**Phase 3 · The Open Questions agent.** Registry merge gate applies.
Gate: run against three real foundations of differing completeness and confirm the open list
genuinely differs between them.

**Phase 4 · The Platform renderer.** The $79 object. The Rapp &amp; Esen HTML architecture as a
template driven by the locked QBP, ivory `#FBFAF6` per the client-document rule, carrying the
reasoning rather than restating the screen, with a How to read this spread at the front and a
What to do Monday page at the back. `docs/clients/rapp-esen/render.mjs` already reports
per-page A4 overflow; that check becomes a standing harness.
Gate: no page clips its sheet, on three real foundations, at A4.

**Phase 5 · One price, and the door.** One-time mode in `api/stripe/checkout.js` and the
webhook, a single per-brand entitlement replacing tier strings in `api/_lib/tier-gating.js`,
`payment.html` reduced to one product, the three subscription prices archived. The door is a
form and an inbox.
Gate: test-mode purchase grants the entitlement on the right brand and nothing else.

**Phase 6 · Re-audit and resubmit.** Sitemap drops seven URLs, IndexNow push,
`tests/seo-bing/bing-audit.mjs`, `tests/auth-flow/`.

---

## 13. Deferred, deliberately

- **A priced middle tier.** Revisit only when the inbox says what it should be.
- **Studio, white-label, multi-brand.** No audience yet.
- **The Brand Spec export.** Folds into the Platform later, as an extra file.
- **Hold as a paid line.** Brand Performance, Quarterly Review and Predictive Panel stay built
  and operator-reachable. Intelligence about a brand nobody has locked yet has no user.

---

## 14. Open

Nothing. Two prices, $0 and $79, and a door with no number on it.

---

*docs/strategy/brandos-recut-v1.md · v1.2 · BrandOS · September 2026*
