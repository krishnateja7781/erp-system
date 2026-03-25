// ============================================================
// Admin Service Layer — Controlled, filtered data access
// Uses aggregation-style queries for institution-wide analytics.
// NEVER returns raw DB objects.
// ============================================================

import { readCollection, findWhere, findOneByField } from '@/lib/db';

// ── Helpers ──

function todayISO(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ── Service Functions ──

/**
 * Get total student count.
 * Returns ONLY { total, active, pending }.
 */
export async function getTotalStudents() {
  const students = await readCollection<any>('students');

  const active = students.filter((s: any) => s.status === 'Active').length;
  const pending = students.filter((s: any) => s.status === 'Pending Approval').length;

  return {
    total: students.length,
    active,
    pending,
    status: 'ok',
  };
}

/**
 * Get total teacher count.
 * Returns ONLY { total }.
 */
export async function getTotalTeachers() {
  const teachers = await readCollection<any>('teachers');

  return {
    total: teachers.length,
    status: 'ok',
  };
}

/**
 * Get overall attendance percentage across institution.
 * Returns ONLY { overallPercentage, totalRecords, presentCount }.
 */
export async function getOverallAttendance() {
  const attendanceRecs = await readCollection<any>('attendance');

  if (attendanceRecs.length === 0) {
    return { overallPercentage: null, totalRecords: 0, presentCount: 0, status: 'no_data' };
  }

  const totalRecords = attendanceRecs.length;
  const presentCount = attendanceRecs.filter((a: any) => a.status === 'Present').length;
  const overallPercentage = Math.round((presentCount / totalRecords) * 100);

  return { overallPercentage, totalRecords, presentCount, status: 'ok' };
}

/**
 * Get fee collection summary.
 * Returns ONLY { totalFees, totalCollected, totalPending, collectionRate }.
 */
export async function getFeeSummary() {
  const fees = await readCollection<any>('fees');

  if (fees.length === 0) {
    return { totalFees: 0, totalCollected: 0, totalPending: 0, collectionRate: 0, studentCount: 0, status: 'no_data' };
  }

  const totalFees = fees.reduce((sum: number, f: any) => sum + (f.totalFees || 0), 0);
  const totalCollected = fees.reduce((sum: number, f: any) => sum + (f.amountPaid || 0), 0);
  const totalPending = totalFees - totalCollected;
  const collectionRate = totalFees > 0 ? Math.round((totalCollected / totalFees) * 100) : 0;

  const fullyPaid = fees.filter((f: any) => (f.balance || 0) <= 0).length;
  const pendingPayments = fees.length - fullyPaid;

  return {
    totalFees,
    totalCollected,
    totalPending,
    collectionRate,
    studentCount: fees.length,
    fullyPaid,
    pendingPayments,
    status: 'ok',
  };
}

/**
 * Get hostel occupancy stats.
 * Returns ONLY [ { hostelName, capacity, occupied, occupancyRate } ].
 */
export async function getHostelOccupancy() {
  const hostels = await readCollection<any>('hostels');

  if (hostels.length === 0) {
    return { hostels: [], totalCapacity: 0, totalOccupied: 0, status: 'no_data' };
  }

  const hostelStats = hostels.map((h: any) => ({
    hostelName: h.name || 'Unknown',
    type: h.type || 'N/A',
    capacity: h.capacity || 0,
    occupied: h.occupied || 0,
    occupancyRate: h.capacity > 0 ? Math.round((h.occupied / h.capacity) * 100) : 0,
    hostelStatus: h.status || 'Unknown',
  }));

  const totalCapacity = hostelStats.reduce((sum: number, h: any) => sum + h.capacity, 0);
  const totalOccupied = hostelStats.reduce((sum: number, h: any) => sum + h.occupied, 0);

  return {
    hostels: hostelStats,
    totalCapacity,
    totalOccupied,
    overallOccupancy: totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0,
    status: 'ok',
  };
}

/**
 * Get performance analytics across institution.
 * Returns ONLY { overallPassRate, averageMarks, gradeDistribution }.
 */
export async function getPerformanceAnalytics() {
  const allMarks = await readCollection<any>('marks');

  if (allMarks.length === 0) {
    return { overallPassRate: null, averageMarks: null, gradeDistribution: {}, totalRecords: 0, status: 'no_data' };
  }

  const totals = allMarks.map((m: any) => m.total || m.totalmarks || 0);
  const averageMarks = Math.round(totals.reduce((a: number, b: number) => a + b, 0) / totals.length);

  const passed = allMarks.filter((m: any) => {
    const g = (m.grade || '').toUpperCase();
    return g !== 'FAIL' && g !== 'F' && g !== '';
  }).length;
  const overallPassRate = Math.round((passed / allMarks.length) * 100);

  // Grade distribution
  const gradeDistribution: Record<string, number> = {};
  for (const m of allMarks) {
    const g = (m.grade || 'N/A').toUpperCase();
    gradeDistribution[g] = (gradeDistribution[g] || 0) + 1;
  }

  return {
    overallPassRate,
    averageMarks,
    gradeDistribution,
    totalRecords: allMarks.length,
    status: 'ok',
  };
}

/**
 * Get upcoming exam schedules.
 * Returns ONLY [ { courseName, date, program, branch } ].
 */
export async function getExamSchedules() {
  const today = todayISO();
  const exams = await findWhere<any>('exams', (e) => e.status === 'Scheduled' && e.date >= today);

  if (exams.length === 0) {
    return { exams: [], status: 'no_exams' };
  }

  const sorted = exams
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 15)
    .map((e: any) => ({
      courseName: e.courseName || e.courseCode || 'Course',
      date: e.date,
      startTime: e.startTime || '',
      endTime: e.endTime || '',
      program: e.program || '',
      branch: e.branch || '',
      sessionName: e.examSessionName || '',
    }));

  return { exams: sorted, status: 'ok' };
}

