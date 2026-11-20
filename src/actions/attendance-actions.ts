'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, assertClassAccess, isUuid } from '@/lib/auth-guard';
import { chunk, fetchAllRows, resolveCourseId } from '@/lib/db';
import type { ActionResult } from '@/lib/types';

const ATTENDANCE_ADMINS = ['emp:exam_marks_management', 'emp:student_staff_management'] as const;

export interface StudentAttendanceRow {
  studentId: string;
  studentName: string;
  collegeId: string;
  totalClasses: number;
  presentClasses: number;
  absentClasses: number;
  percentage: number;
}

interface RollupNode {
  totalClasses: number;
  totalPresent: number;
  percentage: number;
}

export interface AggregatedData {
  duplicateCount: number;
  incompleteCount: number;
  totalRecords: number;
  overall: RollupNode;
  byProgram: Record<string, RollupNode & {
    program: string;
    branches: Record<string, RollupNode & {
      branch: string;
      classes: Record<string, RollupNode & {
        year: number;
        sections: Record<string, RollupNode & { section: string }>;
      }>;
    }>;
  }>;
}

export interface CsvAttendanceRow {
  StudentId?: string;
  studentId?: string;
  Date?: string;
  date?: string;
  Status?: string;
  status?: string;
  classId?: string;
  class_id?: string;
  period?: number;
  [key: string]: any;
}

export interface UploadAttendanceCsvOptions {
  classId: string;
  period?: number;
}

const pct = (present: number, total: number) => (total > 0 ? Math.round((present / total) * 100) : 0);

/** Per-student attendance for a section (optionally one course / date range), aggregated in SQL. */
export async function getStudentAttendanceRecords(
  program?: string, branch?: string, semester?: number, section?: string, courseId?: string, startDate?: string, endDate?: string,
): Promise<StudentAttendanceRow[]> {
  await requireRole('teacher', ...ATTENDANCE_ADMINS);
  if (!program || !branch || !semester) return [];
  const admin = await createServiceRoleClient();
  const resolvedCourse = courseId ? await resolveCourseId(admin, courseId) : null;

  const { data, error } = await admin.rpc('get_section_attendance_summary', {
    p_program: program,
    p_branch: branch,
    p_semester: Number(semester),
    p_section: section || null,
    p_course_id: resolvedCourse,
    p_start: startDate || null,
    p_end: endDate || null,
  });
  if (error || !data) return [];

  return (data as any[]).map((r) => {
    const total = Number(r.total_classes) || 0;
    const present = Number(r.present_classes) || 0;
    return {
      studentId: r.student_id,
      studentName: r.full_name || 'Unknown',
      collegeId: r.college_id,
      totalClasses: total,
      presentClasses: present,
      absentClasses: total - present,
      percentage: pct(present, total),
    };
  });
}

