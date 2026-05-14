-- 007_backfill.sql
-- Chapter 1 / Build step 1
-- Backfill existing data per spec section 4.8 step 7.
--   - Ensure all profiles have tier set (defensive; default already 'free').
--   - Set tier_started_at on profiles with non-free tier and no started_at.
--   - Migrate artifacts.status vocabulary: 'producing' → 'generating',
--     'ready' → 'delivered'. Other values left intact.
--   - Snapshot every profile's qbp into qbp_revisions with
--     trigger_event = 'backfill'. Idempotent: skipped if a backfill row
--     with the same trigger_detail already exists for that user.

update public.profiles
set tier = 'free'
where tier is null;

update public.profiles
set tier_started_at = coalesce(updated_at, created_at, now())
where tier <> 'free' and tier_started_at is null;

update public.artifacts set status = 'generating' where status = 'producing';
update public.artifacts set status = 'delivered'  where status = 'ready';

insert into public.qbp_revisions (user_id, snapshot_jsonb, trigger_event, trigger_detail)
select
  p.id,
  coalesce(p.qbp, '{}'::jsonb),
  'backfill',
  'initial_chapter_1_backfill'
from public.profiles p
where not exists (
  select 1 from public.qbp_revisions r
  where r.user_id = p.id
    and r.trigger_event = 'backfill'
    and r.trigger_detail = 'initial_chapter_1_backfill'
);

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- delete from public.qbp_revisions where trigger_detail = 'initial_chapter_1_backfill';
-- update public.profiles set tier_started_at = null where tier_started_at is not null;
-- -- Status vocabulary migration is not safely reversible without recording
-- -- the original value; treat the new vocabulary as canonical.
-- ───────────────────────────────────────────────────────────────────────────
