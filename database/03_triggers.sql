-- =============================================================================
-- EduERP — 03_triggers.sql
-- Derived data, integrity and event notifications.
--
-- High-volume events (marks upload, attendance, exam publishing, assignment
-- creation) use STATEMENT-level triggers with transition tables: one bulk
-- operation for 5,000 students runs the trigger body once, set-based, instead
-- of 5,000 times.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'students', 'teachers', 'employees', 'courses', 'classrooms', 'classes',
    'attendance', 'marks', 'exams', 'exam_marks', 'fees', 'hostels', 'hostel_complaints',
    'hostel_menu', 'books', 'placement_opportunities', 'placement_applications', 'classroom_submissions', 'exam_sessions', 'resumes', 'backlogs'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.tg_set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity: normalisation + mirror role into the JWT (app_metadata)
-- ---------------------------------------------------------------------------

create or replace function public.tg_profiles_normalize()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(new.email));
  new.id_code := nullif(upper(trim(new.id_code)), '');
  if coalesce(new.full_name, '') = '' then
    new.full_name := trim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, ''));
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_normalize on public.profiles;
create trigger profiles_normalize before insert or update of email, id_code, full_name, first_name, last_name
  on public.profiles for each row execute function public.tg_profiles_normalize();

create or replace function public.tg_students_normalize()
returns trigger
language plpgsql
as $$
begin
  new.college_id := upper(trim(new.college_id));
  new.section := upper(coalesce(nullif(trim(new.section), ''), 'A'));
  return new;
end;
$$;
-- status and is_graduated always agree (either may be written).
create or replace function public.tg_students_status_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.is_graduated is distinct from old.is_graduated and new.status is not distinct from old.status then
    new.status := case when new.is_graduated then 'Graduated' else 'Active' end;
  end if;
  new.is_graduated := (new.status = 'Graduated');
  return new;
end;
$$;
drop trigger if exists students_status_sync on public.students;
create trigger students_status_sync before insert or update of status, is_graduated on public.students
  for each row execute function public.tg_students_status_sync();

drop trigger if exists students_normalize on public.students;
create trigger students_normalize before insert or update of college_id, section
  on public.students for each row execute function public.tg_students_normalize();

-- Middleware reads role/employee_type from the JWT instead of querying per request.
create or replace function public.sync_auth_claims(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role text;
  v_type text;
begin
  select role into v_role from public.profiles where id = p_user_id;
  select employee_type into v_type from public.employees where profile_id = p_user_id;
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', v_role, 'employee_type', v_type)
   where id = p_user_id;
end;
$$;

create or replace function public.tg_sync_auth_claims()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- profiles rows carry the user id in "id"; employees rows in "profile_id".
  perform public.sync_auth_claims(coalesce((to_jsonb(new)->>'profile_id')::uuid, (to_jsonb(new)->>'id')::uuid));
  return new;
end;
$$;
drop trigger if exists profiles_sync_claims on public.profiles;
create trigger profiles_sync_claims after insert or update of role on public.profiles
  for each row execute function public.tg_sync_auth_claims();
drop trigger if exists employees_sync_claims on public.employees;
create trigger employees_sync_claims after insert or update of employee_type on public.employees
  for each row execute function public.tg_sync_auth_claims();

-- ---------------------------------------------------------------------------
-- Marks: authoritative total/grade + result notifications
-- ---------------------------------------------------------------------------

create or replace function public.tg_marks_compute()
returns trigger
language plpgsql
as $$
begin
  if new.ia1 is null and new.ia2 is null and new.other is null and new.see is null then
    new.total := null;
  else
    new.total := round(coalesce(new.ia1, 0) / 2 + coalesce(new.ia2, 0) / 2 + coalesce(new.other, 0) + coalesce(new.see, 0) * 0.4);
  end if;
  -- A grade is final only when every component (incl. SEE) is present.
  if new.ia1 is not null and new.ia2 is not null and new.other is not null and new.see is not null then
    new.grade := public.grade_for_total(new.total);
  else
    new.grade := null;
  end if;
  return new;
end;
$$;
drop trigger if exists marks_compute on public.marks;
create trigger marks_compute before insert or update on public.marks
  for each row execute function public.tg_marks_compute();

-- Notify each student once when a grade is first published or changes (set-based).
create or replace function public.tg_marks_notify_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, message, type, link)
  select s.profile_id, 'Result published: ' || co.code,
         format('%s — total %s, grade %s.', co.name, n.total, n.grade), 'event', '/student/marks'
  from new_rows n
  join public.students s on s.id = n.student_id
  join public.profiles p on p.id = s.profile_id and p.notification_enabled
  join public.classes c  on c.id = n.class_id
  join public.courses co on co.id = c.course_id
  where n.grade is not null;
  return null;
