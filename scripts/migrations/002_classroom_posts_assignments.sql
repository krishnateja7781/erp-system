-- ============================================================================
-- Migration 002: Classroom Posts, Assignments & Submissions
-- Adds in-ERP messaging and classwork (independent of Google Classroom API)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- classroom_posts  — Stream / message board for a classroom
-- Both teachers and students can post messages visible to all members.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "classroom_posts" (
    "id"            TEXT PRIMARY KEY,
    "classroomId"   TEXT NOT NULL REFERENCES "classrooms"("id") ON DELETE CASCADE,
    "authorId"      TEXT NOT NULL,
    "authorName"    TEXT NOT NULL,
    "authorRole"    TEXT NOT NULL CHECK ("authorRole" IN ('teacher', 'student', 'admin')),
    "content"       TEXT NOT NULL,
    "createdAt"     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_classroom_posts_room"
    ON "classroom_posts" ("classroomId", "createdAt" DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- classroom_assignments  — Assignments created by teachers
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "classroom_assignments" (
    "id"            TEXT PRIMARY KEY,
    "classroomId"   TEXT NOT NULL REFERENCES "classrooms"("id") ON DELETE CASCADE,
    "teacherId"     TEXT NOT NULL,
    "teacherName"   TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "description"   TEXT DEFAULT '',
    "dueDate"       TEXT,                              -- ISO date string
    "maxPoints"     INTEGER DEFAULT 100,
    "createdAt"     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_classroom_assignments_room"
    ON "classroom_assignments" ("classroomId", "createdAt" DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- classroom_submissions  — Student submissions for assignments
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "classroom_submissions" (
    "id"              TEXT PRIMARY KEY,
    "assignmentId"    TEXT NOT NULL REFERENCES "classroom_assignments"("id") ON DELETE CASCADE,
    "classroomId"     TEXT NOT NULL REFERENCES "classrooms"("id") ON DELETE CASCADE,
    "studentId"       TEXT NOT NULL,
    "studentName"     TEXT NOT NULL,
    "content"         TEXT DEFAULT '',                  -- text answer or notes
    "fileName"        TEXT,                              -- original file name
    "fileUrl"         TEXT,                              -- Supabase Storage public URL
    "submittedAt"     TIMESTAMPTZ DEFAULT NOW(),
    "grade"           INTEGER,
    "gradedAt"        TIMESTAMPTZ,
    UNIQUE ("assignmentId", "studentId")               -- one submission per student per assignment
);

CREATE INDEX IF NOT EXISTS "idx_classroom_submissions_assignment"
    ON "classroom_submissions" ("assignmentId");

CREATE INDEX IF NOT EXISTS "idx_classroom_submissions_student"
    ON "classroom_submissions" ("studentId");

-- ────────────────────────────────────────────────────────────────────────────
-- Row-Level Security  — open policies (matches schema.sql pattern)
-- The app uses anon key; auth is handled at the application layer.
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
-- Supabase Storage: submissions bucket + RLS policies
-- Allows the anon key to upload, read, update, and delete files.
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', true)
ON CONFLICT (id) DO NOTHING;

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
