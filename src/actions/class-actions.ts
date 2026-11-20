'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, isUuid } from '@/lib/auth-guard';
import { fetchAllRows, resolveCourseId } from '@/lib/db';
import type { ActionResult } from '@/lib/types';

const CLASS_ADMINS = ['emp:exam_marks_management'] as const;

interface ClassPayload {
  program: string;
  branch: string;
  /** Year of study (1..5) */
  year: string | number;
  semester: number;
  courseId: string;
  section: string;
  /** Teacher profile id or teachers.id */
  teacherId: string;
}

async function resolveTeacherPk(admin: any, teacherId: string): Promise<string | null> {
  if (!isUuid(teacherId)) return null;
  const { data } = await admin
    .from('teachers')
    .select('id')
    .or(`profile_id.eq.${teacherId},id.eq.${teacherId}`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function createClass(payload: ClassPayload): Promise<ActionResult> {
  const auth = await authorize(...CLASS_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };

  const { program, branch, year, semester, courseId, section, teacherId } = payload;
  if (!program || !branch || !semester || !courseId || !section) return { success: false, error: 'Program, branch, semester, section and course are required.' };

  try {
    const admin = await createServiceRoleClient();
    const targetCourseId = await resolveCourseId(admin, courseId);
    if (!targetCourseId) return { success: false, error: `Course ${courseId} not found.` };
    const targetTeacherId = teacherId ? await resolveTeacherPk(admin, teacherId) : null;

    // The current academic term (created by the schema seed; `ensure_current_term` creates one if missing).
    const { data: termId, error: termErr } = await admin.rpc('ensure_current_term');
    if (termErr) return { success: false, error: `Academic term unavailable: ${termErr.message}` };

    const { error } = await admin.from('classes').insert({
      course_id: targetCourseId,
      academic_term_id: termId,
      teacher_id: targetTeacherId,
      section: section.toUpperCase(),
      program,
      branch,
      year: parseInt(String(year), 10) || Math.ceil(semester / 2),
      academic_year: String(year),
      semester,
    });

    if (error) {
      if (error.code === '23505') return { success: false, error: `A class for course ${courseId}, section ${section} already exists.` };
      return { success: false, error: error.message };
    }
    return { success: true, message: `Successfully created class for Section ${section}.` };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred while creating the class.' };
  }
}

export async function getClassesWithDetails(): Promise<any[]> {
  await requireRole(...CLASS_ADMINS, 'emp:student_staff_management');
  const admin = await createServiceRoleClient();

  const [classes, { data: counts }] = await Promise.all([
    fetchAllRows(() =>
      admin
        .from('classes')
        .select('id, program, branch, year, academic_year, semester, section, classroom_id, courses(code, name, credits), teachers(profile_id, profiles(full_name)), classrooms(name)')
        .order('program')
        .order('branch')
        .order('section'),
    ),
    admin.rpc('get_section_student_counts'),
  ]);

  const countMap = new Map<string, number>();
  for (const r of (counts as any[]) || []) {
    countMap.set(`${r.program}|${r.branch}|${r.current_semester}|${r.section}`, Number(r.student_count));
  }

  return classes.map((c: any) => ({
    id: c.id,
    program: c.program,
    branch: c.branch,
    year: c.academic_year ?? String(c.year ?? ''),
    semester: c.semester,
    section: c.section,
    courseId: c.courses?.code,
    courseName: c.courses?.name || 'N/A',
    credits: c.courses?.credits || 0,
    teacherId: c.teachers?.profile_id,
    teacherName: c.teachers?.profiles?.full_name || 'N/A',
    studentCount: countMap.get(`${c.program}|${c.branch}|${c.semester}|${c.section}`) || 0,
    classroomId: c.classroom_id || null,
    classroomName: c.classrooms?.name || null,
  }));
}

export async function getAllClassrooms(): Promise<{ id: string; name: string; subject: string; section: string }[]> {
  await requireRole(...CLASS_ADMINS);
  const admin = await createServiceRoleClient();
  const data = await fetchAllRows(() => admin.from('classrooms').select('id, name, subject, section').order('name'));
  return data.map((c: any) => ({ id: c.id, name: c.name || '', subject: c.subject || '', section: c.section || '' }));
}

export async function linkClassroomToClass(classId: string, classroomId: string): Promise<ActionResult> {
  const auth = await authorize(...CLASS_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(classId) || !isUuid(classroomId)) return { success: false, error: 'Class ID and Classroom ID are required.' };
  const admin = await createServiceRoleClient();
  const { error } = await admin.from('classes').update({ classroom_id: classroomId }).eq('id', classId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Classroom linked successfully.' };
}

export async function unlinkClassroomFromClass(classId: string): Promise<ActionResult> {
  const auth = await authorize(...CLASS_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(classId)) return { success: false, error: 'Class ID is required.' };
  const admin = await createServiceRoleClient();
  const { error } = await admin.from('classes').update({ classroom_id: null }).eq('id', classId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Classroom unlinked successfully.' };
}

export async function updateTeacherForClass(classId: string, teacherId: string): Promise<ActionResult> {
  const auth = await authorize(...CLASS_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(classId) || !teacherId) return { success: false, error: 'Class ID and Teacher ID are required.' };
  const admin = await createServiceRoleClient();
  const teacherPk = await resolveTeacherPk(admin, teacherId);
  if (!teacherPk) return { success: false, error: 'Teacher not found.' };
  const { error } = await admin.from('classes').update({ teacher_id: teacherPk }).eq('id', classId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Teacher successfully assigned to class.' };
}

export async function deleteClass(classId: string): Promise<ActionResult> {
  const auth = await authorize(...CLASS_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(classId)) return { success: false, error: 'Class ID is required.' };
  const admin = await createServiceRoleClient();
  const { error } = await admin.from('classes').delete().eq('id', classId);
  if (error) {
    if (error.code === '23503') return { success: false, error: 'This class has attendance or marks recorded and cannot be deleted.' };
    return { success: false, error: error.message };
  }
  return { success: true, message: 'Class deleted successfully.' };
}
