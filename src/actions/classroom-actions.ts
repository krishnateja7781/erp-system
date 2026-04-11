
'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import type { Classroom, ActionResult } from '@/lib/types';

function nanoidSimple(len = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < len; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

/** Map a Supabase snake_case row → camelCase Classroom */
function rowToClassroom(d: any): Classroom {
    return {
        id: d.id,
        name: d.name,
        section: d.section || '',
        subject: d.subject || '',
        ownerId: d.owner_id,
        ownerName: d.owner_name,
        memberUids: d.member_uids || [],
        theme: d.theme || 'theme-0',
        inviteCode: d.invite_code,
        googleCourseId: d.google_course_id || null,
        messages: d.messages || {},
        createdAt: d.created_at || new Date().toISOString(),
    } as Classroom;
}

interface CreateClassroomPayload { name: string; section?: string; subject?: string; ownerId: string; ownerName: string; }

export async function createClassroom(payload: CreateClassroomPayload): Promise<ActionResult> {
    const { name, section, subject, ownerId, ownerName } = payload;
    if (!name || !ownerId || !ownerName) return { success: false, error: 'Missing required fields.' };
    try {
        const supabase = await createServerSupabaseClient();
        const inviteCode = nanoidSimple();
        const { data, error } = await supabase.from('classrooms').insert({
            name,
            section: section || '',
            subject: subject || '',
            owner_id: ownerId,
            owner_name: ownerName,
            member_uids: [ownerId],
            theme: `theme-${Math.floor(Math.random() * 5)}`,
            invite_code: inviteCode,
            messages: {},
        }).select('id').single();

        if (error) throw error;
        return { success: true, message: 'Classroom created successfully.', classroomId: data.id };
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to create classroom.' };
    }
}

interface JoinClassroomPayload { inviteCode: string; studentUid: string; }
export async function joinClassroom(payload: JoinClassroomPayload): Promise<ActionResult> {
    const { inviteCode, studentUid } = payload;
    if (!inviteCode || !studentUid) return { success: false, error: 'Invite code and student user ID are required.' };
    try {
        const supabase = await createServerSupabaseClient();
        const { data: classroom, error } = await supabase
            .from('classrooms')
            .select('*')
            .eq('invite_code', inviteCode.trim())
            .single();

        if (error || !classroom) return { success: false, error: 'Invalid invite code.' };
        const memberUids: string[] = classroom.member_uids || [];
        if (memberUids.includes(studentUid)) return { success: true, message: 'You are already a member of this classroom.', classroomId: classroom.id };

        const { error: updateError } = await supabase
            .from('classrooms')
            .update({ member_uids: [...memberUids, studentUid] })
            .eq('id', classroom.id);

        if (updateError) throw updateError;
        return { success: true, message: 'Successfully joined the classroom.', classroomId: classroom.id };
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to join classroom due to a server error.' };
    }
}

export async function getMyClassrooms(userId: string): Promise<Classroom[]> {
    if (!userId) return [];
    try {
        const supabase = await createServerSupabaseClient();
        const { data, error } = await supabase
            .from('classrooms')
            .select('*')
            .contains('member_uids', [userId])
            .order('created_at', { ascending: false });

        if (error || !data) return [];
        return data.map(rowToClassroom);
    } catch { return []; }
}

export async function deleteClassroom(classroomId: string, userId: string): Promise<ActionResult> {
    if (!classroomId || !userId) return { success: false, error: 'Classroom ID and User ID are required.' };
    try {
        const supabase = await createServerSupabaseClient();
        const { data: classroom, error } = await supabase
            .from('classrooms')
            .select('owner_id, name')
            .eq('id', classroomId)
            .single();

        if (error || !classroom) return { success: false, error: 'Classroom not found.' };
        if (classroom.owner_id !== userId) return { success: false, error: 'You are not authorized to delete this classroom.' };

        const { error: delError } = await supabase.from('classrooms').delete().eq('id', classroomId);
        if (delError) throw delError;
        return { success: true, message: `Classroom "${classroom.name}" has been deleted.` };
    } catch (e: any) {
        return { success: false, error: e.message || 'An unexpected error occurred while deleting the classroom.' };
    }
}

export async function getClassroom(classroomId: string): Promise<Classroom | null> {
    try {
        const supabase = await createServerSupabaseClient();
        const { data, error } = await supabase
            .from('classrooms')
            .select('*')
            .eq('id', classroomId)
            .single();

        if (error || !data) return null;
        return rowToClassroom(data);
    } catch { return null; }
}

export async function linkGoogleCourseId(classroomId: string, googleCourseId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createServerSupabaseClient();
        const { error } = await supabase
            .from('classrooms')
            .update({ google_course_id: googleCourseId })
            .eq('id', classroomId);

        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch {
        return { success: false, error: 'Server error while linking Google Course ID' };
    }
}

export async function getClassroomMembers(memberUids: string[]): Promise<{ uid: string; name: string; email: string; role: string }[]> {
    if (!memberUids || memberUids.length === 0) return [];
    try {
        const supabase = await createServerSupabaseClient();

        // Fetch from profiles table (primary source)
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .in('id', memberUids);

        // Fetch from teachers table for name fallback
        const { data: teachers } = await supabase
            .from('teachers')
            .select('profile_id, name')
            .in('profile_id', memberUids);

        // Fetch from students table for name fallback
        const { data: students } = await supabase
            .from('students')
            .select('profile_id, name')
            .in('profile_id', memberUids);

        return memberUids.map(uid => {
            const profile = profiles?.find(p => p.id === uid);
            const teacher = teachers?.find(t => t.profile_id === uid);
            const student = students?.find(s => s.profile_id === uid);

            const name = profile?.full_name || teacher?.name || student?.name || 'Unknown';
            const role = profile?.role || (teacher ? 'teacher' : student ? 'student' : 'member');

            return { uid, name, email: '', role };
        });
    } catch {
        return memberUids.map(uid => ({ uid, name: 'Unknown', email: '', role: 'member' }));
    }
}
