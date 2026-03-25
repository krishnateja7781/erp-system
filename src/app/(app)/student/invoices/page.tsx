
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Ticket, Eye, Download, Mail, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getStudentFeeDetails, type Transaction, type FeeRecord } from '@/actions/fee-actions';
import { InvoiceDisplay, type InvoiceData } from '@/components/student/invoice-display';
import { formatDate } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { sendInvoiceEmail } from '@/ai/flows/email-flow';
import { useAuthProtection } from '@/hooks/useAuthProtection';
import { useRouter } from 'next/navigation';

export default function StudentInvoicesPage() {
    const { toast } = useToast();
    const router = useRouter();
    const { currentUser, authIsLoading } = useAuthProtection('student');
    const [transactions, setTransactions] = React.useState<Transaction[]>([]);
    const [studentData, setStudentData] = React.useState<FeeRecord | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isInvoiceOpen, setIsInvoiceOpen] = React.useState(false);
    const [selectedInvoice, setSelectedInvoice] = React.useState<InvoiceData | null>(null);
    const [isSendingEmail, setIsSendingEmail] = React.useState(false);
    const invoiceRef = React.useRef<HTMLDivElement>(null);
    const [error, setError] = React.useState<string | null>(null);

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const initialCategory = searchParams.get('category') === 'hostel' ? 'Hostel' : 'College';
    const [activeMode, setActiveMode] = React.useState<'College' | 'Hostel'>(initialCategory);

    const loadData = React.useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        setError(null);
        try {
            const result = await getStudentFeeDetails(currentUser.id);
            if (result.success && result.data) {
                setStudentData(result.data);
                setTransactions(result.data.transactions);
            } else {
                setError(result.error || 'Failed to load invoice data.');
            }
        } catch (e: any) {
            setError("An unexpected error occurred.");
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

    const handleViewInvoice = (tx: Transaction) => {
        if (!studentData) return;
        setSelectedInvoice({
            studentName: studentData.studentName || 'Student',
            studentEmail: currentUser?.email || 'N/A',
            invoiceNumber: tx.id,
            transactionId: tx.id,
            transactionDate: formatDate(new Date(tx.date).toISOString()),
            issueDate: formatDate(new Date(tx.date).toISOString()),
            dueDate: formatDate(new Date(tx.date).toISOString()),
            totalAmount: tx.amount,
            items: [
                { description: `${tx.category} Fees for Year ${studentData.year}`, amount: tx.amount }
            ]
        });
        setIsInvoiceOpen(true);
    };

    const handleDownload = async () => {
        if (!invoiceRef.current || !selectedInvoice) {
            toast({ variant: "destructive", title: "Error", description: "Invoice content is not available." });
            return;
        }
        toast({ title: "Info", description: "Generating PDF..." });
        try {
            const canvas = await html2canvas(invoiceRef.current, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps = pdf.getImageProperties(imgData);
            const imgWidth = imgProps.width;
            const imgHeight = imgProps.height;
            const ratio = Math.min((pdfWidth - 80) / imgWidth, (pdfHeight - 80) / imgHeight);
            pdf.addImage(imgData, 'PNG', 40, 40, imgWidth * ratio, imgHeight * ratio);
            pdf.save(`invoice_${selectedInvoice.invoiceNumber}.pdf`);
            toast({ title: "Success", description: "Invoice downloaded." });
        } catch (e) {
            toast({ variant: "destructive", title: "Download Failed", description: "Could not generate PDF." });
        }
    };

    const handleEmail = async () => {
        if (!selectedInvoice) return;
        setIsSendingEmail(true);
        try {
            await sendInvoiceEmail(selectedInvoice);
            toast({ title: 'Email Sent', description: `Invoice sent to ${selectedInvoice.studentEmail}` });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Email Failed", description: e.message });
        }
        setIsSendingEmail(false);
    };

    if (isLoading || authIsLoading) {
        return <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading...</span></div>;
    }

    if (error) {
        return <div className="text-center text-destructive py-10"><AlertTriangle className="mx-auto h-12 w-12" /><h2 className="mt-4 text-lg font-semibold">Could not load invoices</h2><p className="text-sm">{error}</p><Button onClick={loadData} className="mt-4 gap-2" variant="outline"><RefreshCw className="h-4 w-4" />Retry</Button></div>;
    }

    const isHosteler = currentUser?.type === 'Hosteler';
    const filteredTransactions = transactions.filter(tx => tx.category === activeMode && tx.status === 'Success');

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-6 mb-6 text-white shadow-lg">
                <div className="relative z-10 flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()} className="bg-white/20 border-white/30 text-white hover:bg-white/30"><ArrowLeft className="h-4 w-4" /></Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">My Invoices</h1>
                        <p className="text-white/70 text-sm mt-1">View and download your fee payment receipts</p>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            {isHosteler && (
                <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as 'College' | 'Hostel')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                        <TabsTrigger value="College">College Invoices</TabsTrigger>
                        <TabsTrigger value="Hostel">Hostel Invoices</TabsTrigger>
                    </TabsList>
                </Tabs>
            )}

            <Card className="card-elevated">
                <CardHeader>
                    <CardTitle>Transaction Receipts</CardTitle>
                    <CardDescription>A list of all your successfully completed {activeMode.toLowerCase()} fee payments.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow className="border-border/30"><TableHead>Date</TableHead><TableHead>Transaction ID</TableHead><TableHead>Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {filteredTransactions.length > 0 ? filteredTransactions.map(tx => (
                                <TableRow key={tx.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border-border/20">
                                    <TableCell>{formatDate(new Date(tx.date).toISOString())}</TableCell>
                                    <TableCell className="text-xs font-mono">{tx.id}</TableCell>
                                    <TableCell>₹{tx.amount.toLocaleString()}</TableCell>
                                    <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => handleViewInvoice(tx)} className="gap-2"><Eye className="h-4 w-4" />View</Button></TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No successful {activeMode.toLowerCase()} transactions found.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isInvoiceOpen} onOpenChange={setIsInvoiceOpen}>
                <DialogContent className="max-w-3xl flex flex-col max-h-[90vh] p-0">
                    <DialogHeader className="p-4 sm:p-6 border-b print:hidden"><DialogTitle>Invoice Details</DialogTitle></DialogHeader>
                    <div className="flex-grow overflow-y-auto bg-white p-4 sm:p-6 print:p-0"><InvoiceDisplay ref={invoiceRef} invoiceData={selectedInvoice} /></div>
                    <DialogFooter className="p-4 sm:p-6 border-t print:hidden flex-shrink-0">
                        <Button variant="outline" onClick={handleEmail} disabled={isSendingEmail} className="gap-2">{isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Email</Button>
                        <Button onClick={handleDownload} className="gap-2"><Download className="h-4 w-4" />Download PDF</Button>
                        <DialogClose asChild><Button variant="secondary">Close</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
