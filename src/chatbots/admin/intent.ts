// ============================================================
// Admin Intent Detector — Comprehensive keyword + pattern +
// topic-routing + entity extraction covering ALL ERP domains
// ============================================================

import type { DetectedIntent } from '../types';

interface IntentRule {
  intent: string;
  keywords: string[];
  priority: number;
}

// ================================================================
// KEYWORD INTENT RULES (table-driven, broad natural-language)
// ================================================================

const ADMIN_INTENT_RULES: IntentRule[] = [
  // ── Meta ──
  { intent: 'GreetingIntent', priority: 0, keywords: [
    'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
    'howdy', 'greetings', 'namaste',
  ]},
  { intent: 'HelpIntent', priority: 1, keywords: [
    'help', 'what can you do', 'commands', 'options', 'menu', 'assist',
    'how to use', 'what do you know', 'capabilities', 'guide me',
    'what are your features', 'what questions can i ask',
  ]},
  { intent: 'GoodbyeIntent', priority: 0, keywords: [
    'bye', 'goodbye', 'see you', 'exit', 'quit', 'close',
    'thank you', 'thanks', 'thank',
  ]},

  // ── Personal / Self ──
  { intent: 'PersonalInfoIntent', priority: 15, keywords: [
    'what is my name', 'who am i', 'my name', 'my profile', 'my details',
    'my info', 'my information', 'about me', 'tell me about myself',
    'my email', 'my role', 'show my profile', 'my account',
    'what is my role', 'who is logged in', 'current user',
    'my designation', 'my department',
  ]},

  // ── Date / Time ──
  { intent: 'DateTimeIntent', priority: 15, keywords: [
    'today date', 'todays date', "today's date", 'current date',
    'what is the date', 'what date is it', 'what day is it',
    'what is today', 'which day', 'what day', 'today day',
    'current time', 'what time', 'time now', 'what is the time',
    'date and day', 'day and date', 'date today', 'day today',
    'current day', 'date and time', 'time and date',
  ]},

  // ── Dashboard / Overall Summary ──
  { intent: 'DashboardSummaryIntent', priority: 14, keywords: [
    'dashboard', 'dashboard summary', 'overall summary', 'complete summary',
    'institution summary', 'college summary', 'overall stats', 'overall status',
    'give me summary', 'quick summary', 'brief summary', 'full summary',
    'system summary', 'system overview', 'institution overview', 'college overview',
    'overall overview', 'quick overview', 'everything', 'overall report',
    'show dashboard', 'summary of everything', 'all stats', 'quick stats',
    'key metrics', 'key statistics', 'overall data', 'complete overview',
    'tell me summary', 'summary report', 'general summary', 'general overview',
    'how is the college', 'how is the institution', 'status of college',
    'status of institution', 'institution status', 'college status',
  ]},

  // ── Student Summary (rich) ──
  { intent: 'StudentSummaryIntent', priority: 12, keywords: [
    'student summary', 'students summary', 'student report',
    'student overview', 'students overview', 'about students',
    'student data', 'students data', 'summary of students',
    'summary about students', 'details about students', 'students report',
    'tell me about students', 'give me students', 'show students',
    'student analytics', 'student statistics', 'student stats',
    'how are students', 'student information', 'students information',
    'all about students', 'complete student', 'full student',
    'student breakdown', 'students breakdown',
  ]},

  // ── Teacher Summary (rich) ──
  { intent: 'TeacherSummaryIntent', priority: 12, keywords: [
    'teacher summary', 'teachers summary', 'teacher report',
    'teacher overview', 'teachers overview', 'about teachers',
    'teacher data', 'teachers data', 'summary of teachers',
    'summary about teachers', 'details about teachers', 'teachers report',
    'tell me about teachers', 'give me teachers', 'show teachers',
    'teacher analytics', 'teacher statistics', 'teacher stats',
    'how are teachers', 'teacher information', 'teachers information',
    'all about teachers', 'complete teacher', 'full teacher',
    'teacher breakdown', 'teachers breakdown',
    'faculty summary', 'faculty overview', 'faculty report',
    'staff summary', 'staff overview', 'staff report',
    'about faculty', 'about staff', 'summary of faculty', 'summary of staff',
    'summary about faculty', 'summary about staff',
    'tell me about faculty', 'tell me about staff',
  ]},

  // ── Gender Breakdown ──
  { intent: 'GenderBreakdownIntent', priority: 14, keywords: [
    'boys and girls', 'girls and boys', 'how many boys', 'how many girls',
    'gender', 'gender breakdown', 'gender distribution', 'gender ratio',
    'male and female', 'female and male', 'how many male', 'how many female',
    'boys count', 'girls count', 'male count', 'female count',
    'number of boys', 'number of girls', 'number of male', 'number of female',
    'boys vs girls', 'girls vs boys', 'male vs female', 'female vs male',
    'gender wise', 'gender-wise', 'genderwise',
    'boys girls', 'girls boys', 'male female', 'female male',
    'boys present', 'girls present',
    'total boys', 'total girls', 'total male', 'total female',
    'men and women', 'women and men',
  ]},

  // ── Total Students ──
  { intent: 'TotalStudentsIntent', priority: 10, keywords: [
    'total students', 'how many students', 'student count', 'number of students',
    'students enrolled', 'active students', 'student strength', 'enrolled students',
    'count of students', 'all students', 'list students',
    'students in college', 'students in institution', 'how many are studying',
  ]},

  // ── Total Teachers ──
  { intent: 'TotalTeachersIntent', priority: 10, keywords: [
    'total teachers', 'how many teachers', 'teacher count', 'number of teachers',
    'staff count', 'faculty count', 'staff strength', 'all teachers', 'list teachers',
    'how many faculty', 'total faculty', 'faculty strength', 'number of staff',
    'teachers in college', 'teaching staff', 'count of teachers',
  ]},

  // ── Attendance ──
  { intent: 'OverallAttendanceIntent', priority: 12, keywords: [
    'overall attendance', 'attendance percentage', 'attendance %', 'total attendance',
    'attendance summary', 'attendance rate', 'institution attendance', 'attendance report',
    'college attendance', 'show attendance', 'attendance overview', 'attendance status',
    'how is the attendance', 'what is attendance', 'attendance stats', 'attendance data',
    'attendance analytics', 'about attendance', 'summary of attendance',
    'summary about attendance', 'tell me about attendance', 'attendance info',
  ]},

  // ── Fees ──
  { intent: 'FeeSummaryIntent', priority: 10, keywords: [
    'fee summary', 'fee collection', 'collection rate', 'fee status', 'total fees',
    'pending fees', 'fee overview', 'revenue', 'fee report', 'fee details',
    'fees collected', 'how much fees', 'fee payment', 'fee analytics',
    'fee collection status', 'money collected', 'fee balance', 'unpaid fees',
    'fee pending', 'show fees', 'fees overview', 'fee data', 'tuition fees',
    'about fees', 'summary of fees', 'summary about fees', 'tell me about fees',
    'fees summary', 'fees report', 'fees status', 'fees info', 'fees details',
  ]},

  // ── Hostel aggregate ──
  { intent: 'HostelOccupancyIntent', priority: 8, keywords: [
    'hostel occupancy', 'hostel overview', 'hostel report', 'hostel capacity',
    'hostel summary', 'how many hostelers', 'all hostels', 'hostels overview',
    'hostel stats', 'hostel statistics', 'hostel data', 'hostel status',
    'about hostels', 'hostels summary', 'summary of hostels',
    'summary about hostels', 'tell me about hostels', 'hostels report',
  ]},

  // ── Performance ──
  { intent: 'PerformanceAnalyticsIntent', priority: 12, keywords: [
    'performance analytics', 'overall performance', 'academic performance',
    'institution performance', 'pass percentage', 'overall marks', 'academic results',
    'performance report', 'pass rate', 'grade distribution', 'results summary',
    'academic analytics', 'student performance', 'marks analysis', 'result analysis',
    'how are results', 'grades overview', 'cgpa', 'sgpa',
    'academic report', 'performance data', 'show performance', 'marks overview',
    'marks summary', 'about marks', 'about performance', 'about results',
    'summary of marks', 'summary about marks', 'summary of performance',
    'tell me about marks', 'tell me about results', 'marks report',
    'results report', 'grades report', 'marks info', 'results overview',
    'academic overview', 'exam results', 'overall results',
  ]},

  // ── Exams ──
  { intent: 'ExamScheduleIntent', priority: 10, keywords: [
    'exam schedule', 'upcoming exam', 'exam dates', 'examination',
    'exam timetable', 'next exam', 'exam list', 'scheduled exams', 'when is exam',
    'exam calendar', 'exam plan', 'upcoming examinations', 'test schedule',
    'when are exams', 'show exams', 'exam info', 'exam details',
    'about exams', 'summary of exams', 'summary about exams',
    'tell me about exams', 'exam summary', 'exams summary', 'exams overview',
    'exam overview', 'exam report', 'exams report',
  ]},

  // ── Distribution ──
  { intent: 'StudentDistributionIntent', priority: 10, keywords: [
    'student distribution', 'branch distribution', 'branch wise', 'program wise',
    'department wise', 'students per branch', 'branch strength', 'department strength',
    'how many in each branch', 'students in each department', 'branch count',
    'distribution by branch', 'students by department', 'department distribution',
  ]},

  // ── Approvals ──
  { intent: 'PendingApprovalsIntent', priority: 10, keywords: [
    'pending approval', 'pending approvals', 'approvals',
    'pending students', 'unapproved', 'waiting for approval', 'approve students',
    'pending requests', 'new registrations', 'student requests', 'pending registration',
    'approval summary', 'about approvals', 'tell me about approvals',
  ]},

  // ── Logins ──
  { intent: 'RecentLoginsIntent', priority: 8, keywords: [
    'recent login', 'recent logins', 'login activity', 'who logged in',
    'login history', 'last login', 'login report', 'login records',
    'who was online', 'login details', 'show logins', 'sign in history',
    'user activity', 'access log', 'login log', 'login summary',
    'about logins', 'summary of logins', 'logins summary',
  ]},

  // ── Courses ──
  { intent: 'CoursesOverviewIntent', priority: 8, keywords: [
    'total courses', 'course count', 'how many courses', 'total programs',
    'courses overview', 'all courses', 'course list', 'available courses',
    'number of courses', 'list courses', 'courses offered', 'show courses',
    'course summary', 'courses in college', 'subjects offered',
    'courses summary', 'about courses', 'summary of courses',
    'summary about courses', 'tell me about courses',
    'subjects summary', 'about subjects',
  ]},

  // ── Classes ──
  { intent: 'ClassesOverviewIntent', priority: 10, keywords: [
    'total classes', 'how many classes', 'class count', 'number of classes',
    'all classes', 'list classes', 'classes overview', 'show classes',
    'classes in college', 'active classes', 'class summary', 'class list',
    'section wise classes', 'classes per branch', 'class details',
    'class strength', 'class data', 'how many sections',
    'classes summary', 'about classes', 'summary of classes',
    'summary about classes', 'tell me about classes',
    'classes data', 'classes report', 'class report',
  ]},

  // ── Placements & Internships ──
  { intent: 'PlacementOverviewIntent', priority: 10, keywords: [
    'placement', 'placements', 'placement stats', 'placement report',
    'placement overview', 'how many placed', 'placement data',
    'placed students', 'placement summary', 'placement details',
    'show placements', 'campus placement', 'placement drive',
    'placement status', 'placement analytics', 'placement rate',
    'companies visited', 'company visits', 'recruiting companies',
    'internship', 'internships', 'internship stats', 'internship report',
    'internship overview', 'internship details', 'internship summary',
    'open opportunities', 'job opportunities', 'career opportunities',
    'about placements', 'summary of placements', 'summary about placements',
    'tell me about placements', 'placements summary', 'placements report',
    'about internships', 'summary of internships',
  ]},

  // ── Applications ──
  { intent: 'ApplicationsOverviewIntent', priority: 10, keywords: [
    'applications', 'job applications', 'placement applications',
    'application status', 'application summary', 'how many applied',
    'student applications', 'application report', 'applied students',
    'offer extended', 'shortlisted', 'under review', 'offers made',
    'application overview', 'application data',
    'about applications', 'summary of applications',
    'applications summary', 'applications report',
  ]},

  // ── Notifications ──
  { intent: 'NotificationsIntent', priority: 8, keywords: [
    'notification', 'notifications', 'recent notifications', 'pending notifications',
    'announcement', 'announcements', 'alerts', 'unread notifications',
    'show notifications', 'system notifications', 'notification summary',
    'broadcast', 'messages sent', 'notification report',
    'about notifications', 'summary of notifications',
    'notifications summary', 'notifications report',
  ]},

  // ── Timetable / Schedule ──
  { intent: 'TimetableIntent', priority: 10, keywords: [
    'timetable', 'time table', 'class schedule', 'class timetable',
    'teaching schedule', 'weekly schedule', 'schedule for',
    'period schedule', 'show timetable', 'show schedule',
    'today schedule', "today's schedule", 'which class', 'which period',
    'timetable for', 'schedule overview',
    'about timetable', 'summary of timetable', 'timetable summary',
    'about schedule', 'schedule summary',
  ]},

  // ── Classrooms (interactive) ──
  { intent: 'ClassroomOverviewIntent', priority: 8, keywords: [
    'classroom', 'classrooms', 'online classroom', 'virtual classroom',
    'classroom overview', 'active classrooms', 'show classrooms',
    'classroom list', 'classroom count', 'how many classrooms',
    'google classroom', 'classroom data',
    'about classrooms', 'summary of classrooms',
    'classrooms summary', 'classrooms report',
  ]},
];

