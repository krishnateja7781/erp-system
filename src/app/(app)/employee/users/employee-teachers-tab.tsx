'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Search, Loader2, UserPlus } from "lucide-react";
import { getTeachers } from '@/actions/staff-actions';
import { useToast } from '@/hooks/use-toast';
import type { StaffMember } from '@/lib/types';
import { AddStaffDialog } from '@/components/admin/staff/add-staff-dialog';

export function EmployeeTeachersTab() {
  const [teachers, setTeachers] = React.useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = React.useState(true); 
  const [search, setSearch] = React.useState('');
  const [isAddStaffDialogOpen, setIsAddStaffDialogOpen] = React.useState(false);
  const { toast } = useToast();

  const loadTeachers = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getTeachers();
      setTeachers(data);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load teachers.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]); 

  React.useEffect(() => {
    loadTeachers();
  }, [loadTeachers]); 

  const filteredTeachers = React.useMemo(() => {
    return teachers.filter(t => {
      const lower = search.toLowerCase();
      return !search || (t.name?.toLowerCase().includes(lower)) || (t.staffId?.toLowerCase().includes(lower)) || (t.department?.toLowerCase().includes(lower));
    });
  }, [teachers, search]);

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">N/A</Badge>;
    switch (status.toLowerCase()) {
        case 'active': return <Badge variant="default" className="bg-green-600">Active</Badge>;
        case 'inactive': return <Badge className="bg-indigo-100 text-indigo-700">Inactive</Badge>;
        case 'on leave': return <Badge variant="secondary" className="bg-yellow-500 text-black">On Leave</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="card-elevated border-l-4 border-l-orange-500">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-xl text-orange-700 dark:text-orange-500">Teacher Directory</CardTitle>
              <CardDescription>Manage teaching staff across all departments</CardDescription>
            </div>
            <Button onClick={() => setIsAddStaffDialogOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white shadow-md">
              <UserPlus className="mr-2 h-4 w-4" /> Add New Teacher
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1 max-w-sm border-orange-200">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-orange-500" />
              <Input
                placeholder="Search teachers by name, ID, or department..."
                className="pl-9 focus-visible:ring-orange-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-md border border-orange-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-orange-50 dark:bg-orange-950/20">
                <TableRow>
                  <TableHead className="font-semibold text-orange-900 dark:text-orange-400">ID</TableHead>
                  <TableHead className="font-semibold text-orange-900 dark:text-orange-400">Name</TableHead>
                  <TableHead className="font-semibold text-orange-900 dark:text-orange-400">Department</TableHead>
                  <TableHead className="font-semibold text-orange-900 dark:text-orange-400">Program</TableHead>
                  <TableHead className="font-semibold text-orange-900 dark:text-orange-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-2" />
                        <span className="text-sm text-muted-foreground">Loading teachers...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredTeachers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No teachers found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <TableRow key={teacher.id} className="hover:bg-orange-50/50 dark:hover:bg-orange-900/10">
                      <TableCell className="font-medium text-orange-700 dark:text-orange-400">{teacher.staffId || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="font-medium">{teacher.name}</div>
                        <div className="text-xs text-muted-foreground">{teacher.email}</div>
                      </TableCell>
                      <TableCell>{teacher.department || 'N/A'}</TableCell>
                      <TableCell>{teacher.program || 'N/A'}</TableCell>
                      <TableCell>{getStatusBadge(teacher.status || null)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {isAddStaffDialogOpen && (
        <AddStaffDialog 
          isOpen={isAddStaffDialogOpen} 
          onOpenChange={setIsAddStaffDialogOpen} 
          onStaffAdded={loadTeachers}
          mode="teacher"
        />
      )}
    </div>
  );
}
