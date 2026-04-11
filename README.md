ERP SYSTEM

### Enterprise Resource Planning System for Educational Institutions

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x_Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Google Genkit](https://img.shields.io/badge/Google_Genkit-1.28-4285F4?style=flat-square&logo=google&logoColor=white)](https://firebase.google.com/docs/genkit)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](LICENSE)

**A complete, production-grade college ERP — four role portals, real-time virtual classrooms,  
AI integration, and a 24-table PostgreSQL schema — all in a single serverless Next.js application.**

[Live Demo](https://erp-system-ashy-nu.vercel.app) · [Repository](https://github.com/krishnateja7781/erp-system)

</div>

---

## Features

### Authentication & Security
- **JWT Session Management** — Every request is authenticated server-side via `supabase.auth.getUser()` inside Next.js Edge Middleware; no client-side trust is assumed at any layer.
- **Role-Based Access Control (RBAC)** — Four distinct role namespaces (`super_admin`, `teacher`, `student`, `employee`) enforced simultaneously at the middleware layer and inside every individual Server Action.
- **Employee Sub-Type Routing** — Employees are further classified by `employee_type` (`fee_management`, `hostel_management`, `student_staff_management`, `exam_marks_management`, `library_management`), each locked to their specific route namespace. A fee manager cannot reach `/employee/exams` and vice versa.
- **Automatic Role Redirects** — On every request, middleware resolves the user's role from the `profiles` table and redirects unauthenticated or cross-role traffic before any page component begins rendering.
- **Bcrypt Password Hashing** — All credentials are hashed with `bcryptjs` v3 before storage. New accounts are provisioned exclusively through the Supabase Admin API using the service role client — never raw SQL.
- **iron-session Cookie Security** — Server-managed `httpOnly` session cookies via `iron-session` v8 prevent client-side session tampering.
- **Row Level Security (RLS)** — Database-level RLS policies on all classroom tables enforce a final, code-independent data isolation boundary.
- **HTTP Security Headers** — `X-Frame-Options: DENY` (clickjacking protection) and `X-Content-Type-Options: nosniff` (MIME sniffing protection) injected on every middleware response.
- **Unauthorized Route** — Dedicated `/unauthorized` page for unknown or missing roles avoids silent failures.
- **Environment Isolation** — `SUPABASE_SERVICE_ROLE_KEY`, `ERP_BACKEND_JWT_SECRET`, and `SMTP_PASS` carry no `NEXT_PUBLIC_` prefix and are never bundled into the client runtime.

### Super Admin Portal
- **Institutional Dashboard** — Aggregated metrics and activity summary across the entire institution.
- **User Management** — Full lifecycle management of student, teacher, and employee accounts (create, view, deactivate) via the Supabase Admin API.
- **Student Directory** — Searchable student roster with individual profile pages at `/admin/students/[studentId]`.
- **Teacher Directory** — Full faculty listing with individual teacher profile pages at `/admin/teachers/[teacherId]`.
- **Staff Directory** — Employee directory with individual profile pages at `/admin/staff/[staffId]`.
- **Academic Configuration** — Create and manage programs, batches, semesters, class groups, and course catalog entries.
- **Marks Overview** — Institution-wide read-only view of all student marks across every subject and class.
- **Exam Management** — Schedule exams, configure timetables, and track results across all classes.
- **Fee Collection Management** — Per-student fee invoice management with payment status tracking.
- **Hostel Management** — Multi-hostel support with per-hostel detail pages at `/admin/hostels/[hostelId]`; manage rooms, allocations, and meal menus.
- **Library Management** — Full book catalog management, lending, and return operations.
- **Placement Listings** — Post and manage placement drives and internship opportunities for students.
- **Bulk Student Promotion** — Promote entire batches between semesters or academic years in a single operation.
- **Notifications Broadcast** — Send announcements to all roles or role-specific groups.
- **Profile & Settings** — Personal profile management and account security controls.

### Teacher Portal
- **Personalized Dashboard** — Course load summary, upcoming exam schedule, and class attendance snapshot.
- **Unified Marks Management** — Enter and manage the four-component grading schema (IA-1, IA-2, Others, SEE) with automatic scaling, total computation, and grade assignment; sequential entry locking enforced in the UI.
- **Exam Management** — View and manage scheduled exams with dedicated detail pages at `/teacher/exams/[examId]`.
- **Student Roster** — Per-class student listing with individual profile access at `/teacher/students/[studentId]`.
- **Attendance Tracking** — Period-wise daily attendance marking and historical log review for all assigned classes.
- **Virtual Classroom — Create** — Create Google Classroom-style rooms with four integrated tabs:
  - **Stream** — Real-time WhatsApp-style group messaging powered by Supabase Realtime with optimistic UI.
  - **Classwork** — Create assignments, set deadlines, and track per-student submission status.
  - **Notes** — Upload and organize study materials shared with the entire class.
  - **Members** — Full member roster with an owner (teacher) crown badge indicator.
  - **Invite Code** — Generate and one-click copy a unique classroom invite code for student enrollment.
- **Library Access** — Browse the institution's book catalog and submit borrowing requests.
- **Notifications Panel** — View all broadcasts targeted at the teacher role.
- **Profile & Settings** — Personal details management and account security controls.

### Student Portal
- **Personalized Dashboard** — Attendance percentage, upcoming exam reminders, and active fee dues in a unified overview.
- **Attendance Viewer** — Semester-wise visualization with per-course breakdown and a day-wise attendance grid calendar.
- **Marks Viewer** — Full grade sheet per enrolled course: IA-1, IA-2, Others, SEE, computed total, and final letter grade.
- **Exam Schedule** — Upcoming and historical exam timetable view.
- **Virtual Classroom — Join** — Join teacher-created classrooms via invite code and access:
  - **Stream** — Participate in real-time class discussions.
  - **Classwork** — View assignments and submit work directly inside the platform.
  - **Notes** — Access and download study materials shared by the teacher.
- **Fee Management** — View all invoices, outstanding dues, and payment receipts.
- **Hostel Portal** — Hostel room assignment details, roommate information, and current meal menu.
- **Library** — Browse, search, and request books from the institution catalog.
- **Placement Board** — View active placement drives, eligibility criteria, and apply directly.
- **Internships** — Browse internship listings and track application status.
- **Resume Builder** — Generate and download a professionally formatted PDF resume assembled entirely client-side using html2canvas and jsPDF.
- **Performance Analytics** — Visual grade trend charts and academic performance curve visualization powered by Recharts.
- **Applications Tracker** — Unified view of all submitted placement and internship applications with real-time status.
- **Notifications Center** — View all institutional broadcasts.
- **Profile & Settings** — Personal details, profile photo, and account security.

### Employee Portal
- **Role-Scoped Dashboard** — Institutional overview statistics relevant to the employee's assigned functional area.
- **Exam & Marks Module** (`exam_marks_management` type) — Class group management, course catalog by program at `/employee/exams/courses/[program]`, exam scheduling, marks entry using the identical IA-1/IA-2/Others/SEE schema as the teacher portal, and an exam results dashboard.
- **Hostel Administration** (`hostel_management` type) — Manage hostel buildings, room inventory, student allocations, hostel-specific fees, and meal menu configurations.
- **Student & Staff Management** (`student_staff_management` type) — View and manage all enrolled students and institutional staff.
- **Library Management** (`library_management` type) — Full book catalog, issue, and return workflow management.
- **Fee Management** (`fee_management` type) — Configure institutional fee structures and track payment records across all students.
- **User Accounts** — Manage portal-level accounts within the employee's functional scope.
- **Notifications Center** — Broadcast and view announcements.
- **Settings** — Account and profile management.

### Virtual Classroom System
- **Supabase Realtime Primary Channel** — Subscribes to `postgres_changes` events (`INSERT`, `DELETE`) on `classroom_posts` for live message delivery without a separate WebSocket server.
- **5-Second Polling Fallback** — Client-side interval using the browser Supabase client ensures message delivery in environments where WebSocket upgrades are restricted.
- **Optimistic UI** — New messages render instantly under a temporary `opt_`-prefixed local ID, atomically replaced once the server confirms the insert — achieving sub-100ms perceived latency.
- **Invite Code System** — Each classroom has a unique invite code; teachers copy it from the classroom header; students paste it to enroll.
- **Assignment Workflow** — Teachers create assignments in the Classwork tab; students submit work; teachers see per-student submission status at a glance.
- **Notes System** — Full CRUD for study materials shared within a classroom.
- **Role Badges** — Teacher displayed with a crown icon in the Members panel; students listed as enrolled members.

### AI Integration (Google Genkit)
- **`@genkit-ai/googleai` v1.28** integrated via dedicated flow files under `src/ai/`.
- **Genkit Dev Server** — `npm run genkit:dev` and `npm run genkit:watch` scripts for local AI flow development with hot-reload.
- All AI flows are invoked through Next.js Server Actions, maintaining full JWT validation before any AI call executes.

### Email & External Integrations
- **Gmail SMTP via Nodemailer** — Transactional emails (account creation, password notifications, announcements) delivered through a Gmail SMTP relay on port 587.
- **Express Backend Integration** — A dedicated Express service (`ERP_BACKEND_URL`) handles Google Classroom-adjacent operations, communicating with the Next.js app over JWT-secured HTTP endpoints using `ERP_BACKEND_JWT_SECRET`.
- **Role-Targeted Notifications** — Broadcasts can be scoped to specific roles; per-user read status is tracked in the `notifications` table.

### Developer Utilities
- **`seed:admin`** — `tsx src/lib/seed-admin.ts` seeds the initial super admin account into Supabase.
- **`seed:fees`** — `tsx src/lib/seed-fee-record.ts` seeds sample fee records for testing and demos.
- **`typecheck`** — `tsc --noEmit` runs a full TypeScript strict-mode validation pass without emitting output.

---

## Overview

**EduERP** is a full-stack, production-grade Enterprise Resource Planning system built specifically for colleges and universities. It consolidates every dimension of academic institution management — student enrollment and progression, attendance, examination and grading, hostel operations, library management, placement and internship tracking, and a real-time virtual classroom — into a single, secure, serverless web application accessible from any device.

The system is architected on **Next.js 16 App Router** with **React 19** and **React Server Components (RSC)**, backed by **Supabase (PostgreSQL)**. The fundamental design principle is server-first: every data operation occurs inside typed **Next.js Server Actions** that re-validate the caller's Supabase JWT on every invocation before executing any query. No credentials, service role keys, or raw database queries are ever exposed to the browser.

Access control operates at three independent layers. At the outermost layer, **Edge Middleware** (`middleware.ts`) intercepts every non-static request, calls `supabase.auth.getUser()` to verify the JWT, fetches the user's `role` from the `profiles` table, and redirects mismatched or unauthenticated traffic before any page component begins rendering. For employees specifically, the middleware additionally reads `employee_type` from the `employees` table and enforces sub-role routing via a lookup table — a fee manager cannot reach the exam module's route and vice versa. At the data layer, every Server Action independently re-validates the JWT, ensuring that even a bypassed middleware cannot grant unauthorized access. At the database layer, Supabase RLS policies enforce a final, code-independent data isolation boundary on all classroom tables.

The **Marks Management system** implements a carefully engineered four-component grading pipeline. IA-1 and IA-2 are each entered out of 40 and stored as /20 (÷ 2). Others is entered and stored as /20. The Semester End Exam (SEE) is entered out of 100 and stored as /40 (× 0.4). The UI enforces a strict sequential unlock — each component's input is disabled until all prior components are saved — preventing incomplete or out-of-order records. All writes use a single database `upsert` keyed on a unique composite constraint of `(student_id, class_id)`, making every write operation fully idempotent regardless of whether it is a first entry or an edit.

The **Virtual Classroom** is a self-hosted real-time collaborative environment built on Supabase Realtime's `postgres_changes` channel, with a 5-second client-side polling fallback for restricted network environments and an optimistic UI layer that renders messages immediately before server confirmation. No third-party classroom provider is required.

The **Resume Builder** operates entirely client-side: student profile and academic data are assembled into a styled DOM component, rasterized to a pixel-perfect canvas by **html2canvas**, and compiled into a downloadable PDF by **jsPDF** — with zero server round-trips or cloud storage. **AI features** are powered by **Google Genkit** (`@genkit-ai/googleai` v1.28), with flow files under `src/ai/` and dedicated dev scripts. A separate **Express backend** handles Google Classroom-adjacent integrations over JWT-secured HTTP. **Analytics** use **Recharts**. **Forms** use **React Hook Form + Zod**. The **UI layer** is composed from 14 **Radix UI** primitives styled with **Tailwind CSS v3**, **tailwind-merge**, **tailwindcss-animate**, **class-variance-authority**, and the **Geist** typeface, with dark/light theming via **next-themes**.

---

## Architecture & Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js App Router + React Server Components | 16.1.6 |
| **UI Runtime** | React + React DOM | 19.0 |
| **Language** | TypeScript — strict mode | 5.x |
| **Database** | Supabase — managed PostgreSQL with RLS | Latest |
| **Auth** | Supabase Auth — JWT, `getUser()` server-side | — |
| **DB Client** | `@supabase/supabase-js` + `@supabase/ssr` | 2.99.3 / 0.9.0 |
| **Styling** | Tailwind CSS v3 + tailwind-merge + tailwindcss-animate | 3.4.1 |
| **Component Variants** | class-variance-authority (CVA) + clsx | 0.7.1 |
| **UI Primitives** | Radix UI — 14 components (Accordion, AlertDialog, Avatar, Dialog, DropdownMenu, Label, Popover, Progress, RadioGroup, ScrollArea, Select, Separator, Switch, Tabs, Toast, Tooltip) | Latest |
| **Typography** | Geist Font | 1.3.1 |
| **Theming** | next-themes | 0.4.6 |
| **Icons** | Lucide React | 0.475.0 |
| **Forms** | React Hook Form + @hookform/resolvers | 7.54.2 |
| **Validation** | Zod | 3.24.2 |
| **Charts & Analytics** | Recharts | 2.15.1 |
| **PDF Generation** | jsPDF + html2canvas (client-side) | 4.2.0 / 1.4.1 |
| **AI Framework** | Google Genkit (`@genkit-ai/googleai`) | 1.28 / 1.29 |
| **Email Delivery** | Nodemailer — Gmail SMTP port 587 | — |
| **Express Integration** | Separate Express backend for Google Classroom ops | — |
| **Realtime** | Supabase Realtime — `postgres_changes` channel | — |
| **Session Security** | iron-session | 8.0.4 |
| **Password Hashing** | bcryptjs | 3.0.3 |
| **Script Runner** | tsx — TypeScript execution for seed and AI scripts | 4.16.2 |

---

## User Roles & Access Matrix

| Capability | Super Admin | Employee | Teacher | Student |
|---|:---:|:---:|:---:|:---:|
| User Account Management | ✅ Full | — | — | — |
| Student Directory & Profiles | ✅ | ✅ | ✅ | — |
| Teacher Directory & Profiles | ✅ | ✅ | — | — |
| Staff Directory & Profiles | ✅ | ✅ | — | — |
| Marks Entry — IA-1 / IA-2 / Others / SEE | ✅ | ✅ (exam type) | ✅ | — |
| View Own Marks & Grade Sheet | — | — | — | ✅ |
| Exam Scheduling & Timetable | ✅ | ✅ (exam type) | — | — |
| View Exam Schedule | ✅ | ✅ | ✅ | ✅ |
| Attendance Marking — Period-wise | — | — | ✅ | — |
| View Attendance Records | ✅ | ✅ | ✅ | ✅ (own) |
| Create Virtual Classroom | — | — | ✅ | — |
| Join Virtual Classroom | — | — | — | ✅ |
| Stream Real-time Messaging | — | — | ✅ | ✅ |
| Classwork — Create Assignment | — | — | ✅ | — |
| Classwork — Submit Assignment | — | — | — | ✅ |
| Notes — Create & Share | — | — | ✅ | — |
| Notes — View & Download | — | — | ✅ | ✅ |
| Fee Management — Full CRUD | ✅ | ✅ (fee type) | — | — |
| Fee Invoices — View Only | — | — | — | ✅ |
| Hostel Management — Full | ✅ | ✅ (hostel type) | — | — |
| Hostel — View Room & Menu | — | — | — | ✅ |
| Library Management — Full CRUD | ✅ | ✅ (library type) | — | — |
| Library — Browse & Request | — | — | ✅ | ✅ |
| Placement Listings — Post | ✅ | — | — | — |
| Placement & Internship — Apply | — | — | — | ✅ |
| Applications Status Tracker | — | — | — | ✅ |
| Resume Builder & PDF Download | — | — | — | ✅ |
| Performance Analytics Charts | — | — | — | ✅ |
| Bulk Student Promotion | ✅ | — | — | — |
| Notifications Broadcast | ✅ | ✅ | ✅ | — |
| Notifications View | ✅ | ✅ | ✅ | ✅ |
| AI-Powered Features (Genkit) | ✅ | ✅ | ✅ | ✅ |
| Profile & Settings | ✅ | ✅ | ✅ | ✅ |

---

## Core Algorithms & Business Logic

### Four-Component Grading Pipeline

Marks flow through a defined scaling pipeline before storage and display:

```
IA-1   : Input /40  →  Stored & displayed as /20     [ value ÷ 2 ]
IA-2   : Input /40  →  Stored & displayed as /20     [ value ÷ 2 ]   requires: IA-1 saved
Others : Input /20  →  Stored & displayed as /20     [ no scaling ]
SEE    : Input /100 →  Stored & displayed as /40     [ value × 0.4 ]  requires: IA-1 + IA-2 + Others saved
──────────────────────────────────────────────────────────────────────────────
Total  : IA-1 + IA-2 + Others + SEE                  max: 100
──────────────────────────────────────────────────────────────────────────────
Grade  :  S ≥ 90  |  A ≥ 80  |  B ≥ 70  |  C ≥ 60  |  D ≥ 50  |  E ≥ 40  |  F < 40
```

### Sequential Entry Locking

The marks entry UI enforces a strict progression gate. IA-2 input fields are disabled until an IA-1 record is confirmed saved; Others is disabled until IA-2 is saved; SEE is disabled until all three internal marks are present. This prevents partial, incomplete, or out-of-sequence records from ever reaching the database.

### Idempotent Upsert Strategy

All marks writes execute a single Supabase `upsert` operation keyed on a unique composite database constraint of `(student_id, class_id)`. Both initial entry and any subsequent edit produce exactly one row per student per class — eliminating duplicate records regardless of retry behavior or concurrent requests.

### Employee Sub-Type Route Guard

The middleware reads `employee_type` from the `employees` table and maps it to an allowed route namespace via a static lookup:

```
fee_management           →  /employee/fees
hostel_management        →  /employee/hostel
student_staff_management →  /employee/users
exam_marks_management    →  /employee/exams
library_management       →  /employee/library
```

Any employee accessing a path outside their assigned namespace is redirected to `/employee/dashboard`. Employees with a missing or null `employee_type` are redirected to `/unauthorized`.

### Virtual Classroom Realtime Architecture

The primary data channel is a Supabase Realtime `postgres_changes` subscription listening for `INSERT` and `DELETE` events on `classroom_posts`. A client-side 5-second polling interval using the browser Supabase client (`supabase-client.ts`) acts as a fallback for environments where WebSocket upgrades are blocked or throttled. Optimistic UI renders incoming messages immediately under a temporary `opt_`-prefixed local ID, which is atomically replaced once the server acknowledges the insert — achieving sub-100ms perceived latency without a dedicated WebSocket server or third-party real-time provider.

### Client-Side PDF Resume Generation

The student's resume data is assembled from the student's profile and academic records into a styled React DOM component. **html2canvas** rasterizes the DOM tree to a pixel-perfect canvas bitmap. **jsPDF** encodes the canvas into a downloadable multi-page PDF document — entirely within the browser, requiring zero server processing, cloud functions, or file storage.

### Google Genkit AI Flow Execution

AI capabilities are defined as Genkit flows under `src/ai/` using `@genkit-ai/googleai`. Flows are invoked exclusively inside Next.js Server Actions, which re-validate the caller's JWT before passing any user data to the Genkit runtime. A local Genkit dev server (`genkit start --tsx`) with optional `--watch` hot-reload supports iterative AI flow development without rebuilding the full Next.js application.

---

## API Layer — Next.js Server Actions

All data access is performed through 21 scoped, fully typed Server Action files located under `src/actions/`. No REST or GraphQL API endpoints are exposed externally. Every action independently re-validates the caller's JWT via `supabase.auth.getUser()` before executing any database operation.

| Action File | Domain Coverage |
|---|---|
| `auth-actions.ts` | Sign-in, sign-out, session management, `getMyProfile` |
| `student-actions.ts` | Student profile, attendance summaries, marks retrieval, fees, hostel data |
| `teacher-actions.ts` | Teacher profile, assigned class roster, scheduled exams, attendance submission |
| `marks-actions.ts` | Read and write all four mark components (IA-1, IA-2, Others, SEE) via upsert |
| `exam-actions.ts` | Exam CRUD, scheduling, timetable generation, and result publishing |
| `attendance-actions.ts` | Period-wise attendance marking and computed attendance summaries |
| `class-actions.ts` | Academic class group management and student enrollment |
| `course-actions.ts` | Course catalog CRUD and program linkage |
| `classroom-actions.ts` | Virtual classroom CRUD, invite-code generation and joining, member management |
| `classroom-post-actions.ts` | Stream post create, list, and delete — Realtime-compatible writes |
| `classroom-note-actions.ts` | Notes tab full CRUD |
| `fee-actions.ts` | Fee invoice creation, update, and payment status tracking |
| `hostel-actions.ts` | Hostel, room, and student allocation management |
| `library-actions.ts` | Book catalog management, issue, and return operations |
| `placement-actions.ts` | Placement drive listings and student application management |
| `notification-actions.ts` | Notification broadcast creation and per-user read status |
| `staff-actions.ts` | Employee (admin staff) profile management |
| `user-actions.ts` | Cross-role account creation and management via Supabase Admin API |
| `timetable-actions.ts` | Weekly timetable entry management |
| `promotion-actions.ts` | Bulk student semester/year promotion logic |
| `dashboard-actions.ts` | Aggregated summary statistics for all four role dashboards |

---

## Database Schema

24-table PostgreSQL schema hosted on Supabase, with RLS active on all classroom tables.

| Table | Description |
|---|---|
| `profiles` | Core identity record linked 1:1 to `auth.users`; stores `role` |
| `students` | Student data: roll number, program, batch, current semester |
| `teachers` | Teacher profile: department, designation, assigned class groups |
| `employees` | Admin staff profile: `employee_type` determines sub-role routing |
| `classes` | Academic class groups: batch + program + semester combination |
| `courses` | Course catalog: code, name, credits, program linkage |
| `marks` | Unified marks record: `ia1`, `ia2`, `other`, `see`, `total`, `grade`; unique on `(student_id, class_id)` |
| `exams` | Exam records: scheduled date, duration, venue, class linkage |
| `attendance` | Period-level attendance log per student per course per day |
| `fees` | Student fee invoices: amount, due date, payment status, receipts |
| `hostels` | Hostel building records and metadata |
| `hostel_rooms` | Room details: number, capacity, occupancy count, type |
| `hostel_allocations` | Student ↔ room assignments with allocation date |
| `library_books` | Book catalog: title, author, ISBN, total copies, available count |
| `library_lendings` | Borrow and return transaction log with due dates and return status |
| `placements` | Placement drive listings: company, role, package, eligibility criteria, deadline |
| `applications` | Student application records for placements and internships with status |
| `notifications` | Broadcast records scoped by role with per-user read tracking |
| `timetables` | Weekly schedule entries: day, period slot, course, class, teacher |
| `promotions` | Batch promotion records with audit metadata |
| `classrooms` | Virtual classroom metadata: name, description, invite code, owner |
| `classroom_posts` | Stream messages — source table for Supabase Realtime subscriptions |
| `classroom_assignments` | Assignment definitions: title, description, due date, attachments |
| `classroom_submissions` | Student assignment submissions with timestamp and status tracking |

---

## Security Architecture

Every Server Action begins with `supabase.auth.getUser()` to re-validate the JWT token completely independently of the middleware layer — a request with an invalid or expired session is rejected before any database query executes. The Supabase service role client is instantiated only inside Server Actions and is never referenced in any client-side file. `SUPABASE_SERVICE_ROLE_KEY`, `ERP_BACKEND_JWT_SECRET`, and `SMTP_PASS` carry no `NEXT_PUBLIC_` prefix, ensuring they are never bundled into the client runtime by Next.js. New user accounts are provisioned through the Supabase Admin API (service role) rather than raw SQL inserts, preserving a full audit trail. Session cookies are `httpOnly` and managed server-side via `@supabase/ssr`. RLS policies on classroom tables act as a code-independent, breach-resistant data isolation layer. `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` are applied on every middleware response. The `/unauthorized` route provides a safe fallback for users with missing or unrecognized role assignments.

---

## Project Structure

```
erp-system/
├── middleware.ts                    # Edge Middleware — JWT auth, RBAC, employee sub-type routing
├── src/
│   ├── ai/                          # Google Genkit AI flows and dev entry point (dev.ts)
│   ├── actions/                     # 21 scoped Next.js Server Actions — the entire data layer
│   ├── app/
│   │   ├── (auth)/                  # Login, signup, admin-signup, forgot-password
│   │   └── (app)/
│   │       ├── admin/               # Super Admin portal — dashboard, students, teachers, staff,
│   │       │                        #   classes, courses, exams, marks, fees, hostels, library,
│   │       │                        #   placements, promotions, notifications, settings
│   │       ├── employee/            # Employee portal — dashboard, fees, hostel, users,
│   │       │                        #   exams + courses/[program], library, notifications, settings
│   │       ├── teacher/             # Teacher portal — dashboard, marks, exams/[examId],
│   │       │                        #   students/[studentId], attendance, classrooms, library,
│   │       │                        #   notifications, profile, settings
│   │       └── student/             # Student portal — dashboard, attendance, marks, exams,
│   │                                #   classrooms, fees, hostel, library, placements, internships,
│   │                                #   resume, analytics, applications, notifications, profile, settings
│   ├── components/
│   │   ├── layout/                  # App shell: sidebar navigation, top navbar
│   │   ├── settings/                # Shared settings component (profile + security)
│   │   ├── shared/                  # Classroom tabs: Stream, Classwork, Notes, Members
│   │   ├── shared-pages/            # Full shared page components: Library, Notifications, Classrooms
│   │   ├── teacher/                 # Teacher-specific UI components
│   │   └── ui/                      # Radix-based design system: primitives + CVA variants
│   ├── hooks/                       # Custom React hooks: auth state, toast notifications
│   └── lib/
│       ├── supabase.ts              # Server-side + service role Supabase client factories
│       ├── supabase-client.ts       # Browser Supabase client for Realtime subscriptions
│       ├── seed-admin.ts            # Super admin account seeder (tsx)
│       ├── seed-fee-record.ts       # Fee record seeder (tsx)
│       ├── types.ts                 # Global TypeScript type definitions
│       └── utils.ts                 # Helpers: cn(), formatDate(), etc.
├── .env.example                     # Full environment variable template
├── components.json                  # shadcn/ui component configuration
├── tailwind.config.ts               # Tailwind CSS v3 configuration
├── tsconfig.json                    # TypeScript strict mode configuration
├── next.config.mjs                  # Next.js configuration
└── next.config.mjs                  # Next.js application configuration
```

---

## Getting Started

**Prerequisites:** Node.js 20+ and a provisioned Supabase project with the schema applied.

```bash
git clone https://github.com/krishnateja7781/erp-system.git
cd erp-system
npm install
```

Copy the environment template and fill in your values:

```bash
cp .env.example .env.local
```

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Express Backend (Google Classroom Integration)
NEXT_PUBLIC_ERP_BACKEND_URL=http://localhost:5000
ERP_BACKEND_URL=http://localhost:5000
ERP_BACKEND_JWT_SECRET=your_backend_jwt_secret

# Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
```

Seed the initial super admin account:

```bash
npm run seed:admin
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The middleware redirects you to `/login` and, after authentication, to your role's dashboard automatically.

**Optional — AI development server:**

```bash
npm run genkit:dev       # Start Genkit dev UI
npm run genkit:watch     # Start Genkit with hot-reload
```

**Optional — Fee record seeding for testing:**

```bash
npm run seed:fees
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Start production server locally |
| `npm run lint` | ESLint check |
| `npm run typecheck` | Full TypeScript strict validation — no emit |
| `npm run seed:admin` | Seed the initial super admin account |
| `npm run seed:fees` | Seed sample fee records for testing |
| `npm run genkit:dev` | Start Google Genkit AI development server |
| `npm run genkit:watch` | Start Genkit dev server with hot-reload |

---

## License

This project is proprietary software developed for academic institutional use. All rights reserved.

---

<div align="center">

Built with Next.js 16 · React 19 · Supabase · TypeScript · Google Genkit

</div>
