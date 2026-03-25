// ============================================================
// Admin Chatbot API Route — POST /api/admin/chat
// Auth: iron-session, role must be 'super_admin'
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-session';
import { detectAdminIntent, extractSearchTerm, extractHostelName, extractBranch, extractYear, extractSemester, extractCourseName } from '@/chatbots/admin/intent';
import * as svc from '@/chatbots/admin/service';
import * as fmt from '@/chatbots/admin/formatter';
import type { ChatResponse, ChatError } from '@/chatbots/types';

const MAX_MESSAGE_LENGTH = 300;

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ChatError>(
        { success: false, role: 'super_admin', intent: 'Error', message: 'Please log in to use the chatbot.', metadata: {} },
        { status: 401 }
      );
    }

    if (user.role !== 'super_admin') {
      return NextResponse.json<ChatError>(
        { success: false, role: 'super_admin', intent: 'Error', message: 'Access denied. This chatbot is for super admins only.', metadata: {} },
        { status: 403 }
      );
    }

    // ── Parse & sanitize input ──
    const body = await request.json().catch(() => null);
    if (!body || typeof body.message !== 'string') {
      return NextResponse.json<ChatError>(
        { success: false, role: 'super_admin', intent: 'Error', message: 'Please provide a message.', metadata: {} },
        { status: 400 }
      );
    }

    const rawMessage = body.message.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (rawMessage.length === 0) {
      return NextResponse.json<ChatError>(
        { success: false, role: 'super_admin', intent: 'Error', message: 'Message cannot be empty.', metadata: {} },
        { status: 400 }
      );
    }

    // ── Detect intent ──
    const detected = detectAdminIntent(rawMessage);

    if (!detected) {
      return NextResponse.json<ChatResponse>({
        success: true,
        role: 'super_admin',
        intent: 'Unrecognized',
        message: fmt.formatUnrecognized(),
        metadata: {},
      });
    }

    const { intent } = detected;
    const name = user.name || 'Admin';

    let message = '';
    let metadata: Record<string, unknown> = {};

    // ── Route to service + formatter ──
    switch (intent) {
      case 'GreetingIntent':
        message = fmt.formatGreeting(name);
        break;

      case 'HelpIntent':
        message = fmt.formatHelp();
        break;

      case 'TotalStudentsIntent': {
        const data = await svc.getTotalStudents();
        message = fmt.formatTotalStudents(data);
        metadata = { total: data.total };
        break;
      }

      case 'TotalTeachersIntent': {
        const data = await svc.getTotalTeachers();
        message = fmt.formatTotalTeachers(data);
        metadata = { total: data.total };
        break;
      }

      case 'OverallAttendanceIntent': {
        const data = await svc.getOverallAttendance();
        message = fmt.formatOverallAttendance(data);
        metadata = { percentage: data.overallPercentage };
        break;
      }

      case 'FeeSummaryIntent': {
        const data = await svc.getFeeSummary();
        message = fmt.formatFeeSummary(data);
        metadata = { collectionRate: data.collectionRate };
        break;
      }

      case 'HostelOccupancyIntent': {
        const data = await svc.getHostelOccupancy();
        message = fmt.formatHostelOccupancy(data);
        metadata = { totalOccupied: data.totalOccupied, totalCapacity: data.totalCapacity };
        break;
      }

      case 'HostelDetailsIntent': {
        const hostelName = extractHostelName(rawMessage);
        if (!hostelName) {
          // Fallback to general hostel occupancy if no specific hostel identified
          const data = await svc.getHostelOccupancy();
          message = fmt.formatHostelOccupancy(data);
          metadata = { totalOccupied: data.totalOccupied, totalCapacity: data.totalCapacity };
        } else {
          const data = await svc.getHostelDetails(hostelName);
          message = fmt.formatHostelDetails(data);
          metadata = { query: hostelName, found: data.found };
        }
        break;
      }

      case 'WardenDetailsIntent': {
        const hostelName = extractHostelName(rawMessage);
        const data = await svc.getWardenDetails(hostelName);
        message = fmt.formatWardenDetails(data);
        metadata = { query: hostelName, found: data.found };
        break;
      }

      case 'HostelRoomsIntent': {
        const hostelName = extractHostelName(rawMessage);
        const data = await svc.getHostelRooms(hostelName);
        message = fmt.formatHostelRooms(data);
        metadata = { hostelName: data.hostelName, totalRooms: data.totalRooms };
        break;
      }

      case 'ComplaintSummaryIntent': {
        const hostelName = extractHostelName(rawMessage);
        const data = await svc.getComplaintsSummary(hostelName);
        message = fmt.formatComplaintsSummary(data);
        metadata = { total: data.totalComplaints, pending: data.pending };
        break;
      }

      case 'PerformanceAnalyticsIntent': {
        const data = await svc.getPerformanceAnalytics();
        message = fmt.formatPerformanceAnalytics(data);
        metadata = { passRate: data.overallPassRate };
        break;
      }

      case 'ExamScheduleIntent': {
        const data = await svc.getExamSchedules();
        message = fmt.formatExamSchedules(data);
        metadata = { examCount: data.exams.length };
        break;
      }

      case 'StudentDistributionIntent': {
        const data = await svc.getStudentDistribution();
        message = fmt.formatStudentDistribution(data);
        break;
      }

      case 'PendingApprovalsIntent': {
        const data = await svc.getPendingApprovals();
        message = fmt.formatPendingApprovals(data);
        metadata = { count: data.count };
        break;
      }

      case 'RecentLoginsIntent': {
        const data = await svc.getRecentLogins();
        message = fmt.formatRecentLogins(data);
        metadata = { loginCount: data.logins.length };
        break;
      }

      case 'CoursesOverviewIntent': {
        const data = await svc.getCoursesOverview();
        message = fmt.formatCoursesOverview(data);
        metadata = { totalCourses: data.totalCourses };
        break;
      }

      case 'ClassesOverviewIntent': {
        const data = await svc.getClassesOverview();
        message = fmt.formatClassesOverview(data);
        metadata = { totalClasses: data.totalClasses };
        break;
      }

      case 'ClassLookupIntent': {
        const branch = extractBranch(rawMessage);
        const year = extractYear(rawMessage);
        const semester = extractSemester(rawMessage);
        if (!branch && !year && !semester) {
          const data = await svc.getClassesOverview();
          message = fmt.formatClassesOverview(data);
          metadata = { totalClasses: data.totalClasses };
        } else {
          const data = await svc.lookupClasses({ branch: branch || undefined, year: year || undefined, semester: semester || undefined });
          message = fmt.formatClassLookup(data);
          metadata = { totalMatches: data.totalMatches, filters: data.filters };
        }
        break;
      }

      case 'CourseLookupIntent': {
        const courseName = extractCourseName(rawMessage);
        if (!courseName) {
          const data = await svc.getCoursesOverview();
          message = fmt.formatCoursesOverview(data);
          metadata = { totalCourses: data.totalCourses };
        } else {
          const data = await svc.lookupCourse(courseName);
          message = fmt.formatCourseLookup(data);
          metadata = { query: courseName, found: data.found };
        }
        break;
      }

      case 'BranchStudentsIntent': {
        const branch = extractBranch(rawMessage);
        const year = extractYear(rawMessage);
        const semester = extractSemester(rawMessage);
        const data = await svc.getBranchStudents({ branch: branch || undefined, year: year || undefined, semester: semester || undefined });
        message = fmt.formatBranchStudents(data);
        metadata = { total: data.total, filters: data.filters };
        break;
      }

      case 'PlacementOverviewIntent': {
        const data = await svc.getPlacementOverview();
        message = fmt.formatPlacementOverview(data);
        metadata = { totalPlacements: data.totalPlacements, totalApplications: data.totalApplications };
        break;
      }

      case 'ApplicationsOverviewIntent': {
        const data = await svc.getApplicationsOverview();
        message = fmt.formatApplicationsOverview(data);
        metadata = { total: data.total };
        break;
      }

      case 'NotificationsIntent': {
        const data = await svc.getNotificationsSummary();
        message = fmt.formatNotificationsSummary(data);
        metadata = { total: data.total, unread: data.unread };
        break;
      }

      case 'TimetableIntent': {
        const branch = extractBranch(rawMessage);
        const semester = extractSemester(rawMessage);
        const data = await svc.getTimetableSummary({ branch: branch || undefined, semester: semester || undefined });
        message = fmt.formatTimetableSummary(data);
        metadata = { totalSlots: data.totalSlots };
        break;
      }

      case 'ClassroomOverviewIntent': {
        const data = await svc.getClassroomOverview();
        message = fmt.formatClassroomOverview(data);
        metadata = { total: data.total };
        break;
      }

      case 'StudentLookupIntent': {
        const term = extractSearchTerm(rawMessage);
        if (!term) {
          message = 'Please provide a USN or student name. For example: "Who is BTE26CSE0010?" or "Find student named John"';
        } else {
          const data = await svc.lookupStudent(term.type, term.value);
          message = fmt.formatStudentLookup(data);
          metadata = { query: term.value, queryType: term.type, found: data.found };
        }
        break;
      }

      case 'TeacherLookupIntent': {
        const term = extractSearchTerm(rawMessage);
        if (!term) {
          message = 'Please provide a teacher name. For example: "Find teacher named Smith"';
        } else {
          const data = await svc.lookupTeacher(term.value);
          message = fmt.formatTeacherLookup(data);
          metadata = { query: term.value, found: data.found };
        }
        break;
      }

      case 'PersonalInfoIntent': {
        message = fmt.formatPersonalInfo({ name: user.name || 'Super Admin', email: user.email || 'N/A', role: user.role || 'super_admin' });
        break;
      }

      case 'DateTimeIntent': {
        message = fmt.formatDateTime();
        break;
      }

      case 'GenderBreakdownIntent': {
        const branch = extractBranch(rawMessage);
        const data = await svc.getGenderBreakdown(branch || undefined);
        message = fmt.formatGenderBreakdown(data);
        metadata = { boys: data.boys, girls: data.girls, total: data.total };
        break;
      }

      case 'DashboardSummaryIntent': {
        const data = await svc.getDashboardSummary();
        message = fmt.formatDashboardSummary(data);
        metadata = { activeStudents: data.activeStudents, totalTeachers: data.totalTeachers };
        break;
      }

      case 'StudentSummaryIntent': {
        const data = await svc.getStudentSummary();
        message = fmt.formatStudentSummary(data);
        metadata = { total: data.total, active: data.active };
        break;
      }

      case 'TeacherSummaryIntent': {
        const data = await svc.getTeacherSummary();
        message = fmt.formatTeacherSummary(data);
        metadata = { total: data.total };
        break;
      }

      case 'GoodbyeIntent':
        message = fmt.formatGoodbye(name);
        break;

      default:
        message = fmt.formatUnrecognized();
        break;
    }

    return NextResponse.json<ChatResponse>({
      success: true,
      role: 'super_admin',
      intent,
      message,
      metadata,
    });
  } catch (error) {
    console.error('[Admin Chatbot Error]', error);
    return NextResponse.json<ChatError>(
      { success: false, role: 'super_admin', intent: 'Error', message: 'Something went wrong. Please try again.', metadata: {} },
      { status: 500 }
    );
  }
}