end;
$$;

create or replace function public.tg_marks_notify_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, message, type, link)
  select s.profile_id,
         case when o.grade is null then 'Result published: ' else 'Result updated: ' end || co.code,
         format('%s — total %s, grade %s.', co.name, n.total, n.grade), 'event', '/student/marks'
  from new_rows n
  join old_rows o on o.id = n.id
  join public.students s on s.id = n.student_id
  join public.profiles p on p.id = s.profile_id and p.notification_enabled
  join public.classes c  on c.id = n.class_id
  join public.courses co on co.id = c.course_id
  where n.grade is not null and n.grade is distinct from o.grade;
  return null;
end;
$$;
drop trigger if exists marks_notify_insert on public.marks;
create trigger marks_notify_insert after insert on public.marks
  referencing new table as new_rows for each statement execute function public.tg_marks_notify_insert();
drop trigger if exists marks_notify_update on public.marks;
create trigger marks_notify_update after update on public.marks
  referencing old table as old_rows new table as new_rows for each statement execute function public.tg_marks_notify_update();

-- ---------------------------------------------------------------------------
-- Attendance: maintain attendance_sessions (per period totals)
-- ---------------------------------------------------------------------------

create or replace function public.refresh_attendance_sessions(p_keys jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  with k as (
    select distinct (x->>'class_id')::uuid as class_id, (x->>'date')::date as date, (x->>'period')::smallint as period
    from jsonb_array_elements(p_keys) x
  ),
  agg as (
    select a.class_id, a.date, a.period,
           (array_agg(a.teacher_id order by a.updated_at desc))[1] as teacher_id,
           count(*) as n, count(*) filter (where a.status = 'Present') as present
    from public.attendance a
    join k on k.class_id = a.class_id and k.date = a.date and k.period = a.period
    group by 1, 2, 3
  ),
  upsert as (
    insert into public.attendance_sessions (class_id, date, period, teacher_id, student_count, present_count)
    select class_id, date, period, teacher_id, n, present from agg
    on conflict (class_id, date, period) do update
      set teacher_id = excluded.teacher_id, student_count = excluded.student_count, present_count = excluded.present_count
    returning class_id, date, period
  )
  delete from public.attendance_sessions s
  using k
  where s.class_id = k.class_id and s.date = k.date and s.period = k.period
    and not exists (select 1 from agg where agg.class_id = k.class_id and agg.date = k.date and agg.period = k.period);
$$;

create or replace function public.tg_attendance_sessions_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_attendance_sessions(
    (select coalesce(jsonb_agg(distinct jsonb_build_object('class_id', class_id, 'date', date, 'period', period)), '[]') from new_rows));
  return null;
end;
$$;

create or replace function public.tg_attendance_sessions_old()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_attendance_sessions(
    (select coalesce(jsonb_agg(distinct jsonb_build_object('class_id', class_id, 'date', date, 'period', period)), '[]') from old_rows));
  return null;
end;
$$;

drop trigger if exists attendance_sessions_ins on public.attendance;
create trigger attendance_sessions_ins after insert on public.attendance
  referencing new table as new_rows for each statement execute function public.tg_attendance_sessions_new();
drop trigger if exists attendance_sessions_upd on public.attendance;
create trigger attendance_sessions_upd after update on public.attendance
  referencing new table as new_rows for each statement execute function public.tg_attendance_sessions_new();
drop trigger if exists attendance_sessions_del on public.attendance;
create trigger attendance_sessions_del after delete on public.attendance
  referencing old table as old_rows for each statement execute function public.tg_attendance_sessions_old();

-- Attendance may not be recorded for future dates.
create or replace function public.tg_attendance_guard()
returns trigger
language plpgsql
as $$
begin
  if new.date > current_date then
    raise exception 'Attendance cannot be recorded for a future date (%).', new.date;
  end if;
  return new;
end;
$$;
drop trigger if exists attendance_guard on public.attendance;
create trigger attendance_guard before insert or update of date on public.attendance
  for each row execute function public.tg_attendance_guard();

-- ---------------------------------------------------------------------------
-- Exams: notify affected students once per published session
-- ---------------------------------------------------------------------------

create or replace function public.tg_exams_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, message, type, link)
  select s.profile_id, 'Exam schedule published: ' || x.exam_type,
         format('%s exam(s) scheduled from %s. Check the timetable and download your hall ticket.',
                x.n, coalesce(to_char(x.first_date, 'DD Mon YYYY'), 'TBA')),
         'event', '/student/exams'
  from (
    select program, branch, semester, exam_type, count(*) as n, min(exam_date) as first_date
    from new_rows where status = 'Scheduled'
    group by 1, 2, 3, 4
  ) x
  join public.students s on s.program = x.program and s.branch = x.branch
                        and s.current_semester = x.semester and s.status = 'Active'
  join public.profiles p on p.id = s.profile_id and p.notification_enabled;
  return null;
