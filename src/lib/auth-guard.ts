import { cache } from 'react';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase';
import type { UserRole } from '@/lib/types';

/**
 * Central authorization layer for every Server Action / Route Handler.
 *
 * Server Actions are public HTTP endpoints: anyone can invoke them with any
 * arguments. Most actions use the service-role client (which bypasses RLS),
 * so each one MUST verify the caller before touching data. This module is the
 * single place where "who is calling and what may they do" is decided.
 */

export type EmployeeType =
  | 'fee_management'
  | 'hostel_management'
  | 'student_staff_management'
  | 'exam_marks_management'
  | 'library_management';

/**
 * A permission spec is either a bare role ("teacher", "student", "super_admin")
 * or an employee sub-type ("emp:fee_management"). super_admin always passes.
 */
export type Permission = UserRole | `emp:${EmployeeType}`;

export interface Caller {
  userId: string;
  role: UserRole;
  email: string | null;
  fullName: string;
  employeeType: string | null;
}

export class AuthError extends Error {
  constructor(message = 'You are not authorized to perform this action.') {
    super(message);
    this.name = 'AuthError';
  }
}

/** Resolve the current caller once per request (React cache dedupes calls). */
export const getCaller = cache(async (): Promise<Caller | null> => {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const admin = await createServiceRoleClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.role) return null;

  let employeeType: string | null = null;
  if (profile.role === 'employee') {
    const { data: emp } = await admin
      .from('employees')
      .select('employee_type')
      .eq('profile_id', user.id)
      .maybeSingle();
    employeeType = emp?.employee_type ?? null;
  }

  return {
    userId: user.id,
    role: profile.role as UserRole,
    email: profile.email ?? user.email ?? null,
    fullName: profile.full_name || user.email || 'User',
    employeeType,
  };
});

export function callerHas(caller: Caller, perms: Permission[]): boolean {
  if (caller.role === 'super_admin') return true;
  return perms.some((p) => {
    if (p.startsWith('emp:')) {
      return caller.role === 'employee' && caller.employeeType === p.slice(4);
    }
    return caller.role === p;
  });
}

/** Throws AuthError unless the caller holds at least one permission. */
export async function requireRole(...perms: Permission[]): Promise<Caller> {
  const caller = await getCaller();
  if (!caller) throw new AuthError('Your session has expired. Please log in again.');
  if (perms.length > 0 && !callerHas(caller, perms)) throw new AuthError();
  return caller;
}

/** Non-throwing variant for actions that return `{ success, error }`. */
export async function authorize(
  ...perms: Permission[]
): Promise<{ ok: true; caller: Caller } | { ok: false; error: string }> {
  try {
    return { ok: true, caller: await requireRole(...perms) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unauthorized.' };
  }
}

/** Staff roles that may read any student's academic data. */
export const STUDENT_READERS: Permission[] = [
  'teacher',
  'emp:student_staff_management',
  'emp:exam_marks_management',
  'emp:fee_management',
  'emp:hostel_management',
];

/**
 * Resolve a `students.id` from either a students.id or a profile id, and make
 * sure the caller may access it: students only themselves, staff per STUDENT_READERS.
 */
export async function requireStudentAccess(
  anyStudentId: string | null | undefined,
  extraPerms: Permission[] = [],
): Promise<{ caller: Caller; studentId: string; profileId: string }> {
  const caller = await requireRole();
  const admin = await createServiceRoleClient();

  if (caller.role === 'student') {
    const { data: me } = await admin
      .from('students')
      .select('id, profile_id')
      .eq('profile_id', caller.userId)
      .maybeSingle();
    if (!me) throw new AuthError('Student record not found for your account.');
    if (anyStudentId && anyStudentId !== me.id && anyStudentId !== me.profile_id) {
      throw new AuthError('You can only access your own records.');
    }
    return { caller, studentId: me.id, profileId: me.profile_id };
  }

  if (!callerHas(caller, [...STUDENT_READERS, ...extraPerms])) throw new AuthError();
  if (!isUuid(anyStudentId)) throw new AuthError('A valid student ID is required.');

  const { data: row } = await admin
    .from('students')
    .select('id, profile_id')
    .or(`id.eq.${anyStudentId},profile_id.eq.${anyStudentId}`)
    .limit(1)
    .maybeSingle();
  if (!row) throw new AuthError('Student not found.');
  return { caller, studentId: row.id, profileId: row.profile_id };
}

/** Returns the teachers.id for the calling teacher, or null for non-teachers. */
export async function getCallerTeacherId(caller: Caller): Promise<string | null> {
  if (caller.role !== 'teacher') return null;
  const admin = await createServiceRoleClient();
  const { data } = await admin.from('teachers').select('id').eq('profile_id', caller.userId).maybeSingle();
  return data?.id ?? null;
}

/**
 * For actions that take a "profile id of the acting teacher/student" from the client:
 * self-service roles are pinned to their own id; admins/staff may act on anyone.
 */
export function pinToSelf(caller: Caller, requestedId: string | null | undefined): string {
  if (caller.role === 'teacher' || caller.role === 'student') return caller.userId;
  return requestedId || caller.userId;
}

/** Guard against PostgREST filter injection when ids are interpolated into .or() */
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Ensures a teacher only touches classes assigned to them; other permitted staff may touch any class. */
export async function assertClassAccess(caller: Caller, classId: string): Promise<void> {
  if (caller.role !== 'teacher') return;
  if (!isUuid(classId)) throw new AuthError('Invalid class.');
  const admin = await createServiceRoleClient();
  const { data } = await admin
    .from('classes')
    .select('id, teachers!inner(profile_id)')
    .eq('id', classId)
    .eq('teachers.profile_id', caller.userId)
    .maybeSingle();
  if (!data) throw new AuthError('You are not assigned to this class.');
}
