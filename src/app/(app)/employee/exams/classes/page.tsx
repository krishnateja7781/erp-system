
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, MoreHorizontal, Trash2, UserCog, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getClassesWithDetails, deleteClass } from '@/actions/class-actions';
import { AddClassDialog } from '@/components/admin/classes/add-class-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EditTeacherDialog } from '@/components/admin/classes/edit-teacher-dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, X, Loader2 } from "lucide-react";
import Link from 'next/link';
import type { ClassUI } from '@/app/(app)/admin/classes/page';
import { PageHeaderActions } from '@/components/layout/layout-context';

const programs = ["All", "B.Tech", "MBA", "Law", "MBBS", "B.Sc", "B.Com"];
const years = ["All", "1", "2", "3", "4", "5"];
const semesters = ["All", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const branches: Record<string, string[]> = {
    "All": [],
    "B.Tech": ["CSE", "ECE", "MECH", "IT", "AI&ML", "DS", "CIVIL", "Other"],
    "MBA": ["Marketing", "Finance", "HR", "Operations", "General", "Other"],
    "Law": ["Corporate Law", "Criminal Law", "Civil Law", "General", "Other"],
    "MBBS": ["General Medicine"],
    "B.Sc": ["Physics", "Chemistry", "Mathematics", "Computer Science", "Other"],
    "B.Com": ["General", "Accounting & Finance", "Taxation", "Other"],
};

export default function EmployeeClassesPage() {
    const [classes, setClasses] = React.useState<ClassUI[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [selectedClassForEdit, setSelectedClassForEdit] = React.useState<ClassUI | null>(null);
    const { toast } = useToast();

    const [filterProgram, setFilterProgram] = React.useState("All");
    const [filterBranch, setFilterBranch] = React.useState("All");
    const [filterYear, setFilterYear] = React.useState("All");
    const [filterSemester, setFilterSemester] = React.useState("All");
    const [filterSection, setFilterSection] = React.useState("All");
    const [filterSearch, setFilterSearch] = React.useState("");

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedClasses = await getClassesWithDetails();
            setClasses(fetchedClasses);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to load class data.' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => { loadData(); }, [loadData]);

    const handleDeleteClass = async (classId: string, className: string) => {
        const result = await deleteClass(classId);
        if (result.success) {
            toast({ title: 'Success', description: `Class "${className}" deleted.` });
            loadData();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    };

    const handleOpenEditDialog = (cls: ClassUI) => {
        setSelectedClassForEdit(cls);
        setIsEditDialogOpen(true);
    };

    const resetFilters = () => {
        setFilterProgram("All"); setFilterBranch("All"); setFilterYear("All");
        setFilterSemester("All"); setFilterSection("All"); setFilterSearch("");
    };

    const filteredClasses = React.useMemo(() => {
        return classes.filter(cls => {
            if (filterProgram !== "All" && cls.program !== filterProgram) return false;
            if (filterBranch !== "All" && cls.branch !== filterBranch) return false;
            if (filterYear !== "All" && String(cls.year) !== filterYear) return false;
            if (filterSemester !== "All" && String(cls.semester) !== filterSemester) return false;
            if (filterSection !== "All" && cls.section !== filterSection) return false;
            if (filterSearch) {
                const search = filterSearch.toLowerCase();
                return cls.courseName.toLowerCase().includes(search) || cls.courseId.toLowerCase().includes(search);
            }
            return true;
        });
    }, [classes, filterProgram, filterBranch, filterYear, filterSemester, filterSection, filterSearch]);

    const availableBranches = branches[filterProgram] || [];
    const availableSections = Array.from(new Set(classes.map(c => c.section))).sort();

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-500 p-6 mb-6 text-white shadow-lg">
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Manage Classes</h1>
                        <p className="text-white/70 text-sm mt-1">Create, assign teachers, and manage class sections</p>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>
            <PageHeaderActions>
                <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                    <PlusCircle className="h-4 w-4" /> Create New Class
                </Button>
            </PageHeaderActions>

            <Card className="card-elevated">
                <CardContent className="pt-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Search Course</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search by course name or ID..."
                                    className="w-full h-10 rounded-md border border-input bg-background px-9 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={filterSearch}
                                    onChange={(e) => setFilterSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                            <div className="space-y-2">
                                <Label>Program</Label>
                                <Select value={filterProgram} onValueChange={(v) => { setFilterProgram(v); setFilterBranch("All"); }}>
                                    <SelectTrigger><SelectValue placeholder="All Programs" /></SelectTrigger>
                                    <SelectContent>{programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Branch</Label>
                                <Select value={filterBranch} onValueChange={setFilterBranch} disabled={filterProgram === "All"}>
                                    <SelectTrigger><SelectValue placeholder="All Branches" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Branches</SelectItem>
                                        {availableBranches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Year</Label>
                                <Select value={filterYear} onValueChange={setFilterYear}>
                                    <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                                    <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y === "All" ? "All Years" : `Year ${y}`}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Semester</Label>
                                <Select value={filterSemester} onValueChange={setFilterSemester}>
                                    <SelectTrigger><SelectValue placeholder="All Semesters" /></SelectTrigger>
                                    <SelectContent>{semesters.map(s => <SelectItem key={s} value={s}>{s === "All" ? "All Semesters" : `Semester ${s}`}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Section</Label>
                                <Select value={filterSection} onValueChange={setFilterSection}>
                                    <SelectTrigger><SelectValue placeholder="All Sections" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Sections</SelectItem>
                                        {availableSections.map(s => <SelectItem key={s || 'none'} value={s || 'none'}>Section {s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button variant="outline" onClick={resetFilters} className="w-full gap-2">
                                <X className="h-4 w-4" /> Reset
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="card-elevated">
                <CardHeader>
                    <div className="flex items-center justify-between text-[13px] text-muted-foreground mb-1">
                        <span>{filteredClasses.length} classes found</span>
                    </div>
                    <CardTitle>Class List</CardTitle>
                    <CardDescription>List of all created classes, their assigned teachers, and student counts.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border/30">
                                <TableHead>Course</TableHead>
                                <TableHead>Class</TableHead>
                                <TableHead>Assigned Teacher</TableHead>
                                <TableHead className="text-center">Student Count</TableHead>
                                <TableHead>Classroom</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <div className="flex flex-col items-center justify-center py-12 gap-3" role="status">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            <span className="text-sm text-muted-foreground">Loading...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredClasses.length > 0 ? (
                                filteredClasses.map((cls) => (
                                    <TableRow key={cls.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 border-border/20">
                                        <TableCell className="font-medium">
                                            {cls.courseName} <span className="text-muted-foreground">({cls.courseId})</span>
                                        </TableCell>
                                        <TableCell>{cls.program} {cls.branch} - Year {cls.year} (Sec {cls.section})</TableCell>
                                        <TableCell>{cls.teacherName}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={cls.studentCount === 0 ? "destructive" : "default"} className={cls.studentCount === 0 ? "" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300"}>
                                                {cls.studentCount}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {cls.classroomId ? (
                                                <Button variant="outline" size="sm" asChild className="gap-2">
                                                    <Link href={`/classrooms/${cls.classroomId}`}><Link2 className="h-3 w-3" />View</Link>
                                                </Button>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground">Not Linked</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleOpenEditDialog(cls)}><UserCog className="mr-2 h-4 w-4" /> Edit Teacher</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will delete the class <span className="font-semibold">{cls.courseName} for Section {cls.section}</span>. This action cannot be undone.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteClass(cls.id, cls.courseName)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                                            <div className="rounded-2xl bg-muted p-3"><PlusCircle className="h-6 w-6 text-muted-foreground" /></div>
                                            <p className="text-sm text-muted-foreground">No classes matching the filters.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AddClassDialog isOpen={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onClassAdded={loadData} />
            {selectedClassForEdit && <EditTeacherDialog
                isOpen={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                onTeacherUpdated={loadData}
                classData={{ classId: selectedClassForEdit.id, className: selectedClassForEdit.courseName, program: selectedClassForEdit.program, currentTeacherId: selectedClassForEdit.teacherId }}
            />}
        </div>
    );
}
