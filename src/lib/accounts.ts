/**
 * Account provisioning (server-only module — NOT a 'use server' file, so these
 * functions are not exposed as callable endpoints; callers must authorize first).
 */
import { createServiceRoleClient } from '@/lib/supabase';
import { generatePassword } from '@/lib/utils';

export interface StudentRecordInput {
  firstName?: string;
  lastName?: string;
  name?: string;
  fullName?: string;
  email?: string;
  password?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  program?: string;
  branch?: string;
  section?: string;
  semester?: string | number;
  year?: string | number;
  batch?: string | number;
  type?: string;
  isHosteler?: boolean;
  status?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bloodGroup?: string;
}

export async function createStudentRecord(data: StudentRecordInput) {
  const admin = await createServiceRoleClient();

  // College IDs are always generated (12 chars, e.g. ENG26CS00442) — never chosen by the caller.
  const admitted = parseInt(String(data.batch ?? ''), 10) || new Date().getFullYear();
  const { data: generated, error: genErr } = await admin.rpc('generate_college_id', {
    p_program: data.program || null,
    p_branch: data.branch || null,
    p_admitted_year: admitted,
  });
  if (genErr || typeof generated !== 'string') return { success: false, error: `Could not generate a college ID: ${genErr?.message || 'generator unavailable'}` };
  const collegeId: string = generated;

  const email = (data.email || `${collegeId.toLowerCase()}@student.edu.in`).trim().toLowerCase();
  const password = data.password || generatePassword(data.firstName || data.fullName || 'Student', data.dob || '') || `Stu@${Math.random().toString(36).slice(2, 10)}`;
  const fullName =
    (data.firstName ? `${data.firstName} ${data.lastName || ''}` : data.name || data.fullName || 'Student').trim();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError) return { success: false, error: authError.message };
  const userId = authData.user.id;

  const { error: profileError } = await admin.from('profiles').insert({
    id: userId,
    role: 'student',
    full_name: fullName,
    first_name: data.firstName || null,
    last_name: data.lastName || null,
    email,
    phone: data.phone || null,
    dob: data.dob || null,
    id_code: collegeId,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { success: false, error: profileError.message };
  }

  const semester = parseInt(String(data.semester ?? ''), 10) || 1;
  const { error: studentError } = await admin.from('students').insert({
    profile_id: userId,
    college_id: collegeId,
    program: data.program || null,
    branch: data.branch || null,
    section: (data.section || 'A').toUpperCase(),
    current_semester: semester,
    current_year: parseInt(String(data.year ?? ''), 10) || Math.ceil(semester / 2),
    is_hosteler: data.type === 'Hosteler' || data.isHosteler === true,
    status: ['Active', 'Inactive', 'Graduated', 'Pending Approval', 'Suspended', 'Dropped Out'].includes(data.status || '') ? data.status : 'Active',
    dob: data.dob || null,
    admitted_year: parseInt(String(data.batch ?? ''), 10) || new Date().getFullYear(),
    gender: data.gender || null,
    address: data.address || null,
    parent_name: data.emergencyContactName || null,
    parent_phone: data.emergencyContactPhone || null,
    blood_group: data.bloodGroup || null,
  });
  if (studentError) {
    // profiles row cascades from auth.users deletion
    await admin.auth.admin.deleteUser(userId);
    return { success: false, error: studentError.message };
  }

  return { success: true, message: `Student successfully created! Email: ${email}`, studentId: collegeId, password, email };
}
