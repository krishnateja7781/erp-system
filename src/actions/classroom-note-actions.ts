'use server';

import { supabase } from '@/lib/supabase-client';
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

    const noteId = generateId();
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
      createdAt: new Date().toISOString(),
    };

    const { error: dbError } = await supabase.from('classroom_notes').insert(noteRecord);
    if (dbError) {
      return { success: false, error: `Failed to save note: ${dbError.message}` };
    }

    return { success: true, message: 'Note uploaded successfully.', note: noteRecord };
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred.' };
  }
}

// ─── List notes for a classroom ─────────────────────────

export async function listNotes(classroomId: string): Promise<ClassroomNote[]> {
  const { data, error } = await supabase
    .from('classroom_notes')
    .select('*')
    .eq('classroomId', classroomId)
    .order('createdAt', { ascending: false });

  if (error) return [];
  return data as ClassroomNote[];
}

// ─── Delete a note (only the teacher who posted it) ─────

export async function deleteNote(noteId: string, userId: string): Promise<ActionResult> {
  const { data: note } = await supabase
    .from('classroom_notes')
    .select('teacherId, fileUrl')
    .eq('id', noteId)
    .single();

  if (!note) return { success: false, error: 'Note not found.' };
  if (note.teacherId !== userId) return { success: false, error: 'Not authorized to delete this note.' };

  // Try to delete the file from storage too
  try {
    const url = new URL(note.fileUrl);
    const pathParts = url.pathname.split(`/storage/v1/object/public/${NOTES_BUCKET}/`);
    if (pathParts[1]) {
      await supabase.storage.from(NOTES_BUCKET).remove([decodeURIComponent(pathParts[1])]);
    }
  } catch {
    // Ignore storage deletion errors
  }

  const { error } = await supabase.from('classroom_notes').delete().eq('id', noteId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Note deleted.' };
}
