-- ============================================================================
-- ERP SUPABASE SCHEMA — DEFINITIVE SINGLE SCRIPT
-- ============================================================================
-- Run this ENTIRE script in the Supabase SQL Editor.
-- It drops ALL existing ERP tables and recreates them from scratch.
--
-- Column naming: camelCase in double-quotes to match the Next.js frontend
-- exactly. Postgres preserves case when quoted.
--
-- Generated: 2026-03-03
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0. EXTENSIONS                                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  1. DROP ALL EXISTING TABLES (reverse dependency order)                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DROP TABLE IF EXISTS "backlogs"        CASCADE;
DROP TABLE IF EXISTS "counters"        CASCADE;
DROP TABLE IF EXISTS "classrooms"      CASCADE;
DROP TABLE IF EXISTS "hall_tickets"    CASCADE;
DROP TABLE IF EXISTS "notifications"   CASCADE;
DROP TABLE IF EXISTS "login_activities" CASCADE;
DROP TABLE IF EXISTS "applications"    CASCADE;
DROP TABLE IF EXISTS "opportunities"   CASCADE;
DROP TABLE IF EXISTS "complaints"      CASCADE;
DROP TABLE IF EXISTS "hostel_rooms"    CASCADE;
DROP TABLE IF EXISTS "hostels"         CASCADE;
DROP TABLE IF EXISTS "fees"            CASCADE;
DROP TABLE IF EXISTS "marks"           CASCADE;
DROP TABLE IF EXISTS "attendance"      CASCADE;
DROP TABLE IF EXISTS "exam_schedules"  CASCADE;
DROP TABLE IF EXISTS "classes"         CASCADE;
DROP TABLE IF EXISTS "courses"         CASCADE;
DROP TABLE IF EXISTS "admins"          CASCADE;
DROP TABLE IF EXISTS "teachers"        CASCADE;
DROP TABLE IF EXISTS "students"        CASCADE;
DROP TABLE IF EXISTS "users"           CASCADE;



