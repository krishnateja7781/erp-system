// ============================================================
// Teacher Service Layer — Controlled, filtered data access
// NEVER returns raw DB objects. ALL queries filtered by teacher ID.
// ============================================================

import { readCollection, findOneWhere, findWhere } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

// ── Helpers ──

function getTodayDayName(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
}

function getTomorrowDayName(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  now.setDate(now.getDate() + 1);
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
}

function todayISO(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function resolveTeacher(teacherUid: string, extraIds?: { staffDocId?: string | null; email?: string | null }) {
  let teacher = await findOneWhere<any>('teachers', (t) => t.user_uid === teacherUid || t.id === teacherUid);
  if (!teacher && extraIds?.staffDocId && extraIds.staffDocId !== teacherUid) {
    teacher = await findOneWhere<any>('teachers', (t) => t.id === extraIds.staffDocId || t.staffId === extraIds.staffDocId);
  }
  if (!teacher && extraIds?.email) {
    teacher = await findOneWhere<any>('teachers', (t) => t.email === extraIds.email);
  }
  return teacher;
}

// ── Service Functions ──

/**
 * Get teacher's schedule for today/tomorrow.
 * Returns ONLY [ { period, courseName, className } ].
 */
export async function getTeacherSchedule(teacherUid: string, when: 'today' | 'tomorrow' = 'today', extraIds?: { staffDocId?: string | null; email?: string | null }) {
  const teacher = await resolveTeacher(teacherUid, extraIds);
  if (!teacher) return { classes: [], day: '', status: 'no_teacher' };

  const resolvedUid = teacher.user_uid || teacher.id;
  const dayName = when === 'today' ? getTodayDayName() : getTomorrowDayName();

  if (dayName === 'Sunday') {
    return { classes: [], day: dayName, status: 'holiday' };
  }

  let timetableData: any[] = [];
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'timetable.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    timetableData = JSON.parse(raw);
  } catch {
    return { classes: [], day: dayName, status: 'no_timetable' };
  }

  const filtered = timetableData.filter((entry: any) =>
    entry.teacherId === resolvedUid && entry.day === dayName
  );

  if (filtered.length === 0) {
    return { classes: [], day: dayName, status: 'no_classes' };
  }

  const allClasses = await readCollection<any>('classes');

  const result = filtered
    .sort((a: any, b: any) => a.period - b.period)
    .map((entry: any) => {
      const classData = allClasses.find((c: any) => c.id === entry.classId || (c.courseId === entry.courseId && c.teacherId === resolvedUid));
      return {
        period: entry.period,
        courseName: classData?.courseName || entry.courseId || 'Unknown',
        className: classData ? `${classData.program}-${classData.branch} (${classData.section})` : 'N/A',
      };
    });

  return { classes: result, day: dayName, status: 'ok' };
}

/**
 * Get students below 75% attendance across teacher's classes.
 * Returns ONLY [ { studentName, className, percentage } ].
 */
export async function getLowAttendanceStudents(teacherUid: string, extraIds?: { staffDocId?: string | null; email?: string | null }) {
  const teacher = await resolveTeacher(teacherUid, extraIds);
  if (!teacher) return { students: [], status: 'no_teacher' };

  const resolvedUid = teacher.user_uid || teacher.id;
  const teacherClasses = await findWhere<any>('classes', (c) => c.teacherId === resolvedUid || c.teacherId === teacherUid);

  if (teacherClasses.length === 0) {
    return { students: [], status: 'no_classes' };
  }

  const classIds = new Set(teacherClasses.map((c: any) => c.id));
  const attendanceRecs = await findWhere<any>('attendance', (a) => classIds.has(a.classId));

  if (attendanceRecs.length === 0) {
    return { students: [], status: 'no_attendance_data' };
  }

  // Group by studentId within each classId
  const studentClassMap = new Map<string, { present: number; total: number; className: string; studentId: string }>();

  for (const rec of attendanceRecs) {
    const key = `${rec.studentId}_${rec.classId}`;
    if (!studentClassMap.has(key)) {
      const cls = teacherClasses.find((c: any) => c.id === rec.classId);
      studentClassMap.set(key, {
        present: 0, total: 0,
        className: cls ? `${cls.courseName} (${cls.section})` : 'Unknown',
        studentId: rec.studentId,
      });
    }
    const entry = studentClassMap.get(key)!;
    entry.total++;
    if (rec.status === 'Present') entry.present++;
  }

  // Filter below 75%
  const lowStudentIds = new Set<string>();
  const lowEntries: { studentId: string; className: string; percentage: number }[] = [];

  for (const [, entry] of studentClassMap) {
    const pct = entry.total > 0 ? Math.round((entry.present / entry.total) * 100) : 0;
    if (pct < 75) {
      lowStudentIds.add(entry.studentId);
      lowEntries.push({ studentId: entry.studentId, className: entry.className, percentage: pct });
    }
  }

  if (lowEntries.length === 0) {
    return { students: [], status: 'all_good' };
  }

  // Resolve student names
  const allStudents = await readCollection<any>('students');
  const studentNameMap = new Map<string, string>();
  allStudents.forEach((s: any) => studentNameMap.set(s.id, s.name || 'Unknown'));

  const result = lowEntries
    .map((e) => ({
      studentName: studentNameMap.get(e.studentId) || 'Unknown',
      className: e.className,
      percentage: e.percentage,
    }))
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 20); // cap at 20

  return { students: result, totalCount: lowEntries.length, status: 'ok' };
}

