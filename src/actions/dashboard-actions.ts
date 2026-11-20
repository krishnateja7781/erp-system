'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { requireRole, requireStudentAccess, pinToSelf, isUuid } from '@/lib/auth-guard';
import type { FullStudentData } from '@/lib/types';
import { PERIOD_SLOTS, todayDayName, getInitials } from '@/lib/utils';
import { calculateCGPA } from '@/lib/grading';
import { todayISODate } from '@/lib/db';
import { getStudentSchedule } from './student-actions';
import { getTeacherSchedule } from './teacher-actions';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PendingAttendanceItem {
  period: number;
  periodTitle: string;
  courseName: string;
  className: string;
  classId: string;
}

export interface TeacherDashboardData {
  name: string;
  coursesTeaching: { id: string; name: string; studentCount: number }[];
  upcomingClasses: { time: string; course: string; class: string; location: string }[];
  pendingMarksCount: number;
  hasPublishedExams: boolean;
  pendingAttendance: PendingAttendanceItem[];
}

export interface StudentDashboardData {
  overallAttendance: number | null;
  coursesEnrolledCount: number | null;
  upcomingExam: { sessionName: string; courseName: string; date: string } | null;
  schedule: any[];
}

export interface LoginEvent {
  id: string;
  userName: string;
  userRole: string;
  timestamp: string;
}

export interface AdminDashboardData {
  totalStudents: number;
  totalTeachers: number;
  totalPrograms: number;
  pendingApprovals: number;
  collectionRate: number;
  attendanceTrend: { month: string; attendance: number }[];
  recentLogins: LoginEvent[];
  studentDistribution: { branch: string; count: number }[];
}

export interface EmployeeDashboardData {
  employeeType: string;
  totalFees?: number;
  collectedFees?: number;
  pendingFees?: number;
  collectionRate?: number;
  totalRooms?: number;
  occupiedRooms?: number;
  availableRooms?: number;
  totalHostelStudents?: number;
  totalExams?: number;
  scheduledExams?: number;
  totalClasses?: number;
  totalCourses?: number;
  marksEntered?: number;
  totalBooks?: number;
  availableBooks?: number;
  issuedBooks?: number;
  adminStats?: AdminDashboardData;
}

// ── Student profile (used by admin, teacher and student views) ─────────────────

