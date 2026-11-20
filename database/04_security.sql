-- =============================================================================
-- EduERP — 04_security.sql
-- Row Level Security, privileges, storage policies and realtime publication.
--
-- Model
--  * The server (Next.js server actions) uses the service_role key, which
--    bypasses RLS, and authorizes every call in src/lib/auth-guard.ts.
--  * The browser holds only the anon key + the user's JWT. RLS is enabled on
--    EVERY table, so the public key alone can read nothing; the few direct
--    browser reads (own profile in middleware, classroom realtime, storage
--    uploads) are opened by the narrow policies below.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (deny-by-default)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'students', 'teachers', 'employees', 'academic_terms', 'courses', 'classrooms', 'classes',
    'timetables', 'attendance', 'attendance_sessions', 'marks', 'exams', 'exam_marks', 'promotions',
    'fee_structures', 'fees', 'fee_payments', 'hostels', 'hostel_rooms', 'hostel_allocations',
    'hostel_complaints', 'hostel_menu', 'books', 'book_issues', 'placement_opportunities',
    'placement_applications', 'notifications', 'classroom_members', 'classroom_posts',
    'classroom_assignments', 'classroom_submissions', 'classroom_notes', 'counters',
    'dashboard_cache', 'audit_log', 'exam_sessions', 'login_events', 'rate_limits', 'resumes', 'backlogs', 'backlog_attempts'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Table privileges: browsers may only SELECT (plus the column-limited UPDATEs below).
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Users may change only safe columns of their own profile / notifications.
grant update (full_name, phone, profile_picture_url, notification_enabled) on public.profiles to authenticated;
grant update (is_read) on public.notifications to authenticated;

-- Sensitive tables are never readable from the browser, even with a policy mistake.
revoke select on public.audit_log, public.counters, public.dashboard_cache, public.login_events, public.rate_limits from authenticated;

-- ---------------------------------------------------------------------------
-- Function privileges: everything server-only, except helpers used by policies.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on function public.is_classroom_member(uuid) to authenticated;
grant execute on function public.current_app_role() to authenticated;

-- Future functions/tables created by migrations follow the same rule.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------------------
-- Policies (authenticated browser access)
-- ---------------------------------------------------------------------------

-- profiles: own row (middleware fallback, settings).
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- employees / students / teachers: own row.
drop policy if exists employees_self_select on public.employees;
create policy employees_self_select on public.employees for select to authenticated using (profile_id = auth.uid());
drop policy if exists students_self_select on public.students;
create policy students_self_select on public.students for select to authenticated using (profile_id = auth.uid());
drop policy if exists teachers_self_select on public.teachers;
create policy teachers_self_select on public.teachers for select to authenticated using (profile_id = auth.uid());

-- notifications: own inbox (read + mark as read).
drop policy if exists notifications_self_select on public.notifications;
create policy notifications_self_select on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_self_update on public.notifications;
create policy notifications_self_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Public catalogues for any signed-in user.
drop policy if exists courses_read on public.courses;
create policy courses_read on public.courses for select to authenticated using (true);
drop policy if exists books_read on public.books;
create policy books_read on public.books for select to authenticated using (true);
drop policy if exists opportunities_read on public.placement_opportunities;
create policy opportunities_read on public.placement_opportunities for select to authenticated using (true);
drop policy if exists academic_terms_read on public.academic_terms;
create policy academic_terms_read on public.academic_terms for select to authenticated using (true);

-- Classroom data: members only (this is what Supabase Realtime checks before streaming rows).
drop policy if exists classrooms_member_read on public.classrooms;
create policy classrooms_member_read on public.classrooms for select to authenticated using (public.is_classroom_member(id));
drop policy if exists classroom_members_read on public.classroom_members;
create policy classroom_members_read on public.classroom_members for select to authenticated using (public.is_classroom_member(classroom_id));
drop policy if exists classroom_posts_read on public.classroom_posts;
create policy classroom_posts_read on public.classroom_posts for select to authenticated using (public.is_classroom_member(classroom_id));
drop policy if exists classroom_assignments_read on public.classroom_assignments;
create policy classroom_assignments_read on public.classroom_assignments for select to authenticated using (public.is_classroom_member(classroom_id));
drop policy if exists classroom_notes_read on public.classroom_notes;
create policy classroom_notes_read on public.classroom_notes for select to authenticated using (public.is_classroom_member(classroom_id));
-- Students see only their own submissions; the owner sees all of their room's.
drop policy if exists classroom_submissions_read on public.classroom_submissions;
create policy classroom_submissions_read on public.classroom_submissions for select to authenticated
  using (student_id = auth.uid()
         or exists (select 1 from public.classrooms c where c.id = classroom_id and c.owner_id = auth.uid()));

