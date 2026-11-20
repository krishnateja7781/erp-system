'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, requireStudentAccess, isUuid } from '@/lib/auth-guard';
import { fetchAllRows } from '@/lib/db';
import type { ActionResult } from '@/lib/types';

const FEE_STAFF = ['emp:fee_management'] as const;

export interface Transaction {
  /** Receipt number (RCP…) when available. */
  id: string;
  receiptNo?: string | null;
  transactionId?: string | null;
  amount: number;
  date: string;
  category: string;
  studyYear?: number;
  method?: string | null;
  status?: 'Success' | 'Failed' | 'Pending Confirmation';
}

export interface FeeRecord {
  studentName?: string;
  year?: string;
  collegeFees: { total: number; paid: number; balance: number };
  hostelFees: { total: number; paid: number; balance: number };
  transactions: Transaction[];
}

export async function getStudentsForFeeFiltering(filters: { program?: string; branch?: string; year?: string | number; section?: string }): Promise<any[]> {
  await requireRole(...FEE_STAFF);
  const admin = await createServiceRoleClient();
  const data = await fetchAllRows(() => {
    let q = admin.from('students').select('id, college_id, is_hosteler, status, profiles!inner(full_name)').order('college_id');
    if (filters?.program) q = q.eq('program', filters.program);
    if (filters?.branch) q = q.eq('branch', filters.branch);
    if (filters?.year) q = q.eq('current_year', parseInt(String(filters.year), 10));
    if (filters?.section && filters.section !== 'all') q = q.eq('section', filters.section);
    return q;
  });
  return data.map((s: any) => ({
    id: s.id,
    collegeId: s.college_id,
    name: s.profiles?.full_name,
    type: s.is_hosteler ? 'Hosteler' : 'Day Scholar',
    status: s.status,
  }));
}

/** Accepts either students.id or the student's profile id. */
export async function getStudentFeeDetails(studentId: string): Promise<{ success: boolean; data?: FeeRecord; error?: string }> {
  try {
    const { studentId: sid } = await requireStudentAccess(studentId, [...FEE_STAFF]);
    const admin = await createServiceRoleClient();
    const [{ data: fees, error }, { data: student }] = await Promise.all([
      admin
        .from('fees')
        .select('fee_type, total_amount, paid_amount, study_year, fee_payments(id, receipt_no, transaction_id, amount, payment_date, payment_method)')
        .eq('student_id', sid),
      admin.from('students').select('current_year, profiles(full_name)').eq('id', sid).maybeSingle(),
    ]);
    if (error) return { success: false, error: error.message };

    const college = { total: 0, paid: 0, balance: 0 };
    const hostel = { total: 0, paid: 0, balance: 0 };
    const transactions: Transaction[] = [];

    for (const f of (fees || []) as any[]) {
      const bucket = f.fee_type === 'hostel' ? hostel : college;
      bucket.total += Number(f.total_amount) || 0;
      bucket.paid += Number(f.paid_amount) || 0;
      for (const p of f.fee_payments || []) {
        transactions.push({
          id: p.receipt_no || p.transaction_id || p.id,
          receiptNo: p.receipt_no || null,
          transactionId: p.transaction_id || null,
          amount: Number(p.amount) || 0,
          date: p.payment_date,
          category: f.fee_type === 'hostel' ? 'Hostel' : 'College',
          studyYear: f.study_year,
          method: p.payment_method || null,
          status: 'Success',
        });
      }
    }
    college.balance = college.total - college.paid;
    hostel.balance = hostel.total - hostel.paid;
    transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return {
      success: true,
      data: {
        studentName: (student as any)?.profiles?.full_name || undefined,
        year: student?.current_year ? String(student.current_year) : undefined,
        collegeFees: college,
        hostelFees: hostel,
        transactions,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Records a payment atomically in the database (`record_fee_payment`):
 * the fee row is created/locked, the payment inserted and totals updated in a
 * single transaction — safe under thousands of concurrent payments, and a
 * repeated transaction id is rejected instead of double-counting.
 */
export async function recordAdminPayment(payload: {
  studentId: string;
  amount: number | string;
  /** Year of study (1..6); defaults to the student's current year. */
  year?: string | number;
  transactionId?: string;
  transactionDate?: string;
  category: 'College' | 'Hostel' | string;
  method?: string;
}): Promise<ActionResult> {
  const auth = await authorize(...FEE_STAFF, 'emp:hostel_management');
  if (!auth.ok) return { success: false, error: auth.error };

  const feeType = payload.category === 'Hostel' ? 'hostel' : 'college';
  if (feeType === 'college' && auth.caller.role === 'employee' && auth.caller.employeeType !== 'fee_management') {
    return { success: false, error: 'Only the fee department can record college fee payments.' };
  }
  const amount = Number(payload.amount);
  if (!isUuid(payload.studentId)) return { success: false, error: 'Invalid student.' };
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: 'Amount must be greater than zero.' };

  const admin = await createServiceRoleClient();
  const { data, error } = await admin.rpc('record_fee_payment', {
    p_student_id: payload.studentId,
    p_fee_type: feeType,
    p_study_year: Number(payload.year) || null,
    p_amount: amount,
    p_method: payload.method || 'Offline',
    p_transaction_id: payload.transactionId?.trim() || null,
    p_payment_date: payload.transactionDate || null,
    p_recorded_by: auth.caller.userId,
  });
  if (error) {
    if (error.code === '23505') return { success: false, error: 'This transaction ID has already been recorded.' };
    return { success: false, error: error.message };
  }
  return { success: true, message: 'Payment successfully recorded.', data };
}
