# EduERP

### Enterprise Resource Planning System for Educational Institutions

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

A college ERP with four role portals (super admin, employee, teacher, student), real-time virtual classrooms, and a hardened PostgreSQL backend that stays consistent when thousands of users act at the same moment.

---

## Portals

### Super Admin
Institution dashboard, student / teacher / staff directories and accounts, courses and classes, timetables, exams and hall tickets, marks, backlog management, attendance analytics (CSV import/export), fees, hostels, library, placement drives and applications, bulk semester promotion, and announcements.

<img width="1600" height="674" alt="Super admin dashboard" src="https://github.com/user-attachments/assets/b08029af-1f4d-41af-93c8-3c366e1f8a70" />

### Teacher
Dashboard with today's classes and pending attendance, period-wise attendance, IA-1 / IA-2 / Others / SEE marks entry with sequential locking, exam eligibility lists, student profiles, and virtual classrooms (stream, classwork, notes, members).

<img width="1600" height="732" alt="Teacher portal" src="https://github.com/user-attachments/assets/adc365a7-256c-478b-b1eb-c0e4b5c16513" />

### Student
Attendance (per course and day-wise), marks with semester GPA, a Backlogs page (shown only while a backlog is active, with each subject's backlog count and re-exam history), exam timetable and hall ticket, fees and invoices, hostel room / menu / complaints, library, placements and internships, applications tracker, resume builder (PDF), performance charts, classrooms, and a weekly timetable export (.ics).

<img width="1600" height="728" alt="Student portal" src="https://github.com/user-attachments/assets/f3acbe2a-2932-4f4e-a29a-eba9904ac341" />

### Employee (one department each)
| `employee_type` | Module |
|---|---|
| `fee_management` | `/employee/fees` — fee collection and dues |
| `hostel_management` | `/employee/hostel` — hostels, rooms, allocation, hostel fees, food menu, complaints |
| `student_staff_management` | `/employee/users`, `/employee/students`, `/employee/teachers` — accounts and directories |
| `exam_marks_management` | `/employee/exams` — courses, classes, exam schedules, marks, backlogs and re-exam results, timetables |
| `library_management` | `/employee/library` — catalogue, Google Books import, issue / return with fines |

<img width="1600" height="725" alt="Employee portal" src="https://github.com/user-attachments/assets/d769767e-ae4e-4cbd-86cd-79aaf5667fa3" />

---

## Architecture

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript (strict, type errors fail the build) |
| Data | Supabase PostgreSQL — SQL in [`database/`](database) |
| Auth | Supabase Auth (JWT validated with `getUser()` in middleware and every server action) |
| Realtime | Supabase Realtime on `classroom_posts` (polling only as a fallback when the socket is down) |
| UI | Tailwind CSS, Radix UI, Recharts, React Hook Form + Zod, jsPDF + html2canvas |

### Security model — three independent layers
1. **Middleware** (`middleware.ts`) — validates the session and routes by role. Role and employee department are mirrored into the JWT (`app_metadata`) by a database trigger, so the common path costs no extra query. Each employee can reach only their own department's module.
2. **Server actions** (`src/actions/*`) — every action calls `src/lib/auth-guard.ts` (`requireRole`, `authorize`, `requireStudentAccess`, `assertClassAccess`) before touching data. Identity always comes from the session, never from client-supplied ids: students can only read their own records, teachers only their own classes and classrooms.
3. **Database** — Row Level Security is enabled on every table (deny-by-default). The public anon key can read nothing; signed-in browsers can read only their own rows and classrooms they belong to. Privileged functions are executable only by the server's `service_role`.

### Built for load (5,000 users on the same event)
* **Idempotent writes** — unique keys back every upsert (attendance per period, marks per class, one submission per assignment, one application per drive, one membership per classroom). Retries and double-clicks cannot create duplicates.
* **Atomic, row-locked operations in SQL** — fee payments (`record_fee_payment`, rejects overpayment and duplicate transaction ids), hostel allocation (`allocate_hostel_room`, capacity also enforced by a `CHECK`), library issue/return, classroom joins, timetable replacement (rejects teacher double-booking), and batch promotion (`promote_students`, one call for any number of students).
* **Set-based fan-out** — announcements, exam publication, results, new placement drives and new assignments notify thousands of users with a single `INSERT … SELECT` from statement-level triggers.
* **Aggregates in SQL**, not in JavaScript — dashboards, attendance roll-ups and exam eligibility. Dashboard stats are cached for 60 s to absorb refresh storms. Large listings page past PostgREST's 1,000-row cap (`fetchAllRows`).
* **Rate-limited public endpoints** — sign-in, self-registration, admin bootstrap and password reset are throttled per network and per account in SQL (`hit_rate_limit`).
* **Verified** — the SQL was executed against PostgreSQL 17 with 5,000 students in one section and 50 concurrent clients (20,000 transactions, 0 failures, every invariant intact).

### Identifiers
Every person ID is **12 characters**, generated in SQL with one algorithm for all roles: `CATEGORY(3) + joining year(2) + SUBCATEGORY(2) + serial(5)`.

| Role | Example | Meaning |
|---|---|---|
| Student | `ENG26CS00442` | B.Tech (ENG), joined 2026, Computer Science, 442nd in that course and year |
| Teacher | `TCH26CS00017` | Teacher, joined 2026, CS department |
| Employee | `EMP26FE00003` | Employee, joined 2026, fee department |
| Super admin | `ADM26SA00001` | Administrator |

Program codes: `ENG` B.Tech, `MBA`, `MCA`, `LAW`, `MED` MBBS, `SCI` B.Sc, `COM` B.Com. Branch codes include `CS`, `CY` (Cyber Security), `DS`, `AI`, `EC`, `ME`, `CV` and `IT`.

The serial continues from the last one issued (00442 → 00443). All codes come from [`src/lib/academic-codes.ts`](src/lib/academic-codes.ts); after editing it, run `python scripts/gen-id-code-sql.py` to regenerate the matching SQL. Course, exam, hall-ticket, receipt and other reference numbers are listed in [`database/SQL_COVERAGE.md`](database/SQL_COVERAGE.md).

### Backlogs
- An **F** grade creates a backlog automatically, counted per subject.
- The exam department or an admin records re-exam (supplementary) results. Internals are kept and only the SEE is replaced; a pass clears the backlog and updates the marksheet and CGPA.
- Promotion carries backlogs forward, but graduation requires all of them to be cleared.

### Grading
| Component | Entered | Contributes |
|---|---|---|
| IA-1 | /40 | /20 |
| IA-2 | /40 | /20 |
| Others | /20 | /20 |
| SEE | /100 | /40 |

Total /100 → `O ≥ 90, A+ ≥ 80, A ≥ 70, B+ ≥ 60, B ≥ 55, C+ ≥ 50, C ≥ 45, P ≥ 40, F`. Total and grade are computed by a database trigger (`tg_marks_compute`), so they cannot be forged; a grade is final only once SEE is entered.

### Automatic notifications
Result published / updated · exam schedule published · fee payment receipt · hostel allocation and complaint updates · library issue, return, late fine and overdue reminder · new placement drive and application status changes · new classroom assignment and grading · promotion / graduation · staff announcements · weekly fee-due and low-attendance alerts.

---

## Database

`database/` holds the complete schema. Run the files **in order** in the Supabase SQL editor (each is idempotent and safe to re-run):

| File | Contents |
|---|---|
| `01_schema.sql` | 42 tables, constraints and indexes (every foreign key indexed) |
| `02_functions.sql` | Atomic operations, aggregates, eligibility, dashboards, daily maintenance |
| `03_triggers.sql` | Derived data, integrity, audit log, JWT claim sync, event notifications |
| `04_security.sql` | RLS policies, privileges, storage bucket + policies, realtime publication |
| `05_seed.sql` | Current academic term, default fee amounts, initial fee billing, daily pg_cron job |

[`database/SQL_COVERAGE.md`](database/SQL_COVERAGE.md) maps every page, role and automatic event to the SQL objects behind it.

**Tests** — `database/tests/run.sh` builds a throwaway database on a local PostgreSQL (never your Supabase project), applies the schema twice and runs 202 checks; `--load` adds the 5,000-student / 50-client concurrency run.

Main tables: `profiles`, `students`, `teachers`, `employees`, `academic_terms`, `courses`, `classes`, `timetables`, `attendance`, `attendance_sessions`, `marks`, `exams`, `exam_marks`, `promotions`, `fee_structures`, `fees`, `fee_payments`, `hostels`, `hostel_rooms`, `hostel_allocations`, `hostel_complaints`, `hostel_menu`, `books`, `book_issues`, `placement_opportunities`, `placement_applications`, `notifications`, `classrooms`, `classroom_members`, `classroom_posts`, `classroom_assignments`, `classroom_submissions`, `classroom_notes`, `exam_sessions`, `resumes`, `login_events`, `rate_limits`, `counters`, `dashboard_cache`, `audit_log`.

Fees are billed per **year of study**. Amounts live in `fee_structures` (program- and year-specific rows override the institution default seeded by `05_seed.sql`); demands are created automatically for new students, on promotion to a new year and when a student becomes a hosteler. Enable the **pg_cron** extension to run `run_daily_maintenance()` nightly (closes expired drives, reminders, cleanup).

---

## Getting started

Prerequisites: Node.js 20+ and a Supabase project.

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL, anon key and service-role key
```

1. Apply `database/01_schema.sql` … `05_seed.sql` in order.
2. In Supabase → Authentication → URL Configuration, add `<NEXT_PUBLIC_APP_URL>/auth/callback` to the redirect URLs (password reset).
3. Start the app and create the first super admin at `/admin-signup` (open only while no super admin exists; afterwards only a super admin can create another).

```bash
npm run dev
```

| Script | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (fails on type errors) |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

---

## Project structure

```
middleware.ts            Session check + role / department routing
database/                PostgreSQL schema, functions, triggers, security, seed
src/actions/             Server actions — the whole data layer (all authorized)
src/lib/auth-guard.ts    Caller resolution and permission checks
src/lib/accounts.ts      Account provisioning (server-only)
src/lib/grading.ts       Grade scale (mirrors the SQL trigger)
src/lib/db.ts            Paging / chunking helpers
src/app/(auth)/          Login, signup, admin signup, forgot / update password
src/app/(app)/           admin, employee, teacher, student portals
src/components/          Layout, shared pages, classroom tabs, library loans, UI kit
```

## License

Proprietary software developed for academic institutional use. All rights reserved.
