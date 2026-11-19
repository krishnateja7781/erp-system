import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * POST /api/auth/logout
 * Signs out the current user using Supabase Auth (replaces legacy iron-session logout).
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        await supabase.auth.signOut();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Logout Error]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
