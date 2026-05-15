# Chapter 1 — The Foundation Stack
## QB BrandOS Build Specification
## Status: Locked. Build against this document.
## Owner: Ahmed Nizzar Ben Chekroune
## Source of truth: QB Build State and Roadmap (April 2026)

---

## 0. Chapter goal

A founder signs up, completes the free-tier Phase 01 journey (Archetype Compass, Brand Soul Map, Sensescape), locks their foundation, receives the Soul Map synthesis artifact rendered through an editorial reading surface, sees three more locked artifacts, and hits the paywall when they try to view a locked artifact or export their QBP. Upgrading to Starter unlocks the remaining Phase 01 exercises (Visual DNA, War Table) and the three locked synthesis artifacts.

The current dashboard and hub patterns are eliminated and replaced by three new surfaces: Foundation, Brand Archive, and QBP. The editorial reading surface is built once and serves all 20 future agents.

Three new synthesis agents ship: Sensescape, Visual DNA, War Table. They follow the existing one-off pattern of the Soul Map Synthesizer. The agent framework refactor happens in Chapter 2.

---

## 1. Scope

### In scope
- Routes: /foundation, /archive, /artifact/[id], /qbp, /paywall, /account
- Surfaces: Foundation page, Brand Archive, QBP rendering surface, Artifact reading surface, Paywall modal and page, minimal Account page
- Agents: Sensescape Synthesizer, Visual DNA Synthesizer, War Table Synthesizer
- Data: artifacts schema extension, artifact_runs table, qbp_revisions table, profiles tier columns, all migrations and RLS
- API endpoints: agent dispatch (extend for 3 new agents), QBP read, QBP export, artifacts list, artifact read, artifact regenerate
- Payments: Stripe checkout for Starter, webhook updating tier
- Email: artifact-ready transactional via Resend, deliverability verified to Primary inbox
- Design: v3.2 design system locked on every new surface
- Illustrations: CSS filter tinting approach, applied to Foundation page persona illustrations only
- Deprecations: dashboard.html, qb-branidos-hub.html, journey-guide.html removed from routing
- QA: manual mobile and desktop pass, real Stripe test card end-to-end

### Out of scope (defer to later chapters)
- The Profiles exercise (deferred)
- Agent framework refactor (Chapter 2)
- File upload and asset management (Chapter 3)
- Phase 02 logo and voice agents (Chapter 4)
- Phase 03 content agents (Chapter 5)
- Phase 04 execution and scheduling (Chapter 6)
- Phase 05 intelligence agents (Chapter 7)
- Agency agency (Chapter 8)
- Atelier workspace and Atelier Recognizer (Chapter 9)
- Stripe live for Pro and Agency tiers (Chapter 10)
- Error monitoring, legal pages, support flow (Chapter 10)
- Illustration SVG conversion (deferred indefinitely)

---

## 2. Routes

### 2.1 Existing routes (no change)
| Route | File | Notes |
|---|---|---|
| `/` | index.html | Locked v3.2. No change. |
| `/ecosystem` | ecosystem.html | Locked v3.2. No change. |
| `/signal-scan` | signal-scan.html | Locked v3.2. Remove `kpk` and `kli` params (Klaviyo retired). |
| `/auth` | auth.html | Working. No change. |

### 2.2 Existing routes being deprecated
| Route | Action |
|---|---|
| `/dashboard` | Remove from routing. File stays in repo for reference. Redirect to `/foundation`. |
| `/hub` (qb-branidos-hub.html) | Remove from routing. Redirect to `/foundation`. |
| `/journey-guide` | Remove from routing. No redirect. |

### 2.3 New routes
| Route | File | Purpose |
|---|---|---|
| `/foundation` | foundation.html | Post-login landing. Phase 01 progress, lock CTA, exercise status, artifact links, paywall triggers. |
| `/archive` | archive.html | Brand Archive. Filterable list of all artifacts. |
| `/artifact/[id]` | artifact.html (dynamic) | Editorial reading surface. One template, all agents render through it. |
| `/qbp` | qbp.html | Live QBP document. Read-only on free tier. Export gated. |
| `/paywall` | paywall.html | Full-page upgrade view (modal version is component 2F). |
| `/account` | account.html | Minimal: email, tier, subscription, sign out. |

### 2.4 Routing rules
- All `/foundation`, `/archive`, `/artifact/*`, `/qbp`, `/paywall`, `/account` routes require authentication. Unauthenticated requests redirect to `/auth?next=<original>`.
- Post-login destination: `/foundation` always. Never `/qbp`. Never `/dashboard`.
- The `/artifact/[id]` route reads the artifact, evaluates lock state for the user's tier, and either renders or paywalls.

---

## 3. Components

All components are vanilla custom elements or template fragments. No framework. Each is a single function that returns an HTMLElement and is rendered into a target container. State lives in localStorage and is hydrated from Supabase on page load.

### 3.1 `<qb-nav>`
Persistent top navigation.
- Logo (left, links to `/foundation`)
- Links (right): Foundation, Archive, QBP, Account
- Tier badge inline with Account link
- Active route highlighted with underline in `--gold`
- Mobile: hamburger reveals a full-screen overlay menu

### 3.2 `<qb-phase-card>`
Phase 01-05 status card on Foundation page.
- Phase number, phase name, eyebrow tag (e.g. "01 Discovery")
- Phase color via `--phase-discovery` etc.
- Three states:
  - **Available**: shows progress count (e.g. "2 of 4 exercises complete"), CTA "Continue"
  - **Complete**: shows lock timestamp, CTA "View artifacts"
  - **Locked**: shows reason ("Unlock Phase 02 with Starter"), CTA "Upgrade" linking to `/paywall?reason=phase_02`
- Hard offset shadow per design system

### 3.3 `<qb-exercise-card>`
Individual Phase 01 exercise card.
- Exercise name (Fraunces)
- One-line description (Inter)
- State pill: "Not started", "In progress", "Complete"
- Last saved timestamp if applicable
- Primary CTA: "Begin" / "Continue" / "Review"
- Locked variant for Visual DNA and War Table when tier is free: lock icon, copy "Available with Starter", CTA "Upgrade"

