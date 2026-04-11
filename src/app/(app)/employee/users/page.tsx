'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, GraduationCap, Users, UserCog, MoreHorizontal, Trash2, Edit, UserPlus, Loader2, Eye, Mail, Building, Briefcase } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getStudents, deleteStudent } from '@/actions/student-actions';
import { getStaff, deleteTeacher, createStaffAccount } from '@/actions/staff-actions';
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

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [studs, staff] = await Promise.all([getStudents(), getStaff()]);
      setStudents(studs);
      setTeachers(staff.filter((s: any) => s.role === 'teacher'));
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load records.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const effectRan = React.useRef(false);
  React.useEffect(() => { 
      if (!effectRan.current) {
          loadData(); 
          effectRan.current = true;
      }
  }, [loadData]);

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
    if (result.success) {
      toast({ title: 'Student Removed', description: `${name}'s account has been deleted.` });
      loadData();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const handleDeleteTeacher = async (id: string, name: string) => {
    const result = await deleteTeacher(id);
    if (result.success) {
      toast({ title: 'Teacher Removed', description: `${name}'s account has been deleted.` });
      loadData();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Staff</h1>
            <p className="text-white/80 text-sm mt-2">Add, edit or remove students and teachers from the system.</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium">
                <GraduationCap className="h-3.5 w-3.5" /> {students.length} Students
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium">
                <Users className="h-3.5 w-3.5" /> {teachers.length} Teachers
              </div>
            </div>
          </div>
          <UserCog className="h-20 w-20 opacity-10" />
        </div>
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
      </div>

      <Tabs defaultValue="students" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6 h-11 bg-muted/50 p-1">
          <TabsTrigger value="students" className="rounded-lg gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <GraduationCap className="h-4 w-4" /> Students
          </TabsTrigger>
          <TabsTrigger value="teachers" className="rounded-lg gap-2 data-[state=active]:bg-orange-600 data-[state=active]:text-white">
            <Users className="h-4 w-4" /> Teachers
          </TabsTrigger>
        </TabsList>

        {/* STUDENTS TAB */}
        <TabsContent value="students" className="mt-0">
          <Card className="card-elevated border-t-4 border-t-blue-500">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle>Students</CardTitle>
                  <CardDescription>Manage student enrollments</CardDescription>
                </div>
                <Button onClick={() => setIsAddStudentOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                  <UserPlus className="h-4 w-4" /> Add Student
                </Button>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or college ID..." className="pl-9" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground w-full">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <p>Loading records...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground w-full border-2 border-dashed rounded-xl">
                  <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="font-medium">No students found.</p>
                  <p className="text-sm">Try adjusting your search criteria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-2">
                  {filteredStudents.map(s => (
                    <Card key={s.id} className="flex flex-col overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 card-elevated group relative bg-card/60 backdrop-blur-sm border-border/50">
                      <div className="h-24 bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 relative overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                      </div>
                      <div className="px-5 pt-0 pb-5 flex-1 flex flex-col">
                        <div className="-mt-12 mb-3 flex justify-between items-end relative z-10">
                           <Avatar className="h-20 w-20 border-4 border-background shadow-md bg-muted">
                             <AvatarImage src={s.avatarUrl} />
                             <AvatarFallback className="text-xl font-bold">{s.name.substring(0,2).toUpperCase()}</AvatarFallback>
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
                             <span className="font-medium flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500" />Active</span>
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-auto pt-4 border-t border-border/50">
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <Button variant="outline" size="icon" className="h-9 w-9 text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30 flex-shrink-0" title="Delete Student">
                                 <Trash2 className="h-4 w-4" />
                               </Button>
                             </AlertDialogTrigger>
                             <AlertDialogContent>
                               <AlertDialogHeader>
                                 <AlertDialogTitle>Delete student?</AlertDialogTitle>
                                 <AlertDialogDescription>
                                   This will permanently delete <strong>{s.name} ({s.collegeId})</strong> and revoke their login access. This cannot be undone.
                                 </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter>
                                 <AlertDialogCancel>Cancel</AlertDialogCancel>
                                 <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteStudent(s.id, s.name)}>Delete</AlertDialogAction>
                               </AlertDialogFooter>
                             </AlertDialogContent>
                           </AlertDialog>
                           
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
        </TabsContent>

        {/* TEACHERS TAB */}
        <TabsContent value="teachers" className="mt-0">
          <Card className="card-elevated border-t-4 border-t-orange-500">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle>Teachers</CardTitle>
                  <CardDescription>Manage teaching staff records</CardDescription>
                </div>
                <Button onClick={() => { setEditingTeacher(null); setIsAddTeacherOpen(true); }} className="gap-2 bg-orange-600 hover:bg-orange-700 text-white">
                  <UserPlus className="h-4 w-4" /> Add Teacher
                </Button>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or staff ID..." className="pl-9" value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground w-full">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <p>Loading records...</p>
                </div>
              ) : filteredTeachers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground w-full border-2 border-dashed rounded-xl">
                  <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="font-medium">No teachers found.</p>
                  <p className="text-sm">Try adjusting your search criteria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-2">
                  {filteredTeachers.map(t => (
                    <Card key={t.id} className="flex flex-col overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 card-elevated group relative bg-card/60 backdrop-blur-sm border-border/50">
                      <div className="h-24 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 relative overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                      </div>
                      <div className="px-5 pt-0 pb-5 flex-1 flex flex-col">
                        <div className="-mt-12 mb-3 flex justify-between items-end relative z-10">
                           <Avatar className="h-20 w-20 border-4 border-background shadow-md bg-muted">
                             <AvatarImage src={t.avatarUrl} />
                             <AvatarFallback className="text-xl font-bold">{t.name.substring(0,2).toUpperCase()}</AvatarFallback>
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
                        
                        <div className="flex items-center gap-2 mt-auto pt-4 border-t border-border/50">
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <Button variant="outline" size="icon" className="h-9 w-9 text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30 flex-shrink-0" title="Delete Teacher">
                                 <Trash2 className="h-4 w-4" />
                               </Button>
                             </AlertDialogTrigger>
                             <AlertDialogContent>
                               <AlertDialogHeader>
                                 <AlertDialogTitle>Delete teacher?</AlertDialogTitle>
                                 <AlertDialogDescription>
                                   This will permanently delete <strong>{t.name} ({t.staffId})</strong> and revoke their login access.
                                 </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter>
                                 <AlertDialogCancel>Cancel</AlertDialogCancel>
                                 <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteTeacher(t.id, t.name)}>Delete</AlertDialogAction>
                               </AlertDialogFooter>
                             </AlertDialogContent>
                           </AlertDialog>
                           
                           <Button 
                             className="w-full gap-2 bg-orange-50/50 hover:bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-950/30 dark:hover:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800" 
                             variant="secondary"
                             onClick={() => { setEditingTeacher(t); setIsAddTeacherOpen(true); }}
                           >
                             <Edit className="h-4 w-4" /> Edit Details
                           </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddStudentDialog isOpen={isAddStudentOpen} onOpenChange={setIsAddStudentOpen} onSave={loadData} />
      <AddStaffDialog
        isOpen={isAddTeacherOpen}
        onOpenChange={setIsAddTeacherOpen}
        onStaffAdded={loadData}
        initialData={editingTeacher}
        mode="teacher"
      />
    </div>
  );
}
