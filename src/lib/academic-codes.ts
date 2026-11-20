/**
 * Single source of the academic catalogue and the codes used in every ID.
 * database/02_functions.sql (program_code, branch_code, department_code,
 * employee_type_code, generate_user_id) mirrors these tables exactly —
 * change both together.
 *
 * Every person ID is 12 characters, one algorithm for all roles:
 *
 *   CATEGORY(3) + YY(2) + SUBCATEGORY(2) + SERIAL(5)
 *
 *   Student      ENG 26 CS 00442   program + joining year + branch
 *   Teacher      TCH 26 CS 00017   role + joining year + department
 *   Employee     EMP 26 FE 00003   role + joining year + department type
 *   Super admin  ADM 26 SA 00001   role + year + "SA"
 *
 * The serial counts up per (category, year, subcategory): if 00442 is the last
 * one used for ENG26CS, the next person gets ENG26CS00443.
 */

export interface ProgramDef {
  name: string;
  code: string;
  branches: { name: string; code: string }[];
}

export const PROGRAM_CATALOG: ProgramDef[] = [
  {
    name: 'B.Tech', code: 'ENG',
    branches: [
      { name: 'CSE', code: 'CS' }, { name: 'ECE', code: 'EC' }, { name: 'MECH', code: 'ME' }, { name: 'IT', code: 'IT' },
      { name: 'AI&ML', code: 'AI' }, { name: 'DS', code: 'DS' }, { name: 'Cyber Security', code: 'CY' },
      { name: 'CIVIL', code: 'CV' }, { name: 'Other', code: 'OT' },
    ],
  },
  {
    name: 'MBA', code: 'MBA',
    branches: [
      { name: 'Marketing', code: 'MK' }, { name: 'Finance', code: 'FN' }, { name: 'HR', code: 'HR' },
      { name: 'Operations', code: 'OP' }, { name: 'General', code: 'GN' }, { name: 'Other', code: 'OT' },
    ],
  },
  {
    name: 'MCA', code: 'MCA',
    branches: [{ name: 'Computer Applications', code: 'CA' }, { name: 'Other', code: 'OT' }],
  },
  {
    name: 'Law', code: 'LAW',
    branches: [
      { name: 'Corporate Law', code: 'CR' }, { name: 'Criminal Law', code: 'CM' }, { name: 'Civil Law', code: 'CL' },
      { name: 'General', code: 'GN' }, { name: 'Other', code: 'OT' },
    ],
  },
  { name: 'MBBS', code: 'MED', branches: [{ name: 'General Medicine', code: 'GM' }] },
  {
    name: 'B.Sc', code: 'SCI',
    branches: [
      { name: 'Physics', code: 'PH' }, { name: 'Chemistry', code: 'CH' }, { name: 'Mathematics', code: 'MA' },
      { name: 'Computer Science', code: 'CS' }, { name: 'Biotechnology', code: 'BT' }, { name: 'Other', code: 'OT' },
    ],
  },
  {
    name: 'B.Com', code: 'COM',
    branches: [
      { name: 'General', code: 'GN' }, { name: 'Accounting & Finance', code: 'AF' }, { name: 'Taxation', code: 'TX' },
      { name: 'Corporate Secretaryship', code: 'SC' }, { name: 'Other', code: 'OT' },
    ],
  },
];

export const PROGRAMS = PROGRAM_CATALOG.map((p) => p.name);
export const BRANCHES: Record<string, string[]> = Object.fromEntries(PROGRAM_CATALOG.map((p) => [p.name, p.branches.map((b) => b.name)]));

/** Staff department → 2-letter code (teachers use it in their ID). */
export const DEPARTMENT_CODES: Record<string, string> = {
  CSE: 'CS', 'Computer Science': 'CS', 'Computer Science & Engineering': 'CS',
  ECE: 'EC', 'Electronics & Communication Engineering': 'EC',
  MECH: 'ME', 'Mechanical Engineering': 'ME',
  IT: 'IT', 'Information Technology': 'IT',
  'AI&ML': 'AI', 'Artificial Intelligence & Machine Learning': 'AI',
  DS: 'DS', 'Data Science': 'DS',
  'Cyber Security': 'CY',
  CIVIL: 'CV', 'Civil Engineering': 'CV',
  Mathematics: 'MA', Physics: 'PH', Chemistry: 'CH', English: 'EN', Biotechnology: 'BT',
  Marketing: 'MK', Finance: 'FN', HR: 'HR', Operations: 'OP', 'General Management': 'MG',
  'Computer Applications': 'CA',
  'Corporate Law': 'CR', 'Criminal Law': 'CM', 'Civil Law': 'CL', 'Constitutional Law': 'CN',
  Anatomy: 'AN', Physiology: 'PY', Biochemistry: 'BC', 'General Medicine': 'GM', Surgery: 'SG', Pediatrics: 'PD',
  General: 'GN', 'Accounting & Finance': 'AF', Taxation: 'TX', 'Corporate Secretaryship': 'SC',
  Administration: 'AD', 'General Administration': 'AD', Accounts: 'AC', 'IT Support': 'IS', Library: 'LB',
  'General Office': 'GO', Maintenance: 'MT', Security: 'SE', Other: 'OT',
};

/** Employee department type → 2-letter code (employees use it in their ID). */
export const EMPLOYEE_TYPE_CODES: Record<string, string> = {
  fee_management: 'FE',
  hostel_management: 'HM',
  student_staff_management: 'SS',
  exam_marks_management: 'EX',
  library_management: 'LB',
};

export const ROLE_CATEGORY = { teacher: 'TCH', employee: 'EMP', super_admin: 'ADM' } as const;
const RESERVED = new Set<string>(Object.values(ROLE_CATEGORY));

const lettersOnly = (v: string, n: number) => v.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, n).padEnd(n, 'X');

export function programCode(program?: string | null): string {
  const hit = PROGRAM_CATALOG.find((p) => p.name === program)?.code;
  if (hit) return hit;
  const fallback = lettersOnly(program || '', 3);
  return RESERVED.has(fallback) ? 'STU' : fallback;
}

export function branchCode(program?: string | null, branch?: string | null): string {
  const hit = PROGRAM_CATALOG.find((p) => p.name === program)?.branches.find((b) => b.name === branch)?.code;
  return hit || lettersOnly(branch || '', 2);
}

export function departmentCode(department?: string | null): string {
  if (!department) return 'GN';
  return DEPARTMENT_CODES[department] || lettersOnly(department, 2);
}

/** Two-digit joining year from a year or ISO date ("2026" / "2026-07-01" → "26"). */
export function yearCode(value?: string | number | null): string {
  const m = String(value ?? '').match(/(\d{4})/);
  return (m ? m[1] : String(new Date().getFullYear())).slice(2);
}

export const USER_ID_PATTERN = /^[A-Z]{3}\d{2}[A-Z]{2}\d{5}$/;

/** Preview only — the database assigns the real serial. */
export function previewStudentId(program?: string | null, branch?: string | null, joinYear?: string | number | null): string {
  return `${programCode(program)}${yearCode(joinYear)}${branchCode(program, branch)}00001`;
}

/** Preview only — the database assigns the real serial. */
export function previewStaffId(role: string, department?: string | null, employeeType?: string | null, joinYear?: string | number | null): string {
  const yy = yearCode(joinYear);
  if (role === 'teacher') return `TCH${yy}${departmentCode(department)}00001`;
  if (role === 'super_admin') return `ADM${yy}SA00001`;
  return `EMP${yy}${EMPLOYEE_TYPE_CODES[employeeType || ''] || 'GN'}00001`;
}
