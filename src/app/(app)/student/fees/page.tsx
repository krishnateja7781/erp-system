'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Ticket, ArrowLeft, RefreshCw, AlertTriangle, IndianRupee } from 'lucide-react';
import { getStudentFeeDetails, type FeeRecord, type Transaction } from '@/actions/fee-actions';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';
import { useAuthProtection } from '@/hooks/useAuthProtection';

export default function StudentFeesPage() {
    const router = useRouter();
    const { currentUser, authIsLoading } = useAuthProtection('student');
    const [feeDetails, setFeeDetails] = React.useState<FeeRecord | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [activeMode, setActiveMode] = React.useState<'College' | 'Hostel'>('College');

    const loadData = React.useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        setError(null);
        try {
            const result = await getStudentFeeDetails(currentUser.id);
            if (result.success && result.data) {
                setFeeDetails(result.data);
            } else {
                setError(result.error || 'Failed to load fee details.');
            }
        } catch (e: any) {
            setError('An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    React.useEffect(() => {
        if (!authIsLoading && currentUser) {
            loadData();
        } else if (!authIsLoading && !currentUser) {
            setError("Could not identify student.");
            setIsLoading(false);
        }
    }, [authIsLoading, currentUser, loadData]);

    const getStatusBadge = (status: Transaction['status']) => {
        switch (status) {
            case 'Success': return <Badge className="bg-green-600">Success</Badge>;
            case 'Pending Confirmation': return <Badge className="bg-yellow-500 text-black">Pending</Badge>;
            case 'Failed': return <Badge variant="destructive">Failed</Badge>;
        }
    };

    if (isLoading || authIsLoading) {
        return <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading...</span></div>;
    }

    if (error) {
        return <div className="text-center text-destructive py-10"><AlertTriangle className="mx-auto h-12 w-12" /><h2 className="mt-4 text-lg font-semibold">Could not load fee information</h2><p className="text-sm">{error}</p><Button onClick={loadData} className="mt-4 gap-2" variant="outline"><RefreshCw className="h-4 w-4" />Retry</Button></div>;
    }

    if (!feeDetails) {
        return <div className="text-center text-muted-foreground py-10">No fee records found for your account.</div>;
    }

    const isHosteler = currentUser?.type === 'Hosteler';
    const currentFeeData = activeMode === 'College' ? feeDetails.collegeFees : feeDetails.hostelFees;

    if (!currentFeeData) return null; // Fallback

    const total = currentFeeData.total || 0;
    const paid = currentFeeData.paid || 0;
    const balance = currentFeeData.balance || 0;
    const percentagePaid = total > 0 ? (paid / total) * 100 : 0;

    return (
        <div className="space-y-8 max-w-5xl mx-auto animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-6 mb-6 text-white shadow-lg">
                <div className="relative z-10">
                    <h1 className="text-2xl font-bold tracking-tight">My Fees</h1>
                    <p className="text-white/70 text-sm mt-1">View your fee details, payment history, and invoices</p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            {isHosteler && (
                <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as 'College' | 'Hostel')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                        <TabsTrigger value="College">College Fee</TabsTrigger>
                        <TabsTrigger value="Hostel">Hostel Fee</TabsTrigger>
                    </TabsList>
                </Tabs>
            )}

            <div className="grid gap-5 md:grid-cols-3">
                <Card className={cn("border-t-4 card-elevated", activeMode === 'College' ? "border-t-primary" : "border-t-orange-500")}>
                    <CardHeader><CardTitle className="text-sm font-medium">Total {activeMode} Fee</CardTitle></CardHeader>
                    <CardContent><p className="text-2xl font-bold flex items-center"><IndianRupee className="h-5 w-5 mr-1 text-muted-foreground" /> {total.toLocaleString()}</p></CardContent>
                </Card>
                <Card className="border-t-4 border-t-green-500 card-elevated">
                    <CardHeader><CardTitle className="text-sm font-medium">Amount Paid</CardTitle></CardHeader>
                    <CardContent><p className="text-2xl font-bold text-green-600 flex items-center"><IndianRupee className="h-5 w-5 mr-1" /> {paid.toLocaleString()}</p></CardContent>
                </Card>
                <Card className="border-t-4 border-t-destructive card-elevated">
                    <CardHeader><CardTitle className="text-sm font-medium">Amount Due</CardTitle></CardHeader>
                    <CardContent><p className="text-2xl font-bold text-destructive flex items-center"><IndianRupee className="h-5 w-5 mr-1" /> {balance.toLocaleString()}</p></CardContent>
                </Card>
            </div>

            <Card className="overflow-hidden card-elevated">
                <CardHeader className="bg-muted/50 pb-4">
                    <CardTitle className="text-lg">Fee Payment Progress</CardTitle>
                    <CardDescription>Track your {activeMode.toLowerCase()} payment status</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <span className="text-3xl font-extrabold text-primary">{percentagePaid.toFixed(1)}%</span>
                            <span className="text-muted-foreground ml-2">Paid</span>
                        </div>
                        <div className="text-sm font-medium text-muted-foreground">
                            {balance > 0 ? `₹${balance.toLocaleString()} remaining` : 'Fully Paid'}
                        </div>
                    </div>
                    <Progress value={percentagePaid} className="h-4" />
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
                <Button onClick={() => router.push(`/student/invoices?category=${activeMode.toLowerCase()}`)} className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md">
                    <Ticket className="h-4 w-4" /> View {activeMode} Invoices
                </Button>
            </div>

            <Card className="card-elevated">
                <CardHeader>
                    <CardTitle>Payment History</CardTitle>
                    <CardDescription>A record of your {activeMode.toLowerCase()} transactions.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border/30">
                                <TableHead>Date</TableHead>
                                <TableHead>Transaction ID</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {feeDetails.transactions.filter(tx => tx.category === activeMode).slice().reverse().map(tx => (
                                <TableRow key={tx.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border-border/20">
                                    <TableCell>{formatDate(tx.date as unknown as string)}</TableCell>
                                    <TableCell className="text-xs font-mono">{tx.id}</TableCell>
                                    <TableCell className="font-medium">₹{tx.amount.toLocaleString()}</TableCell>
                                    <TableCell>{getStatusBadge(tx.status)}</TableCell>
                                </TableRow>
                            ))}
                            {feeDetails.transactions.filter(tx => tx.category === activeMode).length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No {activeMode.toLowerCase()} transactions found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
