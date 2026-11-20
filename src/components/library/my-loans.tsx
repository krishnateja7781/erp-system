'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getMyBookIssues, type BookIssue } from '@/actions/library-actions';

/** The signed-in student's / teacher's own loans (hidden when they have none). */
export function MyLoans() {
  const [loans, setLoans] = React.useState<BookIssue[] | null>(null);

  React.useEffect(() => {
    getMyBookIssues().then(setLoans).catch(() => setLoans([]));
  }, []);

  if (!loans || loans.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const open = loans.filter((l) => l.status === 'Issued');
  const fines = loans.reduce((sum, l) => sum + (l.fine || 0), 0);

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="text-lg">My loans</CardTitle>
        <CardDescription>
          {open.length} book{open.length === 1 ? '' : 's'} currently with you
          {fines > 0 ? ` · fines so far ₹${fines}` : ''}. Late returns cost ₹5 per day.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Book</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((l) => {
              const overdue = l.status === 'Issued' && l.dueDate < today;
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.bookTitle}</TableCell>
                  <TableCell>{l.issuedAt?.slice(0, 10)}</TableCell>
                  <TableCell>{l.dueDate}</TableCell>
                  <TableCell className="text-right">
                    {l.status === 'Returned' ? (
                      <Badge variant="secondary">Returned{l.fine > 0 ? ` · ₹${l.fine} fine` : ''}</Badge>
                    ) : overdue ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : (
                      <Badge>On loan</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
