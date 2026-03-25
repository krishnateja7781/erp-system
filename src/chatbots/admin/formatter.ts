// ============================================================
// Admin Response Formatter — Converts structured data to
// human-readable sentences. NEVER sees raw DB objects.
// ============================================================

// ── Greeting ──

export function formatGreeting(name: string): string {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
  let greeting = 'Hello';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';
  else greeting = 'Good evening';

  return `${greeting}, ${name}! 👋 I'm your Admin Assistant. You can ask me about students, teachers, attendance, fees, hostels, exams, performance, and more. How can I help?`;
}

// ── Help ──

export function formatHelp(): string {
  return `Here's what I can help you with:\n\n` +
    `� **Dashboard** — "Dashboard summary", "Give me an overview"\n` +
    `👥 **Students** — "Student summary", "How many students?", "Boys and girls in CSE", "Find student John"\n` +
    `👨‍🏫 **Teachers** — "Teacher summary", "How many teachers?", "Find teacher Smith"\n` +
    `🚻 **Gender** — "How many boys and girls?", "Gender breakdown", "Girls in ECE"\n` +
    `📊 **Attendance** — "What is the overall attendance?"\n` +
    `💰 **Fees** — "What is the fee collection status?"\n` +
    `🏠 **Hostels** — "Boys hostel details", "Hostel occupancy"\n` +
    `👤 **Wardens** — "Who is the warden of boys hostel -1?"\n` +
    `🚪 **Rooms** — "Room details of boys hostel"\n` +
    `📣 **Complaints** — "Hostel complaints", "Complaint status"\n` +
    `📈 **Performance** — "Show performance analytics"\n` +
    `📝 **Exams** — "What are the upcoming exams?"\n` +
    `📋 **Distribution** — "Show student distribution"\n` +
    `⏳ **Approvals** — "Any pending approvals?"\n` +
    `🔐 **Logins** — "Show recent logins"\n` +
    `📚 **Courses** — "How many courses?", "Details of course CS101"\n` +
    `🏫 **Classes** — "How many classes?", "CSE 3rd year classes"\n` +
    `💼 **Placements** — "Placement stats", "How many placed?"\n` +
    `📄 **Applications** — "Application status", "Recent applications"\n` +
    `🔔 **Notifications** — "Recent notifications", "Unread alerts"\n` +
    `🗓️ **Timetable** — "CSE 4th sem timetable", "Schedule"\n` +
    `💻 **Classrooms** — "Online classrooms", "Virtual classrooms"\n` +
    `🕐 **Date/Time** — "What is today's date?", "What day is it?"\n` +
    `👤 **Personal** — "What is my name?", "My profile"\n\n` +
    `💡 You can also say: "Give me summary about X", "Tell me about X" for any topic above.`;
}

// ── Total Students ──

export function formatTotalStudents(data: { total: number; active: number; pending: number; status: string }): string {
  let msg = `👥 **Student Overview:**\n\n`;
  msg += `• Total Students: **${data.total}**\n`;
  msg += `• Active: **${data.active}**\n`;

  if (data.pending > 0) {
    msg += `• Pending Approval: **${data.pending}** ⚠️`;
  } else {
    msg += `• Pending Approval: 0 ✅`;
  }

  return msg;
}

// ── Total Teachers ──

export function formatTotalTeachers(data: { total: number; status: string }): string {
  return `👨‍🏫 There are **${data.total}** teachers/staff members registered in the system.`;
}

// ── Overall Attendance ──

export function formatOverallAttendance(data: { overallPercentage: number | null; totalRecords: number; presentCount: number; status: string }): string {
  if (data.status === 'no_data') return 'No attendance records found in the system yet.';

  let msg = `📊 **Overall Attendance:**\n\n`;
  msg += `• Attendance Rate: **${data.overallPercentage}%**\n`;
  msg += `• Total Records: ${data.totalRecords.toLocaleString('en-IN')}\n`;
  msg += `• Present: ${data.presentCount.toLocaleString('en-IN')}\n`;
  msg += `• Absent: ${(data.totalRecords - data.presentCount).toLocaleString('en-IN')}`;

  if (data.overallPercentage !== null && data.overallPercentage < 75) {
    msg += `\n\n⚠️ Overall attendance is below 75%. This may need attention.`;
  }

  return msg;
}

// ── Fee Summary ──

