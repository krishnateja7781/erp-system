'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, GraduationCap, Users, UserCog, Trash2, Edit, UserPlus, Loader2, Eye, MoreHorizontal } from "lucide-react";
import { getStudents, deleteStudent } from '@/actions/student-actions';
import { getStaff, deleteTeacher } from '@/actions/staff-actions';
import { AddStudentDialog } from '@/components/admin/students/add-student-dialog';
import { AddStaffDialog } from '@/components/admin/staff/add-staff-dialog';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function EmployeeManageStaffPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [students, setStudents] = React.useState<any[]>([]);
  const [teachers, setTeachers] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [studentSearch, setStudentSearch] = React.useState('');
  const [teacherSearch, setTeacherSearch] = React.useState('');
  const [isAddStudentOpen, setIsAddStudentOpen] = React.useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = React.useState(false);
  const [editingTeacher, setEditingTeacher] = React.useState<any>(null);
  const [deleteStudentTarget, setDeleteStudentTarget] = React.useState<any>(null);
  const [deleteTeacherTarget, setDeleteTeacherTarget] = React.useState<any>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [studs, staff] = await Promise.all([getStudents(), getStaff()]);
      setStudents(studs);
      setTeachers(staff.filter((s: any) => s.role === 'teacher'));
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load records.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const effectRan = React.useRef(false);
  React.useEffect(() => { if (!effectRan.current) { loadData(); effectRan.current = true; } }, [loadData]);

  const filteredStudents = React.useMemo(() => {
    const q = studentSearch.toLowerCase();
    return students.filter(s => !studentSearch || s.name?.toLowerCase().includes(q) || s.collegeId?.toLowerCase().includes(q));
  }, [students, studentSearch]);

  const filteredTeachers = React.useMemo(() => {
    const q = teacherSearch.toLowerCase();
    return teachers.filter(t => !teacherSearch || t.name?.toLowerCase().includes(q) || t.staffId?.toLowerCase().includes(q));
  }, [teachers, teacherSearch]);

  const handleDeleteStudent = async (id: string, name: string) => {
    const result = await deleteStudent(id);
    if (result.success) { toast({ title: 'Student Removed', description: `${name}'s account has been deleted.` }); loadData(); }
    else toast({ variant: 'destructive', title: 'Error', description: result.error });
  };

  const handleDeleteTeacher = async (id: string, name: string) => {
    const result = await deleteTeacher(id);
    if (result.success) { toast({ title: 'Teacher Removed', description: `${name}'s account has been deleted.` }); loadData(); }
    else toast({ variant: 'destructive', title: 'Error', description: result.error });
  };

  const getStatusBadge = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'active':   return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 border">Active</Badge>;
      case 'inactive': return <Badge className="bg-slate-500/15 text-slate-500 border-slate-400/30 border">Inactive</Badge>;
      default:         return <Badge variant="outline">{status || 'N/A'}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Manage Staff</h1>
            <p className="text-white/80 text-sm mt-1">Add, edit or remove students and teachers from the system.</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium">
                <GraduationCap className="h-3.5 w-3.5" /> {students.length} Students
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium">
                <Users className="h-3.5 w-3.5" /> {teachers.length} Teachers
              </span>
            </div>
          </div>
          <UserCog className="h-16 w-16 opacity-10 hidden md:block" />
        </div>
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
      </div>

      <Tabs defaultValue="students" className="w-full">
        <TabsList className="grid w-full max-w-sm grid-cols-2 mb-4 h-11 bg-muted/50 p-1">
          <TabsTrigger value="students" className="rounded-lg gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <GraduationCap className="h-4 w-4" /> Students
          </TabsTrigger>
          <TabsTrigger value="teachers" className="rounded-lg gap-2 data-[state=active]:bg-orange-600 data-[state=active]:text-white">
            <Users className="h-4 w-4" /> Teachers
          </TabsTrigger>
        </TabsList>

        {/* STUDENTS */}
        <TabsContent value="students" className="mt-0">
          <Card className="card-elevated border-t-4 border-t-blue-500">
            <CardHeader className="pb-0 pt-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                <div>
                  <CardTitle className="text-base">Students</CardTitle>
                  <CardDescription>Manage student enrollments</CardDescription>
                </div>
                <Button onClick={() => setIsAddStudentOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                  <UserPlus className="h-4 w-4" /> Add Student
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or USN…" className="pl-8" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="pt-4 px-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-7 w-7 animate-spin mr-3" />Loading…</div>
              ) : filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-xl mx-4 mb-2">
                  <GraduationCap className="h-10 w-10 opacity-30 mb-2" /><p className="font-medium">No students found.</p>
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
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((s, idx) => (
                        <TableRow key={s.id} className="border-border/30 hover:bg-muted/40 transition-colors group">
                          <TableCell className="pl-6 text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="min-w-[160px]">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 flex-shrink-0 border border-border/50">
                                <AvatarImage src={s.avatarUrl} />
                                <AvatarFallback className="text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">{s.name?.slice(0,2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm truncate group-hover:text-blue-600 transition-colors">{s.name || '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{s.collegeId || '—'}</TableCell>
                          <TableCell className="text-sm">{s.program || '—'}</TableCell>
                          <TableCell>{s.branch ? <Badge variant="outline" className="text-xs border-blue-300/50 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30">{s.branch}</Badge> : '—'}</TableCell>
                          <TableCell className="text-sm text-center">{s.year ? <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-semibold">{s.year}</span> : '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.type || '—'}</TableCell>
                          <TableCell className="text-right pr-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
                                  View Student <MoreHorizontal className="h-3.5 w-3.5 opacity-60" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push(`/employee/students/${s.id}`)}>
                                  <Eye className="h-4 w-4" /> View Profile
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setDeleteStudentTarget(s)}>
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
              <p className="text-xs text-muted-foreground">Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> students</p>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* TEACHERS */}
        <TabsContent value="teachers" className="mt-0">
          <Card className="card-elevated border-t-4 border-t-orange-500">
            <CardHeader className="pb-0 pt-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                <div>
                  <CardTitle className="text-base">Teachers</CardTitle>
                  <CardDescription>Manage teaching staff records</CardDescription>
                </div>
                <Button onClick={() => { setEditingTeacher(null); setIsAddTeacherOpen(true); }} className="gap-2 bg-orange-600 hover:bg-orange-700 text-white">
                  <UserPlus className="h-4 w-4" /> Add Teacher
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or staff ID…" className="pl-8" value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="pt-4 px-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-7 w-7 animate-spin mr-3" />Loading…</div>
              ) : filteredTeachers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-xl mx-4 mb-2">
                  <Users className="h-10 w-10 opacity-30 mb-2" /><p className="font-medium">No teachers found.</p>
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
                      {filteredTeachers.map((t, idx) => (
                        <TableRow key={t.id} className="border-border/30 hover:bg-muted/40 transition-colors group">
                          <TableCell className="pl-6 text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="min-w-[160px]">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 flex-shrink-0 border border-border/50">
                                <AvatarImage src={t.avatarUrl} />
                                <AvatarFallback className="text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">{t.name?.slice(0,2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm truncate group-hover:text-orange-600 transition-colors">{t.name || '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{t.staffId || '—'}</TableCell>
                          <TableCell className="text-sm">{t.department || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.position || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{t.email || '—'}</TableCell>
                          <TableCell>{getStatusBadge(t.status)}</TableCell>
                          <TableCell className="text-right pr-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
                                  View Teacher <MoreHorizontal className="h-3.5 w-3.5 opacity-60" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => { setEditingTeacher(t); setIsAddTeacherOpen(true); }}>
                                  <Edit className="h-4 w-4" /> Edit Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setDeleteTeacherTarget(t)}>
                                  <Trash2 className="h-4 w-4" /> Delete Teacher
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
              <p className="text-xs text-muted-foreground">Showing <strong>{filteredTeachers.length}</strong> of <strong>{teachers.length}</strong> teachers</p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <AddStudentDialog isOpen={isAddStudentOpen} onOpenChange={setIsAddStudentOpen} onSave={loadData} />
      <AddStaffDialog isOpen={isAddTeacherOpen} onOpenChange={setIsAddTeacherOpen} onStaffAdded={loadData} initialData={editingTeacher} mode="teacher" />

      {/* Delete student confirmation */}
      <AlertDialog open={!!deleteStudentTarget} onOpenChange={open => { if (!open) setDeleteStudentTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete <strong>{deleteStudentTarget?.name} ({deleteStudentTarget?.collegeId})</strong> and revoke their access.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { handleDeleteStudent(deleteStudentTarget?.id, deleteStudentTarget?.name); setDeleteStudentTarget(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete teacher confirmation */}
      <AlertDialog open={!!deleteTeacherTarget} onOpenChange={open => { if (!open) setDeleteTeacherTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete teacher?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete <strong>{deleteTeacherTarget?.name} ({deleteTeacherTarget?.staffId})</strong> and revoke their access.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { handleDeleteTeacher(deleteTeacherTarget?.id, deleteTeacherTarget?.name); setDeleteTeacherTarget(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
