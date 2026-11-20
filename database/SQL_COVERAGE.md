# SQL coverage map

How every page, role and event in EduERP maps onto `database/*.sql`, and how that
mapping was verified. Keep this file in sync when a page or table changes.

**Verification (latest run)**
- Static audit of all 209 source files: every table, column, embedded relation, upsert key and RPC name/parameter used in code exists in the SQL — 0 mismatches.
- `database/tests/run.sh`: 202 checks across 5 suites (functional, automation, reads & edge cases, identifiers & backlogs, cascades) — all pass; files applied twice to prove idempotency, plus an upgrade from the previous schema.
- Load: 5,000 students in one section + 50 concurrent clients × 4 scenarios (20,000 transactions) — 0 failures, all invariants intact.
- Catalog checks: every foreign key has a full index; every `SECURITY DEFINER` function pins `search_path`; only the two RLS helpers are executable by browsers.

---

## 1. Pages → server actions → SQL

| Page | Server actions | SQL objects |
|---|---|---|
| `/login` (+ `/api/auth/login`) | login route | `profiles`, `login_events`, `hit_rate_limit` |
| `/signup` | `studentSelfRegister` | `students`, `profiles`, `next_sequence`, `hit_rate_limit`; triggers `students_created` (welcome, fee demand, admin alert) |
| `/admin-signup` | `adminSelfRegister` | `profiles`, `employees`, `next_sequence`, `hit_rate_limit` |
| `/forgot-password`, `/update-password`, `/auth/callback` | `sendPasswordResetLink` | Supabase Auth, `hit_rate_limit` |
| Settings (all roles) | `getUserSettings`, `updateNotificationPreferences` | `profiles.notification_enabled` (honoured by every notification insert) |
| Notifications (all roles) | `getMyNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `broadcastNotification` | `notifications`, `broadcast_notification` |
| **Admin** dashboard | `getAdminDashboardStats` | `get_admin_dashboard_stats` (60 s cache in `dashboard_cache`, `attendance_sessions`, `login_events`) |
| Admin students / profile | `getStudents`, `createStudentAccount`, `updateStudent`, `deleteStudent`, `getStudentProfileDetails`, `getStudentAttendanceDetails`, `getStudentMarksForDisplay` | `students`, `profiles`, `marks`, `fees`, `hostel_allocations`, `get_student_attendance_totals`; cascades on delete |
| Admin staff / teachers | `getStaff`, `createStaffAccount`, `updateStaff`, `deleteTeacher`, `getTeacherProfileDetails` | `teachers`, `employees`, `classes`, `get_section_student_counts`, `next_sequence`, `sync_auth_claims` |
| Admin courses | `getGroupedCourses`, `saveCourse`, `deleteCourse`, `getSectionsForBranch`, `getStudentsForSection` | `courses` (code via `next_sequence`), `get_distinct_sections` |
| Admin classes | `getClassesWithDetails`, `createClass`, `updateTeacherForClass`, `deleteClass`, `linkClassroomToClass` | `classes`, `ensure_current_term`, `get_section_student_counts`; trigger `class_teacher_notify` |
| Admin timetables | `getTimetableFilters`, `getScheduleForClass`, `saveTimetableBulk` | `timetables`, `replace_section_timetable` (atomic, clash check, notifies section) |
| Admin attendance | `getAggregatedAttendance`, `uploadAttendanceCsv`, `getAttendanceForExport` | `attendance` (upsert key), `attendance_sessions`, `get_attendance_rollup` |
| Admin exams | `getExamSchedules`, `scheduleExamsAndSetupHallTickets`, `saveExamSchedule`, `deleteExamSchedule` | `exams`, `exam_sessions` (hall-ticket rules); triggers `exams_notify`, `exams_changed_notify` |
| Admin marks | `getClassIdForSection`, `getMarksForClass`, `saveMarksBatch`, `calculateFinalMarks` | `marks` (upsert key, `tg_marks_compute`), result notifications, `audit_marks` |
| Admin fees | `getStudentsForFeeFiltering`, `getStudentFeeDetails`, `recordAdminPayment` | `fees` (per `study_year`), `fee_payments`, `record_fee_payment`, `fee_structures` |
| Admin hostels / detail | `getHostels`, `getHostelDetails`, `getAllocatableStudents` (`get_allocatable_students`), `addHostel`, `addHostelRoom`, `allocateStudentToRoom`, `removeStudentFromRoom`, `updateComplaintStatus`, … | `hostels`, `hostel_rooms.occupied`, `allocate_hostel_room`, `get_unallocated_hosteler_count`; triggers occupancy, allocation/complaint notices, hostel fee billing |
| Admin library / manage | `getBooks`, `searchGoogleBooks`, `importGoogleBook`, `issueBook`, `returnBook`, `getActiveIssues` | `books`, `book_issues`, `issue_book`, `return_book`, `set_book_total_copies` |
| Admin opportunities / applications | `getOpportunities`, `saveOpportunity`, `getAllApplications`, `updateApplicationStatus` | `placement_opportunities`, `placement_applications`; triggers `opportunity_notify`, `application_status_notify` |
| Admin promotion | `getEligibleStudentsForPromotion`, `promoteStudentsBatch` | `promote_students` → `promote_student` (graduation via `program_max_semesters`), `promotions` |
| **Employee** dashboard | `getEmployeeDashboardStats` | `get_employee_dashboard_stats` (cached) |
| Employee exams dashboard | `getMarksOverview`, … | `get_marks_overview` |
| Employee hostel fees / menu | `getHostelFees`, `processHostelPayment`, `getHostelMenu`, `updateHostelMenu` | `fees` (current study year), `fee_structures`, `record_fee_payment`, `hostel_menu` |
| Employee library | + `LoansPanel` | as admin library |
| Employee users / students / teachers | as admin directories | as admin directories |
| **Teacher** dashboard | `getTeacherDashboardData` | `attendance_sessions` (pending periods), `get_teacher_pending_marks`, `exams` |
| Teacher attendance | `getTeacherClasses`, `getStudentsForClass`, `getAttendanceForSlot`, `saveAttendance`, `getTeacherAttendanceLogs` | `attendance` upsert (future dates rejected), `get_teacher_attendance_sessions` |
| Teacher marks / exams / exam detail | as admin marks + `getTeacherExams`, `getTeacherExamStudents` | `get_exam_eligibility` (session rules) |
| Teacher students / profile | `getStudentsByClassForTeacher`, `getStudentProfileForTeacher`, `getTeacherProfileDetails` | `students`, `classes.classroom_id` |
| **Student** dashboard | `getStudentDashboardData` | `exams`, timetables, attendance totals |
| Student attendance / performance | `getStudentAttendanceDetails`, `getStudentPerformanceData` | `attendance`, `get_student_monthly_attendance` |
| Student marks | `getStudentMarksForDisplay`, `fetchStudentBacklogs` | `marks` (GPA from `grade_point` scale) |
| Student exams / hall ticket | `getStudentExamSchedules`, `getHallTicket` | `exams`, `get_student_exam_eligibility`, `exam_sessions` |
| Student fees / invoices | `getStudentFeeDetails` | `fees`, `fee_payments` |
| Student hostel | `getStudentHostelData`, `getHostelMenu`, `logComplaint` | `hostel_allocations`, `hostel_menu`, `hostel_complaints` |
| Student opportunities | `getOpportunities`, `submitApplication`, `getStudentApplications` | `apply_to_opportunity` (open, deadline, CGPA via `student_cgpa`, unique) |
| Student resume | `getMyResume`, `saveMyResume` | `resumes` |
| Student backlogs (sidebar entry only while a backlog is active) | `getStudentBacklogs`, `getMyBacklogCount` (session) | `backlogs`, `backlog_attempts`, `student_active_backlog_count` |
| Admin / exam department backlogs | `getBacklogs`, `getBacklogSummary`, `recordBacklogAttempt` | `record_backlog_attempt`, `get_backlog_summary`, trigger `marks_sync_backlogs_*` |
| Library (students/teachers) | `getBooks`, `getBookById`, `getMyBookIssues` | `books`, `book_issues` |
| Classrooms (teacher/student) | `createClassroom`, `joinClassroom`, `getMyClassrooms`, `getClassroom`, posts / assignments / submissions / notes actions | `classrooms`, `classroom_members` (`join_classroom`), `classroom_posts` (realtime), storage bucket `submissions`; triggers owner membership, `member_count`, assignment/grade notices |

## 2. Identifier generators

**Every person ID is 12 characters and uses one algorithm** (`generate_user_id`):

```
CATEGORY(3)  YY  SUBCATEGORY(2)  SERIAL(5)
   ENG       26       CS          00442     → ENG26CS00442
