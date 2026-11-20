'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole } from '@/lib/auth-guard';
import { fetchAllRows } from '@/lib/db';
import type { StaffMember, ActionResult } from '@/lib/types';
import type { AddStaffFormValues } from '@/components/admin/staff/add-staff-dialog';
import { generatePassword } from '@/lib/utils';

const STAFF_ADMINS = ['emp:student_staff_management'] as const;
const STAFF_READERS = ['emp:student_staff_management', 'emp:exam_marks_management', 'emp:hostel_management', 'emp:fee_management', 'emp:library_management'] as const;

export async function getStaff(): Promise<StaffMember[]> {
  await requireRole(...STAFF_READERS);
  const admin = await createServiceRoleClient();

  const [teachers, employees] = await Promise.all([
    fetchAllRows(() => admin.from('teachers').select('*, profiles(full_name, email, phone)').order('employee_code')),
    fetchAllRows(() => admin.from('employees').select('*, profiles(full_name, email, phone)').order('employee_code')),
  ]);

  const teacherRows: StaffMember[] = teachers.map((t: any) => ({
    id: t.id,
    uid: t.profile_id,
    name: t.profiles?.full_name || t.profiles?.email || 'Unknown',
    email: t.profiles?.email,
    phone: t.profiles?.phone || t.phone,
    staffId: t.employee_code || t.id,
    role: 'teacher',
    department: t.department,
    position: t.designation || 'Teacher',
    status: t.status || 'Active',
    program: t.program || undefined,
  }));

  const employeeRows: StaffMember[] = employees.map((e: any) => ({
    id: e.id,
    uid: e.profile_id,
    name: e.profiles?.full_name || e.profiles?.email || 'Unknown',
    email: e.profiles?.email,
    phone: e.profiles?.phone || e.phone,
    staffId: e.employee_code || e.id,
    role: e.employee_type === 'super_admin' ? 'super_admin' : 'employee',
    department: e.employee_type || e.department,
    position: e.designation || (e.employee_type === 'super_admin' ? 'Administrator' : 'Staff'),
    status: e.status || 'Active',
    program: 'General Admin',
  }));

  return [...teacherRows, ...employeeRows];
}

export async function getTeachers(): Promise<StaffMember[]> {
  return (await getStaff()).filter((s) => s.role === 'teacher');
}

/** Teachers who can be assigned to classes of a program (falls back to all teachers). */
export async function getAssignableTeachers(program: string): Promise<StaffMember[]> {
  const teachers = await getTeachers();
  const matching = teachers.filter((t) => !t.program || t.program === program);
  return matching.length > 0 ? matching : teachers;
}

export async function createStaffAccount(values: AddStaffFormValues): Promise<ActionResult> {
  const auth = await authorize(...STAFF_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };

  const { firstName, lastName, email, dob, role, department, position, employeeType, programAssociation, dateOfJoining, status, phone, officeLocation, qualifications, specialization } = values;
  if (role === 'super_admin' && auth.caller.role !== 'super_admin') {
    return { success: false, error: 'Only a super admin can create another super admin.' };
  }
  if (!email || !firstName) return { success: false, error: 'Name and email are required.' };

  const admin = await createServiceRoleClient();
  const generatedPassword = generatePassword(firstName, dob) || `Staff@${Math.random().toString(36).slice(2, 10)}`;
  const staffName = `${firstName} ${lastName || ''}`.trim();
  // 12-char IDs from the shared SQL generator: TCH26CS00017 (teacher), EMP26FE00003 (employee), ADM26SA00001 (super admin).
  const { data: staffId, error: codeErr } = await admin.rpc('generate_staff_code', {
    p_role: role,
    p_department: department || null,
    p_employee_type: role === 'employee' ? employeeType || 'student_staff_management' : null,
    p_join_year: dateOfJoining ? new Date(dateOfJoining).getFullYear() : new Date().getFullYear(),
  });
  if (codeErr || typeof staffId !== 'string') return { success: false, error: `Could not allocate a staff ID: ${codeErr?.message || 'generator unavailable'}` };

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password: generatedPassword,
    email_confirm: true,
  });
  if (authError) return { success: false, error: authError.message };
  const userId = authData.user.id;

  const { error: profileError } = await admin.from('profiles').insert({
    id: userId,
    role,
    full_name: staffName,
    first_name: firstName,
    last_name: lastName || null,
    email: email.trim().toLowerCase(),
    phone: phone || null,
    dob: dob || null,
    id_code: staffId,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { success: false, error: profileError.message };
  }

  const common = {
    profile_id: userId,
    employee_code: staffId,
    department: department || null,
    designation: position || null,
    dob: dob || null,
    phone: phone || null,
    date_of_joining: dateOfJoining || null,
    office_location: officeLocation || null,
    qualifications: qualifications || null,
    specialization: specialization || null,
    status: status || 'Active',
  };

  const { error: dbError } =
    role === 'teacher'
      ? await admin.from('teachers').insert({ ...common, program: programAssociation || null })
      : await admin.from('employees').insert({
          ...common,
          employee_type: role === 'super_admin' ? 'super_admin' : employeeType || 'student_staff_management',
        });

  if (dbError) {
    await admin.auth.admin.deleteUser(userId);
    return { success: false, error: dbError.message };
  }
  return { success: true, staffId, password: generatedPassword };
}

