'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { getStudentAttendanceDetails } from '@/actions/student-actions';
import { getStudentMarksForDisplay, type SemesterMarksData } from '@/actions/marks-actions';

type Mode = 'attendance' | 'marks';

/** Full attendance log or semester-wise marks sheet for one student (staff view). */
export function StudentRecordsDialog({ studentId, studentName, mode, onClose }: {
  studentId: string;
  studentName: string;
  mode: Mode | null;
  onClose: () => void;
}) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [attendance, setAttendance] = React.useState<Awaited<ReturnType<typeof getStudentAttendanceDetails>> | null>(null);
  const [marks, setMarks] = React.useState<SemesterMarksData[] | null>(null);

  React.useEffect(() => {
    if (!mode) return;
    setIsLoading(true);
    setError(null);
    const load = mode === 'attendance'
      ? getStudentAttendanceDetails(studentId).then(setAttendance)
      : getStudentMarksForDisplay(studentId).then(setMarks);
    load.catch((e: Error) => setError(e.message || 'Could not load records.')).finally(() => setIsLoading(false));
  }, [mode, studentId]);

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'marks' ? 'Marks sheet' : 'Attendance log'}</DialogTitle>
          <DialogDescription>{studentName}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : error ? (
          <p className="text-sm text-destructive py-6 text-center">{error}</p>
        ) : mode === 'attendance' && attendance ? (
          attendance.summary.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No attendance recorded yet.</p>
          ) : (
            <div className="space-y-6">
              {attendance.summary.map((sem) => (
                <div key={sem.semester}>
                  <h4 className="font-semibold mb-2">Semester {sem.semester}</h4>
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Course</TableHead><TableHead className="text-right">Attended</TableHead><TableHead className="text-right">%</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {sem.courses.map((c) => {
                        const pct = c.total > 0 ? Math.round((c.attended / c.total) * 100) : 0;
                        return (
                          <TableRow key={c.courseCode}>
                            <TableCell>{c.courseCode} — {c.courseName}</TableCell>
                            <TableCell className="text-right">{c.attended}/{c.total}</TableCell>
                            <TableCell className="text-right"><Badge variant={pct < 75 ? 'destructive' : 'default'}>{pct}%</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
              <div>
                <h4 className="font-semibold mb-2">Recent entries</h4>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Date</TableHead><TableHead>Period</TableHead><TableHead>Course</TableHead><TableHead className="text-right">Status</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.logs.slice(0, 50).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.date}</TableCell>
                        <TableCell>{l.period}</TableCell>
                        <TableCell>{l.courseCode}</TableCell>
                        <TableCell className="text-right"><Badge variant={l.status === 'Present' ? 'default' : 'destructive'}>{l.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )
        ) : mode === 'marks' && marks ? (
          marks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No marks recorded yet.</p>
          ) : (
            <div className="space-y-6">
              {marks.map((sem) => (
                <div key={sem.semester}>
                  <h4 className="font-semibold mb-2">Semester {sem.semester}{sem.gpa != null ? ` · GPA ${sem.gpa}` : ''}</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead><TableHead className="text-right">IA-1</TableHead><TableHead className="text-right">IA-2</TableHead>
                        <TableHead className="text-right">Others</TableHead><TableHead className="text-right">SEE</TableHead>
                        <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sem.courses.map((c) => (
                        <TableRow key={c.code}>
                          <TableCell>{c.code} — {c.name}</TableCell>
                          <TableCell className="text-right">{c.ia1 ?? '-'}</TableCell>
                          <TableCell className="text-right">{c.ia2 ?? '-'}</TableCell>
                          <TableCell className="text-right">{c.other ?? '-'}</TableCell>
                          <TableCell className="text-right">{c.externals ?? '-'}</TableCell>
                          <TableCell className="text-right">{c.total ?? '-'}</TableCell>
                          <TableCell className="text-right"><Badge variant={c.grade === 'F' ? 'destructive' : 'default'}>{c.grade || '-'}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
