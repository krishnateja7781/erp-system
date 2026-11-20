'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, requireStudentAccess, assertClassAccess, isUuid } from '@/lib/auth-guard';
import { chunk, fetchAllRows, resolveCourseId } from '@/lib/db';
import { MARK_LIMITS, computeTotal, gradeForTotal, calculateCGPA } from '@/lib/grading';
import type { ActionResult } from '@/lib/types';

const MARKS_STAFF = ['teacher', 'emp:exam_marks_management'] as const;

// ── Exam-level marks (exam_marks table) ───────────────────────────────────────

export interface AdminMarksRecord {
  id: string;
  studentId: string;
  studentName: string;
  collegeId?: string;
  marks?: string | number;
  status?: string;
  program?: string;
  branch?: string;
  year?: number | string;
  semester?: number;
  courseCode?: string;
  courseName?: string;
  internals?: number | null;
  externals?: number | null;
  total?: number | null;
  grade?: string | null;
}

export async function getMarksRecords(
  program?: string, branch?: string, semester?: number, section?: string, courseId?: string, examType?: string,
): Promise<{ success: boolean; data?: AdminMarksRecord[]; error?: string }> {
  try {
    await requireRole(...MARKS_STAFF);
    if (!program || !branch || !semester || !section || !courseId || !examType) return { success: true, data: [] };
    const admin = await createServiceRoleClient();
    const dbCourseId = await resolveCourseId(admin, courseId);
    if (!dbCourseId) return { success: false, error: 'Course not found.' };

    const [students, { data: exam }, { data: course }] = await Promise.all([
      fetchAllRows(() =>
        admin
          .from('students')
          .select('id, college_id, program, branch, current_year, current_semester, profiles(full_name)')
          .eq('program', program)
          .eq('branch', branch)
          .eq('current_semester', semester)
          .eq('section', section)
          .order('college_id'),
      ),
      admin.from('exams').select('id').eq('course_id', dbCourseId).eq('exam_type', examType).limit(1).maybeSingle(),
      admin.from('courses').select('code, name').eq('id', dbCourseId).maybeSingle(),
    ]);

    const existing = new Map<string, any>();
    if (exam) {
      const marks = await fetchAllRows(() => admin.from('exam_marks').select('id, student_id, marks_obtained, status').eq('exam_id', exam.id));
      marks.forEach((m: any) => existing.set(m.student_id, m));
    }

    return {
      success: true,
      data: students.map((s: any) => {
        const m = existing.get(s.id);
        return {
          id: m ? m.id : `temp-${s.id}`,
          studentId: s.id,
          studentName: s.profiles?.full_name || 'Unknown',
          collegeId: s.college_id,
          marks: m?.marks_obtained ?? '',
          status: m?.status || 'Present',
          program: s.program,
          branch: s.branch,
          year: s.current_year,
          semester: s.current_semester,
          courseCode: course?.code || courseId,
          courseName: course?.name || '',
          internals: null,
          externals: m?.marks_obtained ?? null,
          total: m?.marks_obtained ?? null,
          grade: null,
        };
      }),
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Class marks (IA-1 / IA-2 / Others / SEE) ─────────────────────────────────

export interface MarksRecord {
  recordId: string;
  studentId: string;
  studentName: string;
  classId: string;
  ia1: number | null;
  ia2: number | null;
  other: number | null;
  see: number | null;
  total: number | null;
  grade: string | null;
}

export async function getClassIdForSection(program: string, branch: string, semester: number, section: string, courseId: string): Promise<string | null> {
  await requireRole(...MARKS_STAFF);
  const admin = await createServiceRoleClient();
  const queryCourseId = await resolveCourseId(admin, courseId);
  if (!queryCourseId) return null;
  const { data } = await admin
    .from('classes')
    .select('id')
    .eq('program', program)
    .eq('branch', branch)
    .eq('semester', semester)
    .eq('section', section)
    .eq('course_id', queryCourseId)
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

export async function getMarksForSection(program: string, branch: string, semester: number, section: string, courseId: string) {
  const classId = await getClassIdForSection(program, branch, semester, section, courseId);
  return classId ? getMarksForClass(classId) : [];
}

export async function getMarksForClass(classId: string): Promise<MarksRecord[]> {
  const caller = await requireRole(...MARKS_STAFF);
  await assertClassAccess(caller, classId);
  const admin = await createServiceRoleClient();
  const data = await fetchAllRows(() =>
    admin
      .from('marks')
      .select('id, student_id, class_id, ia1, ia2, other, see, total, grade, students(college_id, profiles(full_name))')
      .eq('class_id', classId),
  );
  return data.map((m: any) => ({
    recordId: m.id,
    studentId: m.student_id,
    studentName: m.students?.profiles?.full_name || 'Unknown',
    classId: m.class_id,
    ia1: m.ia1 ?? null,
    ia2: m.ia2 ?? null,
    other: m.other ?? null,
    see: m.see ?? null,
    total: m.total ?? null,
    grade: m.grade ?? null,
  }));
}

function validMark(v: unknown, max: number): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`Mark ${v} is outside 0–${max}.`);
  return n;
}

/**
 * Idempotent bulk upsert keyed on (student_id, class_id). Total and grade are
 * recomputed by a database trigger, so a tampered client cannot forge them.
 */
export async function saveMarksBatch(records: MarksRecord[]): Promise<ActionResult> {
  const auth = await authorize(...MARKS_STAFF);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!Array.isArray(records) || records.length === 0) return { success: false, error: 'Nothing to save.' };

  try {
    const classIds = Array.from(new Set(records.map((r) => r.classId)));
    for (const cid of classIds) {
      if (!isUuid(cid)) return { success: false, error: 'Invalid class.' };
      await assertClassAccess(auth.caller, cid);
    }

    const rows = records.map((r) => {
      if (!isUuid(r.studentId)) throw new Error('Invalid student.');
      const ia1 = validMark(r.ia1, MARK_LIMITS.ia1);
      const ia2 = validMark(r.ia2, MARK_LIMITS.ia2);
      const other = validMark(r.other, MARK_LIMITS.other);
      const see = validMark(r.see, MARK_LIMITS.see);
      // Enforce sequential entry server-side, matching the UI lock.
      if (ia2 !== null && ia1 === null) throw new Error('IA-2 requires IA-1 first.');
      if (other !== null && (ia1 === null || ia2 === null)) throw new Error('Others requires IA-1 and IA-2 first.');
      if (see !== null && (ia1 === null || ia2 === null || other === null)) throw new Error('SEE requires all internal marks first.');
      return { student_id: r.studentId, class_id: r.classId, ia1, ia2, other, see, updated_by: auth.caller.userId };
    });

    const admin = await createServiceRoleClient();
    for (const part of chunk(rows, 1000)) {
      const { error } = await admin.from('marks').upsert(part, { onConflict: 'student_id,class_id' });
      if (error) return { success: false, error: error.message };
    }
    return { success: true, message: `Saved marks for ${records.length} students.` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Preview totals/grades from the saved marks (same formula the DB trigger applies). */
export async function calculateFinalMarks(classId: string, studentIds: string[]): Promise<{ success: boolean; data?: { studentId: string; total: number; grade: string }[]; error?: string }> {
  try {
    const caller = await requireRole(...MARKS_STAFF);
    await assertClassAccess(caller, classId);
    const admin = await createServiceRoleClient();
    const rows: any[] = [];
    for (const part of chunk(studentIds.filter(isUuid), 300)) {
      const { data, error } = await admin.from('marks').select('student_id, ia1, ia2, other, see').eq('class_id', classId).in('student_id', part);
      if (error) return { success: false, error: error.message };
      rows.push(...(data || []));
    }
    return {
      success: true,
      data: rows.map((m) => {
        const total = computeTotal(m);
        return { studentId: m.student_id, total, grade: gradeForTotal(total) };
      }),
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Student marks display ─────────────────────────────────────────────────────

export interface CourseMark {
  code: string;
  name: string;
  credits: number;
  ia1: number | null;
  ia2: number | null;
  other: number | null;
  externals: number | null;
  total: number | null;
  grade: string | null;
}

export interface SemesterMarksData {
  semester: number;
  academicYear?: string;
  courses: CourseMark[];
  gpa?: number | null;
}

export async function getStudentMarksForDisplay(studentId: string): Promise<SemesterMarksData[]> {
  const { studentId: sid } = await requireStudentAccess(studentId);
  const admin = await createServiceRoleClient();
  const { data: marksData, error } = await admin
    .from('marks')
    .select('ia1, ia2, other, see, total, grade, classes(semester, courses(code, name, credits))')
    .eq('student_id', sid);
  if (error || !marksData) return [];

  const semesterMap: Record<number, SemesterMarksData> = {};
  for (const m of marksData as any[]) {
    const semester = m.classes?.semester || 1;
    (semesterMap[semester] ??= { semester, courses: [] }).courses.push({
      code: m.classes?.courses?.code || '',
      name: m.classes?.courses?.name || 'Unknown Course',
      credits: m.classes?.courses?.credits || 0,
      ia1: m.ia1 ?? null,
      ia2: m.ia2 ?? null,
      other: m.other ?? null,
      externals: m.see ?? null,
      total: m.total ?? null,
      grade: m.grade ?? null,
    });
  }
  return Object.values(semesterMap)
    .map((s) => ({ ...s, gpa: calculateCGPA(s.courses.map((c) => ({ grade: c.grade, credits: c.credits }))) }))
    .sort((a, b) => a.semester - b.semester);
}

// ── Exam department overview ──────────────────────────────────────────────────

export interface MarksOverview {
  marksEntered: number;
  graded: number;
  failed: number;
  gradeDistribution: { grade: string; count: number }[];
}

/** Institution-wide marks summary computed in SQL (`get_marks_overview`). */
export async function getMarksOverview(): Promise<MarksOverview> {
  await requireRole('emp:exam_marks_management');
  const admin = await createServiceRoleClient();
  const { data, error } = await admin.rpc('get_marks_overview');
  if (error) throw new Error(error.message);
  const d: any = data || {};
  return {
    marksEntered: Number(d.marks_entered) || 0,
    graded: Number(d.graded) || 0,
    failed: Number(d.failed) || 0,
    gradeDistribution: (d.grade_distribution || []).map((g: any) => ({ grade: g.grade, count: Number(g.count) || 0 })),
  };
}
