/**
 * Google Classroom API Client
 * 
 * All calls to the Google Classroom API are proxied through the Express backend
 * at /api/... – the PWA never calls Google APIs directly.
 * 
 * The ERP JWT token is sent as a Bearer token in the Authorization header
 * so the backend can identify the user and fetch their stored Google tokens.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_ERP_BACKEND_URL || 'http://localhost:5000';

// ─── Helpers ────────────────────────────────────────────

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('erpBackendToken');
}

function setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('erpBackendToken', token);
}

/**
 * Exchange the current Supabase session for an Express JWT.
 * Must be called once on page load before any other backend API calls.
 * Stores the resulting token in localStorage as 'erpBackendToken'.
 */
export async function issueBackendToken(): Promise<boolean> {
    try {
        // Dynamically import to avoid SSR issues
        const { supabase } = await import('@/lib/supabase-client');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        // Fetch profile to get role and name
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', user.id)
            .maybeSingle();

        const res = await fetch(`${BACKEND_URL}/api/google/issue-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: user.id,
                role: profile?.role || 'teacher',
                name: profile?.full_name || user.email || 'Teacher',
                email: user.email || '',
            }),
        });

        if (!res.ok) return false;
        const { token } = await res.json();
        if (token) { setToken(token); return true; }
        return false;
    } catch (err) {
        console.error('Failed to issue backend token:', err);
        return false;
    }
}

export async function request<T = any>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Only set Content-Type for non-FormData bodies
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${BACKEND_URL}${path}`, {
        ...options,
        headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        const errorMessage = data.error || `Request failed with status ${res.status}`;
        throw new Error(errorMessage);
    }

    return data as T;
}

// ─── Auth ───────────────────────────────────────────────

/** Returns the Google OAuth authorization URL to open in a popup */
export function getGoogleAuthUrl(): string {
    const token = getToken();
    return `${BACKEND_URL}/api/google/auth?token=${encodeURIComponent(token || '')}`;
}

/** Check if the user has linked their Google account */
export async function checkGoogleLinked(): Promise<{ linked: boolean }> {
    return request('/api/google/status');
}

// ─── Classroom ──────────────────────────────────────────

export interface GoogleCourse {
    id: string;
    name: string;
    section?: string;
    descriptionHeading?: string;
    enrollmentCode?: string;
    courseState?: string;
    alternateLink?: string;
    ownerId?: string;
}

export interface CreateClassroomPayload {
    name: string;
    section?: string;
    descriptionHeading?: string;
    erpClassId: string;
}

export async function createGoogleClassroom(payload: CreateClassroomPayload) {
    return request<{ success: boolean; classroom: any }>('/api/classroom/create', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function joinGoogleClassroom(enrollmentCode: string) {
    return request<{ success: boolean; message: string }>('/api/classroom/join', {
        method: 'POST',
        body: JSON.stringify({ enrollmentCode }),
    });
}

export async function listGoogleClassrooms() {
    return request<{ courses: GoogleCourse[] }>('/api/classroom/list');
}

export async function getGoogleClassroom(courseId: string) {
    return request<{ course: GoogleCourse }>(`/api/classroom/${courseId}`);
}

// ─── Announcements ──────────────────────────────────────

export interface GoogleAnnouncement {
    id: string;
    courseId: string;
    text: string;
    state: string;
    creationTime: string;
    updateTime: string;
    creatorUserId: string;
}

export async function createAnnouncement(courseId: string, text: string) {
    return request<{ success: boolean; announcement: GoogleAnnouncement }>(
        `/api/classroom/${courseId}/announce`,
        {
            method: 'POST',
            body: JSON.stringify({ text }),
        }
    );
}

export async function listAnnouncements(courseId: string) {
    return request<{ announcements: GoogleAnnouncement[] }>(
        `/api/classroom/${courseId}/announce`
    );
}

// ─── Assignments ────────────────────────────────────────

export interface GoogleAssignment {
    id: string;
    courseId: string;
    title: string;
    description?: string;
    maxPoints?: number;
    state: string;
    workType: string;
    creationTime: string;
    updateTime: string;
    dueDate?: { year: number; month: number; day: number };
    dueTime?: { hours: number; minutes: number };
    materials?: any[];
    alternateLink?: string;
}

export interface CreateAssignmentPayload {
    title: string;
    description?: string;
    maxPoints?: number;
    dueDate?: { year: number; month: number; day: number };
    dueTime?: { hours: number; minutes: number };
    driveFileIds?: string[];
}

export async function createAssignment(courseId: string, payload: CreateAssignmentPayload) {
    return request<{ success: boolean; assignment: GoogleAssignment }>(
        `/api/classroom/${courseId}/assignment`,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    );
}

export async function listAssignments(courseId: string) {
    return request<{ assignments: GoogleAssignment[] }>(
        `/api/classroom/${courseId}/assignments`
    );
}

// ─── Submissions ────────────────────────────────────────

export interface GoogleSubmission {
    id: string;
    courseId: string;
    courseWorkId: string;
    userId: string;
    state: string;
    assignedGrade?: number;
    alternateLink?: string;
    assignmentSubmission?: {
        attachments?: {
            driveFile?: {
                id: string;
                title: string;
                alternateLink: string;
            };
        }[];
    };
    creationTime: string;
    updateTime: string;
}

export async function submitAssignment(
    courseId: string,
    assignmentId: string,
    driveFileId: string
) {
    return request<{ success: boolean; message: string }>(
        `/api/classroom/${courseId}/assignment/${assignmentId}/submit`,
        {
            method: 'POST',
            body: JSON.stringify({ driveFileId }),
        }
    );
}

export async function listSubmissions(courseId: string, assignmentId: string) {
    return request<{ submissions: GoogleSubmission[] }>(
        `/api/classroom/${courseId}/assignment/${assignmentId}/submissions`
    );
}

// ─── Drive (File Upload) ───────────────────────────────

export interface DriveFile {
    driveFileId: string;
    name: string;
    webViewLink: string;
    webContentLink: string;
    mimeType: string;
}

export async function uploadFileToDrive(file: File, folderId?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
        formData.append('folderId', folderId);
    }

    return request<{ success: boolean; file: DriveFile }>('/api/drive/upload', {
        method: 'POST',
        body: formData,
    });
}

export async function getDriveFileInfo(fileId: string) {
    return request<{ file: any }>(`/api/drive/file/${fileId}`);
}
