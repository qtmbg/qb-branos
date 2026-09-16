# Bing strategy v1
## BrandOS by Quantum Branding · September 2026

Written for the operator and whoever implements the next pass.

---

## 1. Why Bing is worth a dedicated strategy

Bing is not a smaller Google. It is a different machine with a different index, and that index is now the substrate underneath Microsoft Copilot, ChatGPT's web search, and DuckDuckGo. When Copilot answers a question about brand tooling, it sends generated queries to Bing, reads the pages that come back, and cites a handful of them. Nobody gets cited who is not first indexed and readable in Bing.

So the case is not "Bing has some market share." The case is that Bing is the cheapest door into AI answers, and AI answers are where a founder with an idea now asks their first question. Google has no equivalent free push protocol, no free citation report, and far more competition for the same phrases.

Four things follow from that, and they shape everything below.

**Bing reads the fetched HTML more than the rendered DOM.** Googlebot renders JavaScript aggressively. Bing renders less, later, and less reliably, and Copilot's retrieval layer works on fetched text. A page whose content arrives only after a client-side render is close to invisible here. This is the single largest problem this site had, and section 5 covers it.

**Bing matches phrases more strictly.** Exact query wording in the title and the H1 moves Bing further than it moves Google. Titles should carry the phrase a person would type, not a clever version of it.

**Bing writes snippets from the meta description far more faithfully.** A missing description means Bing composes one. A good one means Bing quotes you.

**Bing has a push protocol and a citation report that Google does not.** IndexNow removes crawl lag for free. The AI Performance report in Bing Webmaster Tools, in public preview since February 2026, is the only free view of how often a site is cited across AI surfaces.

---

## 2. The position to own

"The go to for what we do" needs to resolve into something a search engine can hold. Three claims, in descending order of how ownable they are.

**The entity claim.** BrandOS is a product of Quantum Branding, the practice founded by Nizzar Ben Chekroune, and it runs a named method called The Collapse. Bing leans on entity resolution harder than Google does. Until Bing is certain who this entity is, every other query is contested. "BrandOS" reads like a generic product name, which makes the entity work load-bearing rather than cosmetic.

**The category claim.** Brand operating system. Nobody else is using the phrase as a category, and it is the frame that makes BrandOS the default rather than one more entry in a list of branding tools. A tool competes on features. A category owns the question. Own the phrase across the homepage, the ecosystem page, the blog, and the entity markup, and Bing has no competing definition to weigh it against.

**The problem claim.** The queries a founder actually types before they know any product name. "How do I know if my brand is working." "Free brand audit." "What should my brand voice be." "How much does a branding agency cost." This is where the volume is, where Copilot pulls its answers, and where the site currently forfeits the most ground.

---

## 3. The query map

Four tiers. Each tier has a different job and a different surface.

### Tier A · Entity queries
`BrandOS` · `BrandOS by Quantum Branding` · `Quantum Branding Nizzar` · `The Collapse method branding` · `Signal Scan brand diagnostic`

These must be uncontested. They are the floor. Owned through the JSON-LD entity graph, consistent naming everywhere, and `sameAs` links to the profiles that already sit in the site footer.

Surfaces: `/`, `/ecosystem.html`, `/blog/what-is-the-collapse`.

### Tier B · Category queries
`brand operating system` · `brand OS` · `AI brand system` · `brand profile software` · `brand system for founders`

Low volume today, high ownership, and they compound. When somebody eventually searches the category, the site that defined it wins by default.

Surfaces: `/`, `/ecosystem.html`, `/tools.html`.

### Tier C · Problem queries
`free brand audit` · `how to tell if my branding is working` · `brand consistency checklist` · `how to write a brand voice guide` · `how to brief a logo designer` · `brand strategy for a solo founder` · `what is a brand archetype`

The volume tier, and the Copilot tier. A Copilot answer to any of these is worth more than a blue link, because the person reading it has not yet formed a shortlist.

Surfaces: `/signal-scan.html`, `/blog/*`, and the twenty tool pages, which is exactly where the content is thinnest.

### Tier D · Comparison queries
`Looka alternative` · `Canva brand kit vs` · `branding agency cost` · `cheaper than a brand agency` · `AI branding tool for agencies`

