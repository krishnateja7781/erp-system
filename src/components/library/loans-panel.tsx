'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, BookUp, Undo2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getActiveIssues, getBooks, issueBook, returnBook, type BookIssue } from '@/actions/library-actions';
import type { Book } from '@/lib/types';

/** Librarian tools: issue a copy to a borrower and record returns (fines computed in SQL). */
export function LoansPanel({ books: booksProp, onChanged }: { books?: Book[]; onChanged?: () => void }) {
  // When the parent doesn't supply the catalogue (e.g. the admin manage page), load and refresh it here.
  const [ownBooks, setOwnBooks] = React.useState<Book[]>([]);
  const refreshBooks = React.useCallback(() => {
    if (!booksProp) getBooks().then(setOwnBooks).catch(() => {});
  }, [booksProp]);
  React.useEffect(() => { refreshBooks(); }, [refreshBooks]);
  const books = booksProp ?? ownBooks;
  const { toast } = useToast();
  const [loans, setLoans] = React.useState<BookIssue[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [bookId, setBookId] = React.useState('');
  const [borrower, setBorrower] = React.useState('');
  const [days, setDays] = React.useState('14');
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      setLoans(await getActiveIssues());
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load active loans.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { load(); }, [load]);

  const issuable = books.filter((b) => b.source !== 'digital' && b.available_copies > 0);

  const onIssue = async () => {
    if (!bookId || !borrower.trim()) {
      toast({ variant: 'destructive', title: 'Missing details', description: 'Choose a book and enter the borrower ID or email.' });
      return;
    }
    setBusy('issue');
    const res = await issueBook(bookId, borrower.trim(), Number(days) || 14);
    setBusy(null);
    if (!res.success) {
      toast({ variant: 'destructive', title: 'Could not issue', description: res.error });
      return;
    }
    toast({ title: 'Issued', description: res.message });
    setBorrower('');
    setBookId('');
    await load();
    refreshBooks();
    onChanged?.();
  };

  const onReturn = async (issueId: string) => {
    setBusy(issueId);
    const res = await returnBook(issueId);
    setBusy(null);
    if (!res.success) {
      toast({ variant: 'destructive', title: 'Could not record return', description: res.error });
      return;
    }
    toast({ title: 'Returned', description: res.message });
    await load();
    refreshBooks();
    onChanged?.();
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="text-lg">Loans</CardTitle>
        <CardDescription>Issue physical copies and record returns. Late returns accrue a fine automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-[2fr_2fr_1fr_auto] items-end">
          <div className="space-y-1">
            <Label>Book</Label>
            <Select value={bookId} onValueChange={setBookId}>
              <SelectTrigger><SelectValue placeholder={issuable.length ? 'Select a book' : 'No copies available'} /></SelectTrigger>
              <SelectContent>
                {issuable.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.title} ({b.available_copies} left)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="borrower">Borrower ID or email</Label>
            <Input id="borrower" value={borrower} onChange={(e) => setBorrower(e.target.value)} placeholder="e.g. ENG24CS00001" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="days">Days</Label>
            <Input id="days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <Button onClick={onIssue} disabled={busy === 'issue'} className="gap-2">
            {busy === 'issue' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookUp className="h-4 w-4" />}Issue
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : loans.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No books are currently on loan.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.bookTitle}</TableCell>
                    <TableCell>{l.borrowerName}{l.borrowerCode ? <span className="text-xs text-muted-foreground"> · {l.borrowerCode}</span> : null}</TableCell>
                    <TableCell>
                      {l.dueDate}{' '}
                      {l.dueDate < today && <Badge variant="destructive" className="ml-1">Overdue</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => onReturn(l.id)} disabled={busy === l.id}>
                        {busy === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}Return
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
