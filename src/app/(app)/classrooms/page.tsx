
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from '@/hooks/useAuthProtection';
import { BookOpen, Loader2, Plus, UserPlus, MoreVertical, Info, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createClassroom, getMyClassrooms, joinClassroom, deleteClassroom } from '@/actions/classroom-actions';
import type { Classroom } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';


function CreateClassDialog({ isOpen, onOpenChange, onClassroomCreated }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onClassroomCreated: () => void }) {
    const { toast } = useToast();
    const [name, setName] = React.useState('');
    const [section, setSection] = React.useState('');
    const [subject, setSubject] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<AppUser | null>(null);

    React.useEffect(() => {
      const user = localStorage.getItem('loggedInUser');
      if (user) setCurrentUser(JSON.parse(user));
    }, [isOpen]);

    const handleCreate = async () => {
        if (!name.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Classroom name is required.' });
            return;
        }
        if (!currentUser) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not identify the user.' });
            return;
        }
        setIsLoading(true);
        const result = await createClassroom({ name, section, subject, ownerId: currentUser.uid, ownerName: currentUser.name });

        if (result.success) {
            toast({ title: 'Success', description: 'Classroom created successfully.' });
            onClassroomCreated();
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    };
    
    React.useEffect(() => {
        if (!isOpen) {
            setName(''); setSection(''); setSubject('');
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Create New Classroom</DialogTitle><DialogDescription>Enter the details for your new class.</DialogDescription></DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label htmlFor="name">Class Name *</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., III Year CSE - A" /></div>
                    <div className="space-y-2"><Label htmlFor="section">Section</Label><Input id="section" value={section} onChange={e => setSection(e.target.value)} placeholder="e.g., A" /></div>
                    <div className="space-y-2"><Label htmlFor="subject">Subject</Label><Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g., Database Management Systems" /></div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                    <Button onClick={handleCreate} disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function JoinClassDialog({ isOpen, onOpenChange, onClassroomJoined }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onClassroomJoined: () => void }) {
    const { toast } = useToast();
    const [inviteCode, setInviteCode] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<AppUser | null>(null);

    React.useEffect(() => {
      const user = localStorage.getItem('loggedInUser');
      if (user) setCurrentUser(JSON.parse(user));
    }, [isOpen]);

    const handleJoin = async () => {
        if (!inviteCode.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Invite code is required.' });
            return;
        }
         if (!currentUser) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not identify the user.' });
            return;
        }
        setIsLoading(true);
        const result = await joinClassroom({ inviteCode, studentUid: currentUser.uid });
        if (result.success) {
            toast({ title: 'Success', description: `Successfully joined classroom.` });
            onClassroomJoined();
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Join Classroom</DialogTitle><DialogDescription>Enter the invite code provided by your teacher.</DialogDescription></DialogHeader>
                <div className="py-4">
                    <Label htmlFor="code">Class Invite Code</Label>
                    <Input id="code" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Enter code" />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                    <Button onClick={handleJoin} disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Joining...</> : 'Join'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function InfoDialog({ isOpen, onOpenChange, classroom }: { isOpen: boolean, onOpenChange: (open: boolean) => void, classroom: Classroom | null }) {
    if (!classroom) return null;
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{classroom.name}</DialogTitle><DialogDescription>Classroom Details</DialogDescription></DialogHeader>
                <div className="space-y-2 py-4 text-sm">
                    <p><strong>Owner:</strong> {classroom.ownerName}</p>
                    <p><strong>Created:</strong> {classroom.createdAt ? formatDate(classroom.createdAt, { dateStyle: 'full' }) : 'N/A'}</p>
                    <p><strong>Participants:</strong> {classroom.memberUids?.length || 0}</p>
                    <p><strong>Invite Code:</strong> <span className="font-mono bg-muted p-1 rounded">{classroom.inviteCode}</span></p>
                    <p><strong>Status:</strong> <span className="text-green-600 font-semibold">Active</span></p>
                </div>
                <DialogFooter><DialogClose asChild><Button>Close</Button></DialogClose></DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


export default function ClassroomsPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [classrooms, setClassrooms] = React.useState<Classroom[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<AppUser | null>(null);
    const [isCreateOpen, setIsCreateOpen] = React.useState(false);
    const [isJoinOpen, setIsJoinOpen] = React.useState(false);
    const [isInfoOpen, setIsInfoOpen] = React.useState(false);
    const [selectedRoom, setSelectedRoom] = React.useState<Classroom | null>(null);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        const userStr = localStorage.getItem('loggedInUser');
        if (!userStr) {
            toast({ variant: "destructive", title: "Error", description: "You are not logged in." });
            setIsLoading(false);
            return;
        }
        const user = JSON.parse(userStr);
        setCurrentUser(user);
        try {
            const data = await getMyClassrooms(user.uid);
            setClassrooms(data);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
        setIsLoading(false);
    }, [toast]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);
    
    const isTeacher = currentUser?.role === 'teacher';

    const handleInfoClick = (room: Classroom) => {
        setSelectedRoom(room);
        setIsInfoOpen(true);
    };

    const handleDeleteClick = async (room: Classroom) => {
        if (!currentUser) return;
        const result = await deleteClassroom(room.id, currentUser.uid);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            loadData();
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    };

    const handleBackClick = () => {
        if (currentUser) {
            router.push(`/${currentUser.role}/dashboard`);
        } else {
            router.push('/login'); // Fallback
        }
    };

    if (isLoading) {
        return <div className="flex flex-col justify-center items-center h-64 gap-3"><div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" /><span className="text-muted-foreground font-medium">Loading your classrooms...</span></div>;
    }

    return (
        <>
            <div className="space-y-8 animate-fade-in">
                 <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-purple-500 p-6 mb-6 text-white shadow-lg">
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={handleBackClick} aria-label="Back" className="rounded-xl border-white/30 text-white hover:bg-white/10 bg-white/10 backdrop-blur-sm">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                          <h1 className="text-2xl font-bold tracking-tight">My Classrooms</h1>
                          <p className="text-white/70 text-sm mt-1">View and manage your classroom spaces</p>
                        </div>
                    </div>
                    {isTeacher ? (
                        <Button onClick={() => setIsCreateOpen(true)} className="border-white/30 text-white hover:bg-white/10 bg-white/10 backdrop-blur-sm"><Plus className="mr-2 h-4 w-4" /> Create Class</Button>
                    ) : (
                        <Button onClick={() => setIsJoinOpen(true)} className="border-white/30 text-white hover:bg-white/10 bg-white/10 backdrop-blur-sm"><UserPlus className="mr-2 h-4 w-4" /> Join Class</Button>
                    )}
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {classrooms.map(room => (
                        <Card key={room.id} className="flex flex-col relative group card-elevated">
                             <div className="absolute top-2 right-2">
                                <AlertDialog>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50 group-hover:opacity-100 transition-opacity">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onSelect={() => handleInfoClick(room)}>
                                                <Info className="mr-2 h-4 w-4" /> Info
                                            </DropdownMenuItem>
                                            {currentUser?.uid === room.ownerId && (
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the classroom "{room.name}" and all of its posts. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteClick(room)}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                            <CardHeader>
                                <CardTitle className="truncate pr-8">{room.name}</CardTitle>
                                <CardDescription className="truncate">{room.subject || room.section || 'General'}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <div className="text-sm text-muted-foreground">
                                    <p>Teacher: {room.ownerName || 'N/A'}</p>
                                    <p>Members: {room.memberUids?.length || 0}</p>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" asChild>
                                    <Link href={`/classrooms/${room.id}`}><BookOpen className="mr-2 h-4 w-4"/>Open</Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>

                {classrooms.length === 0 && (
                    <div className="empty-state py-16">
                        <div className="empty-state-icon"><BookOpen className="h-8 w-8 text-muted-foreground/50" /></div>
                        <p className="empty-state-title">No Classrooms</p>
                        <p className="empty-state-text">You haven't {isTeacher ? 'created' : 'joined'} any classrooms yet.</p>
                    </div>
                )}
            </div>
            {isTeacher ? (
                 <CreateClassDialog isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} onClassroomCreated={loadData} />
            ) : (
                 <JoinClassDialog isOpen={isJoinOpen} onOpenChange={setIsJoinOpen} onClassroomJoined={loadData} />
            )}
            <InfoDialog isOpen={isInfoOpen} onOpenChange={setIsInfoOpen} classroom={selectedRoom} />
        </>
    );
}
