'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import type { ActionResult } from '@/lib/types';

export async function getHostelFees(): Promise<any[]> {
    const supabase = await createServiceRoleClient();

    // Get all hosteler students with their allocations
    const { data: hostelers, error } = await supabase
        .from('students')
        .select(`
            id,
            college_id,
            profiles(full_name),
            hostel_allocations(
                id,
                status,
                hostel_rooms(room_number, hostels(name))
            )
        `)
        .eq('is_hosteler', true);

    if (error) {
        console.error('[getHostelFees] students error:', error.message);
        return [];
    }
    if (!hostelers) return [];

    // Get current academic term
    const { data: term } = await supabase
        .from('academic_terms')
        .select('id')
        .eq('is_current', true)
        .limit(1)
        .maybeSingle();

    const termId = term?.id || null;

    // Get hostel fee records
    const studentIds = hostelers.map(h => h.id);
    const { data: feeRecords } = studentIds.length > 0
        ? await supabase.from('fees').select('*').eq('fee_type', 'hostel').in('student_id', studentIds)
        : { data: [] };

    return hostelers.map((student: any) => {
        const fees = feeRecords?.find((f: any) => f.student_id === student.id);
        const name = (student.profiles as any)?.full_name || 'Unknown';

        let hostelName = null;
        let roomNumber = null;

        // Find most recent allocation
        const latestAlloc = student.hostel_allocations?.[student.hostel_allocations.length - 1];
        if (latestAlloc) {
            roomNumber = latestAlloc.hostel_rooms?.room_number || null;
            hostelName = latestAlloc.hostel_rooms?.hostels?.name || null;
        }

        const total = fees ? Number(fees.total_amount) : 50000;
        const paid = fees ? Number(fees.paid_amount) : 0;

        return {
            id: student.id,
            collegeId: student.college_id,
            name,
            hostelName,
            roomNumber,
            total,
            paid,
            balance: total - paid,
            status: fees?.status || 'Pending',
            academicTermId: termId,
            feeId: fees?.id || null,
        };
    });
}

export async function processHostelPayment(payload: {
    studentId: string;
    amount: number;
    method: string;
    academicTermId: string | null;
    feeId: string | null;
}): Promise<ActionResult> {
    const supabase = await createServiceRoleClient();
    let { studentId, amount, method, academicTermId, feeId } = payload;

    // Resolve academic term if missing
    if (!academicTermId) {
        const { data: term } = await supabase
            .from('academic_terms')
            .select('id')
            .order('start_date', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!term) return { success: false, error: 'No academic term configured. Please set up an academic term first.' };
        academicTermId = term.id;
    }

    try {
        if (!feeId) {
            // Create new hostel fee record
            const totalDue = 50000;
            const { data: newFee, error: createError } = await supabase
                .from('fees')
                .insert({
                    student_id: studentId,
                    academic_term_id: academicTermId,
                    fee_type: 'hostel',
                    total_amount: totalDue,
                    paid_amount: amount,
                    status: amount >= totalDue ? 'Paid' : 'Partial',
                })
                .select('id')
                .single();

            if (createError) throw new Error(createError.message);
            feeId = newFee.id;
        } else {
            const { data: feeData, error: fetchErr } = await supabase
                .from('fees')
                .select('paid_amount, total_amount')
                .eq('id', feeId)
                .single();
            if (fetchErr || !feeData) throw new Error('Fee record not found.');

            const newPaid = Number(feeData.paid_amount) + amount;
            const newStatus = newPaid >= Number(feeData.total_amount) ? 'Paid' : 'Partial';

            const { error: updateErr } = await supabase
                .from('fees')
                .update({ paid_amount: newPaid, status: newStatus })
                .eq('id', feeId);
            if (updateErr) throw new Error(updateErr.message);
        }

        // Record fee payment transaction
        const { error: paymentError } = await supabase.from('fee_payments').insert({
            fee_id: feeId,
            amount_paid: amount,
            payment_method: method,
            payment_date: new Date().toISOString().split('T')[0],
            transaction_id: `HOS-TXN-${Date.now()}`,
        });

        if (paymentError) {
            console.error('[processHostelPayment] payment log error:', paymentError.message);
            // Don't fail—the fee was already updated above
        }

        return { success: true, message: 'Hostel payment recorded successfully.' };
    } catch (error: any) {
        console.error('[processHostelPayment] error:', error.message);
        return { success: false, error: error.message };
    }
}
