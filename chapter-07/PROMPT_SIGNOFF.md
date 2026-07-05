# Prompt sign-off · Phases 03, 04, 05 · one batch

Ten agents merged behind `PROMPT_HOLD_SLUGS` on 2026-07-04, between 01:56 and 18:09 local (PRs #208 through #212). Every one is registered, dispatchable, harness-verified GREEN in production, and Console-invisible until you sign its prompt. This is the one place to review and release them all.

Each prompt lives as `SYSTEM_PROMPT` in its module, under the marker line `The prompt · HELD FOR OPERATOR SIGN-OFF`. Read the prompt at the source; this document does not duplicate prompt text, so it cannot drift from it.

## The held ten

| # | Agent | Slug | Phase · tier | Prompt lives in | Sign |
|---|---|---|---|---|---|
| 1 | Newsletter Architecture | `newsletter_architecture_agent` | 03 · starter | `agents/newsletter-architecture.js` | ☐ |
| 2 | LinkedIn Strategy | `linkedin_strategy_agent` | 03 · starter | `agents/linkedin-strategy.js` | ☐ |
| 3 | Instagram Seed | `instagram_seed_agent` | 03 · starter | `agents/instagram-seed.js` | ☐ |
| 4 | YouTube Strategy | `youtube_strategy_agent` | 03 · starter | `agents/youtube-strategy.js` | ☐ |
| 5 | Content Bridge | `content_bridge_agent` | 03 · starter | `agents/content-bridge.js` | ☐ |
| 6 | Content Repurposing Engine | `content_repurposing_agent` | 04 · starter | `agents/content-repurposing.js` | ☐ |
| 7 | Content Scheduler | `content_scheduler_agent` | 04 · starter | `agents/content-scheduler.js` | ☐ |
| 8 | Brand Performance Dashboard | `brand_performance_agent` | 05 · pro | `agents/brand-performance.js` | ☐ |
| 9 | Quarterly Brand Review | `quarterly_review_agent` | 05 · pro | `agents/quarterly-review.js` | ☐ |
| 10 | Predictive Panel | `predictive_panel_agent` | 05 · pro | `agents/predictive-panel.js` | ☐ |

## What to check per prompt

1. Voice mechanics block present: no em dashes, no exclamation points, the banned-word list.
2. The no-invention rule: nothing fabricates metrics, testimonials, engagements, or founder stories. The Predictive Panel's probabilities are framed as simulation outputs, never as observed data.
3. The weakest-persona fallback: every agent that reads a founder paste states its no-paste behavior plainly (measurement scaffold, baseline review, from-foundation brief, strongest-dependency source, core-offer simulation).
4. Vendor discipline: Content Bridge names platforms only from its `OPERATOR_PLATFORMS` constant. Review that inventory while you are there; it was carried verbatim from the legacy tool.
5. The revision rule: feedback is applied concretely, not acknowledged.

## Release procedure (after signing, one batch or agent by agent)

1. Edit `api/agents/console.js`: remove the signed slugs from `PROMPT_HOLD_SLUGS`.
2. Nothing else changes in the app. The Console dedupe drops each released agent from its phase's locked card automatically and renders it live (the Phase 02 precedent).
3. The edit touches the dispatch path, so the standing registry merge gate applies: run `node scripts/registry-smoke.mjs`, record the output verbatim in the PR body, and probe `/api/agents/run` + `/api/agents/console` unauthenticated for handler-level 401 after deploy.
4. Decide the legacy page disposition. Each released agent has a standalone HTML tool at the repo root (`newsletter-architecture-agent.html`, `linkedin-strategy-agent.html`, `instagram-seed-agent.html`, `youtube-strategy-agent.html`, `content-bridge.html`, `content-repurposing-engine.html`, `content-scheduler.html`, `brand-performance-dashboard.html`, `quarterly-brand-review-agent.html`, `predictive-panel..html`). Release does not touch them; they keep serving until you retire them to `/_archive` (the journey-guide precedent), redirect them, or keep them deliberately. The three Phase 02 pages (`logo-direction-agent.html`, `logo-evaluation-agent.html`, `voice-guide-agent.html`) sit in the same undecided state since their 2026-06 release, so one sweep can settle all thirteen.

## Automated review · 2026-07-05

Before this surface reached you, all ten prompts ran through an automated pass of the five checks above: one reviewer per prompt doing a mechanical scan (em dash character, exclamation points, the banned-word list) plus the four judgment checks, and an adversarial verifier on every flag. Result:

- **Nine of ten came back READY**, every check PASS or N/A. Voice mechanics were clean on a mechanical scan across all ten: zero em dashes, banned words appear only inside each prompt's own ban list, no exclamation points in generated-copy guidance.
- **Content Bridge was the one exception.** It was the only content-drafter missing the explicit ban on fabricated statistics, testimonials, client names, and engagements that its four siblings carry, and its no-source draft path was a live route where an invented number could reach a founder's first post. Fixed in **#216** (one bullet matching the sibling wording and their `[your example here]` marked-slot mechanism). The prompt stayed held through the fix.
- The Predictive Panel's probabilities were confirmed framed as simulation outputs, never observed data. Content Bridge names platforms only from its `OPERATOR_PLATFORMS` constant. Every paste-reading agent states a concrete no-paste fallback.

The automated pass is a floor, not your signature. It cannot judge whether a prompt produces work you would put your name on. Read each prompt at its source and sign when the voice is yours.

## Sign here

- Signed by: ____________________
- Date: ____________________
- Released slugs (list or "all ten"): ____________________