// ================================================================
// PATTERN-BASED RULES (entity-specific, higher priority)
// ================================================================

// USN: letters + digits, 8+ chars (BTE26CSE0010)
const USN_PATTERN = /\b(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*[0-9])[A-Z0-9]{8,}\b/i;

// Student lookup phrases
const STUDENT_LOOKUP_KEYWORDS = [
  'student with usn', 'person with usn', 'usn of',
  'student named', 'find student', 'search student',
  'look up student', 'lookup student', 'student details',
  'student info', 'student name', 'name of student',
  'name of the person', 'name of person', 'student with id',
  'details of student', 'info of student', 'student with college',
  'who has usn', 'who has college id',
  'student profile', 'get student', 'show student',
  'particular student', 'specific student',
];

// Teacher lookup phrases
const TEACHER_LOOKUP_KEYWORDS = [
  'teacher named', 'find teacher', 'search teacher', 'look up teacher',
  'lookup teacher', 'teacher details', 'teacher info', 'staff named',
  'find staff', 'search staff', 'staff details', 'staff info',
  'who teaches', 'teacher with id', 'staff with id',
  'details of teacher', 'info of teacher', 'details of staff',
  'teacher profile', 'staff profile', 'show teacher', 'get teacher',
  'particular teacher', 'specific teacher', 'faculty named', 'find faculty',
  'faculty details', 'faculty info', 'faculty profile',
];

