'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import type { ActionResult } from '@/lib/types';

export interface AdminMarksRecord {
    id: string;
    studentId: string;
    studentName: string;
    collegeId?: string;
    marks?: string | number;
    status?: string;
    program?: string;
    branch?: string;
    year?: number | string;
    semester?: number;
    courseCode?: string;
    courseName?: string;
    internals?: number | null;
    externals?: number | null;
    total?: number | null;
    grade?: string | null;
}

export async function getMarksRecords(program?: string, branch?: string, semester?: number, section?: string, courseId?: string, examType?: string): Promise<{ success: boolean; data?: AdminMarksRecord[]; error?: string }> {
    const supabase = await createServerSupabaseClient();
    
    if (!program || !branch || !semester || !section || !courseId || !examType) {
        return { success: true, data: [] };
    }

    const { data: classRec } = await supabase.from('classes').select('id, course_id').eq('semester', semester).eq('section', section).limit(1);
    const { data: studentsList } = await supabase.from('students').select('*, profiles(*)').eq('program', program).eq('branch', branch).eq('current_semester', semester);
    
    if (!studentsList) return { success: true, data: [] };
    
    let dbCourseId = courseId;
    if (!courseId.includes('-')) {
        const { data: c } = await supabase.from('courses').select('id').eq('code', courseId).single();
        if (c) dbCourseId = c.id;
    }
    
    const { data: exam } = await supabase.from('exams').select('id').eq('course_id', dbCourseId).eq('exam_type', examType).single();
    
    let existingMarks: any[] = [];
    if (exam) {
        const { data: m } = await supabase.from('exam_marks').select('*').eq('exam_id', exam.id);
        if (m) existingMarks = m;
    }

    const results = studentsList.map((s: any) => {
        const matchingMark = existingMarks.find(em => em.student_id === s.id);
        return {
            id: matchingMark ? matchingMark.id : 'temp-' + s.id,
            studentId: s.id,
            studentName: s.profiles?.full_name || 'Unknown',
            collegeId: s.college_id,
            marks: matchingMark ? matchingMark.marks_obtained : '',
            status: matchingMark ? matchingMark.status : 'Present',
            program: s.program,
            branch: s.branch,
            year: s.current_year,
            semester: s.current_semester,
            courseCode: courseId,
            courseName: 'Course',
            internals: null,
            externals: matchingMark ? matchingMark.marks_obtained : null,
            total: matchingMark ? matchingMark.marks_obtained : null,
            grade: null
        };
    });
    return { success: true, data: results };
}

export async function saveAllMarksForClass(program: string, branch: string, semester: number, section: string, courseId: string, examType: string, records: AdminMarksRecord[]): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    
    let dbCourseId = courseId;
    if (!courseId.includes('-')) {
        const { data: c } = await supabase.from('courses').select('id').eq('code', courseId).single();
        if (c) dbCourseId = c.id;
    }

    let { data: exam } = await supabase.from('exams').select('id').eq('course_id', dbCourseId).eq('exam_type', examType).single();
    
    if (!exam) {
        const { data: newExam, error: examErr } = await supabase.from('exams').insert({
            course_id: dbCourseId,
            academic_year: new Date().getFullYear().toString(),
            semester: semester,
            exam_type: examType
        }).select('id').single();
        
        if (examErr || !newExam) return { success: false, error: 'Failed to create exam record. ' + examErr?.message };
        exam = newExam;
    }

    const { error: delErr } = await supabase.from('exam_marks').delete().eq('exam_id', exam.id);

    const inserts = records.map(r => ({
        exam_id: exam.id,
        student_id: r.studentId,
        marks_obtained: r.status === 'Present' && r.marks !== '' ? Number(r.marks) : null,
        status: r.status
    }));

    const { error: insErr } = await supabase.from('exam_marks').insert(inserts);

    if (insErr) {
        return { success: false, error: insErr.message };
    }

    return { success: true, message: 'Marks successfully saved.' };
}

export async function saveAdminMarksUpdates(payload: any[]): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    for (const p of payload) {
        if (!p.recordId.startsWith('temp-')) {
            await supabase.from('exam_marks').update({
                marks_obtained: p.marks.totalMarks || p.marks.externalsMarks || 0,
            }).eq('id', p.recordId);
        }
    }
    return { success: true, message: 'Marks successfully saved.' };
}

// ── Teacher Marks API ──────────────────────────────────────────────────────────