export async function updateStaff(staffDocId: string, role: string, values: AddStaffFormValues): Promise<ActionResult> {
  const auth = await authorize(...STAFF_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  const admin = await createServiceRoleClient();
  const table = role === 'teacher' ? 'teachers' : 'employees';

  const { data: row } = await admin.from(table).select('profile_id, employee_type').eq('id', staffDocId).maybeSingle();
  if (!row) return { success: false, error: 'Staff member not found.' };
  if ((row as any).employee_type === 'super_admin' && auth.caller.role !== 'super_admin') {
    return { success: false, error: 'Only a super admin can edit a super admin.' };
  }

  const newEmail = values.email?.trim().toLowerCase();
  if (newEmail) {
    // Keep the login email in sync with the profile email.
    const { error: authErr } = await admin.auth.admin.updateUserById(row.profile_id, { email: newEmail, email_confirm: true });
    if (authErr) return { success: false, error: authErr.message };
  }

  const { error: pErr } = await admin.from('profiles').update({
    full_name: `${values.firstName} ${values.lastName || ''}`.trim(),
    first_name: values.firstName,
    last_name: values.lastName || null,
    ...(newEmail ? { email: newEmail } : {}),
    phone: values.phone || null,
    dob: values.dob || null,
  }).eq('id', row.profile_id);
  if (pErr) return { success: false, error: pErr.message };

  const patch: Record<string, unknown> = {
    department: values.department || null,
    designation: values.position || null,
    dob: values.dob || null,
    phone: values.phone || null,
    office_location: values.officeLocation || null,
    qualifications: values.qualifications || null,
    specialization: values.specialization || null,
    status: values.status || 'Active',
  };
  if (role === 'teacher' && values.programAssociation) patch.program = values.programAssociation;
  if (role !== 'teacher' && values.employeeType && (row as any).employee_type !== 'super_admin') patch.employee_type = values.employeeType;

  const { error } = await admin.from(table).update(patch).eq('id', staffDocId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Staff profile updated successfully.' };
}

/** Deletes a teacher or employee (by their table id) and revokes the login. */
export async function deleteTeacher(teacherDocId: string): Promise<ActionResult> {
  const auth = await authorize(...STAFF_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  const admin = await createServiceRoleClient();

  const [{ data: t }, { data: e }] = await Promise.all([
    admin.from('teachers').select('profile_id').eq('id', teacherDocId).maybeSingle(),
    admin.from('employees').select('profile_id, employee_type').eq('id', teacherDocId).maybeSingle(),
  ]);
  const profileId = t?.profile_id || e?.profile_id;
  if (!profileId) return { success: false, error: 'Staff member not found.' };
  if (e?.employee_type === 'super_admin' && auth.caller.role !== 'super_admin') {
    return { success: false, error: 'Only a super admin can delete a super admin.' };
  }
  if (profileId === auth.caller.userId) return { success: false, error: 'You cannot delete your own account.' };

  // auth.users deletion cascades to profiles → teachers/employees; classes.teacher_id is set null.
  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Staff member deleted.' };
}
