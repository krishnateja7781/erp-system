'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Users, Loader2, Eye, Mail, Phone, Building, Briefcase } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    async function load() {
      setIsLoading(true);
      try {
        const data = await getStaff();
        setTeachers(data.filter((s: any) => s.role === 'teacher'));
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load teachers.' });
      } finally {
        setIsLoading(false);
      }
    }
    if (!effectRan.current) {
        load();
        effectRan.current = true;
    }
  }, []);

  const departments = ['all', ...Array.from(new Set(teachers.map(t => t.department).filter(Boolean)))];
  const statuses = ['all', ...Array.from(new Set(teachers.map(t => t.status).filter(Boolean)))];

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return teachers.filter(t => {
      const searchMatch = !search || t.name?.toLowerCase().includes(q) || t.staffId?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q);
      const deptMatch = deptFilter === 'all' || t.department === deptFilter;
      const statusMatch = statusFilter === 'all' || t.status === statusFilter;
      return searchMatch && deptMatch && statusMatch;
    });
  }, [teachers, search, deptFilter, statusFilter]);

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Teachers Directory</h1>
            <p className="text-white/80 text-sm mt-2">Browse all registered teaching staff members.</p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium">
              <Users className="h-3.5 w-3.5" />
              {teachers.length} Total Teachers
            </div>
          </div>
          <Users className="h-20 w-20 opacity-10" />
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
                placeholder="Search by name, staff ID, or email..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                {departments.map(d => <SelectItem key={d} value={d}>{d === 'all' ? 'All Departments' : d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {statuses.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Status' : s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="card-elevated">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {isLoading ? 'Loading...' : `${filtered.length} teacher${filtered.length !== 1 ? 's' : ''} found`}
          </CardTitle>
          <CardDescription>View teacher details and contact information.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground w-full">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Loading records...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground w-full border-2 border-dashed rounded-xl">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium">No teachers found.</p>
              <p className="text-sm">Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-2">
              {filtered.map(t => (
                <Card key={t.id} className="flex flex-col overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 card-elevated group relative bg-card/60 backdrop-blur-sm border-border/50">
                  <div className="h-24 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                  </div>
                  <div className="px-5 pt-0 pb-5 flex-1 flex flex-col">
                    <div className="-mt-12 mb-3 flex justify-between items-end relative z-10">
                       <Avatar className="h-20 w-20 border-4 border-background shadow-md bg-muted">
                         <AvatarImage src={t.avatarUrl} />
                         <AvatarFallback className="text-xl font-bold">{t.name?.substring(0,2).toUpperCase()}</AvatarFallback>
                       </Avatar>
                       <Badge className={`border shadow-sm text-xs font-semibold ${t.status === 'Active' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-500 text-white'}`}>
                         {t.status || 'Active'}
                       </Badge>
                    </div>
                    <h3 className="font-bold text-lg leading-tight truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors" title={t.name}>{t.name}</h3>
                    <p className="text-sm font-mono text-muted-foreground mb-4">{t.staffId}</p>
                    
                    <div className="space-y-2 text-sm mt-1 mb-5 flex-1 text-muted-foreground">
                       <div className="flex items-center gap-2.5 min-w-0" title={t.department || 'Not assigned'}>
                         <Building className="h-4 w-4 text-orange-500/70 flex-shrink-0" />
                         <span className="truncate">{t.department || 'Not assigned'}</span>
                       </div>
                       <div className="flex items-center gap-2.5 min-w-0" title={t.position || 'Teacher'}>
                         <Briefcase className="h-4 w-4 text-orange-500/70 flex-shrink-0" />
                         <span className="truncate flex-1">{t.position || 'Teacher'}</span>
                       </div>
                       <div className="flex items-center gap-2.5 min-w-0" title={t.email || 'No email'}>
                         <Mail className="h-4 w-4 text-orange-500/70 flex-shrink-0" />
                         <span className="truncate flex-1 text-xs">{t.email || 'No email on file'}</span>
                       </div>
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
