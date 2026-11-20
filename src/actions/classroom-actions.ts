'use server';

import { randomInt } from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, isUuid } from '@/lib/auth-guard';
import { canAccessClassroom } from '@/lib/classroom-access';
import { chunk } from '@/lib/db';
import type { Classroom, ActionResult } from '@/lib/types';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I

function inviteCode(len = 7): string {
  let out = '';
  for (let i = 0; i < len; i++) out += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return out;
}

function rowToClassroom(d: any, memberUids: string[] = []): Classroom {
  return {
    id: d.id,
    name: d.name,
    section: d.section || '',
    subject: d.subject || '',
    ownerId: d.owner_id,
    ownerName: d.owner_name,
    memberUids,
    inviteCode: d.invite_code,
    createdAt: d.created_at,
    ...(d.theme ? { theme: d.theme } : {}),
    memberCount: typeof d.member_count === 'number' ? d.member_count : memberUids.length,
  } as Classroom;
}

interface CreateClassroomPayload { name: string; section?: string; subject?: string; ownerId?: string; ownerName?: string }

export async function createClassroom(payload: CreateClassroomPayload): Promise<ActionResult> {
  const auth = await authorize('teacher');
  if (!auth.ok) return { success: false, error: auth.error };
  const name = String(payload?.name || '').trim();
  if (!name) return { success: false, error: 'Classroom name is required.' };

  const admin = await createServiceRoleClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin
      .from('classrooms')
      .insert({
        name: name.slice(0, 120),
        section: (payload.section || '').slice(0, 60),
        subject: (payload.subject || '').slice(0, 120),
        owner_id: auth.caller.userId,
        owner_name: auth.caller.fullName,
        theme: `theme-${randomInt(5)}`,
        invite_code: inviteCode(),
      })
      .select('id')
      .single();
    if (!error) {
      // The owner membership row is added by the `classrooms_add_owner` trigger.
      return { success: true, message: 'Classroom created successfully.', classroomId: data.id };
    }
    if (error.code !== '23505') return { success: false, error: error.message };
  }
  return { success: false, error: 'Could not generate a unique invite code. Please retry.' };
}

/** Idempotent, race-free join: a primary key on (classroom_id, user_id) absorbs duplicate clicks. */
export async function joinClassroom(payload: { inviteCode: string; studentUid?: string }): Promise<ActionResult> {
  const auth = await authorize('student');
  if (!auth.ok) return { success: false, error: auth.error };
  const code = String(payload?.inviteCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return { success: false, error: 'Invalid invite code.' };

  const admin = await createServiceRoleClient();
  const { data, error } = await admin.rpc('join_classroom', { p_invite_code: code, p_user_id: auth.caller.userId });
  if (error) return { success: false, error: error.message };
  if (!data?.success) return { success: false, error: data?.error || 'Invalid invite code.' };
  return {
    success: true,
    message: data.already_member ? 'You are already a member of this classroom.' : 'Successfully joined the classroom.',
    classroomId: data.classroom_id,
  };
}

export async function getMyClassrooms(_userId?: string): Promise<Classroom[]> {
  const caller = await requireRole('teacher', 'student');
  const admin = await createServiceRoleClient();
  const { data } = await admin
    .from('classroom_members')
    .select('classrooms(id, name, section, subject, owner_id, owner_name, invite_code, theme, created_at, member_count)')
    .eq('user_id', caller.userId)
    .limit(500);

  return ((data || []) as any[])
    .map((r) => r.classrooms)
    .filter(Boolean)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((c) => {
      const room = rowToClassroom(c, []);
      // Students never see the invite code of rooms they don't own.
      if (c.owner_id !== caller.userId) room.inviteCode = undefined;
      return room;
    });
}

export async function deleteClassroom(classroomId: string, _userId?: string): Promise<ActionResult> {
  const auth = await authorize('teacher');
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(classroomId)) return { success: false, error: 'Invalid classroom.' };
  const admin = await createServiceRoleClient();
  const { data: room } = await admin.from('classrooms').select('owner_id, name').eq('id', classroomId).maybeSingle();
  if (!room) return { success: false, error: 'Classroom not found.' };
  if (room.owner_id !== auth.caller.userId && auth.caller.role !== 'super_admin') {
    return { success: false, error: 'You are not authorized to delete this classroom.' };
  }
  const { error } = await admin.from('classrooms').delete().eq('id', classroomId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Classroom "${room.name}" has been deleted.` };
}

export async function getClassroom(classroomId: string): Promise<Classroom | null> {
  const caller = await requireRole();
  if (!isUuid(classroomId) || !(await canAccessClassroom(caller, classroomId))) return null;
  const admin = await createServiceRoleClient();
  const [{ data }, { data: members }] = await Promise.all([
    admin.from('classrooms').select('*').eq('id', classroomId).maybeSingle(),
    admin.from('classroom_members').select('user_id').eq('classroom_id', classroomId).order('joined_at').limit(10000),
  ]);
  if (!data) return null;
  const room = rowToClassroom(data, (members || []).map((m: any) => m.user_id));
  if (data.owner_id !== caller.userId && caller.role === 'student') room.inviteCode = undefined;
  return room;
}

export async function getClassroomMembers(memberUids: string[]): Promise<{ uid: string; name: string; email: string; role: string }[]> {
  await requireRole();
  const ids = (memberUids || []).filter(isUuid);
  if (ids.length === 0) return [];
  const admin = await createServiceRoleClient();
  const profiles: any[] = [];
  for (const part of chunk(ids, 300)) {
    const { data } = await admin.from('profiles').select('id, full_name, role').in('id', part);
    profiles.push(...(data || []));
  }
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return ids.map((uid) => ({
    uid,
    name: byId.get(uid)?.full_name || 'Unknown',
    email: '',
    role: byId.get(uid)?.role || 'member',
  }));
}
