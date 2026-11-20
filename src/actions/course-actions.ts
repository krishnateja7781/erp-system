'use server';

import { createServiceRoleClient as createServerSupabaseClient } from '@/lib/supabase';
import { authorize, requireRole } from '@/lib/auth-guard';
import { fetchAllRows } from '@/lib/db';

const COURSE_ADMINS = ['emp:exam_marks_management'] as const;
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
    await requireRole();
    try {
        const supabase = await createServerSupabaseClient();
        const dbCourses = await fetchAllRows(() => supabase.from('courses').select('*').order('code'));

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
    const auth = await authorize(...COURSE_ADMINS);
    if (!auth.ok) return { success: false, error: auth.error };
    const { id, ...courseData } = payload;
    if (!courseData.courseName || !courseData.program || !courseData.branch || !courseData.semester || !courseData.credits) {
        return { success: false, error: 'Missing required fields.' };
    }

    const supabase = await createServerSupabaseClient();

    try {
        if (id) {
            const { error } = await supabase.from('courses').update({ 
              name: courseData.courseName,
              credits: courseData.credits
            }).eq('id', id);
            
            if (error) return { success: false, error: error.message };
            return { success: true, message: `Course updated successfully.` };
        } else {
            const { program, branch, semester } = courseData;
            // Code assigned by the courses_assign_code trigger (generate_course_code): PROGRAM(3)+SEM+BRANCH(2)+SEQ(3), e.g. ENG3CS001.
            const { data: created, error: insertErr } = await supabase.from('courses').insert({
              name: courseData.courseName,
              program,
              branch,
              semester,
              credits: courseData.credits
            }).select('code').single();
            if (insertErr) return { success: false, error: insertErr.message };
            const generatedCourseId = created.code;

            return { success: true, message: `Course ${generatedCourseId} created successfully.` };
        }
    } catch (error: any) {
        return { success: false, error: error.message || 'An unexpected server error occurred while saving the course.' };
    }
}

export async function deleteCourse(courseId: string): Promise<ActionResult> {
    const auth = await authorize(...COURSE_ADMINS);
    if (!auth.ok) return { success: false, error: auth.error };
    if (!courseId) return { success: false, error: 'Course ID is required.' };
    try {
        const supabase = await createServerSupabaseClient();
        
        const { data: classes } = await supabase.from('classes').select('id').eq('course_id', courseId).limit(1);
        if (classes && classes.length > 0) {
            return { success: false, error: 'Cannot delete course. It is assigned to one or more classes. Please unassign it first.' };
        }
        
        const { error } = await supabase.from('courses').delete().eq('id', courseId);
        if (error) {
            if (error.code === '23503') return { success: false, error: 'Cannot delete course. Exams have already been scheduled for it.' };
            return { success: false, error: error.message };
        }
        
        return { success: true, message: `Course deleted successfully.` };
    } catch {
        return { success: false, error: 'An unexpected error occurred while deleting the course.' };
    }
}

export async function getCoursesForSelection(program: string, branch: string, semester: number): Promise<CourseInfo[]> {
    await requireRole();
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
    await requireRole(...COURSE_ADMINS);
    try {
        const supabase = await createServerSupabaseClient();
        
        const [coursesRes, classesRes] = await Promise.all([
          supabase.from('courses').select('*').eq('program', program).eq('branch', branch).eq('semester', semester).order('code'),
          supabase.from('classes').select('course_id').eq('program', program).eq('branch', branch).eq('academic_year', year.toString()).eq('semester', semester).eq('section', section)
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

