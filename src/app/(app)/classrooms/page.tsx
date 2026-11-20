import { redirect } from 'next/navigation';
import { getCaller } from '@/lib/auth-guard';

/** Shared entry point (header button, notifications): send each role to its own classrooms page. */
export default async function ClassroomsEntryPage() {
  const caller = await getCaller();
  if (caller?.role === 'teacher') redirect('/teacher/classrooms');
  if (caller?.role === 'student') redirect('/student/classrooms');
  redirect(caller ? '/' : '/login');
}
