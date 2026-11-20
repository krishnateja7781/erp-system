/**
 * Small data-access helpers shared by server actions.
 *
 * PostgREST (Supabase) caps every response at `max_rows` (1000 by default).
 * Any listing that can exceed that — students, attendance, fees… — must page
 * through the result or it silently truncates. `fetchAllRows` does that with
 * bounded page sizes so memory and latency stay predictable at scale.
 */

const PAGE_SIZE = 1000;
const HARD_LIMIT = 50_000;

type RangeableQuery<T> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
};

/**
 * @param build factory returning a fresh, fully-filtered & ordered query each call
 *              (a query builder can only be awaited once).
 */
export async function fetchAllRows<T = any>(build: () => RangeableQuery<T>, hardLimit = HARD_LIMIT): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < hardLimit; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Splits an array into chunks (used to keep `.in()` filters and bulk inserts within URL/body limits). */
export function chunk<T>(items: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Courses are referenced by UUID or by human code ("BT3CSE001"); resolve to UUID. */
export async function resolveCourseId(supabase: any, courseIdOrCode: string): Promise<string | null> {
  if (!courseIdOrCode) return null;
  if (/^[0-9a-f-]{36}$/i.test(courseIdOrCode)) return courseIdOrCode;
  const { data } = await supabase.from('courses').select('id').eq('code', courseIdOrCode).maybeSingle();
  return data?.id ?? null;
}