export async function getStudentProfileDetails(studentDocId: string): Promise<FullStudentData | null> {
  if (!studentDocId) return null;
  try {
    const { studentId } = await requireStudentAccess(studentDocId);
    const admin = await createServiceRoleClient();

    const [{ data: s }, { data: att }, { data: marks }, { data: fees }, { data: hostel }] = await Promise.all([
      admin.from('students').select('*, profiles(full_name, email, phone, profile_picture_url)').eq('id', studentId).single(),
      admin.rpc('get_student_attendance_totals', { p_student_id: studentId }),
      admin.from('marks').select('grade, classes(courses(name, credits))').eq('student_id', studentId),
      admin.from('fees').select('balance').eq('student_id', studentId),
      admin
        .from('hostel_allocations')
        .select('hostel_rooms(room_number, hostels(name))')
        .eq('student_id', studentId)
        .eq('status', 'Active')
        .maybeSingle(),
    ]);
    if (!s) return null;

    const p = (s as any).profiles || {};
    const profile = {
      ...s,
      name: p.full_name || 'Unknown',
      email: p.email || '',
      phone: p.phone || '',
      avatarUrl: p.profile_picture_url || '',
      collegeId: s.college_id,
      year: s.current_year,
      semester: s.current_semester,
      isHosteler: s.is_hosteler,
      type: s.is_hosteler ? 'Hosteler' : 'Day Scholar',
      status: s.status || (s.is_graduated ? 'Graduated' : 'Active'),
      batch: s.admitted_year ? String(s.admitted_year) : undefined,
      initials: getInitials(p.full_name),
      bloodGroup: s.blood_group,
      emergencyContact: { name: s.parent_name || '', phone: s.parent_phone || '', address: s.address || '' },
    };

    const totals = Array.isArray(att) ? att[0] : att;
    const total = Number(totals?.total_classes) || 0;
    const present = Number(totals?.present_classes) || 0;
    const attendance = { overallPercentage: total > 0 ? Math.round((present / total) * 100) : null, totalClasses: total, presentClasses: present, recentAbsences: null };

    const markRows = ((marks || []) as any[]).map((m) => ({
      grade: m.grade || null,
      credits: m.classes?.courses?.credits ?? null,
      courseTitle: m.classes?.courses?.name || 'Unknown Course',
    }));
    const marksSummary = {
      cgpa: calculateCGPA(markRows),
      recentGrades: markRows.filter((m) => m.grade).slice(-5).map((m) => ({ course: m.courseTitle, grade: m.grade })),
    };

    const balance = ((fees || []) as any[]).reduce((sum, f) => sum + (Number(f.balance) || 0), 0);
    const room: any = (hostel as any)?.hostel_rooms;
    const hostelInfo = room ? { hostelName: room.hostels?.name || 'Hostel', roomNumber: room.room_number || null } : null;

    const { data: classes } = await admin
      .from('classes')
      .select('courses(name)')
      .eq('program', s.program)
      .eq('branch', s.branch)
      .eq('semester', s.current_semester)
      .eq('section', s.section || 'A');
    const coursesEnrolled = ((classes || []) as any[]).map((c) => c.courses?.name).filter(Boolean);

    return {
      profile: profile as any,
      attendance,
      marks: marksSummary,
      fees: { balance, status: balance <= 0 ? 'Paid' : 'Pending' },
      hostelInfo,
      coursesEnrolled,
    };
  } catch (error) {
    console.error('[getStudentProfileDetails]', error);
    return null;
  }
}

export async function getStudentDashboardData(studentDocId: string): Promise<StudentDashboardData | null> {
  try {
    const { studentId } = await requireStudentAccess(studentDocId);
    const admin = await createServiceRoleClient();
    const [details, schedule, { data: s }] = await Promise.all([
      getStudentProfileDetails(studentId),
      getStudentSchedule(studentId),
      admin.from('students').select('program, branch, current_semester').eq('id', studentId).single(),
    ]);
    if (!details || !s) return null;

    const { data: exam } = await admin
      .from('exams')
      .select('exam_type, exam_date, courses(name)')
      .eq('program', s.program)
      .eq('branch', s.branch)
      .eq('semester', s.current_semester)
      .eq('status', 'Scheduled')
      .gte('exam_date', todayISODate())
      .order('exam_date')
      .limit(1)
      .maybeSingle();

    return {
      overallAttendance: details.attendance?.overallPercentage ?? null,
      coursesEnrolledCount: details.coursesEnrolled?.length || 0,
      upcomingExam: exam ? { sessionName: exam.exam_type, courseName: (exam as any).courses?.name || 'Course', date: exam.exam_date } : null,
      schedule,
    };
  } catch (error) {
    console.error('[getStudentDashboardData]', error);
    return null;
  }
}

// ── Teacher ────────────────────────────────────────────────────────────────────

