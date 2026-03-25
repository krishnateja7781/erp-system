
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, AlertTriangle, ArrowLeft, Users, Copy, X, Megaphone, FileText, BookOpen, Crown, GraduationCap, StickyNote } from 'lucide-react';
import { getClassroom, getClassroomMembers } from '@/actions/classroom-actions';
import type { Classroom } from '@/lib/types';
import type { AppUser } from '@/hooks/useAuthProtection';
import { StreamTab, ClassworkTab, NotesTab } from '@/components/shared/classroom';
import { cn } from '@/lib/utils';

// ─── Classroom Header Bar ───────────────────────────────

function ClassroomHeader({
    classroom,
    userRole,
    onMembersClick,
    isMembersOpen,
}: {
    classroom: Classroom;
    userRole: 'teacher' | 'student' | 'admin';
    onMembersClick: () => void;
    isMembersOpen: boolean;
}) {
    const { toast } = useToast();

    const copyInviteCode = () => {
        navigator.clipboard.writeText(classroom.inviteCode ?? '');
        toast({ title: 'Copied', description: 'Invite code copied to clipboard.' });
    };

    return (
        <div className="w-full rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-[1px] shadow-xl shadow-purple-500/10">
            <div className="rounded-2xl bg-background/95 backdrop-blur-xl dark:bg-background/80">
                <div className="flex items-center px-4 sm:px-5 py-3.5 gap-3">
                    {/* Left: Class name */}
                    <div className="flex items-center gap-3 shrink-0 min-w-0">
                        <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
                            {classroom.name}
                        </h1>
                    </div>

                    {/* Center: Subject name */}
                    <div className="flex-1 text-center min-w-0">
                        {classroom.subject && (
                            <span className="text-sm sm:text-base font-medium text-muted-foreground truncate block">
                                {classroom.subject}
                            </span>
                        )}
                    </div>

                    {/* Right: Invite code (teacher) + Members icon */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {userRole === 'teacher' && (
                            <div className="hidden md:flex items-center gap-2">
                                <code className="text-xs bg-muted px-2.5 py-1 rounded-lg font-mono text-muted-foreground">{classroom.inviteCode}</code>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyInviteCode}>
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                        <button
                            onClick={onMembersClick}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer",
                                isMembersOpen
                                    ? "bg-violet-500/20 border-violet-500/40 shadow-sm shadow-violet-500/10"
                                    : "bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20"
                            )}
                        >
                            <Users className="h-4 w-4 text-violet-500" />
                            <span className="text-sm font-medium text-violet-600 dark:text-violet-400">{(classroom.memberUids ?? []).length}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Members Side Panel (Left) ──────────────────────────

function MembersPanel({
    isOpen,
    onClose,
    classroom,
}: {
    isOpen: boolean;
    onClose: () => void;
    classroom: Classroom;
}) {
    const [members, setMembers] = React.useState<{ uid: string; name: string; email: string; role: string }[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        if (!isOpen) return;
        setIsLoading(true);
        getClassroomMembers(classroom.memberUids ?? []).then(data => {
            setMembers(data);
            setIsLoading(false);
        });
    }, [isOpen, classroom.memberUids]);

    const owner = members.find(m => m.uid === classroom.ownerId);
    const others = members.filter(m => m.uid !== classroom.ownerId);

    return (
        <div
            className={cn(
                "shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
                isOpen ? "w-72 sm:w-80 opacity-100" : "w-0 opacity-0"
            )}
        >
            <div className="w-72 sm:w-80 h-full rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl dark:bg-background/80 shadow-lg flex flex-col">
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-violet-500" />
                        <span className="text-sm font-semibold text-foreground">Members</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{(classroom.memberUids ?? []).length}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Panel body */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {/* Teacher / Owner first */}
                            {owner && (
                                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/15">
                                    <Avatar className="h-8 w-8 ring-2 ring-violet-500/30">
                                        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-[10px] font-bold">
                                            {owner.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate">{owner.name}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">{owner.email}</p>
                                    </div>
                                    <Crown className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                                </div>
                            )}

                            {/* Other members */}
                            {others.map(member => (
                                <div key={member.uid} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-colors">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="bg-muted text-[10px] font-bold">
                                            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
                                    </div>
                                    <GraduationCap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                </div>
                            ))}

                            {others.length === 0 && !owner && (
                                <p className="text-center text-sm text-muted-foreground py-6">No members found.</p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Classroom Detail View ─────────────────────────

function ClassroomDetailView({
    classroom,
    userRole,
    userId,
    userName,
}: {
    classroom: Classroom;
    userRole: 'teacher' | 'student' | 'admin';
    userId: string;
    userName: string;
}) {
    const [activeTab, setActiveTab] = React.useState('stream');
    const [isMembersOpen, setIsMembersOpen] = React.useState(false);

    return (
        <div className="space-y-6">
            <ClassroomHeader
                classroom={classroom}
                userRole={userRole}
                onMembersClick={() => setIsMembersOpen(prev => !prev)}
                isMembersOpen={isMembersOpen}
            />

            <div className="flex gap-4">
                {/* Left: Main content (tabs) */}
                <div className="flex-1 min-w-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="w-full justify-center">
                            <TabsTrigger value="stream" className="gap-2">
                                <Megaphone className="h-4 w-4" /> Stream
                            </TabsTrigger>
                            <TabsTrigger value="classwork" className="gap-2">
                                <FileText className="h-4 w-4" /> Classwork
                            </TabsTrigger>
                            <TabsTrigger value="notes" className="gap-2">
                                <StickyNote className="h-4 w-4" /> Notes
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="stream" className="mt-6">
                            <StreamTab
                                classroomId={classroom.id}
                                userId={userId}
                                userName={userName}
                                userRole={userRole}
                            />
                        </TabsContent>

                        <TabsContent value="classwork" className="mt-6">
                            <ClassworkTab
                                classroomId={classroom.id}
                                userId={userId}
                                userName={userName}
                                userRole={userRole}
                            />
                        </TabsContent>

                        <TabsContent value="notes" className="mt-6">
                            <NotesTab
                                classroomId={classroom.id}
                                userId={userId}
                                userName={userName}
                                userRole={userRole}
                            />
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right: Members side panel */}
                <MembersPanel
                    isOpen={isMembersOpen}
                    onClose={() => setIsMembersOpen(false)}
                    classroom={classroom}
                />
            </div>
        </div>
    );
}

// ─── Page Component ─────────────────────────────────────

export default function ClassroomDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const [classroom, setClassroom] = React.useState<Classroom | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [currentUser, setCurrentUser] = React.useState<AppUser | null>(null);

    const classroomId = params.classroomId as string;

    React.useEffect(() => {
        const userStr = localStorage.getItem('loggedInUser');
        if (userStr) {
            setCurrentUser(JSON.parse(userStr));
        } else {
            setError('You must be logged in to view this page.');
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        if (!currentUser || !classroomId) return;

        const loadClassroom = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const roomData = await getClassroom(classroomId);
                if (!roomData) throw new Error('Classroom not found.');
                if (!roomData.memberUids?.includes(currentUser.uid)) throw new Error('You are not a member of this classroom.');
                setClassroom(roomData);
            } catch (err: any) {
                setError(err.message || 'An unexpected error occurred.');
                toast({ variant: 'destructive', title: 'Error', description: err.message });
            } finally {
                setIsLoading(false);
            }
        };

        loadClassroom();
    }, [classroomId, currentUser, toast]);

    if (isLoading) {
        return <div className="flex flex-col justify-center items-center h-64 gap-3"><div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" /><span className="text-muted-foreground font-medium">Loading classroom...</span></div>;
    }

    if (error) {
        return (
            <div className="text-center text-destructive py-10">
                <AlertTriangle className="mx-auto h-12 w-12" />
                <h2 className="mt-4 text-lg font-semibold">Error</h2>
                <p className="text-sm">{error}</p>
                <Button onClick={() => router.push('/classrooms')} className="mt-4" variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go to My Classrooms
                </Button>
            </div>
        );
    }

    if (!classroom) {
        return (
            <div className="empty-state py-10">
                <div className="empty-state-icon"><BookOpen className="h-8 w-8 text-muted-foreground/50" /></div>
                <p className="empty-state-title">Not Found</p>
                <p className="empty-state-text">Classroom data could not be loaded.</p>
            </div>
        );
    }

    const userRole = (currentUser?.role || 'student') as 'teacher' | 'student' | 'admin';
    const userName = currentUser?.name || currentUser?.email || 'Unknown';

    return (
        <div className="space-y-6 animate-fade-in">
            <ClassroomDetailView
                classroom={classroom}
                userRole={userRole}
                userId={currentUser!.uid}
                userName={userName}
            />
        </div>
    );
}