export function formatFeeSummary(data: {
  totalFees: number; totalCollected: number; totalPending: number;
  collectionRate: number; studentCount: number; fullyPaid?: number;
  pendingPayments?: number; status: string;
}): string {
  if (data.status === 'no_data') return 'No fee records found in the system.';

  let msg = `💰 **Fee Collection Summary:**\n\n`;
  msg += `• Total Fees: ₹${data.totalFees.toLocaleString('en-IN')}\n`;
  msg += `• Collected: ₹${data.totalCollected.toLocaleString('en-IN')}\n`;
  msg += `• Pending: ₹${data.totalPending.toLocaleString('en-IN')}\n`;
  msg += `• Collection Rate: **${data.collectionRate}%**\n`;
  msg += `• Students with fees: ${data.studentCount}`;

  if (data.fullyPaid !== undefined) {
    msg += `\n• Fully Paid: ${data.fullyPaid}`;
  }
  if (data.pendingPayments !== undefined) {
    msg += `\n• Pending Payments: ${data.pendingPayments}`;
  }

  return msg;
}

// ── Hostel Occupancy ──

export function formatHostelOccupancy(data: {
  hostels: { hostelName: string; type: string; capacity: number; occupied: number; occupancyRate: number; hostelStatus: string }[];
  totalCapacity: number; totalOccupied: number; overallOccupancy?: number; status: string;
}): string {
  if (data.status === 'no_data') return 'No hostels found in the system.';

  let msg = `🏠 **Hostel Occupancy Report:**\n\n`;
  msg += `Overall: **${data.totalOccupied}/${data.totalCapacity}** (${data.overallOccupancy || 0}%)\n\n`;

  for (const h of data.hostels) {
    const bar = h.occupancyRate >= 90 ? '🔴' : h.occupancyRate >= 70 ? '🟡' : '🟢';
    msg += `${bar} **${h.hostelName}** (${h.type})\n`;
    msg += `   ${h.occupied}/${h.capacity} — ${h.occupancyRate}% | Status: ${h.hostelStatus}\n\n`;
  }

  return msg;
}

// ── Performance Analytics ──

export function formatPerformanceAnalytics(data: {
  overallPassRate: number | null; averageMarks: number | null;
  gradeDistribution: Record<string, number>; totalRecords: number; status: string;
}): string {
  if (data.status === 'no_data') return 'No marks/grades data available in the system yet.';

  let msg = `📈 **Academic Performance Analytics:**\n\n`;
  msg += `• Overall Pass Rate: **${data.overallPassRate}%**\n`;
  msg += `• Average Marks: **${data.averageMarks}/100**\n`;
  msg += `• Total Records: ${data.totalRecords.toLocaleString('en-IN')}\n\n`;

  // Grade distribution
  const gradeOrder = ['O', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'P', 'FAIL', 'F', 'N/A'];
  msg += `**Grade Distribution:**\n`;
  for (const grade of gradeOrder) {
    if (data.gradeDistribution[grade]) {
      msg += `• ${grade}: ${data.gradeDistribution[grade]}\n`;
    }
  }

  return msg;
}

// ── Exam Schedule ──

