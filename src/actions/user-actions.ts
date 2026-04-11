
'use server';

import { findOneWhere, readCollection, updateDoc, writeCollection, generateId, nowISO, insertDoc } from '@/lib/db';
import type { ActionResult } from '@/lib/types';


interface ProfileResult {
    success: boolean;
    data?: any;
    error?: string;
}

export async function getUserProfileOnLogin(uid: string, email: string | null): Promise<ProfileResult> {
    if (!uid) {
        return { success: false, error: 'User UID is missing.' };
    }

    try {
        const userProfile = await findOneWhere<any>('users', (u) => u.id === uid || u.uid === uid);

        if (!userProfile) {
            return { success: false, error: 'Your user profile was not found. Please contact administration.' };
        }

        const userRole = userProfile.role;
        if (!userRole) {
            return { success: false, error: `User with UID ${uid} is missing the 'role' field.` };
        }

        // Log login activity
        try {
            await insertDoc('loginActivities', {
                id: generateId(),
                userId: uid,
                userRole,
                userName: userProfile.name || email || 'Unknown',
                timestamp: nowISO(),
                status: 'Success',
            });
        } catch { /* non-critical */ }

        let collectionName: 'students' | 'teachers' | 'admins';
        switch (userRole) {
            case 'student': collectionName = 'students'; break;
            case 'teacher': collectionName = 'teachers'; break;
            case 'admin': collectionName = 'admins'; break;
            default:
                return { success: false, error: `Unrecognized user role: '${userRole}'.` };
        }

        const detailedProfile = await findOneWhere<any>(collectionName, (item) => item.id === uid || item.user_uid === uid);

        if (!detailedProfile) {
            return { success: false, error: `Your detailed ${userRole} profile is missing. Please contact administration.` };
        }

        const merged = { ...userProfile, ...detailedProfile, id: detailedProfile.id };
        return { success: true, data: merged };

    } catch (error: any) {
        console.error(`Server error in getUserProfileOnLogin for UID ${uid}:`, error);
        return { success: false, error: 'An unexpected server error occurred while retrieving your profile.' };
    }
}


export async function sendPasswordResetLink(email: string): Promise<ActionResult> {
    if (!email) {
        return { success: false, error: 'Email is required.' };
    }
    // Without email sending, just inform admin must reset
    return { success: true, message: `Password reset requests must be handled by the administrator. Please contact admin for a password reset for ${email}.` };
}

export async function updateNotificationPreferences(uid: string, enabled: boolean): Promise<ActionResult> {
    if (!uid) {
        return { success: false, error: 'User ID is required.' };
    }
    try {
        const users = await readCollection<any>('users');
        const idx = users.findIndex((u) => u.id === uid || u.uid === uid);
        if (idx === -1) return { success: false, error: 'User not found.' };
        users[idx].settings = { ...(users[idx].settings || {}), notifications: { enabled } };
        users[idx].updatedAt = nowISO();
        await writeCollection('users', users);
        return { success: true, message: 'Notification preferences updated.' };
    } catch (error: any) {
        return { success: false, error: 'Failed to update preferences.' };
    }
}

export async function getUserSettings(uid: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!uid) {
        return { success: false, error: 'User ID is required.' };
    }
    try {
        const user = await findOneWhere<any>('users', (u) => u.id === uid || u.uid === uid);
        if (!user) return { success: false, error: 'User profile not found.' };
        const settings = user.settings || { notifications: { enabled: true } };
        return { success: true, data: settings };
    } catch (error: any) {
        return { success: false, error: 'Failed to fetch settings.' };
    }
}