### 3.4 `<qb-artifact-row>`
Brand Archive list row.
- Artifact title (Fraunces)
- Phase tag + agent attribution (mono)
- Generated date
- Status pill: "Delivered", "Generating", "Failed", "Locked"
- Click target: navigates to `/artifact/[id]` if delivered, paywall if locked, no-op if generating

### 3.5 `<qb-lock-foundation-cta>`
The action that fires the `lock-foundation` Edge function.
- Disabled state with copy "Complete all four Phase 01 exercises to lock your foundation" (free tier: three exercises)
- Enabled state with primary 3D pill button "Lock my foundation"
- Confirmation modal before firing: "Once you lock your foundation, your Phase 01 answers become immutable. Your synthesis artifacts will be produced and emailed to you within minutes."
- On success: redirect to `/foundation` with a banner "Your foundation is locked. Your first artifact is being prepared."

### 3.6 `<qb-paywall-modal>`
Modal triggered by locked artifact click or QBP export attempt on free tier.
- Eyebrow: "Locked"
- Headline: "Unlock the rest of your foundation."
- Body: single paragraph naming exactly what unlocks (Visual DNA exercise, War Table exercise, three remaining synthesis artifacts, QBP export)
- Price: "Starter, $97/month. Cancel anytime."
- Primary CTA: "Upgrade to Starter" → Stripe checkout
- Secondary: "Not now" → closes modal
- Mobile: full-screen sheet rather than centered modal

### 3.7 `<qb-empty-state>`
Standardized empty state.
- Eyebrow + headline + one-line body + single CTA
- Rendered only when underlying data array is empty. Conditional rendering is a hard rule. The dashboard bug where empty state showed alongside content does not recur.
- Variant: cold start (zero exercises), waiting (foundation locked, artifacts generating), failed (last run errored), locked (free tier viewing locked content)

### 3.8 `<qb-tier-badge>`
Small pill showing current tier.
- Free: cream-edge background, ink text, label "Free"
- Starter: gold background, ink text, label "Starter"
- Pro: rose background, white text, label "Pro"
- Agency: aubergine background, white text, label "Agency"
- Atelier: ink background, gold text, label "Atelier"

### 3.9 `<qb-share-controls>`
On Artifact reading surface footer.
- Copy link button (always available)
- Print button (always available)
- Download PDF button (gated: free can download Soul Map only, Starter+ can download all)
- Share via email (Starter+)
- Each control is icon + label, ink-on-cream

### 3.10 `<qb-qbp-section>`
A section block on the QBP rendering surface.
- Eyebrow (e.g. "Soul Axis"), Fraunces sub-headline, prose rendered from QBP field
- Empty state: "This will populate when you complete [Brand Soul Map]." Link to the exercise.
- Each section is independently render-able from its QBP fields.

---

## 4. Data model

### 4.1 `profiles` table — additions
Existing columns preserved. Add:
| Column | Type | Default | Notes |
|---|---|---|---|
| `tier` | text (enum) | `'free'` | One of: free, starter, pro, agency, atelier |
| `tier_started_at` | timestamptz | null | Set when tier changes. Used for idempotency in webhook. |
| `foundation_locked_at` | timestamptz | null | Confirm exists. If not, add. |
| `qbp_jsonb` | jsonb | `'{}'::jsonb` | Live QBP document. Updated on every exercise save and on foundation lock. |

### 4.2 `tool_completions` table
Confirm schema supports all slots:
- `archetype_compass`
- `brand_soul_map`
- `sensescape`
- `visual_dna`
- `war_table`
- `the_profiles` (slot exists, exercise not built in Chapter 1)

Add unique constraint on `(user_id, tool_slug)`.

### 4.3 `artifacts` table — additions
Existing columns preserved. Add:
| Column | Type | Default | Notes |
|---|---|---|---|
| `phase` | text | required | Phase identifier: '00', '01', '02', '03', '04', '05' |
| `agent_slug` | text | required | e.g. `soul_map_synthesizer`, `sensescape_synthesizer` |
| `status` | text (enum) | `'queued'` | One of: queued, generating, delivered, failed |
| `version` | int | 1 | Increments on regenerate |
| `parent_artifact_id` | uuid | null | References previous version when regenerated |
| `content_jsonb` | jsonb | null | Artifact content conforming to schema in section 7 |
| `failed_reason` | text | null | Set when status = failed |

`locked` is **not** stored. It is computed at read time based on `profiles.tier` and `artifacts.phase` + `artifacts.agent_slug`.

### 4.4 New table `artifact_runs`
Audit log for agent runs.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `artifact_id` | uuid | FK to artifacts.id |
| `agent_slug` | text | |
| `status` | text | One of: started, succeeded, failed |
| `error` | text | Null unless failed |
| `duration_ms` | int | Null until completion |
| `model` | text | e.g. `claude-sonnet-4-6` |
| `tokens_in` | int | Null until completion |
| `tokens_out` | int | Null until completion |
| `created_at` | timestamptz | Default now() |

### 4.5 New table `qbp_revisions`
Snapshots of the QBP at meaningful events.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `snapshot_jsonb` | jsonb | Full QBP at moment of snapshot |
| `trigger_event` | text | One of: exercise_complete, foundation_locked, tier_upgraded, manual_save, backfill |
| `trigger_detail` | text | Optional context (e.g. exercise slug) |
| `created_at` | timestamptz | Default now() |

### 4.6 Row-level security
All new columns and tables enforce RLS scoped to `auth.uid()`. Read and write policies separately:
- `profiles`: user reads and writes own row only
- `artifacts`: user reads own rows. Writes only via service role (Edge functions and dispatch).
- `artifact_runs`: user reads own. Writes service role only.
- `qbp_revisions`: user reads own. Writes service role only.
- `tool_completions`: user reads and writes own.

### 4.7 Indexes
```sql
create index artifacts_user_phase_idx on artifacts (user_id, phase, created_at desc);
create index artifacts_user_status_idx on artifacts (user_id, status);
create index artifact_runs_artifact_idx on artifact_runs (artifact_id, created_at desc);
create index qbp_revisions_user_idx on qbp_revisions (user_id, created_at desc);
create index tool_completions_user_tool_idx on tool_completions (user_id, tool_slug);
```

