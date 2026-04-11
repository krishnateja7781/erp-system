# 🎓 EduERP — Enterprise Resource Planning System for Educational Institutions

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v3-06B6D4?style=for-the-badge&logo=tailwindcss" />
</p>

---

## ✨ Features

### 🔐 Authentication & Security
- **JWT-based server-side session management** via Supabase Auth (`supabase.auth.getUser()`)
- **Role-Based Access Control (RBAC)** with 4 distinct portal spaces: Admin, Employee, Teacher, Student
- **Middleware-level route protection** with automatic redirects by role on every request
- **Bcrypt password hashing** with iron-session for secure credential management
- **Clickjacking protection** via `X-Frame-Options: DENY` and `X-Content-Type-Options` security headers
- **Row Level Security (RLS)** policies enforced in the Supabase PostgreSQL database

### 🏛️ Admin Portal
- Full **user management** — create, view, and deactivate student, teacher, and employee accounts
- **Staff directory** with individual staff profile pages (`/staff/[staffId]`)
- **Student directory** with individual detail pages (`/students/[studentId]`)
- **Teacher directory** with individual detail pages (`/teachers/[teacherId]`)
- **Academic class & course configuration** — manage programs, batches, and course structures
- **Marks overview** — read-only view of all student marks across all subjects and classes
- **Exam management** (timetables, scheduling, and result tracking)
- **Fee collection management** with detailed per-student fee records
- **Hostel management** — multi-hostel support with detailed hostel pages (`/hostels/[hostelId]`)
- **Library management** — book catalog, lending, and return management
- **Placement & opportunity listings** for students
- **Student promotions** — bulk semester/year promotion system
- **Notifications center** — broadcast announcements to all roles
- **Settings page** with profile and security controls

### 👩‍🏫 Teacher Portal
- **Personalized Dashboard** with course load overview and upcoming exam summaries
- **Marks Management** — unified grading system supporting:
  - **IA-1** (score out of 40, scaled to 20)
  - **IA-2** (score out of 40, scaled to 20, unlocks after IA-1)
  - **Others** (score out of 20)
  - **SEE** — Semester End Exam (score out of 100, scaled to 40, unlocks only after all internal marks)
  - Automatic **total calculation** and **grade generation**
  - Sequential entry locking — marks can only be entered in order
- **Scheduled Exams** management with individual exam detail pages (`/exams/[examId]`)
- **Student Roster** with per-class attendance and profile access (`/students/[studentId]`)
- **Attendance Tracking** — period-wise daily attendance marking and log view
- **Classroom (Virtual Classroom)** — Create Google Classroom-style virtual classes:
  - Stream (WhatsApp-style group messenger with real-time updates via Supabase Realtime)
  - Classwork tab for assignment creation and submission tracking
  - Notes tab for sharing study materials
  - Members panel with owner (teacher) and student roster
  - Unique **invite code sharing** for students to join
- **Library access** for browsing and requesting books
- **Notifications** panel
- **Profile** page with personal details
- **Settings** page with account controls

### 🎓 Student Portal
- **Personalized Dashboard** with attendance summary, upcoming exams, and fee status
- **Attendance Viewer** — semester-wise attendance visualization with course-level breakdown and day-wise grid
- **Marks Viewer** — View IA-1, IA-2, Others, SEE, total, and grade for all enrolled courses
- **Exam Schedule** — view upcoming and past exam timetables
- **Classroom Joining** — Join teacher-created virtual classrooms via invite code:
  - Participate in Stream discussions
  - View and submit assignments (Classwork tab)
  - Access shared Notes
- **Fee Management** — view all fee invoices, due amounts, and receipts
- **Hostel Portal** — hostel room assignment, room details, and menu view
- **Library** — browse, search, and request books
- **Placement & Opportunity Board** — view placement drives and apply
- **Internships** listing and application tracking
- **Resume Builder** — generate and download a professional PDF resume
- **Performance Analytics** — visual grade curves and academic trend tracking
- **Applications Tracker** — track placement and internship application status
- **Notifications Center**
- **Profile** & **Settings** pages

