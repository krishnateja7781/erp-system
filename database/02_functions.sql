-- =============================================================================
-- EduERP — 02_functions.sql
-- Business logic that must be atomic, race-free or set-based lives here.
-- All functions are SECURITY DEFINER with a pinned search_path and are only
-- executable by service_role (see 04_security.sql); the Next.js server actions
-- authorize the caller first and then invoke them.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Utilities
-- ---------------------------------------------------------------------------

-- Atomic, gap-tolerant sequence per key. Safe under any concurrency (row lock on upsert).
create or replace function public.next_sequence(p_key text)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into public.counters as c (key, value)
  values (p_key, 1)
  on conflict (key) do update set value = c.value + 1, updated_at = now()
  returning value;
$$;

-- Backwards-compatible alias.
create or replace function public.increment_counter(counter_key text)
returns bigint
language sql
security definer
set search_path = public
as $$ select public.next_sequence(counter_key); $$;

-- Atomic fixed-window rate limit. Returns true while the caller is within the limit.
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits   integer;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (left(p_key, 200), v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

-- Grade scale — mirrors src/lib/grading.ts.
create or replace function public.grade_for_total(p_total numeric)
returns text
language sql
immutable
as $$
  select case
    when p_total >= 90 then 'O'
    when p_total >= 80 then 'A+'
    when p_total >= 70 then 'A'
    when p_total >= 60 then 'B+'
    when p_total >= 55 then 'B'
    when p_total >= 50 then 'C+'
    when p_total >= 45 then 'C'
    when p_total >= 40 then 'P'
    else 'F'
  end;
$$;

create or replace function public.grade_point(p_grade text)
returns numeric
language sql
immutable
as $$
  select case p_grade
    when 'O' then 10 when 'A+' then 9 when 'A' then 8 when 'B+' then 7
    when 'B' then 6 when 'C+' then 5 when 'C' then 4 when 'P' then 3
    when 'F' then 0 else null end;
$$;

create or replace function public.program_max_semesters(p_program text)
returns smallint
language sql
immutable
as $$
  select (case
    when p_program in ('MBA', 'M.Tech', 'MCA', 'M.Sc', 'M.Com') then 4
    when p_program in ('B.Sc', 'B.Com', 'BBA', 'BCA', 'B.A')   then 6
    when p_program in ('Law', 'MBBS')                           then 10
    else 8 end)::smallint;
$$;

-- Credit-weighted CGPA from graded marks.
create or replace function public.student_cgpa(p_student_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(sum(public.grade_point(m.grade) * c.credits) / nullif(sum(c.credits), 0), 2)
  from public.marks m
  join public.classes cl on cl.id = m.class_id
  join public.courses c  on c.id = cl.course_id
  where m.student_id = p_student_id
    and m.grade is not null
    and c.credits > 0;
$$;

-- Returns the current academic term, creating one for the running academic year if none exists.
create or replace function public.ensure_current_term()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_start date := make_date(extract(year from current_date)::int - case when extract(month from current_date) < 6 then 1 else 0 end, 6, 1);
begin
  select id into v_id from public.academic_terms where is_current limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.academic_terms (name, code, start_date, end_date, is_current)
  values (
    format('Academic Year %s-%s', extract(year from v_start), extract(year from v_start) + 1),
    format('AY%s', extract(year from v_start)),
    v_start,
    (v_start + interval '1 year' - interval '1 day')::date,
    true
  )
  on conflict (code) do update set is_current = true
  returning id into v_id;
  return v_id;
exception when unique_violation then
  -- Another session created the current term concurrently.
  select id into v_id from public.academic_terms where is_current limit 1;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identifier generators (single source of truth; the code tables are generated from
-- src/lib/academic-codes.ts by scripts/gen-id-code-sql.py).
--
--   Every person ID   CATEGORY(3) YY SUB(2) SERIAL(5)  ENG26CS00442 · TCH26CS00017 · EMP26FE00003 · ADM26SA00001
--   Course            PROGRAM(3) SEM BRANCH(2) SEQ(3)  ENG3CS001
--   Exam              COURSE-SESSION-YYYY              ENG3CS001-SEE-2026
--   Hall ticket       HT YY SESSION PERSON-ID          HT26SEEENG24CS00042
--   References        PFX YYYY SEQ                     RCP20260000123, HCT2026000017 …
--
-- Every generator verifies the candidate is unused across ALL roles, so manually
-- entered IDs can never cause a collision.
-- ---------------------------------------------------------------------------

-- >>> generated by scripts/gen-id-code-sql.py from src/lib/academic-codes.ts — do not edit by hand
create or replace function public.program_code(p_program text)
returns text
language sql
immutable
as $$
  select coalesce(case p_program
    when 'B.Tech' then 'ENG'
    when 'MBA' then 'MBA'
    when 'MCA' then 'MCA'
    when 'Law' then 'LAW'
    when 'MBBS' then 'MED'
    when 'B.Sc' then 'SCI'
    when 'B.Com' then 'COM'
    end,
    -- unknown program: first 3 letters, never one of the reserved staff categories
    (select case when x in ('TCH', 'EMP', 'ADM') then 'STU' else x end
       from (select rpad(left(upper(regexp_replace(coalesce(p_program, ''), '[^A-Za-z]', '', 'g')), 3), 3, 'X') as x) t));
$$;

create or replace function public.branch_code(p_program text, p_branch text)
returns text
language sql
immutable
as $$
  select coalesce(case p_program
      when 'B.Tech' then case p_branch when 'CSE' then 'CS' when 'ECE' then 'EC' when 'MECH' then 'ME' when 'IT' then 'IT' when 'AI&ML' then 'AI' when 'DS' then 'DS' when 'Cyber Security' then 'CY' when 'CIVIL' then 'CV' when 'Other' then 'OT' end
      when 'MBA' then case p_branch when 'Marketing' then 'MK' when 'Finance' then 'FN' when 'HR' then 'HR' when 'Operations' then 'OP' when 'General' then 'GN' when 'Other' then 'OT' end
      when 'MCA' then case p_branch when 'Computer Applications' then 'CA' when 'Other' then 'OT' end
      when 'Law' then case p_branch when 'Corporate Law' then 'CR' when 'Criminal Law' then 'CM' when 'Civil Law' then 'CL' when 'General' then 'GN' when 'Other' then 'OT' end
      when 'MBBS' then case p_branch when 'General Medicine' then 'GM' end
      when 'B.Sc' then case p_branch when 'Physics' then 'PH' when 'Chemistry' then 'CH' when 'Mathematics' then 'MA' when 'Computer Science' then 'CS' when 'Biotechnology' then 'BT' when 'Other' then 'OT' end
      when 'B.Com' then case p_branch when 'General' then 'GN' when 'Accounting & Finance' then 'AF' when 'Taxation' then 'TX' when 'Corporate Secretaryship' then 'SC' when 'Other' then 'OT' end
    end,
    rpad(left(upper(regexp_replace(coalesce(p_branch, ''), '[^A-Za-z]', '', 'g')), 2), 2, 'X'));
$$;

create or replace function public.department_code(p_department text)
returns text
language sql
immutable
as $$
  select case
    when p_department is null or trim(p_department) = '' then 'GN'
    else coalesce(case p_department
    when 'CSE' then 'CS'
    when 'Computer Science' then 'CS'
    when 'Computer Science & Engineering' then 'CS'
    when 'ECE' then 'EC'
    when 'Electronics & Communication Engineering' then 'EC'
    when 'MECH' then 'ME'
    when 'Mechanical Engineering' then 'ME'
    when 'IT' then 'IT'
    when 'Information Technology' then 'IT'
    when 'AI&ML' then 'AI'
    when 'Artificial Intelligence & Machine Learning' then 'AI'
    when 'DS' then 'DS'
    when 'Data Science' then 'DS'
    when 'Cyber Security' then 'CY'
    when 'CIVIL' then 'CV'
    when 'Civil Engineering' then 'CV'
    when 'Mathematics' then 'MA'
    when 'Physics' then 'PH'
    when 'Chemistry' then 'CH'
    when 'English' then 'EN'
    when 'Biotechnology' then 'BT'
    when 'Marketing' then 'MK'
    when 'Finance' then 'FN'
    when 'HR' then 'HR'
    when 'Operations' then 'OP'
    when 'General Management' then 'MG'
    when 'Computer Applications' then 'CA'
    when 'Corporate Law' then 'CR'
    when 'Criminal Law' then 'CM'
    when 'Civil Law' then 'CL'
    when 'Constitutional Law' then 'CN'
    when 'Anatomy' then 'AN'
    when 'Physiology' then 'PY'
    when 'Biochemistry' then 'BC'
    when 'General Medicine' then 'GM'
    when 'Surgery' then 'SG'
    when 'Pediatrics' then 'PD'
    when 'General' then 'GN'
    when 'Accounting & Finance' then 'AF'
    when 'Taxation' then 'TX'
    when 'Corporate Secretaryship' then 'SC'
    when 'Administration' then 'AD'
    when 'General Administration' then 'AD'
    when 'Accounts' then 'AC'
    when 'IT Support' then 'IS'
    when 'Library' then 'LB'
    when 'General Office' then 'GO'
    when 'Maintenance' then 'MT'
    when 'Security' then 'SE'
    when 'Other' then 'OT'
    end, rpad(left(upper(regexp_replace(p_department, '[^A-Za-z]', '', 'g')), 2), 2, 'X')) end;
$$;

create or replace function public.employee_type_code(p_type text)
returns text
language sql
immutable
as $$
  select coalesce(case p_type when 'fee_management' then 'FE' when 'hostel_management' then 'HM' when 'student_staff_management' then 'SS' when 'exam_marks_management' then 'EX' when 'library_management' then 'LB' end, 'GN');
$$;
-- <<< generated

create or replace function public.exam_session_code(p_exam_type text)
returns text
language sql
immutable
as $$
  select case
    when p_exam_type ilike 'IA-1%' or p_exam_type ilike 'IA1%' then 'IA1'
    when p_exam_type ilike 'IA-2%' or p_exam_type ilike 'IA2%' then 'IA2'
    when p_exam_type ilike 'SEE%' or p_exam_type ilike '%semester end%' then 'SEE'
    when p_exam_type ilike 'supp%' then 'SUP'
    else rpad(left(upper(regexp_replace(coalesce(p_exam_type, ''), '[^A-Za-z0-9]', '', 'g')), 3), 3, 'X') end;
$$;

-- Is this human-readable code already used anywhere (any role)?
create or replace function public.id_code_taken(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles  where upper(id_code) = upper(p_code))
      or exists (select 1 from public.students  where college_id = upper(p_code))
      or exists (select 1 from public.teachers  where employee_code = upper(p_code))
      or exists (select 1 from public.employees where employee_code = upper(p_code));
$$;

-- THE person-ID algorithm, shared by every role (12 characters):
--   CATEGORY(3) + YY(2) + SUBCATEGORY(2) + SERIAL(5)      e.g. ENG26CS00442
-- The serial is per (category, year, subcategory). The first time a prefix is used the
-- counter starts after the highest serial already present, so existing IDs are never
-- reused and the next person after ENG26CS00442 is ENG26CS00443. Atomic under concurrency.
create or replace function public.generate_user_id(p_category text, p_year integer, p_subcategory text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := upper(rpad(left(p_category, 3), 3, 'X'))
                   || right(lpad(coalesce(p_year, extract(year from current_date)::int)::text, 4, '0'), 2)
                   || upper(rpad(left(p_subcategory, 2), 2, 'X'));
  v_key    text := 'UID:' || v_prefix;
  v_seed   integer;
  v_serial integer;
  v_code   text;
begin
  if not exists (select 1 from public.counters where key = v_key) then
    select coalesce(max(right(code, 5)::int), 0) into v_seed
    from (
      select college_id as code from public.students
      union all select employee_code from public.teachers
      union all select employee_code from public.employees
      union all select upper(id_code) from public.profiles where id_code is not null
    ) c
    where code ~ ('^' || v_prefix || '[0-9]{5}$');
  end if;

  loop
    insert into public.counters as c (key, value) values (v_key, coalesce(v_seed, 0) + 1)
    on conflict (key) do update set value = c.value + 1, updated_at = now()
    returning value into v_serial;
    if v_serial > 99999 then
      raise exception 'ID range % is full (99999 used)', v_prefix;
    end if;
    v_code := v_prefix || lpad(v_serial::text, 5, '0');
    exit when not public.id_code_taken(v_code);
  end loop;
  return v_code;
end;
$$;

-- Student: program + joining year + branch          ENG26CS00442
create or replace function public.generate_college_id(p_program text, p_branch text, p_admitted_year integer default null)
returns text
language sql
security definer
set search_path = public
as $$ select public.generate_user_id(public.program_code(p_program), p_admitted_year, public.branch_code(p_program, p_branch)); $$;

-- Staff, p_role 'teacher' | 'employee' | 'super_admin':
--   teacher      TCH + joining year + department        TCH26CS00017
--   employee     EMP + joining year + department type   EMP26FE00003
--   super admin  ADM + year + SA                        ADM26SA00001
create or replace function public.generate_staff_code(p_role text, p_department text default null,
                                                      p_employee_type text default null, p_join_year integer default null)
returns text
language sql
security definer
set search_path = public
as $$
  select public.generate_user_id(
    case p_role when 'teacher' then 'TCH' when 'super_admin' then 'ADM' else 'EMP' end,
    p_join_year,
    case p_role when 'teacher' then public.department_code(p_department)
                when 'super_admin' then 'SA'
                else public.employee_type_code(p_employee_type) end);
$$;

create or replace function public.generate_course_code(p_program text, p_branch text, p_semester integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := public.program_code(p_program) || p_semester::text || public.branch_code(p_program, p_branch);
  v_code   text;
begin
  loop
    v_code := v_prefix || lpad(public.next_sequence('CRS:' || v_prefix)::text, 3, '0');
    exit when not exists (select 1 from public.courses where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- PFX + YYYY + zero-padded sequence value, e.g. ref_number('RCP', 'receipt_no_seq', 7) → RCP20260000123
create or replace function public.ref_number(p_prefix text, p_sequence text, p_width integer default 6)
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select p_prefix || to_char(current_date, 'YYYY') || lpad(nextval(('public.' || p_sequence)::regclass)::text, p_width, '0');
$$;

-- Stable per student per session: the same ticket number every time it is printed.
create or replace function public.hall_ticket_number(p_college_id text, p_exam_type text, p_academic_year text default null)
returns text
language sql
stable
as $$
  select 'HT' || right(coalesce(p_academic_year, to_char(current_date, 'YYYY')), 2) || public.exam_session_code(p_exam_type) || upper(p_college_id);
$$;

-- ---------------------------------------------------------------------------
-- Notifications (set-based fan-out)
-- ---------------------------------------------------------------------------

-- Notify a list of users in one INSERT … SELECT; respects each user's preference.
create or replace function public.notify_users(
  p_user_ids uuid[], p_title text, p_message text, p_type text default 'info', p_link text default null, p_sender uuid default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.notifications (user_id, title, message, type, link, sender_id)
  select p.id, left(p_title, 200), coalesce(p_message, ''), coalesce(p_type, 'info'), p_link, p_sender
  from public.profiles p
  where p.id = any(p_user_ids) and p.notification_enabled;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Broadcast to every user with one of the roles (NULL/empty = everyone).
create or replace function public.broadcast_notification(
  p_roles text[], p_title text, p_message text, p_type text default 'info', p_link text default null, p_sender uuid default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Title is required';
  end if;
  insert into public.notifications (user_id, title, message, type, link, sender_id)
  select p.id, left(p_title, 200), coalesce(p_message, ''), coalesce(p_type, 'info'), p_link, p_sender
  from public.profiles p
  where p.notification_enabled
    and (p_roles is null or cardinality(p_roles) = 0 or p.role = any(p_roles))
    and p.id is distinct from p_sender;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Students / sections
-- ---------------------------------------------------------------------------

create or replace function public.get_section_student_counts()
returns table (program text, branch text, current_semester smallint, section text, student_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select s.program, s.branch, s.current_semester, s.section, count(*)
  from public.students s
  where s.status = 'Active'
  group by 1, 2, 3, 4;
$$;

create or replace function public.get_distinct_sections(p_program text, p_branch text)
returns table (section text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct s.section from public.students s
  where s.program = p_program and s.branch = p_branch and s.section is not null
  order by 1;
$$;

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------

create or replace function public.get_student_attendance_totals(p_student_id uuid)
returns table (total_classes bigint, present_classes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select count(*), count(*) filter (where status = 'Present')
  from public.attendance where student_id = p_student_id;
$$;

create or replace function public.get_student_monthly_attendance(p_student_id uuid, p_months integer default 12)
returns table (month_start date, month_label text, percentage numeric)
language sql
stable
security definer
set search_path = public
as $$
  select date_trunc('month', a.date)::date,
         to_char(date_trunc('month', a.date), 'Mon'),
         round(100.0 * count(*) filter (where a.status = 'Present') / count(*), 0)
  from public.attendance a
  where a.student_id = p_student_id
    and a.date >= (date_trunc('month', current_date) - make_interval(months => p_months - 1))::date
  group by 1, 2
  order by 1;
$$;

-- Per-student totals for one section (optionally one course and date window).
create or replace function public.get_section_attendance_summary(
  p_program text, p_branch text, p_semester integer, p_section text,
  p_course_id uuid default null, p_start date default null, p_end date default null
) returns table (student_id uuid, college_id text, full_name text, total_classes bigint, present_classes bigint)
language sql
stable
security definer
set search_path = public
as $$
  with cls as (
    select c.id from public.classes c
    where c.program = p_program and c.branch = p_branch and c.semester = p_semester
      and (p_section is null or c.section = p_section)
      and (p_course_id is null or c.course_id = p_course_id)
  ),
  agg as (
    select a.student_id,
           count(*) as total,
           count(*) filter (where a.status = 'Present') as present
    from public.attendance a
    where a.class_id in (select id from cls)
      and (p_start is null or a.date >= p_start)
      and (p_end is null or a.date <= p_end)
    group by a.student_id
  )
  select s.id, s.college_id, p.full_name, coalesce(agg.total, 0), coalesce(agg.present, 0)
  from public.students s
  join public.profiles p on p.id = s.profile_id
  left join agg on agg.student_id = s.id
  where s.program = p_program and s.branch = p_branch and s.current_semester = p_semester
    and (p_section is null or s.section = p_section)
    and s.status = 'Active'
  order by s.college_id;
$$;

-- Institution roll-up Program → Branch → Year → Section, from the per-session summary table.
create or replace function public.get_attendance_rollup()
returns table (program text, branch text, year smallint, section text, total_records bigint, present_records bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.program, c.branch, coalesce(c.year, ceil(c.semester / 2.0)::smallint), c.section,
         sum(s.student_count)::bigint, sum(s.present_count)::bigint
  from public.attendance_sessions s
  join public.classes c on c.id = s.class_id
  group by 1, 2, 3, 4;
$$;

create or replace function public.get_teacher_attendance_sessions(p_teacher_profile_id uuid, p_limit integer default 100)
returns table (class_id uuid, date date, period smallint, course_name text, course_code text,
               program text, branch text, section text, student_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select s.class_id, s.date, s.period, co.name, co.code, c.program, c.branch, c.section, s.student_count
  from public.attendance_sessions s
  join public.classes c  on c.id = s.class_id
  join public.courses co on co.id = c.course_id
  where s.teacher_id = p_teacher_profile_id
     or c.teacher_id = (select t.id from public.teachers t where t.profile_id = p_teacher_profile_id)
  order by s.date desc, s.period desc
  limit least(greatest(p_limit, 1), 1000);
$$;

-- ---------------------------------------------------------------------------
-- Marks
-- ---------------------------------------------------------------------------

-- Students in the teacher's classes whose final grade is not yet recorded.
create or replace function public.get_teacher_pending_marks(p_teacher_profile_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.classes c
  join public.teachers t on t.id = c.teacher_id and t.profile_id = p_teacher_profile_id
  join public.students s on s.program = c.program and s.branch = c.branch
                        and s.current_semester = c.semester and s.section = c.section
                        and s.status = 'Active'
  left join public.marks m on m.class_id = c.id and m.student_id = s.id
  where m.grade is null;
$$;

-- Institution-wide marks summary for the exam department dashboard.
create or replace function public.get_marks_overview()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'marks_entered', (select count(*) from public.marks where coalesce(ia1, ia2, other, see) is not null),
    'graded',        (select count(*) from public.marks where grade is not null),
    'failed',        (select count(*) from public.marks where grade = 'F'),
    'grade_distribution', coalesce((
      select jsonb_agg(jsonb_build_object('grade', grade, 'count', n) order by public.grade_point(grade) desc)
      from (select grade, count(*) as n from public.marks where grade is not null group by grade) g), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Backlogs
-- ---------------------------------------------------------------------------

create or replace function public.student_active_backlog_count(p_student_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$ select count(*)::int from public.backlogs where student_id = p_student_id and status = 'Active'; $$;

-- Record a re-examination: original internals (IA-1, IA-2, Others) are kept, the new SEE
-- replaces the old one. Pass → marks updated (the marks trigger clears the backlog and the
-- grade flows into GPA/CGPA). Fail → the subject's backlog count goes up by one.
create or replace function public.record_backlog_attempt(
  p_backlog_id uuid, p_see numeric, p_exam_label text default 'Supplementary',
  p_attempt_date date default null, p_recorded_by uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b      public.backlogs%rowtype;
  v_m      public.marks%rowtype;
  v_total  numeric;
  v_grade  text;
  v_passed boolean;
  v_no     text;
begin
  if p_see is null or p_see < 0 or p_see > 100 then
    return jsonb_build_object('success', false, 'error', 'SEE marks must be between 0 and 100.');
  end if;
  select * into v_b from public.backlogs where id = p_backlog_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Backlog not found.');
  end if;
  if v_b.status <> 'Active' then
    return jsonb_build_object('success', false, 'error', 'This backlog is already cleared.');
  end if;
  select * into v_m from public.marks where student_id = v_b.student_id and class_id = v_b.class_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Original marks record not found.');
  end if;

  v_total  := round(coalesce(v_m.ia1, 0) / 2 + coalesce(v_m.ia2, 0) / 2 + coalesce(v_m.other, 0) + p_see * 0.4);
  v_grade  := public.grade_for_total(v_total);
  v_passed := v_grade <> 'F';

  insert into public.backlog_attempts (backlog_id, exam_label, attempt_date, see, total, grade, passed, recorded_by)
  values (p_backlog_id, coalesce(nullif(trim(p_exam_label), ''), 'Supplementary'), coalesce(p_attempt_date, current_date),
          p_see, v_total, v_grade, v_passed, p_recorded_by)
  returning attempt_no into v_no;

  if v_passed then
    update public.backlogs set last_attempt_at = now() where id = p_backlog_id;
    -- Marks trigger recomputes total/grade and clears the backlog.
    update public.marks set see = p_see, updated_by = p_recorded_by where id = v_m.id;
  else
    update public.backlogs set fail_count = fail_count + 1, last_attempt_at = now() where id = p_backlog_id;
    insert into public.notifications (user_id, title, message, type, link)
    select s.profile_id, 'Re-exam result: ' || c.code,
           format('%s — total %s (grade F). This subject now has %s backlog attempt(s).', c.name, v_total, v_b.fail_count + 1),
           'alert', '/student/backlogs'
    from public.students s join public.courses c on c.id = v_b.course_id
    join public.profiles p on p.id = s.profile_id and p.notification_enabled
    where s.id = v_b.student_id;
  end if;

  return jsonb_build_object('success', true, 'attempt_no', v_no, 'total', v_total, 'grade', v_grade, 'passed', v_passed,
                            'fail_count', case when v_passed then v_b.fail_count else v_b.fail_count + 1 end);
end;
$$;

-- Overview for the exam department / admin backlog page.
create or replace function public.get_backlog_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'active_backlogs',       (select count(*) from public.backlogs where status = 'Active'),
    'students_with_backlogs', (select count(distinct student_id) from public.backlogs where status = 'Active'),
    'cleared_backlogs',      (select count(*) from public.backlogs where status = 'Cleared'),
    'total_failed_attempts', (select coalesce(sum(fail_count), 0) from public.backlogs),
    'top_subjects', coalesce((
      select jsonb_agg(jsonb_build_object('code', t.code, 'name', t.name, 'active', t.n) order by t.n desc)
      from (select c.code, c.name, count(*) as n
            from public.backlogs b join public.courses c on c.id = b.course_id
            where b.status = 'Active' group by c.code, c.name order by n desc limit 5) t), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Exams & eligibility
-- ---------------------------------------------------------------------------

-- Older signatures (upgrade path).
drop function if exists public.get_exam_eligibility(uuid, numeric);
drop function if exists public.get_student_exam_eligibility(uuid, numeric);
drop function if exists public.get_fee_amount(text, text, text);
drop function if exists public.record_fee_payment(uuid, text, text, numeric, text, text, date, uuid);

-- Hall-ticket rules for a session, falling back to institution defaults (75 % attendance, no fee rule).
create or replace function public.get_exam_session_rules(p_program text, p_branch text, p_semester integer, p_exam_type text)
returns table (min_attendance numeric, min_fee_paid_percent numeric, instructions text, controller_signature text)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(es.min_attendance, 75), coalesce(es.min_fee_paid_percent, 0), es.instructions, es.controller_signature
  from (select 1) dummy
  left join lateral (
    select * from public.exam_sessions s
    where s.program = p_program and s.branch = p_branch and s.semester = p_semester and s.exam_type = p_exam_type
    order by s.academic_year desc
    limit 1
  ) es on true;
$$;

-- Per-student eligibility facts, set-based for any list of students:
--  * attendance % over the classes of the student's CURRENT semester section,
--  * fee % paid for the CURRENT year of study (unbilled = no fee rule applies).
create or replace function public.student_eligibility_facts(p_student_ids uuid[])
returns table (student_id uuid, attendance_pct numeric, fee_paid_pct numeric, fee_balance numeric)
language sql
stable
security definer
set search_path = public
as $$
  with st as (
    select s.id, s.program, s.branch, s.current_semester, s.section, s.current_year
    from public.students s where s.id = any(p_student_ids)
  ),
  att as (
    select a.student_id, count(*) as total, count(*) filter (where a.status = 'Present') as present
    from public.attendance a
    join st on st.id = a.student_id
    join public.classes c on c.id = a.class_id
     and c.program = st.program and c.branch = st.branch and c.semester = st.current_semester
    group by a.student_id
  ),
  fee as (
    select f.student_id, sum(f.total_amount) as total, sum(f.paid_amount) as paid, sum(f.balance) as balance
    from public.fees f
    join st on st.id = f.student_id and f.study_year = st.current_year
    group by f.student_id
  )
  select st.id,
         case when coalesce(att.total, 0) = 0 then 0 else round(100.0 * att.present / att.total, 0) end,
         case when coalesce(fee.total, 0) = 0 then 100 else round(100.0 * fee.paid / fee.total, 0) end,
         coalesce(fee.balance, 0)
  from st
  left join att on att.student_id = st.id
  left join fee on fee.student_id = st.id;
$$;

-- Eligibility of every student sitting an exam, using that session's configured rules.
create or replace function public.get_exam_eligibility(p_exam_id uuid, p_min_attendance numeric default null)
returns table (student_id uuid, full_name text, college_id text, section text,
               attendance_pct numeric, fee_balance numeric, fee_paid_pct numeric,
               is_eligible boolean, reasons text[])
language sql
stable
security definer
set search_path = public
as $$
  with ex as (select program, branch, semester, exam_type from public.exams where id = p_exam_id),
  rules as (
    select coalesce(p_min_attendance, r.min_attendance) as min_att, r.min_fee_paid_percent as min_fee
    from ex, public.get_exam_session_rules(ex.program, ex.branch, ex.semester, ex.exam_type) r
  ),
  st as (
    select s.id, s.college_id, s.section, p.full_name
    from public.students s
    join public.profiles p on p.id = s.profile_id
    join ex on s.program = ex.program and s.branch = ex.branch and s.current_semester = ex.semester
    where s.status = 'Active'
  ),
  facts as (select * from public.student_eligibility_facts(array(select id from st)))
  select st.id, st.full_name, st.college_id, st.section,
         f.attendance_pct, f.fee_balance, f.fee_paid_pct,
         (f.attendance_pct >= rules.min_att and f.fee_paid_pct >= rules.min_fee),
         array_remove(array[
           case when f.attendance_pct < rules.min_att then format('Attendance %s%% below required %s%%', f.attendance_pct, rules.min_att) end,
           case when f.fee_paid_pct < rules.min_fee then format('Only %s%% of fees paid (required %s%%); balance ₹%s', f.fee_paid_pct, rules.min_fee, f.fee_balance) end
         ], null)
  from st
  join facts f on f.student_id = st.id
  cross join rules
  order by st.college_id;
$$;

-- One student's eligibility for a session (defaults to the nearest upcoming session of their semester).
drop function if exists public.get_student_exam_eligibility(uuid, text);
create or replace function public.get_student_exam_eligibility(p_student_id uuid, p_exam_type text default null)
returns table (exam_type text, attendance_pct numeric, fee_balance numeric, fee_paid_pct numeric,
               min_attendance numeric, min_fee_paid_percent numeric,
               instructions text, controller_signature text, is_eligible boolean, reasons text[],
               hall_ticket_no text)
language sql
stable
security definer
set search_path = public
as $$
  with s as (select * from public.students where id = p_student_id),
  sess as (
    select coalesce(p_exam_type, (
      select e.exam_type from public.exams e, s
      where e.program = s.program and e.branch = s.branch and e.semester = s.current_semester
        and e.status <> 'Cancelled' and (e.exam_date is null or e.exam_date >= current_date)
      order by e.exam_date nulls last limit 1)) as exam_type
  ),
  r as (select r.* from s, sess, public.get_exam_session_rules(s.program, s.branch, s.current_semester, sess.exam_type) r),
  f as (select * from public.student_eligibility_facts(array[p_student_id]))
  select sess.exam_type, f.attendance_pct, f.fee_balance, f.fee_paid_pct, r.min_attendance, r.min_fee_paid_percent,
         r.instructions, r.controller_signature,
         (f.attendance_pct >= r.min_attendance and f.fee_paid_pct >= r.min_fee_paid_percent),
         array_remove(array[
           case when f.attendance_pct < r.min_attendance then format('Attendance %s%% below required %s%%', f.attendance_pct, r.min_attendance) end,
           case when f.fee_paid_pct < r.min_fee_paid_percent then format('Only %s%% of fees paid (required %s%%)', f.fee_paid_pct, r.min_fee_paid_percent) end
         ], null),
         public.hall_ticket_number(s.college_id, sess.exam_type)
  from s, sess, r, f;
$$;

-- ---------------------------------------------------------------------------
-- Fees (billed per year of study)
-- ---------------------------------------------------------------------------

-- Configured amount: program-specific beats institution default; year-specific beats any-year.
create or replace function public.get_fee_amount(p_program text, p_fee_type text, p_study_year integer)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select amount from public.fee_structures
  where fee_type = p_fee_type
    and (program = p_program or program is null)
    and (study_year = p_study_year or study_year is null)
  order by (program is not null) desc, (study_year is not null) desc
  limit 1;
$$;

-- Create (idempotently) the fee demands every active student owes for their current year of study:
-- a college fee for everyone, a hostel fee for hostelers. Set-based; safe to run repeatedly.
create or replace function public.generate_fee_demands(p_student_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_term  uuid := public.ensure_current_term();
begin
  insert into public.fees (student_id, fee_type, study_year, total_amount, academic_term_id, due_date)
  select s.id, t.fee_type, s.current_year, amt.amount, v_term, (current_date + 30)
  from public.students s
  cross join (values ('college'), ('hostel')) t(fee_type)
  cross join lateral (select public.get_fee_amount(s.program, t.fee_type, s.current_year) as amount) amt
  where s.status = 'Active'
    and (p_student_ids is null or s.id = any(p_student_ids))
    and (t.fee_type = 'college' or s.is_hosteler)
    and amt.amount is not null and amt.amount > 0
  on conflict (student_id, fee_type, study_year) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Atomic payment: ensure + lock the fee row, reject overpayment, insert the payment.
-- The fee_payments trigger applies the amount, so totals can never drift.
create or replace function public.record_fee_payment(
  p_student_id uuid, p_fee_type text, p_study_year integer, p_amount numeric,
  p_method text default null, p_transaction_id text default null,
  p_payment_date date default null, p_recorded_by uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee     public.fees%rowtype;
  v_student public.students%rowtype;
  v_year    smallint;
  v_total   numeric;
  v_txn     text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if p_fee_type not in ('college', 'hostel') then
    raise exception 'Invalid fee type %', p_fee_type;
  end if;

  select * into v_student from public.students where id = p_student_id;
  if not found then
    raise exception 'Student not found';
  end if;
  v_year := coalesce(p_study_year, v_student.current_year);
  if v_year not between 1 and 6 then
    raise exception 'Year of study must be between 1 and 6';
  end if;

  v_total := coalesce(public.get_fee_amount(v_student.program, p_fee_type, v_year), 0);
  insert into public.fees (student_id, fee_type, study_year, total_amount, academic_term_id)
  values (p_student_id, p_fee_type, v_year, v_total, public.ensure_current_term())
  on conflict (student_id, fee_type, study_year) do nothing;

  select * into v_fee from public.fees
  where student_id = p_student_id and fee_type = p_fee_type and study_year = v_year
  for update;

  if v_fee.total_amount = 0 then
    raise exception 'No % fee amount is configured for % (year %). Add it to fee_structures first.',
      p_fee_type, coalesce(v_student.program, 'this program'), v_year;
  end if;
  if p_amount > v_fee.total_amount - v_fee.paid_amount then
    raise exception 'Payment of % exceeds the outstanding balance of %', p_amount, v_fee.total_amount - v_fee.paid_amount;
  end if;

  v_txn := coalesce(nullif(trim(p_transaction_id), ''),
                    upper(left(p_fee_type, 3)) || '-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 8));

  insert into public.fee_payments (fee_id, amount, payment_method, payment_date, transaction_id, recorded_by)
  values (v_fee.id, p_amount, p_method, coalesce(p_payment_date, current_date), v_txn, p_recorded_by);

  select * into v_fee from public.fees where id = v_fee.id;
  return jsonb_build_object(
    'success', true, 'fee_id', v_fee.id, 'transaction_id', v_txn, 'study_year', v_year,
    'total', v_fee.total_amount, 'paid', v_fee.paid_amount, 'balance', v_fee.balance, 'status', v_fee.status);
end;
$$;

-- ---------------------------------------------------------------------------
-- Hostel
-- ---------------------------------------------------------------------------

-- Locks the room row so concurrent allocations can never exceed capacity.
create or replace function public.allocate_hostel_room(p_room_id uuid, p_student_id uuid, p_allocated_by uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room   public.hostel_rooms%rowtype;
  v_status text;
begin
  select * into v_room from public.hostel_rooms where id = p_room_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Room not found.');
  end if;
  select h.status into v_status from public.hostels h where h.id = v_room.hostel_id;
  if v_status <> 'Operational' then
    return jsonb_build_object('success', false, 'error', 'This hostel is not accepting allocations.');
  end if;
  if v_room.occupied >= v_room.capacity then
    return jsonb_build_object('success', false, 'error', 'This room is already at full capacity.');
  end if;
  if exists (select 1 from public.hostel_allocations where student_id = p_student_id and status = 'Active') then
    return jsonb_build_object('success', false, 'error', 'Student is already allocated to a room. Remove them first.');
  end if;

  update public.students set is_hosteler = true where id = p_student_id and not is_hosteler;
  insert into public.hostel_allocations (room_id, student_id, status, allocated_by)
  values (p_room_id, p_student_id, 'Active', p_allocated_by);
  return jsonb_build_object('success', true);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'Student is already allocated to a room.');
  when foreign_key_violation then
    return jsonb_build_object('success', false, 'error', 'Student not found.');
end;
$$;

-- Students who can be given a bed in a hostel: hostelers, not graduated, no active
-- allocation anywhere, and the hostel's gender (Boys → Male, Girls → Female, Co-ed/Staff → any).
create or replace function public.get_allocatable_students(p_hostel_id uuid)
returns table (id uuid, college_id text, full_name text, program text, branch text, current_year smallint, gender text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.college_id, p.full_name, s.program, s.branch, s.current_year, s.gender
  from public.students s
  join public.profiles p on p.id = s.profile_id
  cross join (select type from public.hostels where id = p_hostel_id) h
  where s.is_hosteler and s.status = 'Active'
    and (h.type not in ('Boys', 'Girls') or s.gender = case h.type when 'Boys' then 'Male' else 'Female' end)
    and not exists (select 1 from public.hostel_allocations a where a.student_id = s.id and a.status = 'Active')
  order by s.college_id;
$$;

create or replace function public.get_unallocated_hosteler_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.students s
  where s.is_hosteler and s.status = 'Active'
    and not exists (select 1 from public.hostel_allocations a where a.student_id = s.id and a.status = 'Active');
$$;

-- ---------------------------------------------------------------------------
-- Library
-- ---------------------------------------------------------------------------

create or replace function public.issue_book(p_book_id uuid, p_borrower_id uuid, p_days integer default 14, p_issued_by uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book public.books%rowtype;
  v_open integer;
begin
  select * into v_book from public.books where id = p_book_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Book not found.');
  end if;
  if v_book.source = 'digital' then
    return jsonb_build_object('success', false, 'error', 'Digital books are read online and cannot be issued.');
  end if;
  if v_book.available_copies <= 0 then
    return jsonb_build_object('success', false, 'error', 'No copies are currently available.');
  end if;
  select count(*) into v_open from public.book_issues where borrower_id = p_borrower_id and status = 'Issued';
  if v_open >= 5 then
    return jsonb_build_object('success', false, 'error', 'Borrower already has the maximum of 5 books.');
  end if;
  if exists (select 1 from public.book_issues where borrower_id = p_borrower_id and status = 'Issued' and due_date < current_date) then
    return jsonb_build_object('success', false, 'error', 'Borrower has an overdue book. Collect it before issuing another.');
  end if;

  update public.books set available_copies = available_copies - 1 where id = p_book_id;
  insert into public.book_issues (book_id, borrower_id, issued_by, due_date)
  values (p_book_id, p_borrower_id, p_issued_by, current_date + greatest(1, least(coalesce(p_days, 14), 90)));
  return jsonb_build_object('success', true);
exception when unique_violation then
  return jsonb_build_object('success', false, 'error', 'This borrower already has a copy of this book.');
end;
$$;

-- Fine: ₹5 per overdue day.
create or replace function public.return_book(p_issue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue public.book_issues%rowtype;
  v_fine  numeric;
begin
  select * into v_issue from public.book_issues where id = p_issue_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Loan not found.');
  end if;
  if v_issue.status = 'Returned' then
    return jsonb_build_object('success', false, 'error', 'This book was already returned.');
  end if;
  v_fine := greatest(0, current_date - v_issue.due_date) * 5;
  update public.book_issues set status = 'Returned', returned_at = now(), fine_amount = v_fine where id = p_issue_id;
  update public.books set available_copies = least(total_copies, available_copies + 1) where id = v_issue.book_id;
  return jsonb_build_object('success', true, 'fine', v_fine);
end;
$$;

-- Change total copies while preserving copies currently on loan.
create or replace function public.set_book_total_copies(p_book_id uuid, p_total integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book    public.books%rowtype;
  v_on_loan integer;
begin
  if p_total is null or p_total < 0 then
    return jsonb_build_object('success', false, 'error', 'Total copies cannot be negative.');
  end if;
  select * into v_book from public.books where id = p_book_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Book not found.');
  end if;
  v_on_loan := v_book.total_copies - v_book.available_copies;
  if p_total < v_on_loan then
    return jsonb_build_object('success', false, 'error', format('%s copies are on loan; total cannot be lower than that.', v_on_loan));
  end if;
  update public.books set total_copies = p_total, available_copies = p_total - v_on_loan where id = p_book_id;
  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Placements
-- ---------------------------------------------------------------------------

create or replace function public.apply_to_opportunity(p_student_id uuid, p_opportunity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opp  public.placement_opportunities%rowtype;
  v_cgpa   numeric;
  v_status text;
begin
  select * into v_opp from public.placement_opportunities where id = p_opportunity_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Opportunity not found.');
  end if;
  if v_opp.status <> 'Open' then
    return jsonb_build_object('success', false, 'error', 'Applications for this opportunity are closed.');
  end if;
  if v_opp.deadline is not null and v_opp.deadline < current_date then
    return jsonb_build_object('success', false, 'error', 'The application deadline has passed.');
  end if;
  select status into v_status from public.students where id = p_student_id;
  if v_status = 'Graduated' then
    return jsonb_build_object('success', false, 'error', 'Graduated students cannot apply.');
  elsif v_status is distinct from 'Active' then
    return jsonb_build_object('success', false, 'error', format('Only active students can apply (your status: %s).', coalesce(v_status, 'unknown')));
  end if;
  if v_opp.eligibility_cgpa is not null and v_opp.eligibility_cgpa > 0 then
    v_cgpa := public.student_cgpa(p_student_id);
    if v_cgpa is not null and v_cgpa < v_opp.eligibility_cgpa then
      return jsonb_build_object('success', false, 'error', format('Minimum CGPA %s required (yours: %s).', v_opp.eligibility_cgpa, v_cgpa));
    end if;
  end if;

  insert into public.placement_applications (student_id, opportunity_id) values (p_student_id, p_opportunity_id);
  return jsonb_build_object('success', true);
exception when unique_violation then
  return jsonb_build_object('success', false, 'error', 'You have already applied.');
end;
$$;

-- ---------------------------------------------------------------------------
-- Timetable
-- ---------------------------------------------------------------------------

-- Replace a section's weekly grid atomically and refuse teacher double-booking.
create or replace function public.replace_section_timetable(p_class_ids uuid[], p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clash record;
begin
  delete from public.timetables where class_id = any(p_class_ids);

  insert into public.timetables (class_id, day_of_week, start_time, end_time, room)
  select (r->>'class_id')::uuid, r->>'day_of_week', (r->>'start_time')::time, (r->>'end_time')::time, nullif(r->>'room', '')
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  where (r->>'class_id')::uuid = any(p_class_ids);

  -- Same teacher, same day, overlapping time in a different class → reject (rolls back everything).
  select t1.day_of_week, t1.start_time, pr.full_name into v_clash
  from public.timetables t1
  join public.classes c1 on c1.id = t1.class_id
  join public.timetables t2 on t2.day_of_week = t1.day_of_week and t2.id <> t1.id
                           and t2.start_time < t1.end_time and t1.start_time < t2.end_time
  join public.classes c2 on c2.id = t2.class_id and c2.teacher_id = c1.teacher_id
  join public.teachers te on te.id = c1.teacher_id
  join public.profiles pr on pr.id = te.profile_id
  where t1.class_id = any(p_class_ids) and c1.teacher_id is not null
  limit 1;

  if found then
    raise exception 'Teacher % is already teaching another class on % at %', v_clash.full_name, v_clash.day_of_week, v_clash.start_time;
  end if;

  -- Tell the section's students and the teachers involved that the weekly timetable changed.
  insert into public.notifications (user_id, title, message, type, link)
  select distinct u.user_id, 'Timetable updated',
         format('The weekly timetable for %s %s semester %s section %s has changed.', c.program, c.branch, c.semester, c.section),
         'info', null
  from (select * from public.classes where id = any(p_class_ids) limit 1) c
  cross join lateral (
    select s.profile_id as user_id from public.students s
    where s.program = c.program and s.branch = c.branch and s.current_semester = c.semester and s.section = c.section and s.status = 'Active'
    union
    select t.profile_id from public.classes c2 join public.teachers t on t.id = c2.teacher_id where c2.id = any(p_class_ids)
  ) u
  join public.profiles p on p.id = u.user_id and p.notification_enabled;

  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Promotion
-- ---------------------------------------------------------------------------

-- Promote one student: blocked while any course of the current semester is failed or ungraded.
create or replace function public.promote_student(p_student_id uuid, p_promoted_by uuid, p_academic_year text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s       public.students%rowtype;
  v_max     smallint;
  v_pending text[];
  v_next    smallint;
begin
  select * into v_s from public.students where id = p_student_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Student not found.');
  end if;
  if v_s.is_graduated then
    return jsonb_build_object('success', false, 'error', 'Student has already graduated.');
  end if;
  if v_s.status <> 'Active' then
    return jsonb_build_object('success', false, 'error', format('Student is not active (status: %s).', v_s.status));
  end if;

  -- Ungraded courses block promotion; FAILED courses do not — they are carried forward as backlogs.
  select array_agg(co.code order by co.code) into v_pending
  from public.classes c
  join public.courses co on co.id = c.course_id
  left join public.marks m on m.class_id = c.id and m.student_id = v_s.id
  where c.program = v_s.program and c.branch = v_s.branch
    and c.semester = v_s.current_semester and c.section = v_s.section
    and m.grade is null;

  if v_pending is not null then
    return jsonb_build_object('success', false,
      'error', 'Cannot promote: some current-semester courses are not graded yet.',
      'courses', to_jsonb(v_pending));
  end if;

  v_max := public.program_max_semesters(v_s.program);
  if v_s.current_semester >= v_max and public.student_active_backlog_count(v_s.id) > 0 then
    select array_agg(co.code order by co.code) into v_pending
    from public.backlogs b join public.courses co on co.id = b.course_id
    where b.student_id = v_s.id and b.status = 'Active';
    return jsonb_build_object('success', false,
      'error', 'Cannot graduate: active backlogs must be cleared first.',
      'courses', to_jsonb(v_pending));
  end if;
  if v_s.current_semester >= v_max then
    update public.students set is_graduated = true where id = v_s.id;
    insert into public.promotions (student_id, from_semester, to_semester, graduated, academic_year, promoted_by)
    values (v_s.id, v_s.current_semester, null, true, p_academic_year, p_promoted_by);
    perform public.notify_users(array[v_s.profile_id], 'Congratulations, you have graduated!',
      'Your programme is complete. Best wishes for the road ahead.', 'event', '/student/marks');
    return jsonb_build_object('success', true, 'graduated', true, 'from_semester', v_s.current_semester);
  end if;

  v_next := v_s.current_semester + 1;
  update public.students
     set current_semester = v_next, current_year = ceil(v_next / 2.0)::smallint
   where id = v_s.id;
  insert into public.promotions (student_id, from_semester, to_semester, academic_year, promoted_by)
  values (v_s.id, v_s.current_semester, v_next, p_academic_year, p_promoted_by);
  perform public.notify_users(array[v_s.profile_id], 'Promoted to semester ' || v_next,
    'You have been promoted. Check your new timetable and courses.', 'event', '/student/dashboard');
  return jsonb_build_object('success', true, 'from_semester', v_s.current_semester, 'to_semester', v_next);
end;
$$;

-- Batch promotion in one call; each student is isolated in its own sub-transaction.
create or replace function public.promote_students(p_student_ids uuid[], p_promoted_by uuid, p_academic_year text)
returns table (student_id uuid, success boolean, error text, courses jsonb, to_semester smallint, graduated boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_res jsonb;
begin
  foreach v_id in array p_student_ids loop
    begin
      v_res := public.promote_student(v_id, p_promoted_by, p_academic_year);
    exception when others then
      v_res := jsonb_build_object('success', false, 'error', sqlerrm);
    end;
    student_id  := v_id;
    success     := coalesce((v_res->>'success')::boolean, false);
    error       := v_res->>'error';
    courses     := v_res->'courses';
    to_semester := (v_res->>'to_semester')::smallint;
    graduated   := coalesce((v_res->>'graduated')::boolean, false);
    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Classroom
-- ---------------------------------------------------------------------------

create or replace function public.join_classroom(p_invite_code text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room uuid;
  v_rows integer;
begin
  select id into v_room from public.classrooms where invite_code = upper(trim(p_invite_code));
  if v_room is null then
    return jsonb_build_object('success', false, 'error', 'Invalid invite code.');
  end if;
  insert into public.classroom_members (classroom_id, user_id, role)
  values (v_room, p_user_id, 'student')
  on conflict (classroom_id, user_id) do nothing;
  get diagnostics v_rows = row_count;
  return jsonb_build_object('success', true, 'classroom_id', v_room, 'already_member', v_rows = 0);
end;
$$;

-- Used by RLS policies (must be executable by `authenticated`).
create or replace function public.is_classroom_member(p_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.classroom_members m
                 where m.classroom_id = p_classroom_id and m.user_id = auth.uid());
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid(); $$;

-- ---------------------------------------------------------------------------
-- Dashboards (cached for 60 s to absorb refresh storms)
-- ---------------------------------------------------------------------------

create or replace function public.get_admin_dashboard_stats(p_max_age_seconds integer default 60)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  select payload into v_payload from public.dashboard_cache
  where key = 'admin' and computed_at > now() - make_interval(secs => p_max_age_seconds);
  if v_payload is not null then
    return v_payload;
  end if;

  select jsonb_build_object(
    'total_students',    (select count(*) from public.students where status = 'Active'),
    'total_teachers',    (select count(*) from public.teachers where status = 'Active'),
    'total_programs',    (select count(distinct program) from public.courses),
    'pending_approvals', (select count(*) from public.students where program is null or branch is null),
    'collection_rate',   (select coalesce(round(100.0 * sum(paid_amount) / nullif(sum(total_amount), 0)), 0) from public.fees),
    'attendance_trend',  coalesce((
        select jsonb_agg(jsonb_build_object('month', to_char(m, 'Mon'), 'attendance', pct) order by m)
        from (
          select date_trunc('month', date) as m,
                 round(100.0 * sum(present_count) / nullif(sum(student_count), 0)) as pct
          from public.attendance_sessions
          where date >= (date_trunc('month', current_date) - interval '5 months')
          group by 1
        ) t), '[]'::jsonb),
    'recent_logins', coalesce((
        select jsonb_agg(jsonb_build_object('id', l.id, 'full_name', p.full_name, 'role', coalesce(l.role, p.role), 'created_at', l.created_at)
                         order by l.created_at desc)
        from (select * from public.login_events order by created_at desc limit 5) l
        join public.profiles p on p.id = l.user_id), '[]'::jsonb),
    'recent_users', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'full_name', full_name, 'role', role, 'created_at', created_at))
        from (select id, full_name, role, created_at from public.profiles order by created_at desc limit 5) r), '[]'::jsonb),
    'student_distribution', coalesce((
        select jsonb_agg(jsonb_build_object('branch', branch, 'count', n) order by n desc)
        from (select branch, count(*) as n from public.students
              where branch is not null and status = 'Active' group by branch) d), '[]'::jsonb)
  ) into v_payload;

  insert into public.dashboard_cache (key, payload, computed_at) values ('admin', v_payload, now())
  on conflict (key) do update set payload = excluded.payload, computed_at = excluded.computed_at;
  return v_payload;
end;
$$;

create or replace function public.get_employee_dashboard_stats(p_employee_type text, p_max_age_seconds integer default 60)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key     text := 'emp:' || p_employee_type;
  v_payload jsonb;
begin
  select payload into v_payload from public.dashboard_cache
  where key = v_key and computed_at > now() - make_interval(secs => p_max_age_seconds);
  if v_payload is not null then
    return v_payload;
  end if;

  if p_employee_type = 'fee_management' then
    select jsonb_build_object(
      'total_fees', coalesce(sum(total_amount), 0),
      'collected_fees', coalesce(sum(paid_amount), 0),
      'pending_fees', coalesce(sum(balance), 0),
      'collection_rate', coalesce(round(100.0 * sum(paid_amount) / nullif(sum(total_amount), 0)), 0))
    into v_payload from public.fees;
  elsif p_employee_type = 'hostel_management' then
    select jsonb_build_object(
      'total_rooms', count(*),
      'occupied_beds', coalesce(sum(occupied), 0),
      'available_beds', coalesce(sum(capacity - occupied), 0),
      'hostel_students', coalesce(sum(occupied), 0))
    into v_payload from public.hostel_rooms;
  elsif p_employee_type = 'exam_marks_management' then
    select jsonb_build_object(
      'total_exams', (select count(*) from public.exams),
      'scheduled_exams', (select count(*) from public.exams where status = 'Scheduled'),
      'total_classes', (select count(*) from public.classes),
      'total_courses', (select count(*) from public.courses),
      'marks_entered', (select count(*) from public.marks where grade is not null))
    into v_payload;
  elsif p_employee_type = 'library_management' then
    select jsonb_build_object(
      'total_books', coalesce(sum(total_copies), 0),
      'available_books', coalesce(sum(available_copies), 0),
      'issued_books', coalesce(sum(total_copies - available_copies), 0))
    into v_payload from public.books;
  else
    v_payload := '{}'::jsonb;
  end if;

  insert into public.dashboard_cache (key, payload, computed_at) values (v_key, v_payload, now())
  on conflict (key) do update set payload = excluded.payload, computed_at = excluded.computed_at;
  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled maintenance (run daily — see 05_seed.sql for the pg_cron job)
-- ---------------------------------------------------------------------------

create or replace function public.run_daily_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed     integer;
  v_completed  integer;
  v_demands    integer;
  v_overdue    integer;
  v_due_soon   integer;
  v_hw_due     integer;
  v_drive_due  integer;
  v_feedue     integer := 0;
  v_lowatt     integer := 0;
  v_purged     integer;
begin
  -- 1. Close placement drives whose deadline has passed.
  update public.placement_opportunities set status = 'Closed'
  where status = 'Open' and deadline < current_date;
  get diagnostics v_closed = row_count;

  -- 2. Exams whose date has passed are Completed.
  update public.exams set status = 'Completed'
  where status = 'Scheduled' and exam_date < current_date;
  get diagnostics v_completed = row_count;

  -- 3. Bill any missing fee demands for the current year of study (idempotent).
  v_demands := public.generate_fee_demands(null);

  -- 4. Library: overdue since yesterday, and due tomorrow.
  insert into public.notifications (user_id, title, message, type)
  select i.borrower_id, 'Library book overdue',
         format('"%s" was due on %s. A fine of ₹5/day applies until it is returned.', b.title, i.due_date), 'alert'
  from public.book_issues i
  join public.books b on b.id = i.book_id
  join public.profiles p on p.id = i.borrower_id and p.notification_enabled
  where i.status = 'Issued' and i.due_date = current_date - 1;
  get diagnostics v_overdue = row_count;

  insert into public.notifications (user_id, title, message, type)
  select i.borrower_id, 'Library book due tomorrow', format('Please return "%s" by %s to avoid a fine.', b.title, i.due_date), 'info'
  from public.book_issues i
  join public.books b on b.id = i.book_id
  join public.profiles p on p.id = i.borrower_id and p.notification_enabled
  where i.status = 'Issued' and i.due_date = current_date + 1;
  get diagnostics v_due_soon = row_count;

  -- 5. Classroom assignments due within 24 h that the student has not submitted.
  insert into public.notifications (user_id, title, message, type, link)
  select m.user_id, 'Assignment due soon: ' || left(a.title, 150),
         format('Due %s in %s.', to_char(a.due_date, 'DD Mon HH24:MI'), c.name), 'task', '/classrooms/' || a.classroom_id
  from public.classroom_assignments a
  join public.classrooms c on c.id = a.classroom_id
  join public.classroom_members m on m.classroom_id = a.classroom_id and m.role = 'student'
  join public.profiles p on p.id = m.user_id and p.notification_enabled
  where a.due_date >= now() and a.due_date < now() + interval '24 hours'
    and not exists (select 1 from public.classroom_submissions sb where sb.assignment_id = a.id and sb.student_id = m.user_id);
  get diagnostics v_hw_due = row_count;

  -- 6. Placement drives closing in 2 days: remind active students who have not applied.
  insert into public.notifications (user_id, title, message, type, link)
  select s.profile_id, format('Last 2 days to apply: %s', o.company_name),
         format('%s — applications close on %s.', o.role_title, to_char(o.deadline, 'DD Mon YYYY')), 'event', '/student/opportunities'
  from public.placement_opportunities o
  join public.students s on s.status = 'Active'
  join public.profiles p on p.id = s.profile_id and p.notification_enabled
  where o.status = 'Open' and o.deadline = current_date + 2
    and not exists (select 1 from public.placement_applications pa where pa.opportunity_id = o.id and pa.student_id = s.id);
  get diagnostics v_drive_due = row_count;

  -- 7. Weekly (Mondays): fee dues and low-attendance alerts.
  if extract(isodow from current_date) = 1 then
    insert into public.notifications (user_id, title, message, type, link)
    select s.profile_id, 'Fee payment pending',
           format('You have an outstanding %s fee balance of ₹%s for year %s.', f.fee_type, f.balance, f.study_year), 'alert', '/student/fees'
    from public.fees f
    join public.students s on s.id = f.student_id and s.status = 'Active'
    join public.profiles p on p.id = s.profile_id and p.notification_enabled
    where f.balance > 0 and (f.due_date is null or f.due_date <= current_date + 14);
    get diagnostics v_feedue = row_count;

    insert into public.notifications (user_id, title, message, type, link)
    select s.profile_id, 'Low attendance warning',
           format('Your attendance this semester is %s%%. Check the minimum required to sit exams.', f.attendance_pct), 'alert', '/student/attendance'
    from public.students s
    join public.profiles p on p.id = s.profile_id and p.notification_enabled
    join public.student_eligibility_facts(array(select id from public.students where status = 'Active')) f on f.student_id = s.id
    where s.status = 'Active' and f.attendance_pct < 75
      and (select count(*) from public.attendance a where a.student_id = s.id and a.date >= current_date - 120) >= 10;
    get diagnostics v_lowatt = row_count;
  end if;

  -- 8. Housekeeping.
  delete from public.notifications where is_read and created_at < now() - interval '180 days';
  get diagnostics v_purged = row_count;
  delete from public.login_events where created_at < now() - interval '180 days';
  delete from public.rate_limits where window_start < now() - interval '1 day';
  delete from public.dashboard_cache where computed_at < now() - interval '1 day';

  return jsonb_build_object(
    'closed_opportunities', v_closed, 'completed_exams', v_completed, 'fee_demands_created', v_demands,
    'overdue_reminders', v_overdue, 'due_tomorrow_reminders', v_due_soon, 'assignment_reminders', v_hw_due,
    'drive_deadline_reminders', v_drive_due, 'fee_reminders', v_feedue, 'low_attendance_alerts', v_lowatt,
    'purged_notifications', v_purged);
end;
$$;
