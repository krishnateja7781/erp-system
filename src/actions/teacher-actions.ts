'use server';

import { createServiceRoleClient as createServerSupabaseClient } from '@/lib/supabase';
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

async function resolveTeacherId(supabase: any, profileId: string): Promise<string | null> {
    const { data } = await supabase.from('teachers').select('id').eq('profile_id', profileId).single();
    return data?.id || null;
}

// ── Get Teacher's Classes ──────────────────────────────────────────────────────

export async function getTeacherClasses(teacherProfileId: string) {
    const supabase = await createServerSupabaseClient();
    const dbTeacherId = await resolveTeacherId(supabase, teacherProfileId);
    if (!dbTeacherId) return [];

    const { data, error } = await supabase
        .from('classes')
        .select('id, program, branch, section, courses(id, name, code)')
        .eq('teacher_id', dbTeacherId);

    if (error || !data) return [];

    return data.map((c: any) => ({
        id: c.id,
        class: `${c.program || ''} ${c.branch || ''} ${c.section || ''}`.trim(),
        courseCode: c.courses?.code || '',
        courseName: c.courses?.name || '',
    }));
}

// ── Get Students for a Class ───────────────────────────────────────────────────

export async function getStudentsForClass(classId: string): Promise<StudentForClass[]> {
    const supabase = await createServerSupabaseClient();

    // 1. Fetch class details to know which students belong to it
    const { data: cls } = await supabase.from('classes').select('program, branch, semester, section').eq('id', classId).single();
    if (!cls) return [];

    // 2. Query students matching those class criteria
    const { data: studentRecords, error } = await supabase
        .from('students')
        .select('id, college_id, profiles(full_name, email)')
        .eq('program', cls.program)
        .eq('branch', cls.branch)
        .eq('current_semester', cls.semester)
        .eq('section', cls.section || 'A')
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
    const dbTeacherId = await resolveTeacherId(supabase, teacherProfileId);
    if (!dbTeacherId) return [];

    // Get all classes assigned to this teacher
    const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*, courses(name, code)')
        .eq('teacher_id', dbTeacherId);

    if (classesError || !classesData || classesData.length === 0) return [];
    
    const classIds = classesData.map(c => c.id);

    // Get timetables for those classes
    const { data: timetables, error: ttError } = await supabase
        .from('timetables')
        .select('*')
        .in('class_id', classIds);

    if (ttError || !timetables) return [];

    return timetables.map((entry: any) => {
        const cls: any = classesData.find((c: any) => c.id === entry.class_id);
        const className = `${cls?.program} ${cls?.branch} ${cls?.section}`;

        let periodVal = 1;
        if (entry.start_time) {
            periodVal = parseInt(entry.start_time.split(':')[0], 10);
        }

        return {
            id: entry.id,
            day: entry.day_of_week,
            period: periodVal,
            classId: entry.class_id,
            className: className,
            courseName: cls?.courses?.name,
            courseCode: cls?.courses?.code,
            teacherId: teacherProfileId
        };
    });
}

export async function getTeacherAttendanceLogs(teacherProfileId: string): Promise<AttendanceLogEntry[]> {
    const supabase = await createServerSupabaseClient();
    // In attendance schema, teacher_id actually points to the profile_id (originally marked_by_id)
    
    const { data, error } = await supabase
        .from('attendance')
        .select('class_id, date, period, classes(program, branch, section, courses(name, code))')
        .eq('teacher_id', teacherProfileId)
        .order('date', { ascending: false })
        .limit(100);

    if (error || !data) return [];

    // Group by class+date+period
    const grouped: Record<string, AttendanceLogEntry> = {};
    for (const row of data as any[]) {
        const key = `${row.class_id}_${row.date}_${row.period}`;
        if (!grouped[key]) {
            const clsData = row.classes || {};
            grouped[key] = {
                classId: row.class_id,
                date: row.date,
                period: row.period,
                courseName: clsData.courses?.name || '',
                courseCode: clsData.courses?.code || '',
                class: `${clsData.program || ''} ${clsData.branch || ''} ${clsData.section || ''}`.trim(),
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
    const dbTeacherId = await resolveTeacherId(supabase, teacherProfileId);
    if (!dbTeacherId) return [];

    const { data, error } = await supabase
        .from('classes')
        .select('courses(id, name, code)')
        .eq('teacher_id', dbTeacherId);

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
    const dbTeacherId = await resolveTeacherId(supabase, teacherProfileId);
    if (!dbTeacherId) return [];

    const { data, error } = await supabase
        .from('classes')
        .select('id, program, branch, section')
        .eq('teacher_id', dbTeacherId)
        .eq('course_id', courseId);

    if (error || !data) return [];
    return data.map((c: any) => ({ id: c.id, name: `${c.program || ''} ${c.branch || ''} ${c.section || ''}`.trim() }));
}

// ── Get Scheduled Exam Sessions ────────────────────────────────────────────────

export async function getTeacherScheduledSessions(teacherProfileId: string): Promise<TeacherScheduledSession[]> {
    const supabase = await createServerSupabaseClient();
    const dbTeacherId = await resolveTeacherId(supabase, teacherProfileId);
    if (!dbTeacherId) return [];

    const { data: clsData } = await supabase.from('classes').select('course_id').eq('teacher_id', dbTeacherId);
    if (!clsData || clsData.length === 0) return [];
    
    const courseIds = clsData.map(c => c.course_id);

    const { data, error } = await supabase
        .from('exams')
        .select('exam_type, exam_date')
        .in('course_id', courseIds)
        .order('exam_date');

    if (error || !data) return [];

    const seen = new Set<string>();
    const result: TeacherScheduledSession[] = [];
    for (const row of data as any[]) {
        const key = row.exam_type;
        if (!key) continue;
        
        if (!seen.has(key)) {
            seen.add(key);
            result.push({ name: key, startDate: row.exam_date || '', endDate: row.exam_date || '' });
        } else {
            // Update endDate if exam_date is later
            const existing = result.find(r => r.name === key);
            if (existing && row.exam_date && new Date(row.exam_date) > new Date(existing.endDate)) {
                existing.endDate = row.exam_date;
            }
        }
    }

    if (!seen.has('Others')) {
        result.push({ 
            name: 'Others', 
            startDate: new Date().toISOString(), 
            endDate: new Date().toISOString() 
        });
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

