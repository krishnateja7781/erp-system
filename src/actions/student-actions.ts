'use server'

import { createServiceRoleClient } from '@/lib/supabase'
// All DB reads / writes use service role to bypass RLS (these are server-only actions)
const createServerSupabaseClient = createServiceRoleClient
import { getSession } from './auth-actions';
import { generatePassword } from '@/lib/utils';

export async function createStudentAccount(data: any) {
  const adminSupabase = await createServiceRoleClient()
  
  const progCode = (data.program || 'UNK').toString().substring(0, 3).toUpperCase();
  const yearCode = (data.batch || new Date().getFullYear().toString()).toString().substring(2, 4);
  const branchCode = (data.branch || 'UNK').toString().substring(0, 3).toUpperCase();
  const idPrefix = `${progCode}${yearCode}${branchCode}`;

  const { count } = await adminSupabase.from('students')
    .select('*', { count: 'exact', head: true })
    .like('college_id', `${idPrefix}%`);
    
  const nextSeq = ((count || 0) + 1).toString().padStart(4, '0');
  const finalCollegeId = `${idPrefix}${nextSeq}`;

  const email = data.email || `${finalCollegeId.toLowerCase()}@student.edu.in`;
  const password = data.password || generatePassword(data.firstName || data.fullName, data.dob) || 'Student@123';
  
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  
  if (authError) return { success: false, error: authError.message }
  
  const userId = authData.user.id
  const fullName = data.firstName && data.lastName ? `${data.firstName} ${data.lastName}`.trim() : (data.name || data.fullName || 'Student')
  const isHosteler = data.type === 'Hosteler' || data.isHosteler === true;
  
  const { error: profileError } = await adminSupabase.from('profiles').insert({
    id: userId,
    role: 'student',
    full_name: fullName,
    first_name: data.firstName || null,
    last_name: data.lastName || null,
    email: email,
    phone: data.phone || null,
    dob: data.dob || null,
    id_code: finalCollegeId,
    initial_password: password
  })
  
  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(userId)
    return { success: false, error: profileError.message }
  }
  
  const { error: studentError } = await adminSupabase.from('students').insert({
    profile_id: userId,
    college_id: finalCollegeId,
    program: data.program,
    branch: data.branch,
    current_semester: parseInt(data.semester) || data.current_semester || 1,
    current_year: parseInt(data.year) || data.current_year || 1,
    is_hosteler: isHosteler,
    dob: data.dob || null,
    admitted_year: parseInt(data.batch) || new Date().getFullYear(),
    gender: data.gender || null,
    address: data.address || null,
    parent_name: data.emergencyContactName || null,
    parent_phone: data.emergencyContactPhone || null,
    blood_group: data.bloodGroup || null
  })
  
  if (studentError) {
    await adminSupabase.auth.admin.deleteUser(userId)
    return { success: false, error: studentError.message }
  }
  
  return { success: true, message: `Student successfully created! Email: ${email}`, studentId: finalCollegeId, password, email }
}

export async function getStudentsForSection(program: string, branch: string, section: string) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
        .from('students')
        .select('id, college_id, is_graduated, profiles(full_name)')
        .eq('program', program)
        .eq('branch', branch)
        .eq('section', section)
        .order('college_id');
        
    if (error || !data) return [];
    
    return data.map((s: any) => ({
        id: s.id,
        collegeId: s.college_id,
        name: s.profiles?.full_name || 'Unknown',
        status: s.is_graduated ? 'Graduated' : 'Active'
    }));
}

