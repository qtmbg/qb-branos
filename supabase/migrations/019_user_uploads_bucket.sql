-- migration 019: user-uploads storage bucket + RLS policies
-- Per chapter-03/step-3-spec.md §1 (Bucket + RLS architecture).
--
-- Creates the user-uploads bucket and four RLS policies on storage.objects
-- that enforce per-user ownership via auth.uid() matching the first path
-- segment.
--
-- Idempotent at every step:
--   - storage.buckets: INSERT ... ON CONFLICT DO UPDATE
--   - storage.objects policies: DROP POLICY IF EXISTS + CREATE POLICY
--
-- Hard fence: bucket file_size_limit (25 MB · flat across all tiers per
-- Call 5 sharpened adjudication). Single constant. PL-003 later raises
-- per tier from this baseline.

BEGIN;

-- ─── 1. Bucket creation ─────────────────────────────────────────────────
-- private bucket · 25 MB cap · 5 allowed MIME types (image baseline + PDF)
-- ON CONFLICT updates the limits if they drift, so re-running the migration
-- re-asserts the canonical config.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-uploads',
  'user-uploads',
  false,
  26214400,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/webp',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── 2. RLS policies on storage.objects ─────────────────────────────────
-- Four policies enforce: an authenticated user can only operate on objects
-- whose path's first folder segment equals their auth.uid(). Path layout:
--   user-uploads/{user_id}/{file_id}.{ext}
--
-- Idempotent via DROP IF EXISTS + CREATE (PostgreSQL does not support
-- CREATE POLICY IF NOT EXISTS even in v17).
--
-- Service role bypasses RLS by design; the sign-url Edge function in 3C
-- uses service role only AFTER independently verifying JWT ownership.

DROP POLICY IF EXISTS "user_uploads_select_own" ON storage.objects;
CREATE POLICY "user_uploads_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "user_uploads_insert_own" ON storage.objects;
CREATE POLICY "user_uploads_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "user_uploads_update_own" ON storage.objects;
CREATE POLICY "user_uploads_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'user-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "user_uploads_delete_own" ON storage.objects;
CREATE POLICY "user_uploads_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

COMMIT;
