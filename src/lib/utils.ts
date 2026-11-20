
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Number of students per section — USN 1-15 → A, 16-30 → B, etc. */
export const SECTION_STRENGTH = 15;

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const nameParts = name.trim().split(' ');
  if (nameParts.length === 1 && name.length > 0) {
    return name.substring(0, Math.min(2, name.length)).toUpperCase();
  }
  if (nameParts.length > 1 && nameParts[0] && nameParts[nameParts.length - 1]) {
    return (nameParts[0][0] + (nameParts[nameParts.length - 1][0] || '')).toUpperCase();
  }
  return name.substring(0, Math.min(2, name.length)).toUpperCase();
};

export function formatDate(dateString: string | undefined | null, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return "N/A";
  try {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric', month: 'short', day: 'numeric',
    };
    // Handles both ISO strings and legacy timestamp-like objects
    const date = new Date(typeof dateString === 'string' ? dateString : (dateString as any).toDate());
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }
    return date.toLocaleDateString('en-US', options || defaultOptions);
  } catch (e) {
    console.error(`Invalid date string for formatDate: ${dateString}`, e);
    return "Invalid Date";
  }
}

export function generatePassword(firstName: string, dob: string): string | null {
  if (!firstName || !dob) return null;
  const namePart = firstName.substring(0, 3).toUpperCase();
  const dobDate = new Date(dob);
  if (isNaN(dobDate.getTime())) {
    console.error("Invalid DOB for password generation:", dob);
    return null;
  }
  const day = ('0' + dobDate.getDate()).slice(-2);
  const month = ('0' + (dobDate.getMonth() + 1)).slice(-2);
  return `${namePart}${day}${month}`;
};

// Period Schedule definitions (assuming standard generic hours)
export const PERIOD_SLOTS: Record<number, { title: string, start: [number, number], end: [number, number] }> = {
  1: { title: "09:00 AM - 10:00 AM", start: [9, 0], end: [10, 0] },
  2: { title: "10:00 AM - 11:00 AM", start: [10, 0], end: [11, 0] },
  3: { title: "11:00 AM - 12:00 PM", start: [11, 0], end: [12, 0] },
  4: { title: "12:00 PM - 01:00 PM", start: [12, 0], end: [13, 0] },
  5: { title: "01:00 PM - 02:00 PM", start: [13, 0], end: [14, 0] },
  6: { title: "02:00 PM - 03:00 PM", start: [14, 0], end: [15, 0] },
};

export function isPeriodActive(targetDateStr: string, periodNumber: number): boolean {
  const now = new Date();

  // Parse target date keeping local timezone in mind
  const targetDateParts = targetDateStr.split('-');
  if (targetDateParts.length !== 3) return false;

  const targetYear = parseInt(targetDateParts[0], 10);
  const targetMonth = parseInt(targetDateParts[1], 10) - 1; // JS months are 0-indexed
  const targetDay = parseInt(targetDateParts[2], 10);

  const targetDate = new Date(targetYear, targetMonth, targetDay);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. If it's a future date, it's NOT allowed
  if (targetDate > today) {
    return false;
  }

  // 2. If it's a past date, it's always allowed (back-attendance)
  if (targetDate < today) {
    return true;
  }

  // 3. If it's today, check if the period has started
  const slot = PERIOD_SLOTS[periodNumber];
  if (!slot) return false;

  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
  const startTotalMinutes = slot.start[0] * 60 + slot.start[1];

  // Allow a 5-minute buffer before the class starts (e.g. 8:55 AM for a 9:00 AM class)
  return currentTotalMinutes >= (startTotalMinutes - 5);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Period number → "HH:MM:SS" start/end strings stored in timetables. */
export function periodToTimes(period: number): { start: string; end: string } {
  const slot = PERIOD_SLOTS[period];
  const [sh, sm] = slot ? slot.start : [8 + period, 0];
  const [eh, em] = slot ? slot.end : [9 + period, 0];
  return { start: `${pad2(sh)}:${pad2(sm)}:00`, end: `${pad2(eh)}:${pad2(em)}:00` };
}

/** "HH:MM[:SS]" start time stored in timetables → period number (inverse of periodToTimes). */
export function periodFromStartTime(startTime: string | null | undefined): number {
  if (!startTime) return 1;
  const [h, m] = startTime.split(':').map((x) => parseInt(x, 10));
  for (const [p, slot] of Object.entries(PERIOD_SLOTS)) {
    if (slot.start[0] === h && slot.start[1] === (m || 0)) return Number(p);
  }
  return Math.max(1, (h || 9) - 8);
}

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Local weekday name, offset in days from today (0 = today, 1 = tomorrow). */
export function todayDayName(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return WEEK_DAYS[d.getDay()];
}

