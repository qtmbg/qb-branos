# Klaviyo Flow Setup — QB BrandOS Funnel v1

Paste-ready spec for setting up the email automation that compounds the funnel. Three behavioral flows, one re-engagement segment, six profile properties, three event metrics. Should take ~30 minutes in the Klaviyo dashboard once you have your public key.

> **Prerequisite:** Klaviyo account with a list created. You'll need:
> - Public API key (looks like `XYZ123` — Klaviyo dashboard → Account → Settings → API Keys)
> - List ID for the QB BrandOS subscriber list (Lists & Segments → click your list → URL has `/list/{LIST_ID}`)

---

## 0. Wire the keys into the site

After you have the public key + list ID, two ways to inject them. Either works:

**Option A — script tag in any page that needs it (preferred for prod):**

```html
<script>
  window.QB_KLAVIYO_KEY = 'YOUR_PUBLIC_KEY';
  window.QB_KLAVIYO_LIST_ID = 'YOUR_LIST_ID';
</script>
```

Add this above the `<script src="/qb-cloud.js">` tag in each Phase 01 tool. Easiest place to inject globally: `qb-cloud.js` itself — drop the two `window.QB_KLAVIYO_*` lines at the top.

**Option B — localStorage (good for testing / per-user):**

```js
localStorage.setItem('qb_klaviyo_pk', 'YOUR_PUBLIC_KEY');
localStorage.setItem('qb_klaviyo_list', 'YOUR_LIST_ID');
```

If neither is set, every Klaviyo function in `qb-cloud.js` silently no-ops. Nothing breaks.

---

## 1. Profile Properties

These get set automatically by `qb-cloud.js` → `syncKlaviyoProfile()` when a user clicks the magic link. You don't have to create them manually — Klaviyo accepts unknown properties on first event. But it helps to define them in the dashboard so they show up in segment editors.

| Property name | Type | Notes |
|---|---|---|
| `email` | string | Auto |
| `first_name` | string | Auto |
| `signup_source` | string | Which tool fired the gate: `soul-map`, `sensescape`, `visual-dna`, `war-table`, `profiles`, `hub-login` |
| `brand_name` | string | From QBP if available at signup time |
| `archetype` | string | Primary + secondary archetype string from Compass/Soul Map |
| `tools_completed_at_signup` | number | How many Phase 01 tools they had completed locally before saving |
| `signup_date` | string (date) | YYYY-MM-DD |

---

## 2. Event Metrics

Three custom events fired by `qb-cloud.js`. Klaviyo creates them automatically the first time each fires.

| Event name | When | Properties on the event |
|---|---|---|
| `Brand Profile Saved` | After magic-link click + session created (in `auth-callback.html`) | `source_tool`, `tools_completed` |
| `Tool Completed` | After every Phase 01 synthesis (gate or skip both) | `tool_id`, `tool_name` |
| `Phase 01 Complete` | When all six Phase 01 tools done — fires exactly once on the transition | `total_time_days` |

After each event has fired at least once, you'll see them in **Analytics → Metrics**. They take 5–10 min to register first time.

---

## 3. Flow 1 — WELCOME (3 emails)

