'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, GraduationCap, Loader2, Eye, MoreHorizontal } from "lucide-react";
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
    if (!effectRan.current) {
      effectRan.current = true;
      (async () => {
        setIsLoading(true);
        try { setStudents(await getStudents()); }
        catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to load students.' }); }
        finally { setIsLoading(false); }
      })();
    }
  }, []);

  const programs = ['all', ...Array.from(new Set(students.map(s => s.program).filter(Boolean)))];
  const branches = ['all', ...Array.from(new Set(students.map(s => s.branch).filter(Boolean)))];

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return students.filter(s =>
      (!search || s.name?.toLowerCase().includes(q) || s.collegeId?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q))
      && (programFilter === 'all' || s.program === programFilter)
      && (branchFilter === 'all' || s.branch === branchFilter)
      && (typeFilter === 'all' || s.type === typeFilter)
    );
  }, [students, search, programFilter, branchFilter, typeFilter]);

  const getStatusBadge = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'active':   return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 border">Active</Badge>;
      case 'inactive': return <Badge className="bg-slate-500/15 text-slate-500 border-slate-400/30 border">Inactive</Badge>;
      default:         return <Badge variant="outline">{status || 'N/A'}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-6 text-white shadow-xl">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight">Students Directory</h1>
          <p className="text-white/70 text-sm mt-1">{students.length} total students enrolled</p>
        </div>
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      </div>

      <Card className="card-elevated">
        <CardHeader className="pb-0 pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, ID or email…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Programs" /></SelectTrigger>
              <SelectContent>{programs.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All Programs' : p}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Branches" /></SelectTrigger>
              <SelectContent>{branches.map(b => <SelectItem key={b} value={b}>{b === 'all' ? 'All Branches' : b}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Hosteler">Hosteler</SelectItem>
                <SelectItem value="Day Scholar">Day Scholar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-4 px-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-3" /><p className="text-sm">Loading students…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-xl mx-4 mb-2">
              <GraduationCap className="h-12 w-12 opacity-30 mb-2" />
              <p className="font-medium">No students found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="w-10 pl-6">#</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>USN</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, idx) => (
                    <TableRow key={s.id} className="border-border/30 hover:bg-muted/40 transition-colors group">
                      <TableCell className="pl-6 text-xs text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0 border border-border/50">
                            <AvatarImage src={s.avatarUrl} />
                            <AvatarFallback className="text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              {s.name?.slice(0, 2).toUpperCase() ?? '??'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate group-hover:text-blue-600 transition-colors">{s.name || '—'}</p>
                            {s.email && <p className="text-xs text-muted-foreground truncate">{s.email}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.collegeId || '—'}</TableCell>
                      <TableCell className="text-sm">{s.program || '—'}</TableCell>
                      <TableCell>
                        {s.branch ? <Badge variant="outline" className="text-xs border-blue-300/50 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30">{s.branch}</Badge> : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-center">
                        {s.year ? <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-semibold">{s.year}</span> : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.type || '—'}</TableCell>
                      <TableCell>{getStatusBadge(s.status)}</TableCell>
                      <TableCell className="text-right pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
                              View Student <MoreHorizontal className="h-3.5 w-3.5 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push(`/admin/students/${s.id}`)}>
                              <Eye className="h-4 w-4" /> View Profile
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
          <p className="text-xs text-muted-foreground">Showing <strong>{filtered.length}</strong> of <strong>{students.length}</strong> students</p>
        </CardFooter>
      </Card>
    </div>
  );
}
