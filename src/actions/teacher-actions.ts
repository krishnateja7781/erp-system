'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { requireRole, pinToSelf, assertClassAccess, type Caller } from '@/lib/auth-guard';
import { periodFromStartTime } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StudentForClass { id: string; name: string; collegeId: string; email: string; section?: string | null; }
export interface TeacherCourseOption { id: string; name: string; code: string; }
export interface TeacherSectionOption { id: string; name: string; }
export interface AttendanceLogEntry {
  classId: string; date: string; period: number; courseName: string; courseCode: string; class: string; studentCount: number;
}
export interface TeacherScheduledSession { name: string; startDate: string; endDate: string; }
export interface TeacherClassWithStudents {
  classInfo: { id: string; courseCode: string; courseName: string; class: string };
  students: StudentForClass[];
}

const TEACHING_STAFF = ['teacher', 'emp:exam_marks_management'] as const;

const classLabel = (c: any) => `${c?.program || ''} ${c?.branch || ''} ${c?.section || ''}`.trim();

/** Resolves the teachers.id the caller is acting as (teachers are pinned to themselves). */
async function actingTeacherId(caller: Caller, requestedProfileId: string): Promise<string | null> {
  const profileId = pinToSelf(caller, requestedProfileId);
  const admin = await createServiceRoleClient();
  const { data } = await admin.from('teachers').select('id').eq('profile_id', profileId).maybeSingle();
  return data?.id ?? null;
}

/** Roster of a class: active students matching its program/branch/semester/section. */
async function rosterFor(admin: any, cls: { program: string; branch: string; semester: number; section: string | null }): Promise<StudentForClass[]> {
  const { data } = await admin
    .from('students')
    .select('id, college_id, section, profiles(full_name, email)')
    .eq('program', cls.program)
    .eq('branch', cls.branch)
    .eq('current_semester', cls.semester)
    .eq('section', cls.section || 'A')
    .eq('status', 'Active')
    .order('college_id')
    .limit(1000);
  return (data || []).map((s: any) => ({
    id: s.id,
    name: s.profiles?.full_name || 'Unknown',
    collegeId: s.college_id,
    email: s.profiles?.email || '',
    section: s.section || null,
  }));
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function getMyTeacherId(): Promise<string | null> {
  const caller = await requireRole('teacher').catch(() => null);
  return caller?.userId ?? null;
}

export async function getTeacherClasses(teacherProfileId: string) {
  const caller = await requireRole(...TEACHING_STAFF);
  const teacherId = await actingTeacherId(caller, teacherProfileId);
  if (!teacherId) return [];
  const admin = await createServiceRoleClient();
  const { data } = await admin
    .from('classes')
    .select('id, program, branch, section, courses(id, name, code)')
    .eq('teacher_id', teacherId);
  return (data || []).map((c: any) => ({
    id: c.id,
    class: classLabel(c),
    courseCode: c.courses?.code || '',
    courseName: c.courses?.name || '',
  }));
}

export async function getStudentsForClass(classId: string): Promise<StudentForClass[]> {
  const caller = await requireRole(...TEACHING_STAFF);
  await assertClassAccess(caller, classId);
  const admin = await createServiceRoleClient();
  const { data: cls } = await admin.from('classes').select('program, branch, semester, section').eq('id', classId).maybeSingle();
  if (!cls) return [];
  return rosterFor(admin, cls);
}

export async function getTeacherSchedule(teacherProfileId: string) {
  const caller = await requireRole(...TEACHING_STAFF);
  const teacherId = await actingTeacherId(caller, teacherProfileId);
  if (!teacherId) return [];
  const admin = await createServiceRoleClient();

  const { data: classes } = await admin
    .from('classes')
    .select('id, program, branch, section, course_id, courses(name, code), timetables(id, day_of_week, start_time, room)')
    .eq('teacher_id', teacherId);

  const out: any[] = [];
  for (const c of (classes || []) as any[]) {
    for (const t of c.timetables || []) {
      out.push({
        id: t.id,
        day: t.day_of_week,
        period: periodFromStartTime(t.start_time),
        classId: c.id,
        className: classLabel(c),
        class: classLabel(c),
        courseId: c.courses?.code || c.course_id,
        courseName: c.courses?.name,
        courseCode: c.courses?.code,
        room: t.room || null,
        teacherId: pinToSelf(caller, teacherProfileId),
      });
    }
  }
  return out;
}

export async function getTeacherAttendanceLogs(teacherProfileId: string): Promise<AttendanceLogEntry[]> {
  const caller = await requireRole(...TEACHING_STAFF);
  const profileId = pinToSelf(caller, teacherProfileId);
  const admin = await createServiceRoleClient();
  // Aggregated in SQL: one row per (class, date, period) session.
  const { data, error } = await admin.rpc('get_teacher_attendance_sessions', { p_teacher_profile_id: profileId, p_limit: 100 });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    classId: r.class_id,
    date: r.date,
    period: r.period,
    courseName: r.course_name || '',
    courseCode: r.course_code || '',
    class: `${r.program || ''} ${r.branch || ''} ${r.section || ''}`.trim(),
    studentCount: Number(r.student_count) || 0,
  }));
}