/**
 * Get student distribution by branch.
 * Returns ONLY [ { branch, count } ].
 */
export async function getStudentDistribution() {
  const students = await readCollection<any>('students');
  const activeStudents = students.filter((s: any) => s.status === 'Active');

  if (activeStudents.length === 0) {
    return { distribution: [], status: 'no_data' };
  }

  const branchDist: Record<string, number> = {};
  activeStudents.forEach((s: any) => {
    const branch = s.branch || 'Unknown';
    branchDist[branch] = (branchDist[branch] || 0) + 1;
  });

  const distribution = Object.entries(branchDist)
    .map(([branch, count]) => ({ branch, count }))
    .sort((a, b) => b.count - a.count);

  return { distribution, total: activeStudents.length, status: 'ok' };
}

/**
 * Get pending student approvals.
 */
export async function getPendingApprovals() {
  const students = await readCollection<any>('students');
  const pending = students.filter((s: any) => s.status === 'Pending Approval');

  if (pending.length === 0) {
    return { count: 0, students: [], status: 'none_pending' };
  }

  const pendingList = pending.slice(0, 10).map((s: any) => ({
    name: s.name || 'Unknown',
    program: s.program || 'N/A',
    branch: s.branch || 'N/A',
  }));

  return { count: pending.length, students: pendingList, status: 'ok' };
}

/**
 * Get recent login activities.
 */
export async function getRecentLogins() {
  const logins = await readCollection<any>('loginActivities');

  if (logins.length === 0) {
    return { logins: [], status: 'no_data' };
  }

  const sorted = logins
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10)
    .map((l: any) => ({
      userName: l.userName || 'Unknown',
      userRole: l.userRole || 'user',
      timestamp: l.timestamp || '',
    }));

  return { logins: sorted, status: 'ok' };
}

/**
 * Get courses overview.
 */
export async function getCoursesOverview() {
  const courses = await readCollection<any>('courses');

  if (courses.length === 0) {
    return { totalCourses: 0, programs: [] as string[], totalPrograms: 0, status: 'no_data' };
  }

  const programSet = new Set<string>();
  courses.forEach((c: any) => { if (c.program) programSet.add(c.program); });

  return {
    totalCourses: courses.length,
    programs: Array.from(programSet),
    totalPrograms: programSet.size,
    status: 'ok',
  };
}

/**
 * Get details of a specific hostel by name (partial match).
 * Returns hostel info with warden, rooms, complaints.
 */
export async function getHostelDetails(hostelSearch: string) {
  const hostels = await readCollection<any>('hostels');

  if (hostels.length === 0) {
    return { found: false, hostel: null, query: hostelSearch, status: 'no_data' };
  }

  const searchLower = hostelSearch.toLowerCase().replace(/\s+/g, ' ').trim();

  // Try exact-ish match first, then fuzzy
  let match = hostels.find((h: any) => {
    const name = (h.name || '').toLowerCase();
    return name === searchLower || name.includes(searchLower) || searchLower.includes(name);
  });

  // Fallback: match by type + number fragments
  if (!match) {
    const isBoys = /boys?/i.test(searchLower);
    const isGirls = /girls?/i.test(searchLower);
    const numMatch = searchLower.match(/(\d+)/);
    const num = numMatch ? numMatch[1] : null;

    match = hostels.find((h: any) => {
      const name = (h.name || '').toLowerCase();
      const type = (h.type || '').toLowerCase();
      const typeMatch = (isBoys && (type === 'boys' || name.includes('boys'))) ||
                        (isGirls && (type === 'girls' || name.includes('girls')));
      const numFound = num ? name.includes(num) : true;
      return typeMatch && numFound;
    });
  }

  // Last fallback: just match any hostel containing a number if specified
  if (!match) {
    const numMatch = searchLower.match(/(\d+)/);
    if (numMatch) {
      match = hostels.find((h: any) => (h.name || '').includes(numMatch[1]));
    }
  }

  if (!match) {
    // Return list of available hostels so user can pick
    return {
      found: false,
      hostel: null,
      query: hostelSearch,
      availableHostels: hostels.map((h: any) => h.name || 'Unknown'),
      status: 'not_found',
    };
  }

  // Fetch rooms for this hostel
  let rooms: any[] = [];
  try {
    rooms = await findWhere<any>('rooms', (r: any) => r.hostelId === match.id);
  } catch { /* rooms collection may not exist */ }

  // Fetch complaints for this hostel
  let complaints: any[] = [];
  try {
    complaints = await findWhere<any>('complaints', (c: any) => c.hostelId === match.id);
  } catch { /* complaints collection may not exist */ }

  return {
    found: true,
    hostel: {
      name: match.name || 'Unknown',
      type: match.type || 'N/A',
      status: match.status || 'Unknown',
      capacity: match.capacity || 0,
      occupied: match.occupied || 0,
      occupancyRate: match.capacity > 0 ? Math.round((match.occupied / match.capacity) * 100) : 0,
      warden: match.warden || null,
      amenities: match.amenities || [],
      rules: match.rulesHighlight || [],
      roomCount: rooms.length,
      rooms: rooms.slice(0, 20).map((r: any) => ({
        roomNumber: r.roomNumber || r.room_number || 'N/A',
        capacity: r.capacity || 0,
        residents: Array.isArray(r.residents) ? r.residents.length : 0,
      })),
      complaintCount: complaints.length,
      pendingComplaints: complaints.filter((c: any) => c.status !== 'Resolved').length,
    },
    query: hostelSearch,
    status: 'found',
  };
}