export interface MarksRecord {
    recordId: string;
    studentId: string;
    studentName: string;
    classId: string;
    ia1: number | null;
    ia2: number | null;
    other: number | null;
    see: number | null;
    total: number | null;
    grade: string | null;
}

export async function getMarksForClass(classId: string): Promise<MarksRecord[]> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from('marks')
        .select('*, students(college_id, profiles(full_name))')
        .eq('class_id', classId);

    if (error || !data) return [];

    return (data as any[]).map(m => ({
        recordId: m.id,
        studentId: m.student_id,
        studentName: m.students?.profiles?.full_name || 'Unknown',
        classId: m.class_id,
        ia1: m.ia1 ?? null,
        ia2: m.ia2 ?? null,
        other: m.other ?? null,
        see: m.see ?? null,
        total: m.total ?? null,
        grade: m.grade ?? null,
    }));
}

export async function saveMarksBatch(records: MarksRecord[]): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();

    const upserts = records.map(r => ({
        id: r.recordId?.startsWith('temp') ? undefined : r.recordId || undefined,
        student_id: r.studentId,
        class_id: r.classId,
        ia1: r.ia1,
        ia2: r.ia2,
        other: r.other,
        see: r.see,
        total: r.total,
        grade: r.grade,
    }));

    const { error } = await supabase.from('marks').upsert(upserts, { onConflict: 'student_id,class_id' });
    if (error) return { success: false, error: error.message };
    return { success: true, message: `Saved marks for ${records.length} students.` };
}

export async function calculateFinalMarks(classId: string, studentIds: string[]): Promise<{ success: boolean; data?: { studentId: string; total: number; grade: string }[]; error?: string }> {
    const supabase = await createServerSupabaseClient();

    const { data: marks, error } = await supabase
        .from('marks')
        .select('student_id, ia1, ia2, see')
        .eq('class_id', classId)
        .in('student_id', studentIds);

    if (error) return { success: false, error: error.message };

    const results = (marks || []).map((m: any) => {
        const ia1 = (m.ia1 ?? 0) / 2; // 40 -> 20
        const ia2 = (m.ia2 ?? 0) / 2; // 40 -> 20
        const see60 = ((m.see ?? 0) / 100) * 60; // 100 -> 60
        const total = Math.round(ia1 + ia2 + see60);

        let grade = 'F';
        if (total >= 90) grade = 'O';
        else if (total >= 80) grade = 'A+';
        else if (total >= 70) grade = 'A';
        else if (total >= 60) grade = 'B+';
        else if (total >= 55) grade = 'B';
        else if (total >= 50) grade = 'C+';
        else if (total >= 45) grade = 'C';
        else if (total >= 40) grade = 'P';

        return { studentId: m.student_id, total, grade };
    });

    return { success: true, data: results };
}

// ── Student Marks Display API ─────────────────────────────────────────────────

export interface CourseMark {
    code: string;
    name: string;
    credits: number;
    ia1: number | null;
    ia2: number | null;
    other: number | null;
    externals: number | null;  // SEE renamed for UI compat
    total: number | null;
    grade: string | null;
}

export interface SemesterMarksData {
    semester: number;
    academicYear?: string;
    courses: CourseMark[];
    gpa?: number | null;
}

export async function getStudentMarksForDisplay(studentId: string): Promise<SemesterMarksData[]> {
    const supabase = await createServerSupabaseClient();

    // Get student info for class lookup
    const { data: student } = await supabase
        .from('students')
        .select('current_semester, program, branch')
        .eq('id', studentId)
        .single();

    if (!student) return [];

    // Get all marks for student through class relation
    const { data: marksData, error } = await supabase
        .from('marks')
        .select('*, classes(semester, courses(code, name, credits))')
        .eq('student_id', studentId);

    if (error || !marksData) return [];

    // Group by semester
    const semesterMap: Record<number, SemesterMarksData> = {};

    for (const m of marksData as any[]) {
        const semester = m.classes?.semester || 1;
        if (!semesterMap[semester]) {
            semesterMap[semester] = { semester, courses: [] };
        }
        semesterMap[semester].courses.push({
            code: m.classes?.courses?.code || '',
            name: m.classes?.courses?.name || 'Unknown Course',
            credits: m.classes?.courses?.credits || 0,
            ia1: m.ia1 ?? null,
            ia2: m.ia2 ?? null,
            other: m.other ?? null,
            externals: m.see ?? null,
            total: m.total ?? null,
            grade: m.grade ?? null,
        });
    }

    return Object.values(semesterMap).sort((a, b) => a.semester - b.semester);
}
