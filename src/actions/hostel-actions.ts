'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import type { ActionResult } from '@/lib/types';
import { revalidatePath } from 'next/cache';

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

export async function getHostels(): Promise<any[]> {
    const supabase = await createServiceRoleClient();
    const { data: hostels, error } = await supabase
        .from('hostels')
        .select('*, hostel_rooms(id, capacity, hostel_allocations(id))')
        .order('name');

    if (error) {
        console.error('[getHostels] error:', error.message);
        return [];
    }
    if (!hostels) return [];

    return hostels.map(h => {
        let currentOccupancy = 0;
        h.hostel_rooms?.forEach((r: any) => {
            currentOccupancy += r.hostel_allocations?.length || 0;
        });

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
            capacity: h.capacity || 0,
            occupied: currentOccupancy,
            currentOccupancy: currentOccupancy,
            facilities: ['WiFi', 'Mess', 'Laundry', 'Security'],
            contactEmail: h.warden_email || `${(h.name || 'hostel').replace(/\s+/g, '').toLowerCase()}warden@ssn.edu.in`
        };
    });
}

export async function getHostelDetails(hostelId: string): Promise<any> {
    const supabase = await createServiceRoleClient();
    const { data: h, error } = await supabase
        .from('hostels')
        .select('*, hostel_rooms(*, hostel_allocations(*, students(id, college_id, program, branch, profiles(full_name))))')
        .eq('id', hostelId)
        .single();

    if (error) {
        console.error('[getHostelDetails] error:', error.message);
        return null;
    }
    if (!h) return null;

    const mappedRooms = h.hostel_rooms?.map((r: any) => {
        return {
            id: r.id,
            roomNumber: r.room_number,
            type: r.room_type,
            capacity: r.capacity,
            residents: r.hostel_allocations?.map((a: any) => ({
                studentId: a.students?.id,
                studentName: a.students?.profiles?.full_name || 'Unknown',
                collegeId: a.students?.college_id || '',
            })) || [],
            // Keep occupants alias for any legacy use
            occupants: r.hostel_allocations?.map((a: any) => ({
                id: a.students?.id,
                name: a.students?.profiles?.full_name,
                collegeId: a.students?.college_id,
                programAndBranch: `${a.students?.program || ''} - ${a.students?.branch || ''}`
            })) || []
        };
    }) || [];

    // Fetch complaints for this hostel
    const { data: complaintsData } = await supabase
        .from('hostel_complaints')
        .select('id, student_id, description, status, created_at, hostel_rooms(room_number)')
        .eq('hostel_id', hostelId)
        .order('created_at', { ascending: false });

    const complaints = (complaintsData || []).map((c: any) => ({
        id: c.id,
        studentId: c.student_id,
        roomNumber: c.hostel_rooms?.room_number || 'N/A',
        issue: c.description,
        status: c.status,
        date: c.created_at?.split('T')[0] || '',
    }));

    return {
        id: h.id,
        name: h.name,
        type: h.type || 'Boys',
        status: h.status || 'Operational',
        wardenName: h.warden_name,
        warden: {
            name: h.warden_name || '',
            contact: h.warden_contact || '',
            email: h.warden_email || '',
            office: h.warden_office || '',
        },
        wardenContact: h.warden_contact,
        wardenEmail: h.warden_email,
        wardenOffice: h.warden_office,
        capacity: h.capacity || 0,
        occupied: mappedRooms.reduce((sum: number, room: any) => sum + room.residents.length, 0),
        totalRooms: mappedRooms.length,
        currentOccupancy: mappedRooms.reduce((sum: number, room: any) => sum + room.residents.length, 0),
        contactEmail: h.warden_email || 'warden@ssn.edu.in',
        contactPhone: h.warden_contact || '+91-XXXX-XXXXXX',
        description: 'Premium on-campus student accommodation.',
        amenities: ['WiFi', 'Mess', 'Laundry', 'Security', 'Gym', 'Study Room'],
        facilities: ['WiFi', 'Mess', 'Laundry', 'Security', 'Gym', 'Study Room'],
        rulesHighlight: ['No loud music after 10 PM.', 'Guests allowed only in lobby.', 'Alcohol and smoking strictly prohibited.'],
        rules: ['No loud music after 10 PM.', 'Guests allowed only in lobby.', 'Alcohol and smoking strictly prohibited.'],
        rooms: mappedRooms,
        complaints,
    };
}

export async function addHostel(payload: NewHostelPayload): Promise<ActionResult> {
    if (!payload.name || payload.name.trim() === '') {
        return { success: false, error: 'Hostel name is strictly required.' };
    }
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase.from('hostels').insert({
        name: payload.name,
        type: payload.type,
        status: payload.status || 'Operational',
        capacity: payload.capacity || 0,
        warden_name: payload.wardenName,
        warden_contact: payload.wardenContact,
        warden_email: payload.wardenEmail,
        warden_office: payload.wardenOffice
    }).select('id').single();

    if (error) {
        console.error('[addHostel] error:', error.message);
        return { success: false, error: error.message };
    }
    revalidatePath('/admin/hostels');
    return { success: true, message: 'Hostel added successfully.' };
}

