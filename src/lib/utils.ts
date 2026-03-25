
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
    // Handles both ISO strings and Firestore Timestamp-like objects
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

export const getProgramCode = (program: string | undefined): string => {
  if (!program) return "XXX";
  const programCodes: Record<string, string> = {
    "B.Tech": "BTE",
    "MBA": "MBA",
    "Law": "LAW",
    "MBBS": "MBB",
    "B.Sc": "BSC",
    "B.Com": "BCO"
  };
  return programCodes[program] || program.replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase().padEnd(3, 'X');
};

export const getTeacherProgramCode = (program: string | undefined): string => {
  if (!program) return "XXXX";
  const programCodes: Record<string, string> = {
    "B.Tech": "BTEC",
    "MBA": "MBAD",
    "Law": "LAWS",
    "MBBS": "MBBS",
    "B.Sc": "BSCI",
    "B.Com": "BCOM"
  };
  return programCodes[program] || program.replace(/[^A-Z]/gi, '').substring(0, 4).toUpperCase().padEnd(4, 'X');
};

export const getBranchCode = (branch: string | undefined, program: string | undefined): string => {
  if (!branch || !program) return "XX";
  const branchCodes: Record<string, Record<string, string>> = {
    "B.Tech": { "CSE": "CSE", "ECE": "ECE", "MECH": "MEC", "IT": "IT", "AI&ML": "AML", "DS": "DS", "CIVIL": "CIV", "Other": "OTH" },
    "MBA": { "Marketing": "MKT", "Finance": "FIN", "HR": "HR", "Operations": "OPS", "General": "GEN", "Other": "OTH" },
    "Law": { "Corporate Law": "CRP", "Criminal Law": "CRM", "Civil Law": "CVL", "General": "GEN", "Other": "OTH" },
    "MBBS": { "General Medicine": "GMD" },
    "B.Sc": { "Physics": "PHY", "Chemistry": "CHM", "Mathematics": "MTH", "Computer Science": "CSE", "Biotechnology": "BIO", "Other": "OTH" },
    "B.Com": { "General": "GEN", "Accounting & Finance": "ACF", "Taxation": "TAX", "Corporate Secretaryship": "CRS", "Other": "OTH" },
  };
  const programBranches = branchCodes[program];
  if (programBranches && programBranches[branch]) {
    return programBranches[branch];
  }
  return branch.replace(/[^A-Z0-9]/gi, '').substring(0, 3).toUpperCase().padEnd(2, 'X');
};

export const getDepartmentCode = (department: string | undefined, program?: string | undefined): string => {
  if (!department) return "XX";

  const deptMap: Record<string, string> = {
    "Computer Science & Engineering": "CS",
    "Electronics & Communication Engineering": "EC",
    "Mechanical Engineering": "ME",
    "Information Technology": "IT",
    "Artificial Intelligence & Machine Learning": "AI",
    "Data Science": "DS",
    "Civil Engineering": "CE",
    "General Administration": "AD",
    "Accounts": "AC",
    "Administration": "AD",
    "Library": "LB",
    "IT Support": "IT",
    "Physics": "PH",
    "Chemistry": "CH",
    "Mathematics": "MA"
  };

  if (deptMap[department]) {
    return deptMap[department];
  }

  // Fallback logic
  if (department.toUpperCase().includes("CSE") || department.toUpperCase().includes("COMPUTER SCIENCE")) return "CS";
  if (department.toUpperCase().includes("ECE") || department.toUpperCase().includes("ELECTRONICS")) return "EC";
  if (department.toUpperCase().includes("MECH") || department.toUpperCase().includes("MECHANICAL")) return "ME";
  if (department.toUpperCase().includes("IT") || department.toUpperCase().includes("INFORMATION TECHNOLOGY")) return "IT";
  if (department.toUpperCase().includes("ADMINISTRATION")) return "AD";
  if (department.toUpperCase().includes("ACCOUNTS")) return "AC";
  if (department.toUpperCase().includes("LAW")) return "LW";
  if (department.toUpperCase().includes("MEDICINE") || department.toUpperCase().includes("MBBS")) return "MD";
  if (department.toUpperCase().includes("MBA")) return "BA";
  return department.substring(0, Math.min(department.length, 2)).toUpperCase();
};


export function generateUSN(program: string, year: string, branch: string, sequenceNumber: number): string {
  // USN FORMAT: [ProgCode(3)][Year(2)][BranchCode][Seq(4)]
  const progCode = getProgramCode(program);
  const yearCode = year.length === 4 ? year.substring(2) : (year.length === 2 ? year : '00');
  const branchCode = getBranchCode(branch, program);
  const seqStr = sequenceNumber.toString().padStart(4, '0');
  return `${progCode}${yearCode}${branchCode}${seqStr}`.toUpperCase();
}

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
