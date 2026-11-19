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
import { Search, Users, Loader2, Mail, Building, Briefcase, Eye, MoreHorizontal } from "lucide-react";
import { getStaff } from '@/actions/staff-actions';
import { useToast } from '@/hooks/use-toast';

export default function EmployeeTeachersPage() {
  const { toast } = useToast();
  const [teachers, setTeachers] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [deptFilter, setDeptFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const effectRan = React.useRef(false);
  React.useEffect(() => {
    if (!effectRan.current) {
      effectRan.current = true;
      (async () => {
        setIsLoading(true);
        try { setTeachers((await getStaff()).filter((s: any) => s.role === 'teacher')); }
        catch { toast({ variant: 'destructive', title: 'Error', description: 'Failed to load teachers.' }); }
        finally { setIsLoading(false); }
      })();
    }
  }, []);

  const departments = ['all', ...Array.from(new Set(teachers.map(t => t.department).filter(Boolean))).sort()];
  const statuses = ['all', ...Array.from(new Set(teachers.map(t => t.status).filter(Boolean)))];

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return teachers.filter(t =>
      (!search || t.name?.toLowerCase().includes(q) || t.staffId?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q))
      && (deptFilter === 'all' || t.department === deptFilter)
      && (statusFilter === 'all' || t.status === statusFilter)
    );
  }, [teachers, search, deptFilter, statusFilter]);

  const getStatusBadge = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'active':   return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 border">Active</Badge>;
      case 'inactive': return <Badge className="bg-slate-500/15 text-slate-500 border-slate-400/30 border">Inactive</Badge>;
      case 'on leave': return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 border">On Leave</Badge>;
      default:         return <Badge variant="outline">{status || 'N/A'}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 p-6 text-white shadow-xl">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight">Teachers Directory</h1>
          <p className="text-white/70 text-sm mt-1">{teachers.length} total teaching staff</p>
        </div>
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      </div>

      {/* Filters + Table */}
      <Card className="card-elevated">
        <CardHeader className="pb-0 pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, staff ID or email…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d === 'all' ? 'All Departments' : d}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Status' : s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="pt-4 px-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-3" /><p className="text-sm">Loading teachers…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-xl mx-4 mb-2">
              <Users className="h-12 w-12 opacity-30 mb-2" />
              <p className="font-medium">No teachers found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="w-10 pl-6">#</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Staff ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t, idx) => (
                    <TableRow key={t.id} className="border-border/30 hover:bg-muted/40 transition-colors group">
                      <TableCell className="pl-6 text-xs text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0 border border-border/50">
                            <AvatarImage src={t.avatarUrl} />
                            <AvatarFallback className="text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                              {t.name?.slice(0, 2).toUpperCase() ?? '??'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{t.name || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{t.staffId || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {t.department ? (
                          <span className="inline-flex items-center gap-1.5"><Building className="h-3.5 w-3.5 text-muted-foreground" />{t.department}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.position ? <span className="inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" />{t.position}</span> : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                        {t.email ? <span className="inline-flex items-center gap-1.5 truncate"><Mail className="h-3.5 w-3.5 flex-shrink-0" />{t.email}</span> : '—'}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
                              View Teacher <MoreHorizontal className="h-3.5 w-3.5 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem className="gap-2 cursor-pointer">
                              <Eye className="h-4 w-4" /> View Details
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
          <p className="text-xs text-muted-foreground">Showing <strong>{filtered.length}</strong> of <strong>{teachers.length}</strong> teachers</p>
        </CardFooter>
      </Card>
    </div>
  );
}
