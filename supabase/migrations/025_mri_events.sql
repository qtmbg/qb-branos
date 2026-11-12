-- 025_mri_events.sql
-- Brand MRI · the funnel ledger.
--
-- One row per event, from the first page view to the review order. Before
-- this table a completed diagnostic was one email in an inbox: the ten
-- answers were stored nowhere, nothing counted visits or abandoned starts,
-- and a sale could not be tied back to the diagnostic it paid for.
--
--   view          the page opened                      (api/mri-event.js)
--   start         the visitor began the ten questions  (api/mri-event.js)
--   pay_click     a Stripe button was pressed          (api/mri-event.js)
--   completed     the diagnostic was finished          (api/mri-lead.js)
--   paid          Stripe confirmed a payment           (api/stripe-webhook.js, api/mri-verify.js)
--   review_order  a review buyer sent their questions  (api/mri-lead.js)
--
-- The code treats this table as optional. Every writer and reader in
-- api/_lib/mri.js reports "table_missing" and carries on, so a deploy that
-- reaches production before this migration loses the ledger and nothing
-- else: leads are still emailed, payments are still verified with Stripe.
--
-- Read by api/cron/mri-digest.js, which emails the daily numbers.

create table if not exists public.mri_events (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  event              text not null
                     check (event in ('view', 'start', 'pay_click', 'completed', 'paid', 'review_order')),
  -- Random id minted in the browser and kept in localStorage. It is passed
  -- to Stripe as client_reference_id, which is how a payment finds the
  -- diagnostic it belongs to.
  visitor_id         text,
  lang               text,
  tier               text,
  email              text,
  brand              text,
  website            text,
  score              integer,
  brake              text,
  utm_source         text,
  utm_medium         text,
  utm_campaign       text,
  utm_content        text,
  referrer           text,
  focus              text,
  stripe_session_id  text,
  amount_total       integer,
  -- completed: { answers[10], phrase, target, prev_score }
  -- paid:      { source: 'webhook' | 'return', link_tier }
  -- pay_click: { target }
  -- review_order: { questions, session }
  data               jsonb not null default '{}'::jsonb
);

create index if not exists mri_events_created_at
  on public.mri_events (created_at desc);

create index if not exists mri_events_event_created
  on public.mri_events (event, created_at desc);

create index if not exists mri_events_visitor
  on public.mri_events (visitor_id, created_at desc);

create index if not exists mri_events_email
  on public.mri_events (email, created_at desc);

-- Idempotency. A sale is recorded by the webhook and again by the page the
-- buyer returns to, and Stripe retries webhooks. One paid row per session:
-- the second writer receives 409 and treats it as done.
create unique index if not exists mri_events_paid_session_unique
  on public.mri_events (stripe_session_id)
  where event = 'paid';

alter table public.mri_events enable row level security;

-- No policy at all, for anon or for authenticated users. The table holds
-- emails and payment facts. Every read and write goes through the service
-- role inside api/, which bypasses RLS. Same reasoning as 024.