### 🗂️ Employee (Admin Staff) Portal
- **Dashboard** with institutional overview metrics
- **Full Exam Module**:
  - Classes management
  - Course management by program (`/exams/courses/[program]`)
  - Exam scheduling and timetable creation
  - Marks entry — using the same unified IA-1/IA-2/Others/SEE grading schema as the Teacher portal
  - Exam results dashboard
- **Hostel Administration** — manage multiple hostels, hostel fees, and meal menus
- **Student & Teacher Management** — view and manage all enrolled students and staff
- **Library Management** — complete book and lending management
- **Fee Management** — institutional fee configuration and payment tracking
- **User Accounts** — manage portal-level user accounts
- **Notifications Center**
- **Settings** page

### 📚 Virtual Classroom System
- Fully Supabase-backed real-time classroom infrastructure replacing legacy backends
- **Supabase Realtime** subscriptions on `classroom_posts` via `postgres_changes` events
- Polling fallback (5s interval) using snake_case Supabase queries for reliability
- **Instant optimistic UI** — messages and posts appear immediately before server confirmation
- Members panel showing owner (teacher crown badge) and all enrolled students
- Teachers can **copy invite code** from classroom detail header
- Back button navigation in both Teacher and Student portals

---

## 🗺️ Overview

**EduERP** is a full-stack, production-grade Enterprise Resource Planning system tailored for colleges and universities. It provides a unified digital platform for managing all aspects of an academic institution — from student enrollment and attendance to examination and grading, hostel operations, placement tracking, and a real-time virtual classroom — all within a single, secure web application.

The system is built on a modern serverless stack using **Next.js 16 App Router** with **React Server Components**, fully deployed on **Vercel** and powered by a **Supabase (PostgreSQL)** database. The architecture strictly follows **server-side data access patterns** — all sensitive operations happen inside Next.js Server Actions using a verified JWT session, never exposing credentials to the client.

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | Next.js 16 (App Router, React Server Components) |
| **Language** | TypeScript (strict mode) |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (JWT, `getUser()` server-side verification) |
| **ORM / DB Client** | `@supabase/ssr` — cookie-based server client |
| **Styling** | Tailwind CSS v3 + `tailwind-merge` + `tailwindcss-animate` |
| **UI Primitives** | Radix UI (Dialog, Tabs, Select, Switch, Tooltip, Avatar, etc.) |
| **Icons** | Lucide React |
| **Forms** | React Hook Form + Zod validation |
| **Charts & Analytics** | Recharts |
| **PDF Generation** | jsPDF + html2canvas |
| **Email (SMTP)** | Gmail SMTP via Nodemailer |
| **AI Integration** | Google Genkit (`@genkit-ai/googleai`) |
| **Deployment** | Vercel (Serverless, Edge Middleware) |
| **Realtime** | Supabase Realtime (Postgres `postgres_changes`) |
| **Session Security** | `iron-session` |
| **Password Security** | `bcryptjs` |

---

## 👥 User Roles & Access Matrix

| Feature | Super Admin | Employee | Teacher | Student |
|---|:---:|:---:|:---:|:---:|
| User Management | ✅ | — | — | — |
| Student / Staff Profiles | ✅ | ✅ | ✅ | — |
| Marks Entry (IA-1/2/Others/SEE) | ✅ | ✅ | ✅ | — |
| View Own Marks | — | — | — | ✅ |
| Exam Scheduling | ✅ | ✅ | — | — |
| Attendance Marking | — | — | ✅ | — |
| View Attendance | ✅ | ✅ | ✅ | ✅ |
| Create Virtual Classroom | — | — | ✅ | — |
| Join Virtual Classroom | — | — | — | ✅ |
| Stream / Messaging | — | — | ✅ | ✅ |
| Fee Management | ✅ | ✅ | — | 👁️ View |
| Hostel Management | ✅ | ✅ | — | 👁️ View |
| Library Management | ✅ | ✅ | 👁️ View | 👁️ View |
| Placement / Opportunities | ✅ | — | — | ✅ |
| Resume Builder | — | — | — | ✅ |
| Student Promotion | ✅ | — | — | — |
| Notifications Broadcast | ✅ | ✅ | ✅ | 👁️ View |
| Settings & Profile | ✅ | ✅ | ✅ | ✅ |

