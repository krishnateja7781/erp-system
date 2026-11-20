'use server';

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Profile } from '@/lib/types';
import { getCaller } from '@/lib/auth-guard';
import { createStudentRecord } from '@/lib/accounts';
import { withinRateLimit } from '@/lib/rate-limit';
import { PROGRAMS, BRANCHES } from '@/lib/academic-codes';

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  if (!email || !password) return { data: null, error: 'Email and password are required.' };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { data: null, error: error.message };

  revalidatePath('/', 'layout');
  return { data: { success: true }, error: null };
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * Returns the authenticated session + profile. Uses getUser() (re-validates the
 * JWT with Supabase) rather than trusting the cookie contents.
 */
export async function getSession() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { data: null, error: error?.message || 'No session found' };

  const admin = await createServiceRoleClient();
  const { data: profile, error: profileDbError } = await admin
    .from('profiles')
    .select('id, role, full_name, first_name, last_name, email, phone, dob, id_code, profile_picture_url, notification_enabled, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profileDbError || !profile) {
    return { data: null, error: 'Your account has no profile. Please contact the administrator.' };
  }

  let userType: string | null = null;
  let backlogCount = 0;
  if (profile.role === 'student') {
    const { data: std } = await admin.from('students').select('id, is_hosteler').eq('profile_id', user.id).maybeSingle();
    userType = std?.is_hosteler ? 'Hosteler' : 'Day Scholar';
    if (std?.id) {
      const { count } = await admin.from('backlogs').select('id', { count: 'exact', head: true }).eq('student_id', std.id).eq('status', 'Active');
      backlogCount = count || 0;
    }
  } else if (profile.role === 'employee') {
    const { data: emp } = await admin.from('employees').select('employee_type').eq('profile_id', user.id).maybeSingle();
    userType = emp?.employee_type || null;
  }

  return {
    data: {
      session: { user: { id: user.id, email: user.email ?? null } },
      profile: { ...profile, avatar_url: profile.profile_picture_url } as Profile & Record<string, any>,
      userType,
      backlogCount,
    },
    error: null,
  };
}

/** The caller's id, display name and role. */
export async function getMyProfile(): Promise<{ uid: string; name: string; role: string } | null> {
  const caller = await getCaller();
  if (!caller) return null;
  return { uid: caller.userId, name: caller.fullName, role: caller.role };
}

export async function resetPassword(email: string) {
  if (!email) return { data: null, error: 'Email is required.' };
  if (!(await withinRateLimit('reset', 5, 3600))) return { data: null, error: 'Too many requests. Please try again later.' };
  const supabase = await createServerSupabaseClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${appUrl}/auth/callback?next=/update-password`,
  });
  if (error) console.error('[resetPassword]', error.message);
  return { data: 'If an account exists for that email, reset instructions have been sent.', error: null };
}

/** A user may read their own profile; staff may read anyone's. */
export async function getProfile(userId: string) {
  const caller = await getCaller();
  if (!caller) return { data: null, error: 'Not authenticated.' };
  if (caller.userId !== userId && caller.role === 'student') return { data: null, error: 'Not authorized.' };

  const admin = await createServiceRoleClient();
  const { data, error } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error || !data) return { data: null, error: error?.message || 'Profile not found.' };
  return { data: data as Profile, error: null };
}

/**
 * Super-admin registration.
 * - Bootstrap: allowed without a session ONLY while no super admin exists.
 * - Afterwards: only an existing super admin may create another one.
 */
export async function adminSelfRegister(data: any) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local and restart.' };
  }
  if (!(await withinRateLimit('admin-signup', 5, 3600))) {
    return { success: false, error: 'Too many attempts. Please try again later.' };
  }
  const admin = await createServiceRoleClient();

  const { count: existingAdmins } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'super_admin');
  if ((existingAdmins || 0) > 0) {
    const caller = await getCaller();
    if (caller?.role !== 'super_admin') {
      return { success: false, error: 'Super admin registration is closed. Ask an existing super admin to create your account.' };
    }
  }

  const email = String(data?.email || '').trim().toLowerCase();
  const password = String(data?.password || '');
  const firstName = String(data?.firstName || '').trim();
  const lastName = String(data?.lastName || '').trim();
  if (!email || password.length < 6 || !firstName) {
    return { success: false, error: 'Name, valid email and a password of at least 6 characters are required.' };
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError) return { success: false, error: authError.message };
  const userId = authData.user.id;

  const { data: employeeCode, error: seqErr } = await admin.rpc('generate_staff_code', { p_role: 'super_admin', p_join_year: new Date().getFullYear() });
  if (seqErr || typeof employeeCode !== 'string') {
    await admin.auth.admin.deleteUser(userId);
    return { success: false, error: `Database not initialised: ${seqErr?.message || 'generator unavailable'}` };
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: userId,
    role: 'super_admin',
    full_name: `${firstName} ${lastName}`.trim(),
    first_name: firstName,
    last_name: lastName || null,
    email,
    phone: data.phone || null,
    id_code: employeeCode,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { success: false, error: profileError.message };
  }

  const { error: empError } = await admin.from('employees').insert({
    profile_id: userId,
    employee_code: employeeCode,
    employee_type: 'super_admin',
    department: 'Administration',
    designation: 'Super Administrator',
    dob: data.dob || null,
    phone: data.phone || null,
    status: 'Active',
  });
  if (empError) console.error('[adminSelfRegister] employee row failed (non-fatal):', empError.message);

  return { success: true, message: 'Super Admin successfully registered!' };
}

/**
 * Public student self-registration. Only identity fields are accepted from the
 * form; academic placement (program/branch/semester) is completed by an admin.
 */
export async function studentSelfRegister(data: any): Promise<any> {
  if (!(await withinRateLimit('signup', 5, 3600))) {
    return { success: false, error: 'Too many registrations from this network. Please try again later.' };
  }
  const email = String(data?.email || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { success: false, error: 'A valid email is required.' };
  if (String(data?.password || '').length < 6) return { success: false, error: 'Password must be at least 6 characters.' };
  if (!String(data?.firstName || '').trim()) return { success: false, error: 'First name is required.' };

  if (!PROGRAMS.includes(data?.program) || !(BRANCHES[data.program] || []).includes(data?.branch)) {
    return { success: false, error: 'Please choose a valid program and branch.' };
  }
  const year = parseInt(String(data?.joiningYear ?? ''), 10);
  const thisYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < thisYear - 10 || year > thisYear) return { success: false, error: 'Invalid year of joining.' };

  // The college ID is always generated (ENG26CS00442); self-registration cannot pick one.
  return createStudentRecord({
    firstName: data?.firstName,
    lastName: data?.lastName,
    email: data?.email,
    password: data?.password,
    gender: data?.gender,
    program: data.program,
    branch: data.branch,
    batch: year,
    semester: 1,
    year: 1,
    status: 'Pending Approval', // an admin verifies and activates self-registered students
  });
}