### 4.8 Migration order
1. `001_profiles_tier_columns.sql` — Add tier, tier_started_at, qbp_jsonb to profiles
2. `002_artifacts_schema_extension.sql` — Add phase, agent_slug, status, version, parent_artifact_id, content_jsonb, failed_reason
3. `003_artifact_runs.sql` — Create table + RLS
4. `004_qbp_revisions.sql` — Create table + RLS
5. `005_tool_completions_unique.sql` — Add unique constraint and slot validation
6. `006_indexes.sql` — All indexes
7. `007_backfill.sql` — Backfill: set tier='free' for existing profiles, snapshot current qbp_jsonb into qbp_revisions with trigger_event='backfill'

Each migration is idempotent and includes a down migration.

---

## 5. API endpoints

All endpoints are Vercel Edge functions in `/api/`. All require JWT verification against Supabase. Service role key is server-side only and never exposed.

### 5.1 `POST /api/agents/dispatch` (existing, extend)
- Body: `{ agent_slug: string, payload?: object }`
- Adds support for: `sensescape_synthesizer`, `visual_dna_synthesizer`, `war_table_synthesizer`
- Continues supporting: `soul_map_synthesizer`
- Returns: `{ artifact_id, status }`
- Idempotency: if an artifact is already queued or generating for this user + agent_slug + version, return existing artifact_id without enqueuing again.

### 5.2 `POST /api/foundation/lock` (existing, verify)
- Body: `{}`
- Verifies all required Phase 01 exercises are complete (free: Archetype Compass, Soul Map, Sensescape; Starter+: also Visual DNA, War Table)
- Sets `profiles.foundation_locked_at`
- Snapshots QBP into `qbp_revisions` with `trigger_event = 'foundation_locked'`
- Enqueues artifacts based on tier:
  - Free: enqueues all 4 synthesizers but tier-locks reads on 3 of them
  - Starter+: enqueues all 4, all readable
- Returns: `{ locked_at, artifacts: [{id, agent_slug, status}] }`
- Idempotent: calling twice returns same response without duplicate enqueues.

### 5.3 `GET /api/qbp`
- Returns: `{ qbp: object, last_updated: timestamptz }`
- Read-only. No body.

### 5.4 `POST /api/qbp/export`
- Generates PDF of QBP
- Tier check: free returns 402 with `{ reason: 'export_gated', upgrade_url: '/paywall?reason=qbp_export' }`
- Starter+ returns `{ signed_url, expires_at }`
- PDF is generated server-side and stored in Supabase Storage with a 1-hour signed URL.

### 5.5 `GET /api/artifacts`
- Query params: `phase` (optional), `status` (optional), `limit` (default 50)
- Returns: `{ artifacts: [{id, title, phase, agent_slug, status, version, created_at, locked}] }`
- `locked` is computed per artifact based on tier.

### 5.6 `GET /api/artifacts/[id]`
- Returns full artifact including `content_jsonb`
- Tier check: if locked for this tier, returns 402 with `{ reason: 'artifact_locked', artifact_meta: {title, phase, agent_slug}, upgrade_url: '/paywall?reason=artifact&phase=01' }`
- 404 if artifact doesn't belong to user

### 5.7 `POST /api/artifacts/[id]/regenerate`
- Creates new artifact row with incremented version, `parent_artifact_id` set, status `queued`
- Tier check: free can only regenerate Soul Map. Starter+ any Phase 01 artifact.
- Returns: `{ new_artifact_id, version }`

### 5.8 `POST /api/stripe/checkout`
- Body: `{ price_id: string }`
- Only Starter price_id is wired in Chapter 1. Pro and Agency price_ids are env vars but return 501 if requested.
- Returns: `{ checkout_url }`

### 5.9 `POST /api/stripe/webhook` (existing, verify)
- Handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- On `completed`: updates `profiles.tier` and `profiles.tier_started_at`
- On `deleted` (downgrade): sets `profiles.tier = 'free'`. Existing artifacts remain readable (see edge case 10.3). Future generations gated.
- Idempotent via Stripe event ID dedup.

### 5.10 Tier-gating logic (canonical)
A user can read an artifact if:
- Artifact is `agent_slug = soul_map_synthesizer` (always free), OR
- User's `profiles.tier` is `'starter'`, `'pro'`, `'agency'`, or `'atelier'`

A user can export QBP if:
- User's tier is anything other than `'free'`

A user can regenerate an artifact if:
- User can read the artifact AND
- User's tier permits the relevant phase (Phase 01: free if Soul Map, Starter+ otherwise; Phase 02-05: Starter+; Phase 05 Predictive Panel and Quarterly Review: Pro+)

---

## 6. Agents to build

Three new synthesis agents. All follow the existing Soul Map Synthesizer pattern (one-off, not the Chapter 2 framework). All call Claude via the dispatch route, with `claude-sonnet-4-6`, `max_tokens` 4000, Edge runtime 25s budget.

Each agent reads from `profiles.qbp_jsonb`, produces an artifact conforming to the content schema in section 7, writes the artifact to `artifacts`, logs to `artifact_runs`, and triggers the artifact-ready email.

### 6.1 Sensescape Synthesizer
- **Agent slug:** `sensescape_synthesizer`
- **Reads QBP fields:** `sensoryProfile`, `colorDirection`, any sensescape-related fields populated by the Sensescape exercise
- **Produces artifact titled:** "The Sensory World of [Brand]"
- **Sections:**
  1. Opening — what the brand sounds, looks, feels, smells, tastes like in three paragraphs
  2. The Five Senses — one block per sense with sensory descriptors and source material from QBP
  3. Sensory Anti-Patterns — what the brand explicitly is not (sourced from antiBrand fields)
  4. Sensory Decisions Ahead — three concrete decisions the founder will face next
- **Data blocks:** sensory descriptor list, sound and texture references
- **Prompt approach:** Strict instruction to produce JSON conforming to schema. No prose outside the JSON. Validation before save.

