// ============================================================
// Student Intent Detector — Keyword-based, deterministic
// NO AI, NO NLP, NO ML — pure string matching
// ============================================================

import type { DetectedIntent } from '../types';

interface IntentRule {
  intent: string;
  keywords: string[];
  priority: number; // higher = checked first when multiple match
}

const STUDENT_INTENT_RULES: IntentRule[] = [
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
    intent: 'AttendanceIntent',
    keywords: ['attendance', 'absent', 'present', 'bunked', 'absent days', 'attendance percentage', 'attendance %'],
    priority: 10,
  },
  {
    intent: 'ClassScheduleIntent',
    keywords: ['class today', 'classes today', 'schedule', 'timetable', 'class tomorrow', 'classes tomorrow', 'today class', 'tomorrow class', 'periods', 'what class'],
    priority: 10,
  },
  {
    intent: 'ExamIntent',
    keywords: ['exam', 'exams', 'examination', 'test', 'upcoming exam', 'exam schedule', 'exam date', 'hall ticket', 'exam timetable'],
    priority: 10,
  },
  {
    intent: 'MarksIntent',
    keywords: ['marks', 'grade', 'grades', 'cgpa', 'gpa', 'result', 'results', 'score', 'scores', 'ia1', 'ia2', 'see', 'internal', 'external', 'performance', 'how am i doing'],
    priority: 10,
  },
  {
    intent: 'WeakSubjectsIntent',
    keywords: ['weak subject', 'weak subjects', 'failing', 'fail', 'low marks', 'poor performance', 'backlog', 'backlogs', 'arrear', 'arrears', 'worst subject'],
    priority: 12,
  },
  {
    intent: 'FeesIntent',
    keywords: ['fee', 'fees', 'payment', 'pending fee', 'fee due', 'fee balance', 'tuition', 'college fee', 'hostel fee', 'pay fee', 'fee status', 'fee paid'],
    priority: 10,
  },
  {
    intent: 'HostelIntent',
    keywords: ['hostel', 'room', 'warden', 'complaint', 'hostel complaint', 'room number', 'roommate', 'hostel details', 'hostel info'],
    priority: 10,
  },
  {
    intent: 'ProfileIntent',
    keywords: ['profile', 'my details', 'my info', 'my information', 'who am i', 'my name', 'my branch', 'my section', 'my year', 'my semester'],
    priority: 5,
  },
  {
    intent: 'CoursesIntent',
    keywords: ['course', 'courses', 'subjects', 'enrolled', 'my courses', 'my subjects', 'what am i studying'],
    priority: 8,
  },
  {
    intent: 'GoodbyeIntent',
    keywords: ['bye', 'goodbye', 'see you', 'exit', 'quit', 'close', 'thank you', 'thanks', 'thank'],
    priority: 0,
  },
];

/**
 * Detect intent from a student message.
 * Uses keyword matching with priority-based resolution.
 * Returns null if no intent matched — caller should handle gracefully.
 */
export function detectStudentIntent(rawMessage: string): DetectedIntent | null {
  if (!rawMessage || typeof rawMessage !== 'string') return null;

  const message = rawMessage.toLowerCase().trim();
  if (message.length === 0) return null;

  const matches: { intent: string; priority: number; confidence: 'exact' | 'partial' }[] = [];

  for (const rule of STUDENT_INTENT_RULES) {
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

  // Sort by priority desc, prefer exact matches
  matches.sort((a, b) => b.priority - a.priority);

  return { intent: matches[0].intent, confidence: matches[0].confidence };
}