/**
 * Get warden details for a specific hostel (or all wardens).
 */
export async function getWardenDetails(hostelSearch: string | null) {
  const hostels = await readCollection<any>('hostels');

  if (hostels.length === 0) {
    return { found: false, wardens: [], query: hostelSearch, status: 'no_data' };
  }

  // If a specific hostel is mentioned, find that one
  if (hostelSearch) {
    const result = await getHostelDetails(hostelSearch);
    if (result.found && result.hostel?.warden) {
      return {
        found: true,
        wardens: [{
          hostelName: result.hostel.name,
          hostelType: result.hostel.type,
          ...result.hostel.warden,
        }],
        query: hostelSearch,
        status: 'found',
      };
    }
    return {
      found: false,
      wardens: [],
      query: hostelSearch,
      availableHostels: hostels.map((h: any) => h.name || 'Unknown'),
      status: 'not_found',
    };
  }

  // No specific hostel → return all wardens
  const wardens = hostels
    .filter((h: any) => h.warden)
    .map((h: any) => ({
      hostelName: h.name || 'Unknown',
      hostelType: h.type || 'N/A',
      name: h.warden.name || 'N/A',
      contact: h.warden.contact || 'N/A',
      email: h.warden.email || 'N/A',
      office: h.warden.office || 'N/A',
    }));

  return {
    found: wardens.length > 0,
    wardens,
    query: hostelSearch,
    status: wardens.length > 0 ? 'found' : 'no_data',
  };
}

/**
 * Get hostel room details for a specific hostel.
 */
export async function getHostelRooms(hostelSearch: string | null) {
  const hostels = await readCollection<any>('hostels');

  if (hostels.length === 0) {
    return { found: false, rooms: [], hostelName: null, status: 'no_data' };
  }

  // If a specific hostel is mentioned, find rooms for it
  if (hostelSearch) {
    const result = await getHostelDetails(hostelSearch);
    if (result.found && result.hostel) {
      return {
        found: true,
        rooms: result.hostel.rooms,
        hostelName: result.hostel.name,
        totalRooms: result.hostel.roomCount,
        capacity: result.hostel.capacity,
        occupied: result.hostel.occupied,
        status: 'found',
      };
    }
    return {
      found: false,
      rooms: [],
      hostelName: null,
      availableHostels: result.availableHostels,
      status: 'not_found',
    };
  }

  // No specific hostel → aggregate rooms across all hostels
  let allRooms: any[] = [];
  try {
    allRooms = await readCollection<any>('rooms');
  } catch { /* rooms collection may not exist */ }

  return {
    found: allRooms.length > 0,
    rooms: allRooms.slice(0, 20).map((r: any) => ({
      roomNumber: r.roomNumber || r.room_number || 'N/A',
      capacity: r.capacity || 0,
      residents: Array.isArray(r.residents) ? r.residents.length : 0,
    })),
    hostelName: 'All Hostels',
    totalRooms: allRooms.length,
    status: allRooms.length > 0 ? 'found' : 'no_data',
  };
}

/**
 * Get complaints summary (overall or for a specific hostel).
 */
