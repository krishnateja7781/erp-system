-- ============================================================================
-- Migration 003: Classroom Notes
-- Teachers can upload documents (PDF, Word, Excel, PPT) with descriptions.
-- Students can view and download the attached documents.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "classroom_notes" (
    "id"            TEXT PRIMARY KEY,
    "classroomId"   TEXT NOT NULL REFERENCES "classrooms"("id") ON DELETE CASCADE,
    "teacherId"     TEXT NOT NULL,
    "teacherName"   TEXT NOT NULL,
    "description"   TEXT DEFAULT '',
    "fileName"      TEXT NOT NULL,
    "fileUrl"       TEXT NOT NULL,
    "fileType"      TEXT NOT NULL,
    "fileSize"      BIGINT DEFAULT 0,
    "createdAt"     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_classroom_notes_room"
    ON "classroom_notes" ("classroomId", "createdAt" DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- Row-Level Security  — open policies (matches schema.sql pattern)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "classroom_notes" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'classroom_notes' AND policyname = 'Allow all for classroom_notes'
    ) THEN
        EXECUTE format(
            'CREATE POLICY "Allow all for classroom_notes" ON "classroom_notes" FOR ALL USING (true) WITH CHECK (true)'
        );
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- Supabase Storage bucket for notes
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('notes', 'notes', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read and authenticated upload for the notes bucket
CREATE POLICY "Public read notes" ON storage.objects
  FOR SELECT USING (bucket_id = 'notes');

CREATE POLICY "Allow upload notes" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'notes');

CREATE POLICY "Allow delete notes" ON storage.objects
  FOR DELETE USING (bucket_id = 'notes');
