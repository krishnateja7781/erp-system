import { createServiceRoleClient } from '@/lib/supabase';
import type { Caller } from '@/lib/auth-guard';

/** Owner, members and super-admin / exam staff (who link classrooms) may view a classroom. */
export async function canAccessClassroom(caller: Caller, classroomId: string): Promise<boolean> {
  if (caller.role === 'super_admin' || (caller.role === 'employee' && caller.employeeType === 'exam_marks_management')) return true;
  const admin = await createServiceRoleClient();
  const { count } = await admin
    .from('classroom_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('classroom_id', classroomId)
    .eq('user_id', caller.userId);
  return (count || 0) > 0;
}


/** Classroom owner (teacher) check. */
export async function isClassroomOwner(caller: Caller, classroomId: string): Promise<boolean> {
  if (caller.role === 'super_admin') return true;
  const admin = await createServiceRoleClient();
  const { data } = await admin.from('classrooms').select('owner_id').eq('id', classroomId).maybeSingle();
  return data?.owner_id === caller.userId;
}