end;
$$;
drop trigger if exists exams_notify on public.exams;
create trigger exams_notify after insert on public.exams
  referencing new table as new_rows for each statement execute function public.tg_exams_notify();

-- Rescheduled / cancelled exams: one notice per affected section and session.
create or replace function public.tg_exams_changed_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, message, type, link)
  select s.profile_id,
         case when x.cancelled then 'Exam cancelled: ' else 'Exam schedule changed: ' end || x.exam_type,
         format('%s exam(s) were %s. Check the latest timetable.', x.n, case when x.cancelled then 'cancelled' else 'rescheduled' end),
         'alert', '/student/exams'
  from (
    select n.program, n.branch, n.semester, n.exam_type, bool_or(n.status = 'Cancelled') as cancelled, count(*) as n
    from new_rows n join old_rows o on o.id = n.id
    where (n.exam_date, n.start_time, n.end_time, n.room) is distinct from (o.exam_date, o.start_time, o.end_time, o.room)
       or (n.status = 'Cancelled' and o.status <> 'Cancelled')
    group by 1, 2, 3, 4
  ) x
  join public.students s on s.program = x.program and s.branch = x.branch and s.current_semester = x.semester and s.status = 'Active'
  join public.profiles p on p.id = s.profile_id and p.notification_enabled;
  return null;
end;
$$;
drop trigger if exists exams_changed_notify on public.exams;
create trigger exams_changed_notify after update on public.exams
  referencing old table as old_rows new table as new_rows for each statement execute function public.tg_exams_changed_notify();

-- Teacher assigned to a class.
create or replace function public.tg_class_teacher_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.teacher_id is not null and (tg_op = 'INSERT' or new.teacher_id is distinct from old.teacher_id) then
    insert into public.notifications (user_id, title, message, type, link)
    select t.profile_id, 'New class assigned: ' || co.code,
           format('You are teaching %s to %s %s semester %s section %s.', co.name, new.program, new.branch, new.semester, new.section),
           'task', '/teacher/dashboard'
    from public.teachers t
    join public.profiles p on p.id = t.profile_id and p.notification_enabled
    join public.courses co on co.id = new.course_id
    where t.id = new.teacher_id;
  end if;
  return null;
end;
$$;
drop trigger if exists class_teacher_notify on public.classes;
create trigger class_teacher_notify after insert or update of teacher_id on public.classes
  for each row execute function public.tg_class_teacher_notify();

-- New hostel complaint → hostel department staff.
create or replace function public.tg_complaint_created_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, message, type, link)
  select e.profile_id, 'New hostel complaint: ' || h.name,
         format('Room %s: %s', coalesce(r.room_number, 'N/A'), left(new.description, 120)), 'task',
         '/employee/hostel/' || new.hostel_id
  from public.employees e
  join public.profiles p on p.id = e.profile_id and p.notification_enabled
  join public.hostels h on h.id = new.hostel_id
  left join public.hostel_rooms r on r.id = new.hostel_room_id
  where e.employee_type = 'hostel_management';
  return null;
end;
$$;
drop trigger if exists complaint_created_notify on public.hostel_complaints;
create trigger complaint_created_notify after insert on public.hostel_complaints
  for each row execute function public.tg_complaint_created_notify();

