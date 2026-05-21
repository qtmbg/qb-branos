# QB BrandOS — Build State and Roadmap
## Source of truth for all build sessions
## Owner: Ahmed Nizzar Ben Chekroune

> **RECONCILIATION NOTE (Chapter 3 open, 2026-05-21):** Chapters 1 (Foundation Stack) and 2 (Agent Framework) are CLOSED and shipped. The "Current state of production" and per-layer "Status" notes below PREDATE the build and are retained as historical planning context only. They are NOT current. The live plan of record is the "The Chapters" section. Current shipped reality: foundation lock + QBP + Soul Map synthesis (Ch1); agent registry, runtime, console, archive tree-view, chain orchestration, three-consumer Realtime, 14-harness suite (Ch2); defect-rate 8 product surgical fixes total, six consecutive clean closing steps. Chapter 3 = Asset Layer, scoped to MINIMUM to unblock Chapter 4: a founder uploads a file, an agent reads it. Deferred: versioning, ZIP export, tier-based storage limits (logged to pre-launch as PL-003).

---

## How we work

We work in chapters. Each chapter has a written spec. The spec is locked before any code is written. We do not start the next chapter until the current one is fully done at the quality bar.

No timeline discussion. Greatness is the constraint. Time is a variable.

The stack: Claude app for thinking and architecture, Cod (Claude Code) for execution, browser agents for verification.

Communication style: direct, precise, no flattery, no filler. Challenge assumptions. No em dashes. No emojis. Number issues, letter options.

---

## What QB BrandOS is

A brand operating system for founders. Not a course, not a toolkit, not a SaaS dashboard. A surface a founder lives inside while their brand is built around them by 20 AI agents.

Closest analogues: Bloomberg Terminal for finance, Figma for design, Ableton for music. Infrastructure for a profession, not a feature set.

Positioning line: "From idea to orbit."

Core philosophical premise: the Responsibility OS. Automation only activates after the human does the thinking. Phase 01 is self-paced, meditative, founder-only. After foundation locks, 20 agents produce artifacts in the background. The user never chats with agents.

---

## Pricing and gating, locked

**Free tier:**
- Signal Scan (diagnostic)
- Archetype Compass
- Brand Soul Map
- Sensescape
- Foundation lock
- Soul Map synthesis artifact delivered
- QBP visible, not exportable

**Paywall fires after Soul Map synthesis is delivered.**

**Starter $97/mo:**
- Visual DNA and War Table exercises unlock
- Full QBP export
- Sensescape, Visual DNA, War Table synthesis artifacts
- Phase 02 agents (Logo Direction, Logo Evaluator, Voice Guide)
- Phase 03 content agents (Instagram, LinkedIn, YouTube, Newsletter, Content Bridge)

**Pro $247/mo:**
- Everything in Starter
- Predictive Panel
- Quarterly Brand Review
- Strategy call per quarter
- Priority support

**Agency $1,497/mo:**
- Up to 5 client brand workspaces
- White-label per client
- Multi-tenant QBPs
- Client portals
- Unlimited runs

**Atelier:** custom, written application only, premium consulting with Nizzar directly.

Annual pricing: ~17% discount across all paid tiers.

---

## The 9-layer system being built

### Layer 1 — Identity (Phase 01)
The founder's brand truth, captured through exercises, synthesized into the QBP.

Components: Archetype Compass, Brand Soul Map, Sensescape, Visual DNA, War Table, The Profiles, The QBP as a living document.

Status: tools exist but isolated. QBP exists as data, not as a rendered surface.

### Layer 2 — Production (the 20 Agents)
Background agents that read the QBP and produce artifacts.

Agents:
- Phase 01 synthesis (4): Soul Map, Sensescape, Visual DNA, War Table Synthesizers
- Phase 02 creation (3): Logo Direction, Logo Evaluator, Voice Guide
- Phase 03 content (5): Instagram Seed, LinkedIn Strategy, YouTube Strategy, Newsletter Architecture, Content Bridge
- Phase 04 execution (2): Content Repurposing, Content Scheduler
- Phase 05 intelligence (3): Performance Dashboard Analyzer, Quarterly Review, Predictive Panel
- Foundational (3): Brand Document Compiler, Tier Guide, Atelier Recognizer

Status: 1 of 20 built and shipped (Soul Map Synthesizer).

### Layer 3 — Artifacts (Reading Surface)
Where every artifact produced by every agent is read.

Status: does not exist. Current implementation expands artifacts inline in dashboard cards. Replacement needed.

