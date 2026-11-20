'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getStudentBacklogs, type BacklogSubject } from '@/actions/backlog-actions';

/**
 * Student backlog page. Only reachable (and only shown in the sidebar) while the
 * student has at least one ACTIVE backlog; otherwise it sends them to Marks.
 */
export default function StudentBacklogsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [subjects, setSubjects] = React.useState<BacklogSubject[] | null>(null);

  React.useEffect(() => {
    getStudentBacklogs()
      .then((rows) => {
        if (!rows.some((r) => r.status === 'Active')) {
          router.replace('/student/marks');
          return;
        }
        setSubjects(rows);
      })
      .catch(() => {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load your backlogs.' });
        setSubjects([]);
      });
  }, [router, toast]);

  if (subjects === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading backlogs…</span>
      </div>
    );
  }

  const active = subjects.filter((s) => s.status === 'Active');
  const cleared = subjects.filter((s) => s.status === 'Cleared');
  const totalAttempts = subjects.reduce((sum, s) => sum + s.failCount, 0);
  const bySemester = active.reduce<Record<number, BacklogSubject[]>>((acc, s) => {
    (acc[s.semester] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-600 to-orange-500 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">My Backlogs</h1>
        <p className="text-white/80 text-sm mt-1">
          Subjects you need to clear. Your exam department schedules re-exams; internals are kept and only the SEE is retaken.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="card-elevated">
          <CardHeader className="pb-2"><CardDescription className="text-destructive font-medium">Active backlogs</CardDescription><CardTitle className="text-4xl">{active.length}</CardTitle></CardHeader>
        </Card>
        <Card className="card-elevated">
          <CardHeader className="pb-2"><CardDescription>Failed attempts (all subjects)</CardDescription><CardTitle className="text-4xl">{totalAttempts}</CardTitle></CardHeader>
        </Card>
        <Card className="card-elevated">
          <CardHeader className="pb-2"><CardDescription className="text-green-600 font-medium">Cleared</CardDescription><CardTitle className="text-4xl">{cleared.length}</CardTitle></CardHeader>
        </Card>
      </div>

      {Object.entries(bySemester).map(([semester, rows]) => (
        <Card key={semester} className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5 text-destructive" /> Semester {semester}</CardTitle>
            <CardDescription>Year {rows[0].studyYear}</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Internals (/60)</TableHead>
                  <TableHead className="text-right">Backlog count</TableHead>
                  <TableHead>Re-exam history</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const internals = (s.internals.ia1 ?? 0) / 2 + (s.internals.ia2 ?? 0) / 2 + (s.internals.other ?? 0);
                  return (
                    <TableRow key={s.id}>
                      <TableCell><div className="font-medium">{s.courseCode}</div><div className="text-xs text-muted-foreground">{s.courseName}</div></TableCell>
                      <TableCell className="text-right">{s.credits}</TableCell>
                      <TableCell className="text-right">{Math.round(internals * 10) / 10}</TableCell>
                      <TableCell className="text-right"><Badge variant="destructive">{s.failCount}</Badge></TableCell>
                      <TableCell>
                        {s.attempts.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No re-exam yet</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {s.attempts.map((a) => (
                              <Badge key={a.id} variant={a.passed ? 'default' : 'outline'} className="gap-1 font-normal">
                                <RotateCcw className="h-3 w-3" />{a.examLabel} · {a.attemptDate} · {a.total} ({a.grade})
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {cleared.length > 0 && (
        <Card className="card-elevated">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CheckCircle2 className="h-5 w-5 text-green-600" /> Cleared backlogs</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Subject</TableHead><TableHead>Semester</TableHead><TableHead className="text-right">Backlog count</TableHead><TableHead className="text-right">Cleared grade</TableHead><TableHead className="text-right">Cleared on</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {cleared.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><div className="font-medium">{s.courseCode}</div><div className="text-xs text-muted-foreground">{s.courseName}</div></TableCell>
                    <TableCell>{s.semester}</TableCell>
                    <TableCell className="text-right">{s.failCount}</TableCell>
                    <TableCell className="text-right"><Badge>{s.clearedGrade}</Badge></TableCell>
                    <TableCell className="text-right">{s.clearedAt?.slice(0, 10)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
