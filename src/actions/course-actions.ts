'use server';

import { createServiceRoleClient as createServerSupabaseClient } from '@/lib/supabase';
import { getProgramCode, getBranchCode } from '@/lib/utils';
import type { ActionResult } from '@/lib/types';

export interface Course {
    id: string;
    courseId: string;
    courseName: string;
    program: string;
    branch: string;
    semester: number;
    credits: number;
}

export interface CoursePayload { id?: string; courseName: string; program: string; branch: string; semester: number; credits: number; }
export interface CourseInfo { id: string, courseId: string; courseName: string; program: string; branch: string; semester: number; credits: number; }

export interface GroupedCourses {
    [program: string]: { [branch: string]: { [semester: number]: Course[] } };
}

function mapToUiCourse(row: any): Course {
  return {
    id: row.id,
    courseId: row.code,
    courseName: row.name,
    program: row.program,
    branch: row.branch,
    semester: row.semester,
    credits: row.credits
  };
}

export async function getGroupedCourses(): Promise<GroupedCourses> {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: dbCourses, error } = await supabase.from('courses').select('*').order('code');
        if (error || !dbCourses) return {};

        const courses = dbCourses.map(mapToUiCourse);

        const grouped: GroupedCourses = {};
        courses.forEach((course) => {
            const { program, branch, semester } = course;
            if (!grouped[program]) grouped[program] = {};
            if (!grouped[program][branch]) grouped[program][branch] = {};
            if (!grouped[program][branch][semester]) grouped[program][branch][semester] = [];
            grouped[program][branch][semester].push(course);
        });
        return grouped;
    } catch (error: any) {
        throw new Error('Failed to fetch and process course data from the server.');
    }
}

export async function saveCourse(payload: CoursePayload): Promise<ActionResult> {
    const { id, ...courseData } = payload;
    if (!courseData.courseName || !courseData.program || !courseData.branch || !courseData.semester || !courseData.credits) {
        return { success: false, error: 'Missing required fields.' };
    }

    const supabase = await createServerSupabaseClient();

    try {
        if (id) {
            const { error } = await supabase.from('courses').update({ 
              name: courseData.courseName, 
              title: courseData.courseName,
              credits: courseData.credits 
            }).eq('id', id);
            
            if (error) return { success: false, error: error.message };
            return { success: true, message: `Course updated successfully.` };
        } else {
            const { program, branch, semester } = courseData;
            const { data: existing } = await supabase.from('courses')
                .select('code')
                .eq('program', program)
                .eq('branch', branch)
                .eq('semester', semester);
                
            const existingSerials = new Set<number>();
            existing?.forEach((c: any) => {
                const match = c.code?.match(/\d+$/);
                if (match) existingSerials.add(parseInt(match[0], 10));
            });
            let newSequence = 1;
            while (existingSerials.has(newSequence)) newSequence++;

            const programCode = getProgramCode(program);
            const branchCode = getBranchCode(branch, program);
            const generatedCourseId = `${programCode}${semester}${branchCode}${newSequence.toString().padStart(3, '0')}`;

            const { error: insertErr } = await supabase.from('courses').insert({ 
              code: generatedCourseId, 
              name: courseData.courseName, 
              title: courseData.courseName,
              program, 
              branch, 
              semester, 
              credits: courseData.credits 
            });
            
            if (insertErr) return { success: false, error: insertErr.message };

            return { success: true, message: `Course ${generatedCourseId} created successfully.` };
        }
    } catch (error: any) {
        return { success: false, error: error.message || 'An unexpected server error occurred while saving the course.' };
    }
}

export async function deleteCourse(courseId: string): Promise<ActionResult> {
    if (!courseId) return { success: false, error: 'Course ID is required.' };
    try {
        const supabase = await createServerSupabaseClient();
        
        const { data: classes } = await supabase.from('classes').select('id').eq('course_id', courseId).limit(1);
        if (classes && classes.length > 0) {
            return { success: false, error: 'Cannot delete course. It is assigned to one or more classes. Please unassign it first.' };
        }
        
        const { error } = await supabase.from('courses').delete().eq('id', courseId);
        if (error) return { success: false, error: error.message };
        
        return { success: true, message: `Course deleted successfully.` };
    } catch {
        return { success: false, error: 'An unexpected error occurred while deleting the course.' };
    }
}

export async function getCoursesForSelection(program: string, branch: string, semester: number): Promise<CourseInfo[]> {
    try {
        const supabase = await createServerSupabaseClient();
        const { data } = await supabase.from('courses')
            .select('*')
            .eq('program', program)
            .eq('branch', branch)
            .eq('semester', semester)
            .order('code');
            
        if (!data) return [];
        
        return data.map(c => ({
          id: c.id,
          courseId: c.code,
          courseName: `${c.code} - ${c.name}`,
          program: c.program,
          branch: c.branch,
          semester: c.semester,
          credits: c.credits || 0
        }));
    } catch {
        throw new Error('Failed to fetch courses.');
    }
}

export async function getUnassignedCoursesForSection(program: string, branch: string, year: string | number, semester: number, section: string): Promise<CourseInfo[]> {
    try {
        const supabase = await createServerSupabaseClient();
        
        const [coursesRes, classesRes] = await Promise.all([
          supabase.from('courses').select('*').eq('program', program).eq('branch', branch).eq('semester', semester).order('code'),
          supabase.from('classes').select('course_id').eq('academic_year', year.toString()).eq('semester', semester).eq('section', section)
        ]);
        
        if (!coursesRes.data) return [];
        
        const assignedCourseIds = new Set((classesRes.data || []).map(c => c.course_id));
        
        return coursesRes.data
            .filter(c => !assignedCourseIds.has(c.id))
            .map(c => ({
                id: c.id,
                courseId: c.code,
                courseName: `${c.code} - ${c.name}`,
                program: c.program,
                branch: c.branch,
                semester: c.semester,
                credits: c.credits || 0
            }));
    } catch {
        throw new Error('Failed to fetch unassigned courses.');
    }
}