export function formatExamSchedules(data: {
  exams: { courseName: string; date: string; startTime: string; endTime: string; program: string; branch: string; sessionName: string }[];
  status: string;
}): string {
  if (data.status === 'no_exams' || data.exams.length === 0) return 'No upcoming exams scheduled.';

  let msg = `📝 **Upcoming Exams** (${data.exams.length}):\n\n`;

  for (const exam of data.exams) {
    const dateFormatted = new Date(exam.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = exam.startTime && exam.endTime ? ` | ${exam.startTime} – ${exam.endTime}` : '';
    msg += `• **${exam.courseName}** — ${dateFormatted}${time} | ${exam.program}-${exam.branch}\n`;
  }

  return msg;
}

// ── Student Distribution ──

export function formatStudentDistribution(data: { distribution: { branch: string; count: number }[]; total?: number; status: string }): string {
  if (data.status === 'no_data' || data.distribution.length === 0) return 'No active student data available.';

  let msg = `📋 **Student Distribution by Branch** (Total: ${data.total || 0}):\n\n`;

  for (const item of data.distribution) {
    const pct = data.total ? Math.round((item.count / data.total) * 100) : 0;
    msg += `• **${item.branch}** — ${item.count} students (${pct}%)\n`;
  }

  return msg;
}

// ── Pending Approvals ──

export function formatPendingApprovals(data: { count: number; students: { name: string; program: string; branch: string }[]; status: string }): string {
  if (data.status === 'none_pending') return '✅ No pending student approvals. All accounts are approved.';

  let msg = `⏳ **Pending Approvals:** ${data.count}\n\n`;

  for (const s of data.students) {
    msg += `• ${s.name} — ${s.program} / ${s.branch}\n`;
  }

  if (data.count > data.students.length) {
    msg += `\n_Showing ${data.students.length} of ${data.count} pending._`;
  }

  return msg;
}

// ── Recent Logins ──

export function formatRecentLogins(data: { logins: { userName: string; userRole: string; timestamp: string }[]; status: string }): string {
  if (data.status === 'no_data' || data.logins.length === 0) return 'No login activity records found.';

  let msg = `🔐 **Recent Login Activity:**\n\n`;

  for (const login of data.logins) {
    const time = new Date(login.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' });
    msg += `• **${login.userName}** (${login.userRole}) — ${time}\n`;
  }

  return msg;
}

// ── Courses Overview ──

export function formatCoursesOverview(data: { totalCourses: number; programs: string[]; totalPrograms: number; status: string }): string {
  if (data.status === 'no_data') return 'No courses found in the system.';

  let msg = `📚 **Courses Overview:**\n\n`;
  msg += `• Total Courses: **${data.totalCourses}**\n`;
  msg += `• Total Programs: **${data.totalPrograms}**\n`;

  if (data.programs.length > 0) {
    msg += `\nPrograms: ${data.programs.join(', ')}`;
  }

  return msg;
}

// ── Goodbye ──

export function formatGoodbye(name: string): string {
  return `Goodbye, ${name}! Have a great day! 👋`;
}

// ── Student Lookup ──

export function formatStudentLookup(data: {
  found: boolean;
  students: { name: string; collegeId: string; email: string; program: string; branch: string; year: any; semester: any; section: string; status: string; type: string; phone: string }[];
  query: string; queryType: 'usn' | 'name'; status: string;
}): string {
  if (!data.found || data.students.length === 0) {
    return `No student found with ${data.queryType === 'usn' ? 'USN' : 'name'} "${data.query}". Please check and try again.`;
  }

  if (data.students.length === 1) {
    const s = data.students[0];
    return `🎓 **Student Details:**\n\n` +
      `• **Name:** ${s.name}\n` +
      `• **USN:** ${s.collegeId}\n` +
      `• **Email:** ${s.email}\n` +
      `• **Program:** ${s.program}\n` +
      `• **Branch:** ${s.branch}\n` +
      `• **Year:** ${s.year} | **Semester:** ${s.semester}\n` +
      `• **Section:** ${s.section}\n` +
      `• **Type:** ${s.type}\n` +
      `• **Phone:** ${s.phone}\n` +
      `• **Status:** ${s.status}`;
  }

  let msg = `Found **${data.students.length}** students matching "${data.query}":\n\n`;
  for (const s of data.students) {
    msg += `• **${s.name}** (${s.collegeId}) — ${s.program}/${s.branch}, Year ${s.year}, Section ${s.section} — ${s.status}\n`;
  }
  return msg;
}

// ── Teacher Lookup ──

export function formatTeacherLookup(data: {
  found: boolean;
  teachers: { name: string; staffId: string; email: string; department: string; designation: string; phone: string }[];
  query: string; status: string;
}): string {
  if (!data.found || data.teachers.length === 0) {
    return `No teacher/staff found with name "${data.query}". Please check and try again.`;
  }

  if (data.teachers.length === 1) {
    const t = data.teachers[0];
    return `👨‍🏫 **Teacher Details:**\n\n` +
      `• **Name:** ${t.name}\n` +
      `• **Staff ID:** ${t.staffId}\n` +
      `• **Email:** ${t.email}\n` +
      `• **Department:** ${t.department}\n` +
      `• **Designation:** ${t.designation}\n` +
      `• **Phone:** ${t.phone}`;
  }

  let msg = `Found **${data.teachers.length}** staff matching "${data.query}":\n\n`;
  for (const t of data.teachers) {
    msg += `• **${t.name}** (${t.staffId}) — ${t.department}, ${t.designation}\n`;
  }
  return msg;
}

// ── Hostel Details (specific hostel) ──

export function formatHostelDetails(data: {
  found: boolean;
  hostel: {
    name: string; type: string; status: string;
    capacity: number; occupied: number; occupancyRate: number;
    warden: { name: string; contact: string; email: string; office: string } | null;
    amenities: string[]; rules: string[];
    roomCount: number; complaintCount: number; pendingComplaints: number;
  } | null;
  query: string; availableHostels?: string[]; status: string;
}): string {
  if (!data.found || !data.hostel) {
    let msg = `No hostel found matching "${data.query}".`;
    if (data.availableHostels && data.availableHostels.length > 0) {
      msg += `\n\nAvailable hostels:\n${data.availableHostels.map(n => `• ${n}`).join('\n')}`;
    }
    return msg;
  }

  const h = data.hostel;
  const bar = h.occupancyRate >= 90 ? '🔴' : h.occupancyRate >= 70 ? '🟡' : '🟢';

  let msg = `🏠 **${h.name}** — Details\n\n`;
  msg += `• **Type:** ${h.type}\n`;
  msg += `• **Status:** ${h.status}\n`;
  msg += `• **Occupancy:** ${bar} ${h.occupied}/${h.capacity} (${h.occupancyRate}%)\n`;
  msg += `• **Rooms:** ${h.roomCount}\n`;

  if (h.warden) {
    msg += `\n👤 **Warden:**\n`;
    msg += `• Name: ${h.warden.name}\n`;
    msg += `• Contact: ${h.warden.contact}\n`;
    msg += `• Email: ${h.warden.email}\n`;
    msg += `• Office: ${h.warden.office}\n`;
  }

  if (h.amenities.length > 0) {
    msg += `\n🏷️ **Amenities:** ${h.amenities.join(', ')}\n`;
  }

  if (h.rules.length > 0) {
    msg += `\n📋 **Rules:** ${h.rules.join(', ')}\n`;
  }

  if (h.complaintCount > 0) {
    msg += `\n⚠️ Complaints: ${h.complaintCount} total, ${h.pendingComplaints} pending`;
  }

  return msg;
}

// ── Warden Details ──

export function formatWardenDetails(data: {
  found: boolean;
  wardens: { hostelName: string; hostelType: string; name: string; contact: string; email: string; office: string }[];
  query: string | null; availableHostels?: string[]; status: string;
}): string {
  if (!data.found || data.wardens.length === 0) {
    let msg = data.query
      ? `No warden found for hostel matching "${data.query}".`
      : 'No warden information available.';
    if (data.availableHostels && data.availableHostels.length > 0) {
      msg += `\n\nAvailable hostels:\n${data.availableHostels.map(n => `• ${n}`).join('\n')}`;
    }
    return msg;
  }

  if (data.wardens.length === 1) {
    const w = data.wardens[0];
    return `👤 **Warden Profile — ${w.hostelName}**\n\n` +
      `• **Name:** ${w.name}\n` +
      `• **Contact:** ${w.contact}\n` +
      `• **Email:** ${w.email}\n` +
      `• **Office:** ${w.office}\n` +
      `• **Hostel Type:** ${w.hostelType}`;
  }

  // Multiple wardens
  let msg = `👤 **All Wardens:**\n\n`;
  for (const w of data.wardens) {
    msg += `**${w.hostelName}** (${w.hostelType})\n`;
    msg += `• ${w.name} | ${w.contact} | ${w.email}\n\n`;
  }
  return msg;
}

// ── Hostel Rooms ──

export function formatHostelRooms(data: {
  found: boolean;
  rooms: { roomNumber: string; capacity: number; residents: number }[];
  hostelName: string | null; totalRooms?: number;
  capacity?: number; occupied?: number;
  availableHostels?: string[]; status: string;
}): string {
  if (!data.found || data.rooms.length === 0) {
    let msg = 'No room data available.';
    if (data.availableHostels && data.availableHostels.length > 0) {
      msg += `\n\nAvailable hostels:\n${data.availableHostels.map(n => `• ${n}`).join('\n')}`;
    }
    return msg;
  }

  let msg = `🏠 **Rooms — ${data.hostelName}** (${data.totalRooms || data.rooms.length} rooms)\n\n`;

  if (data.capacity !== undefined && data.occupied !== undefined) {
    msg += `Overall: ${data.occupied}/${data.capacity} beds occupied\n\n`;
  }

  for (const r of data.rooms) {
    const occupancy = r.capacity > 0 ? `${r.residents}/${r.capacity}` : 'N/A';
    msg += `• Room ${r.roomNumber}: ${occupancy} occupied\n`;
  }

  if ((data.totalRooms || 0) > data.rooms.length) {
    msg += `\n_Showing ${data.rooms.length} of ${data.totalRooms} rooms._`;
  }

  return msg;
}

// ── Complaints Summary ──

export function formatComplaintsSummary(data: {
  totalComplaints: number; pending: number; resolved: number;
  hostelName?: string;
  complaints: { title: string; status: string; date: string; studentName: string }[];
  status: string;
}): string {
  if (data.status === 'no_data' || data.totalComplaints === 0) {
    return data.hostelName
      ? `No complaints found for ${data.hostelName}.`
      : 'No complaints found in the system.';
  }

  const scope = data.hostelName ? ` — ${data.hostelName}` : '';
  let msg = `📣 **Complaints Summary${scope}:**\n\n`;
  msg += `• Total: **${data.totalComplaints}**\n`;
  msg += `• Pending: **${data.pending}** ⚠️\n`;
  msg += `• Resolved: **${data.resolved}** ✅\n`;

  if (data.complaints.length > 0) {
    msg += `\n**Recent Pending:**\n`;
    for (const c of data.complaints) {
      const date = c.date ? new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
      msg += `• ${c.title} — ${c.studentName} ${date ? `(${date})` : ''} [${c.status}]\n`;
    }
  }

  return msg;
}

// ── Classes Overview ──

export function formatClassesOverview(data: {
  totalClasses: number;
  branchBreakdown: { branch: string; count: number }[];
  branches: string[];
  totalStudentsEnrolled: number;
  status: string;
}): string {
  if (data.status === 'no_data') return 'No classes found in the system.';

  let msg = `🏫 **Classes Overview:**\n\n`;
  msg += `• Total Classes: **${data.totalClasses}**\n`;
  msg += `• Total Students Enrolled: **${data.totalStudentsEnrolled}**\n`;
  msg += `• Branches: ${data.branches.join(', ')}\n\n`;

  if (data.branchBreakdown.length > 0) {
    msg += `**By Branch:**\n`;
    for (const b of data.branchBreakdown) {
      msg += `• ${b.branch}: ${b.count} classes\n`;
    }
  }

  return msg;
}

// ── Class Lookup ──

export function formatClassLookup(data: {
  found: boolean;
  classes: { courseName: string; courseId: string; branch: string; year: any; semester: any; section: string; teacherName: string; studentCount: number; credits: number }[];
  totalMatches: number;
  filters: any;
  status: string;
}): string {
  if (!data.found || data.classes.length === 0) {
    const f = data.filters || {};
    const desc = [f.branch, f.year ? `Year ${f.year}` : '', f.semester ? `Sem ${f.semester}` : ''].filter(Boolean).join(', ');
    return desc ? `No classes found for ${desc}.` : 'No matching classes found.';
  }

  const f = data.filters || {};
  const desc = [f.branch, f.year ? `Year ${f.year}` : '', f.semester ? `Sem ${f.semester}` : ''].filter(Boolean).join(', ');
  let msg = `🏫 **Classes${desc ? ` — ${desc}` : ''}** (${data.totalMatches} found):\n\n`;

  for (const c of data.classes) {
    msg += `• **${c.courseName}** (${c.courseId}) — ${c.branch} Y${c.year}/S${c.semester}, Sec ${c.section}\n`;
    msg += `  Teacher: ${c.teacherName} | Students: ${c.studentCount} | Credits: ${c.credits}\n`;
  }

  if (data.totalMatches > data.classes.length) {
    msg += `\n_Showing ${data.classes.length} of ${data.totalMatches} classes._`;
  }

  return msg;
}

// ── Course Lookup ──

export function formatCourseLookup(data: {
  found: boolean;
  courses: { courseId: string; name: string; program: string; branch: string; semester: any; credits: number; taughtBy: { teacherName: string; section: string; year: any }[] }[];
  query: string;
  status: string;
}): string {
  if (!data.found || data.courses.length === 0) {
    return `No course found matching "${data.query}". Try the course ID (e.g., CS101) or course name.`;
  }

  if (data.courses.length === 1) {
    const c = data.courses[0];
    let msg = `📚 **Course Details:**\n\n`;
    msg += `• **Name:** ${c.name}\n`;
    msg += `• **Course ID:** ${c.courseId}\n`;
    msg += `• **Program:** ${c.program}\n`;
    msg += `• **Branch:** ${c.branch}\n`;
    msg += `• **Semester:** ${c.semester}\n`;
    msg += `• **Credits:** ${c.credits}\n`;

    if (c.taughtBy.length > 0) {
      msg += `\n**Taught By:**\n`;
      for (const t of c.taughtBy) {
        msg += `• ${t.teacherName} — Year ${t.year}, Section ${t.section}\n`;
      }
    }

    return msg;
  }

  let msg = `📚 Found **${data.courses.length}** courses matching "${data.query}":\n\n`;
  for (const c of data.courses) {
    msg += `• **${c.name}** (${c.courseId}) — ${c.branch}, Sem ${c.semester}, ${c.credits} credits\n`;
  }
  return msg;
}

// ── Branch Students ──

export function formatBranchStudents(data: {
  total: number;
  bySection: { section: string; count: number }[];
  filters: any;
  sample: { name: string; collegeId: string; section: string; type: string }[];
  status: string;
}): string {
  if (data.status === 'no_data' || data.status === 'not_found' || data.total === 0) {
    const f = data.filters || {};
    const desc = [f.branch, f.year ? `Year ${f.year}` : '', f.semester ? `Sem ${f.semester}` : ''].filter(Boolean).join(', ');
    return desc ? `No students found for ${desc}.` : 'No matching students found.';
  }

  const f = data.filters || {};
  const desc = [f.branch, f.year ? `Year ${f.year}` : '', f.semester ? `Sem ${f.semester}` : ''].filter(Boolean).join(', ');
  let msg = `👥 **Students${desc ? ` — ${desc}` : ''}:**\n\n`;
  msg += `• Total: **${data.total}**\n\n`;

  if (data.bySection.length > 0) {
    msg += `**By Section:**\n`;
    for (const s of data.bySection) {
      msg += `• Section ${s.section}: ${s.count} students\n`;
    }
  }

  if (data.sample.length > 0) {
    msg += `\n**Sample Students:**\n`;
    for (const s of data.sample) {
      msg += `• ${s.name} (${s.collegeId}) — Sec ${s.section}, ${s.type}\n`;
    }
  }

  return msg;
}

// ── Placement Overview ──

export function formatPlacementOverview(data: {
  totalPlacements: number; openPlacements: number; closedPlacements: number;
  totalInternships: number; openInternships: number;
  totalApplications: number; offerExtended: number; shortlisted: number;
  underReview: number; rejected: number;
  uniqueCompanies: number; topCompanies: string[];
  recentOpportunities: { company: string; role: string; type: string; status: string; ctc: any }[];
  status: string;
}): string {
  if (data.status === 'no_data') return 'No placement or internship data available.';

  let msg = `💼 **Placement & Internship Overview:**\n\n`;
  msg += `**Placements:** ${data.totalPlacements} total (${data.openPlacements} open, ${data.closedPlacements} closed)\n`;
  msg += `**Internships:** ${data.totalInternships} total (${data.openInternships} open)\n`;
  msg += `**Companies:** ${data.uniqueCompanies} unique\n\n`;

  msg += `**Application Stats:**\n`;
  msg += `• Total Applications: **${data.totalApplications}**\n`;
  msg += `• Offers: **${data.offerExtended}** 🎉\n`;
  msg += `• Shortlisted: **${data.shortlisted}**\n`;
  msg += `• Under Review: **${data.underReview}**\n`;
  msg += `• Rejected: ${data.rejected}\n`;

  if (data.topCompanies.length > 0) {
    msg += `\n**Companies:** ${data.topCompanies.join(', ')}`;
  }

  if (data.recentOpportunities.length > 0) {
    msg += `\n\n**Recent Opportunities:**\n`;
    for (const o of data.recentOpportunities) {
      msg += `• **${o.company}** — ${o.role} (${o.type}) [${o.status}]\n`;
    }
  }

  return msg;
}

// ── Applications Overview ──

export function formatApplicationsOverview(data: {
  total: number;
  byStatus: Record<string, number>;
  recentApplications: { studentName: string; company: string; role: string; status: string; type: string }[];
  status: string;
}): string {
  if (data.status === 'no_data' || data.total === 0) return 'No applications found in the system.';

  let msg = `📄 **Applications Overview:**\n\n`;
  msg += `• Total Applications: **${data.total}**\n\n`;

  msg += `**By Status:**\n`;
  const statusIcons: Record<string, string> = {
    'Applied': '📩', 'Under Review': '🔍', 'Shortlisted': '⭐',
    'Offer Extended': '🎉', 'Offer Accepted': '✅', 'Rejected': '❌',
  };
  for (const [status, count] of Object.entries(data.byStatus)) {
    msg += `• ${statusIcons[status] || '•'} ${status}: **${count}**\n`;
  }

  if (data.recentApplications.length > 0) {
    msg += `\n**Recent Applications:**\n`;
    for (const a of data.recentApplications) {
      msg += `• ${a.studentName} → ${a.company} (${a.role}) — ${a.status}\n`;
    }
  }

  return msg;
}

// ── Notifications Summary ──

export function formatNotificationsSummary(data: {
  total: number; unread: number;
  byType: Record<string, number>;
  recent: { title: string; type: string; timestamp: string; read: boolean }[];
  status: string;
}): string {
  if (data.status === 'no_data' || data.total === 0) return 'No notifications found in the system.';

  let msg = `🔔 **Notifications Summary:**\n\n`;
  msg += `• Total: **${data.total}**\n`;
  msg += `• Unread: **${data.unread}** ${data.unread > 0 ? '⚠️' : '✅'}\n\n`;

  const typeIcons: Record<string, string> = { alert: '🚨', task: '📋', info: 'ℹ️', event: '📅' };
  msg += `**By Type:**\n`;
  for (const [type, count] of Object.entries(data.byType)) {
    msg += `• ${typeIcons[type] || '•'} ${type}: ${count}\n`;
  }

  if (data.recent.length > 0) {
    msg += `\n**Recent:**\n`;
    for (const n of data.recent) {
      const time = n.timestamp ? new Date(n.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }) : '';
      const readIcon = n.read ? '✓' : '●';
      msg += `• ${readIcon} ${n.title} (${n.type}) ${time}\n`;
    }
  }

  return msg;
}

// ── Timetable Summary ──

export function formatTimetableSummary(data: {
  totalSlots: number;
  branch: string;
  semester: any;
  byDay: Record<string, { period: number; courseId: string; courseName: string; teacherName: string; section: string }[]>;
  status: string;
}): string {
  if (data.status === 'no_data' || data.totalSlots === 0) return 'No timetable data available. Try specifying a branch, e.g., "CSE timetable".';

  const filterDesc = data.branch !== 'All' || data.semester !== 'All'
    ? ` — ${data.branch !== 'All' ? data.branch : ''}${data.semester !== 'All' ? ` Sem ${data.semester}` : ''}`
    : '';
  let msg = `🗓️ **Timetable${filterDesc}** (${data.totalSlots} slots):\n\n`;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const day of days) {
    const slots = data.byDay[day] || [];
    if (slots.length === 0) continue;

    msg += `**${day}:**\n`;
    for (const s of slots) {
      msg += `  P${s.period}: ${s.courseName} — ${s.teacherName} (Sec ${s.section})\n`;
    }
    msg += `\n`;
  }

  return msg;
}

