
'use server';

import { readCollection, findOneWhere, findWhere } from '@/lib/db';
import { createServerSupabaseClient } from '@/lib/supabase';
import type { Teacher, Student, FullStudentData } from '@/lib/types';
import { PERIOD_SLOTS } from '@/lib/utils';
import { getStudentSchedule } from './student-actions';
import { getTeacherSchedule as getFullTeacherSchedule } from './teacher-actions';

const calculateCGPA = (allMarksData: { grade: string | null; credits: number | null }[]): number | null => {
    let totalCreditPoints = 0; let totalCreditsAttempted = 0;
    const getGradePoint = (grade: string | null): number | null => {
        if (!grade) return null;
        switch (grade.toUpperCase()) {
            case 'O': return 10; case 'A+': return 9; case 'A': return 8; case 'B+': return 7;
            case 'B': return 6; case 'C+': return 5; case 'C': return 4; case 'P': return 3;
            case 'FAIL': case 'F': return 0; default: return null;
        }
    };
    allMarksData.forEach((mark) => {
        if (mark.credits && typeof mark.credits === 'number' && mark.credits > 0) {
            const gradePoint = getGradePoint(mark.grade);
            if (gradePoint !== null) { totalCreditPoints += gradePoint * mark.credits; totalCreditsAttempted += mark.credits; }
        }
    });
    if (totalCreditsAttempted === 0) return null;
    return parseFloat((totalCreditPoints / totalCreditsAttempted).toFixed(2));
};

export async function getStudentProfileDetails(studentDocId: string): Promise<FullStudentData | null> {
    if (!studentDocId) return null;
    try {
        const studentData = await findOneWhere<any>('students', (s) => s.id === studentDocId);
        if (!studentData) return null;
        const studentUid = studentData.user_uid || studentData.id;

        const attendanceRecs = await findWhere<any>('attendance', (a) => a.studentId === studentDocId);
        const attendance: any = { overallPercentage: null, recentAbsences: null };
        if (attendanceRecs.length > 0) {
            const totalClasses = attendanceRecs.length;
            const presentClasses = attendanceRecs.filter((a: any) => a.status === 'Present').length;
            attendance.overallPercentage = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 100;
        }

        const marksRecs = await findWhere<any>('marks', (m) => m.studentId === studentDocId);
        const classMap = new Map<string, any>();
        (await readCollection<any>('classes')).forEach((c: any) => classMap.set(c.id, c));
        const courseMap = new Map<string, any>();
        (await readCollection<any>('courses')).forEach((c: any) => { courseMap.set(c.id, c); courseMap.set(c.courseId, c); });

        const allMarksData = marksRecs.map((markData: any) => {
            const classData = classMap.get(markData.classId);
            const courseData = classData ? (courseMap.get(classData.courseId) || courseMap.get(classData.id)) : null;
            return { grade: markData.grade || null, credits: courseData?.credits || null };
        });

        const marks: any = { cgpa: calculateCGPA(allMarksData), recentGrades: allMarksData.slice(-5).filter((m: any) => m.grade).map((m: any) => ({ course: 'Course', grade: m.grade! })) };

        const feeRec = await findOneWhere<any>('fees', (f) => f.id === studentDocId);
        const fees = feeRec ? { balance: feeRec.balance, status: feeRec.balance <= 0 ? 'Paid' : 'Pending' } : { balance: 0, status: 'N/A' };

        const hostelInfo = studentData.hostelId ? { hostelName: 'Hostel', roomNumber: studentData.roomNumber || null } : null;
        const enrolledClasses = await findWhere<any>('classes', (c) => (c.studentUids || []).includes(studentUid));
        const coursesEnrolled = enrolledClasses.map((c: any) => c.courseName || c.courseId);

        return { profile: studentData as Student, attendance, marks, fees, hostelInfo, coursesEnrolled };
    } catch (error) {
        console.error('Error in getStudentProfileDetails:', error);
        return null;
    }
}

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

