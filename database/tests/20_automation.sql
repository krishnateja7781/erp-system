\set ON_ERROR_STOP 1
set client_min_messages = notice;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if;
  raise notice 'ok  %', label;
end $$;

-- fresh cast: hostel employee, teacher, two students in MECH sem 1
insert into auth.users (id, email) values
  ('0a000000-0000-0000-0000-000000000001', 'hostelstaff@x.edu'),
  ('0a000000-0000-0000-0000-000000000002', 'mechteach@x.edu'),
  ('0a000000-0000-0000-0000-000000000003', 'm1@x.edu'),
  ('0a000000-0000-0000-0000-000000000004', 'm2@x.edu'),
  ('0a000000-0000-0000-0000-000000000005', 'selfreg@x.edu');
insert into profiles (id, role, full_name, email) values
  ('0a000000-0000-0000-0000-000000000001', 'employee', 'Hal Hostel', 'hostelstaff@x.edu'),
  ('0a000000-0000-0000-0000-000000000002', 'teacher', 'Mel Mech', 'mechteach@x.edu'),
  ('0a000000-0000-0000-0000-000000000003', 'student', 'Max One', 'm1@x.edu'),
  ('0a000000-0000-0000-0000-000000000004', 'student', 'Mia Two', 'm2@x.edu'),
  ('0a000000-0000-0000-0000-000000000005', 'student', 'Self Reg', 'selfreg@x.edu');
insert into employees (profile_id, employee_code, employee_type) values ('0a000000-0000-0000-0000-000000000001', 'HOS26ADM0001', 'hostel_management');
insert into teachers (id, profile_id, employee_code) values ('1a000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000002', 'BTE26MEC0001');

-- new students → welcome + college fee demand; self-registration → admin alert
insert into students (id, profile_id, college_id, program, branch, section, current_semester, current_year) values
  ('2a000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000003', 'MECH001', 'B.Tech', 'MECH', 'A', 1, 1),
  ('2a000000-0000-0000-0000-000000000002', '0a000000-0000-0000-0000-000000000004', 'MECH002', 'B.Tech', 'MECH', 'A', 1, 1);
insert into students (id, profile_id, college_id) values ('2a000000-0000-0000-0000-000000000003', '0a000000-0000-0000-0000-000000000005', 'SELF001');
select pg_temp.check((select count(*) = 3 from notifications where title = 'Welcome to EduERP' and user_id::text like '0a%'), 'welcome notification per new student');
select pg_temp.check((select count(*) = 3 from fees where student_id::text like '2a%' and fee_type = 'college' and study_year = 1 and total_amount = 150000), 'college fee billed on creation (default structure)');
select pg_temp.check(exists (select 1 from notifications where title = 'Student registrations awaiting approval'), 'admins alerted about self-registrations awaiting approval');

-- program-specific structure wins over default
insert into fee_structures (program, fee_type, study_year, amount) values ('B.Tech', 'college', 2, 175000);
update students set current_year = 2 where id = '2a000000-0000-0000-0000-000000000001';
select pg_temp.check((select total_amount = 175000 from fees where student_id = '2a000000-0000-0000-0000-000000000001' and study_year = 2), 'year change bills new year with program-specific amount');
select pg_temp.check((select count(*) = 1 from fees where student_id = '2a000000-0000-0000-0000-000000000001' and study_year = 1), 'previous year fee kept');
update students set current_year = 1 where id = '2a000000-0000-0000-0000-000000000001';

-- becoming a hosteler bills hostel fee
update students set is_hosteler = true where id = '2a000000-0000-0000-0000-000000000002';
select pg_temp.check((select total_amount = 50000 from fees where student_id = '2a000000-0000-0000-0000-000000000002' and fee_type = 'hostel'), 'hostel fee billed when student becomes hosteler');
select pg_temp.check(generate_fee_demands(null) = 0, 'demand generation idempotent');

-- payment against an existing demand, default study year
select pg_temp.check((record_fee_payment('2a000000-0000-0000-0000-000000000001', 'college', null, 75000, 'UPI', null, null, null)->>'study_year')::int = 1, 'payment defaults to current study year');