/**
 * Get class performance analytics.
 * Returns ONLY [ { className, averageMarks, passPercentage, topGrade } ].
 */
export async function getClassPerformance(teacherUid: string, extraIds?: { staffDocId?: string | null; email?: string | null }) {
  const teacher = await resolveTeacher(teacherUid, extraIds);
  if (!teacher) return { classes: [], status: 'no_teacher' };

  const resolvedUid = teacher.user_uid || teacher.id;
  const teacherClasses = await findWhere<any>('classes', (c) => c.teacherId === resolvedUid || c.teacherId === teacherUid);

  if (teacherClasses.length === 0) {
    return { classes: [], status: 'no_classes' };
  }

  const classIds = new Set(teacherClasses.map((c: any) => c.id));
  const allMarks = await findWhere<any>('marks', (m) => classIds.has(m.classId));

  if (allMarks.length === 0) {
    return { classes: [], status: 'no_marks' };
  }

  // Group marks by classId
  const classMarksMap = new Map<string, any[]>();
  for (const mark of allMarks) {
    if (!classMarksMap.has(mark.classId)) classMarksMap.set(mark.classId, []);
    classMarksMap.get(mark.classId)!.push(mark);
  }

  const result = [];
  for (const cls of teacherClasses) {
    const marks = classMarksMap.get(cls.id) || [];
    if (marks.length === 0) continue;

    const totals = marks.map((m: any) => m.total || m.totalmarks || 0);
    const avg = totals.reduce((a: number, b: number) => a + b, 0) / totals.length;
    const passed = marks.filter((m: any) => (m.grade || '').toUpperCase() !== 'FAIL' && (m.grade || '').toUpperCase() !== 'F').length;
    const passPct = Math.round((passed / marks.length) * 100);

    result.push({
      className: `${cls.courseName} (${cls.section || cls.program})`,
      averageMarks: Math.round(avg),
      passPercentage: passPct,
      totalStudents: marks.length,
    });
  }

  return { classes: result, status: result.length > 0 ? 'ok' : 'no_marks' };
}

/**
 * Get marks overview for teacher's classes.
 * Returns summary per class, NOT individual student marks.
 */
export async function getMarksOverview(teacherUid: string, extraIds?: { staffDocId?: string | null; email?: string | null }) {
  return getClassPerformance(teacherUid, extraIds);
}

/**
 * Get upcoming exams for teacher's classes.
 * Returns ONLY [ { courseName, date, startTime, sessionName } ].
 */
export async function getTeacherUpcomingExams(teacherUid: string, extraIds?: { staffDocId?: string | null; email?: string | null }) {
  const teacher = await resolveTeacher(teacherUid, extraIds);
  if (!teacher) return { exams: [], status: 'no_teacher' };

  const resolvedUid = teacher.user_uid || teacher.id;
  const teacherClasses = await findWhere<any>('classes', (c) => c.teacherId === resolvedUid || c.teacherId === teacherUid);

  if (teacherClasses.length === 0) {
    return { exams: [], status: 'no_classes' };
  }

  const today = todayISO();
  const programs = new Set(teacherClasses.map((c: any) => `${c.program}_${c.branch}`));

  const allExams = await findWhere<any>('exams', (e) => {
    if (e.status !== 'Scheduled' || e.date < today) return false;
    return programs.has(`${e.program}_${e.branch}`);
  });

  if (allExams.length === 0) {
    return { exams: [], status: 'no_exams' };
  }

  const sorted = allExams
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10)
    .map((e: any) => ({
      courseName: e.courseName || e.courseCode || 'Course',
      date: e.date,
      startTime: e.startTime || '',
      endTime: e.endTime || '',
      sessionName: e.examSessionName || '',
    }));

  return { exams: sorted, status: 'ok' };
}

