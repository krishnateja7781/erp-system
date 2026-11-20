import { headers } from 'next/headers';
import { createServiceRoleClient } from '@/lib/supabase';

/** Best-effort client IP from the proxy headers (Vercel / most hosts set x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') || h.get('x-real-ip') || 'unknown').split(',')[0].trim();
}

/**
 * Fixed-window limiter backed by the `hit_rate_limit` SQL function (atomic across
 * all server instances). Fails OPEN if the database call itself errors, so an
 * outage of this check never locks everyone out.
 */
export async function withinRateLimit(bucket: string, limit: number, windowSeconds: number, subject?: string): Promise<boolean> {
  try {
    const key = `${bucket}:${subject ?? await clientIp()}`;
    const admin = await createServiceRoleClient();
    const { data, error } = await admin.rpc('hit_rate_limit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}
