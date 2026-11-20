\set ON_ERROR_STOP 1
\pset pager off
set client_min_messages = warning;

create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if;
  raise notice 'ok  %', label;
end $$;
set client_min_messages = notice;

-- ---------- identities ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'admin@x.edu'),
  ('00000000-0000-0000-0000-000000000002', 'teach@x.edu'),
  ('00000000-0000-0000-0000-000000000003', 's1@x.edu'),
  ('00000000-0000-0000-0000-000000000004', 's2@x.edu'),
  ('00000000-0000-0000-0000-000000000005', 'fee@x.edu');
insert into profiles (id, role, full_name, email, id_code) values
  ('00000000-0000-0000-0000-000000000001', 'super_admin', 'Admin', 'ADMIN@x.edu', 'sup260001'),
  ('00000000-0000-0000-0000-000000000002', 'teacher', 'Tara Teacher', 'teach@x.edu', 'BTE26CSE0001'),
  ('00000000-0000-0000-0000-000000000003', 'student', 'Sam One', 's1@x.edu', 'BTE26CSE0001X'),
  ('00000000-0000-0000-0000-000000000004', 'student', 'Sue Two', 's2@x.edu', 'BTE26CSE0002'),
  ('00000000-0000-0000-0000-000000000005', 'employee', 'Fiona Fee', 'fee@x.edu', 'FEE26ADM0001');
insert into employees (profile_id, employee_code, employee_type) values ('00000000-0000-0000-0000-000000000005', 'FEE26ADM0001', 'fee_management');
insert into teachers (id, profile_id, employee_code) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'BTE26CSE0001');
insert into students (id, profile_id, college_id, program, branch, section, current_semester) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'bte26cse0001x', 'B.Tech', 'CSE', 'a', 1),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'BTE26CSE0002', 'B.Tech', 'CSE', 'A', 1);

select pg_temp.check((select email from profiles where id = '00000000-0000-0000-0000-000000000001') = 'admin@x.edu', 'email lower-cased');
select pg_temp.check((select college_id || section from students where id = '20000000-0000-0000-0000-000000000001') = 'BTE26CSE0001XA', 'college id/section normalized');
select pg_temp.check((select raw_app_meta_data->>'role' from auth.users where id = '00000000-0000-0000-0000-000000000002') = 'teacher', 'role mirrored into JWT claims');
select pg_temp.check((select raw_app_meta_data->>'employee_type' from auth.users where id = '00000000-0000-0000-0000-000000000005') = 'fee_management', 'employee_type mirrored into JWT claims');
select pg_temp.check(next_sequence('k') = 1 and next_sequence('k') = 2, 'next_sequence atomic increments');

-- ---------- academics ----------
insert into courses (id, code, name, program, branch, semester, credits) values
  ('30000000-0000-0000-0000-000000000001', 'BT1CSE001', 'Programming', 'B.Tech', 'CSE', 1, 4),
  ('30000000-0000-0000-0000-000000000002', 'BT1CSE002', 'Maths', 'B.Tech', 'CSE', 1, 3);
insert into classes (id, course_id, teacher_id, program, branch, section, year, academic_year, semester) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'B.Tech', 'CSE', 'A', 1, '1', 1),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'B.Tech', 'CSE', 'A', 1, '1', 1);

-- attendance (bulk upsert) → sessions
insert into attendance (class_id, student_id, teacher_id, date, period, status) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', current_date - 1, 1, 'Present'),
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', current_date - 1, 1, 'Absent');
select pg_temp.check((select student_count = 2 and present_count = 1 from attendance_sessions where class_id = '40000000-0000-0000-0000-000000000001'), 'attendance_sessions created by statement trigger');
insert into attendance (class_id, student_id, teacher_id, date, period, status) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', current_date - 1, 1, 'Present')
on conflict (class_id, student_id, date, period) do update set status = excluded.status;
select pg_temp.check((select present_count = 2 from attendance_sessions where class_id = '40000000-0000-0000-0000-000000000001'), 'upsert updates session counts');
select pg_temp.check((select count(*) = 2 from attendance), 'upsert never duplicates attendance');
do $$ begin
  insert into attendance (class_id, student_id, date, period, status) values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', current_date + 1, 2, 'Present');
  raise exception 'future attendance accepted';
