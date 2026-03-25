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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, AlertTriangle, MoreHorizontal, Eye, Edit, Trash2, UserPlus, ShieldPlus, Briefcase } from "lucide-react";
import { getStaff, deleteTeacher } from '@/actions/staff-actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import type { StaffMember } from '@/lib/types';
import { AddStaffDialog } from '@/components/admin/staff/add-staff-dialog';

async function fetchStaff(): Promise<StaffMember[]> {
  const staff = await getStaff();
  return staff;
}

const getUniqueValues = (staff: StaffMember[], key: keyof StaffMember): string[] => {
    const values = new Set(staff.map(t => typeof t[key] === 'string' ? t[key] : '').filter(v => typeof v === 'string' && v.trim().length > 0) as string[]);
    return ['all', ...Array.from(values)].sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b));
}

// Map database employee_type to readable labels
const employeeTypeLabels: Record<string, string> = {
  "fee_management": "Fee management",
  "hostel_management": "Hostel management",
  "exam_marks_management": "Exam & marks mgmt",
  "student_staff_management": "Student & staff mgmt",
  "library_management": "Library mgmt",
  "super_admin": "Super Admin"
};

export default function AdminStaffListPage() {
  const [allStaff, setAllStaff] = React.useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = React.useState(true); 
  const [error, setError] = React.useState<string | null>(null);

  // Dialog state
  const [isAddStaffDialogOpen, setIsAddStaffDialogOpen] = React.useState(false);
  const [addMode, setAddMode] = React.useState<"teacher" | "employee" | "super_admin">("teacher");
  const [editingStaff, setEditingStaff] = React.useState<StaffMember | null>(null);
  
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode-specific filters
  const [teacherFilters, setTeacherFilters] = React.useState({ search: '', program: 'all', department: 'all', status: 'all' });
  const [employeeFilters, setEmployeeFilters] = React.useState({ search: '', type: 'all', status: 'all' });
  const [adminFilters, setAdminFilters] = React.useState({ search: '', status: 'all' });

  const loadStaff = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const staffData = await fetchStaff();
      setAllStaff(staffData);
    } catch (e: any) {
      setError(e.message || "Failed to load staff data.");
      setAllStaff([]); 
    } finally {
      setIsLoading(false);
    }
  }, []); 

  React.useEffect(() => {
    loadStaff();
  }, [loadStaff]); 

  const handleAddNew = React.useCallback((mode: "teacher" | "employee" | "super_admin") => {
    setEditingStaff(null);
    setAddMode(mode);
    setIsAddStaffDialogOpen(true);
  }, []);

  React.useEffect(() => {
    if (searchParams.get('action') === 'add') {
      handleAddNew('super_admin'); // Default when standard params passed
      router.replace('/admin/staff', { scroll: false });
    }
  }, [searchParams, router, handleAddNew]);

  // Derived filter options
  const teacherStaff = allStaff.filter(s => s.role === 'teacher');
  const employeeStaff = allStaff.filter(s => s.role === 'employee');
  const adminStaff = allStaff.filter(s => s.role === 'super_admin');

  const teacherPrograms = getUniqueValues(teacherStaff, 'program');
  const teacherDepartments = React.useMemo(() => {
      let relevantStaff = teacherStaff;
      if (teacherFilters.program !== 'all') {
          relevantStaff = teacherStaff.filter(t => t.program === teacherFilters.program);
      }
      return getUniqueValues(relevantStaff, 'department'); 
  }, [teacherFilters.program, teacherStaff]);
  
  const employeeTypeOptions = ["all", "fee_management", "hostel_management", "exam_marks_management", "student_staff_management", "library_management"];
  
  const teacherStatuses = getUniqueValues(teacherStaff, 'status');
  const employeeStatuses = getUniqueValues(employeeStaff, 'status');
  const adminStatuses = getUniqueValues(adminStaff, 'status');

  // Filtered lists
  const filteredTeachers = React.useMemo(() => {
      return teacherStaff.filter(t => {
        const lowerSearchTerm = teacherFilters.search.toLowerCase();
        const searchMatch = !teacherFilters.search || (t.name?.toLowerCase().includes(lowerSearchTerm)) || (t.staffId?.toLowerCase().includes(lowerSearchTerm));
        const programMatch = teacherFilters.program === 'all' || t.program === teacherFilters.program;
        const departmentMatch = teacherFilters.department === 'all' || t.department === teacherFilters.department; 
        const statusMatch = teacherFilters.status === 'all' || t.status === teacherFilters.status;
        return searchMatch && programMatch && departmentMatch && statusMatch;
      });
  }, [teacherStaff, teacherFilters]);

  const filteredEmployees = React.useMemo(() => {
      return employeeStaff.filter(e => {
        const lowerSearchTerm = employeeFilters.search.toLowerCase();
        const searchMatch = !employeeFilters.search || (e.name?.toLowerCase().includes(lowerSearchTerm)) || (e.staffId?.toLowerCase().includes(lowerSearchTerm));
        const typeMatch = employeeFilters.type === 'all' || e.department === employeeFilters.type; // mapping type to department temporarily since getStaff pulls department 
        const statusMatch = employeeFilters.status === 'all' || e.status === employeeFilters.status;
        return searchMatch && typeMatch && statusMatch;
      });
  }, [employeeStaff, employeeFilters]);

  const filteredAdmins = React.useMemo(() => {
      return adminStaff.filter(a => {
        const lowerSearchTerm = adminFilters.search.toLowerCase();
        const searchMatch = !adminFilters.search || (a.name?.toLowerCase().includes(lowerSearchTerm)) || (a.staffId?.toLowerCase().includes(lowerSearchTerm));
        const statusMatch = adminFilters.status === 'all' || a.status === adminFilters.status;
        return searchMatch && statusMatch;
      });
  }, [adminStaff, adminFilters]);

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">N/A</Badge>;
    switch (status.toLowerCase()) {
        case 'active': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Active</Badge>;
        case 'inactive': return <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-0">Inactive</Badge>;
        case 'on leave': return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-black">On Leave</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const handleEdit = (staff: StaffMember) => {
      setEditingStaff(staff);
      setAddMode(staff.role as 'teacher' | 'employee' | 'super_admin');
      setIsAddStaffDialogOpen(true);
  };

  const confirmDelete = async (staffId: string, staffName: string | null) => {
      const result = await deleteTeacher(staffId);
      if(result.success) {
          toast({ title: "Success", description: result.message || `Staff member ${staffName} deleted.` });
          loadStaff();
      } else {
          toast({ variant: "destructive", title: "Error", description: result.error || "Failed to delete staff member." });
      }
  };
  
  if (isLoading && allStaff.length === 0) {
    return <div className="flex justify-center items-center h-64" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="ml-3 font-medium text-muted-foreground">Loading Staff...</span></div>;
  }
  
  return (
    <div className="space-y-6 animate-fade-in pt-4">

      <Tabs defaultValue="super_admin" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 h-12 items-center rounded-xl bg-muted/50 p-1">
          <TabsTrigger value="super_admin" className="rounded-lg h-9 font-medium">Super Admins</TabsTrigger>
          <TabsTrigger value="employee" className="rounded-lg h-9 font-medium">Employees</TabsTrigger>
          <TabsTrigger value="teacher" className="rounded-lg h-9 font-medium">Teachers</TabsTrigger>
        </TabsList>

        {/* SUPER ADMIN MODE TAB */}
        <TabsContent value="super_admin" className="mt-0">
          <Card className="card-elevated border-t-4 border-t-red-500">
            <CardHeader className="pb-3 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Super Admins</h2>
                  <Button onClick={() => handleAddNew('super_admin')} className="gap-2 bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto">
                      <ShieldPlus className="h-4 w-4"/> Add Super Admin
                  </Button>
              </div>
              <div className="flex flex-col md:flex-row gap-4 items-end mt-2">
                  <div className="relative flex-1 w-full">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search Admin by Name or ID..." className="pl-8 w-full" value={adminFilters.search} onChange={(e) => setAdminFilters(p => ({...p, search: e.target.value}))} />
                  </div>
                  <Select value={adminFilters.status} onValueChange={(value) => setAdminFilters(p => ({...p, status: value}))}>
                      <SelectTrigger className="w-[140px] md:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                          {adminStatuses.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Status' : s}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
            </CardHeader>
            <CardContent>
              <StaffTable staff={filteredAdmins} isLoading={isLoading} onEdit={handleEdit} onDelete={confirmDelete} getStatusBadge={getStatusBadge} mode="super_admin" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* EMPLOYEE MODE TAB */}
        <TabsContent value="employee" className="mt-0">
          <Card className="card-elevated border-t-4 border-t-purple-500">
            <CardHeader className="pb-3 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Employees</h2>
                  <Button onClick={() => handleAddNew('employee')} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto">
                      <Briefcase className="h-4 w-4"/> Add Employee
                  </Button>
              </div>
              <div className="flex flex-col md:flex-row gap-4 items-end mt-2">
                  <div className="relative flex-1 w-full">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search Employee by Name or ID..." className="pl-8 w-full" value={employeeFilters.search} onChange={(e) => setEmployeeFilters(p => ({...p, search: e.target.value}))} />
                  </div>
                  <Select value={employeeFilters.type} onValueChange={(value) => setEmployeeFilters(p => ({...p, type: value}))}>
                      <SelectTrigger className="w-[180px] md:w-[240px]"><SelectValue placeholder="Employee Type" /></SelectTrigger>
                      <SelectContent>
                          {employeeTypeOptions.map(t => <SelectItem key={t} value={t}>{t === 'all' ? 'All Types' : (employeeTypeLabels[t] || t)}</SelectItem>)}
                      </SelectContent>
                  </Select>
                  <Select value={employeeFilters.status} onValueChange={(value) => setEmployeeFilters(p => ({...p, status: value}))}>
                      <SelectTrigger className="w-[140px] md:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                          {employeeStatuses.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Status' : s}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
            </CardHeader>
            <CardContent>
              <StaffTable staff={filteredEmployees} isLoading={isLoading} onEdit={handleEdit} onDelete={confirmDelete} getStatusBadge={getStatusBadge} mode="employee" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEACHER MODE TAB */}
        <TabsContent value="teacher" className="mt-0">
          <Card className="card-elevated border-t-4 border-t-blue-500">
            <CardHeader className="pb-3 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Teachers</h2>
                  <Button onClick={() => handleAddNew('teacher')} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
                      <UserPlus className="h-4 w-4"/> Add Teacher
                  </Button>
              </div>
              <div className="flex flex-col md:flex-row gap-4 items-end mt-2">
                  <div className="relative flex-1 w-full">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search Teacher by Name or ID..." className="pl-8 w-full" value={teacherFilters.search} onChange={(e) => setTeacherFilters(p => ({...p, search: e.target.value}))} />
                  </div>
                  <Select value={teacherFilters.program} onValueChange={(value) => setTeacherFilters(p => ({...p, program: value, department: 'all'}))}>
                      <SelectTrigger className="w-[140px] md:w-[160px]"><SelectValue placeholder="Program" /></SelectTrigger>
                      <SelectContent>{teacherPrograms.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All Programs' : p}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={teacherFilters.department} onValueChange={(value) => setTeacherFilters(p => ({...p, department: value}))} disabled={teacherFilters.program === 'all' && teacherDepartments.length <= 1}>
                      <SelectTrigger className="w-[140px] md:w-[160px]" disabled={teacherFilters.program === 'all' && teacherDepartments.length <= 1}><SelectValue placeholder="Department" /></SelectTrigger>
                      <SelectContent>{teacherDepartments.map(d => <SelectItem key={d} value={d}>{d === 'all' ? 'All Departments' : d}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={teacherFilters.status} onValueChange={(value) => setTeacherFilters(p => ({...p, status: value}))}>
                      <SelectTrigger className="w-[120px] md:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                          {teacherStatuses.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Status' : s}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
            </CardHeader>
            <CardContent>
              <StaffTable staff={filteredTeachers} isLoading={isLoading} onEdit={handleEdit} onDelete={confirmDelete} getStatusBadge={getStatusBadge} mode="teacher" />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <AddStaffDialog 
        isOpen={isAddStaffDialogOpen}
        onOpenChange={setIsAddStaffDialogOpen}
        onStaffAdded={loadStaff}
        initialData={editingStaff}
        mode={addMode}
      />
    </div>
  );
}

// Reusable Table Component for all 3 modes
function StaffTable({ staff, isLoading, onEdit, onDelete, getStatusBadge, mode }: { staff: StaffMember[], isLoading: boolean, onEdit: (s: StaffMember) => void, onDelete: (id: string, name: string) => void, getStatusBadge: (s: string | null) => any, mode: "teacher" | "employee" | "super_admin" }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border/30">
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            {mode === 'teacher' && <TableHead>Department</TableHead>}
            {mode === 'employee' && <TableHead>Type</TableHead>}
            {mode === 'teacher' && <TableHead>Position</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="inline mr-2 h-5 w-5 animate-spin text-muted-foreground"/>Loading data...</TableCell></TableRow>
          ) : staff.length > 0 ? staff.map((s) => (
            <TableRow key={s.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 border-border/20">
              <TableCell className="font-medium">{s.staffId}</TableCell>
              <TableCell>{s.name}</TableCell>
              {mode === 'teacher' && <TableCell>{s.department}</TableCell>}
              {mode === 'employee' && <TableCell>{employeeTypeLabels[s.department || ""] || s.department || "Employee"}</TableCell>}
              {mode === 'teacher' && <TableCell>{s.position}</TableCell>}
              <TableCell>{getStatusBadge(s.status || null)}</TableCell>
              <TableCell className="text-right">
                <AlertDialog>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(s)}><Edit className="mr-2 h-4 w-4"/> Edit Profile</DropdownMenuItem>
                      <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4"/> Delete</DropdownMenuItem></AlertDialogTrigger>
                    </DropdownMenuContent>
                  </DropdownMenu>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the profile for <span className="font-semibold">{s.name} ({s.staffId})</span> and all associated data.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => onDelete(s.id, s.name || '')}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          )) : (
            <TableRow><TableCell colSpan={7} className="text-center py-12"><div className="flex flex-col items-center gap-2"><div className="rounded-2xl bg-muted p-3"><Search className="h-5 w-5 text-muted-foreground" /></div><p className="font-medium text-muted-foreground">No records found</p><p className="text-sm text-muted-foreground">Try adjusting your search or filter criteria.</p></div></TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
