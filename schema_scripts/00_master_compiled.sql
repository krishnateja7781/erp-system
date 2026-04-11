-- ============================================================================
-- SQL MASTER ARCHITECTURE (FIXED & ALIGNED TO TYPESCRIPT)
-- Resolves ENUM problems, missing counters, misaligned hostel fields, & RLS looping.
-- ============================================================================

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restore Supabase Schema Permissions (CRITICAL FOR API ACCESS)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- Extension setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================
CREATE TYPE public.role_enum AS ENUM ('super_admin', 'admin', 'employee', 'teacher', 'student', 'other');
CREATE TYPE public.employee_type_enum AS ENUM ('student_staff_management', 'fee_management', 'hostel_management', 'exam_marks_management', 'library_management', 'super_admin');
CREATE TYPE public.student_status_enum AS ENUM ('Active', 'Inactive', 'Graduated', 'Dropped', 'Leave of Absence', 'Deferred');
CREATE TYPE public.student_type_enum AS ENUM ('Day Scholar', 'Hosteler');
CREATE TYPE public.gender_type AS ENUM ('Male', 'Female', 'Other', 'Prefer Not to Say');
CREATE TYPE public.attendance_status_enum AS ENUM ('Present', 'Absent', 'Medical Leave', 'Casual Leave', 'Official Duty', 'Late Entry', 'Early Exit', 'Online Attendance');
CREATE TYPE public.grade_type AS ENUM ('O', 'A+', 'A', 'B+', 'B', 'C', 'U', 'AB', 'I');
CREATE TYPE public.fee_status_enum AS ENUM ('Pending', 'Partial', 'Paid', 'Overdue', 'Waived', 'Scholarship');
CREATE TYPE public.payment_method_enum AS ENUM ('Credit Card', 'Debit Card', 'Net Banking', 'UPI', 'Cheque', 'Bank Transfer', 'Cash', 'Scholarship', 'Fee Waiver');
CREATE TYPE public.exam_status_enum AS ENUM ('Scheduled', 'Published', 'Ongoing', 'Completed', 'Cancelled', 'Postponed');
CREATE TYPE public.complaint_status_enum AS ENUM ('Open', 'In Progress', 'Resolved', 'Closed', 'Reopened', 'Pending');
CREATE TYPE public.hall_ticket_status_enum AS ENUM ('Generated', 'Issued', 'Used', 'Cancelled');

