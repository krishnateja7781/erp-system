

import { getTeacherProfileDetails } from '@/actions/dashboard-actions';
import { TeacherProfileClientPage } from '@/components/admin/teachers/teacher-profile-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';


interface AdminStaffDetailPageProps {
  params: Promise<{ staffId: string; }>;
}

export const revalidate = 0; // Disable caching for this dynamic page

export default async function AdminStaffDetailPage({ params }: AdminStaffDetailPageProps) {
    const { staffId } = await params;
    const staffData = await getTeacherProfileDetails(staffId);

    if (!staffData) {
        return (
            <div className="flex justify-center items-center h-full p-4">
                <Alert variant="destructive" className="w-full max-w-md">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Staff Member Not Found</AlertTitle>
                    <AlertDescription>
                        A profile with the ID <span className="font-mono bg-destructive/20 px-1 py-0.5 rounded">{staffId}</span> could not be found.
                        It may have been deleted or the link is incorrect.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return <TeacherProfileClientPage initialTeacherData={staffData} />;
}
