'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, isUuid } from '@/lib/auth-guard';
import { canAccessClassroom, isClassroomOwner } from '@/lib/classroom-access';
import type { ActionResult } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────

export interface ClassroomPost {
  id: string;
  classroomId: string;
  authorId: string;
  authorName: string;
  authorRole: 'teacher' | 'student' | 'admin';
  content: string;
  createdAt: string;
}

export interface ClassroomAssignment {
  id: string;
  classroomId: string;
  teacherId: string;
  teacherName: string;
  title: string;
  description: string;
  dueDate: string | null;
  maxPoints: number;
  createdAt: string;
}

export interface ClassroomSubmission {
  id: string;
  assignmentId: string;
  classroomId: string;
  studentId: string;
  studentName: string;
  content: string;
  fileName: string | null;
  fileUrl: string | null;
  submittedAt: string;
  grade: number | null;
  gradedAt: string | null;
}

const POST_PAGE = 100;

function rowToPost(d: any): ClassroomPost {
  return {
    id: d.id,
    classroomId: d.classroom_id,
    authorId: d.author_id,
    authorName: d.author_name,
    authorRole: d.author_role || 'student',
    content: d.content,
    createdAt: d.created_at,
  };
}

function rowToAssignment(d: any): ClassroomAssignment {
  return {
    id: d.id,
    classroomId: d.classroom_id,
    teacherId: d.author_id || '',
    teacherName: d.author_name || '',
    title: d.title,
    description: d.description || '',
    dueDate: d.due_date || null,
    maxPoints: d.max_marks || 100,
    createdAt: d.created_at,
  };
}

function rowToSubmission(d: any): ClassroomSubmission {
  return {
    id: d.id,
    assignmentId: d.assignment_id,
    classroomId: d.classroom_id || '',
    studentId: d.student_id,
    studentName: d.student_name,
    content: d.content || '',
    fileName: d.file_name || null,
    fileUrl: d.file_url || null,
    submittedAt: d.submitted_at || d.created_at,
    grade: d.marks_obtained ?? null,
    gradedAt: d.graded_at || null,
  };
}

async function memberGuard(classroomId: string) {
  const auth = await authorize('teacher', 'student');
  if (!auth.ok) return auth;
  if (!isUuid(classroomId) || !(await canAccessClassroom(auth.caller, classroomId))) {
    return { ok: false as const, error: 'You are not a member of this classroom.' };
  }
  return auth;
}

// ─── Posts (Stream) ─────────────────────────────────────

/** Author identity comes from the session; client-supplied author fields are ignored. */
export async function createPost(
  classroomId: string, _authorId: string, _authorName: string, _authorRole: string, content: string,
): Promise<ActionResult> {
  const auth = await memberGuard(classroomId);
  if (!auth.ok) return { success: false, error: auth.error };
  const text = String(content || '').trim();
  if (!text) return { success: false, error: 'Post content cannot be empty.' };
  if (text.length > 5000) return { success: false, error: 'Posts are limited to 5000 characters.' };

  const admin = await createServiceRoleClient();
  const { data, error } = await admin
    .from('classroom_posts')
    .insert({
      classroom_id: classroomId,
      author_id: auth.caller.userId,
      author_name: auth.caller.fullName,
      author_role: auth.caller.role === 'teacher' ? 'teacher' : 'student',
      content: text,
    })
    .select()
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Post created.', data: rowToPost(data) };
}

/** Latest posts first, bounded page (older pages via `before`). */
export async function listPosts(classroomId: string, before?: string): Promise<ClassroomPost[]> {
  const caller = await requireRole();
  if (!isUuid(classroomId) || !(await canAccessClassroom(caller, classroomId))) return [];
  const admin = await createServiceRoleClient();
  let q = admin.from('classroom_posts').select('*').eq('classroom_id', classroomId).order('created_at', { ascending: false }).limit(POST_PAGE);
  if (before) q = q.lt('created_at', before);
  const { data } = await q;
  return (data || []).map(rowToPost);
}

/** Authors may delete their posts; the classroom owner may moderate any post. */
export async function deletePost(postId: string, _userId?: string): Promise<ActionResult> {
  const auth = await authorize('teacher', 'student');
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(postId)) return { success: false, error: 'Invalid post.' };
  const admin = await createServiceRoleClient();
  const { data: post } = await admin.from('classroom_posts').select('author_id, classroom_id').eq('id', postId).maybeSingle();
  if (!post) return { success: false, error: 'Post not found.' };
  if (post.author_id !== auth.caller.userId && !(await isClassroomOwner(auth.caller, post.classroom_id))) {
    return { success: false, error: 'Not authorized to delete this post.' };
  }
  const { error } = await admin.from('classroom_posts').delete().eq('id', postId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Post deleted.' };
}

// ─── Assignments (Classwork) ────────────────────────────

export async function createAssignment(
  classroomId: string, _teacherId: string, _teacherName: string, title: string, description: string, dueDate: string | null, maxPoints: number,
): Promise<ActionResult> {
  const auth = await authorize('teacher');
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(classroomId) || !(await isClassroomOwner(auth.caller, classroomId))) {
    return { success: false, error: 'Only the classroom owner can create assignments.' };
  }
  if (!String(title || '').trim()) return { success: false, error: 'Assignment title is required.' };
  const points = Number(maxPoints) || 100;
  if (points <= 0 || points > 1000) return { success: false, error: 'Max points must be between 1 and 1000.' };

  const admin = await createServiceRoleClient();
  const { error } = await admin.from('classroom_assignments').insert({
    classroom_id: classroomId,
    author_id: auth.caller.userId,
    author_name: auth.caller.fullName,
    title: title.trim().slice(0, 200),
    description: String(description || '').trim().slice(0, 10000),
    due_date: dueDate || null,
    max_marks: points,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Assignment created. Students have been notified.' };
}

export async function listAssignments(classroomId: string): Promise<ClassroomAssignment[]> {
  const caller = await requireRole();
  if (!isUuid(classroomId) || !(await canAccessClassroom(caller, classroomId))) return [];
  const admin = await createServiceRoleClient();
  const { data } = await admin
    .from('classroom_assignments')
    .select('*')
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false })
    .limit(500);
  return (data || []).map(rowToAssignment);
}

