
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, IndianRupee, CreditCard, Link as LinkIcon, User, UserCheck, Loader2, ArrowRight, Ticket } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getStudentsForFeeFiltering, recordAdminPayment, getStudentFeeDetails, FeeRecord } from "@/actions/fee-actions";
import { PageHeaderActions } from "@/components/layout/layout-context";
import { cn } from "@/lib/utils";

const PROGRAMS = ["B.Tech", "MBA", "Law", "MBBS", "B.Sc", "B.Com"];
const BRANCHES: Record<string, string[]> = {
    "B.Tech": ["CSE", "ECE", "MECH", "IT", "AI&ML", "DS", "CIVIL", "Other"],
    "MBA": ["Marketing", "Finance", "HR", "Operations", "General", "Other"],
    "Law": ["Corporate Law", "Criminal Law", "Civil Law", "General", "Other"],
    "MBBS": ["General Medicine"],
    "B.Sc": ["Physics", "Chemistry", "Mathematics", "Computer Science", "Biotechnology", "Other"],
    "B.Com": ["General", "Accounting & Finance", "Taxation", "Corporate Secretaryship", "Other"],
};
const YEARS = ["1", "2", "3", "4"];
const SECTIONS = ["A", "B", "C", "D"];

export default function AdminFeesPage() {
    const { toast } = useToast();
    const [filters, setFilters] = React.useState({
        program: "",
        branch: "",
        year: "",
        section: ""
    });
    const [searchTerm, setSearchTerm] = React.useState("");
    const [students, setStudents] = React.useState<any[]>([]);
    const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);
    const [feeDetails, setFeeDetails] = React.useState<FeeRecord | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [activeMode, setActiveMode] = React.useState<'College' | 'Hostel'>('College');

    // Payment Form State
    const [paymentForm, setPaymentForm] = React.useState({
        amount: "",
        transactionId: "",
        transactionDate: new Date().toISOString().split('T')[0],
        year: "1"
    });

    const loadStudents = React.useCallback(async () => {
        if (!filters.program || !filters.branch || !filters.year || !filters.section) return;
        setIsLoading(true);
        const data = await getStudentsForFeeFiltering(filters);
        setStudents(data);
        setIsLoading(false);
    }, [filters]);

    React.useEffect(() => {
        loadStudents();
        setSelectedStudentId(null);
        setFeeDetails(null);
    }, [loadStudents]);

    const fetchFeeDetails = async (studentId: string) => {
        setIsLoading(true);
        const res = await getStudentFeeDetails(studentId);
        if (res.success && res.data) {
            setFeeDetails(res.data);
        } else {
            // If none found, we'll initialize it on payment record anyway, but show 0 for now
            setFeeDetails(null);
        }
        setIsLoading(false);
    };

    const handleStudentSelect = (studentId: string) => {
        setSelectedStudentId(studentId);
        fetchFeeDetails(studentId);
        const student = students.find(s => s.id === studentId);
        if (student) {
            setPaymentForm(prev => ({ ...prev, year: String(filters.year) }));
        }
    };

    const filteredStudents = students.filter(s =>
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.collegeId?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudentId) return;
        if (!paymentForm.amount || isNaN(Number(paymentForm.amount))) {
            toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid number." });
            return;
        }

        setIsSubmitting(true);
        const res = await recordAdminPayment({
            studentId: selectedStudentId,
            amount: Number(paymentForm.amount),
            year: Number(paymentForm.year),
            transactionId: paymentForm.transactionId,
            transactionDate: paymentForm.transactionDate,
            category: activeMode
        });

        if (res.success) {
            toast({ title: "Success", description: res.message });
            setPaymentForm(prev => ({
                ...prev,
                amount: "",
                transactionId: "",
                transactionDate: new Date().toISOString().split('T')[0]
            }));
            fetchFeeDetails(selectedStudentId);
        } else {
            toast({ variant: "destructive", title: "Error", description: res.error });
        }
        setIsSubmitting(false);
    };

    const selectedStudent = students.find(s => s.id === selectedStudentId);

    return (
        <div className="space-y-8 max-w-6xl mx-auto animate-fade-in">

            {/* Gradient Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 p-6 text-white shadow-lg">
              <div className="relative z-10">
                <h1 className="text-2xl font-bold tracking-tight">Fee Management</h1>
                <p className="text-white/70 text-sm mt-1">Record payments and track fee status for all students</p>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            {/* Horizontal Filter Bar */}
            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Program</Label>
                            <Select value={filters.program} onValueChange={(v) => setFilters(prev => ({ ...prev, program: v, branch: "" }))}>
                                <SelectTrigger className="bg-background"><SelectValue placeholder="Program" /></SelectTrigger>
                                <SelectContent>
                                    {PROGRAMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Branch</Label>
                            <Select value={filters.branch} onValueChange={(v) => setFilters(prev => ({ ...prev, branch: v }))} disabled={!filters.program}>
                                <SelectTrigger className="bg-background"><SelectValue placeholder="Branch" /></SelectTrigger>
                                <SelectContent>
                                    {(BRANCHES[filters.program] || []).map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Year & Section</Label>
                            <div className="flex gap-2">
                                <Select value={filters.year} onValueChange={(v) => setFilters(prev => ({ ...prev, year: v }))}>
                                    <SelectTrigger className="bg-background"><SelectValue placeholder="Year" /></SelectTrigger>
                                    <SelectContent>
                                        {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={filters.section} onValueChange={(v) => setFilters(prev => ({ ...prev, section: v }))}>
                                    <SelectTrigger className="bg-background"><SelectValue placeholder="Sec" /></SelectTrigger>
                                    <SelectContent>
                                        {SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Search USN / Name</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Type to filter..."
                                    className="pl-8 bg-background"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    disabled={students.length === 0}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Student List Sidebar */}
                <Card className="lg:col-span-1 h-fit max-h-[calc(100vh-250px)] sticky top-6 card-elevated">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold flex items-center justify-between">
                            <span>Student List</span>
                            <Badge className="font-mono text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-0">{filteredStudents.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <Separator />
                    <CardContent className="p-2">
                        <div className="max-h-[500px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3" role="status">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <span className="text-sm text-muted-foreground">Loading students...</span>
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <div className="rounded-2xl bg-muted p-3"><User className="h-6 w-6 text-muted-foreground" /></div>
                                    <p className="text-sm text-muted-foreground">No students found</p>
                                </div>
                            ) : filteredStudents.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => handleStudentSelect(s.id)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-lg text-sm transition-all border",
                                        selectedStudentId === s.id
                                            ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                                            : "hover:bg-accent border-transparent"
                                    )}
                                >
                                    <div className="font-bold truncate">{s.name}</div>
                                    <div className={cn("text-[10px] font-mono mt-1", selectedStudentId === s.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                        {s.collegeId} • {s.type}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Fee Details & Payment */}
                <div className="lg:col-span-3 space-y-8">
                    {!selectedStudentId ? (
                        <Card className="h-full flex flex-col items-center justify-center p-12 text-center opacity-60">
                            <User className="h-16 w-16 mb-4 text-muted-foreground" />
                            <CardTitle>No Student Selected</CardTitle>
                            <CardDescription>Select a student from the sidebar to view fee status and record payments.</CardDescription>
                        </Card>
                    ) : (
                        <>
                            {selectedStudent?.type === 'Hosteler' && (
                                <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as any)} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="College">College Fee</TabsTrigger>
                                        <TabsTrigger value="Hostel">Hostel Fee</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            )}

                            <Card className="border-l-4 border-l-primary shadow-lg overflow-hidden">
                                <div className="bg-primary/5 p-6 border-b">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-12 w-12 border-2 border-primary/20">
                                                <AvatarFallback className="bg-primary text-primary-foreground">{selectedStudent?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <h2 className="text-xl font-bold">{selectedStudent?.name}</h2>
                                                <p className="text-sm text-muted-foreground font-mono">{selectedStudent?.collegeId} • {selectedStudent?.type}</p>
                                            </div>
                                        </div>
                                        <Badge variant={selectedStudent?.type === 'Hosteler' ? "default" : "outline"} className="px-3 py-1">
                                            {selectedStudent?.type}
                                        </Badge>
                                    </div>
                                </div>
                                <CardContent className="p-6">
                                    {activeMode === 'College' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-1">
                                                <Label className="text-muted-foreground">Total College Fee</Label>
                                                <div className="text-2xl font-bold flex items-center">
                                                    <IndianRupee className="h-5 w-5 mr-1 text-primary" />
                                                    {feeDetails?.collegeFees?.total?.toLocaleString() || '150,000'}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-muted-foreground">Paid (College)</Label>
                                                <div className="text-2xl font-bold text-green-600 flex items-center">
                                                    <IndianRupee className="h-5 w-5 mr-1" />
                                                    {feeDetails?.collegeFees?.paid?.toLocaleString() || '0'}
                                                </div>
                                            </div>
                                            <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                                                <Label className="text-primary font-semibold">Due (College)</Label>
                                                <div className="text-3xl font-extrabold text-primary flex items-center">
                                                    <IndianRupee className="h-6 w-6 mr-1" />
                                                    {feeDetails?.collegeFees?.balance?.toLocaleString() || '150,000'}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-1">
                                                <Label className="text-muted-foreground">Total Hostel Fee</Label>
                                                <div className="text-2xl font-bold flex items-center">
                                                    <IndianRupee className="h-5 w-5 mr-1 text-primary" />
                                                    {feeDetails?.hostelFees?.total?.toLocaleString() || '50,000'}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-muted-foreground">Paid (Hostel)</Label>
                                                <div className="text-2xl font-bold text-green-600 flex items-center">
                                                    <IndianRupee className="h-5 w-5 mr-1" />
                                                    {feeDetails?.hostelFees?.paid?.toLocaleString() || '0'}
                                                </div>
                                            </div>
                                            <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                                                <Label className="text-primary font-semibold">Due (Hostel)</Label>
                                                <div className="text-3xl font-extrabold text-primary flex items-center">
                                                    <IndianRupee className="h-6 w-6 mr-1" />
                                                    {feeDetails?.hostelFees?.balance?.toLocaleString() || '50,000'}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="card-elevated">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20"><CreditCard className="h-5 w-5" /></div> Record {activeMode} Payment
                                    </CardTitle>
                                    <CardDescription>Enter details of the {activeMode.toLowerCase()} payment made by the student.</CardDescription>
                                </CardHeader>
                                <form onSubmit={handlePaymentSubmit}>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="amount">Amount Paid (₹)</Label>
                                                <div className="relative">
                                                    <IndianRupee className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="amount"
                                                        placeholder="E.g. 50000"
                                                        className="pl-8 text-lg font-semibold"
                                                        value={paymentForm.amount}
                                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="txnId">Transaction ID</Label>
                                                <div className="relative">
                                                    <Ticket className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="txnId"
                                                        placeholder="E.g. TXN123456"
                                                        className="pl-8"
                                                        value={paymentForm.transactionId}
                                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, transactionId: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="txnDate">Transaction Date</Label>
                                                <div className="relative">
                                                    <Input
                                                        id="txnDate"
                                                        type="date"
                                                        className="w-full"
                                                        value={paymentForm.transactionDate}
                                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, transactionDate: e.target.value }))}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>For Year</Label>
                                                <Select value={paymentForm.year} onValueChange={(v) => setPaymentForm(prev => ({ ...prev, year: v }))}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {[1, 2, 3, 4].map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="bg-accent/30 border-t p-4 flex justify-between items-center">
                                        <div className="text-sm text-muted-foreground">
                                            Calculating due for <span className="font-semibold text-foreground">{selectedStudent?.name}</span>
                                        </div>
                                        <Button type="submit" disabled={isSubmitting} className="min-w-[150px] gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-md">
                                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                                            Record Payment
                                        </Button>
                                    </CardFooter>
                                </form>
                            </Card>

                            {/* Transaction History Preview */}
                            {feeDetails && feeDetails.transactions.length > 0 && (
                                <Card className="card-elevated">
                                    <CardHeader>
                                        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold">Recent Transactions</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="divide-y">
                                            {feeDetails.transactions.filter(tx => tx.category === activeMode).slice().reverse().map((tx, idx) => (
                                                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white shadow-md shadow-green-500/20">
                                                            <IndianRupee className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold">₹{tx.amount.toLocaleString()}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {new Date(tx.date).toLocaleDateString()} • {tx.id}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge className="bg-green-600">Success</Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

