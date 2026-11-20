import { redirect } from 'next/navigation';
import { getCaller } from '@/lib/auth-guard';

/** Deep links from notifications (e.g. new assignment) → the role-specific classroom page. */
export default async function ClassroomDeepLinkPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params;
  const caller = await getCaller();
  const id = encodeURIComponent(classroomId);
  if (caller?.role === 'teacher') redirect(`/teacher/classrooms/${id}`);
  if (caller?.role === 'student') redirect(`/student/classrooms/${id}`);
  redirect(caller ? '/' : '/login');
}
