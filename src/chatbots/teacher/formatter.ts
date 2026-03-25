// ============================================================
// Teacher Response Formatter — Converts structured data to
// human-readable sentences. NEVER sees raw DB objects.
// ============================================================

const PERIOD_LABELS: Record<number, string> = {
  1: '9:00 – 10:00 AM',
  2: '10:00 – 11:00 AM',
  3: '11:15 – 12:15 PM',
  4: '1:00 – 2:00 PM',
  5: '2:00 – 3:00 PM',
  6: '3:15 – 4:15 PM',
};

// ── Greeting ──

export function formatGreeting(name: string): string {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
  let greeting = 'Hello';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';
  else greeting = 'Good evening';

  return `${greeting}, ${name}! 👋 I'm your Teacher Assistant. You can ask me about your schedule, students, attendance, marks, exams, and more. How can I help?`;
}

// ── Help ──

export function formatHelp(): string {
  return `Here's what I can help you with:\n\n` +
    `📅 **Schedule** — "What are my classes today?"\n` +
    `👥 **Students** — "How many students do I have?"\n` +
    `⚠️ **Low Attendance** — "Which students have low attendance?"\n` +
    `📊 **Performance** — "How is my class performing?"\n` +
    `📝 **Marks** — "Show marks overview"\n` +
    `📋 **Exams** — "Any upcoming exams?"\n` +
    `🔔 **Pending Attendance** — "Do I have pending attendance?"\n` +
    `📚 **Courses** — "What courses am I teaching?"\n` +
    `👤 **Profile** — "Show my profile"`;
}

// ── Schedule ──

export function formatSchedule(data: { classes: { period: number; courseName: string; className: string }[]; day: string; status: string }, when: 'today' | 'tomorrow'): string {
  if (data.status === 'no_teacher') return 'Could not find your teacher profile. Please contact the administration.';
  if (data.status === 'holiday') return `${when === 'today' ? 'Today' : 'Tomorrow'} is Sunday — no classes! Enjoy your day off. 🎉`;
  if (data.status === 'no_timetable') return 'The timetable has not been configured yet.';
  if (data.status === 'no_classes' || data.classes.length === 0) return `You have no classes ${when === 'today' ? 'today' : 'tomorrow'} (${data.day}).`;

  const label = when === 'today' ? 'Today' : 'Tomorrow';
  let msg = `📅 **${label}'s Schedule** (${data.day}):\n\n`;

  for (const cls of data.classes) {
    const time = PERIOD_LABELS[cls.period] || `Period ${cls.period}`;
    msg += `• **${time}** — ${cls.courseName} | ${cls.className}\n`;
  }

  msg += `\nTotal: ${data.classes.length} class${data.classes.length > 1 ? 'es' : ''}.`;
  return msg;
}

// ── Low Attendance Students ──

export function formatLowAttendance(data: { students: { studentName: string; className: string; percentage: number }[]; totalCount?: number; status: string }): string {
  if (data.status === 'no_teacher') return 'Could not find your teacher profile.';
  if (data.status === 'no_classes') return 'You have no classes assigned.';
  if (data.status === 'no_attendance_data') return 'No attendance data has been recorded yet for your classes.';
  if (data.status === 'all_good') return '✅ Great news! All students across your classes have 75% or above attendance.';

  let msg = `⚠️ **Students Below 75% Attendance** (${data.totalCount || data.students.length} total):\n\n`;

  for (const s of data.students) {
    msg += `• **${s.studentName}** — ${s.className} — ${s.percentage}%\n`;
  }

  if ((data.totalCount || 0) > data.students.length) {
    msg += `\n_Showing top ${data.students.length} of ${data.totalCount} students._`;
  }

  return msg;
}

// ── Class Performance ──

export function formatClassPerformance(data: { classes: { className: string; averageMarks: number; passPercentage: number; totalStudents: number }[]; status: string }): string {
  if (data.status === 'no_teacher') return 'Could not find your teacher profile.';
  if (data.status === 'no_classes') return 'You have no classes assigned.';
  if (data.status === 'no_marks' || data.classes.length === 0) return 'No marks data available for your classes yet.';

  let msg = `📊 **Class Performance Analytics:**\n\n`;

  for (const cls of data.classes) {
    msg += `📘 **${cls.className}**\n`;
    msg += `   • Students: ${cls.totalStudents}\n`;
    msg += `   • Average Marks: ${cls.averageMarks}/100\n`;
    msg += `   • Pass %: ${cls.passPercentage}%\n\n`;
  }

  return msg;
}

// ── Marks Overview (same as class performance) ──

