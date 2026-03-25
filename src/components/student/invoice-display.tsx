
'use client';

import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

export interface InvoiceData {
  studentName: string;
  studentEmail: string;
  invoiceNumber: string;
  transactionId?: string;
  transactionDate?: string;
  issueDate: string;
  dueDate: string;
  items: { description: string; amount: number }[];
  totalAmount: number;
}

interface InvoiceDisplayProps {
  invoiceData: InvoiceData | null;
}

export const InvoiceDisplay = React.forwardRef<HTMLDivElement, InvoiceDisplayProps>(
  ({ invoiceData }, ref) => {
    if (!invoiceData) {
      return <div ref={ref} className="p-6 text-center">Invoice data is not available.</div>;
    }

    return (
      <div ref={ref} className="p-10 bg-white text-slate-800 font-sans max-w-3xl mx-auto shadow-sm border border-slate-100 rounded-sm">
        <header className="flex justify-between items-start mb-12 border-b-2 border-primary/20 pb-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-extrabold text-primary tracking-tight">SSN Student Hub</h1>
            <p className="text-sm text-slate-500 font-medium">OMR, Rajiv Gandhi Salai, Kalavakkam</p>
            <p className="text-sm text-slate-500 font-medium">Chennai, Tamil Nadu 603110</p>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-black text-slate-200 uppercase tracking-widest mb-2">Invoice</h2>
            <div className="flex justify-end">
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 text-xs px-3 py-1 font-bold uppercase tracking-wider">Paid in Full</Badge>
            </div>
          </div>
        </header>

        <section className="mb-12">
          <div className="rounded-lg border border-slate-200 overflow-hidden flex flex-col md:flex-row">
            <div className="w-full md:w-1/2 p-6 bg-slate-50/50 border-b md:border-b-0 md:border-r border-slate-200">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Billed To</h3>
              <p className="font-semibold text-lg text-slate-800">{invoiceData.studentName}</p>
              <p className="text-sm text-slate-600 font-medium">{invoiceData.studentEmail}</p>
            </div>
            <div className="w-full md:w-1/2 flex flex-col">
              <div className="flex-1 p-5 px-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-2 xl:gap-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Transaction ID</p>
                <p className="font-mono text-[13px] text-slate-800 font-semibold xl:text-right break-all">
                  {invoiceData.transactionId || invoiceData.invoiceNumber.split('-')[0].toUpperCase()}
                </p>
              </div>
              <div className="flex-1 p-5 px-6 flex items-center justify-between gap-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Transaction Date</p>
                <p className="text-[14px] text-slate-800 font-medium text-right">
                  {invoiceData.transactionDate || invoiceData.issueDate}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 border-b-slate-200">
                  <TableHead className="w-[70%] font-bold text-slate-600 uppercase text-xs tracking-wider">Description</TableHead>
                  <TableHead className="text-right font-bold text-slate-600 uppercase text-xs tracking-wider">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceData.items.map((item, index) => (
                  <TableRow key={index} className="border-b-slate-100 hover:bg-transparent">
                    <TableCell className="py-4 text-slate-700 font-medium">{item.description}</TableCell>
                    <TableCell className="py-4 text-right font-semibold text-slate-900">₹{item.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="flex justify-end pt-6 border-t border-slate-200">
          <div className="w-2/3 md:w-1/2 space-y-3">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span className="font-medium">₹{invoiceData.totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Tax (0%)</span>
              <span className="font-medium">₹0</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-center text-xl">
              <span className="font-bold text-slate-800">Total Paid</span>
              <span className="font-black text-primary">₹{invoiceData.totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-slate-100 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-600">Thank you for your payment!</p>
          <p className="text-xs text-slate-400">For any queries regarding this invoice, please contact <span className="text-primary font-medium">accounts@ssn.edu.in</span></p>
          <p className="text-[10px] text-slate-300 font-mono mt-4">Document generated computationally.</p>
        </footer>
      </div>
    );
  }
);
InvoiceDisplay.displayName = "InvoiceDisplay";
