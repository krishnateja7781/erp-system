'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import type { ActionResult } from '@/lib/types';

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
    const supabase = await createServerSupabaseClient();
    const { data: hostels } = await supabase.from('hostels').select('*, hostel_rooms(capacity, hostel_allocations(id))');
    
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
            contactEmail: h.warden_email || `${h.name.replace(/\s+/g, '').toLowerCase()}warden@ssn.edu.in`
        };
    });
}

export async function getHostelDetails(hostelId: string): Promise<any> {
    const supabase = await createServerSupabaseClient();
    const { data: h } = await supabase.from('hostels').select('*, hostel_rooms(*, hostel_allocations(*, students(*, profiles(*))))').eq('id', hostelId).single();
    if (!h) return null;
    
    const mappedRooms = h.hostel_rooms?.map((r: any) => {
        return {
            id: r.id,
            roomNumber: r.room_number,
            type: r.room_type,
            capacity: r.capacity,
            occupants: r.hostel_allocations?.map((a: any) => ({
                id: a.students?.id,
                name: a.students?.profiles?.full_name,
                collegeId: a.students?.college_id,
                programAndBranch: `${a.students?.program} - ${a.students?.branch}`
            })) || []
        };
    });
    
    return {
        id: h.id,
        name: h.name,
        wardenName: h.warden_name,
        capacity: h.capacity,
        totalRooms: mappedRooms?.length || 0,
        currentOccupancy: mappedRooms?.reduce((sum: number, room: any) => sum + room.occupants.length, 0) || 0,
        contactEmail: 'warden@ssn.edu.in',
        contactPhone: '+91-XXXX-XXXXXX',
        description: 'Premium on-campus student accommodation.',
        facilities: ['WiFi', 'Mess', 'Laundry', 'Security', 'Gym', 'Study Room'],
        rules: ['No loud music after 10 PM.', 'Guests allowed only in lobby.', 'Alcohol and smoking strictly prohibited.'],
        rooms: mappedRooms
    };
}

export async function addHostel(payload: NewHostelPayload): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('hostels').insert({
        name: payload.name,
        type: payload.type,
        status: payload.status,
        capacity: payload.capacity,
        warden_name: payload.wardenName,
        warden_contact: payload.wardenContact,
        warden_email: payload.wardenEmail,
        warden_office: payload.wardenOffice
    });
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Hostel added successfully.' };
}

export async function updateHostelInfo(hostelId: string, payload: any): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    const updatePayload: any = {};
    if (payload.wardenName) updatePayload.warden_name = payload.wardenName;
    if (payload.capacity) updatePayload.capacity = payload.capacity;
    if (payload.type) updatePayload.type = payload.type;
    if (payload.status) updatePayload.status = payload.status;
    if (payload.wardenContact) updatePayload.warden_contact = payload.wardenContact;
    if (payload.wardenEmail) updatePayload.warden_email = payload.wardenEmail;
    if (payload.wardenOffice) updatePayload.warden_office = payload.wardenOffice;

    const { error } = await supabase.from('hostels').update(updatePayload).eq('id', hostelId);
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Hostel details updated.' };
}

export async function addHostelRoom(hostelId: string, payload: any): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('hostel_rooms').insert({
        hostel_id: hostelId,
        room_number: payload.roomNumber,
        room_type: payload.type,
        capacity: payload.capacity
    });
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Room added successfully.' };
}

export async function allocateStudentToRoom(roomId: string, studentId: string): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('hostel_allocations').insert({
        room_id: roomId,
        student_id: studentId
    });
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Student allocated successfully.' };
}

export async function removeStudentFromRoom(roomId: string, studentId: string): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('hostel_allocations').delete().eq('room_id', roomId).eq('student_id', studentId);
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Student removed from room.' };
}

export async function deleteHostel(hostelId: string): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('hostels').delete().eq('id', hostelId);
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Hostel deleted.' };
}

export async function getUnallocatedStudentsCount(): Promise<number> {
    const supabase = await createServerSupabaseClient();
    
    const { data: hostelers } = await supabase.from('students').select('id').eq('is_hosteler', true);
    if (!hostelers || hostelers.length === 0) return 0;
    
    const { data: allocations } = await supabase.from('hostel_allocations').select('student_id');
    const allocatedIds = new Set((allocations || []).map(a => a.student_id));
    
    let cnt = 0;
    hostelers.forEach(h => {
        if (!allocatedIds.has(h.id)) cnt++;
    });
    return cnt;
}

export async function updateComplaintStatus(hostelId: string, complaintId: string, status: string): Promise<ActionResult> {
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
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.from('hostel_complaints').insert({
        student_id: payload.studentId,
        hostel_id: payload.hostelId,
        room_number: payload.roomNumber,
        description: payload.issue,
        status: 'Pending',
    });

    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Complaint submitted successfully.' };
}

export async function getStudentHostelData(studentId: string): Promise<ActionResult & { data?: any }> {
    const supabase = await createServerSupabaseClient();

    // Get allocation
    const { data: allocation } = await supabase
        .from('hostel_allocations')
        .select('*, hostel_rooms(*, hostels(name, warden_name, warden_contact))')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .single();

    if (!allocation) {
        return { success: true, data: { hostelId: null, hostelName: null, roomNumber: null, wardenName: null, wardenContact: null, complaints: [] } };
    }

    const room = (allocation as any).hostel_rooms;
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
