# AI Chatbot System — Complete Documentation

> **ERP Application — Role-Based AI Chat Assistants**
> Built with Next.js 16, Supabase (PostgreSQL), iron-session, Tailwind CSS, shadcn/ui
> Date: March 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Design Philosophy](#2-architecture--design-philosophy)
3. [Technology Stack & Prerequisites](#3-technology-stack--prerequisites)
4. [Project Structure](#4-project-structure)
5. [Shared Foundation](#5-shared-foundation)
6. [Student Chatbot (Detailed)](#6-student-chatbot)
7. [Teacher Chatbot (Detailed)](#7-teacher-chatbot)
8. [Admin Chatbot (Detailed)](#8-admin-chatbot)
9. [Frontend Chat UI Component](#9-frontend-chat-ui-component)
10. [Integration Into the App Layout](#10-integration-into-the-app-layout)
11. [Database Schema & Collections](#11-database-schema--collections)
12. [Step-by-Step Build Guide](#12-step-by-step-build-guide)
13. [How Intent Detection Works](#13-how-intent-detection-works)
14. [Adding a New Intent (Guide)](#14-adding-a-new-intent-guide)
15. [Security Considerations](#15-security-considerations)
16. [Troubleshooting & FAQ](#16-troubleshooting--faq)

---

## 1. System Overview

The ERP application includes **three independent AI chatbot assistants**, each tailored to a specific user role:

| Chatbot | Role | Endpoint | Color Theme | Purpose |
|---------|------|----------|-------------|---------|
| **Student Assistant** | `student` | `POST /api/student/chat` | Blue | Personal academics — attendance, marks, fees, schedule, hostel, profile |
| **Teacher Assistant** | `teacher` | `POST /api/teacher/chat` | Emerald/Green | Teaching-focused — class schedule, student performance, low attendance, pending tasks |
| **Admin Assistant** | `admin` | `POST /api/admin/chat` | Violet/Purple | Institution-wide — dashboards, summaries, gender breakdown, lookups, all domains |

### Key Characteristics

- **No AI/ML/NLP** — All chatbots use **deterministic keyword-based intent detection**. Zero external AI API calls.
- **No cloud AI costs** — Runs entirely on your server. No OpenAI, no Google AI, no tokens, no API keys needed for chat.
- **Role-isolated** — Each chatbot can only access data appropriate to its role. A student cannot see admin data.
- **Session-authenticated** — Uses `iron-session` cookies. Every request validates the user's identity and role.
- **Layered architecture** — Each chatbot has 4 files following the same pattern: Intent → Service → Formatter → Route.

---

## 2. Architecture & Design Philosophy

### The 4-Layer Pattern

Every chatbot follows a strict **4-layer separation of concerns**:

```
User Message
    │
    ▼
┌─────────────┐
│   Route      │  API endpoint — auth, parse, orchestrate
│  (route.ts)  │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│   Intent     │  Detect WHAT the user wants (keyword matching)
│ (intent.ts)  │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│   Service    │  Fetch DATA from database (filtered, safe)
│ (service.ts) │
└──────┬───────┘
       │
       ▼
┌─────────────┐
│  Formatter   │  Convert data to human-readable TEXT
│(formatter.ts)│
└──────┬───────┘
       │
       ▼
  JSON Response → Frontend UI
```

### Design Rules

1. **Intent files** NEVER touch the database.
2. **Service files** NEVER format text. They return plain objects.
3. **Formatter files** NEVER call the database. They receive structured data only.
4. **Route files** orchestrate the flow: authenticate → detect intent → call service → format response → return JSON.
5. **Services never use `SELECT *`** — every query is filtered and returns ONLY the fields needed.
6. **No raw DB objects** escape to the formatter or the client.

---

## 3. Technology Stack & Prerequisites

### Required Packages (from `package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^16.1.6 | React framework, API routes, SSR |
| `react` / `react-dom` | ^19.0.0 | UI rendering |
| `@supabase/supabase-js` | ^2.98.0 | PostgreSQL database client |
| `iron-session` | ^8.0.4 | Encrypted cookie-based sessions |
| `bcryptjs` | ^3.0.3 | Password hashing (auth system) |
| `lucide-react` | ^0.475.0 | Icons (MessageCircle, Bot, Send, X, etc.) |
| `tailwindcss` | ^3.4.1 | Utility-first CSS |
| `tailwind-merge` | ^3.0.1 | Merge Tailwind classes |
| `class-variance-authority` | ^0.7.1 | Component variant management |
| `@radix-ui/react-scroll-area` | ^1.2.3 | Scrollable chat area |
| `typescript` | ^5 | Type safety |

### shadcn/ui Components Used

- `Button` — Send button
- `ScrollArea` — Chat message scrolling

### Environment Variables Required

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SESSION_SECRET=complex_password_at_least_32_characters_long
```

### VS Code Extensions (Recommended)

| Extension | Purpose |
|-----------|---------|
| ESLint | JavaScript/TypeScript linting |
| Prettier | Code formatting |
| Tailwind CSS IntelliSense | Tailwind class autocomplete |
| TypeScript Nightly | Latest TS features |
| Supabase | Database management |

---

## 4. Project Structure

### Chatbot Files Map

```
src/
├── chatbots/
│   ├── types.ts                          # Shared interfaces (ChatRequest, ChatResponse, ChatError, DetectedIntent)
│   │
│   ├── student/
│   │   ├── intent.ts                     # Student intent detection (12 intents)
│   │   ├── service.ts                    # Student data access (9 functions)
│   │   └── formatter.ts                  # Student response formatting (12 formatters)
│   │
│   ├── teacher/
│   │   ├── intent.ts                     # Teacher intent detection (12 intents)
│   │   ├── service.ts                    # Teacher data access (8 functions)
│   │   └── formatter.ts                  # Teacher response formatting (12 formatters)
│   │
│   └── admin/
│       ├── intent.ts                     # Admin intent detection (30+ intents, topic router)
│       ├── service.ts                    # Admin data access (30 functions)
│       └── formatter.ts                  # Admin response formatting (30+ formatters)
│
├── app/
│   └── api/
│       ├── student/chat/route.ts         # POST /api/student/chat
│       ├── teacher/chat/route.ts         # POST /api/teacher/chat
│       └── admin/chat/route.ts           # POST /api/admin/chat
│
├── components/
│   └── shared/
│       └── chat-bot.tsx                  # Universal floating chat UI (450 lines)
│
├── lib/
│   ├── auth-session.ts                   # iron-session config, getCurrentUser()
│   ├── db.ts                             # Supabase abstraction (readCollection, findWhere, etc.)
│   └── supabase.ts                       # Supabase client initialization
│
└── data/
    └── timetable.json                    # File-based timetable data (used by student & teacher bots)
```

### Supporting Files

| File | Purpose |
|------|---------|
| `src/lib/auth-session.ts` | Session management, `getCurrentUser()`, `SessionUser` interface |
| `src/lib/db.ts` | Database abstraction with `readCollection`, `findWhere`, `findOneWhere`, `findOneByField` |
| `src/data/timetable.json` | Static timetable data (212 entries) |
| `src/components/layout/app-layout.tsx` | Main layout that renders `<ChatBot>` component |

---

## 5. Shared Foundation

### 5.1 Types (`src/chatbots/types.ts`)

This file defines the **contract** between all layers:

```typescript
// What the frontend sends:
interface ChatRequest {
  message: string;
}

// What the API returns on success:
interface ChatResponse {
  success: boolean;
  role: 'student' | 'teacher' | 'admin';
  intent: string;        // e.g. "AttendanceIntent", "GreetingIntent"
  message: string;       // Human-readable formatted response
  metadata: Record<string, unknown>;  // Extra data (counts, percentages, etc.)
}

// What the API returns on error:
interface ChatError {
  success: false;
  role: 'student' | 'teacher' | 'admin';
  intent: 'Error';
  message: string;
  metadata: {};
}

// What intent detection returns:
interface DetectedIntent {
  intent: string;
  confidence: 'exact' | 'partial';
}
```

### 5.2 Database Abstraction (`src/lib/db.ts`)

All chatbot services use these helper functions:

| Function | Signature | Description |
|----------|-----------|-------------|
| `readCollection<T>(name)` | `(name: string) => Promise<T[]>` | Read all records from a collection |
| `findWhere<T>(name, predicate)` | `(name: string, fn: (item: T) => boolean) => Promise<T[]>` | Filter records by predicate |
| `findOneWhere<T>(name, predicate)` | `(name: string, fn: (item: T) => boolean) => Promise<T \| null>` | Find first matching record |
| `findOneByField<T>(name, field, value)` | `(name: string, field: string, value: unknown) => Promise<T \| null>` | Find by field value |

**Collection mapping** (logical name → Supabase table):

| Collection Name | Supabase Table |
|----------------|----------------|
| `students` | `students` |
| `teachers` | `teachers` |
| `admins` | `admins` |
| `courses` | `courses` |
| `classes` | `classes` |
| `attendance` | `attendance` |
| `marks` | `marks` |
| `fees` | `fees` |
| `hostels` | `hostels` |
| `rooms` | `hostel_rooms` |
| `complaints` | `complaints` |
| `opportunities` | `opportunities` |
| `applications` | `applications` |
| `exams` | `exam_schedules` |
| `loginActivities` | `login_activities` |
| `notifications` | `notifications` |
| `classrooms` | `classrooms` |
| `classroom_posts` | `classroom_posts` |

### 5.3 Session & Auth (`src/lib/auth-session.ts`)

```typescript
interface SessionUser {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  staffId?: string | null;
  collegeId?: string | null;
  staffDocId?: string | null;     // Used by teacher chatbot
  studentDocId?: string | null;   // Used by student chatbot
  program?: string | null;
  branch?: string | null;
  year?: number | null;
  type?: string | null;
}
```

The `getCurrentUser()` function reads the encrypted `erp_session` cookie using `iron-session` and returns the `SessionUser` or `null`.

---

## 6. Student Chatbot

### 6.1 Overview

The Student Chatbot provides **personal academic information** to logged-in students. Every query is scoped to the student's own data.

- **File Count**: 4 files
- **Total Intents**: 12
- **Service Functions**: 9
- **Formatters**: 12

### 6.2 Supported Intents

| Intent | Keywords (sample) | What It Does |
|--------|------------------|--------------|
| `GreetingIntent` | hello, hi, hey, namaste | Returns time-aware greeting |
| `HelpIntent` | help, what can you do, commands | Lists all capabilities |
| `AttendanceIntent` | attendance, present, absent | Student's attendance percentage |
| `ClassScheduleIntent` | classes today, schedule, timetable | Today's or tomorrow's classes |
| `ExamIntent` | exam, upcoming exam, hall ticket | Upcoming exam schedule |
| `MarksIntent` | marks, grade, CGPA, result | Subject-wise grades + CGPA |
| `WeakSubjectsIntent` | weak subject, failing, backlog | Subjects below B+ grade |
| `FeesIntent` | fee, payment, pending fee | Fee summary with balance |
| `HostelIntent` | hostel, room, warden | Hostel details, room, warden info |
| `ProfileIntent` | profile, my details, who am i | Student profile information |
| `CoursesIntent` | courses, subjects, enrolled | Enrolled courses list |
| `GoodbyeIntent` | bye, goodbye, thanks | Farewell message |

### 6.3 Intent Detection (`src/chatbots/student/intent.ts`)

**Algorithm**: Simple keyword matching with priority-based resolution.

```
1. Lowercase + trim the message
2. For each IntentRule, check if any keyword matches:
   - Exact match (full message === keyword) → priority + 100
   - Partial match (message includes keyword) → base priority
3. Sort matches by priority (descending)
4. Return highest priority match, or null if no match
```

**Priority system**: Higher number = checked first when multiple intents match.
- Greeting/Goodbye: priority 0
- Help: priority 1
- Profile: priority 5
- Courses: priority 8
- Most academic intents: priority 10
- Weak Subjects: priority 12

### 6.4 Service Functions (`src/chatbots/student/service.ts`)

All service functions take `studentDocId` (from session) as the first parameter, ensuring data isolation.

| Function | Input | Returns |
|----------|-------|---------|
| `getStudentAttendance(studentDocId)` | Student ID | `{ percentage, totalClasses, presentClasses, status }` |
| `getStudentSchedule(studentDocId, 'today'\|'tomorrow')` | Student ID + when | `{ classes: [{period, courseName, teacherName}], day, status }` |
| `getStudentUpcomingExams(studentDocId)` | Student ID | `{ exams: [{courseName, date, startTime, endTime, sessionName}], status }` |
| `getStudentMarksSummary(studentDocId)` | Student ID | `{ cgpa, subjects: [{courseName, grade, total}], status }` |
| `getStudentWeakSubjects(studentDocId)` | Student ID | `{ weakSubjects: [{courseName, grade}], status }` |
| `getStudentFeeDetails(studentDocId)` | Student ID | `{ totalFees, amountPaid, balance, feeStatus, status }` |
| `getStudentHostelDetails(studentDocId)` | Student ID | `{ hostelName, roomNumber, wardenName, wardenContact, status }` |
| `getStudentProfile(studentDocId)` | Student ID | `{ name, collegeId, program, branch, year, semester, section, type, status }` |
| `getStudentCourses(studentDocId)` | Student ID | `{ courses: [{courseName, teacherName, credits}], status }` |

**Schedule data source**: `src/data/timetable.json` (file-based, not database).

**CGPA calculation**: Uses a grade-point mapping:
| Grade | Points | | Grade | Points |
|-------|--------|-|-------|--------|
| O | 10 | | B | 6 |
| A+ | 9 | | C+ | 5 |
| A | 8 | | C | 4 |
| B+ | 7 | | P | 3 |
| | | | F/FAIL | 0 |

### 6.5 Formatter Functions (`src/chatbots/student/formatter.ts`)

Each formatter converts service data into emoji-rich, markdown-formatted text:

| Formatter | Output Example |
|-----------|---------------|
| `formatGreeting(name)` | "Good morning, John! 👋 I'm your Student Assistant..." |
| `formatHelp()` | Categorized list of all capabilities with examples |
| `formatAttendance(data)` | "Your overall attendance is **85%** (170 present out of 200)..." + warning if <75% |
| `formatSchedule(data, when)` | Period-by-period table with times (9:00-10:00 AM format) |
| `formatExams(data)` | Dated exam list with course names and times |
| `formatMarks(data)` | "Your CGPA is **8.5**" + subject-wise grade table |
| `formatWeakSubjects(data)` | Warning list of subjects below B+ |
| `formatFees(data)` | Fee breakdown with ₹ formatting + pending warning |
| `formatHostel(data)` | Hostel name, room number, warden contact |
| `formatProfile(data)` | Complete profile card |
| `formatCourses(data)` | Enrolled courses with teacher names and credits |
| `formatGoodbye(name)` | "Goodbye, John! Have a great day! 👋" |
| `formatUnrecognized()` | Fallback message with suggestions |

### 6.6 API Route (`src/app/api/student/chat/route.ts`)

**Request flow**:

```
POST /api/student/chat
Body: { "message": "what is my attendance?" }

1. Authenticate: getCurrentUser() → must be role 'student'
2. Validate: studentDocId must exist
3. Sanitize: trim, max 300 chars
4. Detect: detectStudentIntent(message) → "AttendanceIntent"
5. Fetch: svc.getStudentAttendance(studentDocId)
6. Format: fmt.formatAttendance(data)
7. Return: { success: true, role: "student", intent: "AttendanceIntent", message: "...", metadata: { percentage: 85 } }
```

**Error responses**:
- 401: Not logged in
- 403: Not a student
- 400: No studentDocId / empty message
- 500: Server error

---

## 7. Teacher Chatbot

### 7.1 Overview

The Teacher Chatbot provides **teaching-focused information** — class management, student performance tracking, attendance monitoring.

- **File Count**: 4 files
- **Total Intents**: 12
- **Service Functions**: 8
- **Formatters**: 12

### 7.2 Supported Intents

| Intent | Keywords (sample) | What It Does |
|--------|------------------|--------------|
| `GreetingIntent` | hello, hi, hey | Time-aware greeting |
| `HelpIntent` | help, commands | Lists capabilities |
| `ClassScheduleIntent` | classes today, my schedule | Today's/tomorrow's teaching schedule |
| `LowAttendanceIntent` | low attendance, below 75, defaulters | Students below 75% attendance |
| `ClassPerformanceIntent` | class performance, student performance | Per-class average marks & pass % |
| `MarksOverviewIntent` | marks overview, grades summary | Marks summary across classes |
| `ExamIntent` | upcoming exam, exam schedule | Exams for teacher's classes |
| `MyStudentsIntent` | my students, student count | Total students across classes |
| `PendingAttendanceIntent` | pending attendance, not marked | Today's unmarked attendance periods |
| `ProfileIntent` | my profile, who am i | Teacher profile info |
| `CoursesIntent` | my courses, what do i teach | Assigned courses list |
| `GoodbyeIntent` | bye, goodbye, thanks | Farewell message |

### 7.3 Intent Detection (`src/chatbots/teacher/intent.ts`)

Same algorithm as the Student chatbot:
- Keyword matching with priority-based resolution
- Exact match bonus: +100 priority
- Higher priority intents: `LowAttendanceIntent` (12), `ClassPerformanceIntent` (12), `PendingAttendanceIntent` (12)

### 7.4 Service Functions (`src/chatbots/teacher/service.ts`)

**Teacher resolution**: Uses a multi-step lookup function `resolveTeacher()` that tries:
1. `user_uid` match
2. `staffDocId` match
3. `email` match

This handles edge cases where teacher IDs don't perfectly align across tables.

| Function | Input | Returns |
|----------|-------|---------|
| `getTeacherSchedule(uid, when, extraIds)` | Teacher UID + when | `{ classes: [{period, courseName, className}], day, status }` |
| `getLowAttendanceStudents(uid, extraIds)` | Teacher UID | `{ students: [{studentName, className, percentage}], totalCount, status }` |
| `getClassPerformance(uid, extraIds)` | Teacher UID | `{ classes: [{className, averageMarks, passPercentage, totalStudents}], status }` |
| `getMarksOverview(uid, extraIds)` | Teacher UID | Same as `getClassPerformance` (delegates to it) |
| `getTeacherUpcomingExams(uid, extraIds)` | Teacher UID | `{ exams: [{courseName, date, startTime, endTime}], status }` |
| `getTeacherStudentInfo(uid, extraIds)` | Teacher UID | `{ totalStudents, classes: [{courseName, section, studentCount}], status }` |
| `getTeacherProfile(uid, extraIds)` | Teacher UID | `{ name, staffId, email, department, designation, specialization, status }` |
| `getTeacherCourses(uid, extraIds)` | Teacher UID | `{ courses: [{courseName, section, semester, studentCount}], status }` |
| `getPendingAttendance(uid, extraIds)` | Teacher UID | `{ pending: [{period, courseName, className}], status }` |

**Pending Attendance logic**: Compares today's timetable slots against attendance records. Only shows slots where the period's end time has passed but no attendance was recorded.

**Period end times** used:
| Period | Ends At |
|--------|---------|
| 1 | 10:00 AM (600 min) |
| 2 | 11:00 AM (660 min) |
| 3 | 12:15 PM (735 min) |
| 4 | 2:00 PM (840 min) |
| 5 | 3:00 PM (900 min) |
| 6 | 4:15 PM (975 min) |

### 7.5 API Route (`src/app/api/teacher/chat/route.ts`)

**Key difference from Student**: Uses `user.uid` (not `studentDocId`) and passes `extraIds` object `{ staffDocId, email }` for teacher resolution.

```
POST /api/teacher/chat
Body: { "message": "which students have low attendance?" }

1. Auth: role must be 'teacher'
2. Detect: "LowAttendanceIntent"
3. Fetch: svc.getLowAttendanceStudents(user.uid, { staffDocId: user.staffDocId, email: user.email })
4. Format: fmt.formatLowAttendance(data)
5. Return JSON
```

---

## 8. Admin Chatbot

### 8.1 Overview

The Admin Chatbot is the most **comprehensive** bot. It provides institution-wide analytics, lookups, summaries, and supports **30+ intents** across every ERP domain. It features an advanced **topic-routing fallback** system that understands flexible natural language patterns like "give me the summary about teachers" or "tell me about classes".

- **File Count**: 4 files
- **Total Intents**: 30+
- **Service Functions**: 30
- **Formatters**: 30+
- **Entity Extractors**: 6

### 8.2 Complete Intent List

#### Meta Intents
| Intent | Priority | Keywords (sample) |
|--------|----------|-------------------|
| `GreetingIntent` | 0 | hello, hi, namaste |
| `HelpIntent` | 1 | help, what can you do, guide me |
| `GoodbyeIntent` | 0 | bye, goodbye, thanks |

#### Personal / Utility Intents
| Intent | Priority | Keywords (sample) |
|--------|----------|-------------------|
| `PersonalInfoIntent` | 15 | what is my name, who am i, my profile, my email |
| `DateTimeIntent` | 15 | today's date, what day is it, current time |

#### Summary Intents
| Intent | Priority | Keywords (sample) |
|--------|----------|-------------------|
| `DashboardSummaryIntent` | 14 | dashboard summary, overall summary, how is the college |
| `StudentSummaryIntent` | 12 | student summary, about students, student analytics |
| `TeacherSummaryIntent` | 12 | teacher summary, about teachers, faculty overview |
| `GenderBreakdownIntent` | 14 | boys and girls, gender breakdown, how many boys |

#### Core Data Intents
| Intent | Priority | Keywords (sample) |
|--------|----------|-------------------|
| `TotalStudentsIntent` | 10 | total students, how many students, student count |
| `TotalTeachersIntent` | 10 | total teachers, how many teachers, faculty count |
| `OverallAttendanceIntent` | 12 | overall attendance, attendance rate, attendance report |
| `FeeSummaryIntent` | 10 | fee summary, fee collection, pending fees |
| `HostelOccupancyIntent` | 8 | hostel occupancy, all hostels, hostel stats |
| `PerformanceAnalyticsIntent` | 12 | performance analytics, pass percentage, CGPA |
| `ExamScheduleIntent` | 10 | exam schedule, upcoming exams |
| `StudentDistributionIntent` | 10 | student distribution, branch wise |
| `PendingApprovalsIntent` | 10 | pending approvals, unapproved, new registrations |
| `RecentLoginsIntent` | 8 | recent logins, login activity |
| `CoursesOverviewIntent` | 8 | total courses, all courses |
| `ClassesOverviewIntent` | 10 | total classes, how many classes |
| `PlacementOverviewIntent` | 10 | placements, internships, campus placement |
| `ApplicationsOverviewIntent` | 10 | applications, job applications |
| `NotificationsIntent` | 8 | notifications, alerts, announcements |
| `TimetableIntent` | 10 | timetable, class schedule |
| `ClassroomOverviewIntent` | 8 | classrooms, online classroom |

#### Lookup / Entity Intents (pattern-based)
| Intent | Triggers | Example |
|--------|----------|---------|
| `StudentLookupIntent` | USN pattern or "find student" phrases | "Who is BTE26CSE0010?" |
| `TeacherLookupIntent` | "find teacher", "teacher named" | "Find teacher named Smith" |
| `WardenDetailsIntent` | "warden", "who is the warden" | "Who is the warden of boys hostel?" |
| `HostelDetailsIntent` | Hostel name regex or detail keywords | "Boys hostel details" |
| `HostelRoomsIntent` | "hostel room", "room details" | "Room details of boys hostel" |
| `ComplaintSummaryIntent` | "complaint", "grievance" | "Hostel complaints summary" |
| `CourseLookupIntent` | "course details", course ID pattern | "Course CS101 details" |
| `ClassLookupIntent` | "classes in CSE", "CSE classes" | "How many classes in CSE?" |
| `BranchStudentsIntent` | "students in CSE", "CSE students" | "How many CSE 3rd year students?" |

### 8.3 Advanced Intent Detection (`src/chatbots/admin/intent.ts`)

The Admin intent detector is far more sophisticated than Student/Teacher. It has **4 detection stages**:

#### Stage 0: High-Priority Regex Detection (Steps 0, 0b, 0c)

Before any keyword matching, three regex-based checks run first:

```
Step 0  — PersonalInfoIntent: /\bmy\s+(name|profile|details|email|role)\b/
Step 0b — DateTimeIntent:     /\b(today's?\s+date|what\s+day|current\s+time)\b/
Step 0c — GenderBreakdownIntent: /\b(boys?\s+and\s+girls?|gender\s+(breakdown|distribution))\b/
```

These are checked FIRST because they could otherwise be misclassified (e.g., "my name" could match student-related keywords).

#### Stage 1-9: Pattern-Based Entity Detection

Each stage checks for specific entity patterns:

| Step | Intent | Detection Method |
|------|--------|------------------|
| 1 | `WardenDetailsIntent` | Keyword array (30 phrases) |
| 2 | `HostelRoomsIntent` | Keyword array (16 phrases) |
| 3 | `ComplaintSummaryIntent` | Keyword array (13 phrases) |
| 4 | `HostelDetailsIntent` | Regex `/(boys?|girls?)\s*hostel[\s-]*\d*/` + keywords |
| 5 | `CourseLookupIntent` | Keyword array (20 phrases) |
| 6 | `ClassLookupIntent` | Keyword array (12 phrases) |
| 7 | `BranchStudentsIntent` | Keyword array (22 phrases) |
| 8 | `TeacherLookupIntent` | Keyword array (25 phrases) |
| 9 | `StudentLookupIntent` | USN regex `/[A-Z0-9]{8,}/` + keyword array (23 phrases) |

#### Stage 10: Standard Keyword Matching

The same priority-based keyword matching used by Student/Teacher bots, but with **30+ intent rules** and much broader keyword lists (each intent has 10-30 keywords including "summary about X", "about X", "tell me about X" variants).

#### Stage 11: Topic Router Fallback

This is unique to the Admin bot. Catches flexible patterns like:
- "give me the classes summary"  
- "tell me about attendance"  
- "summary about teachers"  
- "show me the fee report"  

**Algorithm**:

```
1. Strip common NL prefixes (30+ patterns):
   "give me the", "tell me about the", "can you show",
   "i want to see", "please show", etc.

2. Strip summary/overview suffixes:
   "summary", "overview", "report", "details", "info",
   "data", "stats", "statistics", "analytics", "status"

3. Match remaining words against TOPIC_MAP (19 topics):
   "student" → StudentSummaryIntent
   "teacher" → TeacherSummaryIntent
   "attendance" → OverallAttendanceIntent
   "fee/fees" → FeeSummaryIntent
   "dashboard/overview/summary" → DashboardSummaryIntent
   ... etc.
```

### 8.4 Entity Extractors

The Admin intent file exports 6 entity extraction functions:

| Function | Pattern | Returns |
|----------|---------|---------|
| `extractSearchTerm(msg)` | USN: `/[A-Z0-9]{8,}/` or name after "named/find/search" | `{ type: 'usn'\|'name', value: string }` |
| `extractHostelName(msg)` | `/(boys?\|girls?)\s*hostel[\s-]*\d*/` | `"Boys Hostel -1"` or `null` |
| `extractBranch(msg)` | `/\b(cse\|ece\|eee\|mech\|civil\|it\|ai\|ml\|...)\b/` | `"CSE"` or `null` |
| `extractYear(msg)` | `/(\d)(st\|nd\|rd\|th)\s*year/` | `1-6` or `null` |
| `extractSemester(msg)` | `/semester\s*(\d)\|sem\s*(\d)/` | `1-8` or `null` |
| `extractCourseName(msg)` | Course ID `/[A-Z]{2,5}\d{1,3}/` or name patterns | `"CS101"` or `null` |

### 8.5 Service Functions (`src/chatbots/admin/service.ts`)

The Admin service has **30 functions**. Here's the complete list:

#### Basic Counts
| Function | Returns |
|----------|---------|
| `getTotalStudents()` | `{ total, active, pending, status }` |
| `getTotalTeachers()` | `{ total, status }` |

#### Aggregated Analytics
| Function | Returns |
|----------|---------|
| `getOverallAttendance()` | `{ overallPercentage, totalRecords, presentCount, status }` |
| `getFeeSummary()` | `{ totalFees, totalCollected, totalPending, collectionRate, fullyPaid, pendingPayments, status }` |
| `getHostelOccupancy()` | `{ hostels: [{hostelName, capacity, occupied, occupancyRate}], totalOccupied, totalCapacity, status }` |
| `getPerformanceAnalytics()` | `{ overallPassRate, avgMarks, gradeDistribution, byBranch, status }` |
| `getExamSchedules()` | `{ exams: [{courseName, date, startTime, endTime, sessionName, program, branch}], status }` |
| `getStudentDistribution()` | `{ distribution: [{branch, count}], byYear, status }` |
| `getPendingApprovals()` | `{ count, students: [{name, branch, year, requestDate}], status }` |
| `getRecentLogins()` | `{ logins: [{name, role, timestamp, ipAddress}], status }` |

#### Overviews
| Function | Returns |
|----------|---------|
| `getCoursesOverview()` | `{ totalCourses, courses: [{courseId, courseName, credits, department}], status }` |
| `getClassesOverview()` | `{ totalClasses, classes: [{courseName, section, teacherName, studentCount, program, branch}], status }` |
| `getPlacementOverview()` | `{ totalPlacements, openPlacements, ..., recentOpportunities, status }` |
| `getApplicationsOverview()` | `{ total, byStatus, recentApplications, status }` |
| `getNotificationsSummary()` | `{ total, unread, byType, recent, status }` |
| `getTimetableSummary(filters)` | `{ totalSlots, branch, semester, byDay, status }` |
| `getClassroomOverview()` | `{ total, classrooms: [{name, section, subject, ownerName, memberCount}], status }` |

#### Lookups
| Function | Returns |
|----------|---------|
| `lookupStudent(type, value)` | `{ found, student: {name, collegeId, branch, year, ...}, status }` |
| `lookupTeacher(name)` | `{ found, teacher: {name, staffId, department, ...}, status }` |
| `lookupClasses(filters)` | `{ totalMatches, classes, filters, status }` |
| `lookupCourse(name)` | `{ found, course: {courseId, name, credits, ...}, status }` |
| `getBranchStudents(filters)` | `{ total, students: [{name, collegeId, year, semester}], filters, status }` |

#### Hostel-Specific
| Function | Returns |
|----------|---------|
| `getHostelDetails(name)` | `{ found, hostel: {name, capacity, occupied, warden, ...}, status }` |
| `getWardenDetails(hostelName)` | `{ found, wardens: [{wardenName, hostelName, contact, email, ...}], status }` |
| `getHostelRooms(hostelName)` | `{ hostelName, totalRooms, rooms: [{roomNumber, capacity, occupied, residents}], status }` |
| `getComplaintsSummary(hostelName)` | `{ totalComplaints, pending, resolved, complaints: [...], status }` |

#### Rich Summaries (NEW)
| Function | Returns |
|----------|---------|
| `getGenderBreakdown(branch?)` | `{ total, boys, girls, other, branch, byBranch: [{branch, boys, girls}], status }` |
| `getStudentSummary()` | `{ total, active, pending, boys, girls, byBranch, byYear, byType, status }` |
| `getTeacherSummary()` | `{ total, byDepartment, byDesignation, recentJoined, status }` |
| `getDashboardSummary()` | `{ totalStudents, activeStudents, pendingApprovals, totalTeachers, attendanceRate, feeCollectionRate, hostelOccupancy, openOpportunities, totalOffers, status }` |

**Dashboard Summary** uses `Promise.all` for parallel database fetching (7 collections fetched simultaneously).

**Gender detection logic**: Handles multiple formats:
- 'Male', 'male', 'M', 'm', 'Boy', 'boy' → counted as boys
- 'Female', 'female', 'F', 'f', 'Girl', 'girl' → counted as girls
- Everything else → counted as other

### 8.6 API Route (`src/app/api/admin/chat/route.ts`)

The Admin route has 30+ case handlers in a `switch` statement. Notable patterns:

**Lookup intents** extract entities from the message:
```typescript
case 'BranchStudentsIntent': {
  const branch = extractBranch(rawMessage);     // "CSE"
  const year = extractYear(rawMessage);          // 3
  const semester = extractSemester(rawMessage);  // null
  const data = await svc.getBranchStudents({ branch, year, semester });
  message = fmt.formatBranchStudents(data);
  break;
}
```

**PersonalInfoIntent** uses session data directly (no database call):
```typescript
case 'PersonalInfoIntent': {
  message = fmt.formatPersonalInfo({
    name: user.name || 'Admin',
    email: user.email || 'N/A',
    role: user.role || 'admin'
  });
  break;
}
```

**DateTimeIntent** needs no database call:
```typescript
case 'DateTimeIntent': {
  message = fmt.formatDateTime();
  break;
}
```

---

## 9. Frontend Chat UI Component

### File: `src/components/shared/chat-bot.tsx` (450 lines)

This is a **single universal component** used by all three chatbot roles. It adapts its appearance and behavior based on the `role` prop.

### Props

```typescript
interface ChatBotProps {
  role: "student" | "teacher" | "admin";
  userName: string;
}
```

### Role-Based Configuration

| Config | Student | Teacher | Admin |
|--------|---------|---------|-------|
| Label | "Student Assistant" | "Teacher Assistant" | "Admin Assistant" |
| API URL | `/api/student/chat` | `/api/teacher/chat` | `/api/admin/chat` |
| Gradient | Blue | Emerald | Violet |
| Accent BG | `bg-blue-500` | `bg-emerald-500` | `bg-violet-500` |

### UI Structure

```
┌─────────────────────────────────┐
│  [Bot Icon]  Admin Assistant    │  ← Header (gradient colored)
│              Online / Typing... │
│                    [Reset] [X]  │
├─────────────────────────────────┤
│                                 │
│  [Bot] Good morning, Admin! 👋  │  ← Messages area (ScrollArea)
│                                 │
│        What is my attendance? [User] │
│                                 │
│  [Bot] Your attendance is 85%   │
│                                 │
│  [Bot] ... (typing dots)        │  ← Loading indicator
│                                 │
├─────────────────────────────────┤
│  [Quick Actions — chips]        │  ← Only shown when ≤1 messages
│  Total Students | Fee Collection│
├─────────────────────────────────┤
│  [____________ Type a message] [→] │  ← Input area
└─────────────────────────────────┘

[💬]  ← Floating trigger button (bottom-right)
```

### Key Features

1. **Floating Button**: Bottom-right corner, round, gradient-colored. Toggles chat panel open/close.
2. **Auto-Greeting**: On first open, shows a time-aware welcome message (local, no API call).
3. **Quick Action Chips**: Shown when conversation just started. Each role has 5 preset actions.
4. **Typing Indicator**: Three bouncing dots while waiting for API response.
5. **Markdown Rendering**: `renderBotText()` parses `**bold**` and `_italic_` in bot responses.
6. **Auto-Scroll**: Scrolls to bottom on new messages.
7. **Reset**: Clears messages and sends a fresh greeting via API.
8. **Message Limit**: Input max 300 chars (also enforced server-side).
9. **Keyboard**: Enter to send, Shift+Enter for newline.
10. **Dark Mode**: Fully theme-aware with `dark:` Tailwind classes.

### Quick Actions Per Role

```typescript
student: ["My Attendance", "Today's Classes", "My Marks", "Fee Status", "Upcoming Exams"]
teacher: ["My Schedule", "Low Attendance", "Class Performance", "My Students", "Upcoming Exams"]
admin:   ["Total Students", "Fee Collection", "Overall Attendance", "Performance Analytics", "Hostel Occupancy"]
```

---

## 10. Integration Into the App Layout

### File: `src/components/layout/app-layout.tsx`

The `ChatBot` component is rendered inside the main `AppLayout`:

```tsx
import ChatBot from "@/components/shared/chat-bot";

// Inside the component:
<main>{children}</main>
<ChatBot role={role} userName={user?.name || 'User'} />
```

The `role` is determined by the logged-in user's session. This means:
- Admin users see the violet Admin Assistant
- Teacher users see the emerald Teacher Assistant  
- Student users see the blue Student Assistant
- Each can only access their own API endpoint

---

## 11. Database Schema & Collections

### Tables Used by Chatbots

| Table | Key Fields Used | Used By |
|-------|----------------|---------|
| `students` | id, name, collegeId, program, branch, year, semester, section, type, status, gender, hostelId, roomNumber, user_uid | All three |
| `teachers` | id, name, staffId, email, department, designation, specialization, user_uid, joinDate | Teacher, Admin |
| `attendance` | studentId, classId, date, period, status | All three |
| `marks` | studentId, classId, grade, total/totalmarks | Student, Teacher, Admin |
| `classes` | id, courseId, teacherId, courseName, teacherName, program, branch, section, semester, studentUids | All three |
| `courses` | id, courseId, name→courseName, credits, department | Student, Admin |
| `fees` | id, totalFees, amountPaid, balance, collegeFees, hostelFees | Student, Admin |
| `hostels` | id, name, capacity, occupied, warden, status | Student, Admin |
| `hostel_rooms` | hostelId, roomNumber, capacity, occupied, residents | Admin |
| `complaints` | id, hostelId, description, status, date | Admin |
| `opportunities` | id, company, role, type, status, ctc | Admin |
| `applications` | id, studentId, opportunityId, status, company, role, type | Admin |
| `exam_schedules` | id, courseName, courseCode, date, startTime, endTime, program, branch, status, examSessionName | All three |
| `login_activities` | id, name, role, timestamp, ipAddress | Admin |
| `notifications` | id, title, type, timestamp, read | Admin |
| `classrooms` | id, name, section, subject, ownerName, memberUids | Admin |

---

## 12. Step-by-Step Build Guide

### Step 1: Set Up the Project

```bash
# Assuming Next.js project already exists with Supabase
npm install iron-session bcryptjs lucide-react
npm install -D @types/bcryptjs
```

### Step 2: Create the Shared Types

Create `src/chatbots/types.ts`:
```typescript
export interface ChatRequest { message: string; }
export interface ChatResponse {
  success: boolean;
  role: 'student' | 'teacher' | 'admin';
  intent: string;
  message: string;
  metadata: Record<string, unknown>;
}
export interface ChatError {
  success: false;
  role: 'student' | 'teacher' | 'admin';
  intent: 'Error';
  message: string;
  metadata: {};
}
export interface DetectedIntent {
  intent: string;
  confidence: 'exact' | 'partial';
}
```

### Step 3: Create the Intent Detector

Create `src/chatbots/{role}/intent.ts`:

1. Define an `IntentRule[]` array with `{ intent, keywords, priority }`
2. Write a `detect{Role}Intent(rawMessage)` function:
   - Lowercase and trim the message
   - Loop through rules, match keywords
   - Return highest-priority match

### Step 4: Create the Service Layer

Create `src/chatbots/{role}/service.ts`:

1. Import database helpers from `@/lib/db`
2. Write one function per intent that needs data
3. Each function returns a typed object with a `status` field
4. Filter data by the authenticated user's ID (student/teacher) or aggregate institution-wide (admin)
5. NEVER return raw database objects

### Step 5: Create the Formatter

Create `src/chatbots/{role}/formatter.ts`:

1. Write one function per intent
2. Accept the service function's return type
3. Return a markdown-formatted string with emojis
4. Handle all `status` values (no_data, no_student, error, etc.)
5. Include `formatGreeting()`, `formatHelp()`, `formatGoodbye()`, `formatUnrecognized()`

### Step 6: Create the API Route

Create `src/app/api/{role}/chat/route.ts`:

```typescript
export async function POST(request: NextRequest) {
  // 1. Authenticate
  const user = await getCurrentUser();
  if (!user || user.role !== 'expected_role') return error response;
  
  // 2. Parse & validate input
  const body = await request.json();
  const rawMessage = body.message.trim().slice(0, 300);
  
  // 3. Detect intent
  const detected = detectIntent(rawMessage);
  if (!detected) return unrecognized response;
  
  // 4. Switch on intent → call service → format response
  switch (detected.intent) {
    case 'SomeIntent': {
      const data = await svc.getData();
      message = fmt.formatData(data);
      break;
    }
    // ... more cases
  }
  
  // 5. Return JSON response
  return NextResponse.json<ChatResponse>({ success: true, role, intent, message, metadata });
}
```

### Step 7: Create the Chat UI Component

Create `src/components/shared/chat-bot.tsx`:

1. Define role config (label, API URL, colors)
2. Manage state: `messages[]`, `input`, `isLoading`, `isOpen`, `hasGreeted`
3. `sendMessage()`: POST to API, append bot response
4. Render: floating trigger button + chat panel (header, messages, input)
5. Add quick action chips, typing indicator, auto-scroll

### Step 8: Integrate Into Layout

In `src/components/layout/app-layout.tsx`:

```tsx
import ChatBot from "@/components/shared/chat-bot";

// Inside render:
<ChatBot role={user.role} userName={user.name || 'User'} />
```

### Step 9: Build & Test

```bash
npx next build
npm run dev
```

Test by logging in as each role and trying various queries.

---

## 13. How Intent Detection Works

### The Algorithm (All Bots)

```
                    User Message
                        │
                    ┌───▼───┐
                    │Lowercase│
                    │ + Trim  │
                    └───┬────┘
                        │
            ┌───────────┼───────────┐
            │           │           │
      [Admin Only]  [All Bots]  [Admin Only]
      Regex Stage   Keyword     Topic Router
      (Steps 0-0c)  Matching    (Step 11)
            │       (Step 10)       │
            │           │           │
            └───────┬───┘           │
                    │               │
              Pattern Match    ┌────▼────┐
              (Steps 1-9)      │ Strip   │
              [Admin Only]     │ Prefixes│
                    │          │ & Match │
                    │          │ Topics  │
                    │          └────┬────┘
                    │               │
                    └───────┬───────┘
                            │
                      Best Match
                     (by priority)
                            │
                    ┌───────▼───────┐
                    │ DetectedIntent │
                    │ { intent,      │
                    │   confidence } │
                    └────────────────┘
```

### Priority Resolution

When multiple intents match:
1. **Exact matches** (full message === keyword) get +100 priority bonus
2. Among remaining matches, the one with the highest base `priority` wins
3. Admin-specific: Regex checks (steps 0-0c) override everything
4. Admin-specific: Pattern checks (steps 1-9) override keyword matching
5. Admin-specific: Topic router (step 11) only runs if nothing else matched

---

## 14. Adding a New Intent (Guide)

Example: Adding a "LibraryIntent" to the Admin chatbot.

### Step 1: Add keywords in `intent.ts`

```typescript
// In ADMIN_INTENT_RULES array:
{ intent: 'LibraryIntent', priority: 10, keywords: [
  'library', 'books', 'library books', 'borrowed books', 'library summary',
  'library overview', 'about library', 'summary of library',
]},
```

### Step 2: Add topic entry (optional, for flexible matching)

```typescript
// In TOPIC_MAP array:
{ topics: ['library', 'books', 'borrow'], intent: 'LibraryIntent' },
```

### Step 3: Add service function in `service.ts`

```typescript
export async function getLibrarySummary() {
  const books = await readCollection<any>('library');
  // ... aggregate data
  return { totalBooks: books.length, borrowed: ..., status: 'ok' };
}
```

### Step 4: Add formatter in `formatter.ts`

```typescript
export function formatLibrarySummary(data: { totalBooks: number; borrowed: number; status: string }): string {
  if (data.status === 'no_data') return 'No library data available.';
  return `📚 **Library Summary:**\n\n• Total Books: **${data.totalBooks}**\n• Borrowed: **${data.borrowed}**`;
}
```

### Step 5: Add case in `route.ts`

```typescript
case 'LibraryIntent': {
  const data = await svc.getLibrarySummary();
  message = fmt.formatLibrarySummary(data);
  metadata = { totalBooks: data.totalBooks };
  break;
}
```

### Step 6: Build and test

```bash
npx next build
```

---

## 15. Security Considerations

### Authentication & Authorization

1. **Every API route** calls `getCurrentUser()` first — no anonymous access.
2. **Role checking**: Student route rejects non-students, teacher route rejects non-teachers, admin route rejects non-admins.
3. **Data isolation**: Student/Teacher services filter by the user's own ID. Students cannot see other students' data.
4. **iron-session**: Cookies are `httpOnly`, `sameSite: 'lax'`, and `secure` in production.
5. **Session secret**: Must be 32+ characters long.

### Input Sanitization

1. **Max length**: Messages capped at 300 characters (client + server).
2. **Type checking**: `typeof body.message === 'string'` verified before processing.
3. **Trim**: Leading/trailing whitespace removed.
4. **No SQL injection risk**: Uses Supabase SDK with parameterized queries.
5. **No XSS risk**: Bot responses are rendered as text (with safe markdown parsing), not as raw HTML.

### Data Protection

1. **No `SELECT *`**: Service functions return only needed fields.
2. **No raw DB objects**: Data is mapped to clean interfaces before returning.
3. **Error handling**: Try-catch at route level; generic error messages sent to client, detailed errors logged server-side only.
4. **No credentials in responses**: Passwords, tokens, secrets are never included in chatbot responses.

---

## 16. Troubleshooting & FAQ

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| "Please log in to use the chatbot" | Session expired or missing | Log in again; check `SESSION_SECRET` env var |
| "Access denied" | Role mismatch | Student can't use admin bot, etc. |
| Bot says "I didn't understand" | No keyword match | Add more keywords to the intent's keyword array |
| "classes summary" works but "class summary" doesn't | Missing singular/plural variant | Add both "class summary" and "classes summary" to keywords |
| Timetable shows no data | `src/data/timetable.json` missing or empty | Ensure file exists with proper format |
| Teacher bot can't find profile | UID mismatch across tables | `resolveTeacher()` tries uid → staffDocId → email |
| Gender shows 0 boys/girls | Different gender field values | Service handles 'Male'/'M'/'Boy' + 'Female'/'F'/'Girl' |

### Performance Notes

- **Admin dashboard summary** fetches 7 collections in parallel (`Promise.all`) for speed.
- **Timetable** is file-based (loaded from disk), not database — fast reads.
- **No caching** currently — every request hits the database. For high-traffic deployments, consider adding in-memory caching with TTL.

### Testing Queries

**Student Bot**:
- "What is my attendance?"
- "Show my marks"
- "What classes do I have today?"
- "What is my fee status?"
- "Am I in a hostel?"

**Teacher Bot**:
- "What are my classes today?"
- "Which students have low attendance?"
- "How is my class performing?"
- "Do I have pending attendance?"
- "What courses am I teaching?"

**Admin Bot**:
- "Dashboard summary"
- "How many boys and girls in CSE?"
- "What is my name?"
- "Today's date and day"
- "Summary about teachers"
- "Give me the classes summary"
- "Find student named John"
- "Who is the warden of boys hostel?"
- "Total students"
- "Fee collection status"
- "Placement stats"
- "CSE 3rd year students"

---

## Summary Statistics

| Metric | Student | Teacher | Admin |
|--------|---------|---------|-------|
| Total Files | 4 | 4 | 4 |
| Intents | 12 | 12 | 30+ |
| Service Functions | 9 | 8 | 30 |
| Formatters | 12 | 12 | 30+ |
| Keyword Rules | 12 | 12 | 30+ (500+ keywords) |
| Entity Extractors | 0 | 0 | 6 |
| Detection Stages | 1 | 1 | 4 (regex + patterns + keywords + topic router) |
| DB Collections Used | 7 | 5 | 18 |
| Code Lines (approx) | ~650 | ~750 | ~2,800 |

**Total chatbot system**: ~14 files, ~4,600+ lines of code, 54+ intents, 47+ service functions, 54+ formatters.

---

*Document generated for the ERP AI Chatbot System. All three bots share the same architectural pattern but differ in scope — Student (personal), Teacher (class-focused), Admin (institution-wide).*
