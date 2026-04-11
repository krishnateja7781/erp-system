export type UserRole = 'super_admin' | 'employee' | 'teacher' | 'student';

// Flat staff member used in UI listings
export interface StaffMember {
  id: string;
  uid?: string;
  role?: string;
  staffId?: string;
  name: string;
  email: string;
  department?: string;
  designation?: string;
  phone?: string;
  isActive?: boolean;
  type?: 'Teaching' | 'Non-Teaching' | string;
  joiningDate?: string;
  qualifications?: string[];
  experienceYears?: number;
  program?: string;
  position?: string;
  status?: string;
}

export type EmployeeType =
  | 'fee_management'
  | 'hostel_management'
  | 'student_staff_management'
  | 'exam_marks_management'
  | 'library_management';

// Generic server action result
export interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
  [key: string]: any;
}

// Teacher timetable schedule entry
export interface ScheduleEntry {
  id: string;
  classId: string;
  courseId: string;
  teacherId: string;
  day: string;
  period: number;
  room?: string;
  class?: string;
  teacherName?: string;
  courseName?: string;
  courseCode?: string;
}

export interface FullTeacherData {
  profile: {
    id: string;
    name: string;
    initials: string;
    staffId?: string;
    email?: string;
    phone?: string;
    program?: string;
    department?: string;
    position?: string;
    status?: string;
    avatarUrl?: string;
    officeLocation?: string;
    joinDate?: string;
    qualifications?: string;
    specialization?: string;
  };
  coursesAssigned: any[];
  schedule: ScheduleEntry[];
  responsibilities: string[];
}

export interface FullStudentData {
  profile: Student;
  attendance: any;
  marks: any;
  fees: any;
  hostelInfo: any;
  coursesEnrolled: any;
}

