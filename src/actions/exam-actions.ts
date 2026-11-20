'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, requireStudentAccess, pinToSelf, isUuid } from '@/lib/auth-guard';
import { fetchAllRows } from '@/lib/db';
import type { ActionResult } from '@/lib/types';

const EXAM_ADMINS = ['emp:exam_marks_management'] as const;

function mapExam(e: any) {
  return {
    id: e.id,
    courseId: e.courses?.code || e.course_id,
    courseName: e.courses?.name,
    program: e.program || e.courses?.program,
    branch: e.branch || e.courses?.branch,
    semester: e.semester,
    year: e.year,
    examType: e.exam_type,
    examSessionName: e.exam_type || 'Exam',
    courseCode: e.courses?.code,
    date: e.exam_date,
    startTime: e.start_time,
    endTime: e.end_time,
    room: e.room || null,
    status: e.status || 'Scheduled',
    maxInternalMarks: e.max_internal_marks ?? null,
    maxExternalMarks: e.max_external_marks ?? null,
    credits: e.courses?.credits ?? null,
  };
}

export async function getExamSchedules(): Promise<any[]> {
  await requireRole(...EXAM_ADMINS, 'emp:student_staff_management');
  const admin = await createServiceRoleClient();
  const data = await fetchAllRows(() =>
    admin.from('exams').select('*, courses(code, name, program, branch, credits)').order('exam_date', { ascending: false }),
  );
  return data.map(mapExam);
}

