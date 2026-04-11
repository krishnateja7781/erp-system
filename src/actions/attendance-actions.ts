'use server';

import { createServiceRoleClient as createServerSupabaseClient } from '@/lib/supabase';
import type { ActionResult } from '@/lib/types';

export interface StudentAttendanceRow {
    studentId: string;
    studentName: string;
    collegeId: string;
    totalClasses: number;
    presentClasses: number;
    absentClasses: number;
    percentage: number;
}

export interface AggregatedData {
    duplicateCount: number;
    incompleteCount: number;
    totalRecords: number;
    overall: any;
    byProgram: any;
}

export interface CsvAttendanceRow {
    StudentId?: string;
    studentId?: string;
    Date?: string;
    date?: string;
    Status?: string;
    status?: string;
    classId?: string;
    class_id?: string;
    period?: number;
    [key: string]: any;
}

export async function getStudentAttendanceRecords(program?: string, branch?: string, semester?: number, section?: string, courseId?: string, startDate?: string, endDate?: string): Promise<StudentAttendanceRow[]> {
    const supabase = await createServerSupabaseClient();
    
    const { data: cData } = await supabase.from('classes').select('id, course_id').eq('semester', semester).eq('section', section).limit(1);
    const { data: studentsList } = await supabase.from('students').select('*, profiles(*)').eq('program', program).eq('branch', branch).eq('current_semester', semester);
    
    if (!studentsList) return [];
    
    let query = supabase.from('attendance').select('*');
    if (cData && cData.length > 0) {
        query = query.eq('class_id', cData[0].id);
    }
    
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    
    const { data: attendanceRecs } = await query;
    
    return studentsList.map((s: any) => {
        const studAtts = (attendanceRecs || []).filter((a: any) => a.student_id === s.id);
        const total = studAtts.length;
        const present = studAtts.filter((a: any) => a.status === 'present').length;
        return {
            studentId: s.id,
            studentName: s.profiles?.full_name || 'Unknown',
            collegeId: s.college_id,
            totalClasses: total,
            presentClasses: present,
            absentClasses: total - present,
            percentage: total > 0 ? Math.round((present / total) * 100) : 0
        };
    });
}

export async function getAggregatedAttendance(program?: string, branch?: string, semester?: number, section?: string, courseId?: string): Promise<{ success: boolean; data?: AggregatedData; error?: string }> {
    return {
        success: true,
        data: {
            duplicateCount: 0,
            incompleteCount: 0,
            totalRecords: 0,
            overall: { percentage: 0, totalClasses: 0, totalPresent: 0 },
            byProgram: {}
        }
    };
}

export async function uploadAttendanceCsv(records: CsvAttendanceRow[]): Promise<{success: boolean; message?: string; error?: string; savedCount: number; skippedCount: number; errors: any[]}> {
    const supabase = await createServerSupabaseClient();
    
    let dbClassId = '';
    
    const inserts = [];
    for (const rec of records) {
        if (!rec.StudentId || !rec.Date || !rec.Status) continue;
        const { data: targetStud } = await supabase.from('students').select('id').eq('college_id', rec.StudentId).limit(1);
        if (targetStud && targetStud.length > 0) {
            inserts.push({
                class_id: dbClassId,
                student_id: targetStud[0].id,
                date: rec.Date,
                status: rec.Status.toLowerCase() === 'p' || rec.Status.toLowerCase() === 'present' ? 'present' : 'absent'
            });
        }
    }
    
    if (inserts.length > 0) {
        const { error } = await supabase.from('attendance').insert(inserts);
        if (error) return { success: false, savedCount: 0, skippedCount: records.length, errors: [error.message], error: error.message };
    }
    
    return { success: true, message: `Successfully appended ${inserts.length} CSV attendance records.`, savedCount: inserts.length, skippedCount: records.length - inserts.length, errors: [] };
}

export async function getAttendanceForExport(filters?: any): Promise<{ success: boolean; rows?: any[]; error?: string }> {
    const data = await getStudentAttendanceRecords(filters?.program, filters?.branch, filters?.year, filters?.section, filters?.course);
    
    if (!data) return { success: true, rows: [] };
    
    return {
        success: true,
        rows: data.map(d => ({
        "Student Name": d.studentName,
        "College ID": d.collegeId,
        "Total Classes": d.totalClasses,
        "Present": d.presentClasses,
        "Absent": d.absentClasses,
        "Percentage": `${d.percentage}%`
    }))
    };
}

export interface SaveAttendancePayload {
    classId: string;
    teacherId: string;
    date: string;
    period: number;
    courseCode: string;
    courseName: string;
    studentRecords: { studentId: string; status: 'Present' | 'Absent' }[];
}

export async function saveAttendance(payload: SaveAttendancePayload): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();

    const { classId, teacherId, date, period, studentRecords } = payload;

    if (!studentRecords || studentRecords.length === 0) {
        return { success: false, error: 'No student records to save.' };
    }

    // Upsert each record - delete then insert for clean state
    const { error: delErr } = await supabase
        .from('attendance')
        .delete()
        .eq('class_id', classId)
        .eq('date', date)
        .eq('period', period);

    const inserts = studentRecords.map(r => ({
        class_id: classId,
        student_id: r.studentId,
        teacher_id: teacherId,
        date: date,
        period: period,
        status: r.status === 'Present' ? 'Present' : 'Absent',
    }));

    const { error: insErr } = await supabase.from('attendance').insert(inserts);

    if (insErr) return { success: false, error: insErr.message };

    return { success: true, message: `Attendance saved for ${inserts.length} students.` };
}