-- Own academic records.
drop policy if exists attendance_self_read on public.attendance;
create policy attendance_self_read on public.attendance for select to authenticated
  using (student_id in (select id from public.students where profile_id = auth.uid()));
drop policy if exists marks_self_read on public.marks;
create policy marks_self_read on public.marks for select to authenticated
  using (student_id in (select id from public.students where profile_id = auth.uid()));
drop policy if exists fees_self_read on public.fees;
create policy fees_self_read on public.fees for select to authenticated
  using (student_id in (select id from public.students where profile_id = auth.uid()));
drop policy if exists applications_self_read on public.placement_applications;
create policy applications_self_read on public.placement_applications for select to authenticated
  using (student_id in (select id from public.students where profile_id = auth.uid()));
drop policy if exists backlogs_self_read on public.backlogs;
create policy backlogs_self_read on public.backlogs for select to authenticated
  using (student_id in (select id from public.students where profile_id = auth.uid()));
drop policy if exists backlog_attempts_self_read on public.backlog_attempts;
create policy backlog_attempts_self_read on public.backlog_attempts for select to authenticated
  using (backlog_id in (select b.id from public.backlogs b join public.students s on s.id = b.student_id where s.profile_id = auth.uid()));
drop policy if exists resumes_self_read on public.resumes;
create policy resumes_self_read on public.resumes for select to authenticated
  using (student_id in (select id from public.students where profile_id = auth.uid()));
drop policy if exists book_issues_self_read on public.book_issues;
create policy book_issues_self_read on public.book_issues for select to authenticated using (borrower_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: bucket "submissions" (classroom notes + assignment uploads)
--   notes/{classroomId}/{file}                      — classroom owner uploads
--   {classroomId}/{assignmentId}/{userId}/{file}    — student uploads own work
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('submissions', 'submissions', true, 26214400, array[
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'image/png', 'image/jpeg'])
    on conflict (id) do update
      set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "submissions: owners upload notes" on storage.objects';
    execute $p$create policy "submissions: owners upload notes" on storage.objects for insert to authenticated
      with check (bucket_id = 'submissions'
                  and (storage.foldername(name))[1] = 'notes'
                  and exists (select 1 from public.classrooms c
                              where c.id::text = (storage.foldername(name))[2] and c.owner_id = auth.uid()))$p$;

    execute 'drop policy if exists "submissions: students upload own work" on storage.objects';
    execute $p$create policy "submissions: students upload own work" on storage.objects for insert to authenticated
      with check (bucket_id = 'submissions'
                  and (storage.foldername(name))[3] = auth.uid()::text
                  and public.is_classroom_member(((storage.foldername(name))[1])::uuid))$p$;

    -- upsert:true in the upload helpers needs UPDATE on the uploader's own objects.
    execute 'drop policy if exists "submissions: uploader can replace" on storage.objects';
    execute $p$create policy "submissions: uploader can replace" on storage.objects for update to authenticated
      using (bucket_id = 'submissions' and owner = auth.uid())$p$;

    execute 'drop policy if exists "submissions: uploader can delete" on storage.objects';
    execute $p$create policy "submissions: uploader can delete" on storage.objects for delete to authenticated
      using (bucket_id = 'submissions' and owner = auth.uid())$p$;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime: classroom stream (+ notifications for future live badges)
-- ---------------------------------------------------------------------------
alter table public.classroom_posts replica identity full;   -- DELETE events carry classroom_id for the channel filter

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'classroom_posts') then
      execute 'alter publication supabase_realtime add table public.classroom_posts';
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
      execute 'alter publication supabase_realtime add table public.notifications';
    end if;
  end if;
end;
$$;
