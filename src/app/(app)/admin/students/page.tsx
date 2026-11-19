'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Loader2, GraduationCap, Eye, Edit, Trash2, PlusCircle, ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { getStudents, deleteStudent } from '@/actions/student-actions';
import { AddStudentDialog } from '@/components/admin/students/add-student-dialog';
import type { Student } from '@/lib/types';

type SortField = 'name' | 'collegeId' | 'program' | 'branch' | 'year' | 'status';
type SortDir = 'asc' | 'desc';

export default function AdminStudentsListPage() {
  const [allStudents, setAllStudents] = React.useState<Student[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingStudent, setEditingStudent] = React.useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField, setSortField] = React.useState<SortField>('name');
  const [sortDir, setSortDir] = React.useState<SortDir>('asc');
  const [filters, setFilters] = React.useState({ program: 'all', branch: 'all', year: 'all', status: 'all' });
  const [deleteTarget, setDeleteTarget] = React.useState<Student | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const loadStudents = React.useCallback(async () => {
    setIsLoading(true);
    try { setAllStudents(await getStudents()); }
    catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to load students.' }); }
    finally { setIsLoading(false); }
  }, []);

  React.useEffect(() => { loadStudents(); }, [loadStudents]);

  const handleAddNew = React.useCallback(() => { setEditingStudent(null); setIsDialogOpen(true); }, []);
  React.useEffect(() => {
    if (searchParams.get('action') === 'add') { handleAddNew(); router.replace('/admin/students', { scroll: false }); }
  }, [searchParams, router, handleAddNew]);

  // Derived filter options
  const programs = React.useMemo(() => ['all', ...new Set(allStudents.map(s => s.program).filter(Boolean) as string[])].sort(), [allStudents]);
  const branches = React.useMemo(() => {
    const src = filters.program !== 'all' ? allStudents.filter(s => s.program === filters.program) : allStudents;
    return ['all', ...Array.from(new Set(src.map(s => s.branch).filter(Boolean) as string[])).sort()];
  }, [filters.program, allStudents]);
  const years = React.useMemo(() => ['all', ...new Set(allStudents.map(s => s.year?.toString()).filter(Boolean) as string[])].sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : +a - +b), [allStudents]);
  const statuses = React.useMemo(() => ['all', ...new Set(allStudents.map(s => s.status).filter(Boolean) as string[])].sort(), [allStudents]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, ...(key === 'program' ? { branch: 'all', year: 'all' } : {}) }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 ml-1 text-primary" />;
  };

  const filteredStudents = React.useMemo(() => {
    const q = searchTerm.toLowerCase();
    return allStudents
      .filter(s => {
        const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.collegeId?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
        const matchProgram = filters.program === 'all' || s.program === filters.program;
        const matchBranch = filters.branch === 'all' || s.branch === filters.branch;
        const matchYear = filters.year === 'all' || s.year?.toString() === filters.year;
        const matchStatus = filters.status === 'all' || s.status === filters.status;
        return matchSearch && matchProgram && matchBranch && matchYear && matchStatus;
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        const av = (a as any)[sortField] ?? '';
        const bv = (b as any)[sortField] ?? '';
        if (sortField === 'year') return (Number(av) - Number(bv)) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
  }, [allStudents, searchTerm, filters, sortField, sortDir]);

  const getStatusBadge = (status?: string | null) => {
    switch ((status || '').toLowerCase()) {
      case 'active':           return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 border">Active</Badge>;
      case 'inactive':         return <Badge className="bg-slate-500/15 text-slate-500 border-slate-400/30 border">Inactive</Badge>;
      case 'suspended':        return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 border">Suspended</Badge>;
      case 'graduated':        return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 border">Graduated</Badge>;
      case 'pending approval': return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 border">Pending</Badge>;
      default:                 return <Badge variant="outline">{status || 'N/A'}</Badge>;
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteStudent(deleteTarget.id);
    if (result.success) {
      toast({ title: 'Student Removed', description: `${deleteTarget.name} has been deleted.` });
      loadStudents();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setDeleteTarget(null);
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none whitespace-nowrap group" onClick={() => handleSort(field)}>
      <span className="inline-flex items-center gap-0.5 group-hover:text-foreground transition-colors">
        {children}<SortIcon field={field} />
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-purple-500 p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Students</h1>
            <p className="text-white/70 text-sm mt-1">
              {allStudents.length} total · {allStudents.filter(s => s.status === 'Active').length} active
            </p>
          </div>
          <Button onClick={handleAddNew} className="gap-2 border-white/30 text-white hover:bg-white/10 bg-white/10 backdrop-blur-sm" variant="outline">
            <PlusCircle className="h-4 w-4" /> Add New Student
          </Button>
        </div>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      </div>

      {/* Filters + Table */}
      <Card className="card-elevated">
        <CardHeader className="pb-0 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input placeholder="Search name, USN, email…" className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Select value={filters.program} onValueChange={v => handleFilterChange('program', v)}>
              <SelectTrigger><SelectValue placeholder="All Programs" /></SelectTrigger>
              <SelectContent>{programs.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All Programs' : p}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.branch} onValueChange={v => handleFilterChange('branch', v)}>
              <SelectTrigger><SelectValue placeholder="All Branches" /></SelectTrigger>
              <SelectContent>{branches.map(b => <SelectItem key={b} value={b}>{b === 'all' ? 'All Branches' : b}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.year} onValueChange={v => handleFilterChange('year', v)}>
              <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y === 'all' ? 'All Years' : `Year ${y}`}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={v => handleFilterChange('status', v)}>
              <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="pt-4 px-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-3" /><p className="text-sm">Loading students…</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground border-2 border-dashed rounded-xl mx-6 mb-2">
              <GraduationCap className="h-12 w-12 mb-3 opacity-40" />
              <p className="font-medium">No students found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="w-10 pl-6">#</TableHead>
                    <SortHeader field="name">Student</SortHeader>
                    <SortHeader field="collegeId">USN</SortHeader>
                    <SortHeader field="program">Program</SortHeader>
                    <SortHeader field="branch">Branch</SortHeader>
                    <SortHeader field="year">Year</SortHeader>
                    <TableHead>Section</TableHead>
                    <SortHeader field="status">Status</SortHeader>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student, idx) => (
                    <TableRow key={student.id} className="border-border/30 hover:bg-muted/40 transition-colors group">
                      <TableCell className="pl-6 text-xs text-muted-foreground tabular-nums w-10">{idx + 1}</TableCell>
                      <TableCell className="min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0 border border-border/50">
                            <AvatarImage src={(student as any).avatarUrl} />
                            <AvatarFallback className="text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                              {student.name?.slice(0, 2).toUpperCase() ?? '??'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm leading-tight truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{student.name || '—'}</p>
                            {student.email && <p className="text-xs text-muted-foreground truncate">{student.email}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{student.collegeId || '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{student.program || '—'}</TableCell>
                      <TableCell>
                        {student.branch ? (
                          <Badge variant="outline" className="text-xs font-medium border-violet-300/50 text-violet-700 dark:text-violet-300 bg-violet-50/50 dark:bg-violet-950/30">{student.branch}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-center">
                        {student.year ? <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-semibold">{student.year}</span> : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-center">
                        {student.section ? <span className="font-mono font-medium">{student.section}</span> : '—'}
                      </TableCell>
                      <TableCell>{getStatusBadge(student.status)}</TableCell>

                      {/* ── Actions: single dropdown ── */}
                      <TableCell className="text-right pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
                              View Student <MoreHorizontal className="h-3.5 w-3.5 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push(`/admin/students/${student.id}`)}>
                              <Eye className="h-4 w-4" /> View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => { setEditingStudent(student); setIsDialogOpen(true); }}>
                              <Edit className="h-4 w-4" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setDeleteTarget(student)}>
                              <Trash2 className="h-4 w-4" /> Delete Student
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        <CardFooter className="border-t border-border/30 pt-3 pb-3 px-6">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredStudents.length}</span> of{' '}
            <span className="font-semibold text-foreground">{allStudents.length}</span> students
            {(searchTerm || Object.values(filters).some(v => v !== 'all')) && ' · filtered'}
          </p>
        </CardFooter>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name} ({deleteTarget?.collegeId})</strong> and revoke their login access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddStudentDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} onSave={loadStudents} initialData={editingStudent} />
    </div>
  );
}
