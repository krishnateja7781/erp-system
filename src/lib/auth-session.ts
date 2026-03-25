
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export interface SessionUser {
    id: string;          // doc id (= uid)
    uid: string;
    name: string;
    email: string;
    role: 'super_admin' | 'teacher' | 'student' | 'employee';
    staffId?: string | null;
    collegeId?: string | null;
    staffDocId?: string | null;
    studentDocId?: string | null;
    initials?: string;
    avatarUrl?: string;
    program?: string | null;
    branch?: string | null;
    year?: number | null;
    type?: string | null;
}

declare module 'iron-session' {
    interface IronSessionData {
        user?: SessionUser;
    }
}

const SESSION_OPTIONS: SessionOptions = {
    password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_erp_local',
    cookieName: 'erp_session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
    },
};

export async function getServerSession(): Promise<IronSession<{ user?: SessionUser }>> {
    const cookieStore = await cookies();
    return getIronSession(cookieStore as any, SESSION_OPTIONS);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
    try {
        const session = await getServerSession();
        return session.user ?? null;
    } catch {
        return null;
    }
}

// Password utilities
export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}

export { SESSION_OPTIONS };
