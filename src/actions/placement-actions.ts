'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, requireStudentAccess, isUuid } from '@/lib/auth-guard';
import { fetchAllRows } from '@/lib/db';
import type { ActionResult } from '@/lib/types';

const PLACEMENT_ADMINS = ['super_admin'] as const;
const APPLICATION_STATUSES = ['Applied', 'Under Review', 'Shortlisted', 'Offer Extended', 'Offer Accepted', 'Rejected'] as const;

const LEGACY_STATUS: Record<string, string> = {
  applied: 'Applied',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  selected: 'Offer Extended',
  rejected: 'Rejected',
};
const normalizeStatus = (s: string) => LEGACY_STATUS[s] || s;

function mapOpportunity(o: any) {
  return {
    id: o.id,
    type: o.type || 'placement',
    company: o.company_name,
    role: o.role_title,
    ctc_stipend: o.salary_package || (o.package_lpa ? `${o.package_lpa} LPA` : 'Not disclosed'),
    description: o.description || '',
    eligibility: o.eligibility || '',
    minCgpa: o.eligibility_cgpa ?? null,
    location: o.location || '',
    skills: Array.isArray(o.skills) ? o.skills : [],
    deadline: o.deadline,
    status: o.status || 'Open',
    duration: o.duration || undefined,
    applicantCount: o.applicant_count ?? 0,
  };
}

export async function getOpportunities(typeFilter?: 'placement' | 'internship'): Promise<any[]> {
  await requireRole();
  const admin = await createServiceRoleClient();
  const rows = await fetchAllRows(() => {
    let q = admin.from('placement_opportunities').select('*').order('created_at', { ascending: false });
    if (typeFilter) q = q.eq('type', typeFilter);
    return q;
  });
  return rows.map(mapOpportunity);
}

export async function saveOpportunity(payload: any): Promise<ActionResult> {
  const auth = await authorize(...PLACEMENT_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };

  const company = String(payload?.company ?? payload?.companyName ?? '').trim();
  const role = String(payload?.role ?? '').trim();
  if (!company || !role) return { success: false, error: 'Company and role are required.' };
  const type = payload?.type === 'internship' ? 'internship' : 'placement';
  const minCgpa = payload?.minCgpa === null || payload?.minCgpa === '' || payload?.minCgpa === undefined ? null : Number(payload.minCgpa);
  if (minCgpa !== null && (!Number.isFinite(minCgpa) || minCgpa < 0 || minCgpa > 10)) return { success: false, error: 'Minimum CGPA must be between 0 and 10.' };

  const row = {
    type,
    company_name: company,
    role_title: role,
    salary_package: payload?.ctc_stipend ?? payload?.package ?? null,
    description: payload?.description || null,
    eligibility: payload?.eligibility || null,
    eligibility_cgpa: minCgpa,
    location: payload?.location || null,
    duration: payload?.duration || null,
    skills: Array.isArray(payload?.skills) ? payload.skills.map((s: string) => String(s).trim()).filter(Boolean) : [],
    deadline: payload?.deadline || null,
    status: payload?.status === 'Closed' ? 'Closed' : 'Open',
  };

  const admin = await createServiceRoleClient();
  if (payload?.id) {
    if (!isUuid(payload.id)) return { success: false, error: 'Invalid opportunity.' };
    const { error } = await admin.from('placement_opportunities').update(row).eq('id', payload.id);
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Opportunity updated successfully.' };
  }
  const { error } = await admin.from('placement_opportunities').insert({ ...row, created_by: auth.caller.userId });
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Opportunity created successfully. Eligible students have been notified.' };
}

export async function deleteOpportunity(id: string): Promise<ActionResult> {
  const auth = await authorize(...PLACEMENT_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(id)) return { success: false, error: 'Invalid opportunity.' };
  const admin = await createServiceRoleClient();
  const { error } = await admin.from('placement_opportunities').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Opportunity deleted successfully.' };
}

export async function getAllApplications(): Promise<any[]> {
  await requireRole(...PLACEMENT_ADMINS);
  const admin = await createServiceRoleClient();
  const rows = await fetchAllRows(() =>
    admin
      .from('placement_applications')
      .select('id, opportunity_id, student_id, status, applied_at, placement_opportunities(company_name, role_title, type), students(college_id, profiles(full_name))')
      .order('applied_at', { ascending: false }),
  );
  return rows.map((app: any) => ({
    id: app.id,
    opportunityId: app.opportunity_id,
    opportunityType: app.placement_opportunities?.type || 'placement',
    company: app.placement_opportunities?.company_name,
    companyName: app.placement_opportunities?.company_name,
    role: app.placement_opportunities?.role_title,
    studentId: app.student_id,
    studentCollegeId: app.students?.college_id,
    studentName: app.students?.profiles?.full_name,
    appliedDate: app.applied_at,
    status: normalizeStatus(app.status),
  }));
}

export async function updateApplicationStatus(applicationId: string, status: string): Promise<ActionResult> {
  const auth = await authorize(...PLACEMENT_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(applicationId)) return { success: false, error: 'Invalid application.' };
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) return { success: false, error: 'Invalid status.' };
  const admin = await createServiceRoleClient();
  const { error } = await admin.from('placement_applications').update({ status }).eq('id', applicationId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Status updated successfully.' };
}

// ── Student-facing ───────────────────────────────────────────────────────────

/**
 * Apply to an opportunity. Validation (open, deadline, CGPA) and the
 * one-application-per-student rule are enforced atomically in SQL, so a
 * burst of thousands of simultaneous applications stays consistent.
 */
export async function submitApplication(payload: { userId?: string; studentId?: string; opportunityId: string; [k: string]: any }): Promise<ActionResult> {
  try {
    const { studentId } = await requireStudentAccess(payload?.studentId || payload?.userId);
    if (!isUuid(payload?.opportunityId)) return { success: false, error: 'Invalid opportunity.' };
    const admin = await createServiceRoleClient();
    const { data, error } = await admin.rpc('apply_to_opportunity', { p_student_id: studentId, p_opportunity_id: payload.opportunityId });
    if (error) return { success: false, error: error.message };
    if (data && data.success === false) return { success: false, error: data.error };
    return { success: true, message: 'Application submitted successfully.' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getStudentApplications(userId: string): Promise<any[]> {
  const { studentId } = await requireStudentAccess(userId);
  const admin = await createServiceRoleClient();
  const { data } = await admin
    .from('placement_applications')
    .select('id, opportunity_id, status, applied_at, placement_opportunities(type, company_name, role_title)')
    .eq('student_id', studentId)
    .order('applied_at', { ascending: false })
    .limit(500);
  return ((data || []) as any[]).map((app) => ({
    id: app.id,
    opportunityId: app.opportunity_id,
    opportunityType: app.placement_opportunities?.type || 'placement',
    company: app.placement_opportunities?.company_name,
    role: app.placement_opportunities?.role_title,
    status: normalizeStatus(app.status),
    appliedAt: app.applied_at,
  }));
}
