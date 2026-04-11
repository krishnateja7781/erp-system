'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, GraduationCap, Loader2, Eye, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getStudents } from '@/actions/student-actions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function EmployeeStudentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [students, setStudents] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [programFilter, setProgramFilter] = React.useState('all');
  const [branchFilter, setBranchFilter] = React.useState('all');
  const [typeFilter, setTypeFilter] = React.useState('all');

  const effectRan = React.useRef(false);
  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await getStudents();
        setStudents(data);
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load students.' });
      } finally {
        setIsLoading(false);
      }
    }
    if (!effectRan.current) {
        load();
        effectRan.current = true;
    }
  }, []);

  const programs = ['all', ...Array.from(new Set(students.map(s => s.program).filter(Boolean)))];
  const branches = ['all', ...Array.from(new Set(students.map(s => s.branch).filter(Boolean)))];

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return students.filter(s => {
      const searchMatch = !search || s.name?.toLowerCase().includes(q) || s.collegeId?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
      const programMatch = programFilter === 'all' || s.program === programFilter;
      const branchMatch = branchFilter === 'all' || s.branch === branchFilter;
      const typeMatch = typeFilter === 'all' || s.type === typeFilter;
      return searchMatch && programMatch && branchMatch && typeMatch;
    });
  }, [students, search, programFilter, branchFilter, typeFilter]);

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Students Directory</h1>
            <p className="text-white/80 text-sm mt-2">Browse and view all enrolled students across all programs.</p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium">
              <GraduationCap className="h-3.5 w-3.5" />
              {students.length} Total Students
            </div>
          </div>
          <GraduationCap className="h-20 w-20 opacity-10" />
        </div>
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
      </div>

      {/* Filters */}
      <Card className="card-elevated">
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or email..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Program" /></SelectTrigger>
              <SelectContent>
                {programs.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All Programs' : p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>
                {branches.map(b => <SelectItem key={b} value={b}>{b === 'all' ? 'All Branches' : b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Hosteler">Hosteler</SelectItem>
                <SelectItem value="Day Scholar">Day Scholar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="card-elevated">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {isLoading ? 'Loading...' : `${filtered.length} student${filtered.length !== 1 ? 's' : ''} found`}
          </CardTitle>
          <CardDescription>Click "View Profile" to see full student details.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground w-full">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Loading records...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground w-full border-2 border-dashed rounded-xl">
              <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium">No students found.</p>
              <p className="text-sm">Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-2">
              {filtered.map(s => (
                <Card key={s.id} className="flex flex-col overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 card-elevated group relative bg-card/60 backdrop-blur-sm border-border/50">
                  <div className="h-24 bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                  </div>
                  <div className="px-5 pt-0 pb-5 flex-1 flex flex-col">
                    <div className="-mt-12 mb-3 flex justify-between items-end relative z-10">
                       <Avatar className="h-20 w-20 border-4 border-background shadow-md bg-muted">
                         <AvatarImage src={s.avatarUrl} />
                         <AvatarFallback className="text-xl font-bold">{s.name?.substring(0,2).toUpperCase()}</AvatarFallback>
                       </Avatar>
                       <Badge variant="outline" className={`bg-background/80 backdrop-blur-sm border shadow-sm ${s.type === 'Hosteler' ? 'border-blue-300 text-blue-700 dark:text-blue-300 dark:border-blue-800' : ''}`}>
                         {s.type}
                       </Badge>
                    </div>
                    <h3 className="font-bold text-lg leading-tight truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={s.name}>{s.name}</h3>
                    <p className="text-sm font-mono text-muted-foreground mb-4">{s.collegeId}</p>
                    
                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm mt-1 mb-5 flex-1">
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Program</span>
                         <span className="font-medium truncate">{s.program}</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Branch</span>
                         <span className="font-medium truncate">{s.branch || '—'}</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Year</span>
                         <span className="font-medium">Year {s.year}</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">Status</span>
                         <span className="font-medium flex items-center gap-1.5 flex-wrap"><div className={`w-1.5 h-1.5 rounded-full ${s.status === 'Active' ? 'bg-green-500' : 'bg-gray-500'}`} />{s.status}</span>
                       </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-border/50">
                       <Button 
                         className="w-full gap-2 bg-blue-50/50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800" 
                         variant="secondary"
                         onClick={() => router.push(`/admin/students/${s.id}`)}
                       >
                         <Eye className="h-4 w-4" /> View Profile
                       </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
