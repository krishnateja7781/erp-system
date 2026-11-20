'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, isUuid } from '@/lib/auth-guard';
import { canAccessClassroom, isClassroomOwner } from '@/lib/classroom-access';
import type { ActionResult } from '@/lib/types';

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

// Notes share the `submissions` storage bucket under the notes/ prefix.
const NOTES_BUCKET = 'submissions';

function rowToNote(row: any): ClassroomNote {
  return {
    id: row.id,
    classroomId: row.classroom_id,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    description: row.description || '',
    fileName: row.file_name,
    fileUrl: row.file_url,
    fileType: row.file_type || '',
    fileSize: Number(row.file_size) || 0,
    createdAt: row.created_at,
  };
}

/** Create the note record after the file was uploaded from the browser. Owner-only. */
export async function createNoteRecord(payload: {
  classroomId: string;
  teacherId?: string;
  teacherName?: string;
  description: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}): Promise<ActionResult & { note?: ClassroomNote }> {
  const auth = await authorize('teacher');
  if (!auth.ok) return { success: false, error: auth.error };
  const { classroomId, description, fileName, fileUrl, fileType, fileSize } = payload || ({} as any);
  if (!isUuid(classroomId) || !fileName || !fileUrl) return { success: false, error: 'Missing required fields.' };
  if (!(await isClassroomOwner(auth.caller, classroomId))) return { success: false, error: 'Only the classroom owner can upload notes.' };
  if (!fileUrl.includes(`/${NOTES_BUCKET}/notes/${classroomId}/`)) return { success: false, error: 'Invalid file location.' };

  const admin = await createServiceRoleClient();
  const { data, error } = await admin
    .from('classroom_notes')
    .insert({
      classroom_id: classroomId,
      teacher_id: auth.caller.userId,
      teacher_name: auth.caller.fullName,
      description: String(description || '').trim().slice(0, 2000),
      file_name: String(fileName).slice(0, 255),
      file_url: fileUrl,
      file_type: fileType || null,
      file_size: Number(fileSize) || 0,
    })
    .select()
    .single();
  if (error) return { success: false, error: `Failed to save note: ${error.message}` };
  return { success: true, message: 'Note uploaded successfully.', note: rowToNote(data) };
}

export async function listNotes(classroomId: string): Promise<ClassroomNote[]> {
  const caller = await requireRole();
  if (!isUuid(classroomId) || !(await canAccessClassroom(caller, classroomId))) return [];
  const admin = await createServiceRoleClient();
  const { data } = await admin
    .from('classroom_notes')
    .select('*')
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false })
    .limit(500);
  return (data || []).map(rowToNote);
}

export async function deleteNote(noteId: string, _userId?: string): Promise<ActionResult> {
  const auth = await authorize('teacher');
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(noteId)) return { success: false, error: 'Invalid note.' };
  const admin = await createServiceRoleClient();
  const { data: note } = await admin.from('classroom_notes').select('teacher_id, classroom_id, file_url').eq('id', noteId).maybeSingle();
  if (!note) return { success: false, error: 'Note not found.' };
  if (note.teacher_id !== auth.caller.userId && !(await isClassroomOwner(auth.caller, note.classroom_id))) {
    return { success: false, error: 'Not authorized to delete this note.' };
  }

  try {
    const marker = `/storage/v1/object/public/${NOTES_BUCKET}/`;
    const path = new URL(note.file_url).pathname.split(marker)[1];
    if (path) await admin.storage.from(NOTES_BUCKET).remove([decodeURIComponent(path)]);
  } catch {
    // Storage cleanup is best-effort; the DB record is still removed.
  }

  const { error } = await admin.from('classroom_notes').delete().eq('id', noteId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Note deleted.' };
}
