'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import type { ActionResult } from '@/lib/types';

export async function getOpportunities(typeFilter?: 'placement' | 'internship'): Promise<any[]> {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from('placement_opportunities').select('*').order('created_at', { ascending: false });
    
    const { data } = await query;
    if (!data) return [];
    
    let mapped = data.map((o: any) => ({
        id: o.id,
        type: o.type || 'placement',
        company: o.company_name,
        role: o.role_title,
        ctc_stipend: o.salary_package || `${o.package_lpa || 'Not disclosed'} LPA`,
        description: o.description || 'Opportunity details.',
        eligibility: `B.Tech / M.Tech`,
        minCgpa: o.eligibility_cgpa || 7.0,
        skills: ['Java', 'React', 'SQL', 'Python'].sort(() => 0.5 - Math.random()).slice(0, 3),
        deadline: o.deadline,
        status: o.status || 'Open',
        duration: o.type === 'internship' ? '6 Months' : undefined,
    }));

    if (typeFilter) {
        // mock filter if type is just assumed from database
        mapped = mapped.filter((m: any) => m.type === typeFilter);
    }

    return mapped;
}

export async function saveOpportunity(payload: any): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    const { id, companyName, role, package: salary, deadline, eligibility } = payload;
    
    const cgpa = parseFloat(eligibility?.replace(/[^0-9.]/g, '')) || 0;
    
    if (id) {
        const { error } = await supabase.from('placement_opportunities').update({
            company_name: companyName,
            role_title: role,
            salary_package: salary,
            deadline: deadline,
            eligibility_cgpa: cgpa
        }).eq('id', id);
        if (error) return { success: false, error: error.message };
        return { success: true, message: 'Opportunity updated successfully.' };
    } else {
        const { error } = await supabase.from('placement_opportunities').insert({
            company_name: companyName,
            role_title: role,
            salary_package: salary,
            deadline: deadline,
            eligibility_cgpa: cgpa
        });
        if (error) return { success: false, error: error.message };
        return { success: true, message: 'Opportunity created successfully.' };
    }
}

export async function deleteOpportunity(id: string): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('placement_opportunities').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Opportunity deleted successfully.' };
}

export async function getAllApplications(): Promise<any[]> {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from('placement_applications')
        .select('*, placement_opportunities(*), students(*, profiles(*))')
        .order('applied_at', { ascending: false });
        
    if (!data) return [];
    
    return data.map((app: any) => ({
        id: app.id,
        opportunityId: app.opportunity_id,
        companyName: app.placement_opportunities?.company_name,
        role: app.placement_opportunities?.role_title,
        studentId: app.students?.college_id,
        studentName: app.students?.profiles?.full_name,
        appliedDate: app.applied_at,
        status: app.status
    }));
}

export async function updateApplicationStatus(applicationId: string, status: string): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('placement_applications').update({ status }).eq('id', applicationId);
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Status updated successfully.' };
}

// ── Student-facing placement functions ────────────────────────────────────────

export async function submitApplication(payload: {
    userId: string;
    studentId: string;
    opportunityId: string;
    opportunityType: string;
    company: string;
    role: string;
}): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();

    // Check if duplicate
    const { data: existing } = await supabase
        .from('placement_applications')
        .select('id')
        .eq('student_id', payload.studentId)
        .eq('opportunity_id', payload.opportunityId)
        .single();
        
    if (existing) {
        return { success: false, error: 'You have already applied.' };
    }

    const { error } = await supabase.from('placement_applications').insert({
        student_id: payload.studentId,
        opportunity_id: payload.opportunityId,
        status: 'applied',
    });

    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Application submitted successfully.' };
}

export async function getStudentApplications(userId: string): Promise<any[]> {
    const supabase = await createServerSupabaseClient();
    
    // First get the student's ID from their auth reference
    const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', userId)
        .single();
        
    if (!student) return [];

    const { data } = await supabase
        .from('placement_applications')
        .select('*, placement_opportunities(*)')
        .eq('student_id', student.id)
        .order('applied_at', { ascending: false });

    if (!data) return [];

    return data.map((app: any) => ({
        id: app.id,
        opportunityId: app.opportunity_id,
        opportunityType: app.placement_opportunities?.type || 'placement',
        company: app.placement_opportunities?.company_name,
        role: app.placement_opportunities?.role_title,
        status: app.status === 'applied' ? 'Applied' :
                app.status === 'shortlisted' ? 'Shortlisted' :
                app.status === 'selected' ? 'Offer Extended' :
                app.status === 'rejected' ? 'Rejected' : app.status,
        appliedAt: app.applied_at
    }));
}