export async function deleteExamSchedule(examId: string): Promise<ActionResult> {
  const auth = await authorize(...EXAM_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(examId)) return { success: false, error: 'Invalid exam.' };
  const admin = await createServiceRoleClient();
  const { error } = await admin.from('exams').delete().eq('id', examId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Exam schedule deleted successfully.' };
}

// ── Student-facing ─────────────────────────────────────────────────────────────

export type ExamStatus = 'Upcoming' | 'Ongoing' | 'Completed';

export interface StudentExamScheduleEntry {
  id: string;
  examSessionName: string;
  courseName: string;
  courseCode: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  status: ExamStatus;
}

export interface HallTicketData {
  studentId: string;
  studentName: string;
  collegeId: string;
  studentCollegeId: string;
  program: string;
  branch: string;
  semester: number;
  year: number;
  examSessionName: string;
  hallTicketNumber?: string;
  exams: StudentExamScheduleEntry[];
  photoUrl?: string;
  studentPhotoUrl?: string;
  instructions?: string;
  controllerSignaturePlaceholder?: string;
  generatedDate: string;
}

function examStatus(date: string | null, start: string | null, end: string | null): ExamStatus {
  if (!date) return 'Upcoming';
  const today = new Date().toISOString().slice(0, 10);
  if (date > today) return 'Upcoming';
  if (date < today) return 'Completed';
  const nowTime = new Date().toTimeString().slice(0, 8);
  if (start && nowTime < start) return 'Upcoming';
  if (end && nowTime > end) return 'Completed';
  return 'Ongoing';
}

/** Exam timetable for a program/branch — scoped to the student's current semester when a student calls it. */
export async function getStudentExamSchedules(program: string, branch: string, semester?: number): Promise<StudentExamScheduleEntry[]> {
  const caller = await requireRole();
  const admin = await createServiceRoleClient();

  let sem = semester;
  if (caller.role === 'student') {
    const { data: me } = await admin.from('students').select('program, branch, current_semester').eq('profile_id', caller.userId).maybeSingle();
    if (!me) return [];
    program = me.program;
    branch = me.branch;
    sem = me.current_semester;
  }

  let q = admin
    .from('exams')
    .select('id, exam_type, exam_date, start_time, end_time, room, status, courses(name, code)')
    .eq('program', program)
    .eq('branch', branch)
    .neq('status', 'Cancelled')
    .order('exam_date', { ascending: true })
    .limit(500);
  if (sem) q = q.eq('semester', sem);
  const { data } = await q;

  return ((data || []) as any[]).map((e) => ({
    id: e.id,
    examSessionName: e.exam_type || 'Exam',
    courseName: e.courses?.name || 'Unknown Course',
    courseCode: e.courses?.code || '',
    date: e.exam_date || '',
    startTime: e.start_time || '',
    endTime: e.end_time || '',
    room: e.room || 'TBA',
    status: examStatus(e.exam_date, e.start_time, e.end_time),
  }));
}

/**
 * Hall ticket for the student's nearest upcoming exam session (IA-1 / IA-2 / SEE …),
 * issued only when the session's configured attendance and fee rules are met.
 */
export async function getHallTicket(
  studentId: string, program: string, branch: string, semester: number, studentName: string, collegeId: string, photoUrl?: string,
): Promise<{ success: boolean; data?: HallTicketData; error?: string }> {
  try {
    const { studentId: sid } = await requireStudentAccess(studentId);
    const admin = await createServiceRoleClient();
    const { data: s } = await admin
      .from('students')
      .select('college_id, program, branch, current_semester, current_year, profiles(full_name, profile_picture_url)')
      .eq('id', sid)
      .single();
    if (!s) return { success: false, error: 'Student not found.' };

    const upcoming = (await getStudentExamSchedules(s.program, s.branch, s.current_semester)).filter((e) => e.status !== 'Completed');
    if (!upcoming.length) return { success: false, error: `No upcoming exams found for semester ${s.current_semester}.` };

    const session = upcoming[0].examSessionName;
    const { data: elig } = await admin.rpc('get_student_exam_eligibility', { p_student_id: sid, p_exam_type: session });
    const rule = Array.isArray(elig) ? elig[0] : elig;
    if (rule && rule.is_eligible === false) {
      return { success: false, error: `Hall ticket withheld for ${session}: ${(rule.reasons || []).join('; ')}` };
    }

    const photo = (s as any).profiles?.profile_picture_url || photoUrl;
    return {
      success: true,
      data: {
        studentId: sid,
        studentName: (s as any).profiles?.full_name || studentName,
        collegeId: s.college_id || collegeId,
        studentCollegeId: s.college_id || collegeId,
        program: s.program || program,
        branch: s.branch || branch,
        semester: s.current_semester || semester,
        year: s.current_year,
        examSessionName: session,
        hallTicketNumber: rule?.hall_ticket_no || undefined,
        exams: upcoming.filter((e) => e.examSessionName === session),
        photoUrl: photo,
        studentPhotoUrl: photo,
        instructions: rule?.instructions || undefined,
        controllerSignaturePlaceholder: rule?.controller_signature || undefined,
        generatedDate: new Date().toISOString(),
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to generate hall ticket.' };
  }
}

export async function getExamById(examId: string): Promise<any> {
  await requireRole('teacher', ...EXAM_ADMINS);
  if (!isUuid(examId)) return null;
  const admin = await createServiceRoleClient();
  const { data } = await admin
    .from('exams')
    .select('*, courses(name, code, program, branch, semester, credits)')
    .eq('id', examId)
    .maybeSingle();
  return data ? mapExam(data) : null;
}

export interface StudentEligibility {
  id: string;
  studentId: string;
  name: string;
  collegeId: string;
  section: string;
  attendancePercentage: number;
  feeBalance: number;
  feePaidPercent?: number;
  isEligible: boolean;
  reasons: string[];
}

/** Eligibility for every student sitting an exam — computed in one set-based SQL call. */
export async function getTeacherExamStudents(examId: string, _teacherId?: string): Promise<StudentEligibility[]> {
  await requireRole('teacher', ...EXAM_ADMINS);
  if (!isUuid(examId)) return [];
  const admin = await createServiceRoleClient();
  // Uses the session's configured hall-ticket rules (exam_sessions).
  const { data, error } = await admin.rpc('get_exam_eligibility', { p_exam_id: examId, p_min_attendance: null });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.student_id,
    studentId: r.student_id,
    name: r.full_name || 'Unknown',
    collegeId: r.college_id,
    section: r.section || 'A',
    attendancePercentage: Number(r.attendance_pct) || 0,
    feeBalance: Number(r.fee_balance) || 0,
    feePaidPercent: Number(r.fee_paid_pct) || 0,
    isEligible: !!r.is_eligible,
    reasons: r.reasons || [],
  }));
}