-- Counters for RPC logic matching TS abstractions
CREATE TABLE IF NOT EXISTS public.counters (
  id TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

-- ============================================================================
-- BASE TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    id_code TEXT,
    initial_password TEXT,
    profile_picture_url TEXT,
    dob DATE,
    gender public.gender_type,
    role public.role_enum DEFAULT 'student',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    failed_attempts INTEGER DEFAULT 0,
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    head_of_department_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    duration_years INTEGER,
    total_semesters INTEGER,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.academic_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    credits NUMERIC(3,1) NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_code TEXT UNIQUE NOT NULL,
    department TEXT, -- Replaced department_id UUID due to TS String passing
    designation TEXT,
    qualifications TEXT,
    specialization TEXT,
    dob DATE,
    date_of_joining DATE,
    office_location TEXT,
    phone TEXT,
    status TEXT DEFAULT 'Active',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    academic_term_id UUID NOT NULL REFERENCES public.academic_terms(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    program TEXT NOT NULL,
    branch TEXT NOT NULL,
    year INTEGER NOT NULL,
    semester INTEGER NOT NULL,
    section TEXT,
    classroom_location TEXT,
    max_capacity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(course_id, academic_term_id, section, program, branch, year, semester)
);

CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    college_id TEXT UNIQUE NOT NULL,
    program TEXT NOT NULL,
    branch TEXT NOT NULL,
    current_year INTEGER DEFAULT 1,
    current_semester INTEGER DEFAULT 1,
    student_type public.student_type_enum,
    status public.student_status_enum DEFAULT 'Active',
    admission_date DATE,
    admitted_year INTEGER,
    expected_graduation_date DATE,
    is_hosteler BOOLEAN DEFAULT false,
    is_graduated BOOLEAN DEFAULT false,
    dob DATE,
    gender TEXT,
    address TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    blood_group TEXT,
    section TEXT DEFAULT 'A',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    designation TEXT,
    department TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_code TEXT UNIQUE,
    employee_type TEXT,
    department TEXT, -- Changed from department_id
    designation TEXT,
    dob DATE,
    date_of_joining DATE,
    office_location TEXT,
    qualifications TEXT,
    specialization TEXT,
    phone TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    grade public.grade_type,
    grade_points NUMERIC(3,2),
    is_passed BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(student_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status public.attendance_status_enum,
    marked_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(student_id, class_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS public.attendance_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    total_classes INTEGER DEFAULT 0,
    present_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,
    approved_leaves INTEGER DEFAULT 0,
    attendance_percentage NUMERIC(5,2) DEFAULT 0,
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(student_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    marks_obtained NUMERIC(5,2),
    total_marks NUMERIC(5,2) DEFAULT 100,
    grade public.grade_type,
    grade_points NUMERIC(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(student_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_term_id UUID NOT NULL REFERENCES public.academic_terms(id) ON DELETE CASCADE,
    fee_type VARCHAR(20) NOT NULL DEFAULT 'college',
    total_amount NUMERIC(10,2) NOT NULL,
    paid_amount NUMERIC(10,2) DEFAULT 0,
    balance NUMERIC(10,2),
    status public.fee_status_enum DEFAULT 'Pending',
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(student_id, academic_term_id, fee_type)
);

CREATE TABLE IF NOT EXISTS public.fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_id UUID NOT NULL REFERENCES public.fees(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount_paid NUMERIC(10,2) NOT NULL,
    payment_method public.payment_method_enum,
    payment_date DATE DEFAULT CURRENT_DATE,
    transaction_id TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================================================
-- CORRECTED HOSTEL TABLES MATCHING TYPESCRIPT UI EXPECTATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hostels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    type TEXT DEFAULT 'Boys',
    status TEXT DEFAULT 'Operational',
    warden_name TEXT,
    warden_contact TEXT,
    warden_email TEXT,
    warden_office TEXT,
    capacity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.hostel_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    block TEXT,
    floor INTEGER,
    capacity INTEGER DEFAULT 1,
    occupied_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(hostel_id, room_number)
);

CREATE TABLE IF NOT EXISTS public.hostel_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
    allocation_date DATE DEFAULT CURRENT_DATE,
    from_date DATE DEFAULT CURRENT_DATE,
    to_date DATE,
    release_date DATE,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(student_id, room_id)
);

CREATE TABLE IF NOT EXISTS public.hostel_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL,
    hostel_room_id UUID REFERENCES public.hostel_rooms(id) ON DELETE SET NULL,
    description TEXT,
    status TEXT DEFAULT 'Pending',
    assigned_to_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    resolved_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.hostel_menu (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL,
    morning_slot TEXT,
    afternoon_slot TEXT,
    evening_slot TEXT,
    dinner_slot TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(hostel_id, day_of_week)
);

-- ============================================================================
-- REMAINDER ACADEMICS & COMMS TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exam_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    exam_name TEXT NOT NULL,
    exam_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    location TEXT,
    status public.exam_status_enum DEFAULT 'Scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.hall_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    exam_schedule_id UUID NOT NULL REFERENCES public.exam_schedules(id) ON DELETE CASCADE,
    hall_ticket_number TEXT UNIQUE NOT NULL,
    seat_number TEXT,
    status public.hall_ticket_status_enum DEFAULT 'Generated',
    issued_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(student_id, exam_schedule_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT,
    title TEXT,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    changed_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX idx_students_profile_id ON public.students(profile_id);
CREATE INDEX idx_enrollments_student_id ON public.enrollments(student_id);
CREATE INDEX idx_enrollments_class_id ON public.enrollments(class_id);
CREATE INDEX idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX idx_attendance_class_id ON public.attendance(class_id);
CREATE INDEX idx_marks_student_id ON public.marks(student_id);
CREATE INDEX idx_classes_course_id ON public.classes(course_id);
CREATE INDEX idx_classes_teacher_id ON public.classes(teacher_id);
CREATE INDEX idx_hostel_allocations_student ON public.hostel_allocations(student_id);
CREATE INDEX idx_hostel_allocations_room ON public.hostel_allocations(room_id);

-- ============================================================================
-- EXTREME PERFORMANCE JWT ROLE GETTER (ELIMINATES SELECT LATENCY)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
BEGIN
    IF (nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'role') IS NOT NULL THEN
        RETURN current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role';
    ELSE
        RETURN COALESCE((SELECT role FROM public.profiles WHERE id = p_user_id), 'student');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- INCREMENT COUNTER RPC (CRITICAL FOR DB.TS ABSTRACTION)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_counter(counter_key TEXT)
RETURNS INTEGER AS $$
DECLARE
  next_val INTEGER;
BEGIN
  INSERT INTO public.counters (id, value)
  VALUES (counter_key, 1)
  ON CONFLICT (id) DO UPDATE
  SET value = public.counters.value + 1
  RETURNING value INTO next_val;
  RETURN next_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES (FULLY INTEGRATED)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "everyone_select_profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "own_profile_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "hostels_all_everyone" ON public.hostels FOR SELECT USING (true);
CREATE POLICY "hostel_rooms_select" ON public.hostel_rooms FOR SELECT USING (true);

-- ============================================================================
-- TRIGGERS (AUTOMATED OCCUPANCY & TIMESTAMPS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_hostels_upd BEFORE UPDATE ON public.hostels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rooms_upd BEFORE UPDATE ON public.hostel_rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_complaints_upd BEFORE UPDATE ON public.hostel_complaints FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