export async function getComplaintsSummary(hostelSearch: string | null) {
  let complaints: any[] = [];
  try {
    complaints = await readCollection<any>('complaints');
  } catch {
    return { totalComplaints: 0, pending: 0, resolved: 0, complaints: [], status: 'no_data' };
  }

  if (complaints.length === 0) {
    return { totalComplaints: 0, pending: 0, resolved: 0, complaints: [], status: 'no_data' };
  }

  // Filter by hostel if specified
  if (hostelSearch) {
    const hostelResult = await getHostelDetails(hostelSearch);
    if (hostelResult.found && hostelResult.hostel) {
      const hostelComplaints = complaints.filter((c: any) => c.hostelId === hostelResult.hostel!.name || c.hostelName === hostelResult.hostel!.name);
      const pending = hostelComplaints.filter((c: any) => c.status !== 'Resolved');
      const resolved = hostelComplaints.filter((c: any) => c.status === 'Resolved');
      return {
        totalComplaints: hostelComplaints.length,
        pending: pending.length,
        resolved: resolved.length,
        hostelName: hostelResult.hostel.name,
        complaints: hostelComplaints.slice(0, 10).map((c: any) => ({
          title: c.title || c.subject || 'Complaint',
          status: c.status || 'Pending',
          date: c.createdAt || c.date || '',
          studentName: c.studentName || 'N/A',
        })),
        status: 'found',
      };
    }
  }

  // Overall complaints summary
  const pending = complaints.filter((c: any) => c.status !== 'Resolved');
  const resolved = complaints.filter((c: any) => c.status === 'Resolved');

  return {
    totalComplaints: complaints.length,
    pending: pending.length,
    resolved: resolved.length,
    complaints: pending.slice(0, 10).map((c: any) => ({
      title: c.title || c.subject || 'Complaint',
      status: c.status || 'Pending',
      date: c.createdAt || c.date || '',
      studentName: c.studentName || 'N/A',
    })),
    status: 'ok',
  };
}

/**
 * Look up a student by USN (collegeId) or name.
 */
export async function lookupStudent(searchType: 'usn' | 'name', searchValue: string) {
  if (searchType === 'usn') {
    const student = await findOneByField<any>('students', 'collegeId', searchValue);
    if (!student) {
      return { found: false, students: [], query: searchValue, queryType: 'usn' as const, status: 'not_found' };
    }
    return {
      found: true,
      students: [{
        name: student.name || 'N/A',
        collegeId: student.collegeId || 'N/A',
        email: student.email || 'N/A',
        program: student.program || 'N/A',
        branch: student.branch || 'N/A',
        year: student.year || 'N/A',
        semester: student.semester || 'N/A',
        section: student.section || 'N/A',
        status: student.status || 'N/A',
        type: student.type || 'N/A',
        phone: student.phone || 'N/A',
      }],
      query: searchValue,
      queryType: 'usn' as const,
      status: 'found',
    };
  }

  // Name-based search — case insensitive partial match
  const searchLower = searchValue.toLowerCase();
  const matches = await findWhere<any>('students', (s: any) =>
    s.name && s.name.toLowerCase().includes(searchLower)
  );

  if (matches.length === 0) {
    return { found: false, students: [], query: searchValue, queryType: 'name' as const, status: 'not_found' };
  }

  return {
    found: true,
    students: matches.slice(0, 10).map((s: any) => ({
      name: s.name || 'N/A',
      collegeId: s.collegeId || 'N/A',
      email: s.email || 'N/A',
      program: s.program || 'N/A',
      branch: s.branch || 'N/A',
      year: s.year || 'N/A',
      semester: s.semester || 'N/A',
      section: s.section || 'N/A',
      status: s.status || 'N/A',
      type: s.type || 'N/A',
      phone: s.phone || 'N/A',
    })),
    query: searchValue,
    queryType: 'name' as const,
    status: 'found',
  };
}

/**
 * Look up a teacher/staff by name.
 */
export async function lookupTeacher(searchValue: string) {
  const searchLower = searchValue.toLowerCase();
  const matches = await findWhere<any>('teachers', (t: any) =>
    t.name && t.name.toLowerCase().includes(searchLower)
  );

  if (matches.length === 0) {
    return { found: false, teachers: [], query: searchValue, status: 'not_found' };
  }

  return {
    found: true,
    teachers: matches.slice(0, 10).map((t: any) => ({
      name: t.name || 'N/A',
      staffId: t.staffId || t.id || 'N/A',
      email: t.email || 'N/A',
      department: t.department || 'N/A',
      designation: t.designation || 'N/A',
      phone: t.phone || 'N/A',
    })),
    query: searchValue,
    status: 'found',
  };
}

// ================================================================
// CLASSES
// ================================================================

/**
 * Get all classes overview with teacher/student counts.
 */
export async function getClassesOverview() {
  const classes = await readCollection<any>('classes');

  if (classes.length === 0) {
    return { totalClasses: 0, branchBreakdown: [], branches: [], totalStudentsEnrolled: 0, status: 'no_data' };
  }

  const branchSet = new Set<string>();
  let totalStudents = 0;
  classes.forEach((c: any) => {
    if (c.branch) branchSet.add(c.branch);
    totalStudents += c.studentCount || 0;
  });

  const byBranch: Record<string, number> = {};
  classes.forEach((c: any) => {
    const branch = c.branch || 'Unknown';
    byBranch[branch] = (byBranch[branch] || 0) + 1;
  });

  return {
    totalClasses: classes.length,
    branchBreakdown: Object.entries(byBranch)
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => b.count - a.count),
    branches: Array.from(branchSet).sort(),
    totalStudentsEnrolled: totalStudents,
    status: 'ok',
  };
}

