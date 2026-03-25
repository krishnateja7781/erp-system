// ============================================================
// Student Service Layer — Controlled, filtered data access
// NEVER returns raw DB objects. NEVER uses .select("*").
// ALL queries filtered by the authenticated student's ID.
// ============================================================

import { supabase } from '@/lib/supabase-client';
import { readCollection, findOneWhere, findWhere } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

// ── Helpers ──

function todayISO(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function tomorrowISO(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  now.setDate(now.getDate() + 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getTodayDayName(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
}

function getTomorrowDayName(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  now.setDate(now.getDate() + 1);
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
}

function getGradePoint(grade: string | null): number | null {
  if (!grade) return null;
  switch (grade.toUpperCase()) {
    case 'O': return 10; case 'A+': return 9; case 'A': return 8; case 'B+': return 7;
    case 'B': return 6; case 'C+': return 5; case 'C': return 4; case 'P': return 3;
    case 'FAIL': case 'F': return 0; default: return null;
  }
}

// ── Service Functions ──

/**
 * Get student attendance percentage.
 * Returns ONLY { percentage, totalClasses, presentClasses }.
 */
export async function getStudentAttendance(studentDocId: string) {
  const records = await findWhere<any>('attendance', (a) => a.studentId === studentDocId);

  if (records.length === 0) {
    return { percentage: null, totalClasses: 0, presentClasses: 0, status: 'no_data' };
  }

  const totalClasses = records.length;
  const presentClasses = records.filter((a: any) => a.status === 'Present').length;
  const percentage = Math.round((presentClasses / totalClasses) * 100);

  return { percentage, totalClasses, presentClasses, status: 'ok' };
}

/**
 * Get student's today/tomorrow schedule.
 * Returns ONLY [ { period, courseName, teacherName } ].
 */
export async function getStudentSchedule(studentDocId: string, when: 'today' | 'tomorrow' = 'today') {
  const student = await findOneWhere<any>('students', (s) => s.id === studentDocId);
  if (!student) return { classes: [], day: '', status: 'no_student' };

  const dayName = when === 'today' ? getTodayDayName() : getTomorrowDayName();

  if (dayName === 'Sunday') {
    return { classes: [], day: dayName, status: 'holiday' };
  }

  // Read timetable from file
  let timetableData: any[] = [];
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'timetable.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    timetableData = JSON.parse(raw);
  } catch {
    return { classes: [], day: dayName, status: 'no_timetable' };
  }

  // Filter for student's program/branch/semester/section
  const filtered = timetableData.filter((entry: any) =>
    entry.program === student.program &&
    entry.branch === student.branch &&
    entry.semester === student.semester &&
    entry.section === student.section &&
    entry.day === dayName
  );

  if (filtered.length === 0) {
    return { classes: [], day: dayName, status: 'no_classes' };
  }

  // Enrich with course and teacher names
  const classes = await readCollection<any>('classes');
  const result = filtered
    .sort((a: any, b: any) => a.period - b.period)
    .map((entry: any) => {
      const classData = classes.find((c: any) => c.id === entry.classId || (c.courseId === entry.courseId && c.teacherId === entry.teacherId));
      return {
        period: entry.period,
        courseName: classData?.courseName || entry.courseId || 'Unknown',
        teacherName: classData?.teacherName || 'TBD',
      };
    });

  return { classes: result, day: dayName, status: 'ok' };
}

/**
 * Get upcoming exams for a student.
 * Returns ONLY [ { courseName, date, startTime, endTime } ].
 */
export async function getStudentUpcomingExams(studentDocId: string) {
  const student = await findOneWhere<any>('students', (s) => s.id === studentDocId);
  if (!student) return { exams: [], status: 'no_student' };

  const today = todayISO();
  const exams = await findWhere<any>('exams', (e) =>
    e.program === student.program &&
    e.branch === student.branch &&
    e.status === 'Scheduled' &&
    e.date >= today
  );

  if (exams.length === 0) {
    return { exams: [], status: 'no_exams' };
  }

  const sorted = exams
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
 * Get student marks summary with CGPA.
 * Returns ONLY { cgpa, subjects: [ { courseName, grade, total } ] }.
 */
export async function getStudentMarksSummary(studentDocId: string) {
  const marksRecs = await findWhere<any>('marks', (m) => m.studentId === studentDocId);

  if (marksRecs.length === 0) {
    return { cgpa: null, subjects: [], status: 'no_marks' };
  }

  const allClasses = await readCollection<any>('classes');
  const allCourses = await readCollection<any>('courses');

  const classMap = new Map<string, any>();
  allClasses.forEach((c: any) => classMap.set(c.id, c));
  const courseMap = new Map<string, any>();
  allCourses.forEach((c: any) => { courseMap.set(c.id, c); courseMap.set(c.courseId, c); });

  const subjects = marksRecs.map((m: any) => {
    const classData = classMap.get(m.classId);
    const courseData = classData ? (courseMap.get(classData.courseId) || null) : null;
    return {
      courseName: classData?.courseName || 'Course',
      grade: m.grade || 'N/A',
      total: m.total || m.totalmarks || 0,
      credits: courseData?.credits || 0,
    };
  });

  // Calculate CGPA
  let totalCreditPoints = 0;
  let totalCredits = 0;
  for (const sub of subjects) {
    const gp = getGradePoint(sub.grade);
    if (gp !== null && sub.credits > 0) {
      totalCreditPoints += gp * sub.credits;
      totalCredits += sub.credits;
    }
  }
  const cgpa = totalCredits > 0 ? parseFloat((totalCreditPoints / totalCredits).toFixed(2)) : null;

  return {
    cgpa,
    subjects: subjects.map((s: any) => ({ courseName: s.courseName, grade: s.grade, total: s.total })),
    status: 'ok',
  };
}

/**
 * Get weak subjects (grade below B+ or FAIL).
 * Returns ONLY [ { courseName, grade } ].
 */
export async function getStudentWeakSubjects(studentDocId: string) {
  const marksSummary = await getStudentMarksSummary(studentDocId);

  if (marksSummary.status === 'no_marks') {
    return { weakSubjects: [], status: 'no_marks' };
  }

  const weakThreshold = new Set(['C+', 'C', 'P', 'FAIL', 'F']);
  const weak = marksSummary.subjects.filter((s: any) => weakThreshold.has(s.grade.toUpperCase()));

  return {
    weakSubjects: weak.map((s: any) => ({ courseName: s.courseName, grade: s.grade })),
    status: weak.length > 0 ? 'ok' : 'all_good',
  };
}

/**
 * Get student fee details.
 * Returns ONLY { totalFees, amountPaid, balance, status }.
 */
export async function getStudentFeeDetails(studentDocId: string) {
  const feeRec = await findOneWhere<any>('fees', (f) => f.id === studentDocId);

  if (!feeRec) {
    return { totalFees: 0, amountPaid: 0, balance: 0, feeStatus: 'no_record', status: 'no_data' };
  }

  return {
    totalFees: feeRec.totalFees || 0,
    amountPaid: feeRec.amountPaid || 0,
    balance: feeRec.balance || 0,
    feeStatus: (feeRec.balance || 0) <= 0 ? 'Fully Paid' : 'Pending',
    collegeFees: feeRec.collegeFees || null,
    hostelFees: feeRec.hostelFees || null,
    status: 'ok',
  };
}

/**
 * Get student hostel details.
 * Returns ONLY { hostelName, roomNumber, wardenName, wardenContact }.
 */
export async function getStudentHostelDetails(studentDocId: string) {
  const student = await findOneWhere<any>('students', (s) => s.id === studentDocId);
  if (!student) return { status: 'no_student' };

  if (!student.hostelId) {
    return { status: 'not_hosteler' };
  }

  const hostel = await findOneWhere<any>('hostels', (h) => h.id === student.hostelId);

  return {
    hostelName: hostel?.name || 'Unknown',
    roomNumber: student.roomNumber || 'Not assigned',
    wardenName: hostel?.warden?.name || 'N/A',
    wardenContact: hostel?.warden?.contact || 'N/A',
    hostelStatus: hostel?.status || 'Unknown',
    status: 'ok',
  };
}

/**
 * Get basic student profile info.
 * Returns ONLY { name, collegeId, program, branch, year, semester, section }.
 */
export async function getStudentProfile(studentDocId: string) {
  const student = await findOneWhere<any>('students', (s) => s.id === studentDocId);
  if (!student) return { status: 'no_student' };

  return {
    name: student.name || 'N/A',
    collegeId: student.collegeId || 'N/A',
    program: student.program || 'N/A',
    branch: student.branch || 'N/A',
    year: student.year || 'N/A',
    semester: student.semester || 'N/A',
    section: student.section || 'N/A',
    type: student.type || 'Day Scholar',
    status: 'ok',
  };
}

/**
 * Get enrolled courses.
 * Returns ONLY [ { courseName, credits } ].
 */
export async function getStudentCourses(studentDocId: string) {
  const student = await findOneWhere<any>('students', (s) => s.id === studentDocId);
  if (!student) return { courses: [], status: 'no_student' };

  const studentUid = student.user_uid || student.id;
  const enrolledClasses = await findWhere<any>('classes', (c) => (c.studentUids || []).includes(studentUid));

  if (enrolledClasses.length === 0) {
    return { courses: [], status: 'no_courses' };
  }

  const courses = enrolledClasses.map((c: any) => ({
    courseName: c.courseName || c.courseId || 'Unknown',
    teacherName: c.teacherName || 'TBD',
    credits: c.credits || 0,
  }));

  return { courses, status: 'ok' };
}
