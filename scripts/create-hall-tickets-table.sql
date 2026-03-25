-- Create hall_tickets table in Supabase
-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

create table if not exists public.hall_tickets (
  id            text primary key,
  "studentId"   text not null,
  "studentName" text,
  "studentPhotoUrl" text,
  "studentCollegeId" text,
  program       text,
  branch        text,
  year          integer,
  semester      integer,
  "examSessionName" text,
  exams         jsonb,
  instructions  text,
  "controllerSignaturePlaceholder" text,
  eligibility   jsonb,
  "generatedDate" text,
  "createdAt"   text,
  "updatedAt"   text
);

-- Drop the strict policies if they exist from the previous run
drop policy if exists "Allow read for authenticated users" on public.hall_tickets;
drop policy if exists "Allow all for service role" on public.hall_tickets;

-- Create an open policy that matches the rest of the tables (since the app uses the anon key everywhere)
create policy "Allow all operations for anon"
  on public.hall_tickets for all
  using (true)
  with check (true);