export async function getTeacherProfileDetails(teacherUid: string, extraIds?: { staffDocId?: string | null; email?: string | null }): Promise<any | null> {
  const caller = await requireRole('teacher', 'emp:student_staff_management', 'emp:exam_marks_management');
  const admin = await createServiceRoleClient();

  let teacher: any = null;
  if (caller.role === 'teacher') {
    ({ data: teacher } = await admin.from('teachers').select('*, profiles(full_name, email, phone, profile_picture_url)').eq('profile_id', caller.userId).maybeSingle());
  } else {
    const key = extraIds?.staffDocId || teacherUid;
    if (!isUuid(key)) return null;
    ({ data: teacher } = await admin
      .from('teachers')
      .select('*, profiles(full_name, email, phone, profile_picture_url)')
      .or(`profile_id.eq.${key},id.eq.${key}`)
      .limit(1)
      .maybeSingle());
  }
  if (!teacher) return null;

  const [{ data: classes }, { data: counts }, schedule] = await Promise.all([
    admin.from('classes').select('id, program, branch, semester, section, classroom_id, courses(id, name, code)').eq('teacher_id', teacher.id),
    admin.rpc('get_section_student_counts'),
    getTeacherSchedule(teacher.profile_id),
  ]);

  const countMap = new Map<string, number>();
  for (const r of (counts as any[]) || []) countMap.set(`${r.program}|${r.branch}|${r.current_semester}|${r.section}`, Number(r.student_count));

  const coursesAssigned = ((classes || []) as any[]).map((c) => ({
    id: c.id,
    code: c.courses?.code || '',
    name: c.courses?.name || '',
    class: `${c.program} ${c.branch} ${c.section}`,
    program: c.program,
    branch: c.branch,
    semester: c.semester,
    classroomId: c.classroom_id || null,
    studentCount: countMap.get(`${c.program}|${c.branch}|${c.semester}|${c.section}`) || 0,
  }));
  const studentsCount = coursesAssigned.reduce((sum, c) => sum + c.studentCount, 0);
  const p = teacher.profiles || {};

  return {
    profile: {
      ...teacher,
      name: p.full_name || 'Teacher',
      email: p.email || '',
      phone: p.phone || teacher.phone || '',
      avatarUrl: p.profile_picture_url || '',
      staffId: teacher.employee_code,
      position: teacher.designation,
      joinDate: teacher.date_of_joining || teacher.created_at?.split('T')[0],
      officeLocation: teacher.office_location,
    },
    coursesAssigned,
    studentsCount,
    classAttendanceRate: null,
    schedule,
  };
}

export async function getTeacherDashboardData(teacherUid: string, extraIds?: { staffDocId?: string | null; email?: string | null }): Promise<TeacherDashboardData> {
  const caller = await requireRole('teacher');
  const profile = await getTeacherProfileDetails(pinToSelf(caller, teacherUid), extraIds);
  if (!profile) throw new Error('Teacher profile not found. Please ask an administrator to verify your teacher record.');
  const admin = await createServiceRoleClient();

  const today = todayDayName();
  const todaySchedule = (profile.schedule || [])
    .filter((s: any) => s.day === today)
    .sort((a: any, b: any) => a.period - b.period);

  const upcomingClasses = todaySchedule.slice(0, 3).map((s: any) => ({
    time: PERIOD_SLOTS[s.period]?.title || `Period ${s.period}`,
    course: s.courseName,
    class: s.class,
    location: s.room || 'TBA',
  }));

  // Exams scheduled for any of the teacher's courses → marks are due for their students.
  const courseIds = Array.from(new Set(profile.coursesAssigned.map((c: any) => c.id)));
  let hasPublishedExams = false;
  if (courseIds.length > 0) {
    const { data: cls } = await admin.from('classes').select('course_id').in('id', courseIds as string[]);
    const cids = Array.from(new Set((cls || []).map((c: any) => c.course_id)));
    if (cids.length) {
      const { count } = await admin.from('exams').select('id', { count: 'exact', head: true }).in('course_id', cids).eq('status', 'Scheduled');
      hasPublishedExams = (count || 0) > 0;
    }
  }

  // Pending marks = students without a final grade in the teacher's classes.
  const { data: pending } = await admin.rpc('get_teacher_pending_marks', { p_teacher_profile_id: caller.userId });

  // Periods that already ended today without attendance recorded.
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const ended = todaySchedule.filter((s: any) => {
    const slot = PERIOD_SLOTS[s.period];
    return slot && minutes >= slot.end[0] * 60 + slot.end[1];
  });
  const pendingAttendance: PendingAttendanceItem[] = [];
  if (ended.length > 0) {
    const { data: taken } = await admin
      .from('attendance_sessions')
      .select('class_id, period')
      .eq('date', todayISODate())
      .in('class_id', Array.from(new Set(ended.map((e: any) => e.classId))));
    const done = new Set(((taken || []) as any[]).map((t) => `${t.class_id}|${t.period}`));
    for (const e of ended) {
      if (done.has(`${e.classId}|${e.period}`)) continue;
      pendingAttendance.push({
        period: e.period,
        periodTitle: PERIOD_SLOTS[e.period].title,
        courseName: e.courseName || e.courseCode,
        className: e.class || '',
        classId: e.classId,
      });
    }
  }

  return {
    name: profile.profile.name,
    coursesTeaching: profile.coursesAssigned.map((c: any) => ({ id: c.id, name: c.name, studentCount: c.studentCount })),
    upcomingClasses,
    pendingMarksCount: Number(pending) || 0,
    hasPublishedExams,
    pendingAttendance,
  };
}

