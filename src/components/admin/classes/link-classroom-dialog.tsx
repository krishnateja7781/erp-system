'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, LinkIcon, Unlink, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { linkClassroomToClass, unlinkClassroomFromClass, getAllClassrooms } from '@/actions/class-actions';

interface LinkClassroomDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  classData: {
    classId: string;
    courseName: string;
    section: string;
    currentClassroomId: string | null;
    currentClassroomName?: string | null;
  };
  onLinked: () => void;
}

export function LinkClassroomDialog({ isOpen, onOpenChange, classData, onLinked }: LinkClassroomDialogProps) {
  const { toast } = useToast();
  const [classrooms, setClassrooms] = React.useState<{ id: string; name: string; subject: string; section: string }[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isFetching, setIsFetching] = React.useState(false);

  // Load available classrooms when dialog opens
  React.useEffect(() => {
    if (!isOpen) return;
    setSelectedId(classData.currentClassroomId || '');
    (async () => {
      setIsFetching(true);
      try {
        const list = await getAllClassrooms();
        setClassrooms(list);
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load classrooms.' });
      } finally {
        setIsFetching(false);
      }
    })();
  }, [isOpen]);

  const handleLink = async () => {
    if (!selectedId) return;
    setIsLoading(true);
    const result = await linkClassroomToClass(classData.classId, selectedId);
    setIsLoading(false);
    if (result.success) {
      toast({ title: 'Linked!', description: `Classroom linked to ${classData.courseName} (Sec ${classData.section}).` });
      onLinked();
      onOpenChange(false);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const handleUnlink = async () => {
    setIsLoading(true);
    const result = await unlinkClassroomFromClass(classData.classId);
    setIsLoading(false);
    if (result.success) {
      toast({ title: 'Unlinked', description: `Classroom removed from ${classData.courseName}.` });
      onLinked();
      onOpenChange(false);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const isCurrentlyLinked = !!classData.currentClassroomId;
  const hasChanged = selectedId !== (classData.currentClassroomId || '');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 text-white">
              <Link2 className="h-4 w-4" />
            </div>
            Link Virtual Classroom
          </DialogTitle>
          <DialogDescription>
            Connect a virtual classroom to <strong>{classData.courseName}</strong> — Section {classData.section}.
            Students in this class will see the linked classroom.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current status */}
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Current Status</p>
            {isCurrentlyLinked ? (
              <div className="flex items-center gap-2">
                <LinkIcon className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-600">{classData.currentClassroomName || 'Linked'}</span>
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 border text-xs">Linked</Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Unlink className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">No classroom linked</span>
              </div>
            )}
          </div>

          {/* Classroom picker */}
          <div className="space-y-2">
            <Label>Select Virtual Classroom</Label>
            {isFetching ? (
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading classrooms…
              </div>
            ) : (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a classroom to link…" />
                </SelectTrigger>
                <SelectContent>
                  {classrooms.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-muted-foreground text-sm gap-2">
                      <BookOpen className="h-8 w-8 opacity-30" />
                      <p>No classrooms exist yet.</p>
                      <p className="text-xs">Teachers must create classrooms first.</p>
                    </div>
                  ) : (
                    classrooms.map(cr => (
                      <SelectItem key={cr.id} value={cr.id}>
                        <span className="font-medium">{cr.name}</span>
                        {cr.subject && <span className="text-muted-foreground ml-1">· {cr.subject}</span>}
                        {cr.section && <span className="text-muted-foreground ml-1">(Sec {cr.section})</span>}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Only virtual classrooms created by teachers are listed here.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isCurrentlyLinked && (
            <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 sm:mr-auto" onClick={handleUnlink} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              Remove Link
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleLink} disabled={!selectedId || !hasChanged || isLoading} className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {isCurrentlyLinked ? 'Update Link' : 'Link Classroom'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