export async function getAdminDashboardStats(): Promise<AdminDashboardData> {
    try {
        const supabase = await createServerSupabaseClient();
        
        const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true });
        const { count: totalTeachers } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
        
        const { data: courses } = await supabase.from('courses').select('program');
        const uniquePrograms = new Set(courses?.map(c => c.program).filter(Boolean));
        const totalPrograms = uniquePrograms.size;

        const { data: fees } = await supabase.from('fees').select('total_amount, paid_amount');
        let collectionRate = 0;
        if (fees && fees.length > 0) {
            const sumPaid = fees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
            const sumTotal = fees.reduce((sum, f) => sum + (f.total_amount || 0), 0);
            collectionRate = sumTotal > 0 ? Math.round((sumPaid / sumTotal) * 100) : 0;
        }
           
        // Distribution
        const { data: students } = await supabase.from('students').select('branch');
        const branchDist: Record<string, number> = {};
        students?.forEach(s => {
            if (s.branch) branchDist[s.branch] = (branchDist[s.branch] || 0) + 1;
        });
        const studentDistribution = Object.entries(branchDist)
            .map(([branch, count]) => ({ branch, count }))
            .sort((a, b) => b.count - a.count);

        // Overall attendance avg
        const { data: attendanceData } = await supabase.from('attendance').select('status');
        const totalAtt = attendanceData?.length || 0;
        const presentAtt = attendanceData?.filter(a => a.status === 'present').length || 0;
        const overallAttPct = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

        // Mock trend
        const attendanceTrend = [
            { month: 'Jan', attendance: overallAttPct || 85 },
            { month: 'Feb', attendance: overallAttPct || 88 }
        ];

        // Recent users
        const { data: recentProfiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(5);
        const recentLogins = recentProfiles?.map(p => ({
            id: p.id,
            userName: p.full_name || 'System Admin',
            userRole: p.role,
            timestamp: p.created_at || new Date().toISOString()
        })) || [];

        return { 
           totalStudents: totalStudents || 0, 
           totalTeachers: totalTeachers || 0, 
           totalPrograms, 
           pendingApprovals: 0, 
           collectionRate, 
           attendanceTrend, 
           recentLogins, 
           studentDistribution 
        };
    } catch (error) {
        console.error('Error in getAdminDashboardStats:', error);
        throw new Error('Failed to fetch admin dashboard stats.');
    }
}

