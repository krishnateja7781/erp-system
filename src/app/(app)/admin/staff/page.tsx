'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Loader2, Edit, Trash2, UserPlus, ShieldPlus, Briefcase, Users, MoreHorizontal } from "lucide-react";
import { getStaff, deleteTeacher } from '@/actions/staff-actions';
import { useToast } from '@/hooks/use-toast';
import type { StaffMember } from '@/lib/types';
import { AddStaffDialog } from '@/components/admin/staff/add-staff-dialog';

const employeeTypeLabels: Record<string, string> = {
  fee_management: 'Fee Management',
  hostel_management: 'Hostel Management',
  exam_marks_management: 'Exam & Marks Mgmt',
  student_staff_management: 'Student & Staff Mgmt',
  library_management: 'Library Mgmt',
  super_admin: 'Super Admin',
};

const getStatusBadge = (status?: string | null) => {
  switch ((status || '').toLowerCase()) {
    case 'active':   return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 border">Active</Badge>;
    case 'inactive': return <Badge className="bg-slate-500/15 text-slate-500 border-slate-400/30 border">Inactive</Badge>;
    case 'on leave': return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 border">On Leave</Badge>;
    default:         return <Badge variant="outline">{status || 'N/A'}</Badge>;
  }
};

/** Reusable table for each staff tab */
function StaffTable({
  staff, isLoading, onEdit, onDelete, emptyIcon, accentClass, actionLabel,
}: {
  staff: StaffMember[];
  isLoading: boolean;
  onEdit: (s: StaffMember) => void;
  onDelete: (s: StaffMember) => void;
  emptyIcon: React.ReactNode;
  accentClass: string;
  actionLabel: string;
}) {
  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin mb-3" /><p className="text-sm">Loading records…</p>
    </div>
  );
  if (staff.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-xl mx-4 mb-2">
      {emptyIcon}<p className="font-medium mt-2">No records found.</p>
      <p className="text-sm mt-1">Try adjusting your search or filter.</p>
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border/40 hover:bg-transparent">
            <TableHead className="w-10 pl-6">#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Staff ID</TableHead>
            <TableHead>Department / Role</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right pr-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((s, idx) => (
            <TableRow key={s.id} className="border-border/30 hover:bg-muted/40 transition-colors group">
              <TableCell className="pl-6 text-xs text-muted-foreground tabular-nums w-10">{idx + 1}</TableCell>
              <TableCell className="min-w-[200px]">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0 border border-border/50">
                    <AvatarImage src={(s as any).avatarUrl} />
                    <AvatarFallback className={`text-xs font-semibold ${accentClass}`}>
                      {s.name?.slice(0, 2).toUpperCase() ?? '??'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">{s.name || '—'}</span>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{s.staffId || '—'}</TableCell>
              <TableCell className="text-sm">{employeeTypeLabels[s.department || ''] || s.department || '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{s.email || '—'}</TableCell>
              <TableCell className="text-sm">{s.position || '—'}</TableCell>
              <TableCell>{getStatusBadge(s.status)}</TableCell>

              {/* ── Actions: single dropdown ── */}
              <TableCell className="text-right pr-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
                      {actionLabel} <MoreHorizontal className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onEdit(s)}>
                      <Edit className="h-4 w-4" /> Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => onDelete(s)}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminStaffListPage() {
  const [allStaff, setAllStaff] = React.useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAddStaffDialogOpen, setIsAddStaffDialogOpen] = React.useState(false);
  const [addMode, setAddMode] = React.useState<'teacher' | 'employee' | 'super_admin'>('teacher');
  const [editingStaff, setEditingStaff] = React.useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<StaffMember | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [teacherFilters, setTeacherFilters] = React.useState({ search: '', program: 'all', department: 'all', status: 'all' });
  const [employeeFilters, setEmployeeFilters] = React.useState({ search: '', type: 'all', status: 'all' });
  const [adminFilters, setAdminFilters] = React.useState({ search: '', status: 'all' });

  const loadStaff = React.useCallback(async () => {
    setIsLoading(true);
    try { setAllStaff(await getStaff()); }
    catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to load staff.' }); }
    finally { setIsLoading(false); }
  }, []);

  const effectRan = React.useRef(false);
  React.useEffect(() => { if (!effectRan.current) { loadStaff(); effectRan.current = true; } }, [loadStaff]);

  const handleAddNew = React.useCallback((mode: 'teacher' | 'employee' | 'super_admin') => {
    setEditingStaff(null); setAddMode(mode); setIsAddStaffDialogOpen(true);
  }, []);

  React.useEffect(() => {
    if (searchParams.get('action') === 'add') { handleAddNew('super_admin'); router.replace('/admin/staff', { scroll: false }); }
  }, [searchParams, router, handleAddNew]);

  const teacherStaff  = allStaff.filter(s => s.role === 'teacher');
  const employeeStaff = allStaff.filter(s => s.role === 'employee');
  const adminStaff    = allStaff.filter(s => s.role === 'super_admin');

  const teacherDepts = ['all', ...Array.from(new Set(teacherStaff.map(t => t.department).filter(Boolean) as string[])).sort()];
  const teacherProgs = ['all', ...Array.from(new Set(teacherStaff.map(t => t.program).filter(Boolean) as string[])).sort()];
  const teacherStatuses = ['all', ...Array.from(new Set(teacherStaff.map(t => t.status).filter(Boolean) as string[]))];
  const employeeTypeOptions = ['all', 'fee_management', 'hostel_management', 'exam_marks_management', 'student_staff_management', 'library_management'];
  const employeeStatuses = ['all', ...Array.from(new Set(employeeStaff.map(e => e.status).filter(Boolean) as string[]))];
  const adminStatuses = ['all', ...Array.from(new Set(adminStaff.map(a => a.status).filter(Boolean) as string[]))];

  const filteredTeachers = React.useMemo(() => teacherStaff.filter(t => {
    const q = teacherFilters.search.toLowerCase();
    return (!teacherFilters.search || t.name?.toLowerCase().includes(q) || t.staffId?.toLowerCase().includes(q))
      && (teacherFilters.program === 'all' || t.program === teacherFilters.program)
      && (teacherFilters.department === 'all' || t.department === teacherFilters.department)
      && (teacherFilters.status === 'all' || t.status === teacherFilters.status);
  }), [teacherStaff, teacherFilters]);

  const filteredEmployees = React.useMemo(() => employeeStaff.filter(e => {
    const q = employeeFilters.search.toLowerCase();
    return (!employeeFilters.search || e.name?.toLowerCase().includes(q) || e.staffId?.toLowerCase().includes(q))
      && (employeeFilters.type === 'all' || e.department === employeeFilters.type)
      && (employeeFilters.status === 'all' || e.status === employeeFilters.status);
  }), [employeeStaff, employeeFilters]);

  const filteredAdmins = React.useMemo(() => adminStaff.filter(a => {
    const q = adminFilters.search.toLowerCase();
    return (!adminFilters.search || a.name?.toLowerCase().includes(q) || a.staffId?.toLowerCase().includes(q))
      && (adminFilters.status === 'all' || a.status === adminFilters.status);
  }), [adminStaff, adminFilters]);

  const handleEdit = (s: StaffMember) => { setEditingStaff(s); setAddMode(s.role as any); setIsAddStaffDialogOpen(true); };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const r = await deleteTeacher(deleteTarget.id);
    if (r.success) { toast({ title: 'Deleted', description: `${deleteTarget.name} removed.` }); loadStaff(); }
    else toast({ variant: 'destructive', title: 'Error', description: r.error });
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 animate-fade-in pt-4">
      <Tabs defaultValue="super_admin" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 h-12 rounded-xl bg-muted/50 p-1">
          <TabsTrigger value="super_admin" className="rounded-lg h-9 font-medium">
            Super Admins <span className="ml-2 text-xs opacity-60">({adminStaff.length})</span>
          </TabsTrigger>
          <TabsTrigger value="employee" className="rounded-lg h-9 font-medium">
            Employees <span className="ml-2 text-xs opacity-60">({employeeStaff.length})</span>
          </TabsTrigger>
          <TabsTrigger value="teacher" className="rounded-lg h-9 font-medium">
            Teachers <span className="ml-2 text-xs opacity-60">({teacherStaff.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* SUPER ADMINS */}
        <TabsContent value="super_admin" className="mt-0">
          <Card className="card-elevated border-t-4 border-t-red-500">
            <CardHeader className="pb-0 pt-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h2 className="text-lg font-bold">Super Admins</h2>
                <Button onClick={() => handleAddNew('super_admin')} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                  <ShieldPlus className="h-4 w-4" /> Add Super Admin
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name or ID…" className="pl-8" value={adminFilters.search} onChange={e => setAdminFilters(p => ({ ...p, search: e.target.value }))} />
                </div>
                <Select value={adminFilters.status} onValueChange={v => setAdminFilters(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Status" /></SelectTrigger>
                  <SelectContent>{adminStatuses.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Status' : s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-4 px-0">
              <StaffTable staff={filteredAdmins} isLoading={isLoading} onEdit={handleEdit} onDelete={setDeleteTarget}
                emptyIcon={<ShieldPlus className="h-12 w-12 opacity-30" />}
                accentClass="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                actionLabel="View Admin" />
            </CardContent>
            <CardFooter className="border-t border-border/30 pt-3 pb-3 px-6">
              <p className="text-xs text-muted-foreground">Showing <strong>{filteredAdmins.length}</strong> of <strong>{adminStaff.length}</strong> super admins</p>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* EMPLOYEES */}
        <TabsContent value="employee" className="mt-0">
          <Card className="card-elevated border-t-4 border-t-purple-500">
            <CardHeader className="pb-0 pt-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h2 className="text-lg font-bold">Employees</h2>
                <Button onClick={() => handleAddNew('employee')} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
                  <Briefcase className="h-4 w-4" /> Add Employee
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name or ID…" className="pl-8" value={employeeFilters.search} onChange={e => setEmployeeFilters(p => ({ ...p, search: e.target.value }))} />
                </div>
                <Select value={employeeFilters.type} onValueChange={v => setEmployeeFilters(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Types" /></SelectTrigger>
                  <SelectContent>{employeeTypeOptions.map(t => <SelectItem key={t} value={t}>{t === 'all' ? 'All Types' : (employeeTypeLabels[t] || t)}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={employeeFilters.status} onValueChange={v => setEmployeeFilters(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Status" /></SelectTrigger>
                  <SelectContent>{employeeStatuses.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Status' : s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-4 px-0">
              <StaffTable staff={filteredEmployees} isLoading={isLoading} onEdit={handleEdit} onDelete={setDeleteTarget}
                emptyIcon={<Briefcase className="h-12 w-12 opacity-30" />}
                accentClass="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                actionLabel="View Employee" />
            </CardContent>
            <CardFooter className="border-t border-border/30 pt-3 pb-3 px-6">
              <p className="text-xs text-muted-foreground">Showing <strong>{filteredEmployees.length}</strong> of <strong>{employeeStaff.length}</strong> employees</p>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* TEACHERS */}
        <TabsContent value="teacher" className="mt-0">
          <Card className="card-elevated border-t-4 border-t-blue-500">
            <CardHeader className="pb-0 pt-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h2 className="text-lg font-bold">Teachers</h2>
                <Button onClick={() => handleAddNew('teacher')} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                  <UserPlus className="h-4 w-4" /> Add Teacher
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name or ID…" className="pl-8" value={teacherFilters.search} onChange={e => setTeacherFilters(p => ({ ...p, search: e.target.value }))} />
                </div>
                <Select value={teacherFilters.program} onValueChange={v => setTeacherFilters(p => ({ ...p, program: v, department: 'all' }))}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Programs" /></SelectTrigger>
                  <SelectContent>{teacherProgs.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All Programs' : p}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={teacherFilters.department} onValueChange={v => setTeacherFilters(p => ({ ...p, department: v }))}>
                  <SelectTrigger className="w-[170px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
                  <SelectContent>{teacherDepts.map(d => <SelectItem key={d} value={d}>{d === 'all' ? 'All Departments' : d}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={teacherFilters.status} onValueChange={v => setTeacherFilters(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Status" /></SelectTrigger>
                  <SelectContent>{teacherStatuses.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Status' : s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-4 px-0">
              <StaffTable staff={filteredTeachers} isLoading={isLoading} onEdit={handleEdit} onDelete={setDeleteTarget}
                emptyIcon={<Users className="h-12 w-12 opacity-30" />}
                accentClass="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                actionLabel="View Teacher" />
            </CardContent>
            <CardFooter className="border-t border-border/30 pt-3 pb-3 px-6">
              <p className="text-xs text-muted-foreground">Showing <strong>{filteredTeachers.length}</strong> of <strong>{teacherStaff.length}</strong> teachers</p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shared delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name} ({deleteTarget?.staffId})</strong> and revoke their login access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddStaffDialog isOpen={isAddStaffDialogOpen} onOpenChange={setIsAddStaffDialogOpen} onStaffAdded={loadStaff} initialData={editingStaff} mode={addMode} />
    </div>
  );
}
