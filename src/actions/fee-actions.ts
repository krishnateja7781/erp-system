'use server';

import { createServiceRoleClient as createServerSupabaseClient } from '@/lib/supabase';
import type { ActionResult } from '@/lib/types';

export interface FeeRecord {
    studentName?: string;
    year?: string;
    collegeFees: { total: number; paid: number; balance: number; };
    hostelFees: { total: number; paid: number; balance: number; };
    transactions: Transaction[];
}

export async function getStudentsForFeeFiltering(filters: any): Promise<any[]> {
    const supabase = await createServerSupabaseClient();
    
    let query = supabase.from('students').select('id, college_id, is_hosteler, profiles!inner(full_name)');
    
    if (filters.program) query = query.eq('program', filters.program);
    if (filters.branch) query = query.eq('branch', filters.branch);
    if (filters.year) query = query.eq('current_year', parseInt(filters.year));

    const { data } = await query;
    if (!data) return [];
    
    return data.map((s: any) => ({
        id: s.id,
        collegeId: s.college_id,
        name: s.profiles?.full_name,
        type: s.is_hosteler ? 'Hosteler' : 'Day Scholar'
    }));
}

export async function getStudentFeeDetails(studentId: string): Promise<{ success: boolean; data?: FeeRecord; error?: string }> {
    const supabase = await createServerSupabaseClient();
    
    const { data: fees } = await supabase.from('fees').select('*, fee_payments(*)').eq('student_id', studentId);
    
    let collegeTotal = 0, collegePaid = 0;
    let hostelTotal = 0, hostelPaid = 0;
    const transactions: any[] = [];

    fees?.forEach((f: any) => {
        const type = f.fee_type;
        if (type === 'college') {
            collegeTotal += Number(f.total_amount);
            collegePaid += Number(f.paid_amount);
        } else if (type === 'hostel') {
            hostelTotal += Number(f.total_amount);
            hostelPaid += Number(f.paid_amount);
        }
        
        f.fee_payments?.forEach((p: any) => {
            transactions.push({
                id: p.transaction_id || p.id,
                amount: Number(p.amount),
                date: p.payment_date,
                category: type === 'college' ? 'College' : 'Hostel',
                status: 'Success'
            });
        });
    });

    if (collegeTotal === 0) collegeTotal = 150000;
    if (hostelTotal === 0) hostelTotal = 50000;

    return {
        success: true,
        data: {
            collegeFees: { total: collegeTotal, paid: collegePaid, balance: collegeTotal - collegePaid },
            hostelFees: { total: hostelTotal, paid: hostelPaid, balance: hostelTotal - hostelPaid },
            transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }
    };
}

export async function recordAdminPayment(payload: any): Promise<ActionResult> {
    const supabase = await createServerSupabaseClient();
    const { studentId, amount, year, transactionId, transactionDate, category } = payload;
    
    const feeType = category === 'College' ? 'college' : 'hostel';
    const totalDueDefault = category === 'College' ? 150000 : 50000;
    
    let { data: feeRecords } = await supabase.from('fees')
        .select('*')
        .eq('student_id', studentId)
        .eq('academic_year', year.toString())
        .eq('fee_type', feeType)
        .limit(1);
        
    let feeId;
    if (!feeRecords || feeRecords.length === 0) {
        const { data: newFee, error: createError } = await supabase.from('fees').insert({
            student_id: studentId,
            academic_year: year.toString(),
            fee_type: feeType,
            total_amount: totalDueDefault,
            paid_amount: amount,
            status: amount >= totalDueDefault ? 'paid' : 'partial'
        }).select('id').single();
        
        if (createError) return { success: false, error: createError.message };
        feeId = newFee.id;
    } else {
        feeId = feeRecords[0].id;
        const newPaid = Number(feeRecords[0].paid_amount) + amount;
        const newStatus = newPaid >= Number(feeRecords[0].total_amount) ? 'paid' : 'partial';
        
        await supabase.from('fees').update({
            paid_amount: newPaid,
            status: newStatus
        }).eq('id', feeId);
    }
    
    const { error: paymentError } = await supabase.from('fee_payments').insert({
        fee_id: feeId,
        amount: amount,
        payment_date: transactionDate,
        transaction_id: transactionId || `TXN${Date.now()}`
    });
    
    if (paymentError) return { success: false, error: 'Payment recorded in fees but transaction log failed: ' + paymentError.message };

    return { success: true, message: 'Payment successfully recorded.' };
}

export interface Transaction {
    id: string;
    amount: number;
    date: string;
    category: string;
    status?: 'Success' | 'Failed' | 'Pending Confirmation';
}