-- New students: welcome note, fee demands, and an alert to admins when a
-- self-registered account still needs its program/branch completed.
create or replace function public.tg_students_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.generate_fee_demands(array(select id from new_rows));

  insert into public.notifications (user_id, title, message, type, link)
  select n.profile_id, 'Welcome to EduERP', format('Your student ID is %s.', n.college_id), 'info', '/student/dashboard'
  from new_rows n join public.profiles p on p.id = n.profile_id and p.notification_enabled;

  insert into public.notifications (user_id, title, message, type, link)
  select a.id, 'Student registrations awaiting approval',
         format('%s new self-registered student(s) are waiting for approval. Set their status to Active once verified.', x.n), 'task', '/admin/students'
  from (select count(*) as n from new_rows where status = 'Pending Approval' or program is null or branch is null) x
  join public.profiles a on a.notification_enabled
   and (a.role = 'super_admin'
        or exists (select 1 from public.employees e where e.profile_id = a.id and e.employee_type = 'student_staff_management'))
  where x.n > 0;
  return null;
end;
$$;
drop trigger if exists students_created on public.students;
create trigger students_created after insert on public.students
  referencing new table as new_rows for each statement execute function public.tg_students_created();

-- Year-of-study change (promotion) or becoming a hosteler → bill the new year's demands.
create or replace function public.tg_students_rebill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  select array_agg(n.id) into v_ids
  from new_rows n join old_rows o on o.id = n.id
  where n.current_year <> o.current_year or (n.is_hosteler and not o.is_hosteler)
     or (n.program is distinct from o.program);
  if v_ids is not null then
    perform public.generate_fee_demands(v_ids);
  end if;
  return null;
end;
$$;
drop trigger if exists students_rebill on public.students;
create trigger students_rebill after update on public.students
  referencing old table as old_rows new table as new_rows for each statement execute function public.tg_students_rebill();

-- ---------------------------------------------------------------------------
-- Fees: apply payments atomically + derive status + receipt notification
-- ---------------------------------------------------------------------------

create or replace function public.tg_fees_status()
returns trigger
language plpgsql
as $$
begin
  new.status := case
    when new.paid_amount >= new.total_amount and new.total_amount > 0 then 'Paid'
    when new.paid_amount > 0 then 'Partial'
    else 'Pending' end;
  return new;
end;
$$;
drop trigger if exists fees_status on public.fees;
create trigger fees_status before insert or update of total_amount, paid_amount on public.fees
  for each row execute function public.tg_fees_status();

create or replace function public.tg_fee_payment_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_type    text;
  v_balance numeric;
begin
  if tg_op = 'INSERT' then
    update public.fees set paid_amount = paid_amount + new.amount
     where id = new.fee_id
    returning student_id, fee_type, balance into v_student, v_type, v_balance;

    insert into public.notifications (user_id, title, message, type, link)
    select s.profile_id, 'Payment received',
           format('₹%s received towards %s fees (txn %s). Remaining balance: ₹%s.', new.amount, v_type, new.transaction_id, v_balance),
           'info', '/student/fees'
    from public.students s join public.profiles p on p.id = s.profile_id and p.notification_enabled
    where s.id = v_student;
    return new;
  elsif tg_op = 'DELETE' then
    update public.fees set paid_amount = greatest(0, paid_amount - old.amount) where id = old.fee_id;
    return old;
  end if;
  return null;
end;
$$;
drop trigger if exists fee_payment_apply on public.fee_payments;
create trigger fee_payment_apply after insert or delete on public.fee_payments
  for each row execute function public.tg_fee_payment_apply();

-- Payments are immutable (correct by deleting and re-recording, which is audited).
create or replace function public.tg_fee_payment_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Fee payments cannot be edited. Delete and re-record the payment instead.';
end;
$$;
drop trigger if exists fee_payment_immutable on public.fee_payments;
create trigger fee_payment_immutable before update on public.fee_payments
  for each row execute function public.tg_fee_payment_immutable();

-- ---------------------------------------------------------------------------
-- Hostel: occupancy counter (enforces capacity via CHECK) + notifications
-- ---------------------------------------------------------------------------

create or replace function public.tg_hostel_occupancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status = 'Active' then
    update public.hostel_rooms set occupied = occupied - 1 where id = old.room_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.status = 'Active' then
    -- Fails with a CHECK violation if the room is full, even outside allocate_hostel_room().
    update public.hostel_rooms set occupied = occupied + 1 where id = new.room_id;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists hostel_occupancy on public.hostel_allocations;