export interface Profile {
  id: string; // uuid from auth.users
  role: UserRole;
  full_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Student {
  id: string;
  profile_id?: string;
  college_id?: string;
  program?: string;
  branch?: string;
  current_semester?: number;
  current_year?: number;
  is_hosteler?: boolean;
  is_graduated?: boolean;
  dob?: string;
  admitted_year?: number;
  created_at?: string;
  // UI extended properties
  collegeId?: string;
  name?: string;
  year?: number;
  semester?: number;
  section?: string;
  status?: string;
  type?: string;
  email?: string;
  phone?: string;
  address?: string;
  emergencyContact?: any;
  gender?: string;
  batch?: number | string;
  avatarUrl?: string;
  initials?: string;
  isHosteler?: boolean;
}

export interface Teacher {
  id: string;
  profile_id: string;
  employee_code: string;
  department?: string;
  designation?: string;
  created_at?: string;
}

export interface Employee {
  id: string;
  profile_id: string;
  employee_code: string;
  employee_type: EmployeeType;
  department?: string;
  created_at?: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  program?: string;
  branch?: string;
  semester?: number;
  credits: number;
  created_at?: string;
}

export interface Class {
  id: string;
  course_id: string;
  teacher_id?: string;
  section?: string;
  academic_year?: string;
  semester?: number;
  created_at?: string;
}

export interface Timetable {
  id: string;
  class_id: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  period: number; // 1 to 8
  room?: string;
  created_at?: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  class_id?: string;
  date: string;
  period?: number;
  status: 'present' | 'absent' | 'late';
  marked_by?: string;
  created_at?: string;
}

export interface Mark {
  id: string;
  student_id: string;
  course_id?: string;
  semester?: number;
  exam_type: 'IA1' | 'IA2' | 'SEE';
  marks_obtained?: number;
  max_marks?: number;
  grade?: 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'P' | 'F';
  grade_points?: number;
  entered_by?: string;
  created_at?: string;
}

export interface Fee {
  id: string;
  student_id: string;
  semester: 1 | 3 | 5 | 7; // Odd semesters only
  academic_year?: string;
  base_amount: number;
  hostel_amount: number;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: 'pending' | 'partial' | 'paid';
  generated_at?: string;
}

export interface Transaction {
  id: string;
  fee_id?: string;
  student_id?: string;
  amount: number;
  payment_mode?: 'online' | 'offline';
  transaction_ref?: string;
  status?: 'pending' | 'approved' | 'rejected' | string;
  submitted_by?: string;
  approved_by?: string;
  transaction_id?: string;
  created_at?: string;
  // UI-mapped fields from fee-actions
  date?: string;
  category?: 'College' | 'Hostel';
}

export interface ExamSchedule {
  id: string;
  course_id?: string;
  semester?: number;
  program?: string;
  branch?: string;
  exam_date?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
  created_at?: string;
  // UI properties
  courseCode?: string;
  courseName?: string;
  examSessionName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  year?: number | string;
  credits?: number;
  maxInternalMarks?: number | null;
  maxExternalMarks?: number | null;
  examType?: string;
  courseId?: string;
}

export interface HallTicketRule {
  id: string;
  semester?: number;
  min_attendance_pct: number;
  min_fees_paid_pct: number;
  set_by?: string;
  created_at?: string;
}

export interface PromotionLog {
  id: string;
  student_id: string;
  from_semester: number;
  to_semester?: number;
  from_year: number;
  to_year?: number;
  promoted_by?: string;
  promoted_at?: string;
  notes?: string;
}

export interface SnapshotData {
  marks: Mark[];
  attendance: Attendance[];
}

export interface SemesterSnapshot {
  id: string;
  student_id: string;
  semester: number;
  academic_year?: string;
  attendance_pct?: number;
  cgpa?: number;
  fee_status?: string;
  fee_paid_amount?: number;
  snapshot_data?: SnapshotData | any;
  promoted_at?: string;
}

export interface HostelRoom {
  id: string;
  room_number: string;
  block?: string;
  floor?: number;
  capacity: number;
  occupied: number;
  warden_id?: string;
  created_at?: string;
}

export interface HostelAllocation {
  id: string;
  student_id: string;
  room_id?: string;
  from_date?: string;
  to_date?: string;
  is_active: boolean;
}

export interface Complaint {
  id: string;
  student_id: string;
  studentId?: string;
  room_id?: string;
  roomNumber?: string;
  issue?: string;
  title: string;
  description?: string;
  date?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'Pending' | 'In Progress' | 'Resolved';
  resolved_by?: string;
  created_at?: string;
}

export interface Placement {
  id?: string;
  company_name?: string;
  role_title?: string;
  description?: string;
  package_lpa?: number;
  deadline?: string;
  eligible_branches?: string[];
  eligible_years?: number[];
  posted_by?: string;
  created_at?: string;
  // UI-facing fields mapped from actions
  company?: string;
  role?: string;
  ctc_stipend?: string;
  minCgpa?: number | null;
  status?: string;
  skills?: string[];
  eligibility?: string;
  duration?: string;
  type?: 'placement' | 'internship';
}

export interface PlacementApplication {
  id: string;
  placement_id: string;
  student_id: string;
  status: 'applied' | 'shortlisted' | 'selected' | 'rejected';
  applied_at?: string;
}

export interface Internship extends Omit<Placement, 'type'> {
  duration?: string;
  type?: 'internship';
}

export interface Application {
  id: string;
  opportunityId?: string;
  opportunityType?: 'placement' | 'internship';
  company?: string;
  role?: string;
  studentId?: string;
  studentName?: string;
  studentCollegeId?: string;
  status: 'Applied' | 'Under Review' | 'Shortlisted' | 'Offer Extended' | 'Offer Accepted' | 'Rejected';
  appliedAt?: string;
}

export interface Book {
  id: string;
  isbn?: string;
  title: string;
  author?: string;
  category?: string;
  description?: string;
  cover_url?: string;
  publisher?: string;
  published_year?: number;
  total_copies: number;
  available_copies: number;
  digital_url?: string;
  source: 'physical' | 'digital' | 'both';
  added_by?: string;
  created_at?: string;
}

export interface Resume {
  id: string;
  student_id: string;
  data?: any;
  pdf_url?: string;
  updated_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message?: string;
  type?: 'attendance' | 'fee' | 'promotion' | 'exam' | 'general';
  is_read: boolean;
  created_at?: string;
}

export interface Classroom {
  id: string;
  name?: string;
  capacity?: number;
  status?: string;
  inviteCode?: string;
  subject?: string;
  memberUids?: string[];
  ownerId?: string;
  ownerName?: string;
  createdAt?: string;
  section?: string;
}

export type ExamStatus = 'Pending' | 'Scheduled' | 'Completed' | 'Cancelled' | 'Expired' | string;

export interface Room {
  id: string;
  roomNumber: string;
  capacity: number;
  occupied?: number;
  residents: { studentId: string; studentName: string; collegeId?: string; }[];
}

export interface HostelDetails {
  id: string;
  name: string;
  type: 'Boys' | 'Girls' | string;
  status: 'Operational' | 'Under Maintenance' | 'Closed' | string;
  warden: { name: string; contact: string; email: string; office: string; };
  amenities: string[];
  rulesHighlight: string[];
  rooms: Room[];
  capacity: number;
  occupied: number;
  complaints: Complaint[];
  totalRooms?: number;
  availableRooms?: number;
}

export interface Hostel {
  id: string;
  name?: string;
  type?: 'Boys' | 'Girls' | string;
  status?: 'Closed' | 'Operational' | 'Under Maintenance' | string;
  wardenName?: string;
  wardenContact?: string;
  wardenEmail?: string;
  wardenOffice?: string;
  warden?: string;
  capacity?: number;
  occupied?: number;
}

export interface CourseOption {
  id?: string;
  code?: string;
  name?: string;
  courseId?: string;
  courseName?: string;
  teacherId?: string;
  teacherName?: string;
}

export interface HallTicketData {
  studentName?: string;
  collegeId?: string;
  studentCollegeId?: string;
  year?: string | number;
  studentPhotoUrl?: string;
  program?: string;
  branch?: string;
  semester?: number;
  examSessionName?: string;
  exams?: HallTicketExam[];
  instructions?: string;
  controllerSignaturePlaceholder?: string;
  generatedDate?: string;
}

export interface HallTicketExam {
  id?: string;
  courseCode?: string;
  courseName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export interface HostelMenu {
  id: string;
  hostel_id: string;
  day_of_week: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | string;
  morning_slot: string;
  afternoon_slot: string;
  evening_slot: string;
  dinner_slot: string;
  created_at?: string;
}
