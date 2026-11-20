-- =============================================================================
-- EduERP — 01_schema.sql
-- Tables, constraints and indexes.
--
-- Target: Supabase (PostgreSQL 15+). Run the files in order:
--   01_schema.sql → 02_functions.sql → 03_triggers.sql → 04_security.sql → 05_seed.sql
-- Every file is idempotent: re-running it on an existing database is safe.
--
-- Design notes
--  * Every row a user owns hangs off auth.users → profiles with ON DELETE CASCADE,
--    so deleting a login removes the person cleanly; academic records that must
--    outlive a class (attendance, marks) use RESTRICT on the class side.
--  * Uniqueness that the app relies on for idempotent upserts is declared here
--    (attendance, marks, submissions, applications, memberships…), so retries and
--    thousands of simultaneous requests can never create duplicates.
--  * Indexes match the exact filter/sort patterns used by the server actions.
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- fast ILIKE search on catalogues

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  role                  text not null check (role in ('super_admin', 'employee', 'teacher', 'student')),
  full_name             text not null default '',
  first_name            text,
  last_name             text,
  email                 text,
  phone                 text,
  dob                   date,
  id_code               text,                       -- college id / staff code shown to users
  profile_picture_url   text,
  notification_enabled  boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists profiles_email_key   on public.profiles (lower(email)) where email is not null;
create unique index if not exists profiles_id_code_key on public.profiles (upper(id_code)) where id_code is not null;
create index if not exists profiles_role_idx           on public.profiles (role);
create index if not exists profiles_email_idx          on public.profiles (email);
create index if not exists profiles_id_code_idx        on public.profiles (id_code);
create index if not exists profiles_created_idx        on public.profiles (created_at desc);

