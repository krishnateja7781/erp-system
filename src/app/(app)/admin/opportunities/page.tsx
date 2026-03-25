
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2, Briefcase, ClipboardCheck, Send, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { saveOpportunity, getOpportunities, deleteOpportunity, getAllApplications, updateApplicationStatus } from '@/actions/placement-actions';
import type { Placement, Internship, Application } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import Link from 'next/link';


type Opportunity = Placement | Internship;

const applicationStatuses: Application['status'][] = ['Applied', 'Under Review', 'Shortlisted', 'Offer Extended', 'Rejected', 'Offer Accepted'];

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

interface OpportunityDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Opportunity) => Promise<boolean>;
    initialData?: Opportunity | null;
    type: 'placement' | 'internship';
}

function OpportunityDialog({ isOpen, onOpenChange, onSave, initialData, type }: OpportunityDialogProps) {
    const [formData, setFormData] = React.useState<Partial<Opportunity>>({});
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setFormData(initialData || { type, minCgpa: null });
            setIsSaving(false);
        }
    }, [isOpen, initialData, type]);

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        const dataToSave = { ...formData };
        if (typeof dataToSave.minCgpa === 'string') {
            dataToSave.minCgpa = parseFloat(dataToSave.minCgpa) || null;
        }
        const success = await onSave(dataToSave as Opportunity);
        setIsSaving(false);
        if (success) onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Edit' : 'Add'} {type === 'placement' ? 'Placement' : 'Internship'} Opportunity</DialogTitle>
                    <DialogDescription>Fill in the details for the opportunity.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 flex-grow overflow-y-auto px-1 pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label>Company</Label><Input value={formData.company || ''} onChange={(e) => handleChange('company', e.target.value)} /></div>
                        <div className="space-y-1"><Label>Role</Label><Input value={formData.role || ''} onChange={(e) => handleChange('role', e.target.value)} /></div>
                        <div className="space-y-1"><Label>{type === 'placement' ? 'CTC' : 'Stipend'}</Label><Input value={formData.ctc_stipend || ''} onChange={(e) => handleChange('ctc_stipend', e.target.value)} /></div>

                        {type === 'placement' ? (
                            <div className="space-y-1"><Label>Location</Label><Input value={(formData as any).location || ''} onChange={(e) => handleChange('location', e.target.value)} /></div>
                        ) : (
                            <div className="space-y-1"><Label>Duration</Label><Input value={(formData as any).duration || ''} onChange={(e) => handleChange('duration', e.target.value)} /></div>
                        )}

                        <div className="space-y-1 md:col-span-2"><Label>Skills (comma-separated)</Label><Input value={(formData.skills || []).join(', ')} onChange={(e) => handleChange('skills', e.target.value.split(',').map(s => s.trim()))} /></div>
                        <div className="space-y-1"><Label>Eligibility (e.g., B.Tech CSE)</Label><Input value={formData.eligibility || ''} onChange={(e) => handleChange('eligibility', e.target.value)} /></div>
                        <div className="space-y-1"><Label>Minimum CGPA (0-10)</Label><Input type="number" step="0.1" min="0" max="10" value={formData.minCgpa ?? ''} onChange={(e) => handleChange('minCgpa', e.target.value)} /></div>

                        <div className="space-y-1 md:col-span-2"><Label>Description</Label><Textarea value={formData.description || ''} onChange={(e) => handleChange('description', e.target.value)} /></div>
                        <div className="space-y-1"><Label>Status</Label>
                            <Select value={formData.status || 'Open'} onValueChange={(value) => handleChange('status', value)}>
                                <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                                <SelectContent><SelectItem value="Open">Open</SelectItem><SelectItem value="Closed">Closed</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={isSaving} className="gap-2">{isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function AdminOpportunitiesPage() {
    const [opportunities, setOpportunities] = React.useState<Opportunity[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingOpportunity, setEditingOpportunity] = React.useState<Opportunity | null>(null);
    const [activeTab, setActiveTab] = React.useState<'placement' | 'internship' | 'applications'>('placement');
    const [applications, setApplications] = React.useState<Application[]>([]);
    const [isLoadingApps, setIsLoadingApps] = React.useState(false);
    const [isUpdating, setIsUpdating] = React.useState<string | null>(null);
    const { toast } = useToast();

    const loadOpportunities = React.useCallback(async (type: 'placement' | 'internship') => {
        setIsLoading(true);
        try {
            const data = await getOpportunities(type);
            setOpportunities(data as Opportunity[]);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (activeTab === 'placement' || activeTab === 'internship') {
            loadOpportunities(activeTab);
        }
    }, [activeTab, loadOpportunities]);

    const loadApplications = React.useCallback(async () => {
        setIsLoadingApps(true);
        try {
            const data = await getAllApplications();
            setApplications(data);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoadingApps(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (activeTab === 'applications') {
            loadApplications();
        }
    }, [activeTab, loadApplications]);

    const handleStatusChange = async (applicationId: string, status: Application['status']) => {
        setIsUpdating(applicationId);
        const result = await updateApplicationStatus(applicationId, status);
        if (result.success) {
            toast({ title: "Status Updated", description: result.message });
            loadApplications();
        } else {
            toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
        }
        setIsUpdating(null);
    };

    const handleAdd = () => { setEditingOpportunity(null); setIsDialogOpen(true); };
    const handleEdit = (opp: Opportunity) => { setEditingOpportunity(opp); setIsDialogOpen(true); };

    const handleSave = async (data: Opportunity): Promise<boolean> => {
        const result = await saveOpportunity(data);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            loadOpportunities(activeTab as 'placement' | 'internship');
            return true;
        }
        toast({ variant: "destructive", title: "Error", description: result.error });
        return false;
    };

    const handleDelete = async (id: string) => {
        const result = await deleteOpportunity(id);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            loadOpportunities(activeTab as 'placement' | 'internship');
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-600 to-pink-500 p-6 mb-6 text-white shadow-lg">
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Manage Opportunities</h1>
                  <p className="text-white/70 text-sm mt-1">Add and manage placement & internship opportunities</p>
                </div>
                {activeTab !== 'applications' && (
                  <Button onClick={handleAdd} className="gap-2 bg-white text-indigo-700 hover:bg-white/90 shadow-md"><PlusCircle className="h-4 w-4" /> Add {activeTab === 'placement' ? 'Placement' : 'Internship'}</Button>
                )}
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="placement" className="gap-2"><Briefcase className="h-4 w-4" /> Placements</TabsTrigger>
                    <TabsTrigger value="internship" className="gap-2"><ClipboardCheck className="h-4 w-4" /> Internships</TabsTrigger>
                    <TabsTrigger value="applications" className="gap-2"><Send className="h-4 w-4" /> Applications</TabsTrigger>
                </TabsList>
                {activeTab !== 'applications' ? (
                <TabsContent value={activeTab}>
                    <Card className="card-elevated">
                        <CardHeader><CardTitle className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md shadow-green-500/20"><Briefcase className="h-4 w-4" /></div>All {activeTab === 'placement' ? 'Placements' : 'Internships'}</CardTitle><CardDescription>View, add, edit, or remove opportunities.</CardDescription></CardHeader>
                        <CardContent>
                            {isLoading ? <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading opportunities...</span></div> :
                                <Table>
                                    <TableHeader><TableRow className="border-border/30"><TableHead>Company</TableHead><TableHead>Role</TableHead><TableHead>CTC / Stipend</TableHead><TableHead>Min. CGPA</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {opportunities.length > 0 ? opportunities.map((opp) => (
                                            <TableRow key={opp.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 border-border/20">
                                                <TableCell>{opp.company}</TableCell><TableCell>{opp.role}</TableCell>
                                                <TableCell>{opp.ctc_stipend}</TableCell>
                                                <TableCell>{opp.minCgpa || 'N/A'}</TableCell>
                                                <TableCell><Badge variant={opp.status === 'Open' ? 'default' : 'secondary'}>{opp.status}</Badge></TableCell>
                                                <TableCell className="text-right">
                                                    <AlertDialog>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleEdit(opp)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                                <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></AlertDialogTrigger>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this opportunity? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(opp.id!)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        )) : <TableRow><TableCell colSpan={6} className="text-center py-12"><div className="flex flex-col items-center gap-2"><div className="rounded-2xl bg-muted p-3"><Briefcase className="h-5 w-5 text-muted-foreground" /></div><p className="font-medium text-muted-foreground">No opportunities found</p><p className="text-sm text-muted-foreground">Add a new opportunity to get started.</p></div></TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            }
                        </CardContent>
                    </Card>
                </TabsContent>
                ) : (
                <TabsContent value="applications">
                    <Card className="card-elevated">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/20">
                                    <Send className="h-4 w-4" />
                                </div>
                                All Applications
                            </CardTitle>
                            <CardDescription>View and manage all submitted applications for placements and internships.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoadingApps ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-4" role="status">
                                    <div className="relative">
                                        <div className="h-12 w-12 rounded-full border-4 border-muted" />
                                        <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">Loading applications...</span>
                                </div>
                            ) : (
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
                                            <TableRow key={app.id} className="hover:bg-rose-50/50 dark:hover:bg-rose-950/20 border-border/20">
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
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-12">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="rounded-2xl bg-muted p-3"><Send className="h-5 w-5 text-muted-foreground" /></div>
                                                        <p className="font-medium text-muted-foreground">No applications yet</p>
                                                        <p className="text-sm text-muted-foreground">No applications have been submitted yet.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                )}
            </Tabs>
            <OpportunityDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} onSave={handleSave} initialData={editingOpportunity} type={activeTab === 'applications' ? 'placement' : activeTab} />
        </div>
    );
}
