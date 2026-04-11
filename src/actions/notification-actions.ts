'use server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function createNotification(userId: string, title: string, message: string, type: string) { 
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('notifications').insert({ user_id: userId, title, message, type });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getNotificationsForUser(userId: string, limit: number = 20) { 
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { success: false, error: error.message };
  
  const mapped = data.map((n: any) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    timestamp: n.created_at,
    read: n.is_read,
    type: n.type || 'info',
  }));
  return { success: true, data: mapped };
}

export async function markNotificationRead(notificationId: string) { 
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function markAllNotificationsRead(notificationIds: string[]) { 
  const supabase = await createServerSupabaseClient();
  if (!notificationIds || notificationIds.length === 0) return { success: true };
  const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', notificationIds);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