create trigger hostel_occupancy after insert or update of status, room_id or delete on public.hostel_allocations
  for each row execute function public.tg_hostel_occupancy();

create or replace function public.tg_hostel_allocation_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, message, type, link)
  select s.profile_id,
         case when new.status = 'Active' then 'Hostel room allocated' else 'Hostel room vacated' end,
         case when new.status = 'Active' then format('You have been allotted room %s in %s.', r.room_number, h.name)
              else format('Your allocation for room %s in %s has ended.', r.room_number, h.name) end,
         'info', '/student/hostel'
  from public.students s
  join public.profiles p on p.id = s.profile_id and p.notification_enabled
  join public.hostel_rooms r on r.id = new.room_id
  join public.hostels h on h.id = r.hostel_id
  where s.id = new.student_id;
  return null;
end;
$$;
drop trigger if exists hostel_allocation_notify on public.hostel_allocations;
create trigger hostel_allocation_notify after insert or update of status on public.hostel_allocations
  for each row execute function public.tg_hostel_allocation_notify();

create or replace function public.tg_complaint_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (user_id, title, message, type, link)
    select s.profile_id, 'Complaint ' || lower(new.status),
           format('Your hostel complaint "%s" is now %s.', left(new.description, 60), new.status), 'info', '/student/hostel'
    from public.students s join public.profiles p on p.id = s.profile_id and p.notification_enabled
    where s.id = new.student_id;
  end if;
  return null;
end;
$$;
drop trigger if exists complaint_notify on public.hostel_complaints;
create trigger complaint_notify after update of status on public.hostel_complaints
  for each row execute function public.tg_complaint_notify();

-- ---------------------------------------------------------------------------
-- Library: keep available copies consistent if a borrower is deleted with books out
-- ---------------------------------------------------------------------------

create or replace function public.tg_book_issue_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'Issued' then
    update public.books set available_copies = least(total_copies, available_copies + 1) where id = old.book_id;
  end if;
  return old;
end;
$$;
drop trigger if exists book_issue_deleted on public.book_issues;
create trigger book_issue_deleted after delete on public.book_issues
  for each row execute function public.tg_book_issue_deleted();

create or replace function public.tg_book_issue_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, message, type)
  select new.borrower_id,
         case when tg_op = 'INSERT' then 'Book issued' else 'Book returned' end,
         case when tg_op = 'INSERT' then format('"%s" is due back on %s.', b.title, new.due_date)
              when new.fine_amount > 0 then format('"%s" returned late. Fine: ₹%s.', b.title, new.fine_amount)
              else format('"%s" returned. Thank you!', b.title) end,
         case when tg_op = 'UPDATE' and new.fine_amount > 0 then 'alert' else 'info' end
  from public.books b
  join public.profiles p on p.id = new.borrower_id and p.notification_enabled
  where b.id = new.book_id;
  return null;
end;
$$;
drop trigger if exists book_issue_notify_ins on public.book_issues;
create trigger book_issue_notify_ins after insert on public.book_issues
  for each row execute function public.tg_book_issue_notify();
drop trigger if exists book_issue_notify_ret on public.book_issues;
create trigger book_issue_notify_ret after update of status on public.book_issues
  for each row when (old.status = 'Issued' and new.status = 'Returned')
  execute function public.tg_book_issue_notify();

-- ---------------------------------------------------------------------------
-- Placements
-- ---------------------------------------------------------------------------

create or replace function public.tg_opportunity_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Open' then
    insert into public.notifications (user_id, title, message, type, link)
    select s.profile_id,
           format('New %s: %s', new.type, new.company_name),
           format('%s at %s%s. Apply before %s.', new.role_title, new.company_name,
                  case when new.eligibility_cgpa > 0 then format(' (min CGPA %s)', new.eligibility_cgpa) else '' end,
                  coalesce(to_char(new.deadline, 'DD Mon YYYY'), 'the deadline')),
           'event', '/student/opportunities'
    from public.students s
    join public.profiles p on p.id = s.profile_id and p.notification_enabled
    where s.status = 'Active';
  end if;
  return null;
end;
$$;
drop trigger if exists opportunity_notify on public.placement_opportunities;
create trigger opportunity_notify after insert on public.placement_opportunities
  for each row execute function public.tg_opportunity_notify();