// Warden-specific phrases
const WARDEN_KEYWORDS = [
  'warden', 'warden details', 'warden profile', 'warden info', 'warden name',
  'warden contact', 'warden email', 'warden phone', 'warden office',
  'who is the warden', 'who is warden', 'warden of',
  'hostel warden', 'warden\'s profile', 'warden\'s details', 'warden\'s contact',
  'warden\'s name', 'warden\'s info', 'contact warden', 'reach warden',
];

// Specific hostel lookup
const HOSTEL_DETAIL_KEYWORDS = [
  'boys hostel', 'girls hostel', 'boy hostel', 'girl hostel',
  'hostel 1', 'hostel 2', 'hostel 3', 'hostel 4', 'hostel 5',
  'hostel-1', 'hostel-2', 'hostel-3', 'hostel-4', 'hostel-5',
  'hostel -1', 'hostel -2', 'hostel -3', 'hostel -4', 'hostel -5',
  'hostel details', 'details of hostel', 'hostel info', 'info of hostel',
  'specific hostel', 'particular hostel', 'about hostel',
  'show hostel', 'get hostel', 'hostel profile',
  'hostel amenities', 'hostel rules', 'hostel facilities',
  'which hostel', 'tell me about hostel', 'hostel information',
];

// Room queries
const HOSTEL_ROOM_KEYWORDS = [
  'hostel room', 'room details', 'room availability', 'available rooms',
  'room in hostel', 'rooms in hostel', 'hostel rooms', 'room occupancy',
  'room capacity', 'room residents', 'who is in room', 'room number',
  'vacant rooms', 'empty rooms', 'free rooms', 'hostel vacancy',
];

