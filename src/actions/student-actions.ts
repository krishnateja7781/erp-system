'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, requireStudentAccess, STUDENT_READERS } from '@/lib/auth-guard';
import { createStudentRecord, type StudentRecordInput } from '@/lib/accounts';
import { fetchAllRows, resolveCourseId } from '@/lib/db';
import { periodFromStartTime } from '@/lib/utils';
import { getStudentProfileDetails } from './dashboard-actions';
import type { ActionResult } from '@/lib/types';

const STUDENT_ADMINS = ['emp:student_staff_management'] as const;
const DEFAULT_SECTIONS = ['A', 'B', 'C'];

// ── Account lifecycle (admin / student-staff employees) ──────────────────────

export async function createStudentAccount(data: StudentRecordInput): Promise<ActionResult> {
  const auth = await authorize(...STUDENT_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  return createStudentRecord(data);
}

export async function updateStudent(id: string, data: any) {
  const auth = await authorize(...STUDENT_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  const admin = await createServiceRoleClient();

  const { data: student } = await admin.from('students').select('id, profile_id').eq('id', id).maybeSingle();
  if (!student) return { success: false, error: 'Student not found.' };

  const studentPatch: Record<string, unknown> = {};
  if (data.program) studentPatch.program = data.program;
  if (data.branch) studentPatch.branch = data.branch;
  if (data.section) studentPatch.section = String(data.section).toUpperCase();
  if (data.year) studentPatch.current_year = parseInt(data.year, 10);
  if (data.semester) studentPatch.current_semester = parseInt(data.semester, 10);
  // College IDs are permanent once issued (they appear on hall tickets, receipts and records).
  if (data.type) studentPatch.is_hosteler = data.type === 'Hosteler';
  if (data.status) {
    const allowed = ['Active', 'Inactive', 'Graduated', 'Pending Approval', 'Suspended', 'Dropped Out'];
    if (!allowed.includes(data.status)) return { success: false, error: 'Invalid status.' };
    studentPatch.status = data.status;
  }
  if (data.gender !== undefined) studentPatch.gender = data.gender || null;
  if (data.bloodGroup !== undefined) studentPatch.blood_group = data.bloodGroup || null;
  if (data.address !== undefined) studentPatch.address = data.address || null;
  if (data.emergencyContactName !== undefined) studentPatch.parent_name = data.emergencyContactName || null;
  if (data.emergencyContactPhone !== undefined) studentPatch.parent_phone = data.emergencyContactPhone || null;
  if (data.dob !== undefined) studentPatch.dob = data.dob || null;

  if (Object.keys(studentPatch).length > 0) {
    const { error } = await admin.from('students').update(studentPatch).eq('id', id);
    if (error) return { success: false, error: error.message };
  }

  const fullName = data.firstName ? `${data.firstName} ${data.lastName || ''}`.trim() : data.name || data.fullName;
  const profilePatch: Record<string, unknown> = {};
  if (fullName) profilePatch.full_name = fullName;
  if (data.firstName !== undefined) profilePatch.first_name = data.firstName || null;
  if (data.lastName !== undefined) profilePatch.last_name = data.lastName || null;
  if (data.phone !== undefined) profilePatch.phone = data.phone || null;
  if (data.dob !== undefined) profilePatch.dob = data.dob || null;
  if (Object.keys(profilePatch).length > 0) {
    const { error } = await admin.from('profiles').update(profilePatch).eq('id', student.profile_id);
    if (error) return { success: false, error: error.message };
  }

  return { success: true, message: 'Student updated successfully.' };
}

export async function deleteStudent(id: string) {
  const auth = await authorize(...STUDENT_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  const admin = await createServiceRoleClient();

  const { data: student } = await admin.from('students').select('profile_id').eq('id', id).maybeSingle();
  if (!student) return { success: false, error: 'Student not found.' };

  // Deleting the auth user cascades: auth.users → profiles → students → all dependent rows.
  const { error } = await admin.auth.admin.deleteUser(student.profile_id);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Student and related access revoked successfully.' };
}

/** Allocates the next college ID for a program/branch/admission year (consumes the number). */
export async function generateCollegeId(program: string, year: number, branch?: string) {
  await requireRole(...STUDENT_ADMINS);
  const admin = await createServiceRoleClient();
  const { data, error } = await admin.rpc('generate_college_id', { p_program: program, p_branch: branch || null, p_admitted_year: year });
  if (error) return { data: null, error: error.message };
  return { data: data as string, error: null };
}

// ── Directory reads (staff) ──────────────────────────────────────────────────

function mapStudentRow(s: any) {
  return {
    id: s.id,
    collegeId: s.college_id,
    name: s.profiles?.full_name || 'Unknown',
    program: s.program,
    branch: s.branch,
    year: s.current_year,
    semester: s.current_semester,
    email: s.profiles?.email,
    gender: s.gender,
    bloodGroup: s.blood_group,
    isHosteler: s.is_hosteler,
    type: s.is_hosteler ? 'Hosteler' : 'Day Scholar',
    section: s.section || null,
    status: s.status || (s.is_graduated ? 'Graduated' : 'Active'),
  };
}

export async function getStudents() {
  await requireRole(...STUDENT_READERS);
  const admin = await createServiceRoleClient();
  const rows = await fetchAllRows(() =>
    admin
      .from('students')
      .select('id, college_id, program, branch, section, current_year, current_semester, gender, blood_group, is_hosteler, is_graduated, status, profiles(full_name, email)')
      .order('college_id', { ascending: true }),
  );
  return rows.map(mapStudentRow);
}

export async function getAllStudents() {
  return getStudents();
}

export async function getStudent(id: string) {
  try {
    const { studentId } = await requireStudentAccess(id);
    const admin = await createServiceRoleClient();
    const { data, error } = await admin.from('students').select('*, profiles(*)').eq('id', studentId).single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e: any) {
    return { data: null, error: e.message };
  }
}

export async function getStudentsForSection(program: string, branch: string, section: string) {
  await requireRole(...STUDENT_READERS);
  const admin = await createServiceRoleClient();
  const rows = await fetchAllRows(() =>
    admin
      .from('students')
      .select('id, college_id, is_graduated, status, profiles(full_name)')
      .eq('program', program)
      .eq('branch', branch)
      .eq('section', section)
      .order('college_id'),
  );
  return rows.map((s: any) => ({
    id: s.id,
    collegeId: s.college_id,
    name: s.profiles?.full_name || 'Unknown',
    status: s.status || (s.is_graduated ? 'Graduated' : 'Active'),
  }));
}

export async function getStudentProfileForTeacher(studentId: string, _teacherId?: string): Promise<{ data: any; error: string | null }> {
  try {
    const { studentId: resolved } = await requireStudentAccess(studentId);
    const details = await getStudentProfileDetails(resolved);
    if (!details) return { data: null, error: 'Student not found.' };
    return { data: details, error: null };
  } catch (e: any) {
    return { data: null, error: e.message };
  }
}

// ── Student self-service ─────────────────────────────────────────────────────

export async function getMyStudentProfile() {
  const caller = await requireRole('student').catch(() => null);
  if (!caller || caller.role !== 'student') return null;

  const admin = await createServiceRoleClient();
  const { data: student } = await admin
    .from('students')
    .select('*, profiles(full_name, email, phone, profile_picture_url)')
    .eq('profile_id', caller.userId)
    .maybeSingle();
  if (!student) return null;

  const p = (student as any).profiles || {};
  return {
    studentId: student.id,
    profileId: caller.userId,
    collegeId: student.college_id,
    name: p.full_name || 'Student',
    email: p.email || '',
    phone: p.phone || '',
    avatarUrl: p.profile_picture_url || '',
    program: student.program,
    branch: student.branch,
    section: student.section,
    semester: student.current_semester,
    year: student.current_year,
    isHosteler: student.is_hosteler,
    type: student.is_hosteler ? 'Hosteler' : 'Day Scholar',
    isGraduated: student.is_graduated,
    status: student.status,
  };
}

/** Backlogs (from the backlogs table, kept in sync with marks by the database). */
export async function fetchStudentBacklogs(studentId: string) {
  const { studentId: sid } = await requireStudentAccess(studentId, ['emp:exam_marks_management']);
  const admin = await createServiceRoleClient();
  const { data } = await admin
    .from('backlogs')
    .select('semester, fail_count, status, cleared_grade, courses(code, name)')
    .eq('student_id', sid)
    .order('semester');
  return ((data || []) as any[]).map((b) => ({
    courseCode: b.courses?.code || null,
    courseName: b.courses?.name || null,
    semesterAttempted: b.semester,
    gradeAchieved: b.status === 'Cleared' ? b.cleared_grade : 'F',
    failCount: b.fail_count,
    status: b.status as 'Active' | 'Cleared',
  }));
}

export async function getStudentAttendanceDetails(studentId: string) {
  const { studentId: sid } = await requireStudentAccess(studentId);
  const admin = await createServiceRoleClient();

  const attendanceData = await fetchAllRows(() =>
    admin
      .from('attendance')
      .select('id, date, period, status, classes(semester, courses(code, name))')
      .eq('student_id', sid)
      .order('date', { ascending: false }),
  );

  const logs = attendanceData.map((a: any) => ({
    id: a.id,
    date: a.date,
    period: a.period,
    status: a.status,
    semester: a.classes?.semester,
    courseCode: a.classes?.courses?.code,
    courseName: a.classes?.courses?.name,
  }));

  const semestersMap = new Map<number, Map<string, { courseCode: string; courseName: string; attended: number; total: number }>>();
  for (const a of attendanceData as any[]) {
    const sem = a.classes?.semester || 1;
    const code = a.classes?.courses?.code || 'UNK';
    if (!semestersMap.has(sem)) semestersMap.set(sem, new Map());
    const courseMap = semestersMap.get(sem)!;
    if (!courseMap.has(code)) courseMap.set(code, { courseCode: code, courseName: a.classes?.courses?.name || 'Unknown', attended: 0, total: 0 });
    const stats = courseMap.get(code)!;
    stats.total += 1;
    if (a.status === 'Present') stats.attended += 1;
  }

  const summary = Array.from(semestersMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([semester, courses]) => ({ semester, courses: Array.from(courses.values()) }));

  return { logs, summary };
}

export interface StudentPerformanceData {
  marksData: { courseCode: string; internals: number; externals: number }[];
  attendanceData: { month: string; percentage: number }[];
}

export async function getStudentPerformanceData(studentId: string): Promise<StudentPerformanceData> {
  const { studentId: sid } = await requireStudentAccess(studentId);
  const admin = await createServiceRoleClient();

  const [{ data: marks }, { data: monthly }] = await Promise.all([
    admin.from('marks').select('ia1, ia2, other, see, classes(courses(code))').eq('student_id', sid).limit(20),
    admin.rpc('get_student_monthly_attendance', { p_student_id: sid }),
  ]);

  // Scaled to the same /60 internal and /40 external split the grade uses.
  const marksData = (marks || []).map((m: any) => ({
    courseCode: m.classes?.courses?.code || 'UNK',
    internals: Math.round((Number(m.ia1 ?? 0) / 2 + Number(m.ia2 ?? 0) / 2 + Number(m.other ?? 0)) * 10) / 10,
    externals: Math.round(Number(m.see ?? 0) * 0.4 * 10) / 10,
  }));

  const attendanceData = ((monthly as any[]) || []).map((r) => ({ month: r.month_label, percentage: Number(r.percentage) }));
  return { marksData, attendanceData: attendanceData.length > 0 ? attendanceData : [{ month: 'Current', percentage: 0 }] };
}

export async function getStudentSchedule(studentId: string): Promise<any[]> {
  const { studentId: sid } = await requireStudentAccess(studentId);
  const admin = await createServiceRoleClient();
  const { data: student } = await admin
    .from('students')
    .select('program, branch, section, current_semester')
    .eq('id', sid)
    .maybeSingle();
  if (!student) return [];

  const { data: classList } = await admin
    .from('classes')
    .select('id, courses(name, code), teachers(profiles(full_name)), timetables(id, day_of_week, start_time, room)')
    .eq('program', student.program)
    .eq('branch', student.branch)
    .eq('semester', student.current_semester)
    .eq('section', student.section || 'A');

  const out: any[] = [];
  for (const cls of (classList || []) as any[]) {
    for (const entry of cls.timetables || []) {
      out.push({
        id: entry.id,
        period: periodFromStartTime(entry.start_time),
        courseCode: cls.courses?.code,
        courseName: cls.courses?.name,
        className: `${student.program} ${student.branch} ${student.section || 'A'}`,
        day: entry.day_of_week,
        room: entry.room || null,
        teacherName: cls.teachers?.profiles?.full_name || 'Unassigned',
      });
    }
  }
  return out;
}

// ── Section helpers ──────────────────────────────────────────────────────────

export async function getAvailableSections(program: string, year: string | number, courseId: string): Promise<string[]> {
  await requireRole();
  const admin = await createServiceRoleClient();
  let query = admin.from('classes').select('section').eq('academic_year', String(year));
  if (program) query = query.eq('program', program);
  if (courseId) {
    const resolved = await resolveCourseId(admin, courseId);
    if (resolved) query = query.eq('course_id', resolved);
  }
  const { data } = await query.limit(1000);
  const sections = Array.from(new Set((data || []).map((d: any) => d.section).filter(Boolean))).sort();
  return sections.length > 0 ? (sections as string[]) : DEFAULT_SECTIONS;
}

export async function getSectionsForBranch(program: string, branch: string): Promise<string[]> {
  await requireRole();
  const admin = await createServiceRoleClient();
  const [{ data: cls }, { data: stu }] = await Promise.all([
    admin.from('classes').select('section').eq('program', program).eq('branch', branch).limit(1000),
    admin.rpc('get_distinct_sections', { p_program: program, p_branch: branch }),
  ]);
  const set = new Set<string>();
  (cls || []).forEach((d: any) => d.section && set.add(d.section));
  ((stu as any[]) || []).forEach((d: any) => d.section && set.add(d.section));
  const sections = Array.from(set).sort();
  return sections.length > 0 ? sections : DEFAULT_SECTIONS;
}