create or replace function public.tg_application_status_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (user_id, title, message, type, link)
    select s.profile_id, format('Application update: %s', o.company_name),
           format('Your application for %s is now "%s".', o.role_title, new.status),
           case when new.status in ('Offer Extended', 'Shortlisted') then 'event' else 'info' end,
           '/student/applications'
    from public.students s
    join public.profiles p on p.id = s.profile_id and p.notification_enabled
    join public.placement_opportunities o on o.id = new.opportunity_id
    where s.id = new.student_id;
  end if;
  return null;
end;
$$;
drop trigger if exists application_status_notify on public.placement_applications;
create trigger application_status_notify after update of status on public.placement_applications
  for each row execute function public.tg_application_status_notify();

-- ---------------------------------------------------------------------------
-- Classroom: owner membership, member counter, classwork notifications
-- ---------------------------------------------------------------------------

create or replace function public.tg_classroom_add_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.classroom_members (classroom_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return null;
end;
$$;
drop trigger if exists classrooms_add_owner on public.classrooms;
create trigger classrooms_add_owner after insert on public.classrooms
  for each row execute function public.tg_classroom_add_owner();

-- Statement-level counter: a bulk join of N students updates the room row once.
create or replace function public.tg_classroom_member_count_ins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.classrooms c set member_count = c.member_count + d.n
  from (select classroom_id, count(*) as n from new_rows group by 1) d
  where c.id = d.classroom_id;
  return null;
end;
$$;
create or replace function public.tg_classroom_member_count_del()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.classrooms c set member_count = greatest(0, c.member_count - d.n)
  from (select classroom_id, count(*) as n from old_rows group by 1) d
  where c.id = d.classroom_id;
  return null;
end;
$$;
drop trigger if exists classroom_member_count_ins on public.classroom_members;
create trigger classroom_member_count_ins after insert on public.classroom_members
  referencing new table as new_rows for each statement execute function public.tg_classroom_member_count_ins();
drop trigger if exists classroom_member_count_del on public.classroom_members;
create trigger classroom_member_count_del after delete on public.classroom_members
  referencing old table as old_rows for each statement execute function public.tg_classroom_member_count_del();

create or replace function public.tg_assignment_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, message, type, link)
  select m.user_id, 'New assignment: ' || left(n.title, 150),
         format('Posted in %s%s.', c.name, case when n.due_date is not null then ' · due ' || to_char(n.due_date, 'DD Mon YYYY HH24:MI') else '' end),
         'task', '/classrooms/' || n.classroom_id
  from new_rows n
  join public.classrooms c on c.id = n.classroom_id
  join public.classroom_members m on m.classroom_id = n.classroom_id and m.role = 'student'
  join public.profiles p on p.id = m.user_id and p.notification_enabled;
  return null;
end;
$$;
drop trigger if exists assignment_notify on public.classroom_assignments;
create trigger assignment_notify after insert on public.classroom_assignments
  referencing new table as new_rows for each statement execute function public.tg_assignment_notify();

create or replace function public.tg_submission_graded_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.marks_obtained is not null and new.marks_obtained is distinct from old.marks_obtained then
    insert into public.notifications (user_id, title, message, type, link)
    select new.student_id, 'Assignment graded: ' || left(a.title, 150),
           format('You scored %s / %s.', new.marks_obtained, a.max_marks), 'info', '/classrooms/' || new.classroom_id
    from public.classroom_assignments a
    join public.profiles p on p.id = new.student_id and p.notification_enabled
    where a.id = new.assignment_id;
  end if;
  return null;
end;
$$;
drop trigger if exists submission_graded_notify on public.classroom_submissions;
create trigger submission_graded_notify after update of marks_obtained on public.classroom_submissions
  for each row execute function public.tg_submission_graded_notify();

-- ---------------------------------------------------------------------------
-- Audit trail for sensitive tables
-- ---------------------------------------------------------------------------