// Complaint queries
const COMPLAINT_KEYWORDS = [
  'complaint', 'complaints', 'hostel complaint', 'hostel complaints',
  'student complaint', 'pending complaint', 'complaint status',
  'unresolved complaint', 'complaint report', 'complaint summary',
  'grievance', 'grievances', 'issues reported',
];

// Course lookup phrases (specific course)
const COURSE_LOOKUP_KEYWORDS = [
  'course details', 'course info', 'details of course', 'info of course',
  'about course', 'which course', 'find course', 'search course',
  'course named', 'course called', 'specific course', 'particular course',
  'show course', 'get course', 'course description', 'course credits',
  'subject details', 'subject info', 'details of subject', 'about subject',
];

// Class lookup phrases (specific class / branch / section)
const CLASS_LOOKUP_KEYWORDS = [
  'classes in cse', 'classes in ece', 'classes in eee', 'classes in mech',
  'classes in civil', 'classes in it', 'classes in ai', 'classes in ml',
  'cse classes', 'ece classes', 'eee classes', 'mech classes',
  'who teaches cse', 'who teaches ece', 'teachers in cse', 'teachers in ece',
  'classes for branch', 'section details', 'section info',
  'class for semester', 'classes for year',
];

// Branch/department-specific student queries (e.g. "how many CSE students")
const BRANCH_STUDENT_KEYWORDS = [
  'students in cse', 'students in ece', 'students in eee', 'students in mech',
  'students in civil', 'students in it', 'cse students', 'ece students',
  'eee students', 'mech students', 'civil students', 'it students',
  'students in branch', 'students of branch', 'how many cse',
  'how many ece', 'how many eee', 'how many mech',
  'students in department', 'students of department',
  'year wise students', 'semester wise students',
  'first year students', 'second year students', 'third year students', 'fourth year students',
  '1st year students', '2nd year students', '3rd year students', '4th year students',
];

