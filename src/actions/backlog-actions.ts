'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, requireStudentAccess, isUuid } from '@/lib/auth-guard';
import { fetchAllRows } from '@/lib/db';
import type { ActionResult } from '@/lib/types';

/** Backlogs are managed by the exam & marks department and super admins; students read their own. */
const BACKLOG_STAFF = ['emp:exam_marks_management'] as const;

export interface BacklogAttempt {
  id: string;
  attemptNo: string | null;
  examLabel: string;
  attemptDate: string;
  see: number;
  total: number;
  grade: string;
  passed: boolean;
}

export interface BacklogSubject {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  semester: number;
  studyYear: number;
  /** Backlog count for this subject: original failure + failed re-exams. */
  failCount: number;
  status: 'Active' | 'Cleared';
  firstFailedAt: string;
  clearedAt: string | null;
  clearedGrade: string | null;
  internals: { ia1: number | null; ia2: number | null; other: number | null };
  attempts: BacklogAttempt[];
}

export interface StaffBacklogRow extends BacklogSubject {
  studentId: string;
  collegeId: string;
  studentName: string;
  program: string | null;
  branch: string | null;
  section: string | null;
  currentSemester: number;
}

export interface BacklogSummary {
  activeBacklogs: number;
  studentsWithBacklogs: number;
  clearedBacklogs: number;
  totalFailedAttempts: number;
  topSubjects: { code: string; name: string; active: number }[];
}

const SELECT = `id, course_id, class_id, semester, study_year, fail_count, status, first_failed_at, cleared_at, cleared_grade,
  courses(code, name, credits),
  backlog_attempts(id, attempt_no, exam_label, attempt_date, see, total, grade, passed)`;

function mapSubject(b: any, marks?: any): BacklogSubject {
  return {
    id: b.id,
    courseId: b.course_id,
    courseCode: b.courses?.code || '',
    courseName: b.courses?.name || 'Unknown course',
    credits: Number(b.courses?.credits) || 0,
    semester: b.semester,
    studyYear: b.study_year,
    failCount: b.fail_count,
    status: b.status,
    firstFailedAt: b.first_failed_at,
    clearedAt: b.cleared_at,
    clearedGrade: b.cleared_grade,
    internals: { ia1: marks?.ia1 ?? null, ia2: marks?.ia2 ?? null, other: marks?.other ?? null },
    attempts: ((b.backlog_attempts || []) as any[])
      .map((a) => ({
        id: a.id,
        attemptNo: a.attempt_no,
        examLabel: a.exam_label,
        attemptDate: a.attempt_date,
        see: Number(a.see),
        total: Number(a.total),
        grade: a.grade,
        passed: !!a.passed,
      }))
      .sort((x, y) => x.attemptDate.localeCompare(y.attemptDate)),
  };
}

// ── Student ────────────────────────────────────────────────────────────────────

/** Number of ACTIVE backlogs for the signed-in student (drives the sidebar entry). */
export async function getMyBacklogCount(): Promise<number> {
  try {
    const { studentId } = await requireStudentAccess(null);
    const admin = await createServiceRoleClient();
    const { count } = await admin.from('backlogs').select('id', { count: 'exact', head: true }).eq('student_id', studentId).eq('status', 'Active');
    return count || 0;
  } catch {
    return 0;
  }
}

/** All backlog subjects (active and cleared) for a student; students may only read their own. */
export async function getStudentBacklogs(studentId?: string | null): Promise<BacklogSubject[]> {
  const { studentId: sid } = await requireStudentAccess(studentId ?? null, [...BACKLOG_STAFF]);
  const admin = await createServiceRoleClient();
  const { data } = await admin.from('backlogs').select(SELECT).eq('student_id', sid).order('semester').limit(500);
  const rows = (data || []) as any[];
  const { data: marks } = await admin.from('marks').select('class_id, ia1, ia2, other').eq('student_id', sid);
  const byClass = new Map(((marks || []) as any[]).map((m) => [m.class_id, m]));
  return rows
    .map((b) => mapSubject(b, byClass.get(b.class_id)))
    .sort((a, b) => (a.status === b.status ? a.semester - b.semester : a.status === 'Active' ? -1 : 1));
}

// ── Exam department / admin ───────────────────────────────────────────────────

