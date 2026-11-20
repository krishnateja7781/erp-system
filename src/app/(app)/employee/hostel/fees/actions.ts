'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, isUuid } from '@/lib/auth-guard';
import { fetchAllRows } from '@/lib/db';
import type { ActionResult } from '@/lib/types';

const HOSTEL_FEE_STAFF = ['emp:hostel_management', 'emp:fee_management'] as const;

export async function getHostelFees(): Promise<any[]> {
  await requireRole(...HOSTEL_FEE_STAFF);
  const admin = await createServiceRoleClient();

  const [hostelers, fees, { data: structures }] = await Promise.all([
    fetchAllRows(() =>
      admin
        .from('students')
        .select('id, college_id, program, current_year, profiles(full_name), hostel_allocations(status, hostel_rooms(room_number, hostels(name)))')
        .eq('is_hosteler', true)
        .eq('status', 'Active')
        .order('college_id'),
    ),
    fetchAllRows(() => admin.from('fees').select('id, student_id, study_year, total_amount, paid_amount, status').eq('fee_type', 'hostel')),
    admin.from('fee_structures').select('program, study_year, amount').eq('fee_type', 'hostel'),
  ]);

  // Fee row for the student's CURRENT year of study.
  const feeByStudentYear = new Map(fees.map((f: any) => [`${f.student_id}|${f.study_year}`, f]));
  const configured = (program: string, year: number) => {
    const rows = (structures || []) as any[];
    const pick =
      rows.find((r) => r.program === program && r.study_year === year) ||
      rows.find((r) => r.program === program && r.study_year == null) ||
      rows.find((r) => r.program == null && r.study_year === year) ||
      rows.find((r) => r.program == null && r.study_year == null);
    return pick ? Number(pick.amount) : 0;
  };

  return hostelers.map((s: any) => {
    const fee: any = feeByStudentYear.get(`${s.id}|${s.current_year}`);
    const active = (s.hostel_allocations || []).find((a: any) => a.status === 'Active');
    const total = fee ? Number(fee.total_amount) : configured(s.program, s.current_year);
    const paid = fee ? Number(fee.paid_amount) : 0;
    return {
      id: s.id,
      collegeId: s.college_id,
      name: s.profiles?.full_name || 'Unknown',
      hostelName: active?.hostel_rooms?.hostels?.name || null,
      roomNumber: active?.hostel_rooms?.room_number || null,
      total,
      paid,
      balance: total - paid,
      status: fee?.status || 'Pending',
      studyYear: s.current_year,
      academicTermId: null,
      feeId: fee?.id || null,
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
  const auth = await authorize(...HOSTEL_FEE_STAFF);
  if (!auth.ok) return { success: false, error: auth.error };
  const amount = Number(payload.amount);
  if (!isUuid(payload.studentId)) return { success: false, error: 'Invalid student.' };
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: 'Amount must be greater than zero.' };

  const admin = await createServiceRoleClient();
  const { error } = await admin.rpc('record_fee_payment', {
    p_student_id: payload.studentId,
    p_fee_type: 'hostel',
    p_study_year: null, // the student's current year of study
    p_amount: amount,
    p_method: payload.method || 'Cash',
    p_transaction_id: null,
    p_payment_date: null,
    p_recorded_by: auth.caller.userId,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Hostel payment recorded successfully.' };
}