export async function updateHostelInfo(hostelId: string, payload: any): Promise<ActionResult> {
    const supabase = await createServiceRoleClient();
    const updatePayload: any = {};
    if (payload.name !== undefined) updatePayload.name = payload.name;
    if (payload.wardenName !== undefined) updatePayload.warden_name = payload.wardenName;
    if (payload.capacity !== undefined) updatePayload.capacity = payload.capacity;
    if (payload.type !== undefined) updatePayload.type = payload.type;
    if (payload.status !== undefined) updatePayload.status = payload.status;
    if (payload.wardenContact !== undefined) updatePayload.warden_contact = payload.wardenContact;
    if (payload.wardenEmail !== undefined) updatePayload.warden_email = payload.wardenEmail;
    if (payload.wardenOffice !== undefined) updatePayload.warden_office = payload.wardenOffice;
    // Support nested warden object from EditHostelDialog
    if (payload.warden) {
        if (payload.warden.name !== undefined) updatePayload.warden_name = payload.warden.name;
        if (payload.warden.contact !== undefined) updatePayload.warden_contact = payload.warden.contact;
        if (payload.warden.email !== undefined) updatePayload.warden_email = payload.warden.email;
        if (payload.warden.office !== undefined) updatePayload.warden_office = payload.warden.office;
    }

    const { error } = await supabase.from('hostels').update(updatePayload).eq('id', hostelId);
    if (error) {
        console.error('[updateHostelInfo] error:', error.message);
        return { success: false, error: error.message };
    }
    revalidatePath('/admin/hostels');
    revalidatePath(`/admin/hostels/${hostelId}`);
    return { success: true, message: 'Hostel details updated.' };
}

export async function addHostelRoom(hostelId: string, payload: any): Promise<ActionResult> {
    if (!hostelId) {
        return { success: false, error: 'A valid Hostel ID is required.' };
    }
    if (!payload.capacity || parseInt(payload.capacity) <= 0) {
        return { success: false, error: 'Capacity must be greater than 0.' };
    }
    const supabase = await createServiceRoleClient();
    const { error } = await supabase.from('hostel_rooms').insert({
        hostel_id: hostelId,
        room_number: payload.roomNumber,
        block: payload.roomNumber?.split('-')[0] || 'Main',
        floor: parseInt(payload.roomNumber?.replace(/\D/g, '').substring(0, 1)) || 1,
        capacity: payload.capacity
    });
    if (error) {
        console.error('[addHostelRoom] error:', error.message);
        return { success: false, error: error.message };
    }
    revalidatePath('/admin/hostels');
    revalidatePath(`/admin/hostels/${hostelId}`);
    return { success: true, message: 'Room added successfully.' };
}

export async function deleteHostelRoom(roomId: string): Promise<ActionResult> {
    const supabase = await createServiceRoleClient();
    // First remove all allocations for this room
    await supabase.from('hostel_allocations').delete().eq('room_id', roomId);
    const { error } = await supabase.from('hostel_rooms').delete().eq('id', roomId);
    if (error) {
        console.error('[deleteHostelRoom] error:', error.message);
        return { success: false, error: error.message };
    }
    revalidatePath('/admin/hostels');
    return { success: true, message: 'Room deleted successfully.' };
}

export async function allocateStudentToRoom(roomId: string, studentId: string): Promise<ActionResult> {
    if (!roomId) return { success: false, error: 'Room ID is required for allocation.' };
    if (!studentId) return { success: false, error: 'Student ID is required for allocation.' };
    const supabase = await createServiceRoleClient();
    // Check if student already has an active allocation
    const { data: existing } = await supabase
        .from('hostel_allocations')
        .select('id')
        .eq('student_id', studentId)
        .limit(1);

    if (existing && existing.length > 0) {
        return { success: false, error: 'Student is already allocated to a room. Remove them first.' };
    }

    // Check room capacity
    const { data: roomData, error: roomError } = await supabase
        .from('hostel_rooms')
        .select(`capacity, hostel_allocations(id)`)
        .eq('id', roomId)
        .single();
        
    if (roomError || !roomData) {
        return { success: false, error: 'Failed to verify room capacity.' };
    }
    
    if (roomData.hostel_allocations.length >= roomData.capacity) {
        return { success: false, error: 'This room is already operating at maximum capacity.' };
    }

    const { error } = await supabase.from('hostel_allocations').insert({
        room_id: roomId,
        student_id: studentId,
        status: 'Active',
        from_date: new Date().toISOString().split('T')[0]
    });
    if (error) {
        console.error('[allocateStudentToRoom] error:', error.message);
        return { success: false, error: error.message };
    }
    revalidatePath('/admin/hostels');
    return { success: true, message: 'Student allocated successfully.' };
}