// ── Classroom Overview ──

export function formatClassroomOverview(data: {
  total: number;
  classrooms: { name: string; section: string; subject: string; ownerName: string; memberCount: number }[];
  status: string;
}): string {
  if (data.status === 'no_data' || data.total === 0) return 'No virtual classrooms found in the system.';

  let msg = `💻 **Virtual Classrooms** (${data.total} total):\n\n`;

  for (const c of data.classrooms) {
    msg += `• **${c.name}** — ${c.subject !== 'N/A' ? c.subject : 'No subject'}\n`;
    msg += `  Owner: ${c.ownerName} | Section: ${c.section} | Members: ${c.memberCount}\n`;
  }

  if (data.total > data.classrooms.length) {
    msg += `\n_Showing ${data.classrooms.length} of ${data.total} classrooms._`;
  }

  return msg;
}

// ── Gender Breakdown ──

export function formatGenderBreakdown(data: {
  total: number; boys: number; girls: number; other: number;
  branch: string;
  byBranch: { branch: string; boys: number; girls: number }[];
  status: string;
}): string {
  if (data.status === 'no_data') return 'No active students found for the given criteria.';

  const branchLabel = data.branch !== 'All' ? ` in **${data.branch}**` : '';
  let msg = `🚻 **Gender Breakdown${branchLabel}:**\n\n`;
  msg += `• Total Active Students: **${data.total}**\n`;
  msg += `• Boys: **${data.boys}** (${data.total > 0 ? Math.round((data.boys / data.total) * 100) : 0}%)\n`;
  msg += `• Girls: **${data.girls}** (${data.total > 0 ? Math.round((data.girls / data.total) * 100) : 0}%)\n`;
  if (data.other > 0) msg += `• Other: **${data.other}**\n`;

  if (data.byBranch.length > 0) {
    msg += `\n**Branch-wise:**\n`;
    for (const b of data.byBranch) {
      msg += `• ${b.branch}: 👦 ${b.boys} boys, 👧 ${b.girls} girls\n`;
    }
  }

  return msg;
}