// Hostel name regex
const HOSTEL_NAME_REGEX = /\b((?:boys?|girls?)\s*hostel[\s-]*\d*|\bhostel[\s-]*\d+)/i;

// Branch regex — extracts branch name from message
const BRANCH_REGEX = /\b(cse|ece|eee|mech|civil|it|ai|ml|aiml|csbs|csd|csm|ise|me|ee|ce)\b/i;

// Year regex
const YEAR_REGEX = /\b(?:(\d)(?:st|nd|rd|th)\s*year|year\s*(\d)|(\d)(?:st|nd|rd|th)\s*yr)\b/i;

// Semester regex
const SEMESTER_REGEX = /\b(?:semester\s*(\d)|sem\s*(\d)|(\d)(?:st|nd|rd|th)\s*sem)\b/i;

// Course ID regex (e.g. BTE1CSE001, CS101, 22CSE301)
const COURSE_ID_REGEX = /\b([A-Z]{2,5}\d{1,3}[A-Z]{0,4}\d{0,3})\b/i;

// ================================================================
// TOPIC ROUTER — catches "tell me about X", "give me the X summary"
// and similar flexible patterns
// ================================================================

const TOPIC_MAP: { topics: string[]; intent: string }[] = [
  { topics: ['student', 'students'], intent: 'StudentSummaryIntent' },
  { topics: ['teacher', 'teachers', 'faculty', 'staff'], intent: 'TeacherSummaryIntent' },
  { topics: ['attendance'], intent: 'OverallAttendanceIntent' },
  { topics: ['fee', 'fees', 'tuition', 'payment', 'payments'], intent: 'FeeSummaryIntent' },
  { topics: ['hostel', 'hostels', 'dormitory'], intent: 'HostelOccupancyIntent' },
  { topics: ['placement', 'placements', 'internship', 'internships', 'job', 'jobs', 'career'], intent: 'PlacementOverviewIntent' },
  { topics: ['exam', 'exams', 'examination', 'examinations', 'test', 'tests'], intent: 'ExamScheduleIntent' },
  { topics: ['course', 'courses', 'subject', 'subjects', 'curriculum'], intent: 'CoursesOverviewIntent' },
  { topics: ['class', 'classes', 'section', 'sections'], intent: 'ClassesOverviewIntent' },
  { topics: ['application', 'applications'], intent: 'ApplicationsOverviewIntent' },
  { topics: ['notification', 'notifications', 'alert', 'alerts', 'announcement', 'announcements'], intent: 'NotificationsIntent' },
  { topics: ['timetable', 'schedule'], intent: 'TimetableIntent' },
  { topics: ['classroom', 'classrooms'], intent: 'ClassroomOverviewIntent' },
  { topics: ['complaint', 'complaints', 'grievance', 'grievances'], intent: 'ComplaintSummaryIntent' },
  { topics: ['login', 'logins'], intent: 'RecentLoginsIntent' },
  { topics: ['approval', 'approvals', 'registration', 'registrations'], intent: 'PendingApprovalsIntent' },
  { topics: ['performance', 'marks', 'results', 'grades', 'academic', 'cgpa', 'sgpa'], intent: 'PerformanceAnalyticsIntent' },
  { topics: ['distribution'], intent: 'StudentDistributionIntent' },
  { topics: ['dashboard', 'overview', 'summary', 'report', 'stats', 'statistics'], intent: 'DashboardSummaryIntent' },
];

