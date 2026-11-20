-- =============================================================================
-- EduERP — 05_seed.sql
-- Reference data and scheduled jobs. Safe to re-run.
-- User accounts are NOT created here: create the first super admin from the
-- /admin-signup page (allowed only while no super admin exists).
-- =============================================================================

-- Current academic term.
select public.ensure_current_term();

-- Default fee amounts (edit to match the institution; program-specific rows override these).
insert into public.fee_structures (program, fee_type, study_year, amount) values
  (null, 'college', null, 150000),
  (null, 'hostel',  null,  50000)
on conflict do nothing;

-- Bill current-year fee demands for any existing students.
select public.generate_fee_demands(null);

-- Backlogs for failed marks recorded before the backlog trigger existed.
insert into public.backlogs (student_id, course_id, class_id, semester, study_year)
select m.student_id, c.course_id, m.class_id, c.semester, greatest(1, ceil(c.semester / 2.0))::smallint
from public.marks m join public.classes c on c.id = m.class_id
where m.grade = 'F'
on conflict (student_id, course_id) do nothing;

-- Reference numbers for rows created before the generators existed.
update public.fee_payments           set receipt_no     = public.ref_number('RCP', 'receipt_no_seq', 7)       where receipt_no is null;
update public.hostel_allocations     set allotment_no   = public.ref_number('HAL', 'allotment_no_seq', 6)     where allotment_no is null;
update public.hostel_complaints      set ticket_no      = public.ref_number('HCT', 'complaint_no_seq', 6)     where ticket_no is null;
update public.book_issues            set issue_no       = public.ref_number('LIB', 'issue_no_seq', 6)         where issue_no is null;
update public.placement_applications set application_no = public.ref_number('APP', 'application_no_seq', 6)   where application_no is null;
update public.exams e set exam_code = c.code || '-' || public.exam_session_code(e.exam_type) || '-' || e.academic_year || '-' || e.semester
  from public.courses c where c.id = e.course_id and e.exam_code is null;

-- Daily maintenance at 01:00 (closes expired drives, overdue/fee/attendance reminders, cleanup).
-- Requires the pg_cron extension (Supabase: Database → Extensions → pg_cron).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'eduerp-daily-maintenance';
    perform cron.schedule('eduerp-daily-maintenance', '0 1 * * *', 'select public.run_daily_maintenance()');
  else
    raise notice 'pg_cron not available — schedule "select public.run_daily_maintenance()" daily by other means.';
  end if;
exception when others then
  raise notice 'Could not schedule maintenance job: %', sqlerrm;
end;
$$;

-- Back-fill JWT claims for any users that existed before 03_triggers.sql was applied.
do $$
declare
  r record;
begin
  for r in select id from public.profiles loop
    perform public.sync_auth_claims(r.id);
  end loop;
end;
$$;
