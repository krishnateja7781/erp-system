
'use client';

import { redirect } from 'next/navigation';

export default function DeprecatedTeachersPage() {
    // This page is deprecated and its functionality is merged into the /admin/staff page.
    // Redirecting to avoid confusion and broken links.
    redirect('/admin/staff');
    return null;
}