create or replace function public.tg_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new   jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_old   jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_actor uuid;
begin
  begin
    v_actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  exception when others then
    v_actor := null;
  end;
  v_actor := coalesce(v_actor, (coalesce(v_new, v_old)->>'recorded_by')::uuid, (coalesce(v_new, v_old)->>'updated_by')::uuid);

  insert into public.audit_log (table_name, record_id, action, actor_id, old_data, new_data)
  values (tg_table_name, coalesce(v_new, v_old)->>'id', tg_op, v_actor, v_old, v_new);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['marks', 'fee_payments', 'fees', 'students', 'promotions'] loop
    execute format('drop trigger if exists audit on public.%I', t);
  end loop;
  -- marks: only real changes; others: every change.
  create trigger audit after insert or update or delete on public.fee_payments for each row execute function public.tg_audit();
  create trigger audit after update or delete on public.fees for each row execute function public.tg_audit();
  create trigger audit after update or delete on public.students for each row execute function public.tg_audit();
end;
$$;

-- Marks audit only when a component actually changes (bulk re-saves don't flood the log).
create or replace function public.tg_audit_marks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (table_name, record_id, action, actor_id, old_data, new_data)
  select 'marks', n.id::text, 'UPDATE', n.updated_by, to_jsonb(o), to_jsonb(n)
  from new_rows n join old_rows o on o.id = n.id
  where (n.ia1, n.ia2, n.other, n.see) is distinct from (o.ia1, o.ia2, o.other, o.see);
  return null;
end;
$$;
drop trigger if exists audit_marks on public.marks;
create trigger audit_marks after update on public.marks
  referencing old table as old_rows new table as new_rows for each statement execute function public.tg_audit_marks();

-- Invalidate dashboard cache on large structural changes is unnecessary: the cache TTL is 60 s.

-- ---------------------------------------------------------------------------
-- Identifiers: assign on insert when the caller did not supply one
-- ---------------------------------------------------------------------------

create or replace function public.tg_students_assign_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(new.college_id), '') = '' then
    new.college_id := public.generate_college_id(new.program, new.branch, new.admitted_year);
  end if;
  return new;
end;
$$;
drop trigger if exists students_assign_id on public.students;   -- fires before students_normalize (alphabetical)
create trigger students_assign_id before insert on public.students
  for each row execute function public.tg_students_assign_id();

create or replace function public.tg_staff_assign_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(new);
begin
  if coalesce(trim(new.employee_code), '') = '' then
    new.employee_code := public.generate_staff_code(
      case when tg_table_name = 'teachers' then 'teacher'
           when v_row->>'employee_type' = 'super_admin' then 'super_admin'
           else 'employee' end,
      new.department,
      v_row->>'employee_type',
      extract(year from coalesce(new.date_of_joining, current_date))::int);
  end if;
  new.employee_code := upper(trim(new.employee_code));
  return new;
end;
$$;
drop trigger if exists teachers_assign_code on public.teachers;
create trigger teachers_assign_code before insert on public.teachers
  for each row execute function public.tg_staff_assign_code();
drop trigger if exists employees_assign_code on public.employees;
create trigger employees_assign_code before insert on public.employees
  for each row execute function public.tg_staff_assign_code();

create or replace function public.tg_courses_assign_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(new.code), '') = '' then
    new.code := public.generate_course_code(new.program, new.branch, new.semester);
  end if;
  new.code := upper(trim(new.code));
  return new;
end;
$$;
drop trigger if exists courses_assign_code on public.courses;
create trigger courses_assign_code before insert on public.courses
  for each row execute function public.tg_courses_assign_code();

-- Generic reference-number assigner: TG_ARGV = (column, prefix, sequence, width).
create or replace function public.tg_assign_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_jsonb(new)->>tg_argv[0] is null then
    new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0],
             public.ref_number(tg_argv[1], tg_argv[2], tg_argv[3]::int)));
  end if;
  return new;
end;
$$;

drop trigger if exists assign_receipt_no on public.fee_payments;
create trigger assign_receipt_no before insert on public.fee_payments
  for each row execute function public.tg_assign_reference('receipt_no', 'RCP', 'receipt_no_seq', '7');
drop trigger if exists assign_allotment_no on public.hostel_allocations;
create trigger assign_allotment_no before insert on public.hostel_allocations
  for each row execute function public.tg_assign_reference('allotment_no', 'HAL', 'allotment_no_seq', '6');
drop trigger if exists assign_ticket_no on public.hostel_complaints;
create trigger assign_ticket_no before insert on public.hostel_complaints
  for each row execute function public.tg_assign_reference('ticket_no', 'HCT', 'complaint_no_seq', '6');
drop trigger if exists assign_issue_no on public.book_issues;
create trigger assign_issue_no before insert on public.book_issues
  for each row execute function public.tg_assign_reference('issue_no', 'LIB', 'issue_no_seq', '6');
