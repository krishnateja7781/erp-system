'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building, User, Phone, Wrench, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import * as React from 'react';
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { logComplaint, getStudentHostelData } from "@/actions/hostel-actions";
import { getMyStudentProfile } from '@/actions/student-actions';

type Complaint = { id: string; date: string; issue: string; status: 'Pending' | 'In Progress' | 'Resolved'; };
type HostelData = { hostelId: string | null; hostelName: string | null; roomNumber: string | null; wardenName: string | null; wardenContact: string | null; };
type StudentInfo = { id: string; name: string; };

export default function StudentHostelPage() {
    const { toast } = useToast();
    const [studentInfo, setStudentInfo] = React.useState<StudentInfo | null>(null);
    const [hostelData, setHostelData] = React.useState<HostelData | null>(null);
    const [complaints, setComplaints] = React.useState<Complaint[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isComplaintDialogOpen, setIsComplaintDialogOpen] = React.useState(false);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const profile = await getMyStudentProfile();
            if (!profile) { setError("You must be logged in."); setIsLoading(false); return; }

            if (!profile.isHosteler) {
                toast({ variant: "destructive", title: "Access Denied", description: "This page is only available for students staying in the hostel." });
                window.location.href = '/student/dashboard';
                return;
            }

            setStudentInfo({ id: profile.studentId, name: profile.name });

            const result = await getStudentHostelData(profile.studentId);
            if (result.success && result.data) {
                const { complaints: fetchedComplaints, ...restOfHostelData } = result.data;
                setHostelData(restOfHostelData);
                setComplaints(fetchedComplaints);
            } else {
                setError(result.error || "Failed to load your hostel information.");
            }
        } catch (err: any) {
            console.error("Error fetching hostel details:", err);
            setError("Failed to load your hostel information.");
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);


    const getComplaintStatusBadge = (status: string | null) => {
        switch (status?.toLowerCase()) {
            case 'resolved': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Resolved</Badge>;
            case 'pending': return <Badge variant="destructive">Pending</Badge>;
            case 'in progress': return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-black">In Progress</Badge>;
            default: return <Badge variant="outline">{status || 'Unknown'}</Badge>;
        }
    };

    if (isLoading) { return <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading...</span></div> }
    if (error) { return <div className="text-center text-destructive py-10">{error}</div>; }
    if (!hostelData || !studentInfo) { return <div className="text-center text-muted-foreground py-10">No hostel data available.</div>; }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-6 mb-6 text-white shadow-lg">
                <div className="relative z-10">
                    <h1 className="text-2xl font-bold tracking-tight">My Hostel Details</h1>
                    <p className="text-white/70 text-sm mt-1">Your accommodation information and maintenance requests</p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>
            <Card className="card-elevated">
                <CardHeader><CardTitle className="flex items-center gap-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20"><Building className="h-5 w-5" /></div> Hostel Information</CardTitle><CardDescription>Details about your accommodation.</CardDescription></CardHeader>
                <CardContent className="grid gap-5 md:grid-cols-2">
                    <div><p className="text-sm font-medium text-muted-foreground">Hostel Name</p><p className="font-semibold">{hostelData.hostelName || "N/A"}</p></div>
                    <div><p className="text-sm font-medium text-muted-foreground">Room Number</p><p className="font-semibold">{hostelData.roomNumber || "N/A"}</p></div>
                    <div><p className="text-sm font-medium text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Warden Name</p><p className="font-semibold">{hostelData.wardenName || "N/A"}</p></div>
                    <div><p className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Warden Contact</p><p className="font-semibold">{hostelData.wardenContact || "N/A"}</p></div>
                </CardContent>
            </Card>
            <Card className="card-elevated">
                <CardHeader><CardTitle className="flex items-center gap-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md shadow-red-500/20"><Wrench className="h-5 w-5" /></div> Maintenance & Complaints</CardTitle><CardDescription>Log new issues or track existing ones.</CardDescription></CardHeader>
                <CardContent>
                    <Button onClick={() => setIsComplaintDialogOpen(true)} className="mb-4 gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md"><Wrench className="h-4 w-4" /> Log New Complaint</Button>
                    <h4 className="font-semibold mb-2">My Complaints:</h4>
                    {complaints.length > 0 ? (
                        <ul className="space-y-3">{complaints.map((c) => (<li key={c.id} className="text-sm flex justify-between items-center border-b pb-2 last:border-b-0"><p>{c.date}: <span className="text-muted-foreground">{c.issue}</span></p>{getComplaintStatusBadge(c.status)}</li>))}</ul>
                    ) : <div className="flex flex-col items-center justify-center py-16 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4"><Wrench className="h-8 w-8 text-muted-foreground/40" /></div><p className="text-sm font-medium text-muted-foreground">You have no active complaints.</p></div>}
                </CardContent>
            </Card>
            {studentInfo && hostelData && hostelData.roomNumber && hostelData.hostelId && <LogComplaintDialog isOpen={isComplaintDialogOpen} onOpenChange={setIsComplaintDialogOpen} studentInfo={studentInfo} hostelId={hostelData.hostelId} roomNumber={hostelData.roomNumber} />}
        </div>
    );
}

function LogComplaintDialog({ isOpen, onOpenChange, studentInfo, hostelId, roomNumber }: { isOpen: boolean, onOpenChange: (open: boolean) => void, studentInfo: StudentInfo, hostelId: string, roomNumber: string }) {
    const { toast } = useToast();
    const [issue, setIssue] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleSubmit = async () => {
        if (!issue.trim()) { toast({ variant: "destructive", title: "Error", description: "Please describe the issue." }); return; }
        setIsSubmitting(true);
        try {
            const result = await logComplaint({ studentId: studentInfo.id, studentName: studentInfo.name, hostelId: hostelId, roomNumber: roomNumber, issue });
            if (result.success) {
                toast({ title: "Success", description: result.message });
                onOpenChange(false); setIssue('');
            } else {
                toast({ variant: "destructive", title: "Failed", description: result.error });
            }
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error", description: err.message });
        } finally { setIsSubmitting(false); }
    };

    React.useEffect(() => {
        if (!isOpen) {
            setIssue('');
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent><DialogHeader><DialogTitle>Log a New Complaint</DialogTitle><DialogDescription>Describe the maintenance issue you are facing.</DialogDescription></DialogHeader>
                <div className="py-4"><Label htmlFor="issue-description">Issue Description</Label><Textarea id="issue-description" value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="e.g., The fan in my room is not working." className="mt-2" /></div>
                <DialogFooter><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}Submit Complaint</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
