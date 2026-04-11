
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Loader2, AlertTriangle, MoreHorizontal, Eye, Edit, Trash2, PlusCircle, GraduationCap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from '@/hooks/use-toast';
import { getStudents, deleteStudent } from '@/actions/student-actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AddStudentDialog } from '@/components/admin/students/add-student-dialog';
import type { Student } from '@/lib/types';


async function fetchStudents(): Promise<Student[]> {
  console.log("AdminStudentsListPage: fetchStudents - Attempting to fetch via server action...");
  const students = await getStudents();
  return students;
}


export default function AdminStudentsListPage() {
  const [allStudents, setAllStudents] = React.useState<Student[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingStudent, setEditingStudent] = React.useState<Student | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [filters, setFilters] = React.useState({
    program: 'all',
    branch: 'all',
    year: 'all',
    status: 'all',
  });

  const router = useRouter();
  const searchParams = useSearchParams();

  const loadStudents = React.useCallback(async () => {
    console.log("AdminStudentsListPage: loadStudents callback invoked.");
    setIsLoading(true);
    setError(null);
    try {
      const studentData = await fetchStudents();
      setAllStudents(studentData);
    } catch (e: any) {
      setError(e.message || "Failed to load student data.");
      setAllStudents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const programs = React.useMemo(() => ['all', ...new Set(allStudents.map(s => s.program).filter(Boolean) as string[])].sort(), [allStudents]);

  const branches = React.useMemo(() => {
    let relevantStudents = allStudents;
    if (filters.program !== 'all') {
      relevantStudents = allStudents.filter(s => s.program === filters.program);
    }
    const programBranches = new Set(relevantStudents.map(s => s.branch).filter(b => typeof b === 'string' && b.trim().length > 0) as string[]);
    return ['all', ...Array.from(programBranches)].sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b));
  }, [filters.program, allStudents]);

  const years = React.useMemo(() => ['all', ...new Set(allStudents.map(s => s.year?.toString()).filter(Boolean) as string[])].sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : parseInt(a) - parseInt(b)), [allStudents]);
  const statuses = React.useMemo(() => ['all', ...new Set(allStudents.map(s => s.status).filter(Boolean) as string[])].sort(), [allStudents]);

  const filteredStudents = React.useMemo(() => {
    return allStudents.filter(student => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const nameMatch = student.name && student.name.toLowerCase().includes(lowerSearchTerm);
      const idMatch = student.id && student.id.toLowerCase().includes(lowerSearchTerm);
      const collegeIdMatch = student.collegeId && student.collegeId.toLowerCase().includes(lowerSearchTerm);
      const searchMatch = !searchTerm || nameMatch || idMatch || collegeIdMatch;

      const programMatch = filters.program === 'all' || student.program === filters.program;
      const branchMatch = filters.branch === 'all' || student.branch === filters.branch;
      const yearMatch = filters.year === 'all' || (student.year && student.year.toString() === filters.year);
      const statusMatch = filters.status === 'all' || student.status === filters.status;
      return searchMatch && programMatch && branchMatch && yearMatch && statusMatch;
    });
  }, [allStudents, searchTerm, filters]);

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev, [filterName]: value };
      if (filterName === 'program') {
        newFilters.branch = 'all';
        newFilters.year = 'all';
      }
      return newFilters;
    });
  };

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) return <Badge variant="outline">N/A</Badge>;
    switch (status.toLowerCase()) {
      case 'active': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Active</Badge>;
      case 'inactive': return <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-0">Inactive</Badge>;
      case 'suspended': return <Badge variant="destructive">Suspended</Badge>;
      case 'graduated': return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">Graduated</Badge>;
      case 'pending approval': return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-black">Pending</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleAddNew = React.useCallback(() => {
    setEditingStudent(null);
    setIsDialogOpen(true);
  }, []);

  React.useEffect(() => {
    if (searchParams.get('action') === 'add') {
      handleAddNew();
      router.replace('/admin/students', { scroll: false });
    }
  }, [searchParams, router, handleAddNew]);

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setIsDialogOpen(true);
  };

  const confirmDelete = async (studentId: string, studentName: string | null) => {
    const result = await deleteStudent(studentId);
    if (result.success) {
      toast({ title: "Success", description: result.message || `Student ${studentName} deleted.` });
      loadStudents();
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error || "Failed to delete student." });
    }
  };

  if (isLoading && allStudents.length === 0) {
    return <div className="flex justify-center items-center h-64" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="ml-3 font-medium text-muted-foreground">Loading Students...</span></div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-purple-500 p-6 mb-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Manage Students</h1>
            <p className="text-white/70 text-sm mt-1">View, add, and manage all student records</p>
          </div>
          <Button onClick={handleAddNew} className="flex items-center gap-2 border-white/30 text-white hover:bg-white/10 bg-white/10 backdrop-blur-sm" variant="outline">
            <PlusCircle className="h-4 w-4" />
            <span>Add New Student</span>
          </Button>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      </div>
      <Card className="card-elevated">
        <CardHeader>
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Name, Student ID..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filters.program} onValueChange={(value) => handleFilterChange('program', value)}>
              <SelectTrigger><SelectValue placeholder="Program" /></SelectTrigger>
              <SelectContent>{programs.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All Programs' : p}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.branch} onValueChange={(value) => handleFilterChange('branch', value)} disabled={filters.program === 'all' && branches.length <= 1}>
              <SelectTrigger disabled={filters.program === 'all' && branches.length <= 1}><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>{branches.map(b => <SelectItem key={b} value={b}>{b === 'all' ? 'All Branches' : b}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.year} onValueChange={(value) => handleFilterChange('year', value)}>
              <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y === 'all' ? 'All Years' : `Year ${y}`}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground w-full">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Loading students...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground w-full border-2 border-dashed rounded-xl">
              <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium">No students found matching criteria.</p>
              <p className="text-sm">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-2">
              {filteredStudents.map(student => (
                <Card key={student.id} className="flex flex-col overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 card-elevated group relative bg-card/60 backdrop-blur-sm border-border/50">
                  <div className="h-24 bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-600 relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                  </div>
                  <div className="px-5 pt-0 pb-5 flex-1 flex flex-col">
                    <div className="-mt-12 mb-3 flex justify-between items-end relative z-10">
                       <Avatar className="h-20 w-20 border-4 border-background shadow-md bg-muted">
                         <AvatarImage src={(student as any).avatarUrl} />
                         <AvatarFallback className="text-xl font-bold">{student.name?.substring(0,2).toUpperCase()}</AvatarFallback>
                       </Avatar>
                       <div className="shadow-sm">{getStatusBadge(student.status)}</div>
                    </div>
                    <h3 className="font-bold text-lg leading-tight truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" title={student.name}>{student.name}</h3>
                    <p className="text-sm font-mono text-muted-foreground mb-4">{student.collegeId}</p>
                    
                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm mt-1 mb-5 flex-1">
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Program</span>
                         <span className="font-medium truncate">{student.program}</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Branch</span>
                         <span className="font-medium truncate">{student.branch || '—'}</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Year</span>
                         <span className="font-medium">{student.year ? `Year ${student.year}` : '—'}</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Section</span>
                         <span className="font-medium">{student.section || '—'}</span>
                       </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-2 mt-auto pt-4 border-t border-border/50">
                       <AlertDialog>
                         <AlertDialogTrigger asChild>
                           <Button variant="outline" size="icon" className="h-9 w-9 text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30 flex-shrink-0" title="Delete Student">
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </AlertDialogTrigger>
                         <AlertDialogContent>
                           <AlertDialogHeader>
                             <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                             <AlertDialogDescription>
                               This will permanently delete the student profile for <span className="font-semibold">{student.name} ({student.collegeId})</span> and all associated data.
                             </AlertDialogDescription>
                           </AlertDialogHeader>
                           <AlertDialogFooter>
                             <AlertDialogCancel>Cancel</AlertDialogCancel>
                             <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmDelete(student.id, student.name || null)}>Delete</AlertDialogAction>
                           </AlertDialogFooter>
                         </AlertDialogContent>
                       </AlertDialog>
                       
                       <Button 
                         className="flex-1 gap-2 bg-purple-50/50 hover:bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/30 dark:hover:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800"
                         variant="secondary"
                         onClick={() => handleEdit(student)}
                       >
                         <Edit className="h-4 w-4" /> Edit
                       </Button>
                       
                       <Button 
                         className="flex-1 gap-2"
                         variant="default"
                         onClick={() => router.push(`/admin/students/${student.id}`)}
                       >
                         <Eye className="h-4 w-4" /> View
                       </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">Showing {filteredStudents.length} of {allStudents.length} students. Use search and filters for specific results.</p>
        </CardFooter>
      </Card>
      <AddStudentDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={loadStudents}
        initialData={editingStudent}
      />
    </div>
  );
}