export async function getStudent(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('students')
    .select('*, profiles(*)')
    .eq('id', id)
    .single()
    
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function getStudents() {
  const supabase = await createServerSupabaseClient()
  const { data: students, error } = await supabase
    .from('students')
    .select(`*, profiles(full_name, email)`)
    .order('created_at', { ascending: false })

  if (error || !students) return []

  return students.map((s: any) => ({
    id: s.id,
    collegeId: s.college_id,
    name: s.profiles?.full_name || 'Unknown',
    program: s.program,
    branch: s.branch,
    year: s.current_year,
    semester: s.current_semester,
    email: s.profiles?.email,
    gender: s.gender,
    bloodGroup: s.blood_group,
    isHosteler: s.is_hosteler,
    type: s.is_hosteler ? 'Hosteler' : 'Day Scholar',
    section: 'A',
    status: s.is_graduated ? 'Graduated' : 'Active',
  }))
}

export async function getAllStudents() {
  return getStudents()
}

export async function updateStudent(id: string, data: any) {
  const adminSupabase = await createServiceRoleClient()
  
  const updatePayload: any = {}
  if (data.program) updatePayload.program = data.program
  if (data.branch) updatePayload.branch = data.branch
  if (data.year) updatePayload.current_year = parseInt(data.year)
  if (data.semester) updatePayload.current_semester = parseInt(data.semester)
  if (data.collegeId) updatePayload.college_id = data.collegeId
  if (data.type) {
    updatePayload.is_hosteler = data.type === 'Hosteler';
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await adminSupabase.from('students').update(updatePayload).eq('id', id)
    if (error) return { success: false, error: error.message }
  }

  const fullName = data.firstName && data.lastName ? `${data.firstName} ${data.lastName}`.trim() : (data.name || data.fullName)

  if (fullName || data.firstName || data.lastName) {
    const { data: studentRecord } = await adminSupabase.from('students').select('profile_id').eq('id', id).single()
    if (studentRecord?.profile_id) {
      await adminSupabase.from('profiles').update({ 
        full_name: fullName,
        first_name: data.firstName || null,
        last_name: data.lastName || null,
        phone: data.phone || null,
        dob: data.dob || null
      }).eq('id', studentRecord.profile_id)
    }
  }

  return { success: true, message: 'Student updated successfully.' }
}

export async function deleteStudent(id: string) {
  const adminSupabase = await createServiceRoleClient()
  
  const { data: studentRecord } = await adminSupabase.from('students').select('profile_id').eq('id', id).single()
  
  const { error } = await adminSupabase.from('students').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  
  if (studentRecord?.profile_id) {
    await adminSupabase.auth.admin.deleteUser(studentRecord.profile_id)
  }
  
  return { success: true, message: 'Student and related access revoked successfully.' }
}

export async function generateCollegeId(program: string, year: number) {
  const prefix = program.substring(0, 3).toUpperCase()
  const yearCode = year.toString().slice(-2)
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  return { data: `${prefix}${yearCode}${randomSuffix}`, error: null }
}

// ── Session-based identity for Student Portal pages ───────────────────────────

export async function getMyStudentProfile() {
  const result = await getSession();
  if (!result || result.error || !result.data?.session) return null;

  const userId = result.data.session.user.id;
  const supabase = await createServerSupabaseClient();

  const { data: student, error } = await supabase
    .from('students')
    .select('*, profiles(full_name, email, phone, profile_picture_url)')
    .eq('profile_id', userId)
    .single();

  if (error || !student) return null;

  return {
    studentId: student.id,
    profileId: userId,
    collegeId: student.college_id,
    name: (student as any).profiles?.full_name || 'Student',
    email: (student as any).profiles?.email || '',
    phone: (student as any).profiles?.phone || '',
    avatarUrl: (student as any).profiles?.profile_picture_url || '',
    program: student.program,
    branch: student.branch,
    semester: student.current_semester,
    year: student.current_year,
    isHosteler: student.is_hosteler,
    type: student.is_hosteler ? 'Hosteler' : 'Day Scholar',
    isGraduated: student.is_graduated,
  };
}

// ── Fetch student backlogs ─────────────────────────────────────────────────────

export async function fetchStudentBacklogs(studentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: marksData } = await supabase
    .from('marks')
    .select('grade, classes(semester, courses(code, name))')
    .eq('student_id', studentId);

  if (!marksData) return [];

  const backlogs: any[] = [];
  for (const m of marksData as any[]) {
    if (m.grade === 'FAIL' || m.grade === 'F') {
      backlogs.push({
        courseCode: m.classes?.courses?.code || null,
        courseName: m.classes?.courses?.name || null,
        semesterAttempted: m.classes?.semester || null,
        gradeAchieved: m.grade,
        status: 'Active',
      });
    } else if (m.grade && m.grade !== 'N/A') {
      const hasFail = marksData.some((other: any) =>
        other.classes?.courses?.code === m.classes?.courses?.code &&
        (other.grade === 'FAIL' || other.grade === 'F')
      );
      if (hasFail) {
        backlogs.push({
          courseCode: m.classes?.courses?.code || null,
          courseName: m.classes?.courses?.name || null,
          semesterAttempted: m.classes?.semester || null,
          gradeAchieved: m.grade,
          status: 'Cleared',
        });
      }
    }
  }

  return backlogs;
}

// ── Student Attendance API ─────────────────────────────────────────────────────

export async function getStudentAttendanceDetails(studentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: attendanceData } = await supabase
    .from('attendance')
    .select('id, date, period, status, classes(semester, courses(code, name))')
    .eq('student_id', studentId);

  const logs = (attendanceData || []).map((a: any) => ({
      id: a.id,
      date: a.date,
      period: a.period,
      status: a.status,
      semester: a.classes?.semester,
      courseCode: a.classes?.courses?.code,
      courseName: a.classes?.courses?.name
  }));

  const semestersMap = new Map<number, Map<string, any>>();
  
  (attendanceData || []).forEach((a: any) => {
      const sem = a.classes?.semester || 1;
      const cCode = a.classes?.courses?.code || 'UNK';
      const cName = a.classes?.courses?.name || 'Unknown';

      if (!semestersMap.has(sem)) semestersMap.set(sem, new Map());
      const courseMap = semestersMap.get(sem)!;

      if (!courseMap.has(cCode)) {
          courseMap.set(cCode, { courseCode: cCode, courseName: cName, attended: 0, total: 0 });
      }
      const stats = courseMap.get(cCode)!;
      stats.total += 1;
      if (a.status === 'Present') {
          stats.attended += 1;
      }
  });

  const summary = Array.from(semestersMap.entries()).map(([semester, coursesMap]) => ({
      semester,
      courses: Array.from(coursesMap.values())
  }));

  return { logs, summary };
}

