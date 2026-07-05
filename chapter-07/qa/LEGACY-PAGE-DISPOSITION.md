# Legacy standalone tool pages · disposition analysis

Thirteen standalone HTML tools still serve at the repo root while their framework agents supersede them. This is the analysis for the retire-or-redirect-or-keep decision (PROMPT_SIGNOFF.md release step 4). The decision is the operator's; the impact below is measured, not assumed.

## The thirteen pages and their agents

| Legacy page | Framework agent | Prompt state |
|---|---|---|
| `newsletter-architecture-agent.html` | `newsletter_architecture_agent` | held |
| `linkedin-strategy-agent.html` | `linkedin_strategy_agent` | held |
| `instagram-seed-agent.html` | `instagram_seed_agent` | held |
| `youtube-strategy-agent.html` | `youtube_strategy_agent` | held |
| `content-bridge.html` | `content_bridge_agent` | held |
| `content-repurposing-engine.html` | `content_repurposing_agent` | held |
| `content-scheduler.html` | `content_scheduler_agent` | held |
| `brand-performance-dashboard.html` | `brand_performance_agent` | held |
| `quarterly-brand-review-agent.html` | `quarterly_review_agent` | held |
| `predictive-panel..html` | `predictive_panel_agent` | held |
| `logo-direction-agent.html` | `logo_direction_agent` | released 2026-06 |
| `logo-evaluation-agent.html` | `logo_evaluation_agent` | released 2026-06 |
| `voice-guide-agent.html` | `voice_guide_agent` | released 2026-06 |

## These pages are not dead. They are the current linked tool surface

Inbound links from live production pages (measured 2026-07-05):

- **`tools.html` links to all thirteen** (fifteen `href`s counting variants). It is the tool directory.
- **`ecosystem.html`** links to `brand-performance-dashboard`, `content-repurposing-engine`, `instagram-seed-agent`, `voice-guide-agent`.
- **`war-table.html`** links to every one of the thirteen.
- **`brand-soul-map.html`** links to `logo-direction-agent`, `voice-guide-agent`.
- **`signal-scan.html`** links to `logo-evaluation-agent`.

Archiving any page without rewiring these links produces dead links. `tests/site-audit/audit.mjs` would catch them (it GET-checks every deduped href), so a naive move breaks the standing audit.

## Routing today

`vercel.json` contains no rewrite or redirect for twelve of the thirteen. The one exception is the `predictive-panel..html` double-dot pair (a rewrite maps `predictive-panel.html` to the real `predictive-panel..html`). Any retire or redirect must handle that pair together and test both URLs.

## The precedent

`journey-guide.html` (Chapter 1) was retired by moving the file to `/_archive/chapter-1-deprecations/`, keeping git history, and removing its inbound links. `_archive/chapter-1-deprecations/` already holds `journey-guide.html`, `dashboard.html`, `qb-branidos-hub.html`. This is the established retire path.

## Options

1. **Keep serving, deliberately.** The standalone tools work with an API key and serve users outside the founder-dispatch flow. Cost: two surfaces per capability, drift risk, and a tools directory that competes with the Console. No work now.
2. **Redirect to the Console.** Add `vercel.json` redirects from each legacy URL to the relevant Console phase, rewire the inbound links in `tools.html`, `ecosystem.html`, `war-table.html`, `brand-soul-map.html`, `signal-scan.html`, and keep the files as archived source. Preserves any external inbound links. Most work, cleanest result.
3. **Retire to `/_archive`.** Move the files, rewire the same inbound links, add redirects so old URLs do not 404. Same link sweep as option 2 without keeping the pages routable.

## Recommendation

**Do not retire until the ten held prompts are released** (Task 1). While the framework agents are Console-invisible, the standalone tools are the only way a user reaches those capabilities, so they are load-bearing revenue surface today. Once the prompts are signed and the Console renders the agents live, run one sweep: redirect the thirteen URLs to their Console phases (option 2), rewire the five referring pages, handle the `predictive-panel` double-dot pair explicitly, and confirm with `node tests/site-audit/audit.mjs` (expect zero dead links, all pages at SOT navCount). Sequencing this after release means the product never has a moment where a capability is reachable from neither the Console nor a standalone tool.

*Legacy-page disposition · QB BrandOS · 2026-07-05*