drop trigger if exists assign_application_no on public.placement_applications;
create trigger assign_application_no before insert on public.placement_applications
  for each row execute function public.tg_assign_reference('application_no', 'APP', 'application_no_seq', '6');
drop trigger if exists assign_attempt_no on public.backlog_attempts;
create trigger assign_attempt_no before insert on public.backlog_attempts
  for each row execute function public.tg_assign_reference('attempt_no', 'SUP', 'backlog_attempt_no_seq', '6');

-- Exam code: COURSE-SESSION-YEAR (unique together with the exams uniqueness rule).
create or replace function public.tg_exams_assign_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.exam_code is null then
    select c.code || '-' || public.exam_session_code(new.exam_type) || '-' || new.academic_year
           || case when exists (select 1 from public.exams e
                                 where e.exam_code = c.code || '-' || public.exam_session_code(new.exam_type) || '-' || new.academic_year)
                   then '-' || new.semester else '' end
      into new.exam_code
    from public.courses c where c.id = new.course_id;
  end if;
  return new;
end;
$$;
drop trigger if exists exams_assign_code on public.exams;
create trigger exams_assign_code before insert on public.exams
  for each row execute function public.tg_exams_assign_code();

-- ---------------------------------------------------------------------------
-- Backlogs: kept in sync with marks (set-based, statement level)
--   grade F            → backlog created (or re-opened, count + 1, on a retake that fails)
--   F → pass grade     → backlog cleared with the passing grade
-- ---------------------------------------------------------------------------

create or replace function public.tg_marks_sync_backlogs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- New / re-opened backlogs
  with failed as (
    select n.student_id, c.course_id, n.class_id, c.semester, greatest(1, ceil(c.semester / 2.0))::smallint as study_year
    from new_rows n join public.classes c on c.id = n.class_id
    where n.grade = 'F'
  ),
  upserted as (
    insert into public.backlogs as b (student_id, course_id, class_id, semester, study_year)
    select student_id, course_id, class_id, semester, study_year from failed
    on conflict (student_id, course_id) do update
      set status = 'Active', fail_count = b.fail_count + 1, class_id = excluded.class_id,
          semester = excluded.semester, cleared_at = null, cleared_grade = null, last_attempt_at = now()
      where b.status = 'Cleared' or b.class_id <> excluded.class_id
    returning b.student_id, b.course_id, b.fail_count
  )
  insert into public.notifications (user_id, title, message, type, link)
  select s.profile_id, 'Backlog recorded: ' || co.code,
         format('%s has been added to your backlogs (attempt count %s). Your exam department will schedule a re-exam.', co.name, u.fail_count),
         'alert', '/student/backlogs'
  from upserted u
  join public.students s on s.id = u.student_id
  join public.profiles p on p.id = s.profile_id and p.notification_enabled
  join public.courses co on co.id = u.course_id;

  -- Cleared backlogs
  with cleared as (
    update public.backlogs b
       set status = 'Cleared', cleared_at = now(), cleared_grade = n.grade
      from new_rows n
     where b.student_id = n.student_id and b.class_id = n.class_id and b.status = 'Active'
       and n.grade is not null and n.grade <> 'F'
    returning b.student_id, b.course_id, b.cleared_grade
  )
  insert into public.notifications (user_id, title, message, type, link)
  select s.profile_id, 'Backlog cleared: ' || co.code, format('%s cleared with grade %s. Well done!', co.name, c.cleared_grade),
         'event', '/student/marks'
  from cleared c
  join public.students s on s.id = c.student_id
  join public.profiles p on p.id = s.profile_id and p.notification_enabled
  join public.courses co on co.id = c.course_id;

  return null;
end;
$$;
drop trigger if exists marks_sync_backlogs_ins on public.marks;
create trigger marks_sync_backlogs_ins after insert on public.marks
  referencing new table as new_rows for each statement execute function public.tg_marks_sync_backlogs();
drop trigger if exists marks_sync_backlogs_upd on public.marks;
create trigger marks_sync_backlogs_upd after update on public.marks
  referencing new table as new_rows for each statement execute function public.tg_marks_sync_backlogs();

drop trigger if exists audit on public.backlog_attempts;
create trigger audit after insert or update or delete on public.backlog_attempts
  for each row execute function public.tg_audit();
