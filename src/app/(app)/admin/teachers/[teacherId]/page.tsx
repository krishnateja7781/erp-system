
'use client';

import { redirect } from 'next/navigation';

export default function DeprecatedTeacherDetailPage() {
    // This page is deprecated and its functionality is now under /admin/staff/[staffId].
    // We can't know the staff doc ID from the old teacher UID param, so redirect to the main list.
    redirect(`/admin/staff`);

    return null;
}
