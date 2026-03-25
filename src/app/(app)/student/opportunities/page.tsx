
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Building, Calendar, DollarSign, Briefcase, Check, Loader2, BookCheck, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getOpportunities, submitApplication, getStudentApplications } from '@/actions/placement-actions';
import type { Placement, Internship, Application } from '@/lib/types';
import { getStudentProfileDetails } from '@/actions/dashboard-actions';
import { getMyStudentProfile } from '@/actions/student-actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from '@/lib/utils';

export type Opportunity = {
  id: string;
  type: 'placement' | 'internship';
  company: string;
  role: string;
  ctc_stipend: string;
  description: string;
  eligibility: string;
  minCgpa: number;
  skills: string[];
  deadline: string;
  status: string;
  duration?: string;
};

const getStatusBadge = (status: Application['status']) => {
    switch (status) {
        case 'Applied': return <Badge variant="secondary">Applied</Badge>;
        case 'Under Review': return <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 border-blue-400">Under Review</Badge>;
        case 'Shortlisted': return <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600 text-black">Shortlisted</Badge>;
        case 'Offer Extended': return <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">Offer Extended</Badge>;
        case 'Offer Accepted': return <Badge variant="default" className="bg-green-700 hover:bg-green-800">Offer Accepted</Badge>;
        case 'Rejected': return <Badge variant="destructive">Not Selected</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
};

export default function OpportunitiesPage() {
    const [placements, setPlacements] = React.useState<Opportunity[]>([]);
    const [internships, setInternships] = React.useState<Opportunity[]>([]);
    const [myApplications, setMyApplications] = React.useState<Application[]>([]);

    const [loadingStatus, setLoadingStatus] = React.useState<Record<string, boolean>>({});

    const [isLoading, setIsLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<{ uid: string, id: string } | null>(null);
    const [studentCGPA, setStudentCGPA] = React.useState<number | null>(null);
    const { toast } = useToast();

    const loadStudentData = React.useCallback(async (userId: string) => {
        try {
            const data = await getStudentProfileDetails(userId);
            if (data?.marks.cgpa !== null) {
                setStudentCGPA(data!.marks.cgpa);
            }
        } catch (e) {
            console.error("Failed to fetch student CGPA", e);
            // Do not toast here, as it might be an expected state
        }
    }, []);

    React.useEffect(() => {
        async function loadUser() {
            const profile = await getMyStudentProfile();
            if (profile) {
                setCurrentUser({ uid: profile.profileId, id: profile.studentId });
                loadStudentData(profile.studentId);
            } else {
                setIsLoading(false);
            }
        }
        loadUser();
    }, [loadStudentData]);

    const loadOpportunities = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const [placementData, internshipData] = await Promise.all([
                getOpportunities('placement'),
                getOpportunities('internship')
            ]);
            setPlacements(placementData as Opportunity[]);
            setInternships(internshipData as Opportunity[]);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not fetch opportunities." });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadOpportunities();
    }, [loadOpportunities]);

    // Fetch applications via server action (replaces Firestore onSnapshot)
    const fetchApplications = React.useCallback(async (uid: string) => {
        try {
            const apps = await getStudentApplications(uid);
            setMyApplications(apps as Application[]);
        } catch (e) {
            console.error('Failed to fetch applications', e);
        }
    }, []);

    React.useEffect(() => {
        if (!currentUser?.uid) return;
        fetchApplications(currentUser.uid);
        const interval = setInterval(() => fetchApplications(currentUser.uid), 30000);
        return () => clearInterval(interval);
    }, [currentUser, fetchApplications]);


    const handleApply = async (opportunity: Opportunity) => {
        if (!currentUser) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to apply.' });
            return;
        }
        setLoadingStatus(prev => ({ ...prev, [opportunity.id]: true }));
        try {
            const result = await submitApplication({
                userId: currentUser.uid,
                studentId: currentUser.id,
                opportunityId: opportunity.id,
                opportunityType: opportunity.type,
                company: opportunity.company,
                role: opportunity.role
            });
            if (result.success) {
                toast({ title: 'Application Successful', description: result.message });
            } else {
                toast({ variant: 'destructive', title: 'Application Failed', description: result.error });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setLoadingStatus(prev => ({ ...prev, [opportunity.id]: false }));
        }
    };

    const getStatusButton = (opportunity: Opportunity) => {
        const appliedStatus = myApplications.find(app => app.opportunityId === opportunity.id)?.status;
        const isLoading = loadingStatus[opportunity.id] || false;
        const isEligible = studentCGPA === null || opportunity.minCgpa === null || studentCGPA >= opportunity.minCgpa;

        if (isLoading) {
            return <Button disabled className="w-full gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Applying...</Button>;
        }

        if (appliedStatus) {
            return <Button disabled variant="secondary" className="w-full gap-2"><Check className="h-4 w-4" /> {appliedStatus}</Button>;
        }

        if (!isEligible) {
            return <Button disabled variant="outline" className="w-full">Not Eligible (CGPA)</Button>;
        }

        return <Button onClick={() => handleApply(opportunity)} className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md">Apply Now</Button>;
    };

    const OpportunityCard = ({ opp }: { opp: Opportunity }) => (
        <Card key={opp.id} className="flex flex-col card-elevated">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-xl">{opp.role}</CardTitle>
                        <CardDescription className="flex items-center gap-2 pt-1"><Building className="h-4 w-4" /> {opp.company}</CardDescription>
                    </div>
                    <Badge variant={opp.status === 'Open' ? 'default' : 'secondary'} className={opp.status === 'Open' ? "bg-green-600" : ""}>{opp.status}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 flex-grow">
                <div className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" /> CTC/Stipend: <span className="font-semibold text-foreground">{opp.ctc_stipend}</span></div>
                {opp.type === 'internship' && <div className="text-sm text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" /> Duration: <span className="font-semibold text-foreground">{opp.duration}</span></div>}
                <p className="text-sm text-muted-foreground pt-2">{opp.description}</p>
                <div className="pt-2">
                    <h4 className="text-xs font-semibold mb-1">ELIGIBILITY</h4>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{opp.eligibility}</Badge>
                        {opp.minCgpa !== null && <Badge variant="outline" className="flex items-center gap-1"><BookCheck className="h-3 w-3" />CGPA: {opp.minCgpa}+</Badge>}
                    </div>
                </div>
                <div className="pt-2">
                    <h4 className="text-xs font-semibold mb-1">SKILLS REQUIRED</h4>
                    <div className="flex flex-wrap gap-1">
                        {(opp.skills || []).map(skill => <Badge key={skill} className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-0">{skill}</Badge>)}
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                {getStatusButton(opp)}
            </CardFooter>
        </Card>
    );

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-6 mb-6 text-white shadow-lg">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Career Opportunities</h1>
                        <p className="text-white/70 text-sm mt-1">Explore placements, internships, and track your applications</p>
                    </div>
                    {studentCGPA !== null ? <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">Your CGPA: {studentCGPA.toFixed(2)}</Badge> : <Badge className="bg-white/20 text-white border-white/30">CGPA not available</Badge>}
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>
            <Tabs defaultValue="available" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="available" className="gap-2"><Briefcase className="h-4 w-4" /> Available Opportunities</TabsTrigger>
                    <TabsTrigger value="applied" className="gap-2"><ClipboardCheck className="h-4 w-4" /> My Applications</TabsTrigger>
                </TabsList>
                <TabsContent value="available">
                    {isLoading ? <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading...</span></div> : (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-2xl font-semibold mb-4">Placements</h2>
                                {placements.length > 0 ? (
                                    <div className="grid gap-6 md:grid-cols-2">
                                        {placements.map(opp => <OpportunityCard key={opp.id} opp={opp} />)}
                                    </div>
                                ) : (<div className="flex flex-col items-center justify-center py-16 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4"><Briefcase className="h-8 w-8 text-muted-foreground/40" /></div><p className="text-sm font-medium text-muted-foreground">No placements available.</p></div>)}
                            </div>
                            <div>
                                <h2 className="text-2xl font-semibold mb-4">Internships</h2>
                                {internships.length > 0 ? (
                                    <div className="grid gap-6 md:grid-cols-2">
                                        {internships.map(opp => <OpportunityCard key={opp.id} opp={opp} />)}
                                    </div>
                                ) : (<div className="flex flex-col items-center justify-center py-16 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4"><ClipboardCheck className="h-8 w-8 text-muted-foreground/40" /></div><p className="text-sm font-medium text-muted-foreground">No internships available.</p></div>)}
                            </div>
                        </div>
                    )}
                </TabsContent>
                <TabsContent value="applied">
                    <Card className="card-elevated">
                        <CardHeader>
                            <CardTitle>My Application Status</CardTitle>
                            <CardDescription>Track the status of all your job and internship applications here.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading...</span></div> :
                                <Table>
                                    <TableHeader><TableRow className="border-border/30"><TableHead>Date Applied</TableHead><TableHead>Company</TableHead><TableHead>Role</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {myApplications.length > 0 ? myApplications.map(app => (
                                            <TableRow key={app.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border-border/20">
                                                <TableCell>{formatDate(app.appliedAt)}</TableCell>
                                                <TableCell className="font-medium">{app.company}</TableCell>
                                                <TableCell>{app.role}</TableCell>
                                                <TableCell className="capitalize flex items-center gap-2">
                                                    {app.opportunityType === 'placement' ? <Briefcase className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
                                                    {app.opportunityType}
                                                </TableCell>
                                                <TableCell className="text-right">{getStatusBadge(app.status)}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">You have not applied to any opportunities yet.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            }
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
