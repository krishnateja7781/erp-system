// ============================================================
// Student Response Formatter — Converts structured data to
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

  return `${greeting}, ${name}! 👋 I'm your Student Assistant. You can ask me about your attendance, schedule, exams, marks, fees, hostel, or courses. How can I help you today?`;
}

// ── Help ──

export function formatHelp(): string {
  return `Here's what I can help you with:\n\n` +
    `📊 **Attendance** — "What is my attendance?"\n` +
    `📅 **Schedule** — "What are my classes today?"\n` +
    `📝 **Exams** — "Do I have upcoming exams?"\n` +
    `📈 **Marks** — "Show my marks" or "What is my CGPA?"\n` +
    `⚠️ **Weak Subjects** — "Which subjects am I weak in?"\n` +
    `💰 **Fees** — "What is my fee status?"\n` +
    `🏠 **Hostel** — "What are my hostel details?"\n` +
    `📋 **Profile** — "Show my profile"\n` +
    `📚 **Courses** — "What courses am I enrolled in?"`;
}

// ── Attendance ──

export function formatAttendance(data: { percentage: number | null; totalClasses: number; presentClasses: number; status: string }): string {
  if (data.status === 'no_data') {
    return 'No attendance records found yet. Your attendance will appear here once your teachers start marking it.';
  }

  const pct = data.percentage!;
  let msg = `Your overall attendance is **${pct}%** (${data.presentClasses} present out of ${data.totalClasses} classes).`;

  if (pct < 75) {
    msg += `\n\n⚠️ **Warning:** Your attendance is below the minimum 75% requirement. Please attend classes regularly to avoid exam eligibility issues.`;
  } else if (pct >= 90) {
    msg += `\n\n✅ Excellent attendance! Keep it up.`;
  }

  return msg;
}

// ── Schedule ──

export function formatSchedule(data: { classes: { period: number; courseName: string; teacherName: string }[]; day: string; status: string }, when: 'today' | 'tomorrow'): string {
  if (data.status === 'no_student') return 'Could not find your student profile. Please contact the administration.';
  if (data.status === 'holiday') return `${when === 'today' ? 'Today' : 'Tomorrow'} is Sunday — no classes! Enjoy your day off. 🎉`;
  if (data.status === 'no_timetable') return 'The timetable has not been configured yet. Please check back later.';
  if (data.status === 'no_classes' || data.classes.length === 0) return `You have no classes ${when === 'today' ? 'today' : 'tomorrow'} (${data.day}).`;

  const label = when === 'today' ? 'Today' : 'Tomorrow';
  let msg = `📅 **${label}'s Schedule** (${data.day}):\n\n`;

  for (const cls of data.classes) {
    const time = PERIOD_LABELS[cls.period] || `Period ${cls.period}`;
    msg += `• **${time}** — ${cls.courseName} _(${cls.teacherName})_\n`;
  }

  msg += `\nTotal: ${data.classes.length} class${data.classes.length > 1 ? 'es' : ''}.`;
  return msg;
}

// ── Exams ──

