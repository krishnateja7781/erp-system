-- FRESH BUILD ERP SCHEMA
-- WARNING: This will drop existing tables and data!
DROP FUNCTION IF EXISTS promote_student(uuid, uuid, text);

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS resumes CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS placement_applications CASCADE;
DROP TABLE IF EXISTS placements CASCADE;
DROP TABLE IF EXISTS complaints CASCADE;
DROP TABLE IF EXISTS hostel_allocations CASCADE;
DROP TABLE IF EXISTS hostel_rooms CASCADE;
DROP TABLE IF EXISTS semester_snapshots CASCADE;
DROP TABLE IF EXISTS promotion_logs CASCADE;
DROP TABLE IF EXISTS hall_ticket_rules CASCADE;
DROP TABLE IF EXISTS exam_schedule CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS fees CASCADE;
DROP TABLE IF EXISTS marks CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS timetable CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 4.1 — profiles
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('super_admin','admin','employee','teacher','student')),
  full_name   text,
  email       text UNIQUE,
  phone       text,
  avatar_url  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 4.2 — students
CREATE TABLE students (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid REFERENCES profiles(id) ON DELETE CASCADE,
  college_id        text UNIQUE NOT NULL,
  program           text NOT NULL,
  branch            text NOT NULL,
  current_semester  int NOT NULL DEFAULT 1 CHECK (current_semester BETWEEN 1 AND 8),
  current_year      int NOT NULL DEFAULT 1 CHECK (current_year BETWEEN 1 AND 4),
  is_hosteler       boolean DEFAULT false,
  is_graduated      boolean DEFAULT false,
  dob               date,
  admitted_year     int,
  created_at        timestamptz DEFAULT now()
);

-- 4.3 — teachers
CREATE TABLE teachers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  employee_code text UNIQUE NOT NULL,
  department    text,
  designation   text,
  created_at    timestamptz DEFAULT now()
);

-- 4.4 — employees
CREATE TABLE employees (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  employee_code text UNIQUE NOT NULL,
  employee_type text NOT NULL CHECK (employee_type IN (
    'fee_management',
    'hostel_management',
    'student_staff_management',
    'exam_marks_management',
    'library_management'
  )),
  department    text,
  created_at    timestamptz DEFAULT now()
);

-- 4.5 — courses
CREATE TABLE courses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  program     text,
  branch      text,
  semester    int CHECK (semester BETWEEN 1 AND 8),
  credits     int DEFAULT 3,
  created_at  timestamptz DEFAULT now()
);

-- 4.6 — classes
CREATE TABLE classes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     uuid REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id    uuid REFERENCES teachers(id),
  section       text,
  academic_year text,
  semester      int,
  created_at    timestamptz DEFAULT now()
);

-- 4.7 — timetable
CREATE TABLE timetable (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id  uuid REFERENCES classes(id) ON DELETE CASCADE,
  day       text NOT NULL CHECK (day IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  period    int NOT NULL CHECK (period BETWEEN 1 AND 8),
  room      text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_id, day, period)
);

-- 4.8 — attendance
CREATE TABLE attendance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid REFERENCES students(id) ON DELETE CASCADE,
  class_id    uuid REFERENCES classes(id),
  date        date NOT NULL,
  period      int,
  status      text NOT NULL CHECK (status IN ('present','absent','late')),
  marked_by   uuid REFERENCES teachers(id),
  created_at  timestamptz DEFAULT now()
);

-- 4.9 — marks
CREATE TABLE marks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid REFERENCES students(id) ON DELETE CASCADE,
  course_id       uuid REFERENCES courses(id),
  semester        int,
  exam_type       text NOT NULL CHECK (exam_type IN ('IA1','IA2','SEE')),
  marks_obtained  numeric,
  max_marks       numeric,
  grade           text CHECK (grade IN ('O','A+','A','B+','B','C+','C','P','F')),
  grade_points    numeric,
  entered_by      uuid REFERENCES teachers(id),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id, semester, exam_type)
);

-- 4.10 — fees
CREATE TABLE fees (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid REFERENCES students(id) ON DELETE CASCADE,
  semester      int NOT NULL CHECK (semester IN (1,3,5,7)),
  academic_year text,
  base_amount   numeric NOT NULL DEFAULT 150000,
  hostel_amount numeric NOT NULL DEFAULT 0,
  total_amount  numeric NOT NULL,
  paid_amount   numeric NOT NULL DEFAULT 0,
  balance       numeric GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','paid')),
  generated_at  timestamptz DEFAULT now()
);

-- 4.11 — transactions
CREATE TABLE transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_id          uuid REFERENCES fees(id),
  student_id      uuid REFERENCES students(id),
  amount          numeric NOT NULL,
  payment_mode    text CHECK (payment_mode IN ('online','offline')),
  transaction_ref text,
  status          text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_by    uuid REFERENCES profiles(id),
  approved_by     uuid REFERENCES profiles(id),
  transaction_id  text UNIQUE,
  created_at      timestamptz DEFAULT now()
);