export async function deleteAssignment(assignmentId: string, _teacherId?: string): Promise<ActionResult> {
  const auth = await authorize('teacher');
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(assignmentId)) return { success: false, error: 'Invalid assignment.' };
  const admin = await createServiceRoleClient();
  const { data: a } = await admin.from('classroom_assignments').select('classroom_id').eq('id', assignmentId).maybeSingle();
  if (!a) return { success: false, error: 'Assignment not found.' };
  if (!(await isClassroomOwner(auth.caller, a.classroom_id))) return { success: false, error: 'Only the classroom owner can delete assignments.' };
  const { error } = await admin.from('classroom_assignments').delete().eq('id', assignmentId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Assignment deleted.' };
}

// ─── Submissions ────────────────────────────────────────

/** One submission per (assignment, student); re-submitting replaces it (upsert), file included. */
export async function submitAssignment(
  assignmentId: string, classroomId: string, _studentId: string, _studentName: string, content: string, fileName: string | null, fileUrl: string | null,
): Promise<ActionResult> {
  const auth = await memberGuard(classroomId);
  if (!auth.ok) return { success: false, error: auth.error };
  if (auth.caller.role !== 'student') return { success: false, error: 'Only students can submit assignments.' };
  if (!isUuid(assignmentId)) return { success: false, error: 'Invalid assignment.' };
  const text = String(content || '').trim();
  if (!fileUrl && !text) return { success: false, error: 'Please upload a file or enter an answer.' };
  if (fileUrl && !/^https:\/\//.test(fileUrl)) return { success: false, error: 'Invalid file URL.' };

  const admin = await createServiceRoleClient();
  const { data: a } = await admin.from('classroom_assignments').select('classroom_id').eq('id', assignmentId).maybeSingle();
  if (!a || a.classroom_id !== classroomId) return { success: false, error: 'Assignment not found in this classroom.' };

  const { error } = await admin.from('classroom_submissions').upsert(
    {
      assignment_id: assignmentId,
      classroom_id: classroomId,
      student_id: auth.caller.userId,
      student_name: auth.caller.fullName,
      content: text.slice(0, 20000),
      file_name: fileName || null,
      file_url: fileUrl || null,
      status: 'Submitted',
      submitted_at: new Date().toISOString(),
      marks_obtained: null,
      graded_at: null,
    },
    { onConflict: 'assignment_id,student_id' },
  );
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Assignment submitted.' };
}

export async function listSubmissions(assignmentId: string): Promise<ClassroomSubmission[]> {
  const caller = await requireRole('teacher');
  if (!isUuid(assignmentId)) return [];
  const admin = await createServiceRoleClient();
  const { data: a } = await admin.from('classroom_assignments').select('classroom_id').eq('id', assignmentId).maybeSingle();
  if (!a || !(await isClassroomOwner(caller, a.classroom_id))) return [];
  const { data } = await admin
    .from('classroom_submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false })
    .limit(10000);
  return (data || []).map(rowToSubmission);
}

export async function getMySubmission(assignmentId: string, _studentId?: string): Promise<ClassroomSubmission | null> {
  const caller = await requireRole('student');
  if (!isUuid(assignmentId)) return null;
  const admin = await createServiceRoleClient();
  const { data } = await admin
    .from('classroom_submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', caller.userId)
    .maybeSingle();
  return data ? rowToSubmission(data) : null;
}

export async function gradeSubmission(submissionId: string, grade: number): Promise<ActionResult> {
  const auth = await authorize('teacher');
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(submissionId)) return { success: false, error: 'Invalid submission.' };
  const admin = await createServiceRoleClient();
  const { data: sub } = await admin
    .from('classroom_submissions')
    .select('classroom_id, classroom_assignments(max_marks)')
    .eq('id', submissionId)
    .maybeSingle();
  if (!sub) return { success: false, error: 'Submission not found.' };
  if (!(await isClassroomOwner(auth.caller, sub.classroom_id))) return { success: false, error: 'Only the classroom owner can grade.' };
  const max = (sub as any).classroom_assignments?.max_marks ?? 100;
  const g = Number(grade);
  if (!Number.isFinite(g) || g < 0 || g > max) return { success: false, error: `Grade must be between 0 and ${max}.` };

  const { error } = await admin
    .from('classroom_submissions')
    .update({ marks_obtained: g, status: 'Graded', graded_at: new Date().toISOString() })
    .eq('id', submissionId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Grade saved.' };
}

/** All of the caller's submissions in a classroom, keyed by assignment (one query instead of one per assignment). */
export async function getMySubmissionsForClassroom(classroomId: string): Promise<Record<string, ClassroomSubmission>> {
  const caller = await requireRole('student');
  if (!isUuid(classroomId)) return {};
  const admin = await createServiceRoleClient();
  const { data } = await admin
    .from('classroom_submissions')
    .select('*')
    .eq('classroom_id', classroomId)
    .eq('student_id', caller.userId)
    .limit(1000);
  const out: Record<string, ClassroomSubmission> = {};
  for (const row of data || []) out[row.assignment_id] = rowToSubmission(row);
  return out;
}
