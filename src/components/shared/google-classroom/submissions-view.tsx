'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, FileText, ExternalLink, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    listSubmissions,
    getDriveFileInfo,
    type GoogleSubmission,
} from '@/lib/google-classroom-api';

interface SubmissionsViewProps {
    courseId: string;
    assignmentId: string;
    assignmentTitle: string;
    onBack: () => void;
}

function getSubmissionStateBadge(state: string) {
    switch (state) {
        case 'TURNED_IN':
            return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Turned In</Badge>;
        case 'RETURNED':
            return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Returned</Badge>;
        case 'RECLAIMED_BY_STUDENT':
            return <Badge variant="secondary">Reclaimed</Badge>;
        case 'NEW':
            return <Badge variant="outline">Not Submitted</Badge>;
        case 'CREATED':
            return <Badge variant="outline">Created</Badge>;
        default:
            return <Badge variant="outline">{state}</Badge>;
    }
}

export function SubmissionsView({ courseId, assignmentId, assignmentTitle, onBack }: SubmissionsViewProps) {
    const { toast } = useToast();
    const [submissions, setSubmissions] = React.useState<GoogleSubmission[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await listSubmissions(courseId, assignmentId);
                setSubmissions(data.submissions || []);
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'Error', description: err.message });
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [courseId, assignmentId, toast]);

    const handleDownload = async (fileId: string) => {
        try {
            const data = await getDriveFileInfo(fileId);
            if (data.file?.webViewLink) {
                window.open(data.file.webViewLink, '_blank');
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not get file download link.' });
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3" role="status">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading submissions...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back to Assignments
                </Button>
                <div>
                    <h3 className="font-semibold">Submissions for &ldquo;{assignmentTitle}&rdquo;</h3>
                    <p className="text-sm text-muted-foreground">{submissions.length} submission(s)</p>
                </div>
            </div>

            {submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                        <FileText className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No submissions yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Students haven&apos;t submitted work for this assignment.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {submissions.map((sub) => (
                        <Card key={sub.id} className="shadow-sm border-border/50">
                            <CardContent className="pt-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium">Student: {sub.userId}</p>
                                        <div className="flex items-center gap-2">
                                            {getSubmissionStateBadge(sub.state)}
                                            {sub.assignedGrade !== undefined && sub.assignedGrade !== null && (
                                                <span className="text-sm text-muted-foreground">
                                                    Grade: {sub.assignedGrade}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Updated: {new Date(sub.updateTime).toLocaleString()}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* View on Google Classroom */}
                                        {sub.alternateLink && (
                                            <Button variant="ghost" size="icon" asChild>
                                                <a href={sub.alternateLink} target="_blank" rel="noopener noreferrer" title="Open in Google Classroom">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Attachments */}
                                {sub.assignmentSubmission?.attachments && sub.assignmentSubmission.attachments.length > 0 && (
                                    <div className="mt-3 border-t pt-3 space-y-2">
                                        <p className="text-xs font-medium">Submitted Files:</p>
                                        {sub.assignmentSubmission.attachments.map((att, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                    <span className="truncate max-w-[200px]">
                                                        {att.driveFile?.title || 'Untitled'}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1">
                                                    {att.driveFile?.alternateLink && (
                                                        <Button variant="ghost" size="sm" asChild>
                                                            <a href={att.driveFile.alternateLink} target="_blank" rel="noopener noreferrer">
                                                                <ExternalLink className="h-3 w-3 mr-1" /> View
                                                            </a>
                                                        </Button>
                                                    )}
                                                    {att.driveFile?.id && (
                                                        <Button variant="ghost" size="sm" onClick={() => handleDownload(att.driveFile!.id)}>
                                                            <Download className="h-3 w-3 mr-1" /> Download
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
