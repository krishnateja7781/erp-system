// ============================================================
// Student Chatbot API Route — POST /api/student/chat
// Auth: iron-session, role must be 'student'
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-session';
import { detectStudentIntent } from '@/chatbots/student/intent';
import * as svc from '@/chatbots/student/service';
import * as fmt from '@/chatbots/student/formatter';
import type { ChatResponse, ChatError } from '@/chatbots/types';

const MAX_MESSAGE_LENGTH = 300;

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ChatError>(
        { success: false, role: 'student', intent: 'Error', message: 'Please log in to use the chatbot.', metadata: {} },
        { status: 401 }
      );
    }

    if (user.role !== 'student') {
      return NextResponse.json<ChatError>(
        { success: false, role: 'student', intent: 'Error', message: 'Access denied. This chatbot is for students only.', metadata: {} },
        { status: 403 }
      );
    }

    if (!user.studentDocId) {
      return NextResponse.json<ChatError>(
        { success: false, role: 'student', intent: 'Error', message: 'Student profile not found. Please contact admin.', metadata: {} },
        { status: 400 }
      );
    }

    // ── Parse & sanitize input ──
    const body = await request.json().catch(() => null);
    if (!body || typeof body.message !== 'string') {
      return NextResponse.json<ChatError>(
        { success: false, role: 'student', intent: 'Error', message: 'Please provide a message.', metadata: {} },
        { status: 400 }
      );
    }

    const rawMessage = body.message.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (rawMessage.length === 0) {
      return NextResponse.json<ChatError>(
        { success: false, role: 'student', intent: 'Error', message: 'Message cannot be empty.', metadata: {} },
        { status: 400 }
      );
    }

    // ── Detect intent ──
    const detected = detectStudentIntent(rawMessage);

    if (!detected) {
      return NextResponse.json<ChatResponse>({
        success: true,
        role: 'student',
        intent: 'Unrecognized',
        message: fmt.formatUnrecognized(),
        metadata: {},
      });
    }

    const { intent } = detected;
    const studentDocId = user.studentDocId;
    const name = user.name || 'Student';

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

      case 'AttendanceIntent': {
        const data = await svc.getStudentAttendance(studentDocId);
        message = fmt.formatAttendance(data);
        metadata = { percentage: data.percentage };
        break;
      }

      case 'ClassScheduleIntent': {
        const when = rawMessage.toLowerCase().includes('tomorrow') ? 'tomorrow' : 'today';
        const data = await svc.getStudentSchedule(studentDocId, when);
        message = fmt.formatSchedule(data, when);
        metadata = { day: data.day, classCount: data.classes.length };
        break;
      }

      case 'ExamIntent': {
        const data = await svc.getStudentUpcomingExams(studentDocId);
        message = fmt.formatExams(data);
        metadata = { examCount: data.exams.length };
        break;
      }

      case 'MarksIntent': {
        const data = await svc.getStudentMarksSummary(studentDocId);
        message = fmt.formatMarks(data);
        metadata = { cgpa: data.cgpa };
        break;
      }

      case 'WeakSubjectsIntent': {
        const data = await svc.getStudentWeakSubjects(studentDocId);
        message = fmt.formatWeakSubjects(data);
        metadata = { weakCount: data.weakSubjects.length };
        break;
      }

      case 'FeesIntent': {
        const data = await svc.getStudentFeeDetails(studentDocId);
        message = fmt.formatFees(data);
        metadata = { balance: data.balance };
        break;
      }

      case 'HostelIntent': {
        const data = await svc.getStudentHostelDetails(studentDocId);
        message = fmt.formatHostel(data);
        break;
      }

      case 'ProfileIntent': {
        const data = await svc.getStudentProfile(studentDocId);
        message = fmt.formatProfile(data);
        break;
      }

      case 'CoursesIntent': {
        const data = await svc.getStudentCourses(studentDocId);
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
      role: 'student',
      intent,
      message,
      metadata,
    });
  } catch (error) {
    console.error('[Student Chatbot Error]', error);
    return NextResponse.json<ChatError>(
      { success: false, role: 'student', intent: 'Error', message: 'Something went wrong. Please try again.', metadata: {} },
      { status: 500 }
    );
  }
}
