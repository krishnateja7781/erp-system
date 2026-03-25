'use client';

import * as React from 'react';
import { supabase } from '@/lib/supabase-client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, FileText, Calendar, ArrowLeft, CheckCircle2, Clock, Send, Upload, Paperclip, Download, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { validateFile, uploadSubmissionFile } from '@/lib/upload-submission';
import {
  createAssignment,
  listAssignments,
  deleteAssignment,
  submitAssignment,
  listSubmissions,
  getMySubmission,
  gradeSubmission,
  type ClassroomAssignment,
  type ClassroomSubmission,
} from '@/actions/classroom-post-actions';

interface ClassworkTabProps {
  classroomId: string;
  userId: string;
  userName: string;
  userRole: 'teacher' | 'student' | 'admin';
}

// ─── Create Assignment Dialog (Teacher Only) ────────────

function CreateAssignmentDialog({
  isOpen,
  onOpenChange,
  classroomId,
  userId,
  userName,
  onCreated,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  classroomId: string;
  userId: string;
  userName: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [maxPoints, setMaxPoints] = React.useState('100');
  const [dueDate, setDueDate] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Title is required.' });
      return;
    }
    setIsLoading(true);
    try {
      const result = await createAssignment(
        classroomId,
        userId,
        userName,
        title.trim(),
        description.trim(),
        dueDate || null,
        parseInt(maxPoints) || 100
      );
      if (result.success) {
        toast({ title: 'Assignment Created', description: `"${title}" created successfully.` });
        onCreated();
        onOpenChange(false);
        setTitle('');
        setDescription('');
        setMaxPoints('100');
        setDueDate('');
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create assignment.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Create Assignment</DialogTitle>
          <DialogDescription>Create a new assignment for this classroom.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-sm font-medium">Title <span className="text-destructive">*</span></Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment title" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-medium">Description / Instructions</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions for students..." rows={3} className="resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="maxPoints" className="text-sm font-medium">Max Points</Label>
              <Input id="maxPoints" type="number" value={maxPoints} onChange={(e) => setMaxPoints(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate" className="text-sm font-medium">Due Date</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-10" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleCreate} disabled={isLoading} className="gap-2 shadow-sm">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isLoading ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Submit Assignment Dialog (Student) ─────────────────

function SubmitDialog({
  isOpen,
  onOpenChange,
  assignment,
  classroomId,
  userId,
  userName,
  existingSubmission,
  onSubmitted,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: ClassroomAssignment;
  classroomId: string;
  userId: string;
  userName: string;
  existingSubmission: ClassroomSubmission | null;
  onSubmitted: () => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (selected) {
      const err = validateFile(selected);
      if (err) {
        toast({ variant: 'destructive', title: 'Invalid file', description: err });
        setFile(null);
        return;
      }
    }
    setFile(selected);
  };

  const handleSubmit = async () => {
    if (!file && !existingSubmission?.fileUrl) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a document to submit.' });
      return;
    }
    setIsSubmitting(true);
    try {
      let fileName = existingSubmission?.fileName || null;
      let fileUrl = existingSubmission?.fileUrl || null;

      // Upload new file if selected
      if (file) {
        const uploaded = await uploadSubmissionFile(file, classroomId, assignment.id, userId);
        fileName = uploaded.fileName;
        fileUrl = uploaded.fileUrl;
      }

      const result = await submitAssignment(
        assignment.id, classroomId, userId, userName, '', fileName, fileUrl
      );
      if (result.success) {
        toast({ title: 'Submitted', description: existingSubmission ? 'Submission updated.' : 'Assignment submitted successfully.' });
        onSubmitted();
        onOpenChange(false);
        setFile(null);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Submission failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">{existingSubmission ? 'Update Submission' : 'Submit Assignment'}</DialogTitle>
          <DialogDescription>&ldquo;{assignment.title}&rdquo; &middot; {assignment.maxPoints} points</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {assignment.description && (
            <div className="bg-muted/50 border border-border/50 p-3.5 rounded-lg text-sm">
              <p className="font-medium mb-1 text-xs uppercase tracking-wider text-muted-foreground">Instructions</p>
              <p className="whitespace-pre-wrap leading-relaxed">{assignment.description}</p>
            </div>
          )}

          {/* Existing submission info */}
          {existingSubmission?.fileUrl && (
            <div className="flex flex-col gap-2.5 text-sm bg-muted/30 border border-border/50 p-3.5 rounded-lg">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary/70" />
                <span className="truncate flex-1">{existingSubmission.fileName || 'Submitted file'}</span>
                {existingSubmission.grade != null && (
                  <Badge variant="default" className="text-xs">
                    Grade: {existingSubmission.grade}/{assignment.maxPoints}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a href={`https://docs.google.com/viewer?url=${encodeURIComponent(existingSubmission.fileUrl)}&embedded=true`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="h-7 gap-1">
                    <Eye className="h-3 w-3" /> View Document
                  </Button>
                </a>
                <a href={existingSubmission.fileUrl} download={existingSubmission.fileName || 'submission'}>
                  <Button variant="ghost" size="sm" className="h-7 gap-1">
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </a>
              </div>
            </div>
          )}

          {/* File upload */}
          <div className="space-y-2">
            <Label>Upload Document (PDF, Word, Excel — max 10 MB)</Label>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all duration-200"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload document"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <Paperclip className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to select a file</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, PowerPoint, Text, Images</p>
                </div>
              )}
            </div>
          </div>

          {existingSubmission && (
            <p className="text-xs text-muted-foreground">
              Previously submitted on {new Date(existingSubmission.submittedAt).toLocaleString()}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting || (!file && !existingSubmission?.fileUrl)} className="gap-2 shadow-sm">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isSubmitting ? 'Uploading...' : existingSubmission ? 'Update' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Submissions View (Teacher) ─────────────────────────

function SubmissionsPanel({
  assignment,
  onBack,
}: {
  assignment: ClassroomAssignment;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [submissions, setSubmissions] = React.useState<ClassroomSubmission[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [grading, setGrading] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const data = await listSubmissions(assignment.id);
    setSubmissions(data);
    const grades: Record<string, string> = {};
    data.forEach((s) => { grades[s.id] = s.grade != null ? String(s.grade) : ''; });
    setGrading(grades);
    setIsLoading(false);
  }, [assignment.id]);

  React.useEffect(() => { load(); }, [load]);

  const handleGrade = async (submissionId: string) => {
    const val = parseInt(grading[submissionId]);
    if (isNaN(val) || val < 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Enter a valid grade.' });
      return;
    }
    const result = await gradeSubmission(submissionId, val);
    if (result.success) {
      toast({ title: 'Graded', description: 'Grade saved.' });
      load();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base truncate">Submissions for &ldquo;{assignment.title}&rdquo;</h3>
        </div>
        <Badge variant="secondary" className="flex-shrink-0">{submissions.length} submitted</Badge>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading submissions...</span>
        </div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
            <FileText className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No submissions yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Students haven&apos;t submitted work for this assignment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <Card key={sub.id} className="shadow-sm border-border/50">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-medium text-sm">{sub.studentName}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(sub.submittedAt).toLocaleString()}
                      </span>
                      {sub.grade != null ? (
                        <Badge variant="default" className="text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {sub.grade}/{assignment.maxPoints}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Clock className="h-3 w-3" /> Not graded
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 bg-muted/30 border border-border/50 p-3 rounded-lg">
                      {sub.fileUrl ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Paperclip className="h-4 w-4 text-primary/70" />
                            <span className="truncate">{sub.fileName || 'Submitted file'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a href={`https://docs.google.com/viewer?url=${encodeURIComponent(sub.fileUrl)}&embedded=true`} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm" className="h-7 gap-1">
                                <Eye className="h-3 w-3" /> View Document
                              </Button>
                            </a>
                            <a href={sub.fileUrl} download={sub.fileName || 'submission'}>
                              <Button variant="ghost" size="sm" className="h-7 gap-1">
                                <Download className="h-3 w-3" /> Download
                              </Button>
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{sub.content || 'No content'}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      className="w-20 h-8"
                      placeholder="Grade"
                      value={grading[sub.id] ?? ''}
                      onChange={(e) => setGrading((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                      min={0}
                      max={assignment.maxPoints}
                      aria-label={`Grade for ${sub.studentName}`}
                    />
                    <span className="text-xs text-muted-foreground font-mono">/{assignment.maxPoints}</span>
                    <Button size="sm" variant="outline" onClick={() => handleGrade(sub.id)} className="shadow-sm">
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Classwork Tab ─────────────────────────────────

export function ClassworkTab({ classroomId, userId, userName, userRole }: ClassworkTabProps) {
  const { toast } = useToast();
  const [assignments, setAssignments] = React.useState<ClassroomAssignment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [viewSubmissions, setViewSubmissions] = React.useState<ClassroomAssignment | null>(null);
  const [submitTarget, setSubmitTarget] = React.useState<ClassroomAssignment | null>(null);
  const [mySubmissions, setMySubmissions] = React.useState<Record<string, ClassroomSubmission | null>>({});

  const load = React.useCallback(async () => {
    try {
      const data = await listAssignments(classroomId);
      setAssignments(data);

      // For students, fetch their submission status
      if (userRole === 'student') {
        const subs: Record<string, ClassroomSubmission | null> = {};
        await Promise.all(
          data.map(async (a) => {
            subs[a.id] = await getMySubmission(a.id, userId);
          })
        );
        setMySubmissions(subs);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load assignments.' });
    }
  }, [classroomId, userId, userRole, toast]);

  // Initial load
  React.useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  // Polling — uses direct Supabase client reads (not server actions) to avoid
  // overwhelming the Next.js server with POST requests every few seconds.
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('classroom_assignments')
          .select('*')
          .eq('classroomId', classroomId)
          .order('createdAt', { ascending: false });
        if (!data) return;
        setAssignments((prev) => {
          const prevIds = prev.map((a) => a.id).join(',');
          const newIds = data.map((a: any) => a.id).join(',');
          if (prevIds === newIds) return prev;
          return data as ClassroomAssignment[];
        });

        if (userRole === 'student') {
          const subs: Record<string, ClassroomSubmission | null> = {};
          await Promise.all(
            (data as ClassroomAssignment[]).map(async (a) => {
              const { data: sub } = await supabase
                .from('classroom_submissions')
                .select('*')
                .eq('assignmentId', a.id)
                .eq('studentId', userId)
                .maybeSingle();
              subs[a.id] = sub as ClassroomSubmission | null;
            })
          );
          setMySubmissions(subs);
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [classroomId, userId, userRole]);

  const handleDelete = async (assignment: ClassroomAssignment) => {
    const result = await deleteAssignment(assignment.id, userId);
    if (result.success) {
      setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
      toast({ title: 'Deleted', description: `"${assignment.title}" deleted.` });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  // If viewing submissions for an assignment
  if (viewSubmissions) {
    return <SubmissionsPanel assignment={viewSubmissions} onBack={() => setViewSubmissions(null)} />;
  }

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return 'No due date';
    return new Date(dueDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Teacher: Create button */}
      {userRole === 'teacher' && (
        <div className="flex justify-end">
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" /> Create Assignment
          </Button>
        </div>
      )}

      {/* Assignment List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading assignments...</span>
        </div>
      ) : assignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No assignments posted yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {userRole === 'teacher' ? 'Create your first assignment to get started.' : 'Check back later for new assignments.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => {
            const mySub = mySubmissions[assignment.id];
            return (
              <Card key={assignment.id} className="shadow-sm border-border/50 hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold">{assignment.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {formatDueDate(assignment.dueDate)}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-5 font-mono">{assignment.maxPoints} pts</Badge>
                        {isOverdue(assignment.dueDate) && <Badge variant="destructive" className="text-[10px] h-5">Overdue</Badge>}
                        <span className="text-muted-foreground/70">by {assignment.teacherName}</span>
                      </CardDescription>
                    </div>
                    {/* Student submission status badge */}
                    {userRole === 'student' && mySub && (
                      <Badge variant={mySub.grade != null ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
                        {mySub.grade != null
                          ? `Graded: ${mySub.grade}/${assignment.maxPoints}`
                          : 'Submitted'}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                {assignment.description && (
                  <CardContent className="pb-2">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{assignment.description}</p>
                  </CardContent>
                )}
                <CardFooter className="gap-2 pt-2">
                  {/* Student: Submit / Resubmit */}
                  {userRole === 'student' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSubmitTarget(assignment)}
                      className="gap-1.5"
                    >
                      <Send className="h-3 w-3" />
                      {mySub ? 'View / Update' : 'Submit'}
                    </Button>
                  )}
                  {/* Teacher: View Submissions + Delete */}
                  {userRole === 'teacher' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setViewSubmissions(assignment)} className="gap-1.5">
                        <FileText className="h-3 w-3" /> View Submissions
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(assignment)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      {userRole === 'teacher' && (
        <CreateAssignmentDialog
          isOpen={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          classroomId={classroomId}
          userId={userId}
          userName={userName}
          onCreated={load}
        />
      )}

      {submitTarget && (
        <SubmitDialog
          isOpen={!!submitTarget}
          onOpenChange={(open) => !open && setSubmitTarget(null)}
          assignment={submitTarget}
          classroomId={classroomId}
          userId={userId}
          userName={userName}
          existingSubmission={mySubmissions[submitTarget.id] || null}
          onSubmitted={load}
        />
      )}
    </div>
  );
}