-- class + teacher notification
insert into courses (id, code, name, program, branch, semester, credits) values ('3a000000-0000-0000-0000-000000000001', 'BT1MEC001', 'Mechanics', 'B.Tech', 'MECH', 1, 4);
insert into classes (id, course_id, teacher_id, program, branch, section, year, academic_year, semester)
values ('4a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'B.Tech', 'MECH', 'A', 1, '1', 1);
select pg_temp.check(exists (select 1 from notifications where user_id = '0a000000-0000-0000-0000-000000000002' and title = 'New class assigned: BT1MEC001'), 'teacher notified of class assignment');

-- attendance: student1 present 4/4, student2 present 1/4
insert into attendance (class_id, student_id, date, period, status)
select '4a000000-0000-0000-0000-000000000001', s, current_date - d, 1, case when s = '2a000000-0000-0000-0000-000000000001'::uuid or d = 1 then 'Present' else 'Absent' end
from unnest(array['2a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000002']::uuid[]) s, generate_series(1, 4) d;

-- exam session rules: 75 % attendance, 60 % fees
insert into exam_sessions (program, branch, semester, exam_type, min_attendance, min_fee_paid_percent, instructions, controller_signature)
values ('B.Tech', 'MECH', 1, 'SEE', 75, 60, 'Bring your ID card.', 'Dr. Controller');
insert into exams (id, course_id, program, branch, semester, exam_type, exam_date, start_time, end_time)
values ('5a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 'B.Tech', 'MECH', 1, 'SEE', current_date + 10, '09:00', '12:00');
select pg_temp.check((select is_eligible from get_exam_eligibility('5a000000-0000-0000-0000-000000000001') where student_id = '2a000000-0000-0000-0000-000000000001') = false, 'student1: 50% fees paid < 60% rule → ineligible');
select pg_temp.check((select reasons[1] like 'Only 50%% of fees%' from get_exam_eligibility('5a000000-0000-0000-0000-000000000001') where student_id = '2a000000-0000-0000-0000-000000000001'), 'fee reason explains percentage');
select record_fee_payment('2a000000-0000-0000-0000-000000000001', 'college', 1, 30000, 'UPI', null, null, null);
select pg_temp.check((select is_eligible from get_exam_eligibility('5a000000-0000-0000-0000-000000000001') where student_id = '2a000000-0000-0000-0000-000000000001'), 'student1 eligible after paying 70%');
select pg_temp.check((select array_length(reasons, 1) = 2 from get_exam_eligibility('5a000000-0000-0000-0000-000000000001') where student_id = '2a000000-0000-0000-0000-000000000002'), 'student2 fails attendance (25%) and fees (0%)');
select pg_temp.check((select instructions = 'Bring your ID card.' and controller_signature = 'Dr. Controller' and exam_type = 'SEE'
                      from get_student_exam_eligibility('2a000000-0000-0000-0000-000000000001')), 'student hall-ticket rules resolved for nearest session');
select pg_temp.check((select is_eligible and attendance_pct = 100 from get_student_exam_eligibility('2a000000-0000-0000-0000-000000000001', 'SEE')), 'student eligibility facts');
select pg_temp.check((select min_attendance = 75 and min_fee_paid_percent = 0 from get_exam_session_rules('B.Tech', 'MECH', 1, 'IA-1')), 'default rules when no session configured');

-- reschedule / cancel notifications
update exams set exam_date = current_date + 12 where id = '5a000000-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) = 2 from notifications where title = 'Exam schedule changed: SEE'), 'reschedule notifies section');
update exams set status = 'Cancelled' where id = '5a000000-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) = 2 from notifications where title = 'Exam cancelled: SEE'), 'cancellation notifies section');
update exams set exam_date = current_date + 12 where id = '5a000000-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) = 2 from notifications where title like 'Exam cancelled%'), 'no-op update sends nothing');

-- timetable change notifies section + teacher
select replace_section_timetable(array['4a000000-0000-0000-0000-000000000001']::uuid[],
  '[{"class_id":"4a000000-0000-0000-0000-000000000001","day_of_week":"Tuesday","start_time":"10:00:00","end_time":"11:00:00"}]');
select pg_temp.check((select count(*) = 3 from notifications where title = 'Timetable updated' and user_id::text like '0a%'), 'timetable change notifies 2 students + teacher');

-- hostel complaint → hostel staff
insert into hostels (id, name, type) values ('6a000000-0000-0000-0000-000000000001', 'South', 'Girls');
insert into hostel_complaints (student_id, hostel_id, description) values ('2a000000-0000-0000-0000-000000000002', '6a000000-0000-0000-0000-000000000001', 'Leaking tap');
select pg_temp.check(exists (select 1 from notifications where user_id = '0a000000-0000-0000-0000-000000000001' and title = 'New hostel complaint: South'), 'hostel staff notified of new complaint');

-- marks overview
insert into marks (student_id, class_id, ia1, ia2, other, see) values
  ('2a000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001', 40, 40, 20, 100),
  ('2a000000-0000-0000-0000-000000000002', '4a000000-0000-0000-0000-000000000001', 10, null, null, null);
select pg_temp.check((get_marks_overview()->>'marks_entered')::int >= 2 and (get_marks_overview()->'grade_distribution') @> '[{"grade":"O"}]', 'marks overview aggregates');

-- login history on admin dashboard
insert into login_events (user_id, role) values ('0a000000-0000-0000-0000-000000000003', 'student');
select pg_temp.check((get_admin_dashboard_stats(0)->'recent_logins'->0->>'full_name') = 'Max One', 'recent logins come from login_events');

-- maintenance: past exams completed, book due tomorrow, assignment due soon, drive closing in 2 days
insert into exams (course_id, program, branch, semester, exam_type, exam_date) values ('3a000000-0000-0000-0000-000000000001', 'B.Tech', 'MECH', 1, 'IA-1', current_date - 1);
insert into books (id, title, total_copies, available_copies) values ('7a000000-0000-0000-0000-000000000001', 'Statics', 1, 1);
select issue_book('7a000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000003', 1);
insert into classrooms (id, name, owner_id, owner_name, invite_code) values ('8a000000-0000-0000-0000-000000000001', 'Mech Room', '0a000000-0000-0000-0000-000000000002', 'Mel', 'MECH777');
select join_classroom('MECH777', '0a000000-0000-0000-0000-000000000003');
select join_classroom('MECH777', '0a000000-0000-0000-0000-000000000004');
insert into classroom_assignments (id, classroom_id, title, due_date) values ('8b000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000001', 'Lab report', now() + interval '6 hours');
insert into classroom_submissions (assignment_id, classroom_id, student_id) values ('8b000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000003');
insert into placement_opportunities (company_name, role_title, deadline) values ('Gearworks', 'Design Engineer', current_date + 2);
insert into placement_applications (student_id, opportunity_id) select '2a000000-0000-0000-0000-000000000001', id from placement_opportunities where company_name = 'Gearworks';

select pg_temp.check((run_daily_maintenance()->>'completed_exams')::int >= 1, 'maintenance completes past exams');
select pg_temp.check(exists (select 1 from notifications where user_id = '0a000000-0000-0000-0000-000000000003' and title = 'Library book due tomorrow'), 'due-tomorrow library reminder');
select pg_temp.check((select count(*) = 1 from notifications where title = 'Assignment due soon: Lab report'), 'assignment reminder only to non-submitter');
select pg_temp.check(exists (select 1 from notifications where user_id = '0a000000-0000-0000-0000-000000000004' and title = 'Last 2 days to apply: Gearworks')
                     and not exists (select 1 from notifications where user_id = '0a000000-0000-0000-0000-000000000003' and title = 'Last 2 days to apply: Gearworks'),
                     'drive deadline reminder skips students who applied');

-- RLS on the new tables
set role authenticated;
set request.jwt.claim.sub = '0a000000-0000-0000-0000-000000000003';
do $$ begin
  perform 1 from login_events;
  raise exception 'login_events readable';
exception when insufficient_privilege then raise notice 'ok  login_events hidden from browsers'; end $$;
select pg_temp.check((select count(*) = 0 from exam_sessions), 'exam_sessions not exposed to browsers');
reset role;