export function formatExams(data: { exams: { courseName: string; date: string; startTime: string; endTime: string; sessionName: string }[]; status: string }): string {
  if (data.status === 'no_student') return 'Could not find your student profile. Please contact the administration.';
  if (data.status === 'no_exams' || data.exams.length === 0) return 'You have no upcoming exams scheduled at the moment. Relax and keep studying! 📚';

  let msg = `📝 **Upcoming Exams** (${data.exams.length}):\n\n`;

  for (const exam of data.exams) {
    const dateFormatted = new Date(exam.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const time = exam.startTime && exam.endTime ? ` | ${exam.startTime} – ${exam.endTime}` : '';
    msg += `• **${exam.courseName}** — ${dateFormatted}${time}\n`;
  }

  if (data.exams[0]?.sessionName) {
    msg += `\nSession: ${data.exams[0].sessionName}`;
  }

  return msg;
}

// ── Marks ──

export function formatMarks(data: { cgpa: number | null; subjects: { courseName: string; grade: string; total: number }[]; status: string }): string {
  if (data.status === 'no_marks') return 'No marks have been recorded for you yet. They will appear here once your teachers publish them.';

  let msg = '';
  if (data.cgpa !== null) {
    msg += `📈 Your current CGPA is **${data.cgpa}**.\n\n`;
  }

  msg += `**Subject-wise Grades:**\n\n`;
  for (const sub of data.subjects) {
    msg += `• ${sub.courseName} — Grade: **${sub.grade}** (Total: ${sub.total})\n`;
  }

  return msg;
}

// ── Weak Subjects ──

export function formatWeakSubjects(data: { weakSubjects: { courseName: string; grade: string }[]; status: string }): string {
  if (data.status === 'no_marks') return 'No marks recorded yet, so I cannot identify weak subjects at this time.';
  if (data.status === 'all_good') return '🎉 Great news! You don\'t have any weak subjects. All your grades are B+ or above. Keep up the excellent work!';

  let msg = `⚠️ **Subjects that need attention** (${data.weakSubjects.length}):\n\n`;
  for (const sub of data.weakSubjects) {
    msg += `• **${sub.courseName}** — Grade: ${sub.grade}\n`;
  }
  msg += `\nConsider focusing more on these subjects to improve your overall CGPA.`;
  return msg;
}

// ── Fees ──

export function formatFees(data: { totalFees: number; amountPaid: number; balance: number; feeStatus: string; collegeFees?: any; hostelFees?: any; status: string }): string {
  if (data.status === 'no_data') return 'No fee records found for your account. Please contact the accounts department.';

  let msg = `💰 **Fee Summary:**\n\n`;
  msg += `• Total Fees: ₹${data.totalFees.toLocaleString('en-IN')}\n`;
  msg += `• Amount Paid: ₹${data.amountPaid.toLocaleString('en-IN')}\n`;
  msg += `• Balance: ₹${data.balance.toLocaleString('en-IN')}\n`;
  msg += `• Status: **${data.feeStatus}**\n`;

  if (data.collegeFees) {
    msg += `\n📋 College Fees: ₹${data.collegeFees.paid?.toLocaleString('en-IN') || 0} / ₹${data.collegeFees.total?.toLocaleString('en-IN') || 0}`;
  }
  if (data.hostelFees) {
    msg += `\n🏠 Hostel Fees: ₹${data.hostelFees.paid?.toLocaleString('en-IN') || 0} / ₹${data.hostelFees.total?.toLocaleString('en-IN') || 0}`;
  }

  if (data.balance > 0) {
    msg += `\n\n⚠️ You have pending fees. Please clear them before the deadline to avoid exam eligibility issues.`;
  }

  return msg;
}

// ── Hostel ──

export function formatHostel(data: any): string {
  if (data.status === 'no_student') return 'Could not find your student profile. Please contact the administration.';
  if (data.status === 'not_hosteler') return 'You are not registered as a hosteler. If you believe this is an error, please contact the hostel warden.';

  let msg = `🏠 **Hostel Details:**\n\n`;
  msg += `• Hostel: **${data.hostelName}**\n`;
  msg += `• Room Number: **${data.roomNumber}**\n`;
  msg += `• Warden: ${data.wardenName}\n`;
  msg += `• Warden Contact: ${data.wardenContact}\n`;
  msg += `• Status: ${data.hostelStatus}`;
  return msg;
}

// ── Profile ──

export function formatProfile(data: any): string {
  if (data.status === 'no_student') return 'Could not find your student profile. Please contact the administration.';

  return `📋 **Your Profile:**\n\n` +
    `• Name: **${data.name}**\n` +
    `• College ID: ${data.collegeId}\n` +
    `• Program: ${data.program}\n` +
    `• Branch: ${data.branch}\n` +
    `• Year: ${data.year} | Semester: ${data.semester}\n` +
    `• Section: ${data.section}\n` +
    `• Type: ${data.type}`;
}

// ── Courses ──

export function formatCourses(data: { courses: { courseName: string; teacherName: string; credits: number }[]; status: string }): string {
  if (data.status === 'no_student') return 'Could not find your student profile. Please contact the administration.';
  if (data.status === 'no_courses' || data.courses.length === 0) return 'You are not enrolled in any courses yet. Please contact your class advisor.';

  let msg = `📚 **Enrolled Courses** (${data.courses.length}):\n\n`;
  for (const course of data.courses) {
    msg += `• **${course.courseName}** — ${course.teacherName} (${course.credits} credits)\n`;
  }
  return msg;
}

// ── Goodbye ──

export function formatGoodbye(name: string): string {
  return `Goodbye, ${name}! Have a great day! 👋`;
}

// ── Unrecognized ──

export function formatUnrecognized(): string {
  return `Sorry, I didn't understand that. I can help you with:\n\n` +
    `• Attendance\n• Schedule\n• Exams\n• Marks\n• Fees\n• Hostel\n• Courses\n• Profile\n\n` +
    `Try asking something like "What is my attendance?" or "Do I have exams this week?"`;
}
