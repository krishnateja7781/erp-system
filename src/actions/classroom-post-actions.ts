'use server';

import { supabase } from '@/lib/supabase-client';
import { generateId } from '@/lib/db';
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

// ─── Posts (Stream) ─────────────────────────────────────

export async function createPost(
  classroomId: string,
  authorId: string,
  authorName: string,
  authorRole: 'teacher' | 'student' | 'admin',
  content: string
): Promise<ActionResult> {
  if (!content.trim()) return { success: false, error: 'Post content cannot be empty.' };

  const newId = generateId();
  const { data, error } = await supabase.from('classroom_posts').insert({
    id: newId,
    classroomId,
    authorId,
    authorName,
    authorRole,
    content: content.trim(),
  }).select().single();
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Post created.', data };
}

export async function listPosts(classroomId: string): Promise<ClassroomPost[]> {
  const { data, error } = await supabase
    .from('classroom_posts')
    .select('*')
    .eq('classroomId', classroomId)
    .order('createdAt', { ascending: false });
  if (error) return [];
  return data as ClassroomPost[];
}

export async function deletePost(postId: string, userId: string): Promise<ActionResult> {
  // Only author can delete their own post
  const { data: post } = await supabase
    .from('classroom_posts')
    .select('authorId')
    .eq('id', postId)
    .single();
  if (!post) return { success: false, error: 'Post not found.' };
  if (post.authorId !== userId) return { success: false, error: 'Not authorized to delete this post.' };

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

  const { error } = await supabase.from('classroom_assignments').insert({
    id: generateId(),
    classroomId,
    teacherId,
    teacherName,
    title: title.trim(),
    description: description.trim(),
    dueDate: dueDate || null,
    maxPoints: maxPoints || 100,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Assignment created.' };
}

export async function listAssignments(classroomId: string): Promise<ClassroomAssignment[]> {
  const { data, error } = await supabase
    .from('classroom_assignments')
    .select('*')
    .eq('classroomId', classroomId)
    .order('createdAt', { ascending: false });
  if (error) return [];
  return data as ClassroomAssignment[];
}

export async function deleteAssignment(assignmentId: string, teacherId: string): Promise<ActionResult> {
  const { data: assignment } = await supabase
    .from('classroom_assignments')
    .select('teacherId')
    .eq('id', assignmentId)
    .single();
  if (!assignment) return { success: false, error: 'Assignment not found.' };
  if (assignment.teacherId !== teacherId) return { success: false, error: 'Not authorized.' };

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

  // Check if already submitted
  const { data: existing } = await supabase
    .from('classroom_submissions')
    .select('id')
    .eq('assignmentId', assignmentId)
    .eq('studentId', studentId)
    .maybeSingle();

  if (existing) {
    // Update existing submission
    const { error } = await supabase
      .from('classroom_submissions')
      .update({ content: content.trim(), fileName, fileUrl, submittedAt: new Date().toISOString(), grade: null, gradedAt: null })
      .eq('id', existing.id);
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Submission updated.' };
  }

  const { error } = await supabase.from('classroom_submissions').insert({
    id: generateId(),
    assignmentId,
    classroomId,
    studentId,
    studentName,
    content: content.trim(),
    fileName,
    fileUrl,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Assignment submitted.' };
}

export async function listSubmissions(assignmentId: string): Promise<ClassroomSubmission[]> {
  const { data, error } = await supabase
    .from('classroom_submissions')
    .select('*')
    .eq('assignmentId', assignmentId)
    .order('submittedAt', { ascending: false });
  if (error) return [];
  return data as ClassroomSubmission[];
}

export async function getMySubmission(
  assignmentId: string,
  studentId: string
): Promise<ClassroomSubmission | null> {
  const { data, error } = await supabase
    .from('classroom_submissions')
    .select('*')
    .eq('assignmentId', assignmentId)
    .eq('studentId', studentId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ClassroomSubmission;
}

export async function gradeSubmission(
  submissionId: string,
  grade: number
): Promise<ActionResult> {
  const { error } = await supabase
    .from('classroom_submissions')
    .update({ grade, gradedAt: new Date().toISOString() })
    .eq('id', submissionId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Grade saved.' };
}
