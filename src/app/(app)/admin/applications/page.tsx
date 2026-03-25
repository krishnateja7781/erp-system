
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ChevronDown, CheckCircle, XCircle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAllApplications, updateApplicationStatus } from '@/actions/placement-actions';
import type { Application } from '@/lib/types';
import Link from 'next/link';

interface PlacementApplication {
    id: string;
    opportunityId?: string;
    company?: string;
    role?: string;
    studentId?: string;
    studentName?: string;
    studentCollegeId?: string;
    opportunityType?: string;
    status: string;
}

const applicationStatuses: string[] = ['Applied', 'Under Review', 'Shortlisted', 'Offer Extended', 'Rejected', 'Offer Accepted'];

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'Applied': return <Badge variant="secondary">Applied</Badge>;
        case 'Under Review': return <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 border-blue-400">Under Review</Badge>;
        case 'Shortlisted': return <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600 text-black">Shortlisted</Badge>;
        case 'Offer Extended': return <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">Offer Extended</Badge>;
        case 'Offer Accepted': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Offer Accepted</Badge>;
        case 'Rejected': return <Badge variant="destructive">Rejected</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
};

export default function AdminApplicationsPage() {
    const { toast } = useToast();
    const [applications, setApplications] = React.useState<PlacementApplication[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isUpdating, setIsUpdating] = React.useState<string | null>(null);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getAllApplications();
            setApplications(data);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleStatusChange = async (applicationId: string, status: string) => {
        setIsUpdating(applicationId);
        const result = await updateApplicationStatus(applicationId, status);
        if (result.success) {
            toast({ title: "Status Updated", description: result.message });
            loadData();
        } else {
            toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
        }
        setIsUpdating(null);
    };
    
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 p-6 mb-6 text-white shadow-lg">
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Student Applications</h1>
                  <p className="text-white/70 text-sm mt-1">View and manage all submitted placement applications</p>
                </div>
                <Button variant="outline" onClick={loadData} disabled={isLoading} className="gap-2 border-white/30 text-white hover:bg-white/10 bg-white/10 backdrop-blur-sm">
                    <RefreshCw className={isLoading ? "animate-spin h-4 w-4" : "h-4 w-4"}/>
                    Refresh
                </Button>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>
            <Card className="card-elevated">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20"><Send className="h-4 w-4" /></div>All Applications</CardTitle>
                    <CardDescription>View and manage all submitted applications for placements and internships.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading applications...</span></div> :
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border/30">
                                    <TableHead>Student</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {applications.length > 0 ? applications.map(app => (
                                    <TableRow key={app.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 border-border/20">
                                        <TableCell>
                                            <Link href={`/admin/students/${app.studentId}`} className="font-medium text-primary hover:underline">{app.studentName}</Link>
                                            <div className="text-xs text-muted-foreground">{app.studentCollegeId}</div>
                                        </TableCell>
                                        <TableCell>{app.company}</TableCell>
                                        <TableCell>{app.role}</TableCell>
                                        <TableCell className="capitalize">{app.opportunityType}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="sm" className="w-40 justify-between" disabled={isUpdating === app.id}>
                                                        {isUpdating === app.id ? <Loader2 className="h-4 w-4 animate-spin"/> : getStatusBadge(app.status)}
                                                        <ChevronDown className="ml-2 h-4 w-4"/>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {applicationStatuses.map(status => (
                                                        <DropdownMenuItem key={status} onSelect={() => handleStatusChange(app.id, status)}>
                                                            {status}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={5} className="text-center py-12"><div className="flex flex-col items-center gap-2"><div className="rounded-2xl bg-muted p-3"><Send className="h-5 w-5 text-muted-foreground" /></div><p className="font-medium text-muted-foreground">No applications yet</p><p className="text-sm text-muted-foreground">No applications have been submitted yet.</p></div></TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    }
                </CardContent>
            </Card>
        </div>
    );
}
