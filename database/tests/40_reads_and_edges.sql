\set ON_ERROR_STOP 1
set client_min_messages = notice;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if;
  raise notice 'ok  %', label;
end $$;

-- Read helpers used by the server actions (run after 10_functional + 20_automation).
select pg_temp.check((select count(*) >= 1 from get_section_student_counts() where program = 'B.Tech' and branch = 'MECH'), 'get_section_student_counts');
select pg_temp.check(exists (select 1 from get_distinct_sections('B.Tech', 'MECH') where section = 'A'), 'get_distinct_sections');
select pg_temp.check((select total_classes = 4 and present_classes = 4 from get_student_attendance_totals('2a000000-0000-0000-0000-000000000001')), 'get_student_attendance_totals');
select pg_temp.check((select count(*) >= 1 and bool_and(percentage between 0 and 100) from get_student_monthly_attendance('2a000000-0000-0000-0000-000000000001')), 'get_student_monthly_attendance');
select pg_temp.check(get_unallocated_hosteler_count() >= 1, 'get_unallocated_hosteler_count (hosteler without a bed)');
select pg_temp.check(get_fee_amount('B.Tech', 'college', 2) = 175000 and get_fee_amount('MBA', 'college', 1) = 150000, 'get_fee_amount precedence');
select pg_temp.check(ensure_current_term() = ensure_current_term(), 'ensure_current_term stable');
select pg_temp.check(increment_counter('legacy') = 1 and next_sequence('legacy') = 2, 'increment_counter alias shares sequence');
select pg_temp.check(grade_for_total(89) = 'A+' and grade_for_total(39) = 'F' and grade_point('B+') = 7, 'grade scale boundaries');
select pg_temp.check(program_max_semesters('MBA') = 4 and program_max_semesters('B.Tech') = 8 and program_max_semesters('MBBS') = 10, 'program semester limits');
select pg_temp.check(student_cgpa('2a000000-0000-0000-0000-000000000001') = 10, 'student_cgpa');
select pg_temp.check(notify_users(array['0a000000-0000-0000-0000-000000000003']::uuid[], 'Direct', 'msg') = 1, 'notify_users');

-- notification preference respected
update profiles set notification_enabled = false where id = '0a000000-0000-0000-0000-000000000004';
select pg_temp.check(notify_users(array['0a000000-0000-0000-0000-000000000004']::uuid[], 'Muted', 'msg') = 0, 'opted-out users receive nothing');
update profiles set notification_enabled = true where id = '0a000000-0000-0000-0000-000000000004';

-- rate limiter: 3 allowed, 4th refused, separate keys independent
select pg_temp.check(hit_rate_limit('t:a', 3, 60) and hit_rate_limit('t:a', 3, 60) and hit_rate_limit('t:a', 3, 60), 'rate limit allows up to the limit');
select pg_temp.check(not hit_rate_limit('t:a', 3, 60), 'rate limit refuses over the limit');
select pg_temp.check(hit_rate_limit('t:b', 3, 60), 'rate limit keys are independent');

-- graduation path: MBA student in final semester with all courses passed
insert into auth.users (id, email) values ('0c000000-0000-0000-0000-000000000001', 'mba@x.edu');
insert into profiles (id, role, full_name, email) values ('0c000000-0000-0000-0000-000000000001', 'student', 'Grad Student', 'mba@x.edu');
insert into students (id, profile_id, college_id, program, branch, section, current_semester, current_year)
values ('2c000000-0000-0000-0000-000000000001', '0c000000-0000-0000-0000-000000000001', 'MBA001', 'MBA', 'Finance', 'A', 4, 2);
select pg_temp.check((select graduated from promote_students(array['2c000000-0000-0000-0000-000000000001']::uuid[], null, '2026-2027')), 'final-semester promotion graduates');
select pg_temp.check((select is_graduated from students where id = '2c000000-0000-0000-0000-000000000001'), 'student flagged graduated');
select pg_temp.check(not (select success from promote_students(array['2c000000-0000-0000-0000-000000000001']::uuid[], null, '2026-2027')), 'graduated student cannot be promoted again');
select pg_temp.check(exists (select 1 from notifications where user_id = '0c000000-0000-0000-0000-000000000001' and title like 'Congratulations%'), 'graduation notification');
select pg_temp.check((select count(*) = 0 from get_section_student_counts() where program = 'MBA'), 'graduates excluded from rosters');
select pg_temp.check((apply_to_opportunity('2c000000-0000-0000-0000-000000000001', (select id from placement_opportunities where company_name = 'Acme'))->>'success')::boolean = false, 'graduates cannot apply');

-- resumes table + RLS
insert into resumes (student_id, data) values ('2a000000-0000-0000-0000-000000000001', '{"name":"Max One"}');
set role authenticated;
set request.jwt.claim.sub = '0a000000-0000-0000-0000-000000000003';
select pg_temp.check((select count(*) = 1 from resumes), 'student reads own resume');
set request.jwt.claim.sub = '0a000000-0000-0000-0000-000000000004';
select pg_temp.check((select count(*) = 0 from resumes), 'other students cannot read it');
select pg_temp.check(current_app_role() = 'student', 'current_app_role');
reset role;

-- payments cannot be edited; deleting one reverses it
do $$ begin
  update fee_payments set amount = 1;
  raise exception 'payment edited';
exception when raise_exception then
  if sqlerrm = 'payment edited' then raise; end if;
  raise notice 'ok  fee payments immutable';
end $$;
select pg_temp.check((select paid_amount from fees where student_id = '2a000000-0000-0000-0000-000000000001' and fee_type = 'college' and study_year = 1) = 105000, 'paid before reversal');
delete from fee_payments where id = (select fp.id from fee_payments fp join fees f on f.id = fp.fee_id
                                       where f.student_id = '2a000000-0000-0000-0000-000000000001' and fp.amount = 30000);
select pg_temp.check((select paid_amount = 75000 and status = 'Partial' from fees where student_id = '2a000000-0000-0000-0000-000000000001' and fee_type = 'college' and study_year = 1), 'deleting a payment reverses it');