-- 4.12 — exam_schedule
CREATE TABLE exam_schedule (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid REFERENCES courses(id),
  semester    int,
  program     text,
  branch      text,
  exam_date   date,
  start_time  time,
  end_time    time,
  room        text,
  created_at  timestamptz DEFAULT now()
);

-- 4.13 — hall_ticket_rules
CREATE TABLE hall_ticket_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester            int UNIQUE,
  min_attendance_pct  numeric DEFAULT 75,
  min_fees_paid_pct   numeric DEFAULT 50,
  set_by              uuid REFERENCES profiles(id),
  created_at          timestamptz DEFAULT now()
);

-- 4.14 — promotion_logs
CREATE TABLE promotion_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid REFERENCES students(id) ON DELETE CASCADE,
  from_semester int NOT NULL,
  to_semester   int,
  from_year     int NOT NULL,
  to_year       int,
  promoted_by   uuid REFERENCES profiles(id),
  promoted_at   timestamptz DEFAULT now(),
  notes         text
);

-- 4.15 — semester_snapshots
CREATE TABLE semester_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid REFERENCES students(id) ON DELETE CASCADE,
  semester        int NOT NULL,
  academic_year   text,
  attendance_pct  numeric,
  cgpa            numeric,
  fee_status      text,
  fee_paid_amount numeric,
  snapshot_data   jsonb,
  promoted_at     timestamptz DEFAULT now(),
  UNIQUE(student_id, semester)
);

-- 4.16 — hostel_rooms
CREATE TABLE hostel_rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number text UNIQUE NOT NULL,
  block       text,
  floor       int,
  capacity    int DEFAULT 2,
  occupied    int DEFAULT 0,
  warden_id   uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

-- 4.17 — hostel_allocations
CREATE TABLE hostel_allocations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid REFERENCES students(id) ON DELETE CASCADE,
  room_id     uuid REFERENCES hostel_rooms(id),
  from_date   date,
  to_date     date,
  is_active   boolean DEFAULT true
);

-- 4.18 — complaints
CREATE TABLE complaints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid REFERENCES students(id) ON DELETE CASCADE,
  room_id     uuid REFERENCES hostel_rooms(id),
  title       text NOT NULL,
  description text,
  status      text DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  resolved_by uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

-- 4.19 — placements
CREATE TABLE placements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name      text NOT NULL,
  role_title        text NOT NULL,
  description       text,
  package_lpa       numeric,
  deadline          date,
  eligible_branches text[],
  eligible_years    int[],
  posted_by         uuid REFERENCES profiles(id),
  created_at        timestamptz DEFAULT now()
);

-- 4.20 — placement_applications
CREATE TABLE placement_applications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid REFERENCES placements(id) ON DELETE CASCADE,
  student_id   uuid REFERENCES students(id) ON DELETE CASCADE,
  status       text DEFAULT 'applied' CHECK (status IN ('applied','shortlisted','selected','rejected')),
  applied_at   timestamptz DEFAULT now(),
  UNIQUE(placement_id, student_id)
);

-- 4.21 — books
CREATE TABLE books (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn             text UNIQUE,
  title            text NOT NULL,
  author           text,
  category         text,
  description      text,
  cover_url        text,
  publisher        text,
  published_year   int,
  total_copies     int DEFAULT 1,
  available_copies int DEFAULT 1,
  digital_url      text,
  source           text DEFAULT 'physical' CHECK (source IN ('physical','digital','both')),
  added_by         uuid REFERENCES profiles(id),
  created_at       timestamptz DEFAULT now()
);

-- 4.22 — resumes
CREATE TABLE resumes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid REFERENCES students(id) ON DELETE CASCADE UNIQUE,
  data        jsonb,
  pdf_url     text,
  updated_at  timestamptz DEFAULT now()
);

-- 4.23 — notifications
CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  message     text,
  type        text CHECK (type IN ('attendance','fee','promotion','exam','general')),
  is_read     boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- RPC for Promotion Algorithm
