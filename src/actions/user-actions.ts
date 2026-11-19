'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import type { ActionResult } from '@/lib/types';

/**
 * Sends a password reset email via Supabase Auth.
 * Replaces the legacy no-op stub that instructed users to "contact admin".
 */
export async function sendPasswordResetLink(email: string): Promise<ActionResult> {
    if (!email) {
        return { success: false, error: 'Email is required.' };
    }
    try {
        const supabase = await createServerSupabaseClient();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || ''}/login?type=recovery`,
        });
        if (error) {
            // Don't leak whether the email exists — just say "if account exists, email was sent"
            console.error('[sendPasswordResetLink] Supabase error:', error.message);
        }
        // Always return success to prevent email enumeration
        return { success: true, message: 'If an account exists for that email, a password reset link has been sent.' };
    } catch (error: any) {
        console.error('[sendPasswordResetLink] Unexpected error:', error);
        return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
}

/**
 * Updates notification preferences stored in the user's profile metadata.
 * Replaces the legacy write to local JSON users array.
 */
export async function updateNotificationPreferences(uid: string, enabled: boolean): Promise<ActionResult> {
    if (!uid) {
        return { success: false, error: 'User ID is required.' };
    }
    try {
        const supabase = await createServerSupabaseClient();
        const { error } = await supabase
            .from('profiles')
            .update({ notification_enabled: enabled, updated_at: new Date().toISOString() })
            .eq('id', uid);

        if (error) return { success: false, error: error.message };
        return { success: true, message: `Notifications ${enabled ? 'enabled' : 'disabled'} successfully.` };
    } catch (error: any) {
        return { success: false, error: 'Failed to update preferences.' };
    }
}

/**
 * Fetches user settings (currently: notification preferences) from the profiles table.
 * Replaces the legacy read from local JSON users array.
 */
export async function getUserSettings(uid: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!uid) {
        return { success: false, error: 'User ID is required.' };
    }
    try {
        const supabase = await createServerSupabaseClient();
        const { data, error } = await supabase
            .from('profiles')
            .select('notification_enabled')
            .eq('id', uid)
            .single();

        if (error) {
            // If column doesn't exist yet, return defaults gracefully
            return { success: true, data: { notifications: { enabled: true } } };
        }
        return {
            success: true,
            data: {
                notifications: {
                    enabled: data?.notification_enabled ?? true,
                },
            },
        };
    } catch (error: any) {
        return { success: false, error: 'Failed to fetch settings.' };
    }
}