### 6.2 Visual DNA Synthesizer
- **Agent slug:** `visual_dna_synthesizer`
- **Reads QBP fields:** `visualDNA`, `colorDirection`, `typographyDirection`, any visual references captured in Visual DNA exercise
- **Produces artifact titled:** "The Visual Language of [Brand]"
- **Sections:**
  1. Opening — the brand's visual posture in three paragraphs
  2. Color System — primary, secondary, accent, neutral, with rationale
  3. Typography — display and body recommendations with rationale
  4. Visual Anti-Patterns — what the brand will not look like
  5. Visual Decisions Ahead — three concrete next decisions
- **Data blocks:** palette swatches (hex codes), type pairing recommendations with sample text rendered

### 6.3 War Table Synthesizer
- **Agent slug:** `war_table_synthesizer`
- **Reads QBP fields:** `competitorLandscape`, `strategicPriorities`, `antiBrand`, `paradox`, `alwaysNever`
- **Produces artifact titled:** "The Strategic Position of [Brand]"
- **Sections:**
  1. Opening — the brand's strategic position in three paragraphs
  2. The Field — competitor landscape mapped on two axes
  3. The Paradox — the productive tension this brand holds
  4. Always / Never — list of binding commitments
  5. Three Strategic Priorities — ranked with rationale
- **Data blocks:** positioning map (two-axis with competitor placement), always/never list, priority ranking

### 6.4 Common agent behavior
- All three implement timeout handling: if Claude API exceeds 22 seconds, fail the run gracefully, mark artifact as failed, log to artifact_runs, send no email.
- All three validate JSON output against the content schema before saving. Schema validation failure marks artifact as failed.
- All three are retry-able via `/api/artifacts/[id]/regenerate`. Retry creates a new artifact row, never overwrites.

### 6.5 Soul Map Synthesizer (existing)
- No changes to the agent itself.
- Confirm output already conforms to the content schema in section 7. If it doesn't, refactor minimally so the editorial reading surface can render it without special casing.

---

## 7. Artifact content schema

Every artifact stores its content in `artifacts.content_jsonb` conforming to this schema. The Artifact reading surface renders any artifact that conforms. No artifact ships in raw HTML.

### 7.1 Schema (TypeScript-style for clarity, stored as JSON)

```typescript
{
  schema_version: "1.0",
  header: {
    eyebrow: string,           // e.g. "01 Discovery · Soul Axis"
    title: string,              // Fraunces headline, e.g. "The Soul of Atelier Verdant"
    subtitle?: string,
    agent: string,              // e.g. "Soul Map Synthesizer"
    generated_at: string,       // ISO timestamp
    version: number
  },
  body_sections: [
    {
      heading: string,
      prose: string,              // Markdown allowed: paragraphs, bold, italic. No headings inside prose.
      pull_quote?: string,
      illustration_slot?: string  // References inventory: 'blank-slate', 'doubter', etc. CSS-tinted at render.
    }
  ],
  data_blocks?: [
    {
      type: "palette" | "type_pairing" | "positioning_map" | "always_never" | "priority_list" | "descriptor_list",
      title: string,
      content: object             // Type-specific structure
    }
  ],
  footer: {
    qbp_fields_referenced: string[],
    related_artifacts?: { id: string, title: string }[]
  }
}
```

### 7.2 Data block types

**`palette`**
```json
{
  "type": "palette",
  "title": "The Color System",
  "content": {
    "swatches": [
      { "label": "Primary", "hex": "#2D1521", "rationale": "..." }
    ]
  }
}
```

**`type_pairing`**
```json
{
  "type": "type_pairing",
  "title": "Type Direction",
  "content": {
    "display": { "family": "Fraunces", "weight": "500", "rationale": "..." },
    "body": { "family": "Inter", "weight": "400", "rationale": "..." }
  }
}
```

**`positioning_map`**
```json
{
  "type": "positioning_map",
  "title": "The Field",
  "content": {
    "x_axis": { "low": "Mass", "high": "Bespoke" },
    "y_axis": { "low": "Quiet", "high": "Bold" },
    "placements": [
      { "label": "Competitor A", "x": 0.3, "y": 0.7, "is_self": false },
      { "label": "Atelier Verdant", "x": 0.85, "y": 0.4, "is_self": true }
    ]
  }
}
```

**`always_never`**
```json
{
  "type": "always_never",
  "title": "Binding Commitments",
  "content": {
    "always": ["...", "..."],
    "never": ["...", "..."]
  }
}
```

**`priority_list`**
```json
{
  "type": "priority_list",
  "title": "Strategic Priorities",
  "content": {
    "items": [
      { "rank": 1, "label": "...", "rationale": "..." }
    ]
  }
}
```

**`descriptor_list`**
```json
{
  "type": "descriptor_list",
  "title": "Sensory Descriptors",
  "content": {
    "groups": [
      { "label": "Sound", "items": ["...", "..."] }
    ]
  }
}
```

### 7.3 Reading surface rendering rules
- Header renders with eyebrow tag + Fraunces title + agent attribution mono caps.
- Body sections render in order. Prose is parsed as restricted Markdown (paragraphs, bold, italic only; no headings, no lists, no links unless explicitly added later).
- `illustration_slot` references the Part 6 inventory. If the file is not in inventory, the slot renders empty (no error, no broken image).
- Data blocks render via dedicated component per type. Unknown types are silently skipped.
- Footer shows source QBP fields and related artifacts.

### 7.4 Schema validation
- A validator function lives in `/lib/artifact-schema.js`.
- Agents must call validator before save. Validation failure marks artifact as failed.
- Reading surface also validates before render. Validation failure renders the failed state.

---

## 8. Paywall logic

### 8.1 Triggers
A free user encounters the paywall in exactly these places:
1. Clicking a locked artifact tile on `/foundation`
2. Clicking a locked artifact row on `/archive`
3. Navigating directly to `/artifact/[id]` for a locked artifact (server returns 402, client renders paywall)
4. Clicking "Export QBP" on `/qbp`
5. Clicking a locked Phase 02-05 card on `/foundation`
6. Clicking a locked exercise card (Visual DNA, War Table) on `/foundation`

