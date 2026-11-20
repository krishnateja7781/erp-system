\set ON_ERROR_STOP 1
set client_min_messages = notice;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if;
  raise notice 'ok  %', label;
end $$;

-- ---------- code tables (mirror src/lib/academic-codes.ts) ----------
select pg_temp.check(program_code('B.Tech') = 'ENG' and program_code('MBA') = 'MBA' and program_code('MCA') = 'MCA'
                     and program_code('Law') = 'LAW' and program_code('MBBS') = 'MED' and program_code('B.Sc') = 'SCI'
                     and program_code('B.Com') = 'COM', 'program category codes');
select pg_temp.check(branch_code('B.Tech', 'CSE') = 'CS' and branch_code('B.Tech', 'Cyber Security') = 'CY'
                     and branch_code('B.Tech', 'DS') = 'DS' and branch_code('B.Tech', 'AI&ML') = 'AI'
                     and branch_code('MBA', 'Finance') = 'FN' and branch_code('MCA', 'Computer Applications') = 'CA', 'branch codes');
select pg_temp.check(program_code('TCH Studies') = 'STU' and program_code('Admin Course') = 'STU' and program_code('Diploma') = 'DIP', 'unknown programs never use a staff category');
select pg_temp.check(department_code('CSE') = 'CS' and department_code('Accounts') = 'AC' and department_code(null) = 'GN', 'department codes');
select pg_temp.check(exam_session_code('SEE (semester end examinations)') = 'SEE' and exam_session_code('IA-1') = 'IA1', 'exam session codes');

-- ---------- one 12-character algorithm for every role ----------
select pg_temp.check(generate_college_id('B.Tech', 'CSE', 2026) = 'ENG26CS00001', 'first student of ENG26CS');
select pg_temp.check(generate_college_id('B.Tech', 'CSE', 2026) = 'ENG26CS00002', 'serial increments within course + year');
select pg_temp.check(generate_college_id('B.Tech', 'Cyber Security', 2026) = 'ENG26CY00001', 'separate serial per branch');
select pg_temp.check(generate_college_id('B.Tech', 'CSE', 2021) = 'ENG21CS00001', 'separate serial per joining year');
select pg_temp.check(length(generate_college_id('Law', 'General', 2025)) = 12, 'IDs are 12 characters');

-- continues after the highest existing serial: 00442 taken → next is 00443
insert into auth.users (id, email) values ('0d000000-0000-0000-0000-000000000001', 'manual@x.edu');
insert into profiles (id, role, full_name, email, id_code) values ('0d000000-0000-0000-0000-000000000001', 'student', 'Existing', 'manual@x.edu', 'ENG26DS00442');
insert into students (profile_id, college_id, program, branch) values ('0d000000-0000-0000-0000-000000000001', 'ENG26DS00442', 'B.Tech', 'DS');
select pg_temp.check(generate_college_id('B.Tech', 'DS', 2026) = 'ENG26DS00443', 'next serial after an existing 00442 is 00443');

-- insert without an ID → trigger assigns one
insert into auth.users (id, email) values ('0d000000-0000-0000-0000-000000000002', 'auto@x.edu');
insert into profiles (id, role, full_name, email) values ('0d000000-0000-0000-0000-000000000002', 'student', 'Auto', 'auto@x.edu');
insert into students (id, profile_id, program, branch, admitted_year) values ('2d000000-0000-0000-0000-000000000002', '0d000000-0000-0000-0000-000000000002', 'MBA', 'Finance', 2025);
select pg_temp.check((select college_id = 'MBA25FN00001' from students where id = '2d000000-0000-0000-0000-000000000002'), 'college ID assigned on insert');

select pg_temp.check(generate_staff_code('teacher', 'CSE', null, 2026) = 'TCH26CS00001', 'teacher: TCH + year + department');
select pg_temp.check(generate_staff_code('employee', 'Accounts', 'fee_management', 2026) = 'EMP26FE00001', 'employee: EMP + year + department type');
select pg_temp.check(generate_staff_code('super_admin', null, null, 2026) = 'ADM26SA00001', 'super admin: ADM + year + SA');
insert into auth.users (id, email) values ('0d000000-0000-0000-0000-000000000003', 'newteach@x.edu'), ('0d000000-0000-0000-0000-000000000004', 'newlib@x.edu');
insert into profiles (id, role, full_name, email) values ('0d000000-0000-0000-0000-000000000003', 'teacher', 'New T', 'newteach@x.edu'), ('0d000000-0000-0000-0000-000000000004', 'employee', 'New L', 'newlib@x.edu');
insert into teachers (profile_id, department, date_of_joining) values ('0d000000-0000-0000-0000-000000000003', 'MECH', '2025-07-01');
insert into employees (profile_id, employee_type, department) values ('0d000000-0000-0000-0000-000000000004', 'library_management', 'Library');
select pg_temp.check((select employee_code = 'TCH25ME00001' from teachers where profile_id = '0d000000-0000-0000-0000-000000000003'), 'teacher code assigned on insert (joining year)');
select pg_temp.check((select employee_code ~ '^EMP[0-9]{2}LB00001$' from employees where profile_id = '0d000000-0000-0000-0000-000000000004'), 'employee code assigned on insert');
select pg_temp.check((select bool_and(code ~ '^[A-Z]{3}[0-9]{2}[A-Z]{2}[0-9]{5}$') from (
    select college_id as code from students where college_id like 'ENG2%' or college_id like 'MBA25%'
    union all select employee_code from teachers where employee_code like 'TCH%'
    union all select employee_code from employees where employee_code like 'EMP%') t), 'all generated IDs match CCCYYSSNNNNN');