```

- **YY** is the joining year (2021 → `21`, 2026 → `26`).
- **SERIAL** counts up separately for each category + year + subcategory. If `ENG26CS00442` is the last one issued, the next person gets `ENG26CS00443`.
- The first time a prefix is used, the serial starts after the highest existing one, so earlier IDs are never reused, even if that person is deleted.
- Serials are allocated atomically, so simultaneous registrations never collide.
- Every candidate is checked against all roles, and a prefix that reaches 99999 raises a clear error instead of wrapping around.

| Role | Category | Subcategory | Example |
|---|---|---|---|
| Student | program: `ENG` B.Tech, `MBA`, `MCA`, `LAW`, `MED` MBBS, `SCI` B.Sc, `COM` B.Com | branch: `CS`, `CY` Cyber Security, `DS`, `AI`, `EC`, `ME`, `CV`, `IT`, `FN`, `MK`, `CA`, … | `ENG26CS00442` |
| Teacher | `TCH` | department: `CS`, `MA`, `PH`, `FN`, `CR`, `GM`, … | `TCH26CS00017` |
| Employee | `EMP` | type: `FE` fees, `HM` hostel, `SS` student & staff, `EX` exams & marks, `LB` library | `EMP26FE00003` |
| Super admin | `ADM` | `SA` | `ADM26SA00001` |

The code tables live in `src/lib/academic-codes.ts`, which also feeds every program/branch dropdown. The SQL copies are generated from it: run `python scripts/gen-id-code-sql.py` after editing it, and `--check` to verify (a test also compares all 99 codes). IDs are always generated, including for self-registration, which now asks for program, branch and joining year. They can't be changed once issued.

| Other identifier | Format | Example |
|---|---|---|
| Course | program + semester + branch + 3-digit serial | `ENG3CS001` |
| Exam | course + session + year | `ENG3CS001-SEE-2026` |
| Hall ticket | `HT` + year + session + college ID (stable on reprint) | `HT26SEEENG24CS00042` |
| Fee receipt | `RCP` + year + 7 digits | `RCP20260000123` |
| Hostel allotment / complaint | `HAL` / `HCT` + year + 6 digits | `HCT2026000017` |
| Library loan | `LIB` + year + 6 digits | `LIB2026000051` |
| Placement application | `APP` + year + 6 digits | `APP2026004210` |
| Backlog re-exam | `SUP` + year + 6 digits | `SUP2026000009` |

## 2b. Backlogs

- A grade of **F** creates a backlog for that subject (count 1). Re-saving the same F never inflates the count.
- The exam department or an admin records a re-exam with `record_backlog_attempt`. The original internals are kept and the new SEE replaces the old one.
  - **Fail:** the subject's backlog count goes up by one.
  - **Pass:** the marks are updated, the backlog is cleared with the new grade, and GPA/CGPA reflect it.
- Promotion carries failed subjects forward as backlogs; only ungraded subjects block it. **Graduation is blocked while any backlog is active.**
- Students are notified when a backlog is recorded, a re-exam fails, or a backlog is cleared.

## 3. Roles

| Role | Identity | Scope enforced in code (`auth-guard.ts`) | Scope enforced in DB (RLS, browser key) |
|---|---|---|---|
| `super_admin` | `profiles.role`, `employees.employee_type='super_admin'` | everything | own profile only |
| `employee` | `employees.employee_type` mirrored into JWT `app_metadata` | only their department's actions; middleware limits routes | own profile/employee row |
| `teacher` | `teachers.profile_id` | own classes (`assertClassAccess`), own classrooms, students read-only | own rows, classrooms they belong to |
| `student` | `students.profile_id` | only their own records (`requireStudentAccess`) | own attendance, marks, fees, applications, loans, resume, notifications, classrooms |

Relations: teacher ↔ class via `classes.teacher_id`; student ↔ class implicitly by program + branch + semester + section; classroom membership via `classroom_members`; attendance `teacher_id` = profile that marked it; fee rows per student per type per year of study.

## 4. Automatic behaviour

| Event | Effect |
|---|---|
| Student created | welcome notice; college fee demand; admins alerted if program/branch missing |
| Year of study changes / becomes hosteler | new fee demands billed |
| Payment inserted / deleted | `fees.paid_amount` + status updated; receipt notice; audited; payments immutable |
| Marks saved | total/grade recomputed; "result published/updated" notice; backlogs created/cleared; changes audited |
| Row inserted without an ID | college ID / staff code / course code / exam code / reference number assigned |
| Attendance saved | `attendance_sessions` refreshed (set-based); future dates rejected |
| Exam scheduled / rescheduled / cancelled | one notice per affected student per session |
| Class gets a teacher | teacher notified |
| Timetable replaced | atomic; teacher clash rejected; section + teachers notified |
| Room allocated / vacated | occupancy counter (capacity CHECK); student notified |
| Complaint filed / status changed | hostel staff notified / student notified |
| Book issued / returned | copies adjusted, fine computed, borrower notified |
| Drive posted / application status changes | active students notified / applicant notified |
| Classroom created / joined / assignment / grade | owner membership, member count, student notices |
| Profile role / employee type changes | JWT claims re-synced |
| **Daily 01:00** `run_daily_maintenance()` | close expired drives; complete past exams; bill missing fee demands; book overdue & due-tomorrow reminders; assignment-due reminders; drive-closing reminders; Mondays: fee dues + low attendance; purge old notifications, login events, rate-limit windows, cache |

## 5. Gaps found by the page audit (all fixed)

1. Hall-ticket rules from the exam dialog were discarded → `exam_sessions` + rule-driven eligibility.
2. Hall ticket fields blank and sessions mixed → one session per ticket with all fields.
3. Fees mixed year-of-study and calendar year → `study_year` everywhere (with upgrade migration).
4. Fees existed only after a first payment → automatic demand billing.
5. Exam dashboard grade chart always empty → `get_marks_overview`.
6. "Recent logins" showed registrations → `login_events`.
7. Exams never completed → daily maintenance.
8. Applications pages: blank company/ID, broken link.
9. Invoice, student profile, teacher student view: missing name/year/batch/initials/emergency contact.
10. Teacher profile classroom link missing; classroom member counts showed 0.
11. `/classrooms` route did not exist (header buttons, notification links) → role-aware redirects.
12. Resume builder prefilled with fake data and never saved → `resumes` table + save/load.
13. Public endpoints had no rate limiting → `rate_limits` + `hit_rate_limit`.
14. 20 foreign keys without indexes → indexes added.
15. Staff status "Terminated" rejected by a CHECK → allowed.
16. Student and teacher IDs could collide (same format, one uniqueness rule) → one 12-character algorithm with role categories (`ENG…`, `TCH…`, `EMP…`, `ADM…`).
17. IDs truncated names inconsistently with the course-code tables → shared code tables (`program_code`, `branch_code`, `department_code`).
18. No receipt, hall-ticket, complaint, allotment, loan or application numbers → generated reference numbers.
19. Backlogs were computed on the fly with no count or re-exam history → `backlogs` + `backlog_attempts` with student and staff pages.
20. The employee sidebar hid Notifications for every department.
21. Program/branch lists were duplicated in 10 files (MCA and Cyber Security missing) → one catalogue in `src/lib/academic-codes.ts`.
22. Self-registration let students type their own ID → generated from program, branch and joining year.
23. Student "Status" dropdown (Suspended, Dropped Out…) was never saved → `students.status` (synced with `is_graduated`); only Active students appear in rosters, exam lists, billing and drives; self-registrations start as Pending Approval.
24. Employee "View Details" on Students went to an admin-only page and on Teachers did nothing → `/employee/students/[id]`, `/employee/teachers/[id]`.
25. Teacher profile sent admins to a teacher-only page; profile pages navigated to admin routes from the employee portal → portal-aware navigation.
26. Hostel allocation listed students already housed elsewhere and loaded the whole student body → `get_allocatable_students`.
27. Placement "Apply Now" stayed active after applying and on closed drives → refresh + Closed / Deadline passed states.