---

## 🧮 Core Algorithms & Business Logic

### Grading Schema
```
IA-1  : Marks entered out of 40 → stored & displayed as /20 (÷2)
IA-2  : Marks entered out of 40 → stored & displayed as /20 (÷2)  [requires IA-1]
Others: Marks entered and stored out of 20
SEE   : Marks entered out of 100 → stored & displayed as /40 (*0.4) [requires IA-1, IA-2, Others]
Total : IA-1 + IA-2 + Others + SEE  (max 100)
Grade : S(≥90) A(≥80) B(≥70) C(≥60) D(≥50) E(≥40) F(<40)
```

### Sequential Entry Locking
Marks entry is **progressively unlocked** — the UI enforces that each assessment type is entered in order (IA-1 → IA-2 → Others → SEE), preventing out-of-order data entry.

### Upsert Strategy
All marks are written using a **single `upsert` operation** keyed on `(student_id, class_id)` with a unique database constraint. This ensures idempotent writes regardless of whether it is a new entry or an update — eliminating duplicate records.

### Virtual Classroom Real-Time Architecture
- **Primary channel:** Supabase Realtime `postgres_changes` subscription (INSERT/DELETE events on `classroom_posts`)
- **Fallback channel:** Client-side polling every 5 seconds using direct `supabase-client` queries
- **Optimistic UI:** Posts are rendered immediately using a temporary `opt_` prefixed ID and replaced on server confirmation

### Resume PDF Generation
Student resumes are assembled client-side using **html2canvas** (renders DOM to canvas) and **jsPDF** (converts canvas to downloadable PDF), no server rendering required.

---

## 🗄️ Database Schema (Supabase / PostgreSQL)

| Table | Description |
|---|---|
| `profiles` | Core user identity linked to `auth.users` |
| `students` | Student-specific data (roll number, batch, program) |
| `teachers` | Teacher profile, department, designation |
| `employees` | Administrative staff with employee type |
| `classes` | Academic class groups (batch + program + semester) |
| `courses` | Course catalog with codes, credits, and program linkage |
| `marks` | Unified marks table: `ia1`, `ia2`, `other`, `see`, `total`, `grade` |
| `exams` | Exam records with scheduled dates and class linkage |
| `attendance` | Period-level attendance logs |
| `fees` | Student fee invoices and payment records |
| `hostels` | Hostel building records |
| `hostel_rooms` | Room details with capacity and occupancy |
| `hostel_allocations` | Student ↔ room assignments |
| `library_books` | Book catalog with availability tracking |
| `library_lendings` | Borrow/return logs |
| `placements` | Placement drive listings |
| `applications` | Student application records for placements |
| `notifications` | Broadcast notification records by role |
| `timetables` | Weekly class schedule entries |
| `promotions` | Batch promotion records |
| `classrooms` | Virtual classroom metadata + invite codes |
| `classroom_posts` | Stream messages (real-time) |
| `classroom_assignments` | Classwork/assignment definitions |
| `classroom_submissions` | Student assignment submissions |

---

## 🔌 API Layer — Next.js Server Actions

All data access is performed through typed **Next.js Server Actions** (no REST API routes exposed). Each action file is scoped to a domain:

| Action File | Domain Coverage |
|---|---|
| `auth-actions.ts` | Sign-in, sign-out, session, profile retrieval (`getMyProfile`) |
| `student-actions.ts` | Student profile, attendance, marks, fees, hostel |
| `teacher-actions.ts` | Teacher profile, class list, scheduled exams, attendance submission |
| `marks-actions.ts` | Read/write unified marks (IA-1, IA-2, Others, SEE) with upsert |
| `exam-actions.ts` | Exam CRUD, scheduling, result publishing |
| `attendance-actions.ts` | Attendance marking (period-wise) and summary computation |
| `class-actions.ts` | Class group management and student enrollment |
| `course-actions.ts` | Course catalog CRUD and program linkage |
| `classroom-actions.ts` | Virtual classroom CRUD, invite code joining, member management |
| `classroom-post-actions.ts` | Stream post creation, listing, deletion (Realtime-compatible) |
| `classroom-note-actions.ts` | Notes tab CRUD |
| `fee-actions.ts` | Fee record management and payment status |
| `hostel-actions.ts` | Hostel, room, and allocation management |
| `library-actions.ts` | Book catalog, issue, and return management |
| `placement-actions.ts` | Placement drive and application management |
| `notification-actions.ts` | Notification broadcast and read status |
| `staff-actions.ts` | Staff (employee) profile management |
| `user-actions.ts` | Cross-role user account creation and management |
| `timetable-actions.ts` | Timetable entry management |
| `promotion-actions.ts` | Bulk student promotion logic |
| `dashboard-actions.ts` | Aggregated summary stats for dashboards |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- A Supabase project with your schema applied

### Local Setup
```bash
git clone https://github.com/krishnateja7781/erp-system.git
cd erp-system
npm install
```

Create a `.env.local` file in the root:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## ☁️ Deployment (Vercel)

1. Push code to `main` branch on GitHub.
2. Import the repository on [Vercel](https://vercel.com).
3. Add all environment variables from `.env.local` in the Vercel dashboard.
4. Click **Deploy**.

Vercel auto-detects Next.js and handles build, CDN caching, and Edge Middleware deployment automatically on every push.

---

## 📁 Project Structure

```
src/
├── actions/          # All Next.js Server Actions (data layer)
├── app/
│   ├── (auth)/       # Login, registration pages
│   └── (app)/
│       ├── admin/    # Admin portal pages
│       ├── employee/ # Employee portal pages
│       ├── teacher/  # Teacher portal pages
│       └── student/  # Student portal pages
├── components/
│   ├── layout/       # Sidebar, navbar, app shell
│   ├── settings/     # Shared settings component
│   ├── shared/       # Shared UI (Classroom tabs: Stream, Classwork, Notes)
│   ├── shared-pages/ # Componentized full pages (Library, Notifications, Classrooms)
│   ├── teacher/      # Teacher-specific components
│   └── ui/           # Radix-based design system primitives
├── hooks/            # Custom React hooks (auth, toast, etc.)
└── lib/
    ├── supabase.ts   # Supabase server + service role clients
    ├── supabase-client.ts # Supabase browser client (Realtime)
    ├── types.ts      # Global TypeScript type definitions
    └── utils.ts      # Utility helpers (cn, formatDate, etc.)
```

---

## 🛡️ Security Practices

- All server actions call `supabase.auth.getUser()` to re-validate the JWT before any data operation
- Service role key is **never exposed to the client** — only used in Server Actions
- `SUPABASE_SERVICE_ROLE_KEY` and `SMTP_PASS` are server-only environment variables (no `NEXT_PUBLIC_` prefix)
- RLS (Row Level Security) policies are active on all classroom tables
- Passwords for new users are set via the Supabase Admin API using the service role client, never raw SQL
- Session cookies are `httpOnly` and managed exclusively server-side via `@supabase/ssr`

---

## 📄 License

This project is proprietary software built for academic institutional use.

---

<p align="center">Built with ❤️ using Next.js, Supabase, and TypeScript</p>