/**
 * Look up classes by branch / year / semester / section.
 */
export async function lookupClasses(filters: { branch?: string; year?: number; semester?: number }) {
  const classes = await readCollection<any>('classes');

  if (classes.length === 0) {
    return { found: false, classes: [] as any[], totalMatches: 0, filters, status: 'no_data' };
  }

  let filtered = classes;
  if (filters.branch) {
    const b = filters.branch.toUpperCase();
    filtered = filtered.filter((c: any) => (c.branch || '').toUpperCase() === b);
  }
  if (filters.year) {
    filtered = filtered.filter((c: any) => c.year === filters.year);
  }
  if (filters.semester) {
    filtered = filtered.filter((c: any) => c.semester === filters.semester);
  }

  if (filtered.length === 0) {
    return { found: false, classes: [] as any[], totalMatches: 0, filters, status: 'not_found' };
  }

  return {
    found: true,
    classes: filtered.slice(0, 20).map((c: any) => ({
      courseName: c.courseName || 'N/A',
      courseId: c.courseId || 'N/A',
      branch: c.branch || 'N/A',
      year: c.year || 'N/A',
      semester: c.semester || 'N/A',
      section: c.section || 'N/A',
      teacherName: c.teacherName || 'N/A',
      studentCount: c.studentCount || 0,
      credits: c.credits || 0,
    })),
    totalMatches: filtered.length,
    filters,
    status: 'found',
  };
}

// ================================================================
// COURSE LOOKUP
// ================================================================

/**
 * Look up a specific course by courseId or name.
 */
export async function lookupCourse(search: string) {
  const courses = await readCollection<any>('courses');

  if (courses.length === 0) {
    return { found: false, courses: [], query: search, status: 'no_data' };
  }

  const searchLower = search.toLowerCase();

  // Try exact courseId match first
  let matches = courses.filter((c: any) =>
    (c.courseId || '').toLowerCase() === searchLower
  );

  // Then partial name match
  if (matches.length === 0) {
    matches = courses.filter((c: any) =>
      (c.courseName || c.name || '').toLowerCase().includes(searchLower) ||
      (c.courseId || '').toLowerCase().includes(searchLower)
    );
  }

  if (matches.length === 0) {
    return { found: false, courses: [], query: search, status: 'not_found' };
  }

  // Enrich with teacher info from classes
  const classes = await readCollection<any>('classes');

  return {
    found: true,
    courses: matches.slice(0, 10).map((c: any) => {
      const teachingClasses = classes.filter((cl: any) => cl.courseId === c.courseId);
      return {
        courseId: c.courseId || 'N/A',
        name: c.courseName || c.name || 'N/A',
        program: c.program || 'N/A',
        branch: c.branch || 'N/A',
        semester: c.semester || 'N/A',
        credits: c.credits || 0,
        taughtBy: teachingClasses.map((cl: any) => ({
          teacherName: cl.teacherName || 'N/A',
          section: cl.section || 'N/A',
          year: cl.year || 'N/A',
        })),
      };
    }),
    query: search,
    status: 'found',
  };
}

// ================================================================
// BRANCH-SPECIFIC STUDENTS
// ================================================================

/**
 * Get students filtered by branch / year / semester.
 */
export async function getBranchStudents(filters: { branch?: string; year?: number; semester?: number }) {
  const students = await readCollection<any>('students');
  const active = students.filter((s: any) => s.status === 'Active');

  if (active.length === 0) {
    return { total: 0, bySection: [], sample: [], filters, status: 'no_data' };
  }

  let filtered = active;
  if (filters.branch) {
    const b = filters.branch.toUpperCase();
    filtered = filtered.filter((s: any) => (s.branch || '').toUpperCase() === b);
  }
  if (filters.year) {
    filtered = filtered.filter((s: any) => s.year === filters.year);
  }
  if (filters.semester) {
    filtered = filtered.filter((s: any) => s.semester === filters.semester);
  }

  // Group by section
  const bySectionMap: Record<string, number> = {};
  filtered.forEach((s: any) => {
    const sec = s.section || 'Unknown';
    bySectionMap[sec] = (bySectionMap[sec] || 0) + 1;
  });
  const bySection = Object.entries(bySectionMap)
    .map(([section, count]) => ({ section, count }))
    .sort((a, b) => a.section.localeCompare(b.section));

  return {
    total: filtered.length,
    bySection,
    filters,
    // Show a few sample students
    sample: filtered.slice(0, 5).map((s: any) => ({
      name: s.name || 'N/A',
      collegeId: s.collegeId || 'N/A',
      section: s.section || 'N/A',
      type: s.type || 'N/A',
    })),
    status: filtered.length > 0 ? 'ok' : 'not_found',
  };
}

// ================================================================
// PLACEMENTS & INTERNSHIPS
// ================================================================

/**
 * Get placement/internship overview.
 */
