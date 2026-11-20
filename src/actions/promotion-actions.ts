'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, isUuid } from '@/lib/auth-guard';
import { fetchAllRows } from '@/lib/db';
import type { ActionResult } from '@/lib/types';

const PROMOTION_ADMINS = ['super_admin'] as const;

export async function getEligibleStudentsForPromotion(program: string, branch: string, currentSemester: number) {
  await requireRole(...PROMOTION_ADMINS);
  const admin = await createServiceRoleClient();
  const students = await fetchAllRows(() => {
    let q = admin
      .from('students')
      .select('id, college_id, program, branch, current_semester, is_hosteler, profiles(full_name)')
      .eq('status', 'Active')
      .order('college_id', { ascending: true });
    if (program) q = q.eq('program', program);
    if (branch) q = q.eq('branch', branch);
    if (currentSemester) q = q.eq('current_semester', currentSemester);
    return q;
  });
  return students.map((s: any) => ({
    id: s.id,
    collegeId: s.college_id,
    name: s.profiles?.full_name || 'Unknown',
    program: s.program,
    branch: s.branch,
    currentSemester: s.current_semester,
    type: s.is_hosteler ? 'Hosteler' : 'Day Scholar',
  }));
}

/**
 * Promotes many students in a single database call (`promote_students`), each
 * one in its own savepoint: a failure for one student never blocks the rest,
 * and 5,000 students cost one round trip instead of 5,000.
 */
export async function promoteStudentsBatch(studentIds: string[], academicYear: string): Promise<ActionResult & { details?: any[] }> {
  const auth = await authorize(...PROMOTION_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  const ids = Array.from(new Set((studentIds || []).filter(isUuid)));
  if (ids.length === 0) return { success: false, error: 'Select at least one student.' };
  if (ids.length > 10000) return { success: false, error: 'Promote at most 10,000 students at a time.' };

  const admin = await createServiceRoleClient();
  const { data, error } = await admin.rpc('promote_students', {
    p_student_ids: ids,
    p_promoted_by: auth.caller.userId,
    p_academic_year: String(academicYear || new Date().getFullYear()),
  });
  if (error) return { success: false, error: error.message };

  const details = ((data as any[]) || []).map((r) => ({
    studentId: r.student_id,
    success: !!r.success,
    error: r.error || undefined,
    missingCourses: r.courses || undefined,
    details: r,
  }));
  const ok = details.filter((d) => d.success).length;
  if (ok === 0) return { success: false, error: 'Failed to promote any students. Check details below.', details };
  return { success: true, message: `Successfully promoted ${ok} out of ${ids.length} students.`, details };
}
