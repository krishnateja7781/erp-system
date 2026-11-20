'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole } from '@/lib/auth-guard';
import type { ActionResult, ScheduleEntry } from '@/lib/types';
import { periodFromStartTime, periodToTimes } from '@/lib/utils';
import { PROGRAMS, BRANCHES } from '@/lib/academic-codes';

const TIMETABLE_ADMINS = ['emp:exam_marks_management'] as const;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  availableCourses: { courseId: string; courseName: string; teacherId: string; teacherName: string }[];
}

const DEFAULT_FILTERS: TimetableFilters = {
  programs: [...PROGRAMS],
  branches: { ...BRANCHES },
  years: [1, 2, 3, 4, 5],
  semesters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  sections: Object.fromEntries(PROGRAMS.map((p) => [p, ['A', 'B', 'C']])),
};

/** Default program/branch/section catalogue, extended with anything that already exists in `classes`. */
export async function getTimetableFilters(): Promise<TimetableFilters> {
  await requireRole();
  const admin = await createServiceRoleClient();
  const { data } = await admin.from('classes').select('program, branch, section').limit(5000);

  const filters: TimetableFilters = JSON.parse(JSON.stringify(DEFAULT_FILTERS));
  for (const c of (data || []) as any[]) {
    if (!c.program) continue;
    if (!filters.programs.includes(c.program)) filters.programs.push(c.program);
    const br = (filters.branches[c.program] ??= []);
    if (c.branch && !br.includes(c.branch)) br.push(c.branch);
    const sec = (filters.sections[c.program] ??= []);
    if (c.section && !sec.includes(c.section)) sec.push(c.section);
  }
  return filters;
}

export async function getScheduleForClass(selected: { program: string; branch: string; semester: number | string; section: string }): Promise<FullSchedule> {
  await requireRole();
  const { program, branch, semester, section } = selected || ({} as any);
  const empty: FullSchedule = { studentSchedule: [], teacherSchedules: [], availableCourses: [] };
  if (!program || !branch || !semester || !section) return empty;

  const admin = await createServiceRoleClient();
  const { data: classList } = await admin
    .from('classes')
    .select('id, courses(code, name), teachers(profile_id, profiles(full_name)), timetables(id, day_of_week, start_time, room)')
    .eq('program', program)
    .eq('branch', branch)
    .eq('semester', Number(semester))
    .eq('section', section);

  const studentSchedule: ScheduleEntry[] = [];
  const teacherMap = new Map<string, TeacherSchedule>();
  const availableCourses: FullSchedule['availableCourses'] = [];

  for (const c of (classList || []) as any[]) {
    const teacherId = c.teachers?.profile_id || 'unassigned';
    const teacherName = c.teachers?.profiles?.full_name || 'Unassigned';
    availableCourses.push({ courseId: c.courses?.code, courseName: c.courses?.name, teacherId, teacherName });
    if (!teacherMap.has(teacherId)) teacherMap.set(teacherId, { teacher: { id: teacherId, name: teacherName }, schedule: [] });

    for (const t of c.timetables || []) {
      const entry: ScheduleEntry = {
        id: t.id,
        classId: c.id,
        courseId: c.courses?.code,
        teacherId,
        day: t.day_of_week,
        period: periodFromStartTime(t.start_time),
        room: t.room || undefined,
        courseCode: c.courses?.code,
        courseName: c.courses?.name,
        teacherName,
        class: `${program} ${branch} ${section}`,
      };
      studentSchedule.push(entry);
      teacherMap.get(teacherId)!.schedule.push(entry);
    }
  }
  return { studentSchedule, teacherSchedules: Array.from(teacherMap.values()), availableCourses };
}

/**
 * Replaces a section's weekly timetable in ONE transaction (`replace_section_timetable`):
 * either the whole new grid is stored or nothing changes. The function also rejects
 * a teacher being double-booked in another section at the same slot.
 */
export async function saveTimetableBulk(payload: {
  program: string;
  branch: string;
  semester: number | string;
  section: string;
  slots: { courseId?: string; day: string; period: number; room?: string }[];
}): Promise<ActionResult> {
  const auth = await authorize(...TIMETABLE_ADMINS);
  if (!auth.ok) return { success: false, error: auth.error };
  const { program, branch, semester, section, slots } = payload || ({} as any);
  if (!program || !branch || !semester || !section || !Array.isArray(slots)) return { success: false, error: 'Incomplete timetable payload.' };

  const admin = await createServiceRoleClient();
  const { data: classList, error: clsErr } = await admin
    .from('classes')
    .select('id, courses(code)')
    .eq('program', program)
    .eq('branch', branch)
    .eq('semester', Number(semester))
    .eq('section', section);
  if (clsErr) return { success: false, error: 'Could not resolve classes.' };

  const classByCode = new Map(((classList || []) as any[]).map((c) => [c.courses?.code, c.id]));
  const rows: any[] = [];
  const seen = new Set<string>();
  for (const slot of slots) {
    const classId = slot.courseId ? classByCode.get(slot.courseId) : undefined;
    if (!classId) continue;
    if (!DAYS.includes(slot.day)) return { success: false, error: `Invalid day "${slot.day}".` };
    const key = `${slot.day}|${slot.period}`;
    if (seen.has(key)) return { success: false, error: `Two courses are placed in ${slot.day} period ${slot.period}.` };
    seen.add(key);
    const { start, end } = periodToTimes(Number(slot.period));
    rows.push({ class_id: classId, day_of_week: slot.day, start_time: start, end_time: end, room: slot.room || null });
  }

  const { data, error } = await admin.rpc('replace_section_timetable', {
    p_class_ids: Array.from(classByCode.values()),
    p_rows: rows,
  });
  if (error) return { success: false, error: error.message };
  if (data && data.success === false) return { success: false, error: data.error };
  return { success: true, message: 'Timetable saved.' };
}