// ── Personal Info ──

export function formatPersonalInfo(data: { name: string; email: string; role: string }): string {
  let msg = `👤 **Your Profile:**\n\n`;
  msg += `• Name: **${data.name}**\n`;
  msg += `• Email: ${data.email}\n`;
  msg += `• Role: ${data.role}`;
  return msg;
}

// ── Date / Time ──

export function formatDateTime(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  };
  const dateStr = now.toLocaleDateString('en-IN', options);
  const timeStr = now.toLocaleTimeString('en-IN', timeOptions);
  return `🕐 **Today's Date & Time:**\n\n• Date: **${dateStr}**\n• Time: **${timeStr}** (IST)`;
}

// ── Dashboard Summary ──

export function formatDashboardSummary(data: {
  totalStudents: number; activeStudents: number; pendingApprovals: number;
  totalTeachers: number; attendanceRate: number | null;
  feeCollectionRate: number; totalFeesPending: number;
  hostelOccupancy: number; hostelOccupied: number; hostelCapacity: number;
  openOpportunities: number; totalApplications: number; totalOffers: number;
  status: string;
}): string {
  let msg = `📊 **Dashboard Summary:**\n\n`;

  msg += `**👥 Students:**\n`;
  msg += `• Active: **${data.activeStudents}** / ${data.totalStudents} total\n`;
  if (data.pendingApprovals > 0) msg += `• Pending Approval: **${data.pendingApprovals}** ⚠️\n`;
  msg += `\n`;

  msg += `**👨‍🏫 Teachers:** ${data.totalTeachers}\n\n`;

  msg += `**📊 Attendance:** ${data.attendanceRate !== null ? `**${data.attendanceRate}%**` : 'No data'}\n\n`;

  msg += `**💰 Fees:**\n`;
  msg += `• Collection Rate: **${data.feeCollectionRate}%**\n`;
  if (data.totalFeesPending > 0) msg += `• Pending: ₹${data.totalFeesPending.toLocaleString('en-IN')}\n`;
  msg += `\n`;

  msg += `**🏠 Hostels:** ${data.hostelOccupied}/${data.hostelCapacity} occupied (**${data.hostelOccupancy}%**)\n\n`;

  msg += `**💼 Placements:**\n`;
  msg += `• Open opportunities: ${data.openOpportunities}\n`;
  msg += `• Total applications: ${data.totalApplications}\n`;
  if (data.totalOffers > 0) msg += `• Offers: **${data.totalOffers}** 🎉\n`;

  return msg;
}

