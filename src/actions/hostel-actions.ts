'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, requireStudentAccess, isUuid } from '@/lib/auth-guard';
import type { ActionResult } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const HOSTEL_STAFF = ['emp:hostel_management'] as const;
const COMPLAINT_STATUSES = ['Pending', 'In Progress', 'Resolved'] as const;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_FACILITIES = ['WiFi', 'Mess', 'Laundry', 'Security'];
const DEFAULT_RULES = ['No loud music after 10 PM.', 'Guests allowed only in lobby.', 'Alcohol and smoking strictly prohibited.'];

export interface NewHostelPayload {
  name: string;
  type?: string;
  status?: string;
  wardenName: string;
  wardenContact?: string;
  wardenEmail?: string;
  wardenOffice?: string;
  capacity: number;
}

function revalidateHostels(hostelId?: string) {
  revalidatePath('/admin/hostels');
  revalidatePath('/employee/hostel');
  if (hostelId) {
    revalidatePath(`/admin/hostels/${hostelId}`);
    revalidatePath(`/employee/hostel/${hostelId}`);
  }
}

export async function getHostels(): Promise<any[]> {
  await requireRole(...HOSTEL_STAFF);
  const admin = await createServiceRoleClient();
  const { data: hostels, error } = await admin
    .from('hostels')
    .select('*, hostel_rooms(id, capacity, occupied)')
    .order('name');
  if (error || !hostels) return [];

  return hostels.map((h: any) => {
    const occupied = (h.hostel_rooms || []).reduce((sum: number, r: any) => sum + (r.occupied || 0), 0);
    const bedCapacity = (h.hostel_rooms || []).reduce((sum: number, r: any) => sum + (r.capacity || 0), 0);
    return {
      id: h.id,
      name: h.name,
      type: h.type,
      status: h.status || 'Operational',
      wardenName: h.warden_name,
      warden: h.warden_name,
      wardenContact: h.warden_contact,
      wardenEmail: h.warden_email,
      wardenOffice: h.warden_office,
      totalRooms: h.hostel_rooms?.length || 0,
      capacity: h.capacity || bedCapacity,
      occupied,
      currentOccupancy: occupied,
      facilities: h.facilities?.length ? h.facilities : DEFAULT_FACILITIES,
      contactEmail: h.warden_email || null,
    };
  });
}

export async function getHostelDetails(hostelId: string): Promise<any> {
  await requireRole(...HOSTEL_STAFF);
  if (!isUuid(hostelId)) return null;
  const admin = await createServiceRoleClient();

  const [{ data: h }, { data: complaintsData }] = await Promise.all([
    admin
      .from('hostels')
      .select('*, hostel_rooms(id, room_number, room_type, capacity, occupied, hostel_allocations(status, students(id, college_id, program, branch, profiles(full_name))))')
      .eq('id', hostelId)
      .maybeSingle(),
    admin
      .from('hostel_complaints')
      .select('id, student_id, description, status, created_at, hostel_rooms(room_number), students(college_id)')
      .eq('hostel_id', hostelId)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  if (!h) return null;

  const rooms = ((h as any).hostel_rooms || [])
    .sort((a: any, b: any) => String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true }))
    .map((r: any) => {
      const active = (r.hostel_allocations || []).filter((a: any) => a.status === 'Active' && a.students);
      return {
        id: r.id,
        roomNumber: r.room_number,
        type: r.room_type,
        capacity: r.capacity,
        residents: active.map((a: any) => ({
          studentId: a.students.id,
          studentName: a.students.profiles?.full_name || 'Unknown',
          collegeId: a.students.college_id || '',
        })),
        occupants: active.map((a: any) => ({
          id: a.students.id,
          name: a.students.profiles?.full_name,
          collegeId: a.students.college_id,
          programAndBranch: `${a.students.program || ''} - ${a.students.branch || ''}`,
        })),
      };
    });

  const occupied = rooms.reduce((sum: number, r: any) => sum + r.residents.length, 0);

  return {
    id: h.id,
    name: h.name,
    type: h.type || 'Boys',
    status: h.status || 'Operational',
    wardenName: h.warden_name,
    warden: { name: h.warden_name || '', contact: h.warden_contact || '', email: h.warden_email || '', office: h.warden_office || '' },
    wardenContact: h.warden_contact,
    wardenEmail: h.warden_email,
    wardenOffice: h.warden_office,
    capacity: h.capacity || 0,
    occupied,
    currentOccupancy: occupied,
    totalRooms: rooms.length,
    contactEmail: h.warden_email || '',
    contactPhone: h.warden_contact || '',
    description: h.description || 'On-campus student accommodation.',
    amenities: h.facilities?.length ? h.facilities : DEFAULT_FACILITIES,
    facilities: h.facilities?.length ? h.facilities : DEFAULT_FACILITIES,
    rulesHighlight: h.rules?.length ? h.rules : DEFAULT_RULES,
    rules: h.rules?.length ? h.rules : DEFAULT_RULES,
    rooms,
    complaints: ((complaintsData || []) as any[]).map((c) => ({
      id: c.id,
      studentId: c.student_id,
      collegeId: c.students?.college_id || '',
      roomNumber: c.hostel_rooms?.room_number || 'N/A',
      issue: c.description,
      status: c.status,
      date: c.created_at?.split('T')[0] || '',
    })),
  };
}