export async function getPlacementOverview() {
  let opportunities: any[] = [];
  try {
    opportunities = await readCollection<any>('placements');
  } catch { /* collection may not exist */ }

  let applications: any[] = [];
  try {
    applications = await readCollection<any>('applications');
  } catch { /* collection may not exist */ }

  const placements = opportunities.filter((o: any) => o.type === 'placement');
  const internships = opportunities.filter((o: any) => o.type === 'internship');

  const openPlacements = placements.filter((p: any) => p.status === 'Open');
  const closedPlacements = placements.filter((p: any) => p.status === 'Closed');
  const openInternships = internships.filter((i: any) => i.status === 'Open');

  // Application stats
  const totalApplications = applications.length;
  const offerExtended = applications.filter((a: any) => a.status === 'Offer Extended' || a.status === 'Offer Accepted').length;
  const shortlisted = applications.filter((a: any) => a.status === 'Shortlisted').length;
  const underReview = applications.filter((a: any) => a.status === 'Under Review').length;
  const rejected = applications.filter((a: any) => a.status === 'Rejected').length;

  // Unique companies
  const companies = new Set(opportunities.map((o: any) => o.company).filter(Boolean));

  return {
    totalPlacements: placements.length,
    openPlacements: openPlacements.length,
    closedPlacements: closedPlacements.length,
    totalInternships: internships.length,
    openInternships: openInternships.length,
    totalApplications,
    offerExtended,
    shortlisted,
    underReview,
    rejected,
    uniqueCompanies: companies.size,
    topCompanies: Array.from(companies).slice(0, 10),
    recentOpportunities: opportunities
      .sort((a: any, b: any) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
      .slice(0, 5)
      .map((o: any) => ({
        company: o.company || 'N/A',
        role: o.role || 'N/A',
        type: o.type || 'N/A',
        status: o.status || 'N/A',
        ctc: o.ctc_stipend || 'N/A',
      })),
    status: opportunities.length > 0 || applications.length > 0 ? 'ok' : 'no_data',
  };
}

// ================================================================
// APPLICATIONS OVERVIEW
// ================================================================

/**
 * Get applications overview with status breakdown.
 */
export async function getApplicationsOverview() {
  let applications: any[] = [];
  try {
    applications = await readCollection<any>('applications');
  } catch { /* collection may not exist */ }

  if (applications.length === 0) {
    return { total: 0, byStatus: {}, recentApplications: [], status: 'no_data' };
  }

  const byStatus: Record<string, number> = {};
  applications.forEach((a: any) => {
    const s = a.status || 'Unknown';
    byStatus[s] = (byStatus[s] || 0) + 1;
  });

  const recent = applications
    .sort((a: any, b: any) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    .slice(0, 10)
    .map((a: any) => ({
      studentName: a.studentName || 'N/A',
      company: a.company || 'N/A',
      role: a.role || 'N/A',
      status: a.status || 'N/A',
      type: a.opportunityType || 'N/A',
    }));

  return {
    total: applications.length,
    byStatus,
    recentApplications: recent,
    status: 'ok',
  };
}

// ================================================================
// NOTIFICATIONS
// ================================================================

/**
 * Get notifications summary.
 */
export async function getNotificationsSummary() {
  let notifications: any[] = [];
  try {
    notifications = await readCollection<any>('notifications');
  } catch { /* collection may not exist */ }

  if (notifications.length === 0) {
    return { total: 0, unread: 0, byType: {}, recent: [], status: 'no_data' };
  }

  const unread = notifications.filter((n: any) => !n.read).length;

  const byType: Record<string, number> = {};
  notifications.forEach((n: any) => {
    const t = n.type || 'info';
    byType[t] = (byType[t] || 0) + 1;
  });

  const recent = notifications
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8)
    .map((n: any) => ({
      title: n.title || 'Notification',
      type: n.type || 'info',
      timestamp: n.timestamp || '',
      read: !!n.read,
    }));

  return {
    total: notifications.length,
    unread,
    byType,
    recent,
    status: 'ok',
  };
}

// ================================================================
// TIMETABLE
// ================================================================

/**
 * Get timetable / schedule summary. File-based (src/data/timetable.json).
 */
export async function getTimetableSummary(filters: { branch?: string; semester?: number }) {
  let timetable: any[] = [];
  try {
    // Timetable is file-based
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'src', 'data', 'timetable.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    timetable = JSON.parse(raw);
  } catch {
    return { totalSlots: 0, branch: filters.branch || 'All', semester: filters.semester || 'All', byDay: {} as Record<string, any[]>, status: 'no_data' };
  }

  if (timetable.length === 0) {
    return { totalSlots: 0, branch: filters.branch || 'All', semester: filters.semester || 'All', byDay: {} as Record<string, any[]>, status: 'no_data' };
  }

  let filtered = timetable;
  if (filters.branch) {
    const b = filters.branch.toUpperCase();
    filtered = filtered.filter((s: any) => (s.branch || '').toUpperCase() === b);
  }
  if (filters.semester) {
    filtered = filtered.filter((s: any) => s.semester === filters.semester);
  }

  // Enrich with course names
  const courses = await readCollection<any>('courses');
  const courseMap: Record<string, string> = {};
  courses.forEach((c: any) => { courseMap[c.courseId] = c.courseName || c.name || c.courseId; });

  const teachers = await readCollection<any>('teachers');
  const teacherMap: Record<string, string> = {};
  teachers.forEach((t: any) => { teacherMap[t.id] = t.name || 'Unknown'; });

  // Group by day
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDay: Record<string, any[]> = {};
  days.forEach(d => { byDay[d] = []; });

  filtered.forEach((slot: any) => {
    const day = slot.day || 'Unknown';
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push({
      period: slot.period,
      courseId: slot.courseId,
      courseName: courseMap[slot.courseId] || slot.courseId || 'N/A',
      teacherName: teacherMap[slot.teacherId] || 'N/A',
      section: slot.section || 'N/A',
    });
  });

  // Sort periods within each day
  for (const day of days) {
    byDay[day].sort((a: any, b: any) => (a.period || 0) - (b.period || 0));
  }

  return {
    totalSlots: filtered.length,
    branch: filters.branch || 'All',
    semester: filters.semester || 'All',
    byDay,
    status: 'ok',
  };
}

// ================================================================
// CLASSROOMS (interactive)
// ================================================================

/**
 * Get classrooms overview.
 */
export async function getClassroomOverview() {
  let classrooms: any[] = [];
  try {
    classrooms = await readCollection<any>('classrooms');
  } catch { /* collection may not exist */ }

  if (classrooms.length === 0) {
    return { total: 0, classrooms: [], status: 'no_data' };
  }

  return {
    total: classrooms.length,
    classrooms: classrooms.slice(0, 15).map((c: any) => ({
      name: c.name || 'N/A',
      section: c.section || 'N/A',
      subject: c.subject || 'N/A',
      ownerName: c.ownerName || 'N/A',
      memberCount: Array.isArray(c.memberUids) ? c.memberUids.length : 0,
    })),
    status: 'ok',
  };
}

// ================================================================
// GENDER BREAKDOWN
// ================================================================

/**
 * Get boys/girls count, optionally filtered by branch.
 */
export async function getGenderBreakdown(branch?: string) {
  const students = await readCollection<any>('students');
  let active = students.filter((s: any) => s.status === 'Active');

  if (branch) {
    const b = branch.toUpperCase();
    active = active.filter((s: any) => (s.branch || '').toUpperCase() === b);
  }

  if (active.length === 0) {
    return { total: 0, boys: 0, girls: 0, other: 0, branch: branch || 'All', byBranch: [] as { branch: string; boys: number; girls: number }[], status: 'no_data' };
  }

  const boys = active.filter((s: any) => {
    const g = (s.gender || '').toLowerCase();
    return g === 'male' || g === 'm' || g === 'boy';
  }).length;

  const girls = active.filter((s: any) => {
    const g = (s.gender || '').toLowerCase();
    return g === 'female' || g === 'f' || g === 'girl';
  }).length;

  const other = active.length - boys - girls;

  // If no branch filter, also provide per-branch breakdown
  let byBranch: { branch: string; boys: number; girls: number }[] = [];
  if (!branch) {
    const branchMap: Record<string, { boys: number; girls: number }> = {};
    active.forEach((s: any) => {
      const br = s.branch || 'Unknown';
      if (!branchMap[br]) branchMap[br] = { boys: 0, girls: 0 };
      const g = (s.gender || '').toLowerCase();
      if (g === 'male' || g === 'm' || g === 'boy') branchMap[br].boys++;
      else if (g === 'female' || g === 'f' || g === 'girl') branchMap[br].girls++;
    });
    byBranch = Object.entries(branchMap)
      .map(([br, counts]) => ({ branch: br, boys: counts.boys, girls: counts.girls }))
      .sort((a, b) => a.branch.localeCompare(b.branch));
  }

  return {
    total: active.length,
    boys,
    girls,
    other,
    branch: branch || 'All',
    byBranch,
    status: 'ok',
  };
}

// ================================================================
// STUDENT SUMMARY (rich)
// ================================================================

/**
 * Get a comprehensive student summary with gender, branch, year, status breakdown.
 */
export async function getStudentSummary() {
  const students = await readCollection<any>('students');

  if (students.length === 0) {
    return {
      total: 0, active: 0, pending: 0, boys: 0, girls: 0,
      byBranch: [] as { branch: string; count: number }[],
      byYear: [] as { year: number; count: number }[],
      byType: {} as Record<string, number>,
      status: 'no_data',
    };
  }

  const active = students.filter((s: any) => s.status === 'Active');
  const pending = students.filter((s: any) => s.status === 'Pending Approval');

  const boys = active.filter((s: any) => {
    const g = (s.gender || '').toLowerCase();
    return g === 'male' || g === 'm' || g === 'boy';
  }).length;
  const girls = active.filter((s: any) => {
    const g = (s.gender || '').toLowerCase();
    return g === 'female' || g === 'f' || g === 'girl';
  }).length;

  // Branch breakdown
  const branchMap: Record<string, number> = {};
  active.forEach((s: any) => {
    const br = s.branch || 'Unknown';
    branchMap[br] = (branchMap[br] || 0) + 1;
  });
  const byBranch = Object.entries(branchMap)
    .map(([branch, count]) => ({ branch, count }))
    .sort((a, b) => b.count - a.count);

  // Year breakdown
  const yearMap: Record<number, number> = {};
  active.forEach((s: any) => {
    const yr = s.year || 0;
    if (yr > 0) yearMap[yr] = (yearMap[yr] || 0) + 1;
  });
  const byYear = Object.entries(yearMap)
    .map(([yr, count]) => ({ year: parseInt(yr, 10), count }))
    .sort((a, b) => a.year - b.year);

  // Type breakdown (Regular / Lateral)
  const byType: Record<string, number> = {};
  active.forEach((s: any) => {
    const t = s.type || 'Unknown';
    byType[t] = (byType[t] || 0) + 1;
  });

  return {
    total: students.length,
    active: active.length,
    pending: pending.length,
    boys,
    girls,
    byBranch,
    byYear,
    byType,
    status: 'ok',
  };
}

// ================================================================
// TEACHER SUMMARY (rich)
// ================================================================

/**
 * Get a comprehensive teacher summary with department & designation breakdown.
 */
export async function getTeacherSummary() {
  const teachers = await readCollection<any>('teachers');

  if (teachers.length === 0) {
    return {
      total: 0,
      byDepartment: [] as { department: string; count: number }[],
      byDesignation: [] as { designation: string; count: number }[],
      recentJoined: [] as { name: string; department: string; joinDate: string }[],
      status: 'no_data',
    };
  }

  // Department breakdown
  const deptMap: Record<string, number> = {};
  teachers.forEach((t: any) => {
    const dept = t.department || 'Unknown';
    deptMap[dept] = (deptMap[dept] || 0) + 1;
  });
  const byDepartment = Object.entries(deptMap)
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);

  // Designation breakdown
  const desigMap: Record<string, number> = {};
  teachers.forEach((t: any) => {
    const desig = t.designation || 'Unknown';
    desigMap[desig] = (desigMap[desig] || 0) + 1;
  });
  const byDesignation = Object.entries(desigMap)
    .map(([designation, count]) => ({ designation, count }))
    .sort((a, b) => b.count - a.count);

  // Recently joined
  const recentJoined = teachers
    .filter((t: any) => t.joinDate)
    .sort((a: any, b: any) => new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime())
    .slice(0, 5)
    .map((t: any) => ({
      name: t.name || 'N/A',
      department: t.department || 'N/A',
      joinDate: t.joinDate,
    }));

  return {
    total: teachers.length,
    byDepartment,
    byDesignation,
    recentJoined,
    status: 'ok',
  };
}