Requirements: editorial template, Fraunces headlines, generous reading width, version history, share controls, print-ready, PDF export, linked to source QBP fields, linked to source files.

### Layer 4 — Assets (File Management)
Founder uploads (footage, photos, references) and system-generated files (logos, content, reports).

Status: does not exist. No upload UI, no storage layer beyond Supabase tables.

Requirements: Supabase Storage buckets, upload UI, file browser, previews, signed URLs, versioning, linking to artifacts and agents.

### Layer 5 — Brand Creation (Phase 02 surface)
Logo direction, logo evaluation, voice guide production.

Status: agents not built. Surface not built.

### Layer 6 — Content (Phase 03 surface)
Content strategy across Instagram, LinkedIn, YouTube, Newsletter. Content Bridge for production routing.

Status: agents not built. Phase 03 platform integrations (Canva, HeyGen, Creatify) not built.

### Layer 7 — Execution (Phase 04 surface)
Content repurposing, scheduling, calendar, approvals.

Status: agents not built. Buffer integration not wired.

### Layer 8 — Intelligence (Phase 05 surface)
Performance dashboard, quarterly review, predictive panel.

Status: agents not built.

### Layer 9 — Multi-brand and Account (Agency tier)
Multi-tenant workspaces, white-label, client portals.

Status: not built. URL parameter white-label works in isolated tools.

---

## Current state of production, named honestly

Working:
- Auth (magic links via Resend, verified end-to-end)
- Marketing pages (index, ecosystem, signal-scan locked to v3.2 design system)
- Dashboard.html (exists but list-of-cards pattern, needs rework)
- One synthesis agent in production (Soul Map Synthesizer, output quality verified)
- Foundation lock flow (lock-foundation.js Edge function, idempotent, JWT-verified)
- Dispatch chain (api/agents/dispatch.js routes to agent registry)
- Two transactional emails (foundation locked, artifact ready)
- Supabase tables: profiles, tool_completions, artifacts (with RLS)
- Stripe webhook wired (running in demo mode pending live credentials)
- Klaviyo retired (replaced by Resend)

Known issues to fix:
- Dashboard "Nothing here yet" empty state renders even when artifact exists
- Dashboard "View profile" CTA should say "View foundation"
- Locked Phase 02-05 cards show no unlock signal
- Artifact inline expansion in card column is unreadable (the real driver of next chapter)
- Some emails landing in Gmail Promotions tab instead of Primary (deliverability tuning)

Not built:
- Artifact reading surface (next chapter)
- QBP rendering surface
- 19 of 20 agents
- File management layer
- Phase 02-05 surfaces
- Agency multi-brand
- Atelier workspace
- Real Stripe live test
- Error monitoring
- Legal pages
- Customer support flow

---

## The Chapters

Each chapter ships a meaningful release of capability. Each chapter is fully done before the next starts.

### Chapter 1 — The Foundation Stack
Goal: free tier journey complete with paywall placed correctly after first synthesis artifact.

Builds:
- QBP rendering surface (live document, viewable always, exportable behind paywall)
- Foundation page (replaces current dashboard architecture, shows Phase 01 progress, lock state, archive)
- Brand Archive shell (artifacts indexed and filterable)
- Artifact reading surface (one template, editorial layout, all 20 future agents render through it)
- Sensescape Synthesizer agent
- Visual DNA Synthesizer agent
- War Table Synthesizer agent
- Paywall integration: free user receives Soul Map synthesis, sees 3 more locked, hits paywall on view attempt, converts to Starter to unlock
- Fix the 4 dashboard bugs above as part of the rebuild

End state: free user completes journey, locks foundation, gets one editorial artifact, sees three more locked, hits the wall at the right moment.

### Chapter 2 — The Agent Framework
Goal: the one-off agent pattern becomes infrastructure that scales to 20+ agents.

Builds:
- Agent registry (single declaration point)
- Agent contract (inputs, outputs, triggers, dependencies, retries)
- Agent runtime (dispatch, error recovery, logging, manual re-run)
- Run history on artifacts table
- Agent Console surface (the user sees their workforce)
- Chain orchestration (Phase 01 done triggers Phase 02 ready)
- Notification system (email + in-app)

End state: adding a new agent is configuration, not code.

### Chapter 3 — The Asset Layer
Goal: file management that supports Phase 03 production.

Builds:
- Supabase Storage buckets, scoped per user and tier
- Upload UI (drag-drop, multi-file, progress)
- File browser with previews (image, video, PDF, audio)
- File metadata (phase, agent, artifact links)
- Signed URLs, versioning, ZIP export

