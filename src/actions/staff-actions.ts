'use server';

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase';
import type { Teacher, StaffMember, ActionResult } from '@/lib/types';
import type { AddStaffFormValues } from '@/components/admin/staff/add-staff-dialog';
import { generatePassword } from '@/lib/utils';

export async function getStaff(): Promise<StaffMember[]> {
  const supabase = await createServiceRoleClient()
  
  const [teachersRes, employeesRes] = await Promise.all([
    supabase.from('teachers').select('*, profiles(*)'),
    supabase.from('employees').select('*, profiles(*)')
  ]);

  const teachers = (teachersRes.data || []).map(t => ({
    id: t.id,
    uid: t.profile_id,
    name: t.profiles?.full_name || t.profiles?.email || 'Unknown',
    email: t.profiles?.email,
    staffId: t.employee_code || t.id,
    role: 'teacher' as any,
    department: t.department,
    position: t.designation || 'Teacher',
    status: t.status || 'Active',
    program: t.program || 'B.Tech'
  }));

  const staffEmployees = (employeesRes.data || []).map(e => ({
    id: e.id,
    uid: e.profile_id,
    name: e.profiles?.full_name || e.profiles?.email || 'Unknown',
    email: e.profiles?.email,
    staffId: e.employee_code || e.id,
    role: e.employee_type === 'super_admin' ? 'super_admin' : 'employee',
    department: e.employee_type || e.department,
    position: e.designation || (e.employee_type === 'super_admin' ? 'Administrator' : 'Staff'),
    status: e.status || 'Active',
    program: 'General Admin'
  }));

  return [...teachers, ...staffEmployees];
}

export async function getTeachers(): Promise<StaffMember[]> {
  return (await getStaff()).filter(s => s.role === 'teacher');
}

export async function getAssignableTeachers(program: string): Promise<StaffMember[]> {
  return getTeachers();
}

export async function createStaffAccount(values: AddStaffFormValues): Promise<ActionResult> {
  const adminSupabase = await createServiceRoleClient()
  const { firstName, lastName, email, dob, role, department, position, employeeType, programAssociation, dateOfJoining, status, phone, officeLocation, qualifications, specialization } = values;

  const generatedPassword = generatePassword(firstName, dob) || 'Staff@123';
  const staffName = `${firstName} ${lastName}`.trim();

  const yearCode = (dateOfJoining ? new Date(dateOfJoining).getFullYear().toString() : new Date().getFullYear().toString()).substring(2, 4);
  let idPrefix = "";

  if (role === 'teacher') {
      const progCode = (programAssociation || 'UNK').substring(0, 3).toUpperCase();
      const deptCode = (department || 'UNK').substring(0, 3).toUpperCase();
      idPrefix = `${progCode}${yearCode}${deptCode}`;
  } else if (role === 'employee') {
      const typeCode = (employeeType || 'EMP').substring(0, 3).toUpperCase();
      const deptCode = (department || 'ADM').substring(0, 3).toUpperCase();
      idPrefix = `${typeCode}${yearCode}${deptCode}`;
  } else if (role === 'super_admin') {
      const typeCode = 'SUP';
      const deptCode = (department || 'ADM').substring(0, 3).toUpperCase();
      idPrefix = `${typeCode}${yearCode}${deptCode}`;
  }

  const tableToQuery = role === 'teacher' ? 'teachers' : 'employees';
  const { count } = await adminSupabase.from(tableToQuery)
      .select('*', { count: 'exact', head: true })
      .like('employee_code', `${idPrefix}%`);
      
  const nextSeq = ((count || 0) + 1).toString().padStart(4, '0');
  const staffId = `${idPrefix}${nextSeq}`;

  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password: generatedPassword,
    email_confirm: true,
  });

  if (authError) return { success: false, error: authError.message };
  const userId = authData.user.id;

  const { error: profileError } = await adminSupabase.from('profiles').insert({
    id: userId,
    role: role,
    full_name: staffName,
    first_name: firstName,
    last_name: lastName,
    email: email,
    phone: phone || null,
    dob: dob || null,
    id_code: staffId,
    initial_password: generatedPassword
  });

  if (profileError) {
      await adminSupabase.auth.admin.deleteUser(userId);
      return { success: false, error: profileError.message };
  }

  let dbError;
  if (role === 'teacher') {
    const { error: tError } = await adminSupabase.from('teachers').insert({
      profile_id: userId,
      employee_code: staffId,
      department: department,
      designation: position,
      dob: dob || null,
      date_of_joining: dateOfJoining || null,
      office_location: officeLocation || null,
      qualifications: qualifications || null,
      specialization: specialization || null,
      status: status || 'Active'
    });
    dbError = tError;
  } else {
    const { error: eError } = await adminSupabase.from('employees').insert({
      profile_id: userId,
      employee_code: staffId,
      employee_type: role === 'super_admin' ? 'super_admin' : (employeeType || 'student_staff_management'),
      department: department,
      dob: dob || null,
      date_of_joining: dateOfJoining || null,
      office_location: officeLocation || null,
      qualifications: qualifications || null,
      specialization: specialization || null,
      status: status || 'Active'
    });
    dbError = eError;
  }

  if (dbError) {
      await adminSupabase.auth.admin.deleteUser(userId);
      return { success: false, error: dbError.message };
  }

  return { success: true, staffId, password: generatedPassword };
}


