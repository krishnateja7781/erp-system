// ============================================================
// Teacher Intent Detector — Keyword-based, deterministic
// NO AI, NO NLP, NO ML — pure string matching
// ============================================================

import type { DetectedIntent } from '../types';

interface IntentRule {
  intent: string;
  keywords: string[];
  priority: number;
}

const TEACHER_INTENT_RULES: IntentRule[] = [
  {
    intent: 'GreetingIntent',
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'greetings', 'namaste'],
    priority: 0,
  },
  {
    intent: 'HelpIntent',
    keywords: ['help', 'what can you do', 'commands', 'options', 'menu', 'assist'],
    priority: 1,
  },
  {
    intent: 'ClassScheduleIntent',
    keywords: ['class today', 'classes today', 'schedule', 'timetable', 'class tomorrow', 'classes tomorrow', 'today class', 'tomorrow class', 'periods', 'my classes', 'teaching today', 'what class'],
    priority: 10,
  },
  {
    intent: 'LowAttendanceIntent',
    keywords: ['low attendance', 'below 75', 'below attendance', 'absent students', 'attendance below', 'poor attendance', 'students below', 'attendance threshold', 'defaulters', 'shortage'],
    priority: 12,
  },
  {
    intent: 'ClassPerformanceIntent',
    keywords: ['class performance', 'how is my class', 'student performance', 'class average', 'class analytics', 'performance analytics', 'how are students doing', 'class result', 'pass percentage'],
    priority: 12,
  },
  {
    intent: 'MarksOverviewIntent',
    keywords: ['marks overview', 'marks', 'grades', 'marks summary', 'results', 'student marks', 'ia1', 'ia2', 'see', 'internal', 'external'],
    priority: 10,
  },
  {
    intent: 'ExamIntent',
    keywords: ['exam', 'exams', 'upcoming exam', 'exam schedule', 'examination', 'exam date', 'exam timetable'],
    priority: 10,
  },
  {
    intent: 'MyStudentsIntent',
    keywords: ['my students', 'student count', 'how many students', 'total students', 'students list', 'enrolled students', 'student strength'],
    priority: 10,
  },
  {
    intent: 'PendingAttendanceIntent',
    keywords: ['pending attendance', 'attendance pending', 'not marked', 'unmarked attendance', 'forgot attendance', 'need to mark'],
    priority: 12,
  },
  {
    intent: 'ProfileIntent',
    keywords: ['my profile', 'profile', 'my details', 'my info', 'who am i', 'my name', 'my department'],
    priority: 5,
  },
  {
    intent: 'CoursesIntent',
    keywords: ['my courses', 'courses', 'subjects', 'teaching', 'courses assigned', 'what do i teach'],
    priority: 8,
  },
  {
    intent: 'GoodbyeIntent',
    keywords: ['bye', 'goodbye', 'see you', 'exit', 'quit', 'close', 'thank you', 'thanks', 'thank'],
    priority: 0,
  },
];

/**
 * Detect intent from a teacher message.
 */
export function detectTeacherIntent(rawMessage: string): DetectedIntent | null {
  if (!rawMessage || typeof rawMessage !== 'string') return null;

  const message = rawMessage.toLowerCase().trim();
  if (message.length === 0) return null;

  const matches: { intent: string; priority: number; confidence: 'exact' | 'partial' }[] = [];

  for (const rule of TEACHER_INTENT_RULES) {
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

  if (matches.length === 0) return null;

  matches.sort((a, b) => b.priority - a.priority);
  return { intent: matches[0].intent, confidence: matches[0].confidence };
}