**Trigger:** `Brand Profile Saved`
**Filter:** none — every save kicks this off
**Suppression:** anyone who triggers `Phase 01 Complete` is removed from this flow mid-sequence. Anyone who clicks ANY link in any email also exits the flow (so they don't keep getting nudged).

### Email 1 — sent immediately after the trigger

**Subject:** `{{ first_name|default:"" }}, your Brand Profile is live`
*(Klaviyo's `default` filter handles users without a first name)*

**Preview text:** `What you just built and what compounds next.`

**From:** Nizzar Ben Chekroune `<nizzar@quantumbranding.ai>`

**Body (HTML — paste into Klaviyo's HTML editor, not the visual editor):**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0a0a0a">
  <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;color:#4ade80;margin-bottom:24px">QUANTUM BRANDING</div>
  <h1 style="font-size:22px;font-weight:600;line-height:1.3;margin:0 0 18px">Hi {{ first_name|default:"there" }},</h1>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">Your Brand Profile is saved. The next time you open any QB tool, your profile is already there. No re-entering anything.</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">Here's why this matters:</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">The six Phase 01 tools — Archetype Compass, Brand Soul Map, Sensescape, Visual DNA, The War Table, The Profiles — each surface a different layer of your brand. Trinity. Identity. Senses. Visual language. Strategic priorities. Buyer personas. Run alone, each gives you a useful artifact. Run together, they compound into something most founders never reach: a brand profile that's actually operational.</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 28px">The fastest move from here is the next tool you haven't run yet.</p>
  <a href="https://app.quantumbranding.ai/journey-guide.html" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:14px;font-weight:500">See what compounds next →</a>
  <p style="font-size:13px;line-height:1.55;color:#888;margin:32px 0 8px;font-style:italic">Takes 15–30 minutes. Builds directly on what you just did.</p>
  <p style="font-size:13px;line-height:1.55;color:#888;margin:0">— Nizzar<br>Quantum Branding</p>
</div>
```

### Email 2 — sent 24 hours later

**Filter (within the flow):** *only send if* the count of `Tool Completed` events in the past 24 hours equals zero. (Klaviyo: in flow filter add "Has not done — Tool Completed in the last 1 day".)

**Subject:** `The thing about running just one Phase 01 tool`

**Preview:** `Why founders who stop at one almost always wish they hadn't.`

**Body:**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0a0a0a">
  <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;color:#4ade80;margin-bottom:24px">QUANTUM BRANDING</div>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">{{ first_name|default:"Hi" }},</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">Most founders who run one Phase 01 tool stop there. They got an artifact. Felt useful. Moved on.</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">The ones who run two compound. Identity meets senses. Visual meets strategy. The brand profile starts to do something the individual outputs can't: it starts to have a perspective on itself.</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 28px">The second tool takes about as long as the first. But the output is twice as valuable because it builds on what you already did.</p>
  <a href="https://app.quantumbranding.ai/journey-guide.html" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:14px;font-weight:500">Run the next one →</a>
  <p style="font-size:13px;line-height:1.55;color:#888;margin:32px 0 0">— Nizzar</p>
</div>
```

### Email 3 — sent 72 hours after Email 1

**Filter:** *only send if* the count of `Tool Completed` events in the past 72 hours equals zero AND `Phase 01 Complete` has not been triggered.

**Subject:** `What you're missing by stopping at one`

**Preview:** `90 minutes for a profile that pays you back forever.`

**Body:**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0a0a0a">
  <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;color:#4ade80;margin-bottom:24px">QUANTUM BRANDING</div>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">{{ first_name|default:"Hi" }},</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">I'll be direct.</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">Your Brand Profile right now is one slice. Useful. Incomplete. And the value of every Phase 02+ tool — voice, logo direction, content, all of it — depends on the depth of the profile underneath.</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">If you ran all six Phase 01 tools, you'd have:</p>
  <ul style="font-size:15px;line-height:1.7;color:#222;margin:0 0 16px;padding-left:20px">
    <li>An Archetype Trinity (your primary, secondary, tension)</li>
    <li>A Soul Map (your identity)</li>
    <li>A Sensescape (the world you operate in)</li>
    <li>A Visual DNA (your aesthetic language)</li>
    <li>A War Table (what to actually do this quarter)</li>
    <li>Three Profiles (NOW, NEXT, NORTH STAR personas)</li>
  </ul>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">Together: about 90 minutes of focused work. After that, every other tool in the system reads from this and writes back to it. Nothing has to be re-explained.</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 28px">If 90 minutes isn't on the table, even the next 20 will move you forward.</p>
  <a href="https://app.quantumbranding.ai/journey-guide.html" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:14px;font-weight:500">Continue your Brand Profile →</a>
  <p style="font-size:13px;line-height:1.55;color:#888;margin:32px 0 8px">— Nizzar</p>
  <p style="font-size:12px;line-height:1.55;color:#aaa;margin:0;font-style:italic">P.S. If this isn't the right time, you can pick this up whenever. Your profile stays. We don't expire it.</p>
</div>
```

---

## 4. Flow 2 — PHASE 01 COMPLETE

**Trigger:** `Phase 01 Complete`
**Filter:** none
**Suppression:** anyone on a paid tier (`tier` profile property is `starter`, `pro`, `agency`) is excluded — they've already converted.

### Single email — sent immediately

**Subject:** `{{ first_name|default:"" }}, your Brand Profile is operational`

**Preview:** `Phase 02 is where the agents start working for you.`

**Body:**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0a0a0a">
  <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;color:#4ade80;margin-bottom:24px">QUANTUM BRANDING</div>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">{{ first_name|default:"Hi" }},</p>
  <p style="font-size:18px;line-height:1.5;color:#0a0a0a;margin:0 0 18px;font-weight:500">You finished Phase 01. Most people don't.</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">You now have a Brand Profile that reads its own identity, senses, visuals, and strategy. The next phases — Brand Creation, Content, Execution, Intelligence — are 18+ agents that work on top of this profile, not in spite of it. They read what you built. They write back to it. They don't ask you to repeat yourself.</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">This is where the system starts paying you back for the time you put in.</p>
  <p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 6px;font-weight:600">What unlocks next:</p>
  <ul style="font-size:14px;line-height:1.7;color:#444;margin:0 0 22px;padding-left:20px">
    <li>Logo Direction Agent (builds your logo brief from your Soul Map + Visual DNA)</li>
    <li>Voice Guide Agent (drafts copy in your voice, indefinitely)</li>
    <li>Instagram, LinkedIn, YouTube, Newsletter strategists</li>
    <li>Content Repurposing Engine</li>
    <li>Content Scheduler</li>
    <li>Brand Performance Dashboard</li>
  </ul>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 28px"><strong>Starter is $97/mo. Annual is $80/mo (two months free).</strong> 14-day money-back, no questions.</p>
  <a href="https://quantumbranding.ai/#pricing" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:14px;font-weight:500">See what unlocks →</a>
  <p style="font-size:13px;line-height:1.55;color:#888;margin:32px 0 0">— Nizzar</p>
</div>
```

---

## 5. Flow 3 — RE-ENGAGEMENT (segment-triggered)

**Trigger:** Klaviyo segment **"Inactive 14d, Phase 01 incomplete"**

**Segment definition (paste into segment builder):**

> Person is in list `[QB BrandOS list]`
> AND has `Brand Profile Saved` at least once over all time
> AND last `Tool Completed` more than 14 days ago (or never)
> AND `Phase 01 Complete` zero times over all time
> AND has not received this email in the last 30 days

**Suppression:** anyone who clicks any link in this email is excluded for the next 14 days.

### Single email

**Subject:** `Your Brand Profile is still here`

**Preview:** `Two weeks. Your profile waits.`

**Body:**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0a0a0a">
  <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;color:#4ade80;margin-bottom:24px">QUANTUM BRANDING</div>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">{{ first_name|default:"Hi" }},</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">Two weeks since you ran {{ signup_source|capfirst|default:"a Phase 01 tool" }}. Your profile is still saved. Nothing's been deleted. Nothing expires.</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 16px">If life got busy, that's fine. If you have 20 minutes this week, the highest-leverage move is the next tool you haven't run.</p>
  <p style="font-size:15px;line-height:1.6;color:#222;margin:0 0 28px">If you've moved on, no offense taken — unsubscribe link is at the bottom of this email.</p>
  <a href="https://app.quantumbranding.ai/journey-guide.html" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:14px;font-weight:500">Continue your Brand Profile →</a>
  <p style="font-size:13px;line-height:1.55;color:#888;margin:32px 0 0">— Nizzar</p>
</div>
```

---

## 6. Suppression matrix (apply across flows)

| Behavior | Effect |
|---|---|
| Clicked any link in any email | Excluded from Flow 3 for 14 days |
| Triggered `Phase 01 Complete` | Removed from Flow 1 mid-sequence (skip remaining emails) |
| Upgraded to paid tier (`tier` ≠ `free`) | Removed from all funnel flows; eligible for onboarding flow only |
| Marked email as spam | Hard suppress (Klaviyo handles automatically) |
| Unsubscribed | Hard suppress (Klaviyo handles automatically) |

---

## 7. Test sequence

After everything is configured:

1. From an incognito browser, complete `brand-soul-map.html` end-to-end. Submit the gate with a test email you can check.
2. Within ~2 minutes, you should receive Email 1 of Flow 1.
3. **In Klaviyo dashboard**:
   - Go to **Profiles → search your test email**. Confirm `first_name`, `signup_source = soul-map`, `brand_name` are all populated.
   - Go to **Analytics → Metrics**. Confirm `Brand Profile Saved` and `Tool Completed` show one event each.
4. Wait 24h, do not run another tool. Email 2 should arrive.
5. From a different incognito, complete all four Phase 01 tools rapidly with the same email (use the magic-link login each time). After the fourth completes, `Phase 01 Complete` should fire and Flow 2 should send within ~2 minutes.

If any of those don't work, check:
- `window.QB_KLAVIYO_KEY` is set (browser console: `localStorage.qb_klaviyo_pk` or `window.QB_KLAVIYO_KEY`)
- The Klaviyo API key has the **public** prefix, not private
- The list ID is correct
- CSP allows `https://a.klaviyo.com` in `connect-src` (already done in `vercel.json`)

---

## 8. Future emails not in this v1

These need 30+ days of funnel data before designing:

- **Day 30 from signup, no upgrade** — "Pricing tour" email with social proof
- **Single-tool stuck** — drilling deep on the specific bottleneck (e.g., "you ran Soul Map but stopped — here's why Sensescape pairs with it")
- **Free → Starter conversion offer** — limited-time first-month-free if conversion rate is too low
- **Quarterly Brand Review reminder** — for Pro tier, reminding them their quarterly is due
- **Annual upgrade nudge** — for monthly subscribers approaching month 4 ("save 17%")

Don't write these until you have the numbers to justify them.