export async function updateStaff(staffDocId: string, role: string, values: AddStaffFormValues): Promise<ActionResult> {
  const adminSupabase = await createServiceRoleClient();
  const staffName = `${values.firstName} ${values.lastName}`.trim();
  
  if (role === 'teacher') {
    const { data: t } = await adminSupabase.from('teachers').select('profile_id').eq('id', staffDocId).single();
    if (t) {
      await adminSupabase.from('profiles').update({ 
        full_name: staffName,
        first_name: values.firstName,
        last_name: values.lastName,
        email: values.email,
        phone: values.phone || null,
        dob: values.dob || null
      }).eq('id', t.profile_id);
      await adminSupabase.from('teachers').update({ 
        department: values.department, 
        designation: values.position,
        dob: values.dob || null,
        phone: values.phone || null,
        office_location: values.officeLocation || null,
        qualifications: values.qualifications || null,
        specialization: values.specialization || null,
        status: values.status || 'Active'
      }).eq('id', staffDocId);
    }
  } else {
    const { data: e } = await adminSupabase.from('employees').select('profile_id').eq('id', staffDocId).single();
    if (e) {
      await adminSupabase.from('profiles').update({ 
        full_name: staffName,
        first_name: values.firstName,
        last_name: values.lastName,
        email: values.email,
        phone: values.phone || null,
        dob: values.dob || null
      }).eq('id', e.profile_id);
      await adminSupabase.from('employees').update({ 
        department: values.department,
        dob: values.dob || null,
        phone: values.phone || null,
        office_location: values.officeLocation || null,
        qualifications: values.qualifications || null,
        specialization: values.specialization || null,
        status: values.status || 'Active'
      }).eq('id', staffDocId);
    }
  }
  return { success: true, message: 'Staff profile updated successfully.' };
}


export async function deleteTeacher(teacherDocId: string): Promise<ActionResult> {
  const adminSupabase = await createServiceRoleClient()
  let profileId = null;
  
  const tReq = await adminSupabase.from('teachers').select('profile_id').eq('id', teacherDocId).single();
  if (tReq.data) {
     profileId = tReq.data.profile_id;
     await adminSupabase.from('teachers').delete().eq('id', teacherDocId);
  } else {
     const eReq = await adminSupabase.from('employees').select('profile_id').eq('id', teacherDocId).single();
     if (eReq.data) {
        profileId = eReq.data.profile_id;
        await adminSupabase.from('employees').delete().eq('id', teacherDocId);
     }
  }
  
  if (profileId) {
    await adminSupabase.auth.admin.deleteUser(profileId);
  }
  
  return { success: true, message: 'Staff member deleted.' };
}