-- concurrent-style burst: 200 IDs in one prefix are unique and gap-free
select pg_temp.check((select count(distinct id) = 200 and max(id) = 'MCA26CA00200' from (select generate_college_id('MCA', 'Computer Applications', 2026) as id from generate_series(1, 200)) g), '200 sequential MCA IDs, unique, ending at 00200');

-- ---------- course / exam / references ----------
select pg_temp.check(generate_course_code('B.Tech', 'MECH', 1) = 'ENG1ME001', 'course code: program + semester + branch + serial');
insert into courses (id, name, program, branch, semester, credits) values ('3d000000-0000-0000-0000-000000000001', 'Thermo', 'B.Tech', 'MECH', 3, 4);
select pg_temp.check((select code = 'ENG3ME001' from courses where id = '3d000000-0000-0000-0000-000000000001'), 'course code assigned on insert');
insert into exams (id, course_id, program, branch, semester, exam_type, academic_year)
values ('5d000000-0000-0000-0000-000000000001', '3d000000-0000-0000-0000-000000000001', 'B.Tech', 'MECH', 3, 'SEE (semester end examinations)', '2026');
select pg_temp.check((select exam_code = 'ENG3ME001-SEE-2026' from exams where id = '5d000000-0000-0000-0000-000000000001'), 'exam code');
select pg_temp.check(hall_ticket_number('ENG24CS00042', 'SEE (semester end examinations)', '2026') = 'HT26SEEENG24CS00042', 'hall ticket number');
select pg_temp.check((select bool_and(receipt_no ~ '^RCP\d{11}$') and count(*) = count(distinct receipt_no) from fee_payments), 'every payment has a unique receipt number');
select pg_temp.check((select bool_and(ticket_no ~ '^HCT\d{10}$') from hostel_complaints), 'complaint ticket numbers');
select pg_temp.check((select bool_and(issue_no ~ '^LIB\d{10}$') from book_issues), 'library issue numbers');
select pg_temp.check((select bool_and(application_no ~ '^APP\d{10}$') from placement_applications), 'application numbers');
select pg_temp.check((select bool_and(allotment_no ~ '^HAL\d{10}$') from hostel_allocations), 'hostel allotment numbers');
select pg_temp.check((select hall_ticket_no = 'HT' || to_char(current_date, 'YY') || 'SEE' || 'MECH001' from get_student_exam_eligibility('2a000000-0000-0000-0000-000000000001', 'SEE')), 'eligibility returns the hall ticket number');

