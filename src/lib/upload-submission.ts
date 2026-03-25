import { supabase } from '@/lib/supabase-client';

const BUCKET = 'submissions';

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

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Only PDF, Word, Excel, PowerPoint, text, and image files are allowed.';
  }
  if (file.size > MAX_SIZE) {
    return 'File size must be under 10 MB.';
  }
  return null;
}

/**
 * Upload a file to Supabase Storage and return the public URL.
 * Path: submissions/{classroomId}/{assignmentId}/{studentId}/{timestamp}_{filename}
 */
export async function uploadSubmissionFile(
  file: File,
  classroomId: string,
  assignmentId: string,
  studentId: string
): Promise<{ fileName: string; fileUrl: string }> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${classroomId}/${assignmentId}/${studentId}/${timestamp}_${safeName}`;

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
  };
}
