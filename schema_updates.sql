-- ============================================================================
-- ERP SCHEMA UPDATE: COURSES & EXAMS & MARKS
-- Execute this script in your Supabase SQL Editor
-- ============================================================================

-- 1. ADD MISSING COLUMNS TO COURSES
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS program TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS semester INTEGER;

-- Backfill 'name' using 'title' where possible
UPDATE public.courses SET name = title WHERE name IS NULL;

-- 2. CREATE EXAMS TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    program TEXT,
    branch TEXT,
    academic_year TEXT,
    year INTEGER,
    semester INTEGER,
    exam_type TEXT NOT NULL,
    exam_date DATE,
    start_time TIME,
    end_time TIME,
    max_internal_marks NUMERIC(5,2),
    max_external_marks NUMERIC(5,2),
    status TEXT DEFAULT 'Scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. CREATE EXAM_MARKS TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.exam_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    marks_obtained NUMERIC(5,2),
    status TEXT DEFAULT 'Present',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(exam_id, student_id)
);

-- 4. ENABLE RLS (Open for Service Role, secure for others)
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exams_select_all" ON public.exams;
CREATE POLICY "exams_select_all" ON public.exams FOR SELECT USING (true);

DROP POLICY IF EXISTS "exam_marks_select_all" ON public.exam_marks;
CREATE POLICY "exam_marks_select_all" ON public.exam_marks FOR SELECT USING (true);

-- 5. ADD MISSING COLUMNS TO CLASSES
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS academic_year TEXT;
UPDATE public.classes SET academic_year = year::TEXT WHERE academic_year IS NULL;

-- 6. CREATE TIMETABLES TABLE
CREATE TABLE IF NOT EXISTS public.timetables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "timetables_select_all" ON public.timetables;
CREATE POLICY "timetables_select_all" ON public.timetables FOR ALL USING (true);

-- 7. FIX ATTENDANCE TABLE SCHEMA
DO $$ 
BEGIN
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='attendance' and column_name='attendance_date') THEN
      ALTER TABLE public.attendance RENAME COLUMN attendance_date TO date;
    END IF;
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='attendance' and column_name='marked_by_id') THEN
      ALTER TABLE public.attendance RENAME COLUMN marked_by_id TO teacher_id;
    END IF;
END $$;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS period INTEGER;

-- Drop constraints that might interfere or recreate them safely if needed.
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_class_id_attendance_date_key;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_class_id_date_key;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_id_class_id_date_period_key UNIQUE (student_id, class_id, date, period);

-- Make period default to 1 if null for backward compatibility
UPDATE public.attendance SET period = 1 WHERE period IS NULL;

-- 8. NOTIFY POSTGREST TO RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

-- Fix marks table ID auto-generation and constraints
DO $$
BEGIN
    ALTER TABLE IF EXISTS marks ALTER COLUMN id SET DEFAULT gen_random_uuid();
EXCEPTION
    WHEN OTHERS THEN RAISE NOTICE 'Marks ID alter failed: %', SQLERRM;
END $$;

DO $$
BEGIN
    ALTER TABLE IF EXISTS marks DROP CONSTRAINT IF EXISTS marks_student_id_class_id_key;
    ALTER TABLE IF EXISTS marks ADD CONSTRAINT marks_student_id_class_id_key UNIQUE(student_id, class_id);
EXCEPTION
    WHEN OTHERS THEN RAISE NOTICE 'Marks constraint alter failed: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
-- Add grading columns to marks table gracefully
DO $$
BEGIN
    ALTER TABLE marks ADD COLUMN IF NOT EXISTS ia1 numeric;
    ALTER TABLE marks ADD COLUMN IF NOT EXISTS ia2 numeric;
    ALTER TABLE marks ADD COLUMN IF NOT EXISTS other numeric;
    ALTER TABLE marks ADD COLUMN IF NOT EXISTS see numeric;
    ALTER TABLE marks ADD COLUMN IF NOT EXISTS total numeric;
EXCEPTION
    WHEN OTHERS THEN RAISE NOTICE 'Marks columns already exist or altering Failed: %', SQLERRM;
END $$;
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- CLASSROOMS SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.classrooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    section TEXT DEFAULT '',
    subject TEXT DEFAULT '',
    owner_id TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    member_uids TEXT[] DEFAULT '{}',
    theme TEXT DEFAULT 'theme-0',
    invite_code TEXT UNIQUE NOT NULL,
    google_course_id TEXT,
    messages JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.classroom_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_role TEXT DEFAULT 'teacher',
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.classroom_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    max_marks NUMERIC(5,2) DEFAULT 100,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.classroom_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.classroom_assignments(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    content TEXT,
    attachments JSONB DEFAULT '[]',
    marks_obtained NUMERIC(5,2),
    status TEXT DEFAULT 'Submitted',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(assignment_id, student_id)
);

-- Enable RLS (open policies for all roles)
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "classrooms_all" ON public.classrooms;
CREATE POLICY "classrooms_all" ON public.classrooms FOR ALL USING (true);
DROP POLICY IF EXISTS "classroom_posts_all" ON public.classroom_posts;
CREATE POLICY "classroom_posts_all" ON public.classroom_posts FOR ALL USING (true);
DROP POLICY IF EXISTS "classroom_assignments_all" ON public.classroom_assignments;
CREATE POLICY "classroom_assignments_all" ON public.classroom_assignments FOR ALL USING (true);
DROP POLICY IF EXISTS "classroom_submissions_all" ON public.classroom_submissions;
CREATE POLICY "classroom_submissions_all" ON public.classroom_submissions FOR ALL USING (true);

NOTIFY pgrst, 'reload schema';
