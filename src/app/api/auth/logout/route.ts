
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { SESSION_OPTIONS, type SessionUser } from '@/lib/auth-session';

export async function POST(req: NextRequest) {
    const res = NextResponse.json({ success: true });
    const session = await getIronSession<{ user?: SessionUser }>(req, res, SESSION_OPTIONS);
    session.destroy();
    await session.save();
    return res;
}