End state: founders can upload, the system can route files into Phase 03 work.

### Chapter 4 — Phase 02 (Brand Creation)
Goal: logo and voice production for paying users.

Builds:
- Logo Direction Agent
- Logo Evaluation Agent (file upload required)
- Voice Guide Agent
- Phase 02 surface in the dashboard
- All three artifacts render through the reading surface

### Chapter 5 — Phase 03 (Content)
Goal: full content strategy + Content Bridge.

Builds:
- Instagram Seed Agent
- LinkedIn Strategy Agent
- YouTube Strategy Agent
- Newsletter Architecture Agent
- Content Bridge (routing to Canva, HeyGen, Creatify)
- Content approval loop (3 revision rounds per piece)

### Chapter 6 — Phase 04 (Execution)
Goal: content moves from draft to scheduled to published.

Builds:
- Content Repurposing Engine
- Content Scheduler (Buffer integration)
- Calendar surface
- Approval gates
- Publish notifications

### Chapter 7 — Phase 05 (Intelligence)
Goal: the brand becomes self-aware.

Builds:
- Performance Dashboard Analyzer
- Quarterly Review Agent
- Predictive Panel
- Feedback loops into next quarter's planning

### Chapter 8 — Multi-Brand and Agency
Goal: one user managing multiple white-labeled client brands.

Builds:
- Multi-tenant data architecture
- Agency dashboard
- Per-client white-label
- Per-client billing roll-up
- Client portal access controls

### Chapter 9 — Atelier
Goal: premium consulting workspace.

Builds:
- Application flow
- Cal.com booking integration
- Project workspace per Atelier client
- Personal annotation layer (Nizzar marks up artifacts)
- Direct file sharing
- Atelier tier badge and routing

### Chapter 10 — Hardening and Launch
Goal: production-ready in every sense.

Builds:
- Stripe live (all four tiers tested with real cards)
- Sentry or equivalent error monitoring
- Performance monitoring
- Rate limiting
- Security audit
- Legal pages (terms, privacy, refund)
- Customer support flow
- Onboarding refinement
- Public launch sequence

---

## Technical stack (locked)

- Frontend: vanilla HTML/CSS/JS, no framework, no build step
- Deployment: Vercel (auto-deploy from GitHub qtmbg/qb-branos main branch)
- Hosting: quantumbranding.ai (marketing), app.quantumbranding.ai (product, currently routes to /dashboard.html)
- Auth + DB: Supabase
- Payments: Stripe
- Email: Resend (auth@quantumbranding.ai verified, reply-to me@qtmbg.com)
- AI: Anthropic API, default claude-sonnet-4-6, max_tokens 4000, Edge runtime with 25s budget
- Content scheduling (planned): Buffer API
- Production integrations (planned): Canva, HeyGen, Creatify
- Booking (planned): Cal.com

---

## Design system (v3.2, locked)

Origin: derived from pomegranate.health structure, New Yorker editorial illustration direction. Romain Blais lock is dead.

Six signatures:
1. Cream + ink palette
2. 3D two-layer pill button
3. Hard offset shadow (no blur)
4. Eyebrow tag + Fraunces headline
5. Fluid clamp type and space scale
6. New Yorker illustrations in cream cards

Colors (key tokens):
- Surface: cream #FBF5E6, cream-card #F2EBD3, white #FFFEF8
- Ink: aubergine #2D1521
- Brand: gold #E0B069 (primary CTA), rose #CA6180 (brand mark)
- Phase colors: discovery, creation, content, execution, intelligence each have dedicated tokens

Typography:
- Display: Fraunces (variable)
- Body: Inter (variable)
- Mono: JetBrains Mono

Rules:
- CSS variables only
- Vanilla JS only
- Self-contained files
- Mobile-first responsive
- localStorage as persistence layer
- Reduced-motion respected

Illustration library: 11 PNGs inventoried (blank-slate, doubter, player, agency, guide, synergy, three-steps, start-building, phase_4, phase_5, nizzarfounder). Library is closed. Three editorial styles present, not yet normalized to v3.2 palette.

---

## How a new chat should start

Read this document. Confirm understanding. Ask which chapter we are working on. Then write the spec for that chapter (or continue the spec already in progress).

If the chapter is Chapter 1, the next action is to write the full Chapter 1 spec covering: every route, every component, every data model change, every API endpoint, every Supabase migration, every empty state, every error state, every edge case, the artifact content schema, the paywall trigger logic, and the definition of done.

Never start coding until the spec is locked.