### 8.2 Paywall content
- Eyebrow: "Locked"
- Headline: "Unlock the rest of your foundation."
- Body: one paragraph specifying what unlocks, named explicitly
- Price: "Starter, $97/month. Cancel anytime."
- Primary CTA: "Upgrade to Starter" → Stripe checkout
- Secondary: "Not now"

### 8.3 Conversion flow
1. User clicks "Upgrade to Starter" → POST `/api/stripe/checkout` with Starter price_id
2. Redirected to Stripe Checkout (hosted)
3. On success, Stripe redirects back to `/foundation?upgrade=success`
4. Webhook fires asynchronously, updates `profiles.tier = 'starter'`
5. `/foundation` polls `/api/qbp` for tier change for up to 30 seconds, shows "Confirming your upgrade..." banner
6. Once tier flips, banner switches to "You're on Starter. Visual DNA and War Table exercises are unlocked." Three previously locked artifacts now show as accessible.

### 8.4 The three pre-generated locked artifacts
On free tier foundation lock, the system enqueues all four synthesizers. Three return artifacts marked locked (Sensescape, Visual DNA, War Table). They sit in the database with `status = 'delivered'` and `content_jsonb` populated, but `locked = true` is computed at read time.

On upgrade, no re-generation happens. The artifacts are simply unlocked at read time by the tier check. The user feels instant gratification: "Three new artifacts are now readable."

### 8.5 Visual DNA and War Table exercises on free tier
These exercises are NOT completable on free tier. The exercise cards on `/foundation` show locked state with copy "Available with Starter."

Foundation lock for free users requires only Archetype Compass + Soul Map + Sensescape complete.

After upgrade, the user can complete Visual DNA and War Table at their own pace. Each completion updates the relevant QBP fields and snapshots a new revision. The corresponding synthesis artifact was already produced at foundation lock based on placeholder defaults if QBP fields were empty.

**Decision: regenerate or not?**
After Visual DNA exercise completion (post-upgrade), the Visual DNA artifact is auto-regenerated to reflect the new QBP data. Same for War Table. This is a system-triggered regenerate, not a user-clicked one, and does not count against any limit. The old artifact remains as version 1; the new one is version 2.

For Sensescape, the exercise was already completed pre-lock, so its synthesis artifact is final and not regenerated on upgrade.

---

## 9. Empty states and error states

### 9.1 `/foundation` cold start (zero exercises complete)
- Eyebrow: "Begin"
- Headline: "Your foundation starts with one question."
- Body: "Identity comes before tactics. Start with the Archetype Compass, or take the Signal Scan if you want a diagnostic first."
- Two CTAs: "Begin the Archetype Compass" (primary), "Take the Signal Scan" (secondary)
- Persona illustration: `blank-slate.png` (CSS-tinted)

### 9.2 `/foundation` foundation locked, artifacts generating
- Banner at top: "Your foundation is locked. Your artifacts are being prepared."
- Queue visible: each agent shows status pill (Queued, Generating, Delivered, Failed)
- No CTA. Page polls every 10 seconds for status changes.

### 9.3 `/foundation` post-lock, all artifacts delivered, free tier
- One unlocked artifact (Soul Map) with primary CTA "Read your Soul Map"
- Three locked artifact tiles with paywall trigger on click
- Upgrade CTA below: "Unlock the rest of your foundation for $97/month."

### 9.4 `/archive` zero artifacts
- Eyebrow: "Archive"
- Headline: "Your archive will fill as your foundation is built."
- No fake placeholder rows. No CTA (the action lives on `/foundation`).

### 9.5 `/artifact/[id]` locked (free tier)
- Header renders normally (eyebrow + title + agent attribution)
- Below header: frosted lock state with `<qb-paywall-modal>` content rendered inline
- No content_jsonb is exposed to the client at all. The server returns 402 with just header metadata.

### 9.6 `/artifact/[id]` failed
- Eyebrow + title visible
- Body: "This artifact didn't generate successfully. We've been notified."
- CTA: "Try regenerating" (if user has permission)
- Secondary: "Contact support" (mailto:me@qtmbg.com for Chapter 1)

### 9.7 `/qbp` empty
- Each `<qb-qbp-section>` renders its empty state independently with a link to the exercise that populates it.
- Document chrome (cover, table of contents) renders even when sections are empty.

### 9.8 `/account` no subscription
- Email shown
- Tier badge: Free
- CTA: "Upgrade to Starter"

### 9.9 Generic 500
- Single cream page with eyebrow "Something broke", headline "We're looking into it.", link to home.
- Error logged to console (Sentry in Chapter 10).

### 9.10 Generic 404
- Eyebrow "Lost", headline "This page does not exist.", link back to `/foundation`.

---

## 10. Edge cases

### 10.1 Non-linear exercise completion
A user can complete Phase 01 exercises in any order. Foundation lock checks completeness, not sequence. The Foundation page displays exercises in canonical order regardless of completion order.

### 10.2 Editing exercises after foundation lock
Disabled. The exercise card shows "Locked" with copy "Your foundation is locked. A future 'rebuild' flow will let you regenerate your QBP." The rebuild flow is deferred to a later chapter and is not promised on a timeline.

### 10.3 Downgrade from Starter to Free
Triggered by Stripe `customer.subscription.deleted` webhook.
- `profiles.tier` set to `'free'`
- All existing artifacts remain readable. Removing access feels punitive and the artifacts were already paid for during the active period.
- Future regeneration is gated.
- QBP export remains accessible for 30 days post-downgrade (grace period). After 30 days, gated.
- Visual DNA and War Table exercises remain visible and read-only. New exercise saves are blocked.

**Decision rationale:** Keep delivered value, gate future value. This avoids hostile-feeling downgrade UX while preserving Starter incentive.

### 10.4 Agent timeout (Edge function >25s)
- Artifact row marked `status = 'failed'`, `failed_reason = 'timeout'`
- artifact_runs row marked `status = 'failed'`, `error = 'edge_timeout'`
- No email sent
- User sees failed state on `/foundation` and `/archive` with regenerate CTA

