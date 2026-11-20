\set ON_ERROR_STOP 1
set client_min_messages = notice;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if;
  raise notice 'ok  %', label;
end $$;

-- staff status from the form
update teachers set status = 'Terminated' where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.check((select status = 'Terminated' from teachers where id = '10000000-0000-0000-0000-000000000001'), 'staff status Terminated accepted');
update teachers set status = 'Active';

-- give student 2 everything: fee + payment, hostel bed, open library loan, application, classroom membership
select record_fee_payment('20000000-0000-0000-0000-000000000002', 'hostel', 1, 1000, 'Cash', null, null, null);
insert into hostel_rooms (id, hostel_id, room_number, capacity) values ('51000000-0000-0000-0000-0000000000bb', '50000000-0000-0000-0000-000000000001', '201', 2);
select allocate_hostel_room('51000000-0000-0000-0000-0000000000bb', '20000000-0000-0000-0000-000000000002');
insert into books (id, title, total_copies, available_copies) values ('60000000-0000-0000-0000-0000000000bb', 'TAOCP', 2, 2);
select issue_book('60000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-000000000004', 14);
select join_classroom('ABC1234', '00000000-0000-0000-0000-000000000004');
select pg_temp.check((select occupied = 1 from hostel_rooms where id = '51000000-0000-0000-0000-0000000000bb'), 'setup: bed occupied');
select pg_temp.check((select available_copies = 1 from books where id = '60000000-0000-0000-0000-0000000000bb'), 'setup: copy on loan');
select pg_temp.check((select member_count = 3 from classrooms where invite_code = 'ABC1234'), 'setup: member joined');

-- delete the login (what deleteStudent does) → everything cascades consistently
delete from auth.users where id = '00000000-0000-0000-0000-000000000004';
select pg_temp.check(not exists (select 1 from students where id = '20000000-0000-0000-0000-000000000002'), 'student row removed');
select pg_temp.check(not exists (select 1 from fees where student_id = '20000000-0000-0000-0000-000000000002'), 'fees + payments removed');
select pg_temp.check((select occupied = 0 from hostel_rooms where id = '51000000-0000-0000-0000-0000000000bb'), 'bed freed by cascade');
select pg_temp.check((select available_copies = 2 from books where id = '60000000-0000-0000-0000-0000000000bb'), 'loaned copy returned to shelf by cascade');
select pg_temp.check((select member_count = 2 from classrooms where invite_code = 'ABC1234'), 'member_count decremented by cascade');
select pg_temp.check(exists (select 1 from audit_log where table_name = 'students' and action = 'DELETE'), 'student deletion audited');

-- delete a teacher login: classes keep existing, teacher unassigned; owned classroom removed
delete from auth.users where id = '00000000-0000-0000-0000-000000000002';
select pg_temp.check((select bool_and(teacher_id is null) from classes where id::text like '40000000%'), 'classes unassigned when teacher deleted');
select pg_temp.check(not exists (select 1 from classrooms where invite_code = 'ABC1234'), 'teacher-owned classroom removed');
select pg_temp.check(exists (select 1 from attendance), 'attendance history preserved');

-- delete a hostel that still has residents
select allocate_hostel_room('51000000-0000-0000-0000-0000000000bb', '20000000-0000-0000-0000-000000000001');
delete from hostels where id = '50000000-0000-0000-0000-000000000001';
select pg_temp.check(not exists (select 1 from hostel_allocations), 'hostel delete cascades rooms + allocations');

-- class with attendance cannot be deleted (academic records protected)
do $$ begin
  delete from classes where id = '40000000-0000-0000-0000-000000000001';
  raise exception 'class with records deleted';
exception when foreign_key_violation then raise notice 'ok  class with attendance/marks protected'; end $$;

-- course with exams cannot be deleted
do $$ begin
  delete from courses where id = '30000000-0000-0000-0000-000000000001';
  raise exception 'course deleted';
exception when foreign_key_violation then raise notice 'ok  course in use protected'; end $$;

-- book deletion with history is allowed (loans cascade)
select issue_book('60000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-000000000003', 7);
select return_book((select id from book_issues where book_id = '60000000-0000-0000-0000-0000000000bb' and status = 'Issued'));
delete from books where id = '60000000-0000-0000-0000-0000000000bb';
select pg_temp.check(not exists (select 1 from book_issues where book_id = '60000000-0000-0000-0000-0000000000bb'), 'returned-book history removed with book');

-- daily maintenance runs on a Monday path too
select pg_temp.check(run_daily_maintenance() ? 'purged_notifications', 'maintenance returns report');