/** Institution-wide attendance rolled up Program → Branch → Year → Section (single SQL GROUP BY). */
export async function getAggregatedAttendance(): Promise<{ success: boolean; data?: AggregatedData; error?: string }> {
  try {
    await requireRole(...ATTENDANCE_ADMINS);
    const admin = await createServiceRoleClient();
    const { data, error } = await admin.rpc('get_attendance_rollup');
    if (error) return { success: false, error: error.message };

    const node = (): RollupNode => ({ totalClasses: 0, totalPresent: 0, percentage: 0 });
    const result: AggregatedData = { duplicateCount: 0, incompleteCount: 0, totalRecords: 0, overall: node(), byProgram: {} };

    const add = (n: RollupNode, total: number, present: number) => {
      n.totalClasses += total;
      n.totalPresent += present;
      n.percentage = pct(n.totalPresent, n.totalClasses);
    };

    for (const r of (data as any[]) || []) {
      const total = Number(r.total_records) || 0;
      const present = Number(r.present_records) || 0;
      const programKey = r.program || 'Unassigned';
      const branchKey = r.branch || 'Unassigned';
      const yearKey = String(r.year ?? '-');
      const sectionKey = r.section || '-';

      const prog = (result.byProgram[programKey] ??= { program: programKey, branches: {}, ...node() });
      const br = (prog.branches[branchKey] ??= { branch: branchKey, classes: {}, ...node() });
      const yr = (br.classes[yearKey] ??= { year: Number(r.year) || 0, sections: {}, ...node() });
      const sec = (yr.sections[sectionKey] ??= { section: sectionKey, ...node() });

      [result.overall, prog, br, yr, sec].forEach((n) => add(n, total, present));
      result.totalRecords += total;
    }
    return { success: true, data: result };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Bulk CSV import: resolves college IDs in batches and upserts idempotently (re-uploads never duplicate). */
export async function uploadAttendanceCsv(
  records: CsvAttendanceRow[],
  options?: UploadAttendanceCsvOptions,
): Promise<{ success: boolean; message?: string; error?: string; savedCount: number; skippedCount: number; errors: string[] }> {
  const auth = await authorize(...ATTENDANCE_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error, savedCount: 0, skippedCount: records?.length || 0, errors: [auth.error] };
  if (!Array.isArray(records) || records.length === 0) return { success: false, error: 'No rows to import.', savedCount: 0, skippedCount: 0, errors: ['No rows to import.'] };
  if (records.length > 20000) return { success: false, error: 'Upload at most 20,000 rows per file.', savedCount: 0, skippedCount: records.length, errors: ['File too large.'] };

  const admin = await createServiceRoleClient();
  const errors: string[] = [];

  const collegeIds = Array.from(new Set(records.map((r) => String(r.StudentId || r.studentId || '').trim().toUpperCase()).filter(Boolean)));
  const idMap = new Map<string, string>();
  for (const part of chunk(collegeIds, 300)) {
    const { data } = await admin.from('students').select('id, college_id').in('college_id', part);
    (data || []).forEach((s: any) => idMap.set(String(s.college_id).toUpperCase(), s.id));
  }

  const rowsByKey = new Map<string, any>();
  for (const rec of records) {
    const collegeId = String(rec.StudentId || rec.studentId || '').trim().toUpperCase();
    const date = String(rec.Date || rec.date || '').trim();
    const statusRaw = String(rec.Status || rec.status || '').trim().toLowerCase();
    const classId = String(rec.classId || rec.class_id || options?.classId || '').trim();
    const period = Number(rec.period || options?.period || 1);

    if (!collegeId || !date || !statusRaw) { errors.push('Skipped row: missing StudentId, Date or Status'); continue; }
    if (!isUuid(classId)) { errors.push(`Skipped ${collegeId}: missing/invalid classId`); continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`Skipped ${collegeId}: date must be YYYY-MM-DD`); continue; }
    if (!Number.isInteger(period) || period < 1 || period > 12) { errors.push(`Skipped ${collegeId}: invalid period`); continue; }
    const studentId = idMap.get(collegeId);
    if (!studentId) { errors.push(`Student not found: ${collegeId}`); continue; }

    const status = statusRaw === 'p' || statusRaw === 'present' ? 'Present' : 'Absent';
    // Last row wins for duplicate keys inside the same file.
    rowsByKey.set(`${classId}|${studentId}|${date}|${period}`, {
      class_id: classId, student_id: studentId, date, period, status, teacher_id: auth.caller.userId,
    });
  }

  const rows = Array.from(rowsByKey.values());
  let saved = 0;
  for (const part of chunk(rows, 1000)) {
    const { error } = await admin.from('attendance').upsert(part, { onConflict: 'class_id,student_id,date,period' });
    if (error) {
      errors.push(error.message);
      return { success: saved > 0, error: error.message, savedCount: saved, skippedCount: records.length - saved, errors };
    }
    saved += part.length;
  }

  return {
    success: true,
    message: `Saved ${saved} attendance records. Skipped: ${records.length - saved}.`,
    savedCount: saved,
    skippedCount: records.length - saved,
    errors,
  };
}

/** Raw attendance rows for CSV export (columns match the admin page's header). */
export async function getAttendanceForExport(filters?: { program?: string; branch?: string; year?: string | number; section?: string }): Promise<{ success: boolean; rows?: any[]; error?: string }> {
  try {
    await requireRole(...ATTENDANCE_ADMINS);
    const admin = await createServiceRoleClient();
    const rows = await fetchAllRows(() => {
      let q = admin
        .from('attendance')
        .select('date, period, status, students!inner(college_id), classes!inner(program, branch, year, section, courses(name))')
        .order('date', { ascending: false });
      if (filters?.program) q = q.eq('classes.program', filters.program);
      if (filters?.branch) q = q.eq('classes.branch', filters.branch);
      if (filters?.year) q = q.eq('classes.year', Number(filters.year));
      if (filters?.section) q = q.eq('classes.section', filters.section);
      return q;
    }, 100_000);

    return {
      success: true,
      rows: rows.map((r: any) => ({
        date: r.date,
        period: r.period,
        program: r.classes?.program,
        branch: r.classes?.branch,
        year: r.classes?.year,
        section: r.classes?.section,
        courseName: r.classes?.courses?.name,
        studentId: r.students?.college_id,
        status: r.status,
      })),
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export interface SaveAttendancePayload {
  classId: string;
  teacherId: string;
  date: string;
  period: number;
  courseCode: string;
  courseName: string;
  studentRecords: { studentId: string; status: 'Present' | 'Absent' }[];
}

/**
 * Saves one period's attendance. Idempotent upsert on (class, student, date, period):
 * concurrent saves or retries never duplicate rows and never lose data mid-way.
 */
export async function saveAttendance(payload: SaveAttendancePayload): Promise<ActionResult> {
  const auth = await authorize('teacher', ...ATTENDANCE_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };

  const { classId, date, period, studentRecords } = payload;
  if (!studentRecords || studentRecords.length === 0) return { success: false, error: 'No student records to save.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > new Date().toISOString().slice(0, 10)) {
    return { success: false, error: 'Attendance cannot be recorded for a future date.' };
  }
  try {
    await assertClassAccess(auth.caller, classId);
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  const admin = await createServiceRoleClient();
  const rows = studentRecords
    .filter((r) => isUuid(r.studentId))
    .map((r) => ({
      class_id: classId,
      student_id: r.studentId,
      teacher_id: auth.caller.userId,
      date,
      period,
      status: r.status === 'Present' ? 'Present' : 'Absent',
    }));

  for (const part of chunk(rows, 1000)) {
    const { error } = await admin.from('attendance').upsert(part, { onConflict: 'class_id,student_id,date,period' });
    if (error) return { success: false, error: error.message };
  }
  return { success: true, message: `Attendance saved for ${rows.length} students.` };
}
