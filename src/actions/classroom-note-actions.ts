'use server';

// BUG FIX #1: Was using browser-side supabase singleton in a server action.
// BUG FIX #2–4: All camelCase column references fixed to snake_case (classroom_id, created_at, teacher_id, file_url).
import { createServerSupabaseClient } from '@/lib/supabase';
import { generateId } from '@/lib/db';
import type { ActionResult } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────

export interface ClassroomNote {
  id: string;
  classroomId: string;
  teacherId: string;
  teacherName: string;
  description: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

// Re-use existing 'submissions' bucket with notes/ prefix
const NOTES_BUCKET = 'submissions';

// ─── Create note record in DB (file already uploaded client-side) ───

export async function createNoteRecord(payload: {
  classroomId: string;
  teacherId: string;
  teacherName: string;
  description: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}): Promise<ActionResult & { note?: ClassroomNote }> {
  try {
    const { classroomId, teacherId, teacherName, description, fileName, fileUrl, fileType, fileSize } = payload;

    if (!classroomId || !teacherId || !teacherName || !fileName || !fileUrl) {
      return { success: false, error: 'Missing required fields.' };
    }

    const supabase = await createServerSupabaseClient();
    const noteId = generateId();
    const now = new Date().toISOString();

    // Insert using snake_case column names matching the DB schema
    const { error: dbError } = await supabase.from('classroom_notes').insert({
      id: noteId,
      classroom_id: classroomId,
      teacher_id: teacherId,
      teacher_name: teacherName,
      description: (description || '').trim(),
      file_name: fileName,
      file_url: fileUrl,
      file_type: fileType,
      file_size: fileSize,
      created_at: now,
    });

    if (dbError) {
      return { success: false, error: `Failed to save note: ${dbError.message}` };
    }

    const noteRecord: ClassroomNote = {
      id: noteId,
      classroomId,
      teacherId,
      teacherName,
      description: (description || '').trim(),
      fileName,
      fileUrl,
      fileType,
      fileSize,
      createdAt: now,
    };

    return { success: true, message: 'Note uploaded successfully.', note: noteRecord };
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred.' };
  }
}

// ─── List notes for a classroom ─────────────────────────

export async function listNotes(classroomId: string): Promise<ClassroomNote[]> {
  const supabase = await createServerSupabaseClient();

  // BUG FIX #2: column is 'classroom_id' not 'classroomId'
  // BUG FIX #3: order by 'created_at' not 'createdAt'
  const { data, error } = await supabase
    .from('classroom_notes')
    .select('*')
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false });

  if (error) return [];

  // Map snake_case DB rows to camelCase ClassroomNote interface
  return (data || []).map((row: any) => ({
    id: row.id,
    classroomId: row.classroom_id,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    description: row.description || '',
    fileName: row.file_name,
    fileUrl: row.file_url,
    fileType: row.file_type || '',
    fileSize: row.file_size || 0,
    createdAt: row.created_at,
  }));
}

// ─── Delete a note (only the teacher who posted it) ─────

export async function deleteNote(noteId: string, userId: string): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();

  // BUG FIX #4: column is 'teacher_id' not 'teacherId', 'file_url' not 'fileUrl'
  const { data: note } = await supabase
    .from('classroom_notes')
    .select('teacher_id, file_url')
    .eq('id', noteId)
    .single();

  if (!note) return { success: false, error: 'Note not found.' };
  if (note.teacher_id !== userId) return { success: false, error: 'Not authorized to delete this note.' };

  // Try to delete the file from storage too
  try {
    const url = new URL(note.file_url);
    const pathParts = url.pathname.split(`/storage/v1/object/public/${NOTES_BUCKET}/`);
    if (pathParts[1]) {
      await supabase.storage.from(NOTES_BUCKET).remove([decodeURIComponent(pathParts[1])]);
    }
  } catch {
    // Ignore storage deletion errors — note record will still be removed
  }

  const { error } = await supabase.from('classroom_notes').delete().eq('id', noteId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Note deleted.' };
}