export async function addHostel(payload: NewHostelPayload): Promise<ActionResult> {
  const auth = await authorize(...HOSTEL_STAFF);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!payload?.name?.trim()) return { success: false, error: 'Hostel name is required.' };

  const admin = await createServiceRoleClient();
  const { error } = await admin.from('hostels').insert({
    name: payload.name.trim(),
    type: payload.type || null,
    status: payload.status || 'Operational',
    capacity: Number(payload.capacity) || 0,
    warden_name: payload.wardenName || null,
    warden_contact: payload.wardenContact || null,
    warden_email: payload.wardenEmail || null,
    warden_office: payload.wardenOffice || null,
  });
  if (error) return { success: false, error: error.code === '23505' ? 'A hostel with this name already exists.' : error.message };
  revalidateHostels();
  return { success: true, message: 'Hostel added successfully.' };
}

export async function updateHostelInfo(hostelId: string, payload: any): Promise<ActionResult> {
  const auth = await authorize(...HOSTEL_STAFF);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(hostelId)) return { success: false, error: 'Invalid hostel.' };

  const patch: Record<string, unknown> = {};
  const map: Record<string, string> = {
    name: 'name', wardenName: 'warden_name', capacity: 'capacity', type: 'type', status: 'status',
    wardenContact: 'warden_contact', wardenEmail: 'warden_email', wardenOffice: 'warden_office',
  };
  for (const [k, col] of Object.entries(map)) if (payload?.[k] !== undefined) patch[col] = payload[k];
  if (payload?.warden) {
    if (payload.warden.name !== undefined) patch.warden_name = payload.warden.name;
    if (payload.warden.contact !== undefined) patch.warden_contact = payload.warden.contact;
    if (payload.warden.email !== undefined) patch.warden_email = payload.warden.email;
    if (payload.warden.office !== undefined) patch.warden_office = payload.warden.office;
  }
  if (Object.keys(patch).length === 0) return { success: true, message: 'Nothing to update.' };

  const admin = await createServiceRoleClient();
  const { error } = await admin.from('hostels').update(patch).eq('id', hostelId);
  if (error) return { success: false, error: error.message };
  revalidateHostels(hostelId);
  return { success: true, message: 'Hostel details updated.' };
}

export async function addHostelRoom(hostelId: string, payload: any): Promise<ActionResult> {
  const auth = await authorize(...HOSTEL_STAFF);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(hostelId)) return { success: false, error: 'A valid Hostel ID is required.' };
  const capacity = parseInt(payload?.capacity, 10);
  if (!capacity || capacity <= 0) return { success: false, error: 'Capacity must be greater than 0.' };
  const roomNumber = String(payload?.roomNumber || '').trim();
  if (!roomNumber) return { success: false, error: 'Room number is required.' };

  const admin = await createServiceRoleClient();
  const { error } = await admin.from('hostel_rooms').insert({
    hostel_id: hostelId,
    room_number: roomNumber,
    room_type: payload.type || null,
    block: roomNumber.includes('-') ? roomNumber.split('-')[0] : 'Main',
    floor: parseInt(roomNumber.replace(/\D/g, '').substring(0, 1), 10) || 1,
    capacity,
  });
  if (error) return { success: false, error: error.code === '23505' ? `Room ${roomNumber} already exists in this hostel.` : error.message };
  revalidateHostels(hostelId);
  return { success: true, message: 'Room added successfully.' };
}