export function formatMarksOverview(data: { classes: { className: string; averageMarks: number; passPercentage: number; totalStudents: number }[]; status: string }): string {
  if (data.status === 'no_teacher') return 'Could not find your teacher profile.';
  if (data.status === 'no_classes') return 'You have no classes assigned.';
  if (data.status === 'no_marks' || data.classes.length === 0) return 'No marks data available yet.';

  let msg = `📝 **Marks Overview:**\n\n`;

  for (const cls of data.classes) {
    msg += `• **${cls.className}** — Avg: ${cls.averageMarks} | Pass: ${cls.passPercentage}% | Students: ${cls.totalStudents}\n`;
  }

  return msg;
}

// ── Exams ──

export function formatExams(data: { exams: { courseName: string; date: string; startTime: string; endTime: string; sessionName: string }[]; status: string }): string {
  if (data.status === 'no_teacher') return 'Could not find your teacher profile.';
  if (data.status === 'no_classes') return 'You have no classes assigned, so no exams to show.';
  if (data.status === 'no_exams' || data.exams.length === 0) return 'No upcoming exams scheduled for your classes.';

  let msg = `📝 **Upcoming Exams** (${data.exams.length}):\n\n`;

  for (const exam of data.exams) {
    const dateFormatted = new Date(exam.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const time = exam.startTime && exam.endTime ? ` | ${exam.startTime} – ${exam.endTime}` : '';
    msg += `• **${exam.courseName}** — ${dateFormatted}${time}\n`;
  }

  return msg;
}

// ── Students Info ──

export function formatStudentInfo(data: { totalStudents?: number; classes?: { courseName: string; section: string; studentCount: number }[]; status: string }): string {
  if (data.status === 'no_teacher') return 'Could not find your teacher profile.';
  if (data.status === 'no_classes') return 'You have no classes assigned yet.';

  let msg = `👥 You have **${data.totalStudents}** unique students across ${data.classes?.length} class${(data.classes?.length || 0) > 1 ? 'es' : ''}:\n\n`;

  for (const cls of data.classes || []) {
    msg += `• **${cls.courseName}** — ${cls.section} — ${cls.studentCount} students\n`;
  }

  return msg;
}

// ── Pending Attendance ──

export function formatPendingAttendance(data: { pending: { period: number; courseName: string; className: string }[]; status: string }): string {
  if (data.status === 'no_teacher') return 'Could not find your teacher profile.';
  if (data.status === 'holiday') return 'Today is Sunday — no attendance to mark!';
  if (data.status === 'no_timetable') return 'Timetable not configured yet.';
  if (data.status === 'no_classes_today') return 'You have no classes today, so no attendance to mark.';
  if (data.status === 'all_done') return '✅ All attendance for today has been marked. Great job!';

  let msg = `🔔 **Pending Attendance** (${data.pending.length}):\n\n`;

  for (const item of data.pending) {
    const time = PERIOD_LABELS[item.period] || `Period ${item.period}`;
    msg += `• **${time}** — ${item.courseName} | ${item.className}\n`;
  }

  msg += `\nPlease mark attendance for these classes.`;
  return msg;
}

// ── Profile ──

export function formatProfile(data: any): string {
  if (data.status === 'no_teacher') return 'Could not find your teacher profile.';

  return `👤 **Your Profile:**\n\n` +
    `• Name: **${data.name}**\n` +
    `• Staff ID: ${data.staffId}\n` +
    `• Email: ${data.email}\n` +
    `• Department: ${data.department}\n` +
    `• Designation: ${data.designation}\n` +
    `• Specialization: ${data.specialization}`;
}

// ── Courses ──

export function formatCourses(data: { courses: { courseName: string; section: string; semester: number; studentCount: number }[]; status: string }): string {
  if (data.status === 'no_teacher') return 'Could not find your teacher profile.';
  if (data.status === 'no_courses' || data.courses.length === 0) return 'You have no courses assigned yet.';

  let msg = `📚 **Your Courses** (${data.courses.length}):\n\n`;

  for (const course of data.courses) {
    msg += `• **${course.courseName}** — ${course.section} | Sem ${course.semester} | ${course.studentCount} students\n`;
  }

  return msg;
}

// ── Goodbye ──

export function formatGoodbye(name: string): string {
  return `Goodbye, ${name}! Have a productive day! 👋`;
}

// ── Unrecognized ──

export function formatUnrecognized(): string {
  return `Sorry, I didn't understand that. I can help you with:\n\n` +
    `• Schedule\n• Students\n• Low Attendance\n• Class Performance\n• Marks\n• Exams\n• Pending Attendance\n• Courses\n• Profile\n\n` +
    `Try asking something like "What are my classes today?" or "Which students have low attendance?"`;
}