/**
 * Get student count and courses info for teacher.
 */
export async function getTeacherStudentInfo(teacherUid: string, extraIds?: { staffDocId?: string | null; email?: string | null }) {
  const teacher = await resolveTeacher(teacherUid, extraIds);
  if (!teacher) return { status: 'no_teacher' };

  const resolvedUid = teacher.user_uid || teacher.id;
  const teacherClasses = await findWhere<any>('classes', (c) => c.teacherId === resolvedUid || c.teacherId === teacherUid);

  if (teacherClasses.length === 0) {
    return { totalStudents: 0, classes: [], status: 'no_classes' };
  }

  const uniqueStudents = new Set<string>();
  teacherClasses.forEach((c: any) => (c.studentUids || []).forEach((uid: string) => uniqueStudents.add(uid)));

  const classes = teacherClasses.map((c: any) => ({
    courseName: c.courseName || c.courseId,
    section: `${c.program}-${c.branch} (${c.section})`,
    studentCount: (c.studentUids || []).length,
  }));

  return { totalStudents: uniqueStudents.size, classes, status: 'ok' };
}

/**
 * Get teacher profile.
 */
export async function getTeacherProfile(teacherUid: string, extraIds?: { staffDocId?: string | null; email?: string | null }) {
  const teacher = await resolveTeacher(teacherUid, extraIds);
  if (!teacher) return { status: 'no_teacher' };

  return {
    name: teacher.name || 'N/A',
    staffId: teacher.staffId || 'N/A',
    email: teacher.email || 'N/A',
    department: teacher.department || teacher.program || 'N/A',
    designation: teacher.designation || 'N/A',
    specialization: teacher.specialization || 'N/A',
    status: 'ok',
  };
}

/**
 * Get teacher's assigned courses.
 */
export async function getTeacherCourses(teacherUid: string, extraIds?: { staffDocId?: string | null; email?: string | null }) {
  const teacher = await resolveTeacher(teacherUid, extraIds);
  if (!teacher) return { courses: [], status: 'no_teacher' };

  const resolvedUid = teacher.user_uid || teacher.id;
  const teacherClasses = await findWhere<any>('classes', (c) => c.teacherId === resolvedUid || c.teacherId === teacherUid);

  if (teacherClasses.length === 0) {
    return { courses: [], status: 'no_courses' };
  }

  const courses = teacherClasses.map((c: any) => ({
    courseName: c.courseName || c.courseId,
    section: `${c.program}-${c.branch} (${c.section})`,
    semester: c.semester,
    studentCount: (c.studentUids || []).length,
  }));

  return { courses, status: 'ok' };
}

/**
 * Get pending attendance for today.
 */
export async function getPendingAttendance(teacherUid: string, extraIds?: { staffDocId?: string | null; email?: string | null }) {
  const teacher = await resolveTeacher(teacherUid, extraIds);
  if (!teacher) return { pending: [], status: 'no_teacher' };

  const resolvedUid = teacher.user_uid || teacher.id;
  const dayName = getTodayDayName();

  if (dayName === 'Sunday') {
    return { pending: [], status: 'holiday' };
  }

  let timetableData: any[] = [];
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'timetable.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    timetableData = JSON.parse(raw);
  } catch {
    return { pending: [], status: 'no_timetable' };
  }

  const todaySlots = timetableData.filter((entry: any) =>
    entry.teacherId === resolvedUid && entry.day === dayName
  );

  if (todaySlots.length === 0) {
    return { pending: [], status: 'no_classes_today' };
  }

  const todayDate = todayISO();
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const PERIOD_END_MINUTES: Record<number, number> = {
    1: 600, 2: 660, 3: 735, 4: 840, 5: 900, 6: 975,
  };

  const allClasses = await readCollection<any>('classes');
  const pending: { period: number; courseName: string; className: string }[] = [];

  for (const slot of todaySlots) {
    const endMin = PERIOD_END_MINUTES[slot.period];
    if (!endMin || currentMinutes < endMin) continue;

    const classId = slot.classId;
    if (!classId) continue;

    const alreadyMarked = await findOneWhere<any>('attendance', (a: any) =>
      a.classId === classId && a.date === todayDate && a.period === slot.period
    );

    if (!alreadyMarked) {
      const cls = allClasses.find((c: any) => c.id === classId);
      pending.push({
        period: slot.period,
        courseName: cls?.courseName || slot.courseId || 'Unknown',
        className: cls ? `${cls.program}-${cls.branch} (${cls.section})` : 'N/A',
      });
    }
  }

  return { pending, status: pending.length > 0 ? 'ok' : 'all_done' };
}