-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  2. CREATE TABLES                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ────────────────────────────────────────────────────────────────────────────
-- 2.1  USERS — centralised auth (iron-session + bcrypt)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "users" (
    "id"            TEXT PRIMARY KEY,
    "uid"           TEXT,
    "name"          TEXT,
    "email"         TEXT UNIQUE,
    "passwordHash"  TEXT,
    "role"          TEXT,                -- 'student' | 'teacher' | 'admin'
    "staffId"       TEXT,
    "staffDocId"    TEXT,
    "studentDocId"  TEXT,
    "collegeId"     TEXT,
    "initials"      TEXT,
    "avatarUrl"     TEXT,
    "program"       TEXT,
    "branch"        TEXT,
    "year"          NUMERIC,
    "settings"      JSONB,              -- { notifications: { enabled: boolean } }
    "createdAt"     TEXT,
    "updatedAt"     TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.2  STUDENTS
--   • Section assigned automatically based on USN sequence (strength = 15 per section)
--     USN 1-15 → Section A, 16-30 → Section B, 31-45 → Section C, etc.
--   • USN format: PRG(3) + YY + BRN + NNNN  (e.g. BTE25CSE0001)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "students" (
    "id"                TEXT PRIMARY KEY,
    "user_uid"          TEXT,
    "collegeId"         TEXT,
    "name"              TEXT,
    "email"             TEXT,
    "program"           TEXT,
    "branch"            TEXT,
    "year"              NUMERIC,
    "semester"          NUMERIC,
    "section"           TEXT,              -- auto-assigned: A, B, C... (15 students per section)
    "batch"             TEXT,
    "status"            TEXT,
    "type"              TEXT,           -- 'Day Scholar' | 'Hosteler'
    "gender"            TEXT,           -- 'Male' | 'Female' | 'Other'
    "avatarUrl"         TEXT,
    "initials"          TEXT,
    "phone"             TEXT,
    "dob"               TEXT,
    "address"           TEXT,
    "hostelId"          TEXT,
    "roomNumber"        TEXT,
    "emergencyContact"  JSONB,          -- { name, phone, address }
    "createdAt"         TEXT,
    "updatedAt"         TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.3  TEACHERS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "teachers" (
    "id"                TEXT PRIMARY KEY,
    "user_uid"          TEXT,
    "staffId"           TEXT,
    "name"              TEXT,
    "email"             TEXT,
    "program"           TEXT,
    "department"        TEXT,
    "position"          TEXT,
    "designation"       TEXT,
    "status"            TEXT,
    "avatarUrl"         TEXT,
    "initials"          TEXT,
    "phone"             TEXT,
    "dob"               TEXT,
    "joinDate"          TEXT,
    "qualifications"    TEXT,
    "specialization"    TEXT,
    "officeLocation"    TEXT,
    "createdAt"         TEXT,
    "updatedAt"         TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.4  ADMINS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "admins" (
    "id"                TEXT PRIMARY KEY,
    "user_uid"          TEXT,
    "staffId"           TEXT,
    "name"              TEXT,
    "email"             TEXT,
    "department"        TEXT,
    "position"          TEXT,
    "designation"       TEXT,
    "status"            TEXT,
    "avatarUrl"         TEXT,
    "initials"          TEXT,
    "phone"             TEXT,
    "officeLocation"    TEXT,
    "qualifications"    TEXT,
    "specialization"    TEXT,
    "dob"               TEXT,
    "joinDate"          TEXT,
    "program"           TEXT,
    "createdAt"         TEXT,
    "updatedAt"         TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.5  COURSES
--   • db.ts maps: courseName (app) ↔ name (DB column)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "courses" (
    "id"            TEXT PRIMARY KEY,
    "courseId"       TEXT,
    "courseCode"     TEXT,
    "name"          TEXT,               -- mapped to/from "courseName" in app code
    "description"   TEXT,
    "program"       TEXT,
    "branch"        TEXT,
    "semester"      NUMERIC,
    "credits"       NUMERIC,
    "createdAt"     TEXT,
    "updatedAt"     TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.6  CLASSES — maps courses to teachers & student sections
--   • Each section has a strength of 15 students (configurable via SECTION_STRENGTH in utils.ts)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "classes" (
    "id"            TEXT PRIMARY KEY,
    "courseId"       TEXT,
    "courseName"    TEXT,
    "teacherId"     TEXT,
    "teacherName"   TEXT,
    "program"       TEXT,
    "branch"        TEXT,
    "year"          NUMERIC,
    "semester"      NUMERIC,
    "section"       TEXT,
    "maxStrength"   NUMERIC DEFAULT 15,    -- max students per section
    "studentCount"  NUMERIC DEFAULT 0,
    "studentUids"   JSONB DEFAULT '[]'::jsonb,   -- string[] of user UIDs
    "credits"       NUMERIC,
    "classroomId"   TEXT,
    "createdAt"     TEXT,
    "updatedAt"     TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.7  ATTENDANCE
--   • Composite PK id = "{classId}_{date}_{period}_{studentId}"
--   • Accessed via direct supabase queries (not abstraction layer)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "attendance" (
    "id"            TEXT PRIMARY KEY,
    "classId"       TEXT,
    "studentId"     TEXT,
    "date"          TEXT,
    "period"        NUMERIC,
    "status"        TEXT,               -- 'Present' | 'Absent'
    "createdAt"     TEXT,
    "updatedAt"     TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.8  MARKS
--   • Accessed via direct supabase queries
--   • Column names are lowercase (Postgres default for unquoted identifiers)
--   • The app defensively reads both camelCase and lowercase variants
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "marks" (
    "id"              TEXT PRIMARY KEY,
    "classId"         TEXT,
    "studentId"       TEXT,
    "studentname"     TEXT,
    "coursecode"      TEXT,
    "semester"        NUMERIC,
    "credits"         NUMERIC,
    "ia1"             NUMERIC,
    "ia2"             NUMERIC,
    "other"           NUMERIC,
    "see"             NUMERIC,
    "internalsmarks"  NUMERIC,
    "externalsmarks"  NUMERIC,
    "totalmarks"      NUMERIC,
    "total"           NUMERIC,
    "grade"           TEXT,
    "updatedAt"       TEXT
);

-- Prevent duplicate marks per student per class
ALTER TABLE "marks"
    ADD CONSTRAINT "unique_student_class_marks"
    UNIQUE ("classId", "studentId");

-- ────────────────────────────────────────────────────────────────────────────
-- 2.9  FEES
--   • id = student doc id (1:1 mapping to students)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "fees" (
    "id"                TEXT PRIMARY KEY,
    "studentName"       TEXT,
    "studentCollegeId"  TEXT,
    "program"           TEXT,
    "branch"            TEXT,
    "year"              NUMERIC,
    "collegeFees"       JSONB DEFAULT '{"total":150000,"paid":0,"balance":150000}'::jsonb,
    "hostelFees"        JSONB,          -- { total, paid, balance } or null
    "totalFees"         NUMERIC,
    "amountPaid"        NUMERIC DEFAULT 0,
    "balance"           NUMERIC,
    "transactions"      JSONB DEFAULT '[]'::jsonb,   -- array of Transaction objects
    "createdAt"         TEXT,
    "updatedAt"         TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.10  EXAM SCHEDULES  (collection: "exams")
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "exam_schedules" (
    "id"                TEXT PRIMARY KEY,
    "program"           TEXT,
    "branch"            TEXT,
    "year"              NUMERIC,
    "semester"          NUMERIC,
    "courseCode"        TEXT,
    "courseName"        TEXT,
    "examSessionName"   TEXT,
    "date"              TEXT,
    "startTime"         TEXT,
    "endTime"           TEXT,
    "status"            TEXT,           -- 'Scheduled' | 'Cancelled' | 'Completed'
    "credits"           NUMERIC,
    "createdAt"         TEXT,
    "updatedAt"         TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.11  HALL TICKETS  (collection: "hallTickets")
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "hall_tickets" (
    "id"                              TEXT PRIMARY KEY,
    "studentId"                       TEXT,
    "studentName"                     TEXT,
    "studentPhotoUrl"                 TEXT,
    "studentCollegeId"                TEXT,
    "program"                         TEXT,
    "branch"                          TEXT,
    "year"                            NUMERIC,
    "semester"                        NUMERIC,
    "examSessionName"                 TEXT,
    "exams"                           JSONB,    -- array of exam objects
    "instructions"                    TEXT,
    "controllerSignaturePlaceholder"  TEXT,
    "eligibility"                     JSONB,    -- { minAttendance, minFeePaidPercent }
    "generatedDate"                   TEXT,
    "createdAt"                       TEXT,
    "updatedAt"                       TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.12  HOSTELS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "hostels" (
    "id"              TEXT PRIMARY KEY,
    "name"            TEXT,
    "type"            TEXT,             -- 'Boys' | 'Girls' | 'Co-ed'
    "status"          TEXT,             -- 'Operational' | 'Under Maintenance' | 'Closed'
    "capacity"        NUMERIC DEFAULT 0,
    "occupied"        NUMERIC DEFAULT 0,
    "warden"          JSONB,            -- { name, contact, email, office }
    "amenities"       JSONB,            -- string[]
    "rulesHighlight"  JSONB,            -- string[]
    "createdAt"       TEXT,
    "updatedAt"       TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.13  HOSTEL ROOMS  (collection: "rooms")
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "hostel_rooms" (
    "id"            TEXT PRIMARY KEY,
    "hostelId"      TEXT,
    "roomNumber"    TEXT,
    "capacity"      NUMERIC DEFAULT 1,
    "occupied"      NUMERIC DEFAULT 0,
    "residents"     JSONB              -- [{ studentId, studentName }]
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.14  COMPLAINTS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "complaints" (
    "id"            TEXT PRIMARY KEY,
    "studentId"     TEXT,
    "studentName"   TEXT,
    "hostelId"      TEXT,
    "roomNumber"    TEXT,
    "issue"         TEXT,
    "date"          TEXT,
    "status"        TEXT,               -- 'Pending' | 'In Progress' | 'Resolved'
    "resolvedAt"    TEXT,
    "resolvedBy"    TEXT,
    "createdAt"     TEXT,
    "updatedAt"     TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.15  OPPORTUNITIES  (collections: "placements", "internships", "opportunities")
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "opportunities" (
    "id"            TEXT PRIMARY KEY,
    "type"          TEXT,               -- 'placement' | 'internship'
    "company"       TEXT,
    "role"          TEXT,
    "ctc_stipend"   TEXT,
    "location"      TEXT,
    "duration"      TEXT,
    "description"   TEXT,
    "skills"        JSONB,              -- string[]
    "eligibility"   TEXT,
    "minCgpa"       NUMERIC,
    "status"        TEXT,               -- 'Open' | 'Closed'
    "postedAt"      TEXT,
    "createdAt"     TEXT,
    "updatedAt"     TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.16  APPLICATIONS  (student opportunity applications)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "applications" (
    "id"                TEXT PRIMARY KEY,
    "studentId"         TEXT,
    "studentUid"        TEXT,
    "studentName"       TEXT,
    "studentCollegeId"  TEXT,
    "opportunityId"     TEXT,
    "opportunityType"   TEXT,           -- 'placement' | 'internship'
    "company"           TEXT,
    "role"              TEXT,
    "status"            TEXT,           -- 'Applied' | 'Under Review' | 'Shortlisted' | etc.
    "appliedAt"         TEXT,
    "createdAt"         TEXT,
    "updatedAt"         TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.17  NOTIFICATIONS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "notifications" (
    "id"              TEXT PRIMARY KEY,
    "recipientUid"    TEXT,
    "title"           TEXT,
    "message"         TEXT,
    "type"            TEXT,
    "link"            TEXT,
    "read"            BOOLEAN DEFAULT false,
    "timestamp"       TEXT,
    "createdAt"       TEXT,
    "updatedAt"       TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.18  LOGIN ACTIVITIES  (collection: "loginActivities")
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "login_activities" (
    "id"            TEXT PRIMARY KEY,
    "userId"        TEXT,
    "userRole"      TEXT,
    "userName"      TEXT,
    "timestamp"     TEXT,
    "status"        TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.19  CLASSROOMS  (Google Classroom integration)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "classrooms" (
    "id"              TEXT PRIMARY KEY,
    "name"            TEXT NOT NULL,
    "section"         TEXT DEFAULT '',
    "subject"         TEXT DEFAULT '',
    "ownerId"         TEXT NOT NULL,
    "ownerName"       TEXT NOT NULL,
    "memberUids"      JSONB DEFAULT '[]'::jsonb,     -- string[]
    "theme"           TEXT DEFAULT 'theme-0',
    "inviteCode"      TEXT UNIQUE NOT NULL,
    "googleCourseId"  TEXT,
    "messages"        JSONB DEFAULT '{}'::jsonb,
    "createdAt"       TEXT,
    "updatedAt"       TEXT
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2.20  COUNTERS  (sequential ID generation via db.ts getNextCounter)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "counters" (
    "id"      TEXT PRIMARY KEY,          -- e.g. 'teacher_25_BTEC', 'admin_25', 'student_BTE_25_CSE'
    "value"   INTEGER NOT NULL DEFAULT 0
);

-- Atomic counter increment — 1 roundtrip from the client
CREATE OR REPLACE FUNCTION increment_counter(counter_key TEXT)
RETURNS INTEGER AS $$
DECLARE
  next_val INTEGER;
BEGIN
  INSERT INTO "counters" ("id", "value")
  VALUES (counter_key, 1)
  ON CONFLICT ("id")
  DO UPDATE SET "value" = "counters"."value" + 1
  RETURNING "value" INTO next_val;
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────────────────────
-- 2.21  BACKLOGS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "backlogs" (
    "id"                  TEXT PRIMARY KEY,
    "studentid"           TEXT,
    "studentname"         TEXT,
    "coursecode"          TEXT,
    "coursename"          TEXT,
    "semesterattempted"   INTEGER,
    "status"              TEXT DEFAULT 'Active',      -- 'Active' | 'Cleared'
    "gradeachieved"       TEXT,
    "updatedat"           TEXT
);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  3. ROW LEVEL SECURITY (open policies — app uses anon key)            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- The app connects with the Supabase anon key and handles auth at the
-- application layer (iron-session). Open RLS policies are required for
-- all CRUD operations to work.

ALTER TABLE "users"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teachers"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admins"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "courses"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classes"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marks"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fees"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_schedules"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hall_tickets"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hostels"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hostel_rooms"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "complaints"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "opportunities"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "applications"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classrooms"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "counters"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "backlogs"         ENABLE ROW LEVEL SECURITY;

-- Create open policies for all tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'users', 'students', 'teachers', 'admins', 'courses',
            'classes', 'attendance', 'marks', 'fees', 'exam_schedules',
            'hall_tickets', 'hostels', 'hostel_rooms', 'complaints',
            'opportunities', 'applications', 'notifications',
            'login_activities', 'classrooms', 'counters', 'backlogs'
        ])
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS "Allow all for anon" ON public.%I', t
        );
        EXECUTE format(
            'CREATE POLICY "Allow all for anon" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t
        );
    END LOOP;
END
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  4. INDEXES (performance)                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Users
CREATE INDEX IF NOT EXISTS "idx_users_email"    ON "users" ("email");
CREATE INDEX IF NOT EXISTS "idx_users_role"     ON "users" ("role");

-- Students
CREATE INDEX IF NOT EXISTS "idx_students_user_uid"   ON "students" ("user_uid");
CREATE INDEX IF NOT EXISTS "idx_students_collegeId"  ON "students" ("collegeId");
CREATE INDEX IF NOT EXISTS "idx_students_program"    ON "students" ("program", "branch", "year");

-- Teachers
CREATE INDEX IF NOT EXISTS "idx_teachers_user_uid"   ON "teachers" ("user_uid");
CREATE INDEX IF NOT EXISTS "idx_teachers_staffId"    ON "teachers" ("staffId");

-- Admins
CREATE INDEX IF NOT EXISTS "idx_admins_user_uid"     ON "admins" ("user_uid");

-- Classes
CREATE INDEX IF NOT EXISTS "idx_classes_teacherId"   ON "classes" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_classes_courseId"     ON "classes" ("courseId");
CREATE INDEX IF NOT EXISTS "idx_classes_lookup"       ON "classes" ("program", "branch", "semester", "section");

-- Attendance
CREATE INDEX IF NOT EXISTS "idx_attendance_classId"   ON "attendance" ("classId");
CREATE INDEX IF NOT EXISTS "idx_attendance_studentId" ON "attendance" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_attendance_date"      ON "attendance" ("date");

-- Marks
CREATE INDEX IF NOT EXISTS "idx_marks_classId"   ON "marks" ("classId");
CREATE INDEX IF NOT EXISTS "idx_marks_studentId" ON "marks" ("studentId");

-- Fees
CREATE INDEX IF NOT EXISTS "idx_fees_studentCollegeId" ON "fees" ("studentCollegeId");

-- Exam Schedules
CREATE INDEX IF NOT EXISTS "idx_exams_program"    ON "exam_schedules" ("program", "branch", "semester");
CREATE INDEX IF NOT EXISTS "idx_exams_status"     ON "exam_schedules" ("status");

-- Hall Tickets
CREATE INDEX IF NOT EXISTS "idx_halltickets_studentId" ON "hall_tickets" ("studentId");

-- Notifications
CREATE INDEX IF NOT EXISTS "idx_notifications_recipientUid" ON "notifications" ("recipientUid");
CREATE INDEX IF NOT EXISTS "idx_notifications_read"         ON "notifications" ("read");

-- Applications
CREATE INDEX IF NOT EXISTS "idx_applications_studentUid"    ON "applications" ("studentUid");
CREATE INDEX IF NOT EXISTS "idx_applications_opportunityId" ON "applications" ("opportunityId");

-- Login Activities
CREATE INDEX IF NOT EXISTS "idx_login_userId" ON "login_activities" ("userId");

-- Classrooms
CREATE INDEX IF NOT EXISTS "idx_classrooms_ownerId"    ON "classrooms" ("ownerId");
CREATE INDEX IF NOT EXISTS "idx_classrooms_inviteCode" ON "classrooms" ("inviteCode");

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  5. DONE                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- All 21 tables created. Copy-paste this entire script into the Supabase
-- SQL Editor and run it. After this, seed your admin user via:
--   npm run seed:admin
