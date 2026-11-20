import { getStudentProfileDetails } from '@/actions/dashboard-actions';
import { StudentProfileClientPage } from '@/components/admin/students/student-profile-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export const revalidate = 0;

/** Student detail for the student & staff department (same view as admin, links stay in /employee). */
export default async function EmployeeStudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const studentData = await getStudentProfileDetails(studentId);
  if (!studentData) {
    return (
      <div className="flex justify-center items-center h-full p-4">
        <Alert variant="destructive" className="w-full max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Student Not Found</AlertTitle>
          <AlertDescription>This student could not be found. It may have been deleted or the link is incorrect.</AlertDescription>
        </Alert>
      </div>
    );
  }
  return <StudentProfileClientPage initialStudentData={studentData} basePath="/employee" />;
}
