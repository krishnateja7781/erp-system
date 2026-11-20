import { getTeacherProfileDetails } from '@/actions/dashboard-actions';
import { TeacherProfileClientPage } from '@/components/admin/teachers/teacher-profile-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export const revalidate = 0;

/** Teacher detail for the student & staff department (same view as admin, links stay in /employee). */
export default async function EmployeeTeacherDetailPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const { teacherId } = await params;
  const teacherData = await getTeacherProfileDetails(teacherId, { staffDocId: teacherId });
  if (!teacherData) {
    return (
      <div className="flex justify-center items-center h-full p-4">
        <Alert variant="destructive" className="w-full max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Teacher Not Found</AlertTitle>
          <AlertDescription>This teacher could not be found. They may have been removed or the link is incorrect.</AlertDescription>
        </Alert>
      </div>
    );
  }
  return <TeacherProfileClientPage initialTeacherData={teacherData} basePath="/employee" />;
}
