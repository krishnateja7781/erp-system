'use server';

import { createServiceRoleClient } from '@/lib/supabase';
import { authorize, requireRole, isUuid } from '@/lib/auth-guard';
import type { ActionResult, UserRole } from '@/lib/types';

/**
 * Notifications are primarily produced by database triggers (fee payments,
 * results, placements, classroom work, hostel events …). These actions cover
 * reading the caller's own inbox and staff-initiated broadcasts.
 */

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: string;
  link: string | null;
}

function mapRow(n: any): NotificationItem {
  return {
    id: n.id,
    title: n.title,
    message: n.message || '',
    timestamp: n.created_at,
    read: !!n.is_read,
    type: n.type || 'info',
    link: n.link || null,
  };
}

/** The caller's own notifications (newest first). */
export async function getMyNotifications(limit = 20): Promise<{ success: boolean; data?: NotificationItem[]; error?: string }> {
  try {
    const caller = await requireRole();
    const supabase = await createServiceRoleClient();
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, type, link, is_read, created_at')
      .eq('user_id', caller.userId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data || []).map(mapRow) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** @deprecated kept for API compatibility — always returns the caller's own inbox. */
export async function getNotificationsForUser(_userId: string, limit = 20) {
  return getMyNotifications(limit);
}

export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const caller = await requireRole();
    const supabase = await createServiceRoleClient();
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', caller.userId)
      .eq('is_read', false);
    return count || 0;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const auth = await authorize();
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(notificationId)) return { success: false, error: 'Invalid notification.' };
  const supabase = await createServiceRoleClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', auth.caller.userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function markAllNotificationsRead(_notificationIds?: string[]): Promise<ActionResult> {
  const auth = await authorize();
  if (!auth.ok) return { success: false, error: auth.error };
  const supabase = await createServiceRoleClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', auth.caller.userId)
    .eq('is_read', false);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Server-internal helper: notify one user. Only staff may target other users. */
export async function createNotification(userId: string, title: string, message: string, type = 'info'): Promise<ActionResult> {
  const auth = await authorize('super_admin', 'employee', 'teacher');
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(userId) || !title?.trim()) return { success: false, error: 'Recipient and title are required.' };
  const supabase = await createServiceRoleClient();
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title: title.trim().slice(0, 200),
    message: (message || '').slice(0, 2000),
    type,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export interface BroadcastPayload {
  title: string;
  message: string;
  type?: 'info' | 'alert' | 'event' | 'task';
  /** Target roles; empty / undefined = everyone. */
  roles?: UserRole[];
  link?: string | null;
}

/**
 * Fan out one announcement to every matching user in a single set-based SQL
 * statement (see `broadcast_notification` in database/02_functions.sql), so a
 * broadcast to thousands of users is one round trip, not thousands.
 */
export async function broadcastNotification(payload: BroadcastPayload): Promise<ActionResult> {
  const auth = await authorize('super_admin', 'employee');
  if (!auth.ok) return { success: false, error: auth.error };

  const title = payload.title?.trim();
  if (!title) return { success: false, error: 'Title is required.' };

  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase.rpc('broadcast_notification', {
    p_roles: payload.roles && payload.roles.length > 0 ? payload.roles : null,
    p_title: title.slice(0, 200),
    p_message: (payload.message || '').slice(0, 2000),
    p_type: payload.type || 'info',
    p_link: payload.link || null,
    p_sender: auth.caller.userId,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, message: `Announcement delivered to ${data ?? 0} users.` };
}