### 10.5 Agent returns malformed JSON
- Validator catches before save
- Artifact marked failed with `failed_reason = 'schema_validation_failed'`
- Internal log captures the malformed output for debugging
- User sees same failed state as 10.4

### 10.6 Stripe webhook race condition
- Webhook handler is idempotent via Stripe event ID dedup table (`stripe_events` with unique constraint on event_id)
- If webhook fires after the success redirect has already polled and updated, no-op
- If webhook fires before redirect lands, tier is already correct on first poll

### 10.7 Two browser tabs racing foundation lock
- `lock-foundation` Edge function is idempotent on `profiles.foundation_locked_at` (null check)
- First request wins. Second request returns existing lock state.
- Second tab on reload sees locked state.

### 10.8 User signs up, completes Signal Scan, never starts Phase 01
- Account remains. No retention sequence in Chapter 1.
- No artificial expiry.
- Defer onboarding email sequence to Chapter 10.

### 10.9 QBP gets corrupted or partially saved
- `qbp_revisions` table is the recovery layer. Any user-facing render reads from `profiles.qbp_jsonb` but a manual recovery can restore from revisions.
- Chapter 1 ships without a UI for revision restore. Server-side recovery via direct database query is acceptable for now.

### 10.10 Agent dispatch called for an unknown agent_slug
- Returns 400 with `{ error: 'unknown_agent', agent_slug }`
- No artifact row created

### 10.11 Free tier user attempts QBP export via direct API call
- Server returns 402 regardless of how the call originated
- Tier check is server-authoritative, not client-trusted

### 10.12 Artifact regenerate hits API while previous version is still generating
- Returns 409 with `{ error: 'previous_run_in_flight', current_status: 'generating' }`
- Prevents queue pollution

---

## 11. Email (Resend)

### 11.1 Transactional emails in Chapter 1
1. **Magic link** (existing, no change)
2. **Foundation locked confirmation** (existing, verify deliverability)
3. **Artifact ready** (new template per agent or one generic template)

### 11.2 Artifact ready template
- Subject: "Your [artifact title] is ready"
- From: `auth@quantumbranding.ai`
- Reply-to: `me@qtmbg.com`
- Body: Plain text + minimal HTML. Headline, one-paragraph intro, single CTA button linking to `/artifact/[id]`, signature from Nizzar.
- Deliverability target: Primary inbox in Gmail. Test with three real Gmail accounts before chapter completion.

### 11.3 Locked artifact behavior
For the three locked artifacts on free tier, **emails are still sent** when generation completes. The email links to `/artifact/[id]`, which renders the locked state and surfaces the paywall. This is intentional: the user sees that real work has been done on their behalf, and the paywall arrives at peak emotional moment.

### 11.4 Email failure handling
Resend API errors are logged but do not block artifact delivery. If email fails, the artifact is still readable in-app. Surface "Email may not have been delivered" only if the user reports an issue (no proactive UX in Chapter 1).

---

## 12. Design system compliance

Every new surface ships locked to v3.2. No exceptions.

### 12.1 Token usage
All colors, spacings, type sizes pulled from `:root` CSS variables defined in a shared `qb-tokens.css`. Every new file imports this single source.

### 12.2 Structural patterns
- Cream + ink palette. No dark mode default in Chapter 1.
- Every section opens with `<div class="qb-tag">` eyebrow + Fraunces headline.
- All primary CTAs use the 3D two-layer pill button. Hover lift -0.35em, press +0.28em, cubic-bezier transition.
- All cards use hard offset shadow. No blur, no soft shadow anywhere.
- All type uses fluid clamp via `--step--2` through `--step-7`.
- All spacing uses `--space-3xs` through `--space-3xl`.

### 12.3 Mobile-first
Every surface designed at 360px first, then scaled up. Tap targets ≥44px. Modals become full-screen sheets below 640px.

### 12.4 Reduced motion
All animations respect `prefers-reduced-motion`. Pill button retains color change but drops translate transforms. Polling indicators use opacity rather than spin.

### 12.5 Illustrations
Foundation page uses persona-keyed illustrations from the Part 6 inventory:
- New user / blank state: `blank-slate.png`
- Reconstruction (doubter persona): `doubter.png`
- Speed (player persona): `player.png`
- Agency: `agency.png`

Each is rendered through CSS filter tinting to the v3.2 palette. Approach:
```css
.qb-illustration {
  filter:
    sepia(1) saturate(2) hue-rotate(330deg) brightness(0.95) contrast(1.05);
}
```
Exact filter values to be tuned per illustration during build. Fallback: if filter result is not acceptable, ship the surface without illustrations rather than ship with palette drift. No half-state.

### 12.6 No invented social proof
No fake testimonials, no fake usage stats, no fake client logos. Slots that need real social proof and don't have it ship empty.

---

## 13. Files to create

### 13.1 HTML pages (new)
- `foundation.html`
- `archive.html`
- `artifact.html` (dynamic, reads `?id=` param)
- `qbp.html`
- `paywall.html`
- `account.html`

### 13.2 CSS
- `qb-tokens.css` (consolidate v3.2 tokens from existing locked files into one source)
- `qb-components.css` (shared component styles)
- Per-page CSS embedded in each HTML file for page-specific styles

### 13.3 JavaScript (modules in `/js/`)
- `qb-auth.js` (existing, verify)
- `qb-api.js` (wraps all `/api/*` calls)
- `qb-components.js` (the custom elements / template fragments in section 3)
- `qb-artifact-renderer.js` (renders content_jsonb on the reading surface)
- `qb-artifact-schema.js` (validator function)
- `qb-paywall.js` (paywall modal logic and Stripe checkout trigger)
- `qb-qbp.js` (QBP rendering and section logic)

### 13.4 API endpoints (in `/api/`)
- `agents/dispatch.js` (existing, extend)
- `foundation/lock.js` (existing, verify)
- `qbp/index.js` (GET QBP)
- `qbp/export.js` (POST export)
- `artifacts/index.js` (GET list)
- `artifacts/[id].js` (GET single + tier check)
- `artifacts/[id]/regenerate.js` (POST regenerate)
- `stripe/checkout.js` (existing, verify Starter price)
- `stripe/webhook.js` (existing, verify tier updates)