export async function getAttendanceForSlot(classId: string, date: string, period: number): Promise<Record<string, 'Present' | 'Absent'>> {
  const caller = await requireRole(...TEACHING_STAFF);
  await assertClassAccess(caller, classId);
  const admin = await createServiceRoleClient();
  const { data } = await admin
    .from('attendance')
    .select('student_id, status')
    .eq('class_id', classId)
    .eq('date', date)
    .eq('period', period)
    .limit(1000);
  const result: Record<string, 'Present' | 'Absent'> = {};
  for (const row of (data || []) as any[]) result[row.student_id] = row.status;
  return result;
}

export async function getTeacherCoursesForMarks(teacherProfileId: string, _session: string): Promise<TeacherCourseOption[]> {
  const caller = await requireRole(...TEACHING_STAFF);
  const teacherId = await actingTeacherId(caller, teacherProfileId);
  if (!teacherId) return [];
  const admin = await createServiceRoleClient();
  const { data } = await admin.from('classes').select('courses(id, name, code)').eq('teacher_id', teacherId);
  const seen = new Map<string, TeacherCourseOption>();
  for (const c of (data || []) as any[]) {
    const course = Array.isArray(c.courses) ? c.courses[0] : c.courses;
    if (course && !seen.has(course.id)) seen.set(course.id, { id: course.id, name: course.name, code: course.code });
  }
  return Array.from(seen.values());
}

export async function getTeacherSectionsForCourse(teacherProfileId: string, courseId: string): Promise<TeacherSectionOption[]> {
  const caller = await requireRole(...TEACHING_STAFF);
  const teacherId = await actingTeacherId(caller, teacherProfileId);
  if (!teacherId) return [];
  const admin = await createServiceRoleClient();
  const { data } = await admin
    .from('classes')
    .select('id, program, branch, section')
    .eq('teacher_id', teacherId)
    .eq('course_id', courseId);
  return (data || []).map((c: any) => ({ id: c.id, name: classLabel(c) }));
}

export async function getTeacherScheduledSessions(teacherProfileId: string): Promise<TeacherScheduledSession[]> {
  const caller = await requireRole(...TEACHING_STAFF);
  const teacherId = await actingTeacherId(caller, teacherProfileId);
  if (!teacherId) return [];
  const admin = await createServiceRoleClient();

  const { data: cls } = await admin.from('classes').select('course_id').eq('teacher_id', teacherId);
  const courseIds = Array.from(new Set((cls || []).map((c: any) => c.course_id)));
  if (courseIds.length === 0) return [];

  const { data } = await admin
    .from('exams')
    .select('exam_type, exam_date')
    .in('course_id', courseIds)
    .neq('status', 'Cancelled')
    .order('exam_date');

  const sessions = new Map<string, TeacherScheduledSession>();
  for (const row of (data || []) as any[]) {
    if (!row.exam_type) continue;
    const s = sessions.get(row.exam_type);
    if (!s) sessions.set(row.exam_type, { name: row.exam_type, startDate: row.exam_date || '', endDate: row.exam_date || '' });
    else if (row.exam_date && row.exam_date > s.endDate) s.endDate = row.exam_date;
  }
  if (!sessions.has('Others')) {
    const today = new Date().toISOString();
    sessions.set('Others', { name: 'Others', startDate: today, endDate: today });
  }
  return Array.from(sessions.values());
}

export async function getStudentsByClassForTeacher(teacherProfileId: string): Promise<TeacherClassWithStudents[]> {
  const caller = await requireRole(...TEACHING_STAFF);
  const teacherId = await actingTeacherId(caller, teacherProfileId);
  if (!teacherId) return [];
  const admin = await createServiceRoleClient();
  const { data: classes } = await admin
    .from('classes')
    .select('id, program, branch, semester, section, courses(id, name, code)')
    .eq('teacher_id', teacherId);

  return Promise.all(
    ((classes || []) as any[]).map(async (c) => {
      const course = Array.isArray(c.courses) ? c.courses[0] : c.courses;
      return {
        classInfo: { id: c.id, courseCode: course?.code || '', courseName: course?.name || '', class: classLabel(c) },
        students: await rosterFor(admin, c),
      };
    }),
  );
}
