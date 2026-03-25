'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Megaphone, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    createAnnouncement,
    listAnnouncements,
    type GoogleAnnouncement,
} from '@/lib/google-classroom-api';

interface AnnouncementsTabProps {
    courseId: string;
    userRole: 'teacher' | 'student' | 'admin';
}

export function AnnouncementsTab({ courseId, userRole }: AnnouncementsTabProps) {
    const { toast } = useToast();
    const [announcements, setAnnouncements] = React.useState<GoogleAnnouncement[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [newText, setNewText] = React.useState('');
    const [isPosting, setIsPosting] = React.useState(false);

    const loadAnnouncements = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await listAnnouncements(courseId);
            setAnnouncements(data.announcements || []);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setIsLoading(false);
        }
    }, [courseId, toast]);

    React.useEffect(() => {
        loadAnnouncements();
    }, [loadAnnouncements]);

    const handlePost = async () => {
        if (!newText.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Announcement text cannot be empty.' });
            return;
        }

        setIsPosting(true);
        try {
            await createAnnouncement(courseId, newText.trim());
            toast({ title: 'Posted', description: 'Announcement posted successfully.' });
            setNewText('');
            loadAnnouncements();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Post Announcement – Teacher and Student can post (messages visible to all) */}
            <Card className="shadow-sm border-border/50">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Megaphone className="h-5 w-5" />
                        {userRole === 'teacher' ? 'Post Announcement' : 'Post Message'}
                    </CardTitle>
                    <CardDescription>
                        {userRole === 'teacher'
                            ? 'Post an announcement visible to all enrolled students.'
                            : 'Post a message visible to the teacher and all classmates.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <Textarea
                            placeholder="Write your announcement or message here..."
                            value={newText}
                            onChange={(e) => setNewText(e.target.value)}
                            rows={3}
                        />
                        <Button onClick={handlePost} disabled={isPosting || !newText.trim()} className="gap-2">
                            {isPosting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            {isPosting ? 'Posting...' : 'Post'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Announcement Feed */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3" role="status">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Loading announcements...</span>
                </div>
            ) : announcements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                        <Megaphone className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No announcements yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Check back later for updates.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {announcements.map((ann) => (
                        <Card key={ann.id} className="shadow-sm border-border/50">
                            <CardContent className="pt-4">
                                <p className="whitespace-pre-wrap">{ann.text}</p>
                                <p className="text-xs text-muted-foreground mt-3">
                                    {new Date(ann.creationTime).toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
