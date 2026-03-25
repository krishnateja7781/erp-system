// ============================================================
// Teacher Chatbot API Route — POST /api/teacher/chat
// Auth: iron-session, role must be 'teacher'
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-session';
import { detectTeacherIntent } from '@/chatbots/teacher/intent';
import * as svc from '@/chatbots/teacher/service';
import * as fmt from '@/chatbots/teacher/formatter';
import type { ChatResponse, ChatError } from '@/chatbots/types';

const MAX_MESSAGE_LENGTH = 300;

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ChatError>(
        { success: false, role: 'teacher', intent: 'Error', message: 'Please log in to use the chatbot.', metadata: {} },
        { status: 401 }
      );
    }

    if (user.role !== 'teacher') {
      return NextResponse.json<ChatError>(
        { success: false, role: 'teacher', intent: 'Error', message: 'Access denied. This chatbot is for teachers only.', metadata: {} },
        { status: 403 }
      );
    }

    // ── Parse & sanitize input ──
    const body = await request.json().catch(() => null);
    if (!body || typeof body.message !== 'string') {
      return NextResponse.json<ChatError>(
        { success: false, role: 'teacher', intent: 'Error', message: 'Please provide a message.', metadata: {} },
        { status: 400 }
      );
    }

    const rawMessage = body.message.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (rawMessage.length === 0) {
      return NextResponse.json<ChatError>(
        { success: false, role: 'teacher', intent: 'Error', message: 'Message cannot be empty.', metadata: {} },
        { status: 400 }
      );
    }

    // ── Detect intent ──
    const detected = detectTeacherIntent(rawMessage);

    if (!detected) {
      return NextResponse.json<ChatResponse>({
        success: true,
        role: 'teacher',
        intent: 'Unrecognized',
        message: fmt.formatUnrecognized(),
        metadata: {},
      });
    }

    const { intent } = detected;
    const teacherUid = user.uid;
    const name = user.name || 'Teacher';
    const extraIds = { staffDocId: user.staffDocId, email: user.email };

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

      case 'ClassScheduleIntent': {
        const when = rawMessage.toLowerCase().includes('tomorrow') ? 'tomorrow' : 'today';
        const data = await svc.getTeacherSchedule(teacherUid, when, extraIds);
        message = fmt.formatSchedule(data, when);
        metadata = { day: data.day, classCount: data.classes.length };
        break;
      }

      case 'LowAttendanceIntent': {
        const data = await svc.getLowAttendanceStudents(teacherUid, extraIds);
        message = fmt.formatLowAttendance(data);
        metadata = { studentCount: data.students.length };
        break;
      }

      case 'ClassPerformanceIntent': {
        const data = await svc.getClassPerformance(teacherUid, extraIds);
        message = fmt.formatClassPerformance(data);
        break;
      }

      case 'MarksOverviewIntent': {
        const data = await svc.getMarksOverview(teacherUid, extraIds);
        message = fmt.formatMarksOverview(data);
        break;
      }

      case 'ExamIntent': {
        const data = await svc.getTeacherUpcomingExams(teacherUid, extraIds);
        message = fmt.formatExams(data);
        metadata = { examCount: data.exams.length };
        break;
      }

      case 'MyStudentsIntent': {
        const data = await svc.getTeacherStudentInfo(teacherUid, extraIds);
        message = fmt.formatStudentInfo(data);
        metadata = { totalStudents: data.totalStudents };
        break;
      }

      case 'PendingAttendanceIntent': {
        const data = await svc.getPendingAttendance(teacherUid, extraIds);
        message = fmt.formatPendingAttendance(data);
        break;
      }

      case 'ProfileIntent': {
        const data = await svc.getTeacherProfile(teacherUid, extraIds);
        message = fmt.formatProfile(data);
        break;
      }

      case 'CoursesIntent': {
        const data = await svc.getTeacherCourses(teacherUid, extraIds);
        message = fmt.formatCourses(data);
        metadata = { courseCount: data.courses.length };
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
      role: 'teacher',
      intent,
      message,
      metadata,
    });
  } catch (error) {
    console.error('[Teacher Chatbot Error]', error);
    return NextResponse.json<ChatError>(
      { success: false, role: 'teacher', intent: 'Error', message: 'Something went wrong. Please try again.', metadata: {} },
      { status: 500 }
    );
  }
}
