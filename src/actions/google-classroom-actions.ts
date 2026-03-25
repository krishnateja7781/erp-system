'use server';

/**
 * Google Classroom Server Actions
 *
 * These Next.js server actions act as a secure proxy layer between the
 * frontend and the Express backend. They forward requests with the user's
 * ERP backend JWT token and handle errors uniformly.
 *
 * NOTE: The actual Google API calls happen exclusively on the Express backend.
 * These actions simply relay data and shape responses for the UI.
 */

import { getCurrentUser } from '@/lib/auth-session';
import { linkGoogleCourseId } from '@/actions/classroom-actions';
import type { ActionResult } from '@/lib/types';

const BACKEND_URL = process.env.ERP_BACKEND_URL || 'http://localhost:5000';

// ─── Helper ─────────────────────────────────────────────

async function backendFetch(
    path: string,
    token: string,
    options: RequestInit = {}
): Promise<any> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string> || {}),
    };

    // Only set Content-Type for non-FormData bodies
    if (options.body && typeof options.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${BACKEND_URL}${path}`, {
        ...options,
        headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || `Backend responded with ${res.status}`);
    }

    return data;
}

// ─── Classroom Actions ──────────────────────────────────

export async function gcCreateClassroom(
    token: string,
    payload: { name: string; section?: string; descriptionHeading?: string; erpClassId: string }
): Promise<ActionResult> {
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        if (user.role !== 'teacher') return { success: false, error: 'Only teachers can create classrooms' };

        const data = await backendFetch('/api/classroom/create', token, {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        // Sync: store the Google Course ID back on the ERP classroom record
        if (data.classroom?.googleCourseId && payload.erpClassId) {
            await linkGoogleCourseId(payload.erpClassId, data.classroom.googleCourseId);
        }

        return { success: true, data: data.classroom };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function gcJoinClassroom(
    token: string,
    enrollmentCode: string
): Promise<ActionResult> {
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        if (user.role !== 'student') return { success: false, error: 'Only students can join classrooms' };

        const data = await backendFetch('/api/classroom/join', token, {
            method: 'POST',
            body: JSON.stringify({ enrollmentCode }),
        });

        return { success: true, data };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function gcListClassrooms(token: string): Promise<ActionResult> {
    try {
        const data = await backendFetch('/api/classroom/list', token);
        return { success: true, data: data.courses || [] };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function gcGetClassroom(token: string, courseId: string): Promise<ActionResult> {
    try {
        const data = await backendFetch(`/api/classroom/${courseId}`, token);
        return { success: true, data: data.course };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// ─── Announcement Actions ───────────────────────────────

export async function gcCreateAnnouncement(
    token: string,
    courseId: string,
    text: string
): Promise<ActionResult> {
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false, error: 'Not authenticated' };

        const data = await backendFetch(`/api/classroom/${courseId}/announce`, token, {
            method: 'POST',
            body: JSON.stringify({ text }),
        });

        return { success: true, data: data.announcement };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function gcListAnnouncements(
    token: string,
    courseId: string
): Promise<ActionResult> {
    try {
        const data = await backendFetch(`/api/classroom/${courseId}/announce`, token);
        return { success: true, data: data.announcements || [] };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// ─── Assignment Actions ─────────────────────────────────

export async function gcCreateAssignment(
    token: string,
    courseId: string,
    payload: {
        title: string;
        description?: string;
        maxPoints?: number;
        dueDate?: { year: number; month: number; day: number };
        dueTime?: { hours: number; minutes: number };
        driveFileIds?: string[];
    }
): Promise<ActionResult> {
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        if (user.role !== 'teacher') return { success: false, error: 'Only teachers can create assignments' };

        const data = await backendFetch(`/api/classroom/${courseId}/assignment`, token, {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        return { success: true, data: data.assignment };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function gcListAssignments(
    token: string,
    courseId: string
): Promise<ActionResult> {
    try {
        const data = await backendFetch(`/api/classroom/${courseId}/assignments`, token);
        return { success: true, data: data.assignments || [] };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// ─── Submission Actions ─────────────────────────────────

export async function gcSubmitAssignment(
    token: string,
    courseId: string,
    assignmentId: string,
    driveFileId: string
): Promise<ActionResult> {
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false, error: 'Not authenticated' };
        if (user.role !== 'student') return { success: false, error: 'Only students can submit assignments' };

        const data = await backendFetch(
            `/api/classroom/${courseId}/assignment/${assignmentId}/submit`,
            token,
            {
                method: 'POST',
                body: JSON.stringify({ driveFileId }),
            }
        );

        return { success: true, data };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function gcListSubmissions(
    token: string,
    courseId: string,
    assignmentId: string
): Promise<ActionResult> {
    try {
        const data = await backendFetch(
            `/api/classroom/${courseId}/assignment/${assignmentId}/submissions`,
            token
        );

        return { success: true, data: data.submissions || [] };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
