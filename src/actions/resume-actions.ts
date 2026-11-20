'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { requireStudentAccess } from '@/lib/auth-guard';
import { resumeSchema, type ResumeFormValues } from '@/lib/resume-schema';
import { calculateCGPA } from '@/lib/grading';
import type { ActionResult } from '@/lib/types';

export interface SavedResume {
  values: ResumeFormValues;
  templateId: string | null;
  showPhoto: boolean;
  savedAt: string | null;
}

/** The student's saved resume, or a draft prefilled from their real academic record. */
export async function getMyResume(): Promise<SavedResume> {
  const { studentId } = await requireStudentAccess(null);
  const admin = await createServiceRoleClient();

  const { data: saved } = await admin.from('resumes').select('*').eq('student_id', studentId).maybeSingle();
  if (saved?.data && Object.keys(saved.data).length > 0) {
    const parsed = resumeSchema.safeParse(saved.data);
    if (parsed.success) {
      return { values: parsed.data, templateId: saved.template_id, showPhoto: saved.show_photo, savedAt: saved.updated_at };
    }
  }

  const [{ data: s }, { data: marks }] = await Promise.all([
    admin
      .from('students')
      .select('program, branch, admitted_year, address, profiles(full_name, email, phone, profile_picture_url)')
      .eq('id', studentId)
      .single(),
    admin.from('marks').select('grade, classes(courses(credits))').eq('student_id', studentId),
  ]);
  const p: any = (s as any)?.profiles || {};
  const cgpa = calculateCGPA(((marks || []) as any[]).map((m) => ({ grade: m.grade, credits: m.classes?.courses?.credits ?? null })));
  const start = s?.admitted_year;

  return {
    values: {
      name: p.full_name || '',
      role: '',
      photoUrl: p.profile_picture_url || '',
      phone: p.phone || '',
      email: p.email || '',
      address: s?.address || '',
      linkedIn: '',
      github: '',
      objective: '',
      education: [{
        degree: [s?.program, s?.branch].filter(Boolean).join(' in ') || 'Degree',
        institution: process.env.NEXT_PUBLIC_INSTITUTION_NAME || 'Institution',
        year: start ? `${start} - Present` : '',
        cgpa: cgpa != null ? String(cgpa) : '',
      }],
      skills: [],
      projects: [],
      achievements: [],
    },
    templateId: null,
    showPhoto: true,
    savedAt: null,
  };
}

export async function saveMyResume(values: ResumeFormValues, templateId: string, showPhoto: boolean): Promise<ActionResult> {
  try {
    const { studentId } = await requireStudentAccess(null);
    const parsed = resumeSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Please fix the highlighted fields.' };
    if (JSON.stringify(parsed.data).length > 100_000) return { success: false, error: 'Resume is too long.' };

    const admin = await createServiceRoleClient();
    const { error } = await admin.from('resumes').upsert(
      { student_id: studentId, template_id: String(templateId || 'modern-sidebar').slice(0, 60), show_photo: !!showPhoto, data: parsed.data },
      { onConflict: 'student_id' },
    );
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Resume saved.' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
