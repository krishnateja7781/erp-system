'use server';

import { createServiceRoleClient as createServerSupabaseClient } from '@/lib/supabase';
import type { ActionResult } from '@/lib/types';
import { getSession } from './auth-actions';

export async function getEligibleStudentsForPromotion(program: string, branch: string, currentSemester: number) {
    const supabase = await createServerSupabaseClient();
    
    let query = supabase.from('students').select('*, profiles(full_name, email)')
      .eq('is_graduated', false)
      .order('college_id', { ascending: true });
      
    if (program) query = query.eq('program', program);
    if (branch) query = query.eq('branch', branch);
    if (currentSemester) query = query.eq('current_semester', currentSemester);
    
    const { data: students, error } = await query;
    if (error || !students) return [];
    
    return students.map((s: any) => ({
        id: s.id,
        collegeId: s.college_id,
        name: s.profiles?.full_name || 'Unknown',
        program: s.program,
        branch: s.branch,
        currentSemester: s.current_semester,
        type: s.is_hosteler ? 'Hosteler' : 'Day Scholar'
    }));
}

export async function promoteStudentsBatch(studentIds: string[], academicYear: string): Promise<ActionResult & { details?: any[] }> {
    const supabase = await createServerSupabaseClient();
    const session = await getSession();
    
    if (!session.data?.session?.user) return { success: false, error: 'Unauthorized.' };
    
    const currentUserId = session.data.session.user.id;
    const results = [];
    let successCount = 0;
    
    for (const studentId of studentIds) {
        try {
            const { data, error } = await supabase.rpc('promote_student', {
                p_student_id: studentId,
                p_promoted_by: currentUserId,
                p_academic_year: academicYear
            });
            
            if (error) {
                results.push({ studentId, success: false, error: error.message });
            } else if (data && !data.success) {
                results.push({ studentId, success: false, error: data.error, missingCourses: data.courses });
            } else {
                successCount++;
                results.push({ studentId, success: true, details: data });
            }
        } catch (e: any) {
             results.push({ studentId, success: false, error: e.message });
        }
    }
    
    if (successCount === 0) {
        return { success: false, error: `Failed to promote any students. Check details below.`, details: results };
    }
    
    return { success: true, message: `Successfully promoted ${successCount} out of ${studentIds.length} students.`, details: results };
}

