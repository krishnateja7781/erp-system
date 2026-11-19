'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Users, BookOpen, User, CalendarDays, Hash } from 'lucide-react';

interface ClassroomSummaryData {
  classroomId: string;
  classroomName: string;
  courseName: string;
  section: string;
}

interface ClassroomDetail {
  name: string;
  subject: string;
  ownerName: string;
  memberCount: number;
  inviteCode: string;
  createdAt: string;
}

interface ClassroomSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: ClassroomSummaryData | null;
}

async function fetchClassroomSummary(classroomId: string): Promise<ClassroomDetail | null> {
  try {
    const { getClassroom } = await import('@/actions/classroom-actions');
    const room = await getClassroom(classroomId);
    if (!room) return null;
    return {
      name: room.name || '',
      subject: room.subject || '',
      ownerName: room.ownerName || 'N/A',
      memberCount: room.memberUids?.length ?? 0,
      inviteCode: room.inviteCode || 'N/A',
      createdAt: room.createdAt || '',
    };
  } catch {
    return null;
  }
}

export function ClassroomSummaryDialog({ isOpen, onOpenChange, data }: ClassroomSummaryDialogProps) {
  const [detail, setDetail] = React.useState<ClassroomDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen || !data?.classroomId) return;
    setDetail(null);
    setIsLoading(true);
    fetchClassroomSummary(data.classroomId).then(d => {
      setDetail(d);
      setIsLoading(false);
    });
  }, [isOpen, data?.classroomId]);

  if (!data) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <BookOpen className="h-4 w-4" />
            </div>
            Linked Classroom
          </DialogTitle>
          <DialogDescription>
            Virtual classroom linked to <strong>{data.courseName}</strong> — Section {data.section}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm">Loading classroom info…</span>
            </div>
          ) : !detail ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Could not load classroom details.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Classroom Name */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                <BookOpen className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Classroom Name</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{detail.name}</p>
                  {detail.subject && <p className="text-xs text-muted-foreground">{detail.subject}</p>}
                </div>
              </div>

              {/* Teacher / Host */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                <User className="h-4 w-4 mt-0.5 text-violet-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Host Teacher</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{detail.ownerName}</p>
                </div>
              </div>

              {/* Student Count */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                <Users className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Total Members</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm font-semibold text-foreground">{detail.memberCount}</p>
                    <Badge variant="secondary" className="text-xs h-5">{detail.memberCount === 1 ? 'member' : 'members'}</Badge>
                  </div>
                </div>
              </div>

              {/* Invite Code */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                <Hash className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Classroom Code</p>
                  <code className="text-sm font-mono font-bold text-foreground mt-0.5 tracking-widest bg-muted px-2 py-0.5 rounded">
                    {detail.inviteCode}
                  </code>
                </div>
              </div>

              {/* Created */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                <CalendarDays className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Created</p>
                  <p className="text-sm text-foreground mt-0.5">{formatDate(detail.createdAt)}</p>
                </div>
              </div>

              {/* Read-only notice */}
              <p className="text-[11px] text-muted-foreground text-center pt-1 italic">
                ℹ️ Admin view only — classrooms are created and managed by teachers.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