// ── Admin / employee ───────────────────────────────────────────────────────────

export async function getAdminDashboardStats(): Promise<AdminDashboardData> {
  await requireRole('emp:student_staff_management');
  const admin = await createServiceRoleClient();
  const { data, error } = await admin.rpc('get_admin_dashboard_stats');
  if (error) throw new Error(`Failed to fetch admin dashboard stats: ${error.message}`);
  const d: any = data || {};
  return {
    totalStudents: Number(d.total_students) || 0,
    totalTeachers: Number(d.total_teachers) || 0,
    totalPrograms: Number(d.total_programs) || 0,
    pendingApprovals: Number(d.pending_approvals) || 0,
    collectionRate: Number(d.collection_rate) || 0,
    attendanceTrend: (d.attendance_trend || []).map((r: any) => ({ month: r.month, attendance: Number(r.attendance) || 0 })),
    // Real sign-ins (login_events); falls back to newest accounts before anyone has logged in.
    recentLogins: ((d.recent_logins?.length ? d.recent_logins : d.recent_users) || []).map((u: any) => ({
      id: String(u.id),
      userName: u.full_name || 'User',
      userRole: u.role,
      timestamp: u.created_at,
    })),
    studentDistribution: (d.student_distribution || []).map((r: any) => ({ branch: r.branch, count: Number(r.count) || 0 })),
  };
}

export async function getEmployeeDashboardStats(_profileId?: string): Promise<EmployeeDashboardData> {
  const caller = await requireRole('employee');
  const employeeType = caller.employeeType || (caller.role === 'super_admin' ? 'student_staff_management' : '');
  if (!employeeType) throw new Error('Employee record not found.');

  if (employeeType === 'student_staff_management') {
    return { employeeType, adminStats: await getAdminDashboardStats() };
  }

  const admin = await createServiceRoleClient();
  const { data, error } = await admin.rpc('get_employee_dashboard_stats', { p_employee_type: employeeType });
  if (error) throw new Error(error.message);
  const d: any = data || {};
  const num = (v: any) => (v === undefined || v === null ? undefined : Number(v));
  return {
    employeeType,
    totalFees: num(d.total_fees),
    collectedFees: num(d.collected_fees),
    pendingFees: num(d.pending_fees),
    collectionRate: num(d.collection_rate),
    totalRooms: num(d.total_rooms),
    occupiedRooms: num(d.occupied_beds),
    availableRooms: num(d.available_beds),
    totalHostelStudents: num(d.hostel_students),
    totalExams: num(d.total_exams),
    scheduledExams: num(d.scheduled_exams),
    totalClasses: num(d.total_classes),
    totalCourses: num(d.total_courses),
    marksEntered: num(d.marks_entered),
    totalBooks: num(d.total_books),
    availableBooks: num(d.available_books),
    issuedBooks: num(d.issued_books),
  };
}
