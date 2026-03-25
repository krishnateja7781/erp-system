-- Create classrooms table in Supabase
-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

CREATE TABLE IF NOT EXISTS public.classrooms (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  section         TEXT DEFAULT '',
  subject         TEXT DEFAULT '',
  "ownerId"       TEXT NOT NULL,
  "ownerName"     TEXT NOT NULL,
  "memberUids"    JSONB DEFAULT '[]'::jsonb,
  theme           TEXT DEFAULT 'theme-0',
  "inviteCode"    TEXT UNIQUE NOT NULL,
  "googleCourseId" TEXT,
  messages        JSONB DEFAULT '{}'::jsonb,
  "createdAt"     TIMESTAMPTZ DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

-- Open policy matching app convention (app uses anon key)
DROP POLICY IF EXISTS "Allow all operations for anon" ON public.classrooms;
CREATE POLICY "Allow all operations for anon"
  ON public.classrooms FOR ALL
  USING (true)
  WITH CHECK (true);
