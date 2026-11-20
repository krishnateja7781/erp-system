/**
 * Four-component grading scheme (mirrored by the `tg_marks_compute`
 * trigger in database/03_triggers.sql — keep both in sync).
 *
 *   IA-1   entered /40  → contributes /20  (÷ 2)
 *   IA-2   entered /40  → contributes /20  (÷ 2)
 *   Others entered /20  → contributes /20
 *   SEE    entered /100 → contributes /40  (× 0.4)
 *   Total  /100, graded on the 10-point scale below. A grade is final only once SEE is entered.
 */

export const MARK_LIMITS = { ia1: 40, ia2: 40, other: 20, see: 100 } as const;

export function computeTotal(m: { ia1?: number | null; ia2?: number | null; other?: number | null; see?: number | null }): number {
  const total = Number(m.ia1 ?? 0) / 2 + Number(m.ia2 ?? 0) / 2 + Number(m.other ?? 0) + Number(m.see ?? 0) * 0.4;
  return Math.round(total);
}

export function gradeForTotal(total: number): string {
  if (total >= 90) return 'O';
  if (total >= 80) return 'A+';
  if (total >= 70) return 'A';
  if (total >= 60) return 'B+';
  if (total >= 55) return 'B';
  if (total >= 50) return 'C+';
  if (total >= 45) return 'C';
  if (total >= 40) return 'P';
  return 'F';
}

export function gradePoint(grade: string | null | undefined): number | null {
  switch ((grade || '').toUpperCase()) {
    case 'O': return 10;
    case 'A+': return 9;
    case 'A': return 8;
    case 'B+': return 7;
    case 'B': return 6;
    case 'C+': return 5;
    case 'C': return 4;
    case 'P': return 3;
    case 'F':
    case 'FAIL': return 0;
    default: return null;
  }
}

/** Credit-weighted grade point average. */
export function calculateCGPA(rows: { grade: string | null; credits: number | null }[]): number | null {
  let points = 0;
  let credits = 0;
  for (const r of rows) {
    const gp = gradePoint(r.grade);
    if (gp === null || !r.credits || r.credits <= 0) continue;
    points += gp * r.credits;
    credits += r.credits;
  }
  return credits === 0 ? null : Math.round((points / credits) * 100) / 100;
}