export async function deleteHostelRoom(roomId: string): Promise<ActionResult> {
  const auth = await authorize(...HOSTEL_STAFF);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(roomId)) return { success: false, error: 'Invalid room.' };
  const admin = await createServiceRoleClient();
  const { count } = await admin.from('hostel_allocations').select('id', { count: 'exact', head: true }).eq('room_id', roomId).eq('status', 'Active');
  if ((count || 0) > 0) return { success: false, error: 'Vacate all residents before deleting this room.' };
  const { error } = await admin.from('hostel_rooms').delete().eq('id', roomId);
  if (error) return { success: false, error: error.message };
  revalidateHostels();
  return { success: true, message: 'Room deleted successfully.' };
}

/** Capacity- and duplicate-safe allocation under concurrency (row-locked in `allocate_hostel_room`). */
export async function allocateStudentToRoom(roomId: string, studentId: string): Promise<ActionResult> {
  const auth = await authorize(...HOSTEL_STAFF);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(roomId) || !isUuid(studentId)) return { success: false, error: 'Room and student are required.' };
  const admin = await createServiceRoleClient();
  const { data, error } = await admin.rpc('allocate_hostel_room', { p_room_id: roomId, p_student_id: studentId, p_allocated_by: auth.caller.userId });
  if (error) return { success: false, error: error.message };
  if (data && data.success === false) return { success: false, error: data.error };
  revalidateHostels();
  return { success: true, message: 'Student allocated successfully.' };
}

export async function removeStudentFromRoom(roomId: string, studentId: string): Promise<ActionResult> {
  const auth = await authorize(...HOSTEL_STAFF);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(roomId) || !isUuid(studentId)) return { success: false, error: 'Room and student are required.' };
  const admin = await createServiceRoleClient();
  // Vacate rather than delete, so residence history is kept.
  const { error } = await admin
    .from('hostel_allocations')
    .update({ status: 'Vacated', to_date: new Date().toISOString().slice(0, 10) })
    .eq('room_id', roomId)
    .eq('student_id', studentId)
    .eq('status', 'Active');
  if (error) return { success: false, error: error.message };
  revalidateHostels();
  return { success: true, message: 'Student removed from room.' };
}

export async function deleteHostel(hostelId: string): Promise<ActionResult> {
  const auth = await authorize(...HOSTEL_STAFF);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(hostelId)) return { success: false, error: 'Invalid hostel.' };
  const admin = await createServiceRoleClient();
  const { error } = await admin.from('hostels').delete().eq('id', hostelId);
  if (error) return { success: false, error: error.message };
  revalidateHostels();
  return { success: true, message: 'Hostel deleted.' };
}

/** Students who can be allocated a bed in this hostel (computed in SQL, never the whole student body). */
export async function getAllocatableStudents(hostelId: string): Promise<{ id: string; name: string; collegeId: string; program: string | null; branch: string | null; year: number | null; gender: string | null }[]> {
  await requireRole(...HOSTEL_STAFF);
  if (!isUuid(hostelId)) return [];
  const admin = await createServiceRoleClient();
  const { data, error } = await admin.rpc('get_allocatable_students', { p_hostel_id: hostelId });
  if (error) throw new Error(error.message);
  return ((data as any[]) || []).map((r) => ({
    id: r.id,
    name: r.full_name || 'Unknown',
    collegeId: r.college_id,
    program: r.program,
    branch: r.branch,
    year: r.current_year,
    gender: r.gender,
  }));
}

export async function getUnallocatedStudentsCount(): Promise<number> {
  await requireRole(...HOSTEL_STAFF);
  const admin = await createServiceRoleClient();
  const { data } = await admin.rpc('get_unallocated_hosteler_count');
  return Number(data) || 0;
}