// Prefixes to strip for topic matching
const STRIP_PREFIXES = [
  'give me the', 'give me a', 'give me', 'tell me the', 'tell me about the',
  'tell me about', 'tell me a', 'tell me', 'show me the', 'show me a', 'show me',
  'get me the', 'get me a', 'get me', 'what is the', 'what are the', 'what is',
  'what are', 'can you show', 'can you tell', 'can you give', 'can you get',
  'i want to see', 'i want to know', 'i want', 'i need', 'i need to see',
  'i need to know', 'please show', 'please give', 'please tell',
  'please get', 'could you show', 'could you tell',
  'display the', 'display', 'fetch the', 'fetch', 'provide the', 'provide',
  'list the', 'list all', 'list',
];

// Suffixes that indicate a summary/overview
const SUMMARY_SUFFIXES = [
  'summary', 'overview', 'report', 'details', 'info', 'information',
  'data', 'stats', 'statistics', 'analytics', 'status', 'breakdown',
];

function matchTopic(message: string): DetectedIntent | null {
  // Strip common prefixes
  let stripped = message;
  for (const prefix of STRIP_PREFIXES) {
    if (stripped.startsWith(prefix + ' ')) {
      stripped = stripped.slice(prefix.length).trim();
      break;
    }
  }

  // Remove trailing summary suffixes
  for (const suffix of SUMMARY_SUFFIXES) {
    if (stripped.endsWith(' ' + suffix)) {
      stripped = stripped.slice(0, -(suffix.length + 1)).trim();
      break;
    }
  }

  // Also try the original stripped text
  const candidates = [stripped, message];

  for (const text of candidates) {
    // Split into words
    const words = text.split(/\s+/);

    for (const topicEntry of TOPIC_MAP) {
      for (const topic of topicEntry.topics) {
        // Check if any word matches a topic
        if (words.includes(topic)) {
          return { intent: topicEntry.intent, confidence: 'partial' };
        }
        // Check if the text contains the topic
        if (text.includes(topic)) {
          return { intent: topicEntry.intent, confidence: 'partial' };
        }
      }
    }
  }

  return null;
}

// ================================================================
// MAIN DETECTION FUNCTION
// ================================================================