// ================================================================
// DASHBOARD SUMMARY (aggregation of key stats)
// ================================================================

/**
 * Get a quick dashboard summary combining key institutional metrics.
 */
export async function getDashboardSummary() {
  // Parallel fetch for speed
  const [students, teachers, attendanceRecs, fees, hostels, opportunities, applications] = await Promise.all([
    readCollection<any>('students'),
    readCollection<any>('teachers'),
    readCollection<any>('attendance'),
    readCollection<any>('fees'),
    readCollection<any>('hostels'),
    readCollection<any>('placements').catch(() => [] as any[]),
    readCollection<any>('applications').catch(() => [] as any[]),
  ]);

  const activeStudents = students.filter((s: any) => s.status === 'Active').length;
  const pendingApprovals = students.filter((s: any) => s.status === 'Pending Approval').length;

  // Attendance
  const totalAttendance = attendanceRecs.length;
  const presentCount = attendanceRecs.filter((a: any) => a.status === 'Present').length;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : null;

  // Fees
  const totalFees = fees.reduce((sum: number, f: any) => sum + (f.totalFees || 0), 0);
  const totalCollected = fees.reduce((sum: number, f: any) => sum + (f.amountPaid || 0), 0);
  const feeCollectionRate = totalFees > 0 ? Math.round((totalCollected / totalFees) * 100) : 0;

  // Hostels
  const totalCapacity = hostels.reduce((sum: number, h: any) => sum + (h.capacity || 0), 0);
  const totalOccupied = hostels.reduce((sum: number, h: any) => sum + (h.occupied || 0), 0);

  // Placements
  const openOpportunities = opportunities.filter((o: any) => o.status === 'Open').length;
  const totalOffers = applications.filter((a: any) => a.status === 'Offer Extended' || a.status === 'Offer Accepted').length;

  return {
    totalStudents: students.length,
    activeStudents,
    pendingApprovals,
    totalTeachers: teachers.length,
    attendanceRate,
    feeCollectionRate,
    totalFeesPending: totalFees - totalCollected,
    hostelOccupancy: totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0,
    hostelOccupied: totalOccupied,
    hostelCapacity: totalCapacity,
    openOpportunities,
    totalApplications: applications.length,
    totalOffers,
    status: 'ok',
  };
}
