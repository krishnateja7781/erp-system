'use server'

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Profile } from '@/lib/types'
import { createStudentAccount } from './student-actions'

export async function signInAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { data: null, error: error.message }
  }

  revalidatePath('/', 'layout')
  return { data: { success: true }, error: null }
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function getSession() {
  const supabase = await createServerSupabaseClient()
  // Use getUser() not getSession() — getUser() re-validates the JWT with Supabase servers
  // which is more secure and ensures the session is genuinely valid server-side.
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return { data: null, error: error?.message || 'No session found' }
  }
  
  const { data: profile, error: profileDbError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileDbError || !profile) {
    return { data: null, error: `DB Error: ${profileDbError?.message || 'No rows returned for profile.'}. UserID: ${user.id}` }
  }
    
  let userType = null;
  if (profile.role === 'student') {
     const adminSupabase = await createServiceRoleClient();
     const { data: std } = await adminSupabase.from('students').select('is_hosteler').eq('profile_id', user.id).single();
     userType = std?.is_hosteler ? 'Hosteler' : 'Day Scholar';
  } else if (profile.role === 'employee') {
     const adminSupabase = await createServiceRoleClient();
     const { data: emp } = await adminSupabase.from('employees').select('employee_type').eq('profile_id', user.id).single();
     userType = emp?.employee_type || null;
  }
    
  return { 
    data: { 
      session: { user },
      profile: profile as Profile | null,
      userType
    }, 
    error: null 
  }
}

/** Returns the current user's profile id, name and role from the server session — no localStorage needed. */
export async function getMyProfile(): Promise<{ uid: string; name: string; role: string } | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  // Fetch real name from the role-specific table for teachers/students
  let name = profile.full_name || '';
  if (!name || name.trim() === '') {
    if (profile.role === 'teacher') {
      const { data: t } = await supabase.from('teachers').select('name').eq('profile_id', user.id).single();
      if (t?.name) name = t.name;
    } else if (profile.role === 'student') {
      const { data: s } = await supabase.from('students').select('name').eq('profile_id', user.id).single();
      if (s?.name) name = s.name;
    } else if (profile.role === 'employee' || profile.role === 'admin') {
      const { data: e } = await supabase.from('employees').select('name').eq('profile_id', user.id).single();
      if (e?.name) name = e.name;
    }
  }

  return { uid: user.id, name: name || user.email || 'User', role: profile.role };
}


export async function resetPassword(email: string) {
  const supabase = await createServerSupabaseClient()
  const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${redirectUrl}/update-password`,
  })

  if (error) {
    return { data: null, error: error.message }
  }
  
  return { data: "Password reset instructions sent to email", error: null }
}

export async function getProfile(userId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
    
  if (error) {
    return { data: null, error: error.message }
  }
  
  return { data: data as Profile, error: null }
}

export async function adminSelfRegister(data: any) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: "Setup Error: You must add SUPABASE_SERVICE_ROLE_KEY to your .env.local file in order to register an admin. Restart the server after adding it!" }
  }

  const adminSupabase = await createServiceRoleClient()
  
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  })
  
  if (authError) return { success: false, error: authError.message }
  
  const userId = authData.user.id
  const fullName = `${data.firstName} ${data.lastName}`.trim()
  
  const yearCode = new Date().getFullYear().toString().slice(-2);
  const employeeCode = `SUP${yearCode}ADM${String(Date.now()).slice(-4)}`;

  const { error: profileError } = await adminSupabase.from('profiles').insert({
    id: userId,
    role: 'super_admin',
    full_name: fullName,
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    phone: data.phone || null,
    id_code: employeeCode,
    initial_password: data.password
  })
  
  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(userId)
    return { success: false, error: profileError.message }
  }

  // Insert super admin into the employees table with employee_type = 'super_admin'

  const { error: empError } = await adminSupabase.from('employees').insert({
    profile_id: userId,
    employee_code: employeeCode,
    employee_type: 'super_admin',
    department: 'Administration',
    designation: 'Super Administrator',
    dob: data.dob || null,
    phone: data.phone || null,
    status: 'Active'
  })

  if (empError) {
    console.error("Super Admin employee record insertion failed:", empError)
    // Non-fatal: profile exists and role is set — they can still log in
  }
  
  return { success: true, message: 'Super Admin successfully registered!' }
}

export async function studentSelfRegister(data: any): Promise<any> {
    const response = await createStudentAccount(data);
    return response;
}


