'use server';

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase';
import { authorize } from '@/lib/auth-guard';
import { withinRateLimit } from '@/lib/rate-limit';
import type { ActionResult } from '@/lib/types';

/** Sends a password reset email via Supabase Auth (never reveals whether the email exists). */
export async function sendPasswordResetLink(email: string): Promise<ActionResult> {
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { success: false, error: 'A valid email is required.' };
  }
  // Per-network and per-address limits stop reset-email floods.
  if (!(await withinRateLimit('reset', 10, 3600)) || !(await withinRateLimit('reset-email', 3, 3600, email.trim().toLowerCase()))) {
    return { success: false, error: 'Too many reset requests. Please try again later.' };
  }
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?next=/update-password`,
    });
    if (error) console.error('[sendPasswordResetLink]', error.message);
    return { success: true, message: 'If an account exists for that email, a password reset link has been sent.' };
  } catch (error) {
    console.error('[sendPasswordResetLink] Unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

/** Updates the caller's own notification preference. The uid argument is ignored for safety. */
export async function updateNotificationPreferences(_uid: string, enabled: boolean): Promise<ActionResult> {
  const auth = await authorize();
  if (!auth.ok) return { success: false, error: auth.error };
  const supabase = await createServiceRoleClient();
  const { error } = await supabase
    .from('profiles')
    .update({ notification_enabled: !!enabled })
    .eq('id', auth.caller.userId);
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Notifications ${enabled ? 'enabled' : 'disabled'} successfully.` };
}

/** Returns the caller's own settings. */
export async function getUserSettings(_uid: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const auth = await authorize();
  if (!auth.ok) return { success: false, error: auth.error };
  const supabase = await createServiceRoleClient();
  const { data } = await supabase
    .from('profiles')
    .select('notification_enabled')
    .eq('id', auth.caller.userId)
    .maybeSingle();
  return { success: true, data: { notifications: { enabled: data?.notification_enabled ?? true } } };
}