export async function updateComplaintStatus(_hostelId: string, complaintId: string, status: string): Promise<ActionResult> {
  const auth = await authorize(...HOSTEL_STAFF);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(complaintId)) return { success: false, error: 'Invalid complaint.' };
  if (!(COMPLAINT_STATUSES as readonly string[]).includes(status)) return { success: false, error: 'Invalid status.' };
  const admin = await createServiceRoleClient();
  const { error } = await admin.from('hostel_complaints').update({ status }).eq('id', complaintId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Complaint status updated.' };
}

// ── Student-facing ───────────────────────────────────────────────────────────

export async function logComplaint(payload: { studentId: string; studentName: string; hostelId: string; roomNumber: string; issue: string }): Promise<ActionResult> {
  try {
    const { studentId } = await requireStudentAccess(payload?.studentId);
    const issue = String(payload?.issue || '').trim();
    if (issue.length < 5) return { success: false, error: 'Please describe the issue (at least 5 characters).' };

    const admin = await createServiceRoleClient();
    // The complaint is always filed against the student's own active room.
    const { data: alloc } = await admin
      .from('hostel_allocations')
      .select('room_id, hostel_rooms(hostel_id)')
      .eq('student_id', studentId)
      .eq('status', 'Active')
      .maybeSingle();
    if (!alloc) return { success: false, error: 'You do not have an active hostel room.' };

    const { error } = await admin.from('hostel_complaints').insert({
      student_id: studentId,
      hostel_id: (alloc as any).hostel_rooms?.hostel_id,
      hostel_room_id: alloc.room_id,
      description: issue.slice(0, 2000),
      status: 'Pending',
    });
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Complaint submitted successfully.' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getStudentHostelData(studentId: string): Promise<ActionResult & { data?: any }> {
  try {
    const { studentId: sid } = await requireStudentAccess(studentId, [...HOSTEL_STAFF]);
    const admin = await createServiceRoleClient();
    const [{ data: allocation }, { data: complaintsData }] = await Promise.all([
      admin
        .from('hostel_allocations')
        .select('hostel_rooms(id, room_number, hostels(id, name, warden_name, warden_contact))')
        .eq('student_id', sid)
        .eq('status', 'Active')
        .maybeSingle(),
      admin.from('hostel_complaints').select('id, description, status, created_at').eq('student_id', sid).order('created_at', { ascending: false }).limit(100),
    ]);

    const room = (allocation as any)?.hostel_rooms;
    const hostel = room?.hostels;
    return {
      success: true,
      data: {
        hostelId: hostel?.id || null,
        hostelName: hostel?.name || null,
        roomNumber: room?.room_number || null,
        wardenName: hostel?.warden_name || null,
        wardenContact: hostel?.warden_contact || null,
        complaints: ((complaintsData || []) as any[]).map((c) => ({
          id: c.id,
          issue: c.description,
          status: c.status,
          date: c.created_at?.split('T')[0] || '',
        })),
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getHostelMenu(hostelId: string): Promise<any[]> {
  await requireRole();
  if (!isUuid(hostelId)) return [];
  const admin = await createServiceRoleClient();
  const { data } = await admin.from('hostel_menu').select('*').eq('hostel_id', hostelId);
  return (data || []).sort((a: any, b: any) => DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week));
}

export async function updateHostelMenu(hostelId: string, dayOfWeek: string, payload: any): Promise<ActionResult> {
  const auth = await authorize(...HOSTEL_STAFF);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(hostelId) || !DAYS.includes(dayOfWeek)) return { success: false, error: 'Invalid hostel or day.' };
  const admin = await createServiceRoleClient();
  const { error } = await admin.from('hostel_menu').upsert(
    {
      hostel_id: hostelId,
      day_of_week: dayOfWeek,
      morning_slot: payload?.morning_slot || null,
      afternoon_slot: payload?.afternoon_slot || null,
      evening_slot: payload?.evening_slot || null,
      dinner_slot: payload?.dinner_slot || null,
    },
    { onConflict: 'hostel_id,day_of_week' },
  );
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Menu updated successfully.' };
}
