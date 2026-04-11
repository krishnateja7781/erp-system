'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building, User, Phone, Wrench, Loader2, Utensils, IndianRupee, MapPin, SearchCheck, Coffee, Sun, Sunset, Moon, Sparkles, CreditCard, ChevronRight, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import * as React from 'react';
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { logComplaint, getStudentHostelData, getHostelMenu } from "@/actions/hostel-actions";
import { getMyStudentProfile } from '@/actions/student-actions';
import { getStudentFeeDetails } from '@/actions/fee-actions';
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Complaint = { id: string; date: string; issue: string; status: 'Pending' | 'In Progress' | 'Resolved'; };
type HostelData = { hostelId: string | null; hostelName: string | null; roomNumber: string | null; wardenName: string | null; wardenContact: string | null; };
type StudentInfo = { id: string; name: string; };

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOTS = [
    { key: 'morning_slot', label: 'Morning', icon: Coffee, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { key: 'afternoon_slot', label: 'Afternoon', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { key: 'evening_slot', label: 'Snacks', icon: Sunset, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { key: 'dinner_slot', label: 'Dinner', icon: Moon, color: 'text-indigo-500', bg: 'bg-indigo-500/10' }
];

export default function StudentHostelPage() {
    const { toast } = useToast();
    const toastRef = React.useRef(toast);
    React.useEffect(() => { toastRef.current = toast; });

    const [studentInfo, setStudentInfo] = React.useState<StudentInfo | null>(null);
    const [hostelData, setHostelData] = React.useState<HostelData | null>(null);
    const [complaints, setComplaints] = React.useState<Complaint[]>([]);
    const [feeData, setFeeData] = React.useState<any>(null);
    const [menuData, setMenuData] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isComplaintDialogOpen, setIsComplaintDialogOpen] = React.useState(false);
    
    const today = new Date().getDay();
    const [selectedDay, setSelectedDay] = React.useState<string>(DAYS[today]);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const profile = await getMyStudentProfile();
            if (!profile) { setError("You must be logged in."); setIsLoading(false); return; }

            if (!profile.isHosteler) {
                toastRef.current({ variant: "destructive", title: "Access Denied", description: "This page is only available for students staying in the hostel." });
                window.location.href = '/student/dashboard';
                return;
            }

            setStudentInfo({ id: profile.studentId, name: profile.name });

            // Fetch in parallel
            const [hostelResult, feeResult] = await Promise.all([
                getStudentHostelData(profile.studentId),
                getStudentFeeDetails(profile.studentId)
            ]);

            if (hostelResult.success && hostelResult.data) {
                const { complaints: fetchedComplaints, ...restOfHostelData } = hostelResult.data;
                setHostelData(restOfHostelData);
                setComplaints(fetchedComplaints);
                
                // Fetch Menu if Hostel is assigned
                if (restOfHostelData.hostelId) {
                    const menu = await getHostelMenu(restOfHostelData.hostelId);
                    setMenuData(menu);
                }
            } else {
                setError(hostelResult.error || "Failed to load your hostel information.");
            }

            if (feeResult.success) {
                setFeeData(feeResult.data?.hostelFees);
            }
            
        } catch (err: any) {
            console.error("Error fetching hostel details:", err);
            setError("Failed to load your hostel information.");
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps: only run once on mount

    const effectRan = React.useRef(false);
    React.useEffect(() => {
        if (!effectRan.current) {
            loadData();
            effectRan.current = true;
        }
    }, [loadData]);

    const getComplaintStatusBadge = (status: string | null) => {
        switch (status?.toLowerCase()) {
            case 'resolved': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Resolved</Badge>;
            case 'pending': return <Badge variant="destructive">Pending</Badge>;
            case 'in progress': return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-black">In Progress</Badge>;
            default: return <Badge variant="outline">{status || 'Unknown'}</Badge>;
        }
    };

    if (isLoading) { return <div className="flex flex-col items-center justify-center py-24 gap-4" role="status"><div className="relative"><div className="h-16 w-16 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-lg font-medium animate-pulse text-muted-foreground">Loading your digital room...</span></div> }
    if (error) { return <div className="text-center text-destructive py-10">{error}</div>; }
    if (!hostelData || !studentInfo) { return <div className="text-center text-muted-foreground py-10">No hostel data available. You may not be assigned to a room yet.</div>; }

    const feeProgress = feeData ? (feeData.paid / feeData.total) * 100 : 0;
    const currentDayMenu = menuData.find(m => m.day_of_week === selectedDay) || {};

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* HER0 SECTION */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 p-8 sm:p-10 text-white shadow-2xl">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium text-blue-100 mb-4 shadow-sm">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Resident Portal</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-2 drop-shadow-md">
                            {hostelData.hostelName || "Unassigned Hostel"}
                        </h1>
                        <p className="text-indigo-200 text-lg flex items-center gap-2 max-w-xl">
                            <MapPin className="w-4 h-4" /> Room {hostelData.roomNumber || "Pending Allocation"}
                        </p>
                    </div>
                    
                    {/* Quick Warden Contact Card */}
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col gap-3 min-w-[200px] shadow-xl">
                        <div className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Warden Contact</div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                <User className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <div className="font-semibold">{hostelData.wardenName || "N/A"}</div>
                                <div className="text-xs text-indigo-200 flex items-center gap-1 mt-0.5">
                                    <Phone className="w-3 h-3" /> {hostelData.wardenContact || "N/A"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* LEFT COLUMN: Food Menu */}
                <div className="md:col-span-8 space-y-6">
                    <Card className="border-0 shadow-lg ring-1 ring-black/5 dark:ring-white/10 rounded-2xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader className="bg-gradient-to-r from-orange-500/10 to-transparent border-b">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-xl">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-600 text-white shadow-md">
                                            <Utensils className="h-4 w-4" />
                                        </div> 
                                        Food Menu
                                    </CardTitle>
                                    <CardDescription>View the weekly dining schedule</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Tabs value={selectedDay} onValueChange={setSelectedDay} className="w-full">
                                <div className="p-4 border-b bg-muted/20 overflow-x-auto scroolbar-hide">
                                    <TabsList className="bg-background/80 shadow-sm border p-1 h-auto inline-flex min-w-max">
                                        {DAYS.map(day => (
                                            <TabsTrigger 
                                                key={day} 
                                                value={day} 
                                                className={`rounded-lg px-4 py-2 ${day === DAYS[today] ? 'font-bold' : ''}`}
                                            >
                                                {day === DAYS[today] ? `Today (${day})` : day}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                </div>
                                <div className="p-6">
                                    {menuData.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                                            <Utensils className="h-12 w-12 mb-3 opacity-20" />
                                            <p>No menu data available for this hostel.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {SLOTS.map((slot, idx) => {
                                                const Icon = slot.icon;
                                                const menuText = currentDayMenu[slot.key];
                                                
                                                return (
                                                    <div key={idx} className="relative group overflow-hidden rounded-2xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30">
                                                        <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full blur-2xl opacity-20 transition-opacity group-hover:opacity-40 ${backgroundToColorClass(slot.color)}`} />
                                                        
                                                        <div className="flex items-center gap-3 mb-3 relative z-10">
                                                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${slot.bg} ${slot.color}`}>
                                                                <Icon className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-lg">{slot.label}</h4>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 text-muted-foreground relative z-10 break-words font-medium">
                                                            {menuText ? menuText : <span className="italic text-muted-foreground/50">Not specified</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* COMPLAINTS SECTION */}
                    <Card className="border-0 shadow-lg ring-1 ring-black/5 dark:ring-white/10 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md">
                                        <Wrench className="h-4 w-4" />
                                    </div> 
                                    Maintenance
                                </CardTitle>
                                <CardDescription>Track your service requests</CardDescription>
                            </div>
                            <Button onClick={() => setIsComplaintDialogOpen(true)} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md rounded-xl">
                                New Request
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {complaints.length > 0 ? (
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 mt-4">
                                    {complaints.map((c) => (
                                        <div key={c.id} className="group relative flex flex-col gap-2 rounded-xl border p-4 hover:shadow-sm transition-all bg-background">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <CalendarCheck className="w-4 h-4 text-muted-foreground" />
                                                    <span className="text-xs font-medium text-muted-foreground">{c.date}</span>
                                                </div>
                                                {getComplaintStatusBadge(c.status)}
                                            </div>
                                            <p className="font-medium text-foreground">{c.issue}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl mt-4 bg-muted/20">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background shadow-sm mb-4 border">
                                        <SearchCheck className="h-8 w-8 text-muted-foreground/40" />
                                    </div>
                                    <h3 className="text-lg font-semibold">All Good!</h3>
                                    <p className="text-sm text-muted-foreground max-w-[200px]">You have no active maintenance requests.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT COLUMN: Fees & Quick Stats */}
                <div className="md:col-span-4 space-y-6">
                    {/* FEE CARD */}
                    <Card className="border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10 rounded-2xl overflow-hidden bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background">
                        <div className="h-2 w-full bg-gradient-to-r from-emerald-400 to-green-600" />
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-md">
                                    <IndianRupee className="h-4 w-4" />
                                </div> 
                                Hostel Dues
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {feeData ? (
                                <div className="space-y-6">
                                    <div className="text-center p-4 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm">
                                        <p className="text-sm font-medium text-muted-foreground mb-1">Total Outstanding</p>
                                        <h3 className={`text-4xl font-black tracking-tight ${feeData.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                            ₹{feeData.balance > 0 ? feeData.balance.toLocaleString() : '0'}
                                        </h3>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm font-medium">
                                            <span className="text-muted-foreground">Payment Progress</span>
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{feeProgress.toFixed(0)}%</span>
                                        </div>
                                        <Progress value={feeProgress} className="h-2.5 bg-secondary" />
                                        <div className="flex justify-between text-xs text-muted-foreground pt-1">
                                            <span>Paid: ₹{feeData.paid.toLocaleString()}</span>
                                            <span>Total: ₹{feeData.total.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <Button asChild className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-xl py-6 shadow-md group">
                                        <Link href="/student/fees">
                                            <CreditCard className="mr-2 h-4 w-4 transition-transform group-hover:-translate-y-0.5" /> 
                                            Pay Now
                                            <ChevronRight className="ml-auto h-4 w-4 opacity-70 transition-transform group-hover:translate-x-1" />
                                        </Link>
                                    </Button>
                                    
                                </div>
                            ) : (
                                <div className="py-8 text-center text-muted-foreground flex flex-col items-center">
                                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                                    <p>Loading fee data...</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* HOSTEL RULES / INFO */}
                    <Card className="border-0 shadow-lg ring-1 ring-black/5 dark:ring-white/10 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Quick Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3 text-sm">
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <span className="text-muted-foreground">Keep your room clean and lock the door when leaving.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <span className="text-muted-foreground">Hostel main gate closes strictly at 10:00 PM.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <span className="text-muted-foreground">Visitors are allowed only in the reception area during visiting hours.</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {studentInfo && hostelData && hostelData.roomNumber && hostelData.hostelId && (
                <LogComplaintDialog isOpen={isComplaintDialogOpen} onOpenChange={setIsComplaintDialogOpen} studentInfo={studentInfo} hostelId={hostelData.hostelId} roomNumber={hostelData.roomNumber} loadData={loadData} />
            )}
        </div>
    );
}

// Utility for injecting dynamic colors from classes
function backgroundToColorClass(colorClass: string) {
    if (colorClass.includes('orange')) return 'bg-orange-500';
    if (colorClass.includes('amber')) return 'bg-amber-500';
    if (colorClass.includes('rose')) return 'bg-rose-500';
    if (colorClass.includes('indigo')) return 'bg-indigo-500';
    return 'bg-primary';
}

function LogComplaintDialog({ isOpen, onOpenChange, studentInfo, hostelId, roomNumber, loadData }: { isOpen: boolean, onOpenChange: (open: boolean) => void, studentInfo: StudentInfo, hostelId: string, roomNumber: string, loadData: () => void }) {
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
                loadData(); // Refresh the data to show the new complaint
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
            <DialogContent className="sm:max-w-[450px]"><DialogHeader><DialogTitle>New Maintenance Request</DialogTitle><DialogDescription>Describe the issue accurately so we can fix it quickly.</DialogDescription></DialogHeader>
                <div className="py-4"><Label htmlFor="issue-description" className="font-semibold mb-2 block">Issue Description</Label><Textarea id="issue-description" value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="e.g., The fan in my room makes excessive noise." className="resize-none h-24" /></div>
                <DialogFooter><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}Submit Request</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