export async function getTeacherDashboardData(teacherUid: string, extraIds?: { staffDocId?: string | null; email?: string | null }): Promise<TeacherDashboardData> {
    const profile = await getTeacherProfileDetails(teacherUid, extraIds);
    if (!profile) throw new Error("Teacher profile not found. Your detailed teacher record may not exist in the database. Please contact an administrator to verify your profile has been created.");

    const coursesAssigned = profile.coursesAssigned.map((c: any) => ({
        id: c.id,
        name: c.name || c.courseName,
        studentCount: c.studentCount || 0
    }));

    const upcomingClasses = profile.schedule ? profile.schedule.slice(0, 3).map((s: any) => {
        const slot = PERIOD_SLOTS[s.period];
        return {
            time: slot ? slot.title : `Period ${s.period}`,
            course: s.courseName,
            class: s.class,
            location: 'Room'
        };
    }) : [];

    // ── Exam-aware pending marks ──
    // Only show pending marks count when there are published (Scheduled) exams
    // for the teacher's classes
    const teacherClassIds = profile.coursesAssigned.map((c: any) => c.id);
    const teacherPrograms = profile.coursesAssigned.map((c: any) => {
        const parts = (c.class || '').split('-');
        return { program: parts[0]?.trim(), branch: parts[1]?.split('(')[0]?.trim() };
    });

    let hasPublishedExams = false;
    let pendingMarksCount = 0;
    try {
        const allExams = await readCollection<any>('exams');
        const relevantExams = allExams.filter((exam: any) => {
            if (exam.status === 'Cancelled') return false;
            return teacherPrograms.some((tp: any) =>
                tp.program && exam.program === tp.program && exam.branch === tp.branch
            );
        });
        hasPublishedExams = relevantExams.length > 0;
        if (hasPublishedExams) {
            pendingMarksCount = profile.studentsCount || 0;
        }
    } catch (e) {
        console.error('Error checking exams for pending marks:', e);
    }

    // ── Pending attendance: check today's schedule for periods already done ──
    const pendingAttendance: PendingAttendanceItem[] = [];
    try {
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayDay = days[now.getDay()];
        const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Get today's schedule for this teacher
        const todaySchedule = (profile.schedule || []).filter((s: any) => s.day === todayDay);

        for (const entry of todaySchedule) {
            const slot = PERIOD_SLOTS[entry.period];
            if (!slot) continue;

            // Only check periods whose end time has passed
            const endMinutes = slot.end[0] * 60 + slot.end[1];
            if (currentMinutes < endMinutes) continue;

            // Check if attendance was already recorded for this class/date/period
            const classId = entry.classId;
            if (!classId) continue;

            const supabaseCheck = await createServerSupabaseClient();
            const { data: attendanceRows } = await supabaseCheck
                .from('attendance')
                .select('id')
                .eq('class_id', classId)
                .eq('date', todayDate)
                .eq('period', entry.period)
                .limit(1);
            const attendanceExists = attendanceRows && attendanceRows.length > 0;

            if (!attendanceExists) {
                pendingAttendance.push({
                    period: entry.period,
                    periodTitle: slot.title,
                    courseName: entry.courseName || entry.courseCode,
                    className: entry.class || '',
                    classId: classId,
                });
            }
        }
    } catch (e) {
        console.error('Error checking pending attendance:', e);
    }

    return {
        name: profile.profile.name,
        coursesTeaching: coursesAssigned,
        upcomingClasses,
        pendingMarksCount,
        hasPublishedExams,
        pendingAttendance,
    };
}

export async function getTeacherProfileDetails(teacherUid: string, extraIds?: { staffDocId?: string | null; email?: string | null }): Promise<any | null> {
    if (!teacherUid) return null;
    try {
        const supabase = await createServerSupabaseClient();

        // Primary lookup: teacher whose profile_id matches the logged-in user's auth UID
        let { data: teacherData, error } = await supabase
            .from('teachers')
            .select('*, profiles(full_name, email)')
            .eq('profile_id', teacherUid)
            .maybeSingle();

        // Fallback: look up by the teachers.id primary key (used by some legacy callers)
        if (!teacherData && extraIds?.staffDocId) {
            const { data: byId } = await supabase
                .from('teachers')
                .select('*, profiles(full_name, email)')
                .eq('id', extraIds.staffDocId)
                .maybeSingle();
            if (byId) teacherData = byId;
        }

        if (!teacherData) return null;

        const resolvedTeacherId = teacherData.id; // Supabase PK
        const schedule = await getFullTeacherSchedule(resolvedTeacherId);

        // Fetch classes assigned to this teacher
        const { data: teacherClasses } = await supabase
            .from('classes')
            .select('id, name, courses(id, name, code)')
            .eq('teacher_id', resolvedTeacherId);

        const classRows = teacherClasses || [];

        // Count unique students across all classes
        const { count: studentsCount } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .in('class_id', classRows.map((c: any) => c.id));

        const coursesAssigned = classRows.map((c: any) => {
            const course = Array.isArray(c.courses) ? c.courses[0] : c.courses;
            return {
                id: c.id,
                code: course?.code || '',
                name: course?.name || c.name,
                class: c.name,
                studentCount: 0 // populated lazily
            };
        });

        return {
            profile: {
                ...teacherData,
                // Normalize name so callers can use profile.profile.name
                name: (teacherData.profiles as any)?.full_name || teacherData.full_name || 'Teacher'
            },
            coursesAssigned,
            studentsCount: studentsCount || 0,
            classAttendanceRate: null,
            schedule
        };
    } catch (error) {
        console.error('Error in getTeacherProfileDetails:', error);
        return null;
    }
}