-- ---------- backlogs ----------
-- student m2 (2a..02) failed Mechanics? give a clean scenario: new class + two students
insert into classes (id, course_id, teacher_id, program, branch, section, year, academic_year, semester)
values ('4d000000-0000-0000-0000-000000000001', '3d000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'B.Tech', 'MECH', 'A', 2, '2', 3);
insert into marks (student_id, class_id, ia1, ia2, other, see) values
  ('2a000000-0000-0000-0000-000000000001', '4d000000-0000-0000-0000-000000000001', 10, 10, 5, 10),   -- 10+... = 19 → F
  ('2a000000-0000-0000-0000-000000000002', '4d000000-0000-0000-0000-000000000001', 30, 30, 15, 60);  -- 99/... pass
select pg_temp.check((select count(*) = 1 and bool_and(fail_count = 1 and status = 'Active') from backlogs where class_id = '4d000000-0000-0000-0000-000000000001'), 'F grade creates one backlog (count 1)');
select pg_temp.check(student_active_backlog_count('2a000000-0000-0000-0000-000000000001') >= 1, 'active backlog count');
select pg_temp.check(exists (select 1 from notifications where user_id = '0a000000-0000-0000-0000-000000000003' and title = 'Backlog recorded: ENG3ME001'), 'student notified of backlog');
-- re-saving the same F does not inflate the count
update marks set see = 12 where student_id = '2a000000-0000-0000-0000-000000000001' and class_id = '4d000000-0000-0000-0000-000000000001';
select pg_temp.check((select fail_count = 1 from backlogs where class_id = '4d000000-0000-0000-0000-000000000001'), 're-saving an F keeps the count');

-- failed re-exam → count 2
select pg_temp.check((record_backlog_attempt((select id from backlogs where class_id = '4d000000-0000-0000-0000-000000000001'), 20, 'Supplementary Dec')->>'passed')::boolean = false, 'failed re-exam recorded');
select pg_temp.check((select fail_count = 2 and status = 'Active' from backlogs where class_id = '4d000000-0000-0000-0000-000000000001'), 'failed re-exam increments backlog count');
select pg_temp.check((select attempt_no ~ '^SUP\d{10}$' from backlog_attempts limit 1), 'attempt number generated');
select pg_temp.check(not (record_backlog_attempt((select id from backlogs where class_id = '4d000000-0000-0000-0000-000000000001'), 101)->>'success')::boolean, 'SEE above 100 rejected');

-- passing re-exam → cleared, marks updated with internals kept
select pg_temp.check((record_backlog_attempt((select id from backlogs where class_id = '4d000000-0000-0000-0000-000000000001'), 100, 'Supplementary Jun')->>'passed')::boolean, 'passing re-exam');
select pg_temp.check((select status = 'Cleared' and cleared_grade is not null and fail_count = 2 from backlogs where class_id = '4d000000-0000-0000-0000-000000000001'), 'backlog cleared, history kept');
select pg_temp.check((select see = 100 and ia1 = 10 and grade <> 'F' from marks where student_id = '2a000000-0000-0000-0000-000000000001' and class_id = '4d000000-0000-0000-0000-000000000001'), 'marks updated with new SEE, internals kept');
select pg_temp.check(not (record_backlog_attempt((select id from backlogs where class_id = '4d000000-0000-0000-0000-000000000001'), 100)->>'success')::boolean, 'cannot re-exam a cleared backlog');
select pg_temp.check(exists (select 1 from notifications where title = 'Backlog cleared: ENG3ME001'), 'cleared notification');
select pg_temp.check((select count(*) = 2 from backlog_attempts b join backlogs k on k.id = b.backlog_id where k.class_id = '4d000000-0000-0000-0000-000000000001'), 'attempt history');

-- summary
select pg_temp.check((get_backlog_summary()->>'cleared_backlogs')::int >= 1 and (get_backlog_summary() ? 'top_subjects'), 'backlog summary');

-- promotion: failed course no longer blocks (carried as backlog) …
insert into auth.users (id, email) values ('0d000000-0000-0000-0000-000000000005', 'promo@x.edu');
insert into profiles (id, role, full_name, email) values ('0d000000-0000-0000-0000-000000000005', 'student', 'Promo', 'promo@x.edu');
insert into students (id, profile_id, program, branch, section, current_semester, current_year) values ('2d000000-0000-0000-0000-000000000005', '0d000000-0000-0000-0000-000000000005', 'B.Tech', 'MECH', 'A', 3, 2);
insert into marks (student_id, class_id, ia1, ia2, other, see) values ('2d000000-0000-0000-0000-000000000005', '4d000000-0000-0000-0000-000000000001', 0, 0, 0, 0);
select pg_temp.check((select success and to_semester = 4 from promote_students(array['2d000000-0000-0000-0000-000000000005']::uuid[], null, '2026')), 'failed course carried forward as backlog; promotion allowed');
-- … but graduation is blocked while backlogs remain
update students set current_semester = 8 where id = '2d000000-0000-0000-0000-000000000005';
select pg_temp.check((select not success and error like 'Cannot graduate%' and courses ? 'ENG3ME001' from promote_students(array['2d000000-0000-0000-0000-000000000005']::uuid[], null, '2026')), 'graduation blocked by active backlog');

-- RLS: student sees only own backlogs and attempts
set role authenticated;
set request.jwt.claim.sub = '0a000000-0000-0000-0000-000000000003';
select pg_temp.check((select count(*) >= 1 and bool_and(student_id = '2a000000-0000-0000-0000-000000000001') from backlogs), 'student reads own backlogs only');
select pg_temp.check((select count(*) = 2 from backlog_attempts), 'student reads own attempts');
set request.jwt.claim.sub = '0d000000-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) = 0 from backlogs), 'other student sees none');
reset role;

-- ---------- student status ----------
update students set status = 'Suspended' where id = '2d000000-0000-0000-0000-000000000002';
select pg_temp.check((select not is_graduated from students where id = '2d000000-0000-0000-0000-000000000002'), 'suspended is not graduated');
select pg_temp.check(not exists (select 1 from get_section_student_counts() where program = 'MBA' and branch = 'Finance'), 'suspended students leave rosters');
select pg_temp.check(((select promote_student('2d000000-0000-0000-0000-000000000002', null, '2026'))->>'error') like 'Student is not active%', 'inactive students cannot be promoted');
update students set status = 'Graduated' where id = '2d000000-0000-0000-0000-000000000002';
select pg_temp.check((select is_graduated from students where id = '2d000000-0000-0000-0000-000000000002'), 'status Graduated sets is_graduated');
update students set is_graduated = false where id = '2d000000-0000-0000-0000-000000000002';
select pg_temp.check((select status = 'Active' from students where id = '2d000000-0000-0000-0000-000000000002'), 'clearing is_graduated reactivates');
do $$ begin
  update students set status = 'Expelled' where id = '2d000000-0000-0000-0000-000000000002';
  raise exception 'bad status accepted';
exception when check_violation then raise notice 'ok  unknown status rejected'; end $$;