CREATE OR REPLACE FUNCTION promote_student(
  p_student_id    uuid,
  p_promoted_by   uuid,
  p_academic_year text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student        students%ROWTYPE;
  v_new_semester   int;
  v_new_year       int;
  v_attend_pct     numeric;
  v_cgpa           numeric;
  v_fee_status     text;
  v_fee_paid       numeric;
  v_marks_json     jsonb;
  v_incomplete     text[];
BEGIN
  -- Lock student row (prevent concurrent promotions)
  SELECT * INTO v_student FROM students WHERE id = p_student_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'student_not_found');
  END IF;

  IF v_student.is_graduated THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_graduated');
  END IF;

  -- PRE-CHECK: All marks complete (IA1 + IA2 + SEE for every course)
  SELECT array_agg(c.name) INTO v_incomplete
  FROM classes cl
  JOIN courses c ON c.id = cl.course_id
  WHERE cl.semester = v_student.current_semester
    AND cl.id IN (
      SELECT DISTINCT class_id FROM attendance WHERE student_id = p_student_id
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM marks m WHERE m.student_id = p_student_id
          AND m.course_id = cl.course_id AND m.exam_type = 'IA1'
          AND m.semester = v_student.current_semester
      ) OR
      NOT EXISTS (
        SELECT 1 FROM marks m WHERE m.student_id = p_student_id
          AND m.course_id = cl.course_id AND m.exam_type = 'IA2'
          AND m.semester = v_student.current_semester
      ) OR
      NOT EXISTS (
        SELECT 1 FROM marks m WHERE m.student_id = p_student_id
          AND m.course_id = cl.course_id AND m.exam_type = 'SEE'
          AND m.semester = v_student.current_semester
      )
    );

  IF array_length(v_incomplete, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'incomplete_marks',
      'courses', v_incomplete
    );
  END IF;

  -- STEP 1: Freeze semester snapshot
  SELECT COALESCE(
    COUNT(*) FILTER (WHERE status = 'present')::numeric
    / NULLIF(COUNT(*), 0) * 100, 0
  ) INTO v_attend_pct
  FROM attendance
  WHERE student_id = p_student_id
    AND class_id IN (
      SELECT id FROM classes WHERE semester = v_student.current_semester
    );

  SELECT COALESCE(
    SUM(m.grade_points * c.credits) / NULLIF(SUM(c.credits), 0), 0
  ) INTO v_cgpa
  FROM marks m
  JOIN courses c ON c.id = m.course_id
  WHERE m.student_id = p_student_id
    AND m.semester = v_student.current_semester
    AND m.exam_type = 'SEE';

  SELECT status, paid_amount INTO v_fee_status, v_fee_paid
  FROM fees
  WHERE student_id = p_student_id
    AND semester = (
      CASE WHEN v_student.current_semester % 2 = 0
        THEN v_student.current_semester - 1
        ELSE v_student.current_semester
      END
    )
  ORDER BY generated_at DESC LIMIT 1;

  SELECT jsonb_agg(row_to_json(m)) INTO v_marks_json
  FROM marks m
  WHERE m.student_id = p_student_id
    AND m.semester = v_student.current_semester;

  INSERT INTO semester_snapshots
    (student_id, semester, academic_year, attendance_pct, cgpa,
     fee_status, fee_paid_amount, snapshot_data)
  VALUES
    (p_student_id, v_student.current_semester, p_academic_year,
     v_attend_pct, v_cgpa, v_fee_status, v_fee_paid, v_marks_json);

  -- STEP 2: Increment semester or graduate
  IF v_student.current_semester >= 8 THEN
    UPDATE students SET is_graduated = true WHERE id = p_student_id;
    v_new_semester := 8;
    v_new_year := 4;
  ELSE
    v_new_semester := v_student.current_semester + 1;
    v_new_year := CEIL(v_new_semester::numeric / 2);
    UPDATE students
    SET current_semester = v_new_semester, current_year = v_new_year
    WHERE id = p_student_id;
  END IF;

  -- STEP 3: Generate fee for odd new semester
  IF v_new_semester % 2 != 0 AND NOT (v_student.current_semester >= 8) THEN
    INSERT INTO fees
      (student_id, semester, academic_year, base_amount, hostel_amount,
       total_amount, paid_amount, status)
    VALUES (
      p_student_id, v_new_semester, p_academic_year,
      150000,
      CASE WHEN v_student.is_hosteler THEN 50000 ELSE 0 END,
      CASE WHEN v_student.is_hosteler THEN 200000 ELSE 150000 END,
      0, 'pending'
    );
  END IF;

  -- STEP 4: Write promotion log
  INSERT INTO promotion_logs
    (student_id, from_semester, to_semester, from_year, to_year, promoted_by)
  VALUES
    (p_student_id, v_student.current_semester, v_new_semester,
     v_student.current_year, v_new_year, p_promoted_by);

  -- STEP 5: Notify student
  INSERT INTO notifications (user_id, title, message, type)
  SELECT
    s.profile_id,
    CASE WHEN v_student.current_semester >= 8
      THEN 'Congratulations! You have graduated.'
      ELSE 'You have been promoted to Semester ' || v_new_semester
    END,
    CASE WHEN v_student.current_semester >= 8
      THEN 'You have successfully completed your degree. Congratulations!'
      ELSE 'You have been promoted from Semester ' || v_student.current_semester
           || ' to Semester ' || v_new_semester || '.'
    END,
    'promotion'
  FROM students s WHERE s.id = p_student_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_semester', v_new_semester,
    'graduated', v_student.current_semester >= 8,
    'fee_generated', (v_new_semester % 2 != 0 AND NOT (v_student.current_semester >= 8))
  );
END;
$$;