// ── Student Summary (Rich) ──

export function formatStudentSummary(data: {
  total: number; active: number; pending: number;
  boys: number; girls: number;
  byBranch: { branch: string; count: number }[];
  byYear: { year: number; count: number }[];
  byType: Record<string, number>;
  status: string;
}): string {
  if (data.status === 'no_data') return 'No student data available in the system.';

  let msg = `👥 **Student Summary:**\n\n`;

  msg += `**Overall:**\n`;
  msg += `• Total: **${data.total}** | Active: **${data.active}** | Pending: **${data.pending}**\n`;
  msg += `• Boys: **${data.boys}** | Girls: **${data.girls}**\n\n`;

  if (data.byBranch.length > 0) {
    msg += `**By Branch:**\n`;
    for (const b of data.byBranch) {
      msg += `• ${b.branch}: **${b.count}**\n`;
    }
    msg += `\n`;
  }

  if (data.byYear.length > 0) {
    msg += `**By Year:**\n`;
    for (const y of data.byYear) {
      msg += `• Year ${y.year}: **${y.count}**\n`;
    }
    msg += `\n`;
  }

  const typeEntries = Object.entries(data.byType);
  if (typeEntries.length > 0) {
    msg += `**By Type:**\n`;
    for (const [type, count] of typeEntries) {
      msg += `• ${type}: **${count}**\n`;
    }
  }

  return msg;
}