export async function getTeacherExams(teacherId: string): Promise<any[]> {
  const caller = await requireRole('teacher', ...EXAM_ADMINS);
  const admin = await createServiceRoleClient();
  const { data: teacher } = await admin.from('teachers').select('id').eq('profile_id', pinToSelf(caller, teacherId)).maybeSingle();
  if (!teacher) return [];

  const { data: cls } = await admin.from('classes').select('course_id').eq('teacher_id', teacher.id);
  const courseIds = Array.from(new Set((cls || []).map((c: any) => c.course_id)));
  if (courseIds.length === 0) return [];

  const { data } = await admin
    .from('exams')
    .select('*, courses(name, code)')
    .in('course_id', courseIds)
    .order('exam_date', { ascending: false })
    .limit(500);
  return ((data || []) as any[]).map((e) => ({ ...mapExam(e), courseName: e.courses?.name || 'Subject' }));
}

/** Creates one exam row per course in a single insert; the DB notifies affected students once per session. */
export async function scheduleExamsAndSetupHallTickets(config: { filters: any; exams: any[]; hallTicketData: any }): Promise<ActionResult> {
  const auth = await authorize(...EXAM_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  const { filters, exams, hallTicketData } = config || ({} as any);
  if (!filters?.program || !filters?.branch || !filters?.semester || !Array.isArray(exams) || exams.length === 0) {
    return { success: false, error: 'Program, branch, semester and at least one exam are required.' };
  }

  const admin = await createServiceRoleClient();
  const codes = Array.from(new Set(exams.map((e) => e.courseCode).filter(Boolean)));
  const { data: courses } = await admin.from('courses').select('id, code').in('code', codes);
  const courseByCode = new Map((courses || []).map((c: any) => [c.code, c.id]));

  const missing = codes.filter((c) => !courseByCode.has(c));
  if (missing.length) return { success: false, error: `Unknown course code(s): ${missing.join(', ')}` };

  const badTime = exams.find((e) => e.startTime && e.endTime && e.startTime >= e.endTime);
  if (badTime) return { success: false, error: `End time must be after start time for ${badTime.courseCode}.` };
  const rows = exams.map((e) => {
    return {
      course_id: courseByCode.get(e.courseCode),
      program: filters.program,
      branch: filters.branch,
      year: Number(filters.year) || null,
      academic_year: String(new Date().getFullYear()),
      semester: Number(filters.semester),
      exam_type: hallTicketData?.examSessionName || 'Exam',
      exam_date: e.date,
      start_time: e.startTime || null,
      end_time: e.endTime || null,
      room: e.room || null,
      status: 'Scheduled',
      created_by: auth.caller.userId,
    };
  });

  // Persist the hall-ticket rules for this session (one row per program/branch/semester/session/year).
  const pct = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
  };
  const { error: sessErr } = await admin.from('exam_sessions').upsert(
    {
      program: filters.program,
      branch: filters.branch,
      semester: Number(filters.semester),
      exam_type: hallTicketData?.examSessionName || 'Exam',
      academic_year: String(new Date().getFullYear()),
      min_attendance: pct(hallTicketData?.minAttendance, 75),
      min_fee_paid_percent: pct(hallTicketData?.minFeePaidPercent, 0),
      instructions: hallTicketData?.instructions || null,
      controller_signature: hallTicketData?.controllerSignaturePlaceholder || null,
      created_by: auth.caller.userId,
    },
    { onConflict: 'program,branch,semester,exam_type,academic_year' },
  );
  if (sessErr) return { success: false, error: sessErr.message };

  const { error } = await admin.from('exams').insert(rows);
  if (error) {
    if (error.code === '23505') return { success: false, error: 'One of these courses already has an exam of this type scheduled.' };
    return { success: false, error: error.message };
  }
  return { success: true, message: `${rows.length} exam(s) scheduled successfully.` };
}

export async function saveExamSchedule(examId: string, schedule: any[]): Promise<ActionResult> {
  const auth = await authorize(...EXAM_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(examId) || !schedule?.[0]) return { success: false, error: 'Invalid exam.' };
  const u = schedule[0];
  const payload: Record<string, unknown> = { exam_date: u.date, start_time: u.startTime || null, end_time: u.endTime || null };
  if (u.examSessionName) payload.exam_type = u.examSessionName;
  if (u.room !== undefined) payload.room = u.room || null;
  if (u.status) payload.status = u.status;

  const admin = await createServiceRoleClient();
  const { error } = await admin.from('exams').update(payload).eq('id', examId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Schedule updated' };
}