export async function getStudentDashboardData(studentDocId: string): Promise<StudentDashboardData | null> {
    if (!studentDocId) return null;
    try {
        const [studentProfile, schedule] = await Promise.all([
            getStudentProfileDetails(studentDocId),
            getStudentSchedule(studentDocId),
        ]);
        if (!studentProfile) return null;

        const examRecs = (await findWhere<any>('exams', (e) => e.program === (studentProfile.profile as any).program && e.branch === (studentProfile.profile as any).branch && e.status === 'Scheduled'))
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 5);

        const userId = (studentProfile.profile as any).user_uid || studentDocId;
        const notifications = (await findWhere<any>('notifications', (n) => n.recipientUid === userId))
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10);

        return {
            overallAttendance: studentProfile.attendance?.overallPercentage || null,
            coursesEnrolledCount: studentProfile.coursesEnrolled?.length || 0,
            upcomingExam: examRecs.length > 0 ? { sessionName: examRecs[0].examSessionName, courseName: examRecs[0].courseName || 'Course', date: examRecs[0].date } : null,
            schedule,
        };
    } catch (error) {
        console.error('Error in getStudentDashboardData:', error);
        return null;
    }
}

export interface EmployeeDashboardData {
    employeeType: string;
    // Fee Management
    totalFees?: number;
    collectedFees?: number;
    pendingFees?: number;
    collectionRate?: number;
    // Hostel Management
    totalRooms?: number;
    occupiedRooms?: number;
    availableRooms?: number;
    totalHostelStudents?: number;
    // Exam Management
    totalExams?: number;
    // Library Management
    totalBooks?: number;
    availableBooks?: number;
    issuedBooks?: number;
    // User management
    adminStats?: AdminDashboardData;
}

export async function getEmployeeDashboardStats(profileId: string): Promise<EmployeeDashboardData> {
    const supabase = await createServerSupabaseClient();
    const { data: employee } = await supabase.from('employees').select('employee_type').eq('profile_id', profileId).single();
    if (!employee) throw new Error("Employee not found");

    const employeeType = employee.employee_type;
    const result: EmployeeDashboardData = { employeeType };

    if (employeeType === 'student_staff_management') {
         result.adminStats = await getAdminDashboardStats();
    } else if (employeeType === 'fee_management') {
         const { data: fees } = await supabase.from('fees').select('total_amount, paid_amount');
         let collected = 0; let total = 0;
         fees?.forEach(f => {
            collected += (f.paid_amount || 0);
            total += (f.total_amount || 0);
         });
         result.totalFees = total;
         result.collectedFees = collected;
         result.pendingFees = total - collected;
         result.collectionRate = total > 0 ? Math.round((collected / total) * 100) : 0;
    } else if (employeeType === 'hostel_management') {
         const { data: rooms } = await supabase.from('hostel_rooms').select('capacity, occupied');
         let totalBeds = 0; let occupiedBeds = 0; let totalRoomsCount = rooms?.length || 0;
         rooms?.forEach(r => {
             totalBeds += r.capacity || 0;
             occupiedBeds += r.occupied || 0;
         });
         const { count: students } = await supabase.from('students').select('*', { count: 'exact', head: true }).not('hostel_roomId', 'is', null);
         result.totalRooms = totalRoomsCount;
         result.occupiedRooms = occupiedBeds;
         result.availableRooms = totalBeds - occupiedBeds;
         result.totalHostelStudents = students || occupiedBeds;
    } else if (employeeType === 'exam_marks_management') {
         const { count: scheduleCount } = await supabase.from('exam_schedule').select('*', { count: 'exact', head: true });
         result.totalExams = scheduleCount || 0;
    } else if (employeeType === 'library_management') {
         const { data: books } = await supabase.from('books').select('total_copies, available_copies');
         let total = 0; let available = 0;
         books?.forEach(b => {
             total += b.total_copies || 0;
             available += b.available_copies || 0;
         });
         result.totalBooks = total;
         result.availableBooks = available;
         result.issuedBooks = total - available;
    }

    return result;
}
