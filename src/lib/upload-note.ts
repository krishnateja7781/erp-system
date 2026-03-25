import { supabase } from '@/lib/supabase-client';

const BUCKET = 'submissions';
const PREFIX = 'notes';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/png',
  'image/jpeg',
];

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

export function validateNoteFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Only PDF, Word, Excel, PowerPoint, text, and image files are allowed.';
  }
  if (file.size > MAX_SIZE) {
    return 'File size must be under 25 MB.';
  }
  return null;
}

/**
 * Upload a note file to Supabase Storage (client-side, runs in browser).
 * Path: submissions/notes/{classroomId}/{timestamp}_{filename}
 */
export async function uploadNoteFile(
  file: File,
  classroomId: string
): Promise<{ fileName: string; fileUrl: string; fileType: string; fileSize: number }> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${PREFIX}/${classroomId}/${timestamp}_${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return {
    fileName: file.name,
    fileUrl: urlData.publicUrl,
    fileType: file.type,
    fileSize: file.size,
  };
}