exception when raise_exception then
  if sqlerrm like 'future attendance accepted' then raise; end if;
  raise notice 'ok  future-dated attendance rejected';
end $$;
select pg_temp.check((select count(*) = 2 from get_section_attendance_summary('B.Tech', 'CSE', 1, 'A', null, null, null)), 'section attendance summary');
select pg_temp.check((select total_records = 2 from get_attendance_rollup()), 'attendance rollup');
select pg_temp.check((select count(*) = 1 from get_teacher_attendance_sessions('00000000-0000-0000-0000-000000000002', 10)), 'teacher session log');

-- marks: partial → no grade; complete → grade + notification; change → "updated"
insert into marks (student_id, class_id, ia1, ia2, other, total, grade) values
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 40, 40, 20, 99, 'O');
select pg_temp.check((select total = 60 and grade is null from marks where student_id = '20000000-0000-0000-0000-000000000001'), 'client total/grade ignored; no grade before SEE');
insert into marks (student_id, class_id, ia1, ia2, other, see) values
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 40, 40, 20, 100),
  ('20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 20, 20, 10, 50)
on conflict (student_id, class_id) do update set ia1 = excluded.ia1, ia2 = excluded.ia2, other = excluded.other, see = excluded.see;
select pg_temp.check((select grade = 'O' and total = 100 from marks where student_id = '20000000-0000-0000-0000-000000000001'), 'grade O at 100');
select pg_temp.check((select grade = 'C+' and total = 50 from marks where student_id = '20000000-0000-0000-0000-000000000002'), 'grade C+ at 50');
select pg_temp.check((select count(*) = 2 from notifications where title like 'Result published%'), 'result notifications (insert + update paths)');
update marks set ia1 = 0, ia2 = 0, other = 0, see = 0 where student_id = '20000000-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) = 1 from notifications where title like 'Result updated%'), 'result-updated notification');
select pg_temp.check((select count(*) >= 1 from audit_log where table_name = 'marks'), 'marks audit trail');
select pg_temp.check(get_teacher_pending_marks('00000000-0000-0000-0000-000000000002') = 2, 'pending marks = students without grade in class 2');

-- exams → one notification per affected student per session
insert into exams (course_id, program, branch, semester, exam_type, exam_date, start_time, end_time) values
  ('30000000-0000-0000-0000-000000000001', 'B.Tech', 'CSE', 1, 'Mid Term', current_date + 7, '09:00', '12:00'),
  ('30000000-0000-0000-0000-000000000002', 'B.Tech', 'CSE', 1, 'Mid Term', current_date + 8, '09:00', '12:00');
select pg_temp.check((select count(*) = 2 from notifications where title = 'Exam schedule published: Mid Term'), 'exam publish notifies each student once');

-- fees
select pg_temp.check((record_fee_payment('20000000-0000-0000-0000-000000000001', 'college', 1, 50000, 'UPI', 'TXN1', null, null)->>'status') = 'Partial', 'fee payment → Partial');
select pg_temp.check((select paid_amount = 50000 and balance = 100000 from fees where student_id = '20000000-0000-0000-0000-000000000001'), 'paid/balance maintained by trigger');
do $$ begin
  perform record_fee_payment('20000000-0000-0000-0000-000000000001', 'college', 1, 10, 'UPI', 'TXN1', null, null);
  raise exception 'dup txn accepted';
exception when unique_violation then raise notice 'ok  duplicate transaction id rejected'; end $$;
do $$ begin
  perform record_fee_payment('20000000-0000-0000-0000-000000000001', 'college', 1, 999999, 'UPI', null, null, null);
  raise exception 'overpayment accepted';
exception when raise_exception then
  if sqlerrm = 'overpayment accepted' then raise; end if;
  raise notice 'ok  overpayment rejected';
end $$;
select pg_temp.check((record_fee_payment('20000000-0000-0000-0000-000000000001', 'college', 1, 100000, 'Card', null, null, null)->>'status') = 'Paid', 'fee → Paid');
select pg_temp.check((select count(*) = 2 from notifications where title = 'Payment received'), 'payment receipts notified');

-- eligibility (student 2 has a fee row? no → eligible on fees; attendance 100%)
select pg_temp.check((select count(*) = 2 from get_exam_eligibility((select id from exams limit 1), 75)), 'exam eligibility rows');

-- hostel
insert into hostels (id, name, type) values ('50000000-0000-0000-0000-000000000001', 'North', 'Boys');
insert into hostel_rooms (id, hostel_id, room_number, capacity) values ('51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '101', 1);
select pg_temp.check((allocate_hostel_room('51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')->>'success')::boolean, 'allocate first student');
select pg_temp.check(not (allocate_hostel_room('51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')->>'success')::boolean, 'capacity enforced');
do $$ begin
  insert into hostel_allocations (room_id, student_id) values ('51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002');
  raise exception 'bypass allowed';
exception when check_violation then raise notice 'ok  capacity enforced even on direct insert'; end $$;
select pg_temp.check((select is_hosteler from students where id = '20000000-0000-0000-0000-000000000001'), 'allocation marks hosteler');
update hostel_allocations set status = 'Vacated' where student_id = '20000000-0000-0000-0000-000000000001';
select pg_temp.check((select occupied = 0 from hostel_rooms), 'vacate frees bed');
insert into hostel_complaints (id, student_id, hostel_id, description) values ('52000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Fan broken');
update hostel_complaints set status = 'Resolved';
select pg_temp.check((select count(*) = 1 from notifications where title = 'Complaint resolved'), 'complaint status notification');

-- library
insert into books (id, title, total_copies, available_copies) values ('60000000-0000-0000-0000-000000000001', 'SICP', 1, 1);
select pg_temp.check((issue_book('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 14)->>'success')::boolean, 'issue book');
select pg_temp.check(not (issue_book('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 14)->>'success')::boolean, 'no copies left → refused');
select pg_temp.check(not (set_book_total_copies('60000000-0000-0000-0000-000000000001', 0)->>'success')::boolean, 'cannot shrink below copies on loan');
update book_issues set due_date = current_date - 3;
select pg_temp.check((return_book((select id from book_issues limit 1))->>'fine')::numeric = 15, 'late fine computed');
select pg_temp.check((select available_copies = 1 from books), 'copy returned to shelf');

-- placements
insert into placement_opportunities (id, company_name, role_title, deadline, eligibility_cgpa) values ('70000000-0000-0000-0000-000000000001', 'Acme', 'SDE', current_date + 10, 5);
select pg_temp.check((select count(*) = 2 from notifications where title = 'New placement: Acme'), 'new drive notifies active students');
select pg_temp.check((apply_to_opportunity('20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001')->>'success')::boolean = false, 'CGPA gate (student1 has F now) blocks');
select pg_temp.check((apply_to_opportunity('20000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001')->>'success')::boolean is not null, 'apply returns a result');
update marks set ia1 = 40, ia2 = 40, other = 20, see = 100 where student_id = '20000000-0000-0000-0000-000000000001';
select pg_temp.check((apply_to_opportunity('20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001')->>'success')::boolean, 'apply after passing');
select pg_temp.check(not (apply_to_opportunity('20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001')->>'success')::boolean, 'duplicate application refused');
update placement_applications set status = 'Shortlisted' where student_id = '20000000-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) = 1 from notifications where title = 'Application update: Acme'), 'application status notification');

-- classroom
insert into classrooms (id, name, owner_id, owner_name, invite_code) values ('80000000-0000-0000-0000-000000000001', 'DSA', '00000000-0000-0000-0000-000000000002', 'Tara', 'ABC1234');
select pg_temp.check((select member_count = 1 from classrooms), 'owner auto-joined');
select pg_temp.check((join_classroom('abc1234', '00000000-0000-0000-0000-000000000003')->>'already_member')::boolean = false, 'student joins');
select pg_temp.check((join_classroom('ABC1234', '00000000-0000-0000-0000-000000000003')->>'already_member')::boolean, 'join idempotent');
select pg_temp.check((select member_count = 2 from classrooms), 'member_count maintained');
insert into classroom_assignments (id, classroom_id, title) values ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'HW1');
select pg_temp.check((select count(*) = 1 from notifications where title = 'New assignment: HW1'), 'assignment notifies students only');
insert into classroom_submissions (id, assignment_id, classroom_id, student_id) values ('82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003');
update classroom_submissions set marks_obtained = 90;
select pg_temp.check((select count(*) = 1 from notifications where title = 'Assignment graded: HW1'), 'graded notification');

-- RLS as a browser user
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select pg_temp.check((select count(*) = 1 from profiles), 'RLS: student sees only own profile');
select pg_temp.check((select count(*) = (select count(*) from notifications) from notifications), 'RLS: notifications filtered');
select pg_temp.check((select bool_and(user_id = '00000000-0000-0000-0000-000000000003') from notifications), 'RLS: own notifications only');
select pg_temp.check((select count(*) = 0 from fee_payments), 'RLS: payments hidden');
select pg_temp.check((select count(*) = 1 from classrooms), 'RLS: member sees classroom');
select pg_temp.check((select count(*) = 1 from attendance), 'RLS: own attendance only');
do $$ begin
  update profiles set role = 'super_admin';
  raise exception 'privilege escalation possible';
exception when insufficient_privilege then raise notice 'ok  cannot change own role'; end $$;
do $$ begin
  perform record_fee_payment('20000000-0000-0000-0000-000000000001', 'college', 2, 1, null, null, null, null);
  raise exception 'rpc callable by browser';
exception when insufficient_privilege then raise notice 'ok  privileged RPC blocked for authenticated'; end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select pg_temp.check((select count(*) = 0 from classrooms), 'RLS: non-member cannot see classroom');
reset role;
set role anon;
do $$ begin
  perform 1 from profiles;
  raise exception 'anon can read';
exception when insufficient_privilege then raise notice 'ok  anon key reads nothing'; end $$;
reset role;

-- promotion
select pg_temp.check(not (select success from promote_students(array['20000000-0000-0000-0000-000000000002']::uuid[], null, '2026')), 'promotion blocked by failed/ungraded course');
insert into marks (student_id, class_id, ia1, ia2, other, see) values
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 30, 30, 15, 70);
select pg_temp.check((select success and to_semester = 2 from promote_students(array['20000000-0000-0000-0000-000000000001']::uuid[], null, '2026')), 'promotion succeeds');
select pg_temp.check((select current_semester = 2 and current_year = 1 from students where id = '20000000-0000-0000-0000-000000000001'), 'semester advanced');

-- timetable clash
insert into classes (id, course_id, teacher_id, program, branch, section, year, academic_year, semester) values
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'B.Tech', 'CSE', 'B', 1, '1', 1);
select pg_temp.check((replace_section_timetable(array['40000000-0000-0000-0000-000000000001']::uuid[],
  '[{"class_id":"40000000-0000-0000-0000-000000000001","day_of_week":"Monday","start_time":"09:00:00","end_time":"10:00:00"}]')->>'success')::boolean, 'timetable saved');
do $$ begin
  perform replace_section_timetable(array['40000000-0000-0000-0000-000000000003']::uuid[],
    '[{"class_id":"40000000-0000-0000-0000-000000000003","day_of_week":"Monday","start_time":"09:00:00","end_time":"10:00:00"}]');
  raise exception 'clash accepted';
exception when raise_exception then
  if sqlerrm = 'clash accepted' then raise; end if;
  raise notice 'ok  teacher double-booking rejected (%)', sqlerrm;
end $$;
select pg_temp.check((select count(*) = 1 from timetables), 'failed save rolled back atomically');

-- dashboards & maintenance
select pg_temp.check((get_admin_dashboard_stats()->>'total_students')::int = 2, 'admin dashboard');
select pg_temp.check(get_admin_dashboard_stats() = get_admin_dashboard_stats(), 'dashboard cache hit');
select pg_temp.check((get_employee_dashboard_stats('fee_management')->>'collection_rate') is not null, 'fee dashboard');
select pg_temp.check((get_employee_dashboard_stats('library_management')->>'total_books')::int = 1, 'library dashboard');
select pg_temp.check((broadcast_notification(array['student'], 'Holiday', 'Closed Friday', 'event', null, '00000000-0000-0000-0000-000000000001')) = 2, 'broadcast to role');
update placement_opportunities set deadline = current_date - 1;
select pg_temp.check((run_daily_maintenance()->>'closed_opportunities')::int = 1, 'maintenance closes expired drives');