### 13.5 Database migrations
- `supabase/migrations/001_profiles_tier_columns.sql`
- `supabase/migrations/002_artifacts_schema_extension.sql`
- `supabase/migrations/003_artifact_runs.sql`
- `supabase/migrations/004_qbp_revisions.sql`
- `supabase/migrations/005_tool_completions_unique.sql`
- `supabase/migrations/006_indexes.sql`
- `supabase/migrations/007_backfill.sql`

### 13.6 Agent prompt files (in `/agents/`)
- `agents/sensescape_synthesizer.js` (system prompt + dispatch logic)
- `agents/visual_dna_synthesizer.js`
- `agents/war_table_synthesizer.js`
- (Soul Map Synthesizer exists; verify and minimally refactor if needed for schema compliance)

### 13.7 Email templates (in `/emails/`)
- `emails/artifact-ready.html`
- `emails/foundation-locked.html` (existing, verify)

---

## 14. Build sequence

Each step is a discrete piece of work that can be done in a session and verified before the next begins.

1. **Database migrations** — write and apply all seven migrations. Verify RLS policies. Backfill existing data.
2. **Artifact content schema** — implement `qb-artifact-schema.js` validator. Write tests against sample artifacts.
3. **Refactor Soul Map Synthesizer** — confirm or update output to conform to schema. Test with real generation.
4. **Build Sensescape Synthesizer** — implement agent, prompt, dispatch integration. Test with real QBP data.
5. **Build Visual DNA Synthesizer** — same pattern.
6. **Build War Table Synthesizer** — same pattern.
7. **API endpoints** — implement all new endpoints. Test tier-gating logic with curl using free and Starter test accounts.
8. **Shared CSS and components** — extract tokens, build component library.
9. **Artifact reading surface** — `/artifact/[id]` rendering content_jsonb. Test with all four synthesis artifacts.
10. **QBP rendering surface** — `/qbp` rendering live document.
11. **Brand Archive** — `/archive` listing artifacts with filters.
12. **Foundation page** — `/foundation` with phase cards, exercise cards, lock CTA, paywall triggers.
13. **Paywall surface** — `/paywall` and `<qb-paywall-modal>` component.
14. **Account page** — `/account` minimal version.
15. **Email templates** — artifact-ready template. Deliverability test.
16. **Stripe end-to-end** — full upgrade flow with real test card.
17. **Deprecation** — remove dashboard.html, qb-branidos-hub.html, journey-guide.html from routing. Add redirects.
18. **QA pass** — mobile and desktop, all happy paths and key edge cases.
19. **Production deploy** — push to main, verify Vercel deploy, verify quantumbranding.ai routing.

---

## 15. Acceptance criteria (definition of done)

Chapter 1 is done when all of the following are true.

Status as of step 16 (2026-05-15) is recorded inline. End-to-end QA (step 17) and Nizzar sign-off (step 18) are the remaining gates.

### 15.1 Free tier journey
| Criterion | Status |
| --- | --- |
| New user signs up via magic link from `/signal-scan` or `/` | PENDING — STEP 17 |
| Lands on `/foundation` | PASS (route shipped step 12) |
| Completes Archetype Compass (existing tool; rebuild if not at quality bar) | PENDING — STEP 17 |
| Completes Brand Soul Map | PENDING — STEP 17 |
| Completes Sensescape | PENDING — STEP 17 |
| Cannot start Visual DNA or War Table (locked state visible) | PASS (gallery + foundation render verified step 12) |
| Clicks Lock Foundation, confirms in modal | PASS (renderer + `POST /api/foundation/lock` verified step 6 + 12) |
| Receives email: "Your Soul Map artifact is ready" | PASS (deliverability verified step 14 against 1 account; see 15.5 caveat) |
| Clicks email link, lands on `/artifact/[id]` | PASS (link wired step 14; reading surface step 9) |
| Reads full Soul Map artifact rendered through editorial surface | PASS (step 9) |
| Returns to `/foundation`, sees three locked artifact tiles | PASS (locked-delivered-free bucket step 12) |
| Clicks a locked tile, sees paywall modal | PASS (createPaywallModal step 8; tile click triggers it step 12) |
| Clicks "Upgrade to Starter", completes Stripe test checkout | PASS (verified step 15 end-to-end; ~6s tier-flip latency) |
| Returns to `/foundation`, sees Visual DNA and War Table exercises now open | PASS (locked-delivered-starter bucket step 12 + 15) |
| Sees three previously locked artifacts now readable | PASS (step 15 verified all four `GET /api/artifacts/<id>` HTTP 200) |
| Reads all three on `/artifact/[id]` | PASS (step 15 API; step 9 render) |
| Completes Visual DNA exercise; artifact auto-regenerates to v2 | PENDING — STEP 17 (`POST /api/artifacts/[id]/regenerate` shipped step 7) |
| Completes War Table exercise; artifact auto-regenerates to v2 | PENDING — STEP 17 |
| Exports QBP successfully | PASS WITH DEVIATION (JSON ships step 7; PDF deferred to Chapter 10) |

### 15.2 Surfaces
| Criterion | Status |
| --- | --- |
| `/foundation` renders correctly on mobile (360px) and desktop (1440px) | PASS (gallery verified step 12) |
| `/archive` renders correctly across viewports | PASS (step 11) |
| `/artifact/[id]` renders all four synthesis artifacts correctly | PASS (step 9) |
| `/qbp` renders the live document with all sections | PASS (step 10) |
| `/paywall` and modal both render correctly | PASS (paywall step 13; modal step 8) |
| `/account` shows email, tier, and sign out | PASS (step 13) |

### 15.3 Bug elimination
| Criterion | Status |
| --- | --- |
| Empty state never shows alongside actual content (bug 11A killed by component 3.7) | PASS (qb-empty + qb-foundation-* components step 12) |
| "View profile" wording no longer exists (page no longer exists) | PASS (`/dashboard` retired step 12, files archived step 16) |
| Locked Phase cards show explicit lock reason and upgrade CTA (bug 11C fixed) | PASS (createPhaseCard + paywall trigger step 12 + 13) |
| Artifact never expands inline; always navigates to `/artifact/[id]` (bug 11D fixed) | PASS (archive + foundation tiles both navigate, never expand step 11 + 12) |

