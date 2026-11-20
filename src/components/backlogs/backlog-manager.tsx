'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Loader2, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { computeTotal, gradeForTotal } from '@/lib/grading';
import {
  getBacklogs, getBacklogSummary, recordBacklogAttempt,
  type BacklogSummary, type StaffBacklogRow,
} from '@/actions/backlog-actions';

type StatusFilter = 'Active' | 'Cleared' | 'all';

/** Backlog management for the exam & marks department and super admins. */
export function BacklogManager() {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<StaffBacklogRow[]>([]);
  const [summary, setSummary] = React.useState<BacklogSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [status, setStatus] = React.useState<StatusFilter>('Active');
  const [program, setProgram] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [target, setTarget] = React.useState<StaffBacklogRow | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [list, s] = await Promise.all([getBacklogs({ status }), getBacklogSummary()]);
      setRows(list);
      setSummary(s);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'Could not load backlogs.' });
    } finally {
      setIsLoading(false);
    }
  }, [status, toast]);

  React.useEffect(() => { load(); }, [load]);

  const programs = React.useMemo(() => Array.from(new Set(rows.map((r) => r.program).filter(Boolean))) as string[], [rows]);
  const visible = rows.filter((r) => {
    if (program !== 'all' && r.program !== program) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.collegeId.toLowerCase().includes(q) || r.studentName.toLowerCase().includes(q) || r.courseCode.toLowerCase().includes(q) || r.courseName.toLowerCase().includes(q);
  });

  // Per-student totals so staff can see who carries the most backlogs.
  const perStudent = React.useMemo(() => {
    const m = new Map<string, number>();
    rows.filter((r) => r.status === 'Active').forEach((r) => m.set(r.studentId, (m.get(r.studentId) || 0) + 1));
    return m;
  }, [rows]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-600 to-orange-500 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Backlog Management</h1>
        <p className="text-white/80 text-sm mt-1">Failed subjects are added automatically from marks. Record re-exam (supplementary) results here; a pass clears the backlog and updates the marksheet.</p>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="card-elevated"><CardHeader className="pb-2"><CardDescription className="text-destructive font-medium">Active backlogs</CardDescription><CardTitle className="text-3xl">{summary.activeBacklogs}</CardTitle></CardHeader></Card>
          <Card className="card-elevated"><CardHeader className="pb-2"><CardDescription>Students with backlogs</CardDescription><CardTitle className="text-3xl">{summary.studentsWithBacklogs}</CardTitle></CardHeader></Card>
          <Card className="card-elevated"><CardHeader className="pb-2"><CardDescription className="text-green-600 font-medium">Cleared</CardDescription><CardTitle className="text-3xl">{summary.clearedBacklogs}</CardTitle></CardHeader></Card>
          <Card className="card-elevated">
            <CardHeader className="pb-2"><CardDescription>Most backlogs by subject</CardDescription></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {summary.topSubjects.length === 0 ? <span className="text-muted-foreground">None</span> : summary.topSubjects.slice(0, 3).map((t) => (
                <div key={t.code} className="flex justify-between gap-2"><span className="truncate">{t.code} — {t.name}</span><Badge variant="destructive">{t.active}</Badge></div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="card-elevated">
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
            <div>
              <CardTitle className="text-lg">Backlog register</CardTitle>
              <CardDescription>{visible.length} record(s)</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8 w-56" placeholder="Student, ID or subject" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={program} onValueChange={setProgram}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Program" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All programs</SelectItem>
                  {programs.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Cleared">Cleared</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={load} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No backlogs match these filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Sem</TableHead>
                  <TableHead className="text-right">Backlog count</TableHead>
                  <TableHead>Last result</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => {
                  const last = r.attempts[r.attempts.length - 1];
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.studentName}</div>
                        <div className="text-xs text-muted-foreground">{r.collegeId} · {r.program} {r.branch} · Sem {r.currentSemester}
                          {(perStudent.get(r.studentId) || 0) > 1 && <> · <span className="text-destructive">{perStudent.get(r.studentId)} active</span></>}
                        </div>
                      </TableCell>
                      <TableCell><div className="font-medium">{r.courseCode}</div><div className="text-xs text-muted-foreground">{r.courseName}</div></TableCell>
                      <TableCell>{r.semester}</TableCell>
                      <TableCell className="text-right"><Badge variant={r.status === 'Active' ? 'destructive' : 'secondary'}>{r.failCount}</Badge></TableCell>
                      <TableCell className="text-xs">{last ? `${last.examLabel}: ${last.total} (${last.grade})` : 'Original exam: F'}</TableCell>
                      <TableCell>{r.status === 'Active' ? <Badge variant="destructive">Active</Badge> : <Badge>Cleared · {r.clearedGrade}</Badge>}</TableCell>
                      <TableCell className="text-right">
                        {r.status === 'Active' && (
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => setTarget(r)}>
                            <RotateCcw className="h-3 w-3" /> Record re-exam
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ReExamDialog row={target} onClose={() => setTarget(null)} onSaved={load} />
    </div>
  );
}

function ReExamDialog({ row, onClose, onSaved }: { row: StaffBacklogRow | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [see, setSee] = React.useState('');
  const [label, setLabel] = React.useState('Supplementary');
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => { if (row) { setSee(''); setLabel('Supplementary'); } }, [row]);

  const seeNum = see === '' ? null : Number(see);
  const valid = seeNum !== null && Number.isFinite(seeNum) && seeNum >= 0 && seeNum <= 100;
  const preview = row && valid ? computeTotal({ ...row.internals, see: seeNum }) : null;

  const save = async () => {
    if (!row || !valid) return;
    setIsSaving(true);
    const res = await recordBacklogAttempt({ backlogId: row.id, see: seeNum!, examLabel: label, attemptDate: date });
    setIsSaving(false);
    if (!res.success) {
      toast({ variant: 'destructive', title: 'Could not record result', description: res.error });
      return;
    }
    toast({ title: res.data?.passed ? 'Backlog cleared' : 'Result recorded', description: res.message });
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Record re-exam result</DialogTitle>
          <DialogDescription>{row?.studentName} ({row?.collegeId}) — {row?.courseCode} {row?.courseName}. Current backlog count: {row?.failCount}.</DialogDescription>
        </DialogHeader>
        {row && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Internals kept from the original attempt: IA-1 {row.internals.ia1 ?? '-'}/40, IA-2 {row.internals.ia2 ?? '-'}/40, Others {row.internals.other ?? '-'}/20.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="see">SEE marks (/100)</Label>
                <Input id="see" type="number" min={0} max={100} value={see} onChange={(e) => setSee(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="date">Exam date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="label">Exam session</Label>
              <Input id="label" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
            </div>
            {preview !== null && (
              <p className="text-sm">
                Result preview: total <strong>{preview}</strong>, grade <Badge variant={gradeForTotal(preview) === 'F' ? 'destructive' : 'default'}>{gradeForTotal(preview)}</Badge>
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!valid || isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save result</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
