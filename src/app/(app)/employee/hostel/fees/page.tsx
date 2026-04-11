'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, IndianRupee, CreditCard, Filter, Loader2, CheckCircle2, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getHostelFees, processHostelPayment } from './actions';

export default function HostelFeesPage() {
    const [students, setStudents] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState('all');
    
    // Payment Dialog state
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
    const [selectedStudent, setSelectedStudent] = React.useState<any>(null);
    const [paymentAmount, setPaymentAmount] = React.useState('');
    const [paymentMethod, setPaymentMethod] = React.useState('Bank Transfer');
    const [isProcessing, setIsProcessing] = React.useState(false);

    const { toast } = useToast();

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getHostelFees();
            setStudents(data);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to load fee data" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => { loadData(); }, [loadData]);

    const handleOpenPayment = (student: any) => {
        setSelectedStudent(student);
        setPaymentAmount(student.balance > 0 ? student.balance.toString() : '');
        setIsPaymentDialogOpen(true);
    };

    const handleProcessPayment = async () => {
        if (!selectedStudent || !paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) {
            toast({ variant: "destructive", title: "Invalid Input", description: "Please enter a valid amount." });
            return;
        }
        
        setIsProcessing(true);
        const result = await processHostelPayment({
            studentId: selectedStudent.id,
            amount: Number(paymentAmount),
            method: paymentMethod,
            academicTermId: selectedStudent.academicTermId, 
            feeId: selectedStudent.feeId
        });
        
        setIsProcessing(false);
        
        if (result.success) {
            toast({ title: "Success", description: result.message });
            setIsPaymentDialogOpen(false);
            loadData();
        } else {
            toast({ variant: "destructive", title: "Payment Failed", description: result.error });
        }
    };

    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              s.collegeId?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || s.status.toLowerCase() === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const totalExpected = students.reduce((sum, s) => sum + s.total, 0);
    const totalCollected = students.reduce((sum, s) => sum + s.paid, 0);
    const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
                            <IndianRupee className="h-5 w-5" />
                        </div>
                        Hostel Fee Management
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">Record and monitor hostel fee collections</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Expected</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{totalExpected.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700 dark:text-green-400">₹{totalCollected.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">{collectionRate.toFixed(1)}% collection rate</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-red-500/5 to-orange-500/5 border-red-500/20 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">₹{(totalExpected - totalCollected).toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-lg border-0 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
                <div className="p-4 border-b bg-muted/40 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search by student name or ID..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 w-full bg-background"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[150px] bg-background">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="paid">Fully Paid</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="relative w-full overflow-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading fee records...
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-transparent hover:bg-transparent">
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Room Details</TableHead>
                                    <TableHead className="text-right">Total Fee</TableHead>
                                    <TableHead className="text-right">Paid</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center">No students found.</TableCell></TableRow>
                                ) : (
                                    filteredStudents.map((student) => (
                                        <TableRow key={student.id} className="group hover:bg-muted/50 transition-colors">
                                            <TableCell>
                                                <div className="font-medium">{student.name}</div>
                                                <div className="text-xs text-muted-foreground">{student.collegeId}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{student.hostelName || 'Unknown'}</div>
                                                <div className="text-xs text-muted-foreground">{student.roomNumber ? `Room ${student.roomNumber}` : 'Unallocated'}</div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">₹{student.total.toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-green-600 dark:text-green-400">₹{student.paid.toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-red-600 dark:text-red-400 font-semibold">₹{student.balance.toLocaleString()}</TableCell>
                                            <TableCell className="text-center">
                                                {student.balance <= 0 ? 
                                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 pointer-events-none">Paid</Badge> : 
                                                    (student.paid > 0 ? 
                                                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 pointer-events-none">Partial</Badge> : 
                                                        <Badge variant="destructive" className="pointer-events-none">Pending</Badge>
                                                    )
                                                }
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant={student.balance > 0 ? "default" : "outline"} onClick={() => handleOpenPayment(student)} disabled={student.balance <= 0}>
                                                    {student.balance > 0 ? 'Collect' : 'Settled'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </Card>

            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Record Fee Payment</DialogTitle>
                        <DialogDescription>
                            Process hostel fee payment for {selectedStudent?.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right font-medium">Pending</Label>
                            <span className="col-span-3 text-red-600 font-bold">₹{selectedStudent?.balance.toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="amount" className="text-right">Amount (₹)</Label>
                            <Input 
                                id="amount" 
                                type="number" 
                                value={paymentAmount} 
                                onChange={(e) => setPaymentAmount(e.target.value)} 
                                className="col-span-3"
                                min={1}
                                max={selectedStudent?.balance}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="method" className="text-right">Method</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                    <SelectItem value="UPI">UPI</SelectItem>
                                    <SelectItem value="Cheque">Cheque</SelectItem>
                                    <SelectItem value="Debit Card">Debit Card</SelectItem>
                                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)} disabled={isProcessing}>Cancel</Button>
                        <Button onClick={handleProcessPayment} disabled={isProcessing}>
                            {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing</> : 'Confirm Payment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
