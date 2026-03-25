-- ============================================================================
-- Quick Fix: Patch classroom tables + Storage policies
-- Run this in Supabase SQL Editor to fix all issues at once.
-- Safe to re-run (uses IF NOT EXISTS / DO $$ blocks everywhere).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Add missing columns to classroom_submissions (if table was created
--    from an older migration that didn't include them)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "classroom_submissions" ADD COLUMN IF NOT EXISTS "fileName" TEXT;
ALTER TABLE "classroom_submissions" ADD COLUMN IF NOT EXISTS "fileUrl"  TEXT;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. RLS + open policies for the 3 classroom tables
--    (matches the pattern used in schema.sql for all other tables)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "classroom_posts"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classroom_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classroom_submissions" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'classroom_posts', 'classroom_assignments', 'classroom_submissions'
        ])
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS "Allow all for anon" ON public.%I', t
        );
        EXECUTE format(
            'CREATE POLICY "Allow all for anon" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t
        );
    END LOOP;
END
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Supabase Storage: create submissions bucket + RLS policies
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'submissions_allow_upload' AND tablename = 'objects') THEN
        CREATE POLICY "submissions_allow_upload"
            ON storage.objects FOR INSERT
            TO anon, authenticated
            WITH CHECK (bucket_id = 'submissions');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'submissions_allow_read' AND tablename = 'objects') THEN
        CREATE POLICY "submissions_allow_read"
            ON storage.objects FOR SELECT
            TO anon, authenticated
            USING (bucket_id = 'submissions');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'submissions_allow_update' AND tablename = 'objects') THEN
        CREATE POLICY "submissions_allow_update"
            ON storage.objects FOR UPDATE
            TO anon, authenticated
            USING (bucket_id = 'submissions');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'submissions_allow_delete' AND tablename = 'objects') THEN
        CREATE POLICY "submissions_allow_delete"
            ON storage.objects FOR DELETE
            TO anon, authenticated
            USING (bucket_id = 'submissions');
    END IF;
END
$$;
