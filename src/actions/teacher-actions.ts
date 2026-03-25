'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { getSession } from './auth-actions';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StudentForClass {
    id: string;
    name: string;
    collegeId: string;
    email: string;
}

export interface TeacherCourseOption {
    id: string;
    name: string;
    code: string;
}

export interface TeacherSectionOption {
    id: string;
    name: string;
}

export interface AttendanceLogEntry {
    classId: string;
    date: string;
    period: number;
    courseName: string;
    courseCode: string;
    class: string;
    studentCount: number;
}

export interface TeacherScheduledSession {
    name: string;
    startDate: string;
    endDate: string;
}

// ── Internal Helper ────────────────────────────────────────────────────────────

async function getTeacherId(): Promise<string | null> {
    const result = await getSession();
    if (!result || result.error || !result.data?.session) return null;
    return result.data.session.user.id;
}

// ── Get Teacher's Classes ──────────────────────────────────────────────────────

export async function getTeacherClasses(teacherProfileId: string) {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from('classes')
        .select('id, name, courses(id, name, code)')
        .eq('teacher_id', teacherProfileId);

    if (error || !data) return [];

    return data.map((c: any) => ({
        id: c.id,
        class: c.name,
        courseCode: c.courses?.code || '',
        courseName: c.courses?.name || '',
    }));
}

// ── Get Students for a Class ───────────────────────────────────────────────────

export async function getStudentsForClass(classId: string): Promise<StudentForClass[]> {
    const supabase = await createServerSupabaseClient();

    const { data: studentRecords, error } = await supabase
        .from('students')
        .select('id, college_id, profiles(full_name, email)')
        .eq('class_id', classId)
        .eq('is_graduated', false)
        .order('college_id');

    if (error || !studentRecords) return [];

    return studentRecords.map((s: any) => ({
        id: s.id,
        name: s.profiles?.full_name || 'Unknown',
        collegeId: s.college_id,
        email: s.profiles?.email || '',
    }));
}

// ── Get Teacher's Schedule ─────────────────────────────────────────────────────

export async function getTeacherSchedule(teacherProfileId: string) {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from('timetable')
        .select('id, day, period, classes(id, name, courses(name, code))')
        .eq('teacher_id', teacherProfileId);

    if (error || !data) return [];

    return data.map((entry: any) => ({
        id: entry.id,
        day: entry.day,
        period: entry.period,
        classId: entry.classes?.id,
        className: entry.classes?.name,
        courseName: entry.classes?.courses?.name,
        courseCode: entry.classes?.courses?.code,
    }));
}

// ── Get Attendance Logs for Teacher ───────────────────────────────────────────

export async function getTeacherAttendanceLogs(teacherProfileId: string): Promise<AttendanceLogEntry[]> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from('attendance')
        .select('class_id, date, period, classes(name, courses(name, code))')
        .eq('teacher_id', teacherProfileId)
        .order('date', { ascending: false })
        .limit(100);

    if (error || !data) return [];

    // Group by class+date+period
    const grouped: Record<string, AttendanceLogEntry> = {};
    for (const row of data as any[]) {
        const key = `${row.class_id}_${row.date}_${row.period}`;
        if (!grouped[key]) {
            grouped[key] = {
                classId: row.class_id,
                date: row.date,
                period: row.period,
                courseName: row.classes?.courses?.name || '',
                courseCode: row.classes?.courses?.code || '',
                class: row.classes?.name || '',
                studentCount: 0,
            };
        }
        grouped[key].studentCount++;
    }

    return Object.values(grouped);
}

// ── Get Attendance for specific Slot ──────────────────────────────────────────

export async function getAttendanceForSlot(classId: string, date: string, period: number): Promise<Record<string, 'Present' | 'Absent'>> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('class_id', classId)
        .eq('date', date)
        .eq('period', period);

    if (error || !data) return {};

    const result: Record<string, 'Present' | 'Absent'> = {};
    for (const row of data as any[]) {
        result[row.student_id] = row.status;
    }
    return result;
}

// ── Get Courses for Marks Entry ────────────────────────────────────────────────

export async function getTeacherCoursesForMarks(teacherProfileId: string, session: string): Promise<TeacherCourseOption[]> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from('classes')
        .select('courses(id, name, code)')
        .eq('teacher_id', teacherProfileId);

    if (error || !data) return [];

    const seen = new Set<string>();
    const result: TeacherCourseOption[] = [];
    for (const c of data as any[]) {
        const course = Array.isArray(c.courses) ? c.courses[0] : c.courses;
        if (course && !seen.has(course.id)) {
            seen.add(course.id);
            result.push({ id: course.id, name: course.name, code: course.code });
        }
    }
    return result;
}

// ── Get Sections for a Course ──────────────────────────────────────────────────

export async function getTeacherSectionsForCourse(teacherProfileId: string, courseId: string): Promise<TeacherSectionOption[]> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('teacher_id', teacherProfileId)
        .eq('course_id', courseId);

    if (error || !data) return [];
    return data.map((c: any) => ({ id: c.id, name: c.name }));
}

// ── Get Scheduled Exam Sessions ────────────────────────────────────────────────

export async function getTeacherScheduledSessions(teacherProfileId: string): Promise<TeacherScheduledSession[]> {
    const supabase = await createServerSupabaseClient();

    const teacherClasses = await getTeacherClasses(teacherProfileId);
    if (!teacherClasses.length) return [];

    const classIds = teacherClasses.map(c => c.id);

    const { data, error } = await supabase
        .from('exam_schedule')
        .select('exam_type, start_date, end_date')
        .in('class_id', classIds)
        .order('start_date');

    if (error || !data) return [];

    const seen = new Set<string>();
    const result: TeacherScheduledSession[] = [];
    for (const row of data as any[]) {
        const key = row.exam_type;
        if (!seen.has(key)) {
            seen.add(key);
            result.push({ name: row.exam_type, startDate: row.start_date, endDate: row.end_date });
        }
    }
    return result;
}

// ── Server-side safe teacherId getter (for pages) ─────────────────────────────

export async function getMyTeacherId(): Promise<string | null> {
    return getTeacherId();
}

export interface TeacherClassWithStudents {
    classInfo: { id: string; courseCode: string; courseName: string; class: string; };
    students: any[];
}
export async function getStudentsByClassForTeacher(teacherProfileId: string): Promise<TeacherClassWithStudents[]> { return []; }
