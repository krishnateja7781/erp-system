
'use server';

import { readCollection, writeCollection, findOneWhere, findWhere, insertDoc, updateDoc, deleteDoc, generateId, nowISO } from '@/lib/db';
import type { Classroom, ActionResult } from '@/lib/types';


interface CreateClassroomPayload { name: string; section?: string; subject?: string; ownerId: string; ownerName: string; }

function nanoidSimple(len = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < len; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

export async function createClassroom(payload: CreateClassroomPayload): Promise<ActionResult> {
    const { name, section, subject, ownerId, ownerName } = payload;
    if (!name || !ownerId || !ownerName) return { success: false, error: 'Missing required fields.' };
    try {
        const id = generateId();
        const inviteCode = nanoidSimple();
        const now = nowISO();
        await insertDoc('classrooms', { id, name, section: section || '', subject: subject || '', ownerId, ownerName, memberUids: [ownerId], theme: `theme-${Math.floor(Math.random() * 5)}`, inviteCode, messages: {}, createdAt: now, updatedAt: now });
        return { success: true, message: 'Classroom created successfully.', classroomId: id };
    } catch { return { success: false, error: 'Failed to create classroom.' }; }
}

interface JoinClassroomPayload { inviteCode: string; studentUid: string; }
export async function joinClassroom(payload: JoinClassroomPayload): Promise<ActionResult> {
    const { inviteCode, studentUid } = payload;
    if (!inviteCode || !studentUid) return { success: false, error: 'Invite code and student user ID are required.' };
    try {
        const classroom = await findOneWhere<any>('classrooms', (c) => c.inviteCode === inviteCode.trim());
        if (!classroom) return { success: false, error: 'Invalid invite code.' };
        if (classroom.memberUids?.includes(studentUid)) return { success: true, message: 'You are already a member of this classroom.', classroomId: classroom.id };
        await updateDoc('classrooms', classroom.id, { memberUids: [...(classroom.memberUids || []), studentUid] } as any);
        return { success: true, message: 'Successfully joined the classroom.', classroomId: classroom.id };
    } catch { return { success: false, error: 'Failed to join classroom due to a server error.' }; }
}

export async function getMyClassrooms(userId: string): Promise<Classroom[]> {
    if (!userId) return [];
    try {
        return (await findWhere<any>('classrooms', (c) => (c.memberUids || []).includes(userId)))
            .map((d: any) => ({ id: d.id, name: d.name, section: d.section, subject: d.subject, ownerId: d.ownerId, ownerName: d.ownerName, memberUids: d.memberUids, theme: d.theme, inviteCode: d.inviteCode, googleCourseId: d.googleCourseId || null, messages: d.messages || {}, createdAt: d.createdAt || new Date().toISOString() } as Classroom));
    } catch { return []; }
}

export async function deleteClassroom(classroomId: string, userId: string): Promise<ActionResult> {
    if (!classroomId || !userId) return { success: false, error: 'Classroom ID and User ID are required.' };
    try {
        const classroom = await findOneWhere<any>('classrooms', (c) => c.id === classroomId);
        if (!classroom) return { success: false, error: 'Classroom not found.' };
        if (classroom.ownerId !== userId) return { success: false, error: 'You are not authorized to delete this classroom.' };
        await deleteDoc('classrooms', classroomId);
        return { success: true, message: `Classroom "${classroom.name}" has been deleted.` };
    } catch { return { success: false, error: 'An unexpected error occurred while deleting the classroom.' }; }
}

export async function getClassroom(classroomId: string): Promise<Classroom | null> {
    try {
        const d = await findOneWhere<any>('classrooms', (c) => c.id === classroomId);
        if (!d) return null;
        return { id: d.id, name: d.name, section: d.section, subject: d.subject, ownerId: d.ownerId, ownerName: d.ownerName, memberUids: d.memberUids, theme: d.theme, inviteCode: d.inviteCode, googleCourseId: d.googleCourseId || null, messages: d.messages || {}, createdAt: d.createdAt || new Date().toISOString() } as Classroom;
    } catch { return null; }
}

// Link a Google Classroom course ID to an ERP classroom
export async function linkGoogleCourseId(classroomId: string, googleCourseId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const updated = await updateDoc('classrooms', classroomId, { googleCourseId } as any);
        if (!updated) return { success: false, error: 'Failed to update classroom record' };
        return { success: true };
    } catch {
        return { success: false, error: 'Server error while linking Google Course ID' };
    }
}

// Get member details (name, email, role) for a list of UIDs
export async function getClassroomMembers(memberUids: string[]): Promise<{ uid: string; name: string; email: string; role: string }[]> {
    if (!memberUids || memberUids.length === 0) return [];
    try {
        const users = await readCollection<any>('users');
        const students = await readCollection<any>('students');
        const teachers = await readCollection<any>('teachers');

        return memberUids.map(uid => {
            const user = users.find((u: any) => u.uid === uid || u.id === uid);
            const student = students.find((s: any) => s.uid === uid || s.id === uid);
            const teacher = teachers.find((t: any) => t.uid === uid || t.id === uid);

            const name = user?.name || student?.name || teacher?.name || 'Unknown';
            const email = user?.email || student?.email || teacher?.email || '';
            const role = teacher ? 'teacher' : student ? 'student' : user?.role || 'member';

            return { uid, name, email, role };
        });
    } catch {
        return memberUids.map(uid => ({ uid, name: 'Unknown', email: '', role: 'member' }));
    }
}