Bing's audience skews desktop, older, and further along in a purchase decision than Google's. Comparison intent converts harder here than anywhere else, and the site has no comparison surface at all. The ecosystem FAQ already answers "how is this different from Canva or Looka" in one paragraph. That paragraph deserves its own page.

Surfaces: none yet. See section 6.

---

## 4. What shipped in this pass

**IndexNow, wired end to end.** Key file at the site root, submission script at `scripts/seo/indexnow-submit.mjs`. Default mode submits only the pages whose source file changed in the last commit, because spraying the full site at IndexNow teaches Bing to discount the signal. `--all` exists for the first push and for a post-migration reindex.

**One URL inventory.** `scripts/seo/urls.mjs` is the single source of truth for the sitemap, the IndexNow submitter, and the audit. Every entry's path is the page's own canonical, so the site cannot disagree with itself.

**Sitemap rebuilt from that inventory.** Thirty-two URLs. The old file listed `/qb-branidos-hub.html`, which has 301'd for months, and stamped every page with the same hand-edited date. `lastmod` now comes from the last git commit that touched the file, which is a fact rather than a claim.

**Thirteen descriptions written.** Every agent surface shipped with no `<meta name="description">` and a boilerplate `og:description`. On Bing that is thirteen pages whose snippet was written by Bing. They now carry a real sentence in `description`, `og:description`, and `twitter:description`, each under 155 characters. Table lives in `scripts/seo/wire-descriptions.mjs` and rerunning is safe.

**FAQPage markup on two surfaces.** The six-pair accordion on `/ecosystem.html` was visible copy with no schema. It is now marked up word for word. `/signal-scan.html` has a new six-pair FAQ with matching markup. Copilot lifts answer text directly out of these, which makes the markup a citation surface rather than a formatting detail.

**Entity links.** The Organization node now carries `sameAs` to the practice site, X, and Instagram, and the founder is a first-class `Person` node with `@id` and a LinkedIn link. All four URLs were already published in the site footer, so nothing here is invented. `twitter:site` is set.

**robots.txt rewritten.** An explicit `bingbot` group, so crawl rules for Bing can be tuned later without touching the wildcard. Login, the agent console, and the brand document surfaces are now disallowed rather than left to be crawled and dropped.

**A static content layer on Signal Scan.** Covered in section 5.

**An audit harness.** `tests/seo-bing/bing-audit.mjs`. Runs on local files or against production with `--base`. Errors block, warnings report. Proven in both directions: breaking a canonical exits 1 and names the page, restoring it exits 0.

---

## 5. What the audit found

Run `node tests/seo-bing/bing-audit.mjs` for the current state. As of this pass: zero errors, twenty warnings, all real.

The finding that matters more than the rest:

**Seventeen sitemapped pages shipped with 103 static words, which is the nav and the footer and nothing else.** Every word of page-specific content arrived by JavaScript. Signal Scan was among them, at sitemap priority 1.0. The free diagnostic, the main acquisition surface, and Bing's first fetch of it contained no mention of a brand diagnostic. Eleven of the tool pages also load React from a CDN as a development build, which is slower and larger than the production build, on pages that are already invisible to a fetch.

Signal Scan is now fixed as the pattern: 584 static words under the tool, above the footer, in ordinary visible copy. It states what the scan is, the six dimensions it scores, what each score band means, where it sits in The Collapse, and six questions with matching FAQ markup. Nothing is hidden and nothing is written for machines only, which keeps it the opposite of cloaking.

The other sixteen need the same treatment. That is the highest-value work remaining and it is a content job, not an engineering job.

Also open, in priority order:

1. Four pages have no H1 at all: `/archetype-compass.html`, `/visual-dna.html`, `/war-table.html`, `/voice-guide-agent.html`, `/content-scheduler.html`. Bing has to infer the subject.
2. Nine pages carry two or three H1 elements, so the page claims more than one subject.
3. Four descriptions run past the 160 characters Bing renders. One, on `/atelier`, runs to 221 and gets cut mid-thought.
4. `/sensescape.html` has a 66-character description, too thin to answer anything.
5. The React development builds on eleven tool pages.

---

## 6. What to build next

**Sixteen static content layers.** Same pattern as Signal Scan. Each tool page needs a paragraph that defines the tool in plain language, a short list of what comes out of it, and two or three questions with FAQ markup. Every one of them is a Tier C answer surface that currently answers nothing.

