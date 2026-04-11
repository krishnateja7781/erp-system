'use server';

import { createServiceRoleClient as createServerSupabaseClient } from '@/lib/supabase';
import type { Class, ActionResult } from '@/lib/types';

interface ClassPayload { program: string; branch: string; year: string | number; semester: number; courseId: string; section: string; teacherId: string; }

export async function createClass(payload: ClassPayload): Promise<ActionResult> {
    const { year, semester, courseId, section, teacherId } = payload;
    try {
        const supabase = await createServerSupabaseClient();
        
        let targetCourseId = courseId;
        if (!courseId.includes('-')) {
             const { data: cData } = await supabase.from('courses').select('id').eq('code', courseId).single();
             if (cData) targetCourseId = cData.id;
        }

        let targetTeacherId = teacherId;
        if (teacherId) {
             const { data: tData } = await supabase.from('teachers').select('id').eq('profile_id', teacherId).limit(1);
             if (tData && tData.length > 0) targetTeacherId = tData[0].id;
             else {
               const { data: tData2 } = await supabase.from('teachers').select('id').eq('id', teacherId).limit(1);
               if (tData2 && tData2.length > 0) targetTeacherId = tData2[0].id;
             }
        }
        
        // Fetch or create a default academic term to satisfy the foreign key non-null constraint
        const { data: termData } = await supabase.from('academic_terms').select('id').limit(1);
        let defaultTermId = termData?.[0]?.id;
        if (!defaultTermId) {
            const { data: newTerm } = await supabase.from('academic_terms').insert({
                name: 'Default Term',
                code: 'DT-' + new Date().getFullYear(),
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
            }).select('id').single();
            defaultTermId = newTerm?.id;
        }

        const { data: existing } = await supabase.from('classes')
            .select('id')
            .eq('course_id', targetCourseId)
            .eq('academic_year', year.toString())
            .eq('semester', semester)
            .eq('section', section);

        if (existing && existing.length > 0) {
            return { success: false, error: `A class for Course ID ${courseId} - Section ${section} already exists.` };
        }

        const { error } = await supabase.from('classes').insert({
            course_id: targetCourseId,
            academic_term_id: defaultTermId,
            teacher_id: targetTeacherId || null,
            section,
            program: payload.program,
            branch: payload.branch,
            year: parseInt(year.toString(), 10),
            academic_year: year.toString(),
            semester
        });

        if (error) return { success: false, error: error.message };

        return { success: true, message: `Successfully created class for Section ${section}.` };
    } catch (error: any) {
        return { success: false, error: error.message || 'An unexpected error occurred while creating the class.' };
    }
}

export async function getClassesWithDetails(): Promise<any[]> {
    try {
        const supabase = await createServerSupabaseClient();
        
        const { data: classesData, error } = await supabase.from('classes').select(`
            *,
            courses (code, name, program, branch, credits),
            teachers (profile_id, profiles (full_name))
        `);

        if (error || !classesData) return [];

        const uiClasses = classesData.map((c: any) => {
            return {
                id: c.id,
                program: c.courses?.program,
                branch: c.courses?.branch,
                year: c.academic_year,
                semester: c.semester,
                section: c.section,
                courseId: c.courses?.code,
                courseName: c.courses?.name || 'N/A',
                credits: c.courses?.credits || 0,
                teacherId: c.teachers?.profile_id,
                teacherName: c.teachers?.profiles?.full_name || 'N/A',
                studentCount: 0,
                classroomId: null,
            };
        }).sort((a: any, b: any) => {
            if (a.program !== b.program) return (a.program || '').localeCompare(b.program || '');
            if (a.branch !== b.branch) return (a.branch || '').localeCompare(b.branch || '');
            return (a.section || '').localeCompare(b.section || '');
        });

        const { data: students } = await supabase.from('students').select('program, branch, current_year, current_semester');
        if (students) {
           uiClasses.forEach(c => {
               const matchingStudents = students.filter(s => 
                   s.program === c.program && 
                   s.branch === c.branch && 
                   s.current_year.toString() === c.year && 
                   s.current_semester === c.semester
               );
               c.studentCount = matchingStudents.length;
           });
        }

        return uiClasses;
    } catch {
        throw new Error('Failed to load class data.');
    }
}

export async function updateTeacherForClass(classId: string, teacherId: string): Promise<ActionResult> {
    if (!classId || !teacherId) return { success: false, error: 'Class ID and Teacher ID are required.' };
    try {
        const supabase = await createServerSupabaseClient();
        
        let targetTeacherId = teacherId;
        const { data: tData } = await supabase.from('teachers').select('id').eq('profile_id', teacherId).limit(1);
        if (tData && tData.length > 0) targetTeacherId = tData[0].id;
        
        const { error } = await supabase.from('classes').update({ teacher_id: targetTeacherId }).eq('id', classId);
        if (error) return { success: false, error: error.message };
        
        return { success: true, message: 'Teacher successfully assigned to class.' };
    } catch {
        return { success: false, error: 'Failed to assign teacher.' };
    }
}

export async function deleteClass(classId: string): Promise<ActionResult> {
    if (!classId) return { success: false, error: 'Class ID is required.' };
    try {
        const supabase = await createServerSupabaseClient();
        const { error } = await supabase.from('classes').delete().eq('id', classId);
        if (error) return { success: false, error: error.message };
        return { success: true, message: 'Class deleted successfully.' };
    } catch {
        return { success: false, error: 'Failed to delete class.' };
    }
}

