'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import type { ActionResult, ScheduleEntry } from '@/lib/types';

export interface TimetableFilters {
    programs: string[];
    branches: Record<string, string[]>;
    years: number[];
    semesters: number[];
    sections: Record<string, string[]>;
}



export interface TeacherSchedule {
    teacher: { id: string; name: string };
    schedule: ScheduleEntry[];
}

export interface FullSchedule {
    studentSchedule: ScheduleEntry[];
    teacherSchedules: TeacherSchedule[];
    availableCourses: { courseId: string; courseName: string; teacherId: string; teacherName: string; }[];
}

export async function getTimetableFilters(): Promise<TimetableFilters> {
    const supabase = await createServerSupabaseClient();
    
    const { data: classes } = await supabase.from('classes').select('*, courses(program, branch)');
    
    const filters: TimetableFilters = {
        programs: ['B.Tech', 'MBA', 'Law', 'MBBS', 'B.Sc', 'B.Com'],
        branches: {
            "B.Tech": ["CSE", "ECE", "MECH", "IT", "AI&ML", "DS", "CIVIL", "Other"],
            "MBA": ["Marketing", "Finance", "HR", "Operations", "General", "Other"]
        },
        years: [1, 2, 3, 4],
        semesters: [1, 2, 3, 4, 5, 6, 7, 8],
        sections: {
            "B.Tech": ["A", "B", "C"],
            "MBA": ["A", "B"]
        }
    };
    
    return filters;
}

export async function getScheduleForClass(selected: any): Promise<FullSchedule> {
    const supabase = await createServerSupabaseClient();
    const { program, branch, semester, section } = selected;
    
    const { data: classList } = await supabase.from('classes')
        .select('*, courses(*), teachers(profile_id, profiles(full_name))')
        .eq('semester', semester)
        .eq('section', section);
        
    // In our normalized schema, we map periods into the 'start_time' column as '0P:00:00'
    const studentSchedule: ScheduleEntry[] = [];
    const teacherSchedulesMap = new Map<string, TeacherSchedule>();
    const availableCourses: any[] = [];
    
    if (classList && classList.length > 0) {
        for (const c of classList) {
            // Only consider classes that match the program/branch for the mapped course
            if (c.courses.program !== program || c.courses.branch !== branch) continue;
            
            const teacherId = c.teachers?.profile_id || 'unassigned';
            const teacherName = c.teachers?.profiles?.full_name || 'Unassigned';
            
            availableCourses.push({
                courseId: c.courses.code,
                courseName: c.courses.name,
                teacherId: teacherId,
                teacherName: teacherName
            });
            
            const { data: timetables } = await supabase.from('timetables').select('*').eq('class_id', c.id);
            if (timetables) {
                timetables.forEach((t: any) => {
                    let period = 1;
                    if (t.start_time) {
                        period = parseInt(t.start_time.split(':')[0], 10);
                    }
                    
                    const entry: ScheduleEntry = {
                        id: t.id,
                        classId: c.id,
                        courseId: c.courses.code,
                        teacherId: teacherId,
                        day: t.day_of_week,
                        period,
                        courseCode: c.courses.code,
                        courseName: c.courses.name,
                        teacherName: teacherName,
                        class: `${program} ${branch} ${section}`
                    };
                    
                    studentSchedule.push(entry);
                    
                    if (!teacherSchedulesMap.has(teacherId)) {
                        teacherSchedulesMap.set(teacherId, { teacher: { id: teacherId, name: teacherName }, schedule: [] });
                    }
                    teacherSchedulesMap.get(teacherId)!.schedule.push(entry);
                });
            }
        }
    }

    return {
        studentSchedule,
        teacherSchedules: Array.from(teacherSchedulesMap.values()),
        availableCourses
    };
}

export async function saveTimetableBulk(payload: any): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    const { program, branch, semester, section, slots } = payload;
    
    // First retrieve the relevant class records
    const { data: classList, error: pullErr } = await supabase.from('classes')
        .select('*, courses(*)')
        .eq('semester', semester)
        .eq('section', section);
        
    if (pullErr) return { success: false, error: 'Could not resolve classes.' };
    
    const validClassIds = (classList || [])
        .filter(c => c.courses && c.courses.program === program && c.courses.branch === branch)
        .map(c => c.id);
        
    if (validClassIds.length > 0) {
        // Clear old timetable entries for these classes
        await supabase.from('timetables').delete().in('class_id', validClassIds);
    }
    
    for (const slot of slots) {
        // Find the specific class ID for this course
        const targetClass = classList?.find(c => c.courses?.code === slot.courseId);
        if (targetClass) {
            await supabase.from('timetables').insert({
                class_id: targetClass.id,
                day_of_week: slot.day,
                start_time: `0${slot.period}:00:00`,
                end_time: `0${slot.period}:50:00`
            });
        }
    }
    
    return { success: true, message: 'Timetable saved.' };
}