export function detectAdminIntent(rawMessage: string): DetectedIntent | null {
  if (!rawMessage || typeof rawMessage !== 'string') return null;

  const message = rawMessage.toLowerCase().trim();
  if (message.length === 0) return null;

  // ── 0. Personal info (highest priority) ──
  if (/\bmy\s+(name|profile|details|info|email|role|account|designation|department)\b/i.test(message) ||
      /\bwho\s+am\s+i\b/i.test(message) ||
      /\babout\s+me\b/i.test(message) ||
      /\bcurrent\s+user\b/i.test(message) ||
      /\bwho\s+is\s+logged\b/i.test(message)) {
    return { intent: 'PersonalInfoIntent', confidence: 'exact' };
  }

  // ── 0b. Date/Time (high priority) ──
  if (/\b(today'?s?\s+date|current\s+date|what\s+date|date\s+today|what\s+day|which\s+day|today'?s?\s+day|day\s+today|current\s+day|date\s+and\s+day|day\s+and\s+date)\b/i.test(message) ||
      /\b(current\s+time|what\s+time|time\s+now|time\s+and\s+date|date\s+and\s+time)\b/i.test(message) ||
      /\bwhat\s+is\s+today\b/i.test(message)) {
    return { intent: 'DateTimeIntent', confidence: 'exact' };
  }

  // ── 0c. Gender breakdown (high priority — must be before student intents) ──
  if (/\b(boys?\s+and\s+girls?|girls?\s+and\s+boys?|male\s+and\s+female|female\s+and\s+male)\b/i.test(message) ||
      /\b(how\s+many\s+boys|how\s+many\s+girls|how\s+many\s+male|how\s+many\s+female)\b/i.test(message) ||
      /\b(gender\s+(breakdown|distribution|ratio|wise|count))\b/i.test(message) ||
      /\b(boys?\s+count|girls?\s+count|male\s+count|female\s+count)\b/i.test(message) ||
      /\b(boys?\s+vs\s+girls?|girls?\s+vs\s+boys?)\b/i.test(message) ||
      /\b(total\s+boys|total\s+girls|total\s+male|total\s+female)\b/i.test(message) ||
      /\b(number\s+of\s+boys|number\s+of\s+girls|number\s+of\s+male|number\s+of\s+female)\b/i.test(message) ||
      /\b(boys?\s+present|girls?\s+present)\b/i.test(message) ||
      /\bgender\b/i.test(message)) {
    return { intent: 'GenderBreakdownIntent', confidence: 'exact' };
  }

  // ── 1. Warden queries (highest entity specificity) ──
  if (WARDEN_KEYWORDS.some(kw => message.includes(kw))) {
    return { intent: 'WardenDetailsIntent', confidence: 'partial' };
  }

  // ── 2. Hostel room queries ──
  if (HOSTEL_ROOM_KEYWORDS.some(kw => message.includes(kw))) {
    return { intent: 'HostelRoomsIntent', confidence: 'partial' };
  }

  // ── 3. Complaint queries ──
  if (COMPLAINT_KEYWORDS.some(kw => message.includes(kw))) {
    return { intent: 'ComplaintSummaryIntent', confidence: 'partial' };
  }

  // ── 4. Specific hostel lookup ──
  if (HOSTEL_NAME_REGEX.test(message) || HOSTEL_DETAIL_KEYWORDS.some(kw => message.includes(kw))) {
    return { intent: 'HostelDetailsIntent', confidence: HOSTEL_NAME_REGEX.test(message) ? 'exact' : 'partial' };
  }

  // ── 5. Course lookup (specific course) ──
  if (COURSE_LOOKUP_KEYWORDS.some(kw => message.includes(kw))) {
    return { intent: 'CourseLookupIntent', confidence: 'partial' };
  }

  // ── 6. Class lookup (specific branch/section classes) ──
  if (CLASS_LOOKUP_KEYWORDS.some(kw => message.includes(kw))) {
    return { intent: 'ClassLookupIntent', confidence: 'partial' };
  }

  // ── 7. Branch-specific student queries ──
  if (BRANCH_STUDENT_KEYWORDS.some(kw => message.includes(kw))) {
    return { intent: 'BranchStudentsIntent', confidence: 'partial' };
  }

  // ── 8. Teacher lookup phrases ──
  if (TEACHER_LOOKUP_KEYWORDS.some(kw => message.includes(kw))) {
    return { intent: 'TeacherLookupIntent', confidence: 'partial' };
  }

  // ── 9. Student lookup: USN pattern or student lookup keywords ──
  const hasUSN = USN_PATTERN.test(rawMessage);
  if (hasUSN || STUDENT_LOOKUP_KEYWORDS.some(kw => message.includes(kw))) {
    return { intent: 'StudentLookupIntent', confidence: hasUSN ? 'exact' : 'partial' };
  }

  // ── 10. Standard keyword matching ──
  const matches: { intent: string; priority: number; confidence: 'exact' | 'partial' }[] = [];

  for (const rule of ADMIN_INTENT_RULES) {
    for (const keyword of rule.keywords) {
      if (message === keyword) {
        matches.push({ intent: rule.intent, priority: rule.priority + 100, confidence: 'exact' });
        break;
      } else if (message.includes(keyword)) {
        matches.push({ intent: rule.intent, priority: rule.priority, confidence: 'partial' });
        break;
      }
    }
  }

  if (matches.length > 0) {
    matches.sort((a, b) => b.priority - a.priority);
    return { intent: matches[0].intent, confidence: matches[0].confidence };
  }

  // ── 11. Topic router fallback (catches "give me X", "tell me about X") ──
  const topicMatch = matchTopic(message);
  if (topicMatch) return topicMatch;

  return null;
}

