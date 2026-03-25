'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, FileText, Calendar, Upload, Paperclip, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    createAssignment,
    listAssignments,
    uploadFileToDrive,
    submitAssignment,
    type GoogleAssignment,
    type DriveFile,
} from '@/lib/google-classroom-api';

interface AssignmentsTabProps {
    courseId: string;
    userRole: 'teacher' | 'student' | 'admin';
    onViewSubmissions?: (assignmentId: string, title: string) => void;
}

// ─── Create Assignment Dialog (Teacher Only) ────────────

function CreateAssignmentDialog({
    isOpen,
    onOpenChange,
    courseId,
    onCreated,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    courseId: string;
    onCreated: () => void;
}) {
    const { toast } = useToast();
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [maxPoints, setMaxPoints] = React.useState('100');
    const [dueDate, setDueDate] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [files, setFiles] = React.useState<File[]>([]);
    const [uploadedFiles, setUploadedFiles] = React.useState<DriveFile[]>([]);
    const [isUploading, setIsUploading] = React.useState(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleUploadFiles = async () => {
        if (files.length === 0) return;
        setIsUploading(true);

        try {
            const uploaded: DriveFile[] = [];
            for (const file of files) {
                const result = await uploadFileToDrive(file);
                uploaded.push(result.file);
            }
            setUploadedFiles((prev) => [...prev, ...uploaded]);
            setFiles([]);
            toast({ title: 'Files Uploaded', description: `${uploaded.length} file(s) uploaded to Google Drive.` });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: err.message });
        } finally {
            setIsUploading(false);
        }
    };

    const handleCreate = async () => {
        if (!title.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Title is required.' });
            return;
        }

        setIsLoading(true);

        try {
            const payload: any = {
                title: title.trim(),
                description: description.trim() || undefined,
                maxPoints: parseInt(maxPoints) || 100,
            };

            // Parse due date
            if (dueDate) {
                const d = new Date(dueDate);
                payload.dueDate = {
                    year: d.getFullYear(),
                    month: d.getMonth() + 1,
                    day: d.getDate(),
                };
                payload.dueTime = { hours: 23, minutes: 59 };
            }

            // Attach uploaded Drive files
            if (uploadedFiles.length > 0) {
                payload.driveFileIds = uploadedFiles.map((f) => f.driveFileId);
            }

            await createAssignment(courseId, payload);
            toast({ title: 'Assignment Created', description: `"${title}" created successfully.` });
            onCreated();
            onOpenChange(false);

            // Reset form
            setTitle('');
            setDescription('');
            setMaxPoints('100');
            setDueDate('');
            setFiles([]);
            setUploadedFiles([]);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create Assignment</DialogTitle>
                    <DialogDescription>Create a new assignment for this Google Classroom.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment title" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions for students..." rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="maxPoints">Max Points</Label>
                            <Input id="maxPoints" type="number" value={maxPoints} onChange={(e) => setMaxPoints(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dueDate">Due Date</Label>
                            <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                        </div>
                    </div>

                    {/* File Uploads */}
                    <div className="space-y-2">
                        <Label>Attach Documents</Label>
                        <div className="flex gap-2">
                            <Input type="file" multiple onChange={handleFileSelect} className="flex-1" />
                            <Button variant="secondary" onClick={handleUploadFiles} disabled={files.length === 0 || isUploading} size="sm">
                                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            </Button>
                        </div>
                        {uploadedFiles.length > 0 && (
                            <div className="space-y-1 mt-2">
                                {uploadedFiles.map((f) => (
                                    <div key={f.driveFileId} className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Paperclip className="h-3 w-3" />
                                        <span className="truncate">{f.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isLoading}>Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleCreate} disabled={isLoading} className="gap-2">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {isLoading ? 'Creating...' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Student Submission Dialog ──────────────────────────

function SubmitAssignmentDialog({
    isOpen,
    onOpenChange,
    courseId,
    assignmentId,
    assignmentTitle,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    courseId: string;
    assignmentId: string;
    assignmentTitle: string;
}) {
    const { toast } = useToast();
    const [file, setFile] = React.useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleSubmit = async () => {
        if (!file) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a file to submit.' });
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Upload file to Drive
            const uploadResult = await uploadFileToDrive(file);
            const driveFileId = uploadResult.file.driveFileId;

            // 2. Submit to Google Classroom
            await submitAssignment(courseId, assignmentId, driveFileId);

            toast({ title: 'Submitted', description: `Your submission for "${assignmentTitle}" has been turned in.` });
            onOpenChange(false);
            setFile(null);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Submission Failed', description: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Submit Assignment</DialogTitle>
                    <DialogDescription>Upload your work for &ldquo;{assignmentTitle}&rdquo;</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Upload Your Work</Label>
                        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    </div>
                    {file && (
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Paperclip className="h-3 w-3" />
                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isSubmitting}>Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !file} className="gap-2">
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {isSubmitting ? 'Submitting...' : 'Submit & Turn In'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Assignments Tab ───────────────────────────────

export function AssignmentsTab({ courseId, userRole, onViewSubmissions }: AssignmentsTabProps) {
    const { toast } = useToast();
    const [assignments, setAssignments] = React.useState<GoogleAssignment[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isCreateOpen, setIsCreateOpen] = React.useState(false);
    const [submitTarget, setSubmitTarget] = React.useState<{ id: string; title: string } | null>(null);

    const loadAssignments = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await listAssignments(courseId);
            setAssignments(data.assignments || []);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setIsLoading(false);
        }
    }, [courseId, toast]);

    React.useEffect(() => {
        loadAssignments();
    }, [loadAssignments]);

    const formatDueDate = (assignment: GoogleAssignment) => {
        if (!assignment.dueDate) return 'No due date';
        const { year, month, day } = assignment.dueDate;
        return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="space-y-6">
            {/* Teacher: Create button */}
            {userRole === 'teacher' && (
                <div className="flex justify-end">
                    <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
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
                    <p className="text-xs text-muted-foreground/70 mt-1">Check back later for new assignments.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {assignments.map((assignment) => (
                        <Card key={assignment.id} className="shadow-sm border-border/50">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-lg">{assignment.title}</CardTitle>
                                        <CardDescription className="flex items-center gap-2 mt-1">
                                            <Calendar className="h-3 w-3" />
                                            Due: {formatDueDate(assignment)}
                                            {assignment.maxPoints && ` • ${assignment.maxPoints} points`}
                                        </CardDescription>
                                    </div>
                                    {assignment.alternateLink && (
                                        <Button variant="ghost" size="icon" asChild>
                                            <a href={assignment.alternateLink} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            {assignment.description && (
                                <CardContent>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{assignment.description}</p>
                                    {/* Show materials / attachments */}
                                    {assignment.materials && assignment.materials.length > 0 && (
                                        <div className="mt-3 space-y-1">
                                            <p className="text-xs font-medium">Attachments:</p>
                                            {assignment.materials.map((mat: any, idx: number) => (
                                                <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Paperclip className="h-3 w-3" />
                                                    {mat.driveFile?.driveFile?.title || mat.link?.title || 'File'}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            )}
                            <CardFooter className="gap-2">
                                {/* Student: Submit button */}
                                {userRole === 'student' && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setSubmitTarget({ id: assignment.id, title: assignment.title })}
                                        className="gap-2"
                                    >
                                        <Upload className="h-3 w-3" /> Submit
                                    </Button>
                                )}
                                {/* Teacher: View Submissions */}
                                {userRole === 'teacher' && onViewSubmissions && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onViewSubmissions(assignment.id, assignment.title)}
                                        className="gap-2"
                                    >
                                        <FileText className="h-3 w-3" /> View Submissions
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Dialogs */}
            {userRole === 'teacher' && (
                <CreateAssignmentDialog
                    isOpen={isCreateOpen}
                    onOpenChange={setIsCreateOpen}
                    courseId={courseId}
                    onCreated={loadAssignments}
                />
            )}

            {submitTarget && (
                <SubmitAssignmentDialog
                    isOpen={!!submitTarget}
                    onOpenChange={(open) => !open && setSubmitTarget(null)}
                    courseId={courseId}
                    assignmentId={submitTarget.id}
                    assignmentTitle={submitTarget.title}
                />
            )}
        </div>
    );
}
