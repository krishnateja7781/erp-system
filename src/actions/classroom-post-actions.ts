'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
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

// ─── Helper mappers ──────────────────────────────────────

function rowToPost(d: any): ClassroomPost {
  return {
    id: d.id,
    classroomId: d.classroom_id,
    authorId: d.author_id,
    authorName: d.author_name,
    authorRole: d.author_role || 'teacher',
    content: d.content,
    createdAt: d.created_at,
  };
}

function rowToAssignment(d: any): ClassroomAssignment {
  return {
    id: d.id,
    classroomId: d.classroom_id,
    teacherId: d.author_id || d.teacher_id || '',
    teacherName: d.author_name || d.teacher_name || '',
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
    gradedAt: d.updated_at || null,
  };
}

// ─── Posts (Stream) ─────────────────────────────────────

export async function createPost(
  classroomId: string,
  authorId: string,
  authorName: string,
  authorRole: 'teacher' | 'student' | 'admin',
  content: string
): Promise<ActionResult> {
  if (!content.trim()) return { success: false, error: 'Post content cannot be empty.' };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('classroom_posts').insert({
    classroom_id: classroomId,
    author_id: authorId,
    author_name: authorName,
    author_role: authorRole,
    content: content.trim(),
  }).select().single();

  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Post created.', data: rowToPost(data) };
}

export async function listPosts(classroomId: string): Promise<ClassroomPost[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('classroom_posts')
    .select('*')
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map(rowToPost);
}

export async function deletePost(postId: string, userId: string): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: post } = await supabase
    .from('classroom_posts')
    .select('author_id')
    .eq('id', postId)
    .single();
  if (!post) return { success: false, error: 'Post not found.' };
  if (post.author_id !== userId) return { success: false, error: 'Not authorized to delete this post.' };

  const { error } = await supabase.from('classroom_posts').delete().eq('id', postId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Post deleted.' };
}

// ─── Assignments (Classwork) ────────────────────────────

export async function createAssignment(
  classroomId: string,
  teacherId: string,
  teacherName: string,
  title: string,
  description: string,
  dueDate: string | null,
  maxPoints: number
): Promise<ActionResult> {
  if (!title.trim()) return { success: false, error: 'Assignment title is required.' };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('classroom_assignments').insert({
    classroom_id: classroomId,
    title: title.trim(),
    description: description.trim(),
    due_date: dueDate || null,
    max_marks: maxPoints || 100,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Assignment created.' };
}

export async function listAssignments(classroomId: string): Promise<ClassroomAssignment[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('classroom_assignments')
    .select('*')
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map(rowToAssignment);
}

export async function deleteAssignment(assignmentId: string, _teacherId: string): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('classroom_assignments').delete().eq('id', assignmentId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Assignment deleted.' };
}

// ─── Submissions ────────────────────────────────────────

export async function submitAssignment(
  assignmentId: string,
  classroomId: string,
  studentId: string,
  studentName: string,
  content: string,
  fileName: string | null,
  fileUrl: string | null
): Promise<ActionResult> {
  if (!fileUrl && !content.trim()) return { success: false, error: 'Please upload a file or enter an answer.' };

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from('classroom_submissions')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('classroom_submissions')
      .update({ content: content.trim(), status: 'Submitted' })
      .eq('id', existing.id);
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Submission updated.' };
  }

  const { error } = await supabase.from('classroom_submissions').insert({
    assignment_id: assignmentId,
    student_id: studentId,
    student_name: studentName,
    content: content.trim(),
    status: 'Submitted',
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Assignment submitted.' };
}

export async function listSubmissions(assignmentId: string): Promise<ClassroomSubmission[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('classroom_submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });
  if (error) return [];
  return (data || []).map(rowToSubmission);
}

export async function getMySubmission(
  assignmentId: string,
  studentId: string
): Promise<ClassroomSubmission | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('classroom_submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToSubmission(data);
}

export async function gradeSubmission(
  submissionId: string,
  grade: number
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('classroom_submissions')
    .update({ marks_obtained: grade })
    .eq('id', submissionId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Grade saved.' };
}
