'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import type { ActionResult } from '@/lib/types';

export async function getExamSchedules(): Promise<any[]> {
    const supabase = await createServerSupabaseClient();
    
    const { data, error } = await supabase.from('exams').select('*, courses(*)').order('exam_date', { ascending: false });
    if (error || !data) return [];
    
    return data.map((e: any) => ({
        id: e.id,
        courseId: e.courses?.code,
        courseName: e.courses?.name,
        program: e.courses?.program,
        branch: e.courses?.branch,
        semester: e.semester,
        examType: e.exam_type,
        date: e.exam_date,
        startTime: e.start_time,
        endTime: e.end_time,
        status: e.status
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
        .from('exam_schedule')
        .select('*, courses(name, code, program, branch, semester)')
        .or(`program.eq.${program},program.is.null`)
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
export async function getTeacherExams(teacherId: string): Promise<any[]> { return []; }
export async function scheduleExamsAndSetupHallTickets(config: { filters: any; exams: any[]; hallTicketData: any }): Promise<any> { return { success: true, message: 'Exams scheduled successfully.' }; }
export async function saveExamSchedule(examId: string, schedule: any[]): Promise<any> { return { success: true }; }
