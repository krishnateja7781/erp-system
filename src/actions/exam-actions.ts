'use server';

import { createServiceRoleClient as createServerSupabaseClient } from '@/lib/supabase';
import type { ActionResult } from '@/lib/types';

export async function getExamSchedules(): Promise<any[]> {
    const supabase = await createServerSupabaseClient();
    
    const { data, error } = await supabase.from('exams').select('*, courses(*)').order('exam_date', { ascending: false });
    if (error || !data) return [];
    
    return data.map((e: any) => ({
        id: e.id,
        courseId: e.courses?.code || e.course_id,
        courseName: e.courses?.name,
        program: e.courses?.program || e.program,
        branch: e.courses?.branch || e.branch,
        semester: e.semester,
        year: e.year,
        examType: e.exam_type,
        examSessionName: e.exam_type || e.exam_session_name || 'Exam',
        courseCode: e.courses?.code,
        date: e.exam_date,
        startTime: e.start_time,
        endTime: e.end_time,
        status: e.status || 'Scheduled',
        maxInternalMarks: e.max_internal_marks ?? null,
        maxExternalMarks: e.max_external_marks ?? null,
        credits: e.courses?.credits ?? null,
    }));
}

export async function deleteExamSchedule(examId: string): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('exams').delete().eq('id', examId);
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Exam schedule deleted successfully.' };
}

// ── Student-facing types ───────────────────────────────────────────────────────

export type ExamStatus = 'Upcoming' | 'Ongoing' | 'Completed';

export interface StudentExamScheduleEntry {
    id: string;
    examSessionName: string;
    courseName: string;
    courseCode: string;
    date: string;
    startTime: string;
    endTime: string;
    room: string;
    status: ExamStatus;
}

export interface HallTicketData {
    studentId: string;
    studentName: string;
    collegeId: string;
    program: string;
    branch: string;
    semester: number;
    examSessionName: string;
    exams: StudentExamScheduleEntry[];
    photoUrl?: string;
}

// ── Get Student Exam Schedules ─────────────────────────────────────────────────

export async function getStudentExamSchedules(program: string, branch: string): Promise<StudentExamScheduleEntry[]> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from('exams')
        .select('*, courses(name, code, program, branch, semester)')
        .eq('program', program)
        .eq('branch', branch)
        .order('exam_date', { ascending: true });

    if (error || !data) return [];

    const now = new Date();

    return (data as any[]).map(e => {
        const examDate = e.exam_date ? new Date(e.exam_date) : null;
        let status: ExamStatus = 'Upcoming';
        if (examDate) {
            if (examDate < now) status = 'Completed';
        }

        return {
            id: e.id,
            examSessionName: e.exam_type || 'Exam',
            courseName: e.courses?.name || 'Unknown Course',
            courseCode: e.courses?.code || '',
            date: e.exam_date || '',
            startTime: e.start_time || '',
            endTime: e.end_time || '',
            room: e.room || 'TBA',
            status,
        };
    });
}

// ── Get Hall Ticket for Student ────────────────────────────────────────────────

export async function getHallTicket(
    studentId: string,
    program: string,
    branch: string,
    semester: number,
    studentName: string,
    collegeId: string,
    photoUrl?: string
): Promise<{ success: boolean; data?: HallTicketData; error?: string }> {
    try {
        const exams = await getStudentExamSchedules(program, branch);

        if (!exams.length) {
            return { success: false, error: 'No upcoming exams found for your program.' };
        }

        return {
            success: true,
            data: {
                studentId,
                studentName,
                collegeId,
                program,
                branch,
                semester,
                examSessionName: exams.length > 0 ? exams[0].examSessionName : 'Exam Session',
                exams,
                photoUrl,
            }
        };
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to generate hall ticket.' };
    }
}

export async function getExamById(examId: string): Promise<any> { return null; }
export interface StudentEligibility { id: string; studentId: string; name: string; collegeId: string; section: string; attendancePercentage: number; feeBalance: number; isEligible: boolean; reasons: string[]; }
export async function getTeacherExamStudents(examId: string, teacherId: string): Promise<StudentEligibility[]> { return []; }
export async function getTeacherExams(teacherId: string): Promise<any[]> {
    const supabase = await createServerSupabaseClient();
    
    // Resolve the internal DB UUID for the teacher from their auth profile ID
    const { data: teacher } = await supabase.from('teachers').select('id').eq('profile_id', teacherId).single();
    if (!teacher) return [];
    
    // Fetch all courses assigned to this teacher via their classes
    const { data: clsData } = await supabase.from('classes').select('course_id').eq('teacher_id', teacher.id);
    if (!clsData || clsData.length === 0) return [];
    const courseIds = clsData.map(c => c.course_id);
    
    // Fetch exams for those courses
    const { data, error } = await supabase
        .from('exams')
        .select('*, courses(name, code)')
        .in('course_id', courseIds)
        .order('exam_date', { ascending: false });
        
    if (error || !data) return [];
    
    return data.map((e: any) => ({
        id: e.id,
        examSessionName: e.exam_type || 'Exam',
        courseName: e.courses?.name || 'Subject',
        courseCode: e.courses?.code || '',
        program: e.program,
        branch: e.branch,
        semester: e.semester,
        year: e.year,
        date: e.exam_date,
        startTime: e.start_time,
        endTime: e.end_time,
        status: e.status || 'Scheduled'
    }));
}
export async function scheduleExamsAndSetupHallTickets(config: { filters: any; exams: any[]; hallTicketData: any }): Promise<any> {
    const supabase = await createServerSupabaseClient();
    
    try {
        const inserts = [];
        for (const exam of config.exams) {
            // Locate the UUID for the course using its code
            const { data: c } = await supabase.from('courses').select('id').eq('code', exam.courseCode).single();
            if (c) {
                inserts.push({
                    course_id: c.id,
                    program: config.filters.program,
                    branch: config.filters.branch,
                    year: config.filters.year,
                    academic_year: new Date().getFullYear().toString(),
                    semester: config.filters.semester,
                    exam_type: config.hallTicketData.examSessionName,
                    exam_date: exam.date,
                    start_time: exam.startTime,
                    end_time: exam.endTime,
                    status: 'Scheduled'
                });
            }
        }
        
        if (inserts.length > 0) {
            const { error } = await supabase.from('exams').insert(inserts);
            if (error) return { success: false, error: error.message };
        }
        
        return { success: true, message: 'Exams scheduled successfully.' };
    } catch (err: any) {
        return { success: false, error: err.message || 'Failed to schedule exams' };
    }
}

export async function saveExamSchedule(examId: string, schedule: any[]): Promise<any> {
    const supabase = await createServerSupabaseClient();
    const updateData = schedule[0];
    const payload: any = {
        exam_date: updateData.date,
        start_time: updateData.startTime,
        end_time: updateData.endTime,
    };
    if (updateData.examSessionName) {
         payload.exam_type = updateData.examSessionName;
    }
    const { error } = await supabase.from('exams').update(payload).eq('id', examId);
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Schedule updated' };
}

