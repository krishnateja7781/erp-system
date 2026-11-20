\set ON_ERROR_STOP 1
\timing on
-- 5,000 students in ONE section, all hitting the same events.
insert into auth.users (id, email)
select ('aaaaaaaa-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'load' || g || '@x.edu' from generate_series(1, 5000) g;
insert into profiles (id, role, full_name, email, id_code)
select ('aaaaaaaa-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'student', 'Load ' || g, 'load' || g || '@x.edu', 'LOAD' || g from generate_series(1, 5000) g;
insert into students (id, profile_id, college_id, program, branch, section, current_semester)
select ('bbbbbbbb-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, ('aaaaaaaa-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       'LOAD' || g, 'B.Tech', 'ECE', 'A', 3 from generate_series(1, 5000) g;

insert into courses (id, code, name, program, branch, semester, credits) values ('cccccccc-0000-0000-0000-000000000001', 'BT3ECE001', 'Signals', 'B.Tech', 'ECE', 3, 4);
insert into classes (id, course_id, teacher_id, program, branch, section, year, academic_year, semester)
values ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'B.Tech', 'ECE', 'A', 2, '2', 3);
insert into classrooms (id, name, owner_id, owner_name, invite_code) values ('eeeeeeee-0000-0000-0000-000000000001', 'Signals Room', '00000000-0000-0000-0000-000000000002', 'Tara', 'LOAD123');
insert into placement_opportunities (id, company_name, role_title, deadline) values ('ffffffff-0000-0000-0000-000000000001', 'MegaCorp', 'Engineer', current_date + 30);

\echo '--- one teacher marks attendance for 5,000 students (single upsert)'
insert into attendance (class_id, student_id, teacher_id, date, period, status)
select 'dddddddd-0000-0000-0000-000000000001', s.id, '00000000-0000-0000-0000-000000000002', current_date - 1, 1,
       case when random() < .85 then 'Present' else 'Absent' end
from students s where s.branch = 'ECE'
on conflict (class_id, student_id, date, period) do update set status = excluded.status;

\echo '--- same save retried (idempotent)'
insert into attendance (class_id, student_id, teacher_id, date, period, status)
select 'dddddddd-0000-0000-0000-000000000001', s.id, '00000000-0000-0000-0000-000000000002', current_date - 1, 1, 'Present'
from students s where s.branch = 'ECE'
on conflict (class_id, student_id, date, period) do update set status = excluded.status;

\echo '--- marks for 5,000 students in one upsert (grades + 5,000 result notifications)'
insert into marks (student_id, class_id, ia1, ia2, other, see)
select s.id, 'dddddddd-0000-0000-0000-000000000001', 30, 30, 15, (random() * 100)::int from students s where s.branch = 'ECE'
on conflict (student_id, class_id) do update set see = excluded.see;

\echo '--- exam session published to 5,000 students'
insert into exams (course_id, program, branch, semester, exam_type, exam_date) values ('cccccccc-0000-0000-0000-000000000001', 'B.Tech', 'ECE', 3, 'Final', current_date + 5);

\echo '--- broadcast to every user'
select broadcast_notification(null, 'Load test', 'Hello everyone', 'info', null, null);

\echo '--- read paths'
select count(*) as roster from get_section_attendance_summary('B.Tech', 'ECE', 3, 'A', null, null, null);
select count(*) as eligibility_rows, count(*) filter (where is_eligible) as eligible from get_exam_eligibility((select id from exams where exam_type = 'Final'), 75);
select (get_admin_dashboard_stats(0)->>'total_students') as dashboard_students;
select sum(student_count) as session_rows from attendance_sessions where class_id = 'dddddddd-0000-0000-0000-000000000001';
analyze;