export async function getBacklogSummary(): Promise<BacklogSummary> {
  await requireRole(...BACKLOG_STAFF);
  const admin = await createServiceRoleClient();
  const { data, error } = await admin.rpc('get_backlog_summary');
  if (error) throw new Error(error.message);
  const d: any = data || {};
  return {
    activeBacklogs: Number(d.active_backlogs) || 0,
    studentsWithBacklogs: Number(d.students_with_backlogs) || 0,
    clearedBacklogs: Number(d.cleared_backlogs) || 0,
    totalFailedAttempts: Number(d.total_failed_attempts) || 0,
    topSubjects: (d.top_subjects || []).map((t: any) => ({ code: t.code, name: t.name, active: Number(t.active) || 0 })),
  };
}

export async function getBacklogs(filters: { status?: 'Active' | 'Cleared' | 'all'; program?: string; branch?: string; semester?: number } = {}): Promise<StaffBacklogRow[]> {
  await requireRole(...BACKLOG_STAFF);
  const admin = await createServiceRoleClient();
  const rows = await fetchAllRows(() => {
    let q = admin
      .from('backlogs')
      .select(`${SELECT}, student_id, students!inner(college_id, program, branch, section, current_semester, profiles(full_name))`)
      .order('semester')
      .order('first_failed_at');
    const status = filters.status ?? 'Active';
    if (status !== 'all') q = q.eq('status', status);
    if (filters.program) q = q.eq('students.program', filters.program);
    if (filters.branch) q = q.eq('students.branch', filters.branch);
    if (filters.semester) q = q.eq('semester', filters.semester);
    return q;
  }, 20_000);

  // Original internals, fetched in bounded batches by class.
  const internals = new Map<string, any>();
  const classIds = Array.from(new Set((rows as any[]).map((r) => r.class_id)));
  for (let i = 0; i < classIds.length; i += 200) {
    const part = classIds.slice(i, i + 200);
    const marks = await fetchAllRows(() => admin.from('marks').select('student_id, class_id, ia1, ia2, other').in('class_id', part));
    (marks as any[]).forEach((m) => internals.set(`${m.student_id}|${m.class_id}`, m));
  }

  return (rows as any[]).map((r) => ({
    ...mapSubject(r, internals.get(`${r.student_id}|${r.class_id}`)),
    studentId: r.student_id,
    collegeId: r.students?.college_id || '',
    studentName: r.students?.profiles?.full_name || 'Unknown',
    program: r.students?.program ?? null,
    branch: r.students?.branch ?? null,
    section: r.students?.section ?? null,
    currentSemester: r.students?.current_semester ?? 0,
  }));
}

/**
 * Record a re-examination (supplementary) result. Internals are kept, the new SEE
 * replaces the old one; a pass clears the backlog and updates the marksheet,
 * a fail raises the subject's backlog count. Atomic in SQL (record_backlog_attempt).
 */
export async function recordBacklogAttempt(payload: { backlogId: string; see: number; examLabel?: string; attemptDate?: string }): Promise<ActionResult> {
  const auth = await authorize(...BACKLOG_STAFF);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(payload?.backlogId)) return { success: false, error: 'Invalid backlog.' };
  const see = Number(payload.see);
  if (!Number.isFinite(see) || see < 0 || see > 100) return { success: false, error: 'SEE marks must be between 0 and 100.' };
  if (payload.attemptDate && !/^\d{4}-\d{2}-\d{2}$/.test(payload.attemptDate)) return { success: false, error: 'Invalid date.' };

  const admin = await createServiceRoleClient();
  const { data, error } = await admin.rpc('record_backlog_attempt', {
    p_backlog_id: payload.backlogId,
    p_see: see,
    p_exam_label: (payload.examLabel || 'Supplementary').slice(0, 80),
    p_attempt_date: payload.attemptDate || null,
    p_recorded_by: auth.caller.userId,
  });
  if (error) return { success: false, error: error.message };
  if (data && data.success === false) return { success: false, error: data.error };
  return {
    success: true,
    message: data.passed
      ? `Passed with ${data.total} (${data.grade}). Backlog cleared (ref ${data.attempt_no}).`
      : `Failed with ${data.total}. Backlog count is now ${data.fail_count} (ref ${data.attempt_no}).`,
    data,
  };
}