create table if not exists public.students (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null unique references public.profiles(id) on delete cascade,
  college_id        text not null unique,
  program           text,
  branch            text,
  section           text not null default 'A',
  current_semester  smallint not null default 1 check (current_semester between 1 and 12),
  current_year      smallint not null default 1 check (current_year between 1 and 6),
  admitted_year     smallint,
  is_hosteler       boolean not null default false,
  is_graduated      boolean not null default false,             -- kept in sync with status = 'Graduated'
  status            text not null default 'Active',
  dob               date,
  gender            text check (gender in ('Male', 'Female', 'Other')),
  address           text,
  parent_name       text,
  parent_phone      text,
  blood_group       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- The roster query used everywhere: program + branch + semester + section, active only.
-- Upgrade: add status to databases created before it existed.
alter table public.students add column if not exists status text not null default 'Active';
update public.students set status = 'Graduated' where is_graduated and status <> 'Graduated';
alter table public.students drop constraint if exists students_status_check;
alter table public.students add constraint students_status_check
  check (status in ('Active', 'Inactive', 'Graduated', 'Pending Approval', 'Suspended', 'Dropped Out'));
drop index if exists public.students_roster_idx;
create index if not exists students_active_roster_idx on public.students (program, branch, current_semester, section) where status = 'Active';
create index if not exists students_status_idx on public.students (status);
create index if not exists students_branch_idx   on public.students (program, branch, section);
create index if not exists students_hosteler_idx on public.students (id) where is_hosteler;

create table if not exists public.teachers (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null unique references public.profiles(id) on delete cascade,
  employee_code    text not null unique,
  program          text,
  department       text,
  designation      text,
  dob              date,
  phone            text,
  date_of_joining  date,
  office_location  text,
  qualifications   text,
  specialization   text,
  status           text not null default 'Active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.employees (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null unique references public.profiles(id) on delete cascade,
  employee_code    text not null unique,
  employee_type    text not null check (employee_type in (
                     'super_admin', 'fee_management', 'hostel_management',
                     'student_staff_management', 'exam_marks_management', 'library_management')),
  department       text,
  designation      text,
  dob              date,
  phone            text,
  date_of_joining  date,
  office_location  text,
  qualifications   text,
  specialization   text,
  status           text not null default 'Active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists employees_type_idx on public.employees (employee_type);

-- Staff status (matches the staff form). Re-declared so re-running upgrades older databases.
alter table public.teachers  drop constraint if exists teachers_status_check;
alter table public.teachers  add  constraint teachers_status_check  check (status in ('Active', 'Inactive', 'On Leave', 'Resigned', 'Terminated'));
alter table public.employees drop constraint if exists employees_status_check;
alter table public.employees add  constraint employees_status_check check (status in ('Active', 'Inactive', 'On Leave', 'Resigned', 'Terminated'));

-- ---------------------------------------------------------------------------
-- Academics
-- ---------------------------------------------------------------------------

create table if not exists public.academic_terms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  start_date  date not null,
  end_date    date not null,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now(),
  check (end_date > start_date)
);
-- At most one current term.
create unique index if not exists academic_terms_one_current on public.academic_terms (is_current) where is_current;

create table if not exists public.courses (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  program      text not null,
  branch       text not null,
  semester     smallint not null check (semester between 1 and 12),
  credits      numeric(4,1) not null default 0 check (credits >= 0 and credits <= 30),
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists courses_catalog_idx on public.courses (program, branch, semester);

create table if not exists public.classrooms (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(name) between 1 and 120),
  section       text not null default '',
  subject       text not null default '',
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  owner_name    text not null default '',
  theme         text,
  invite_code   text not null unique check (invite_code ~ '^[A-Z0-9]{4,12}$'),
  member_count  integer not null default 0 check (member_count >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists classrooms_owner_idx on public.classrooms (owner_id);

-- A "class" = one course taught to one section in one term.
create table if not exists public.classes (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references public.courses(id) on delete restrict,
  academic_term_id  uuid references public.academic_terms(id) on delete set null,
  teacher_id        uuid references public.teachers(id) on delete set null,
  classroom_id      uuid references public.classrooms(id) on delete set null,
  program           text not null,
  branch            text not null,
  section           text not null default 'A',
  year              smallint,                 -- year of study (1..6)
  academic_year     text not null,            -- label used by the UI filters
  semester          smallint not null check (semester between 1 and 12),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (course_id, program, branch, semester, section, academic_year)
);
create index if not exists classes_teacher_idx on public.classes (teacher_id);
create index if not exists classes_section_idx on public.classes (program, branch, semester, section);
create index if not exists classes_course_idx  on public.classes (course_id);

create table if not exists public.timetables (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  day_of_week  text not null check (day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  start_time   time not null,
  end_time     time not null,
  room         text,
  created_at   timestamptz not null default now(),
  check (end_time > start_time),
  unique (class_id, day_of_week, start_time)
);
create index if not exists timetables_slot_idx on public.timetables (day_of_week, start_time);

-- One row per student per period. Upserts key on the unique constraint.
create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete restrict,
  student_id  uuid not null references public.students(id) on delete cascade,
  teacher_id  uuid references public.profiles(id) on delete set null,   -- who marked it
  date        date not null,
  period      smallint not null check (period between 1 and 12),
  status      text not null check (status in ('Present', 'Absent')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (class_id, student_id, date, period)
);
create index if not exists attendance_student_date_idx on public.attendance (student_id, date);
create index if not exists attendance_class_date_idx   on public.attendance (class_id, date, period);
create index if not exists attendance_date_idx         on public.attendance (date);

-- One row per taught period (maintained by trigger) — cheap "was attendance taken?" checks
-- and teacher session logs without scanning millions of attendance rows.
create table if not exists public.attendance_sessions (
  class_id       uuid not null references public.classes(id) on delete cascade,
  date           date not null,
  period         smallint not null,
  teacher_id     uuid references public.profiles(id) on delete set null,
  student_count  integer not null default 0,
  present_count  integer not null default 0,
  created_at     timestamptz not null default now(),
  primary key (class_id, date, period)
);
create index if not exists attendance_sessions_teacher_idx on public.attendance_sessions (teacher_id, date desc);
create index if not exists attendance_sessions_date_idx    on public.attendance_sessions (date);

-- Raw component marks; total & grade are computed by trigger (never trusted from clients).
create table if not exists public.marks (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete restrict,
  ia1         numeric(5,2) check (ia1   between 0 and 40),
  ia2         numeric(5,2) check (ia2   between 0 and 40),
  other       numeric(5,2) check (other between 0 and 20),
  see         numeric(5,2) check (see   between 0 and 100),
  total       numeric(5,2),
  grade       text check (grade in ('O','A+','A','B+','B','C+','C','P','F')),
  updated_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (student_id, class_id)
);
create index if not exists marks_class_idx on public.marks (class_id);

create table if not exists public.exams (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid not null references public.courses(id) on delete restrict,
  program             text not null,
  branch              text not null,
  year                smallint,
  academic_year       text not null default to_char(now(), 'YYYY'),
  semester            smallint not null check (semester between 1 and 12),
  exam_type           text not null,
  exam_date           date,
  start_time          time,
  end_time            time,
  room                text,
  status              text not null default 'Scheduled' check (status in ('Scheduled', 'Completed', 'Cancelled', 'Postponed')),
  max_internal_marks  numeric(5,2),
  max_external_marks  numeric(5,2),
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time > start_time),
  unique (course_id, exam_type, academic_year, semester)
);
create index if not exists exams_section_idx on public.exams (program, branch, semester, exam_date);
create index if not exists exams_course_idx  on public.exams (course_id, status);

create table if not exists public.exam_marks (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid not null references public.exams(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  marks_obtained  numeric(6,2) check (marks_obtained >= 0),
  status          text not null default 'Present' check (status in ('Present', 'Absent', 'Malpractice', 'Withheld')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (exam_id, student_id)
);
create index if not exists exam_marks_student_idx on public.exam_marks (student_id);

-- One row per published exam session (e.g. "SEE" for B.Tech CSE sem 3 in 2026):
-- the hall-ticket rules configured in the scheduling dialog.
create table if not exists public.exam_sessions (
  id                    uuid primary key default gen_random_uuid(),
  program               text not null,
  branch                text not null,
  semester              smallint not null check (semester between 1 and 12),
  exam_type             text not null,
  academic_year         text not null default to_char(now(), 'YYYY'),
  min_attendance        numeric(5,2) not null default 75 check (min_attendance between 0 and 100),
  min_fee_paid_percent  numeric(5,2) not null default 0  check (min_fee_paid_percent between 0 and 100),
  instructions          text,
  controller_signature  text,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (program, branch, semester, exam_type, academic_year)
);

create table if not exists public.promotions (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students(id) on delete cascade,
  from_semester  smallint not null,
  to_semester    smallint,
  graduated      boolean not null default false,
  academic_year  text not null,
  promoted_by    uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists promotions_student_idx on public.promotions (student_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------

-- Fees are billed per YEAR OF STUDY (1..6) — the unit the fee screens work in.
-- Configurable amounts: program NULL = institution-wide default; study_year NULL = every year.
create table if not exists public.fee_structures (
  id          uuid primary key default gen_random_uuid(),
  program     text,
  fee_type    text not null check (fee_type in ('college', 'hostel')),
  study_year  smallint check (study_year between 1 and 6),
  amount      numeric(12,2) not null check (amount >= 0),
  created_at  timestamptz not null default now()
);

create table if not exists public.fees (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references public.students(id) on delete cascade,
  fee_type          text not null check (fee_type in ('college', 'hostel')),
  study_year        smallint not null check (study_year between 1 and 6),
  academic_term_id  uuid references public.academic_terms(id) on delete set null,
  total_amount      numeric(12,2) not null check (total_amount >= 0),
  paid_amount       numeric(12,2) not null default 0 check (paid_amount >= 0),
  balance           numeric(12,2) generated always as (total_amount - paid_amount) stored,
  status            text not null default 'Pending' check (status in ('Pending', 'Partial', 'Paid')),
  due_date          date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (paid_amount <= total_amount)
);

-- Upgrade path for databases created with the earlier calendar-year column.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fee_structures' and column_name = 'academic_year') then
    drop index if exists public.fee_structures_key;
    alter table public.fee_structures drop column academic_year;
    alter table public.fee_structures add column if not exists study_year smallint check (study_year between 1 and 6);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fees' and column_name = 'academic_year') then
    alter table public.fees add column if not exists study_year smallint;
    update public.fees f set study_year = case when f.academic_year ~ '^[1-6]$' then f.academic_year::smallint
                                               else coalesce(s.current_year, 1) end
      from public.students s where s.id = f.student_id;
    alter table public.fees drop column academic_year;
    alter table public.fees alter column study_year set not null;
    alter table public.fees add constraint fees_study_year_check check (study_year between 1 and 6);
  end if;
end;
$$;

create unique index if not exists fee_structures_key
  on public.fee_structures (coalesce(program, '*'), fee_type, coalesce(study_year, 0));
create unique index if not exists fees_student_type_year_key on public.fees (student_id, fee_type, study_year);
create index if not exists fees_status_idx on public.fees (fee_type, study_year, status);
create index if not exists fees_due_idx    on public.fees (student_id) where balance > 0;

create table if not exists public.fee_payments (
  id              uuid primary key default gen_random_uuid(),
  fee_id          uuid not null references public.fees(id) on delete cascade,
  amount          numeric(12,2) not null check (amount > 0),
  payment_method  text,
  payment_date    date not null default current_date,
  transaction_id  text not null unique,
  recorded_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists fee_payments_fee_idx on public.fee_payments (fee_id, payment_date desc);

-- ---------------------------------------------------------------------------
-- Hostel
-- ---------------------------------------------------------------------------

create table if not exists public.hostels (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  type            text check (type in ('Boys', 'Girls', 'Co-ed', 'Staff')),
  status          text not null default 'Operational' check (status in ('Operational', 'Under Maintenance', 'Closed')),
  capacity        integer not null default 0 check (capacity >= 0),
  warden_name     text,
  warden_contact  text,
  warden_email    text,
  warden_office   text,
  description     text,
  facilities      text[] not null default '{}',
  rules           text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.hostel_rooms (
  id           uuid primary key default gen_random_uuid(),
  hostel_id    uuid not null references public.hostels(id) on delete cascade,
  room_number  text not null,
  room_type    text,
  block        text,
  floor        smallint,
  capacity     smallint not null check (capacity > 0),
  occupied     smallint not null default 0,       -- maintained by trigger
  created_at   timestamptz not null default now(),
  check (occupied between 0 and capacity),           -- over-allocation is impossible
  unique (hostel_id, room_number)
);

create table if not exists public.hostel_allocations (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.hostel_rooms(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  status        text not null default 'Active' check (status in ('Active', 'Vacated')),
  from_date     date not null default current_date,
  to_date       date,
  allocated_by  uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
-- A student can hold only one active bed.
create unique index if not exists hostel_allocations_one_active on public.hostel_allocations (student_id) where status = 'Active';
create index if not exists hostel_allocations_room_idx on public.hostel_allocations (room_id) where status = 'Active';

create table if not exists public.hostel_complaints (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  hostel_id       uuid not null references public.hostels(id) on delete cascade,
  hostel_room_id  uuid references public.hostel_rooms(id) on delete set null,
  description     text not null check (length(description) between 1 and 2000),
  status          text not null default 'Pending' check (status in ('Pending', 'In Progress', 'Resolved')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists hostel_complaints_hostel_idx  on public.hostel_complaints (hostel_id, created_at desc);
create index if not exists hostel_complaints_student_idx on public.hostel_complaints (student_id, created_at desc);

create table if not exists public.hostel_menu (
  id              uuid primary key default gen_random_uuid(),
  hostel_id       uuid not null references public.hostels(id) on delete cascade,
  day_of_week     text not null check (day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  morning_slot    text,
  afternoon_slot  text,
  evening_slot    text,
  dinner_slot     text,
  updated_at      timestamptz not null default now(),
  unique (hostel_id, day_of_week)
);

-- ---------------------------------------------------------------------------
-- Library
-- ---------------------------------------------------------------------------

create table if not exists public.books (
  id                uuid primary key default gen_random_uuid(),
  isbn              text,
  title             text not null,
  author            text,
  category          text,
  description       text,
  cover_url         text,
  publisher         text,
  published_year    smallint,
  total_copies      integer not null default 1 check (total_copies >= 0),
  available_copies  integer not null default 1,
  digital_url       text,
  source            text not null default 'physical' check (source in ('physical', 'digital', 'both')),
  added_by          uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (available_copies between 0 and total_copies)
);
create unique index if not exists books_isbn_key on public.books (isbn) where isbn is not null and isbn <> '';
create index if not exists books_title_trgm  on public.books using gin (title gin_trgm_ops);
create index if not exists books_author_trgm on public.books using gin (author gin_trgm_ops);

create table if not exists public.book_issues (
  id           uuid primary key default gen_random_uuid(),
  book_id      uuid not null references public.books(id) on delete cascade,
  borrower_id  uuid not null references public.profiles(id) on delete cascade,
  issued_by    uuid references public.profiles(id) on delete set null,
  issued_at    timestamptz not null default now(),
  due_date     date not null,
  returned_at  timestamptz,
  status       text not null default 'Issued' check (status in ('Issued', 'Returned')),
  fine_amount  numeric(10,2) not null default 0 check (fine_amount >= 0),
  created_at   timestamptz not null default now()
);
-- One copy of the same title per borrower at a time.
create unique index if not exists book_issues_one_open on public.book_issues (book_id, borrower_id) where status = 'Issued';
create index if not exists book_issues_open_due_idx on public.book_issues (due_date) where status = 'Issued';
create index if not exists book_issues_borrower_idx on public.book_issues (borrower_id, issued_at desc);

-- ---------------------------------------------------------------------------
-- Placements
-- ---------------------------------------------------------------------------

create table if not exists public.placement_opportunities (
  id                uuid primary key default gen_random_uuid(),
  type              text not null default 'placement' check (type in ('placement', 'internship')),
  company_name      text not null,
  role_title        text not null,
  description       text,
  salary_package    text,
  package_lpa       numeric(8,2),
  eligibility       text,
  eligibility_cgpa  numeric(4,2) check (eligibility_cgpa between 0 and 10),
  location          text,
  duration          text,
  skills            text[] not null default '{}',
  deadline          date,
  status            text not null default 'Open' check (status in ('Open', 'Closed')),
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists placement_opportunities_type_idx on public.placement_opportunities (type, created_at desc);

create table if not exists public.placement_applications (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  opportunity_id  uuid not null references public.placement_opportunities(id) on delete cascade,
  status          text not null default 'Applied' check (status in
                    ('Applied', 'Under Review', 'Shortlisted', 'Offer Extended', 'Offer Accepted', 'Rejected')),
  applied_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (student_id, opportunity_id)
);
create index if not exists placement_applications_opp_idx     on public.placement_applications (opportunity_id, status);
create index if not exists placement_applications_student_idx on public.placement_applications (student_id, applied_at desc);
create index if not exists placement_applications_recent_idx  on public.placement_applications (applied_at desc);

-- Resume builder: one saved resume per student (form values as JSON).
create table if not exists public.resumes (
  student_id   uuid primary key references public.students(id) on delete cascade,
  template_id  text not null default 'modern-sidebar',
  show_photo   boolean not null default true,
  data         jsonb not null default '{}'::jsonb check (pg_column_size(data) < 200000),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (length(title) between 1 and 200),
  message     text not null default '',
  type        text not null default 'info' check (type in ('info', 'alert', 'task', 'event')),
  link        text,
  is_read     boolean not null default false,
  sender_id   uuid,                                -- no FK: senders may be deleted, history stays
  created_at  timestamptz not null default now()
);
create index if not exists notifications_inbox_idx  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where not is_read;
create index if not exists notifications_age_idx    on public.notifications (created_at);

-- ---------------------------------------------------------------------------
-- Virtual classroom
-- ---------------------------------------------------------------------------

create table if not exists public.classroom_members (
  classroom_id  uuid not null references public.classrooms(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role          text not null default 'student' check (role in ('owner', 'student')),
  joined_at     timestamptz not null default now(),
  primary key (classroom_id, user_id)
);
create index if not exists classroom_members_user_idx on public.classroom_members (user_id);

create table if not exists public.classroom_posts (
  id            uuid primary key default gen_random_uuid(),
  classroom_id  uuid not null references public.classrooms(id) on delete cascade,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  author_name   text not null default '',
  author_role   text not null default 'student' check (author_role in ('teacher', 'student', 'admin')),
  content       text not null check (length(content) between 1 and 5000),
  created_at    timestamptz not null default now()
);
create index if not exists classroom_posts_feed_idx on public.classroom_posts (classroom_id, created_at desc);

create table if not exists public.classroom_assignments (
  id            uuid primary key default gen_random_uuid(),
  classroom_id  uuid not null references public.classrooms(id) on delete cascade,
  author_id     uuid references public.profiles(id) on delete set null,
  author_name   text not null default '',
  title         text not null check (length(title) between 1 and 200),
  description   text not null default '',
  due_date      timestamptz,
  max_marks     integer not null default 100 check (max_marks between 1 and 1000),
  created_at    timestamptz not null default now()
);
create index if not exists classroom_assignments_room_idx on public.classroom_assignments (classroom_id, created_at desc);

create table if not exists public.classroom_submissions (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references public.classroom_assignments(id) on delete cascade,
  classroom_id    uuid not null references public.classrooms(id) on delete cascade,
  student_id      uuid not null references public.profiles(id) on delete cascade,
  student_name    text not null default '',
  content         text not null default '',
  file_name       text,
  file_url        text,
  status          text not null default 'Submitted' check (status in ('Submitted', 'Graded')),
  marks_obtained  numeric(7,2) check (marks_obtained >= 0),
  submitted_at    timestamptz not null default now(),
  graded_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index if not exists classroom_submissions_student_idx on public.classroom_submissions (classroom_id, student_id);

create table if not exists public.classroom_notes (
  id            uuid primary key default gen_random_uuid(),
  classroom_id  uuid not null references public.classrooms(id) on delete cascade,
  teacher_id    uuid references public.profiles(id) on delete set null,
  teacher_name  text not null default '',
  description   text not null default '',
  file_name     text not null,
  file_url      text not null,
  file_type     text,
  file_size     bigint not null default 0 check (file_size >= 0),
  created_at    timestamptz not null default now()
);
create index if not exists classroom_notes_room_idx on public.classroom_notes (classroom_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Infrastructure
-- ---------------------------------------------------------------------------

-- Successful sign-ins (admin dashboard "recent logins"; purged after 180 days).
create table if not exists public.login_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists login_events_recent_idx on public.login_events (created_at desc);
create index if not exists login_events_user_idx   on public.login_events (user_id, created_at desc);

-- Atomic counters for human-readable ids (college ids, staff codes, course codes).
create table if not exists public.counters (
  key         text primary key,
  value       bigint not null default 0,
  updated_at  timestamptz not null default now()
);

-- Fixed-window rate limiting for public endpoints (signup, login, password reset).
create table if not exists public.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (key, window_start)
);
create index if not exists rate_limits_age_idx on public.rate_limits (window_start);

-- Short-lived cache for expensive dashboard aggregates (protects the DB from refresh storms).
create table if not exists public.dashboard_cache (
  key          text primary key,
  payload      jsonb not null,
  computed_at  timestamptz not null default now()
);

-- Append-only audit trail for sensitive changes (marks, payments, roles, student records).
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   text,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id    uuid,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_record_idx on public.audit_log (table_name, record_id, created_at desc);
create index if not exists audit_log_time_idx   on public.audit_log (created_at);

-- ---------------------------------------------------------------------------
-- Foreign-key support indexes
-- Every FK column gets an index so ON DELETE CASCADE / SET NULL (e.g. deleting a
-- teacher login that marked millions of attendance rows) never scans a table.
-- ---------------------------------------------------------------------------
create index if not exists classes_term_idx                 on public.classes (academic_term_id);
create index if not exists classes_classroom_idx            on public.classes (classroom_id);
create index if not exists attendance_teacher_idx           on public.attendance (teacher_id);
create index if not exists marks_updated_by_idx             on public.marks (updated_by);
create index if not exists exams_created_by_idx             on public.exams (created_by);
create index if not exists exam_sessions_created_by_idx     on public.exam_sessions (created_by);
create index if not exists promotions_promoted_by_idx       on public.promotions (promoted_by);
create index if not exists fees_term_idx                    on public.fees (academic_term_id);
create index if not exists fee_payments_recorded_by_idx     on public.fee_payments (recorded_by);
create index if not exists hostel_allocations_student_idx   on public.hostel_allocations (student_id);
create index if not exists hostel_allocations_room_all_idx  on public.hostel_allocations (room_id);
create index if not exists hostel_allocations_by_idx        on public.hostel_allocations (allocated_by);
create index if not exists hostel_complaints_room_idx       on public.hostel_complaints (hostel_room_id);
create index if not exists books_added_by_idx               on public.books (added_by);
create index if not exists book_issues_book_idx             on public.book_issues (book_id);
create index if not exists book_issues_issued_by_idx        on public.book_issues (issued_by);
create index if not exists placement_opportunities_by_idx   on public.placement_opportunities (created_by);
create index if not exists classroom_posts_author_idx       on public.classroom_posts (author_id);
create index if not exists classroom_assignments_author_idx on public.classroom_assignments (author_id);
create index if not exists classroom_submissions_user_idx   on public.classroom_submissions (student_id);
create index if not exists classroom_notes_teacher_idx      on public.classroom_notes (teacher_id);

-- ---------------------------------------------------------------------------
-- Backlogs (arrears)
-- One row per student per course that was failed. fail_count is the
-- subject's backlog count: 1 for the original failure + 1 per failed re-exam.
-- Created/cleared automatically from marks (03_triggers.sql); re-exam results
-- are recorded by the exam department through record_backlog_attempt().
-- ---------------------------------------------------------------------------
create table if not exists public.backlogs (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references public.students(id) on delete cascade,
  course_id         uuid not null references public.courses(id) on delete restrict,
  class_id          uuid not null references public.classes(id) on delete restrict,   -- original class (internals live here)
  semester          smallint not null,
  study_year        smallint not null,
  fail_count        integer not null default 1 check (fail_count >= 1),
  status            text not null default 'Active' check (status in ('Active', 'Cleared')),
  first_failed_at   timestamptz not null default now(),
  last_attempt_at   timestamptz,
  cleared_at        timestamptz,
  cleared_grade     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (student_id, course_id)
);
create index if not exists backlogs_active_idx  on public.backlogs (status, semester) where status = 'Active';
create index if not exists backlogs_student_idx on public.backlogs (student_id, status);
create index if not exists backlogs_course_idx  on public.backlogs (course_id);
create index if not exists backlogs_class_idx   on public.backlogs (class_id);

-- Every re-examination (supplementary) attempt with its outcome.
create table if not exists public.backlog_attempts (
  id            uuid primary key default gen_random_uuid(),
  attempt_no    text unique,                         -- SUP2026000001 (generated)
  backlog_id    uuid not null references public.backlogs(id) on delete cascade,
  exam_label    text not null default 'Supplementary',
  attempt_date  date not null default current_date,
  see           numeric(5,2) not null check (see between 0 and 100),
  total         numeric(5,2) not null,
  grade         text not null,
  passed        boolean not null,
  recorded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists backlog_attempts_backlog_idx on public.backlog_attempts (backlog_id, attempt_date desc);
create index if not exists backlog_attempts_by_idx      on public.backlog_attempts (recorded_by);

-- ---------------------------------------------------------------------------
-- Human-readable reference numbers (filled by BEFORE INSERT triggers).
-- Native sequences: lock-free, so thousands of concurrent payments or
-- applications never queue on a counter row.
-- ---------------------------------------------------------------------------
create sequence if not exists public.receipt_no_seq;
create sequence if not exists public.allotment_no_seq;
create sequence if not exists public.complaint_no_seq;
create sequence if not exists public.issue_no_seq;
create sequence if not exists public.application_no_seq;
create sequence if not exists public.backlog_attempt_no_seq;

alter table public.fee_payments           add column if not exists receipt_no     text;
alter table public.exams                  add column if not exists exam_code      text;
alter table public.hostel_allocations     add column if not exists allotment_no   text;
alter table public.hostel_complaints      add column if not exists ticket_no      text;
alter table public.book_issues            add column if not exists issue_no       text;
alter table public.placement_applications add column if not exists application_no text;

create unique index if not exists fee_payments_receipt_no_key          on public.fee_payments (receipt_no);
create unique index if not exists exams_exam_code_key                  on public.exams (exam_code);
create unique index if not exists hostel_allocations_allotment_no_key  on public.hostel_allocations (allotment_no);
create unique index if not exists hostel_complaints_ticket_no_key      on public.hostel_complaints (ticket_no);
create unique index if not exists book_issues_issue_no_key             on public.book_issues (issue_no);
create unique index if not exists placement_applications_app_no_key    on public.placement_applications (application_no);