export async function removeStudentFromRoom(roomId: string, studentId: string): Promise<ActionResult> {
    const supabase = await createServiceRoleClient();
    const { error } = await supabase
        .from('hostel_allocations')
        .delete()
        .eq('room_id', roomId)
        .eq('student_id', studentId);
    if (error) {
        console.error('[removeStudentFromRoom] error:', error.message);
        return { success: false, error: error.message };
    }
    revalidatePath('/admin/hostels');
    return { success: true, message: 'Student removed from room.' };
}

export async function deleteHostel(hostelId: string): Promise<ActionResult> {
    const supabase = await createServiceRoleClient();
    const { error } = await supabase.from('hostels').delete().eq('id', hostelId);
    if (error) {
        console.error('[deleteHostel] error:', error.message);
        return { success: false, error: error.message };
    }
    revalidatePath('/admin/hostels');
    return { success: true, message: 'Hostel deleted.' };
}

export async function getUnallocatedStudentsCount(): Promise<number> {
    const supabase = await createServiceRoleClient();

    const { data: hostelers } = await supabase.from('students').select('id').eq('is_hosteler', true);
    if (!hostelers || hostelers.length === 0) return 0;

    const { data: allocations } = await supabase.from('hostel_allocations').select('student_id');
    const allocatedIds = new Set((allocations || []).map(a => a.student_id));

    return hostelers.filter(h => !allocatedIds.has(h.id)).length;
}

export async function updateComplaintStatus(hostelId: string, complaintId: string, status: string): Promise<ActionResult> {
    const supabase = await createServiceRoleClient();
    const { error } = await supabase
        .from('hostel_complaints')
        .update({ status })
        .eq('id', complaintId);
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Complaint status updated.' };
}

// ── Student-facing hostel functions ───────────────────────────────────────────

export async function logComplaint(payload: {
    studentId: string;
    studentName: string;
    hostelId: string;
    roomNumber: string;
    issue: string;
}): Promise<ActionResult> {
    if (!payload.studentId) return { success: false, error: 'Student ID is heavily required to log a complaint.' };
    if (!payload.hostelId || !payload.roomNumber) return { success: false, error: 'Hostel and Room information must be provided.' };
    
    const supabase = await createServiceRoleClient();

    // Find the room id from room_number + hostel_id
    const { data: roomData } = await supabase
        .from('hostel_rooms')
        .select('id')
        .eq('hostel_id', payload.hostelId)
        .eq('room_number', payload.roomNumber)
        .single();

    const { error } = await supabase.from('hostel_complaints').insert({
        student_id: payload.studentId,
        hostel_id: payload.hostelId,
        hostel_room_id: roomData?.id || null,
        description: payload.issue,
        status: 'Pending',
    });

    if (error) {
        console.error('[logComplaint] error:', error.message);
        return { success: false, error: error.message };
    }
    return { success: true, message: 'Complaint submitted successfully.' };
}

export async function getStudentHostelData(studentId: string): Promise<ActionResult & { data?: any }> {
    const supabase = await createServiceRoleClient();

    // Get latest allocation (no is_active column - use status='Active' or just latest)
    const { data: allocation } = await supabase
        .from('hostel_allocations')
        .select('*, hostel_rooms(id, room_number, hostels(id, name, warden_name, warden_contact))')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const room = (allocation as any)?.hostel_rooms;
    const hostel = room?.hostels;

    // Get complaints
    const { data: complaintsData } = await supabase
        .from('hostel_complaints')
        .select('id, description, status, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

    const complaints = (complaintsData || []).map((c: any) => ({
        id: c.id,
        issue: c.description,
        status: c.status,
        date: c.created_at?.split('T')[0] || '',
    }));

    return {
        success: true,
        data: {
            hostelId: hostel?.id || null,
            hostelName: hostel?.name || null,
            roomNumber: room?.room_number || null,
            wardenName: hostel?.warden_name || null,
            wardenContact: hostel?.warden_contact || null,
            complaints,
        }
    };
}

export async function getHostelMenu(hostelId: string): Promise<any[]> {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
        .from('hostel_menu')
        .select('*')
        .eq('hostel_id', hostelId)
        .order('id');

    if (error) {
        console.error('[getHostelMenu] error:', error.message);
        return [];
    }
    return data || [];
}

export async function updateHostelMenu(hostelId: string, dayOfWeek: string, payload: any): Promise<ActionResult> {
    const supabase = await createServiceRoleClient();

    // Upsert so it works even if the row doesn't exist yet
    const { error } = await supabase
        .from('hostel_menu')
        .upsert({
            hostel_id: hostelId,
            day_of_week: dayOfWeek,
            morning_slot: payload.morning_slot || null,
            afternoon_slot: payload.afternoon_slot || null,
            evening_slot: payload.evening_slot || null,
            dinner_slot: payload.dinner_slot || null,
        }, { onConflict: 'hostel_id,day_of_week' });

    if (error) {
        console.error('[updateHostelMenu] error:', error.message);
        return { success: false, error: error.message };
    }
    return { success: true, message: 'Menu updated successfully.' };
}