// ================================================================
// ENTITY EXTRACTORS
// ================================================================

/** Extract USN or name */
export function extractSearchTerm(rawMessage: string): { type: 'usn' | 'name'; value: string } | null {
  const usnMatch = rawMessage.match(/\b((?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*[0-9])[A-Z0-9]{8,})\b/i);
  if (usnMatch) return { type: 'usn', value: usnMatch[1].toUpperCase() };

  const namePatterns = [
    /(?:named|called|name is|name of|who is|find |search |lookup |look up )\s*["']?([a-zA-Z][a-zA-Z ]{1,40})["']?/i,
  ];
  for (const pattern of namePatterns) {
    const match = rawMessage.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim().replace(/\?$/, '').trim();
      if (name.length >= 2) return { type: 'name', value: name };
    }
  }
  return null;
}

/** Extract hostel name / identifier */
export function extractHostelName(rawMessage: string): string | null {
  const msg = rawMessage.toLowerCase();
  const nameMatch = msg.match(HOSTEL_NAME_REGEX);
  if (nameMatch) return nameMatch[1].trim();
  const typeMatch = msg.match(/\b(boys?\s*hostel|girls?\s*hostel)\b/i);
  if (typeMatch) return typeMatch[1].trim();
  return null;
}

/** Extract branch from message */
export function extractBranch(rawMessage: string): string | null {
  const match = rawMessage.match(BRANCH_REGEX);
  return match ? match[1].toUpperCase() : null;
}

/** Extract year (1-4) from message */
export function extractYear(rawMessage: string): number | null {
  const match = rawMessage.match(YEAR_REGEX);
  if (match) {
    const val = parseInt(match[1] || match[2] || match[3], 10);
    return val >= 1 && val <= 6 ? val : null;
  }
  return null;
}

/** Extract semester (1-8) from message */
export function extractSemester(rawMessage: string): number | null {
  const match = rawMessage.match(SEMESTER_REGEX);
  if (match) {
    const val = parseInt(match[1] || match[2] || match[3], 10);
    return val >= 1 && val <= 8 ? val : null;
  }
  return null;
}

/** Extract a course name or ID from the message */
export function extractCourseName(rawMessage: string): string | null {
  // Try course ID pattern first (e.g. CS101, BTE1CSE001)
  const idMatch = rawMessage.match(COURSE_ID_REGEX);
  if (idMatch) return idMatch[1].toUpperCase();

  // Try extracting after "course"/"subject" keywords
  const courseNamePatterns = [
    /(?:course|subject)\s+(?:named|called|details?|info)?\s*["']?([a-zA-Z][a-zA-Z0-9 ]{2,40})["']?/i,
    /(?:details?\s+of|info\s+of|about)\s+(?:course|subject)\s+["']?([a-zA-Z][a-zA-Z0-9 ]{2,40})["']?/i,
  ];
  for (const pattern of courseNamePatterns) {
    const match = rawMessage.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim().replace(/\?$/, '').trim();
      if (name.length >= 2) return name;
    }
  }
  return null;
}