**A comparison page.** `/compare` or `/vs`. Bing's audience arrives at comparison queries with a budget. The honest version of this page beats the marketing version, because Copilot rewards specificity and penalises hedging. Cover what a logo maker does, what an agency does, what BrandOS does, and where each one is the right answer.

**Four more articles, written to Tier C queries.** Question-shaped H2s, a definitional first paragraph that answers before it sells, and a date. Candidates: how to tell whether a brand is working, what a brand voice guide contains, how to brief a logo designer, what a branding agency actually costs.

**Fix the H1 structure.** One H1 per page, carrying the phrase somebody would type.

---

## 7. The operator steps

Five things only the account holder can do. Nothing in section 4 reaches Bing's dashboard without these.

1. **Verify quantumbranding.ai in Bing Webmaster Tools.** If Google Search Console is already verified, use the import option, which carries the verification and the existing sitemap over in one step. Otherwise take the meta tag option and paste the `msvalidate.01` tag into `HEAD-SNIPPET.html` and `index.html`.
2. **Submit `https://quantumbranding.ai/sitemap.xml`.**
3. **Register the IndexNow key in the IndexNow panel.** The key file deploys with the site. Confirm it loads as plain text at the root before registering.
4. **Turn on the AI Performance report.** This is the citation view. It is the number that answers "are we the go to," and no other free tool reports it.
5. **Confirm the three social profiles in the entity markup are the ones you want Bing to bind to.** They were taken from the site footer: `x.com/quantumbranding`, `instagram.com/thequantumbranding`, `linkedin.com/in/nizzar`.

---

## 8. The publishing loop

Every deploy that changes an inventoried page should push it.

```bash
node scripts/gen-sitemap.mjs              # lastmod from git, after the commit
node tests/seo-bing/bing-audit.mjs        # blocks on errors
node scripts/seo/indexnow-submit.mjs --changed   # after the deploy lands
```

Order matters. Submitting before Vercel finishes deploying sends Bing to the old version and wastes the freshness signal that IndexNow exists to buy.

For the first push after this pass ships, run `--all` once. After that, `--changed` only.

New page? Add it to `scripts/seo/urls.mjs` first. The sitemap, the submitter, and the audit all read from there, so one edit wires all three.

---

## 9. What not to do

**Do not submit the whole site to IndexNow on a schedule.** The protocol has no published daily cap, but the engines score submission quality. A host that pushes everything every day is a host whose pushes stop being trusted.

**Do not write a page for Bing that a person would not read.** The static layers work because they are real content placed where a real visitor benefits from it. A hidden block, a text-coloured-as-background block, or a block that contradicts the visible page is cloaking, and Bing is direct about acting on it.

**Do not chase volume in Tier C at the cost of Tier A.** An entity that Bing cannot resolve loses every query eventually, including the ones it already ranks for.

**Do not add geolocation to metadata or JSON-LD.** No `address`, `areaServed`, `geo`, or `ICBM`. Jurisdiction stays in the legal body copy where it is required, and nowhere else. Bing Places is a local-business product and does not apply here.

**Do not let the FAQ markup drift from the visible copy.** When the accordion text changes, the schema changes in the same commit. The audit cannot catch this one, so it is a discipline rather than a check.

---

## 10. How to know it is working

In order, and on roughly this timeline.

**Week 1.** The key file loads. Bing Webmaster Tools shows the sitemap accepted with 32 URLs and no errors. IndexNow submissions return 200.

**Weeks 2 to 4.** Indexed page count climbs toward 32. The pages that got descriptions start showing your sentence in the snippet rather than one Bing wrote. Tier A queries return the site first.

**Weeks 4 to 12.** The AI Performance report starts showing citations. Tier B phrases begin returning the site. Tier C only moves once the sixteen static layers land, so a flat Tier C before then is expected, not a failure.

**The number that answers the original question.** Not rank. Citation share in the AI Performance report on Tier C queries. Ranking first for "brand operating system" when three people search it monthly proves the phrase is ownable. Being the page Copilot quotes when somebody asks how to tell if their brand is working proves the position.

---

*docs/seo/bing-strategy-v1.md · BrandOS · September 2026*