### 15.4 Design system
| Criterion | Status |
| --- | --- |
| All new surfaces use only v3.2 tokens from `qb-tokens.css` | PASS (gallery cross-grep verified steps 8-13) |
| No hardcoded colors or spacings outside the `:root` block | PASS |
| Hard offset shadows everywhere, no blur | PASS |
| Fraunces + Inter + JetBrains Mono stack consistent | PASS (single canonical Google Fonts URL across new surfaces) |
| Mobile-first responsive verified | PASS (galleries verified at 360/640/1024px) |
| Reduced-motion respected verified | PASS (each gallery has a Reduced-motion toggle; @media query set) |

### 15.5 Infrastructure
| Criterion | Status |
| --- | --- |
| All seven migrations applied to production Supabase | PASS (steps 1-2 + 009 added step 7) |
| RLS verified on every new table and column | PASS (steps 1-2) |
| All API endpoints tier-gate correctly | PASS (verified step 15 end-to-end against starter↔free tier flip) |
| Stripe webhook tested end-to-end with real test card | PASS (step 15) |
| Resend artifact-ready email lands in Gmail Primary tab (verified across 3 test accounts) | PASS WITH DEVIATION (1 account verified; gap acknowledged in step 14 §5.3, retest during step 17 or Chapter 10) |
| Three new agents producing artifacts that pass schema validation | PASS (Sensescape step 5; Visual DNA step 5; War Table step 6) |
| Edge function timeout handling tested (artificially induce timeout, verify failed state) | PASS (step 6 War Table edge_timeout artifact_runs.error captured) |
| Idempotency tested on foundation lock and Stripe webhook | PASS (lock step 6; webhook step 15 manual signed replay) |

### 15.6 Deprecations
| Criterion | Status |
| --- | --- |
| dashboard.html removed from routing, redirects to /foundation | PASS (step 12 route, step 16 file archived) |
| qb-branidos-hub.html removed from routing, redirects to /foundation | PASS |
| journey-guide.html removed from routing, no redirect (410 Gone) | PASS |
| No external links in marketing pages point to the deprecated routes | PASS (audit step 16; only `vercel.json` redirect rules + archived files reference them) |

### 15.7 Sign-off
Nizzar walks through the free tier journey on his own, hits the paywall, upgrades with a real card, and confirms the experience meets the quality bar. Only then is Chapter 1 closed. STATUS: PENDING — STEP 18.

---

## 16. Known debt entering Chapter 2

### From the original spec
- The three new agents are one-off implementations following the Soul Map Synthesizer pattern. Chapter 2 refactors all four (plus all future agents) onto a shared agent framework.
- No agent run history UI. Data exists in `artifact_runs` table but is not surfaced. Chapter 2 adds the Agent Console.
- No file upload UI. Required for Phase 02 logo evaluation. Chapter 3 builds the asset layer.
- The Profiles exercise is in the data schema but not built. Deferred.
- No retention email sequence post-signup. Deferred to Chapter 10.
- No error monitoring (Sentry). Console logs only. Chapter 10.
- No legal pages (terms, privacy, refund). Required before public launch. Chapter 10.
- Atelier tier exists in the enum but no Atelier-specific surface. Chapter 9.
- Pro and Agency tiers exist in the enum but Stripe price IDs are placeholders. Chapter 10 wires them.
- Illustration CSS tinting may produce mediocre results. If so, surfaces ship without illustrations. SVG conversion deferred indefinitely.

### Added across Chapter 1 build (steps 1-15)
- **PDF rendering for QBP export** (step 7). `/api/qbp/export` ships JSON. PDF generation is a Chapter 10 task.
- **Foundation `?upgrade=success` session-restore** (step 15 surprise §10.4). If localStorage is stale when Stripe redirects back, foundation bounces to signal-scan. Real onboarding-conversion risk. Escalate during step 17 if a real user hits this.
- **Stripe customer reuse on re-subscribe** (step 15 surprise §10.5). Currently Checkout mints a fresh customer object on every re-subscribe; ours tracks the new ID correctly but Stripe-side reporting hygiene suffers.
- **Three-Gmail-account deliverability verification** (step 14 §5.3). Step 14 tested against one Gmail account. Gap to close during step 17 with real signup volume or in Chapter 10 hardening.
- **Customer portal link** (Chapter 10). Users currently reach out via `me@qtmbg.com` to cancel.
- **Grace period on downgrade** (step 15 §7.2; spec deviation from §10.3). Chapter 1 ships immediate re-lock on `customer.subscription.deleted`. Spec 10.3 grace period explicitly deferred to Chapter 10.
- **Vercel preview deployment-protection bypass** (step 15 §10.2). Stripe webhook tests cannot use preview URLs because they 401. Wire a Vercel bypass token before Chapter 10 staging tests.
- **SVG positioning_map label wrapping** (step 6). Long competitor names overflow the SVG bounds at narrow viewports.
- **Auto-include illustrations in agent outputs** (step 9). The artifact schema supports `illustration_slot` but no agent currently emits one.
- **Pro and Agency tier wiring** (step 13). `/api/stripe/checkout` correctly returns 501 `tier_not_yet_available`. Chapter 10 turns them on.

---

## 17. Notes for Cod sessions

- Always read this spec end-to-end before starting work. Do not skim.
- When in doubt, return to the chapter goal (section 0). Anything that doesn't serve that goal is out of scope.
- Code is vanilla HTML/CSS/JS. No frameworks. No build steps. No transpilation.
- Every file is self-contained except for shared CSS (`qb-tokens.css`, `qb-components.css`) and shared JS modules in `/js/`.
- Test on real data, not mocks, wherever possible.
- Push to main after every meaningful commit. Verify Vercel deploy succeeds.
- If a structural question arises that this spec doesn't answer, surface it before deciding. Do not invent.

---

## End of Chapter 1 specification.
## Locked. Build against this document.