// ── Teacher Summary (Rich) ──

export function formatTeacherSummary(data: {
  total: number;
  byDepartment: { department: string; count: number }[];
  byDesignation: { designation: string; count: number }[];
  recentJoined: { name: string; department: string; joinDate: string }[];
  status: string;
}): string {
  if (data.status === 'no_data') return 'No teacher data available in the system.';

  let msg = `👨‍🏫 **Teacher Summary:**\n\n`;
  msg += `• Total Teachers: **${data.total}**\n\n`;

  if (data.byDepartment.length > 0) {
    msg += `**By Department:**\n`;
    for (const d of data.byDepartment) {
      msg += `• ${d.department}: **${d.count}**\n`;
    }
    msg += `\n`;
  }

  if (data.byDesignation.length > 0) {
    msg += `**By Designation:**\n`;
    for (const d of data.byDesignation) {
      msg += `• ${d.designation}: **${d.count}**\n`;
    }
    msg += `\n`;
  }

  if (data.recentJoined.length > 0) {
    msg += `**Recently Joined:**\n`;
    for (const t of data.recentJoined) {
      const date = new Date(t.joinDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' });
      msg += `• ${t.name} — ${t.department} (${date})\n`;
    }
  }

  return msg;
}

// ── Unrecognized ──

export function formatUnrecognized(): string {
  return `Sorry, I didn't understand that. I can help you with:\n\n` +
    `• Students, Teachers, Gender breakdown\n` +
    `• Dashboard summary, Attendance, Fees\n` +
    `• Hostels — details, wardens, rooms, complaints\n` +
    `• Classes, Courses, Timetable\n` +
    `• Placements, Applications, Exams\n` +
    `• Notifications, Classrooms, Approvals, Logins\n` +
    `• Date/Time, Your profile info\n\n` +
    `💡 Try: "dashboard summary", "boys and girls in CSE", "summary about teachers", "what is my name?"\n` +
    `Or say **help** for the full list.`;
}
