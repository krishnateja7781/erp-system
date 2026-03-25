import { createServerSupabaseClient } from '@/lib/supabase';

// Helper to generate IDs
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function nowISO(): string {
  return new Date().toISOString();
}

// Map local collection names to Supabase tables
const collectionMap: Record<string, string> = {
  users: 'users',
  students: 'students',
  teachers: 'teachers',
  admins: 'admins',
  courses: 'courses',
  classes: 'classes',
  attendance: 'attendance',
  marks: 'marks',
  fees: 'fees',
  hostels: 'hostels',
  rooms: 'hostel_rooms',
  complaints: 'complaints',
  opportunities: 'opportunities',
  applications: 'applications',
  exams: 'exam_schedules',
  placements: 'opportunities',
  internships: 'opportunities',
  loginActivities: 'login_activities',
  notifications: 'notifications',
  hallTickets: 'hall_tickets',
  classrooms: 'classrooms',
  classroom_posts: 'classroom_posts',
  classroom_assignments: 'classroom_assignments',
  classroom_submissions: 'classroom_submissions',
};

// Tables that may not exist yet – silently return [] instead of logging errors
const optionalCollections = new Set(['loginActivities', 'notifications', 'login_activities']);

function getTable(collection: string): string {
  return collectionMap[collection] || collection;
}

function mapFromDB(collection: string, data: any): any {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(d => mapFromDB(collection, d));
  if (collection === 'courses' && 'name' in data) {
    const { name, ...rest } = data;
    return { ...rest, courseName: name };
  }
  return data;
}

function mapToDB(collection: string, data: any): any {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(d => mapToDB(collection, d));
  if (collection === 'courses' && 'courseName' in data) {
    const { courseName, ...rest } = data;
    return { ...rest, name: courseName };
  }
  return data;
}

export async function readCollection<T = any>(collection: string): Promise<T[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from(getTable(collection)).select('*');
  if (error) {
    if (!optionalCollections.has(collection)) {
      console.error('Error reading collection', collection, error);
    }
    return [];
  }
  return mapFromDB(collection, data) as T[];
}

export async function writeCollection<T = any>(collection: string, data: T[]): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from(getTable(collection)).upsert(mapToDB(collection, data));
  if (error) console.error('Error writing collection', collection, error);
}

export async function insertDoc<T extends { id: string }>(collection: string, doc: T): Promise<T> {
  const supabase = await createServerSupabaseClient();
  const mappedDoc = mapToDB(collection, doc);
  const { data, error } = await supabase.from(getTable(collection)).insert(mappedDoc).select().single();
  if (error) throw error;
  return mapFromDB(collection, data || mappedDoc) as T;
}

export async function updateDoc(collection: string, id: string, updates: Record<string, any>): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from(getTable(collection)).update(mapToDB(collection, updates)).eq('id', id);
  return !error;
}

export async function deleteDoc(collection: string, id: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from(getTable(collection)).delete().eq('id', id);
  return !error;
}

export async function findWhere<T>(collection: string, predicate: (item: T) => boolean): Promise<T[]> {
  const items = await readCollection<T>(collection);
  return items.filter(predicate);
}

export async function findOneWhere<T>(collection: string, predicate: (item: T) => boolean): Promise<T | null> {
  const items = await readCollection<T>(collection);
  return items.find(predicate) || null;
}

/**
 * Fast single-row lookup by a specific column value.
 * Uses a targeted Supabase .eq() query instead of fetching the entire table.
 */
export async function findOneByField<T = any>(collection: string, field: string, value: any): Promise<T | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from(getTable(collection))
    .select('*')
    .eq(field, value)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapFromDB(collection, data) as T;
}

export async function deleteManyWhere(collection: string, predicate: (item: any) => boolean): Promise<number> {
  const items = await readCollection<any>(collection);
  const toDelete = items.filter(predicate);
  if (toDelete.length === 0) return 0;

  const ids = toDelete.map(i => i.id);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from(getTable(collection)).delete().in('id', ids);
  if (error) {
    console.error('deleteManyWhere error', error);
    return 0;
  }
  return toDelete.length;
}

export async function getNextCounter(key: string): Promise<number> {
  const supabase = await createServerSupabaseClient();
  // Single-roundtrip atomic increment via PostgreSQL RPC
  try {
    const { data, error } = await supabase.rpc('increment_counter', { counter_key: key });
    if (!error && typeof data === 'number') return data;

    // Fallback if RPC doesn't exist: read-then-write
    const { data: existing } = await supabase
      .from('counters')
      .select('value')
      .eq('id', key)
      .single();

    const nextVal = (existing?.value || 0) + 1;
    await supabase.from('counters').upsert({ id: key, value: nextVal });
    return nextVal;
  } catch {
    // Counters table may not exist — fall back to timestamp-based unique suffix
    return parseInt(Date.now().toString().slice(-6), 10);
  }
}