// ── Student Performance API ────────────────────────────────────────────────────

export interface StudentPerformanceData {
  marksData: {
    courseCode: string;
    internals: number;
    externals: number;
  }[];
  attendanceData: {
    month: string;
    percentage: number;
  }[];
}

export async function getStudentPerformanceData(studentId: string): Promise<StudentPerformanceData> {
  const supabase = await createServerSupabaseClient();

  const { data: marks } = await supabase
    .from('marks')
    .select('ia1, ia2, other, see, classes(courses(code))')
    .eq('student_id', studentId)
    .limit(10);

  const marksData = (marks || []).map((m: any) => ({
    courseCode: m.classes?.courses?.code || 'UNK',
    internals: (m.ia1 || 0) + (m.ia2 || 0) + (m.other || 0),
    externals: m.see || 0,
  }));

  const { data: attendanceLogs } = await supabase
    .from('attendance')
    .select('date, status')
    .eq('student_id', studentId);

  const monthlyStats: Record<string, { total: number; present: number }> = {};
  (attendanceLogs || []).forEach((log: any) => {
    if (!log.date) return;
    try {
        const d = new Date(log.date);
        // Ensure month is short text like "Jan"
        const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        if (!monthlyStats[month]) monthlyStats[month] = { total: 0, present: 0 };
        monthlyStats[month].total++;
        if (log.status === 'Present') monthlyStats[month].present++;
    } catch (e) {
        /* Ignore invalid dates */
    }
  });

  const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const attendanceData = Object.entries(monthlyStats)
    .map(([month, stats]) => ({
        month,
        percentage: Math.round((stats.present / stats.total) * 100)
    }))
    .sort((a, b) => monthsOrder.indexOf(a.month) - monthsOrder.indexOf(b.month));

  return {
    marksData,
    attendanceData: attendanceData.length > 0 ? attendanceData : [{ month: 'Current', percentage: 0 }]
  };
}

export async function getStudentSchedule(studentId: string): Promise<any[]> {
  const supabase = await createServerSupabaseClient();
  const { data: student } = await supabase.from('students').select('*').eq('id', studentId).single();
  if (!student) return [];

  const { data: classList } = await supabase
      .from('classes')
      .select('id, courses(name, code), teachers(profiles(full_name))')
      .eq('program', student.program)
      .eq('branch', student.branch)
      .eq('semester', student.current_semester)
      .eq('section', student.section || 'A');

  if (!classList || classList.length === 0) return [];
  const classIds = classList.map(c => c.id);

  const { data: timetables } = await supabase
      .from('timetables')
      .select('*')
      .in('class_id', classIds);

  if (!timetables || timetables.length === 0) return [];

  return timetables.map((entry: any) => {
      const cls: any = classList.find((c: any) => c.id === entry.class_id);
      let periodVal = 1;
      if (entry.start_time) {
          periodVal = parseInt(entry.start_time.split(':')[0], 10);
      }
      return {
          id: entry.id,
          period: periodVal,
          courseCode: cls?.courses?.code,
          courseName: cls?.courses?.name,
          className: `${student.program} ${student.branch} ${student.section || 'A'}`,
          day: entry.day_of_week,
          teacherName: cls?.teachers?.profiles?.full_name || 'Unassigned'
      };
  });
}

export async function getAvailableSections(program: string, year: string | number, courseId: string): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from('classes').select('section').eq('academic_year', year.toString());
  if (!data || data.length === 0) return ["A", "B", "C"];
  const sections = Array.from(new Set(data.filter(d => d.section).map(d => d.section)));
  return sections.length > 0 ? sections : ["A", "B", "C"];
}

export async function getSectionsForBranch(program: string, branch: string): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from('classes').select('section');
  if (!data || data.length === 0) return ["A", "B", "C"];
  const sections = Array.from(new Set(data.filter(d => d.section).map(d => d.section)));
  return sections.length > 0 ? sections : ["A", "B", "C"];
}

export async function getStudentProfileForTeacher(studentId: string, teacherId?: string): Promise<{ data: any, error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .select('*, profiles(*)')
    .eq('id', studentId)
    .single();
    
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

