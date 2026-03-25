
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, User, Users, Search as SearchIcon, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TimetableGrid } from '@/components/shared/TimetableGrid';
import type { ScheduleEntry } from '@/lib/types';
import { getTimetableFilters, getScheduleForClass, saveTimetableBulk, type FullSchedule, type TeacherSchedule, type TimetableFilters } from '@/actions/timetable-actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit } from "lucide-react";


export default function AdminTimetablesPage() {
    const { toast } = useToast();
    const [filters, setFilters] = React.useState<TimetableFilters>({ programs: [], branches: {}, years: [], semesters: [], sections: {} });
    const [selected, setSelected] = React.useState({ program: '', branch: '', semester: '', section: '' });
    const [mode, setMode] = React.useState<'edit' | 'student' | 'teacher'>('edit');
    const [scheduleData, setScheduleData] = React.useState<FullSchedule | null>(null);
    const [draftSchedule, setDraftSchedule] = React.useState<ScheduleEntry[]>([]);
    const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
    const [isLoadingFilters, setIsLoadingFilters] = React.useState(true);
    const [isLoadingSchedule, setIsLoadingSchedule] = React.useState(false);

    React.useEffect(() => {
        const loadFilters = async () => {
            setIsLoadingFilters(true);
            try {
                const data = await getTimetableFilters();
                setFilters(data);
            } catch (error) {
                toast({ variant: 'destructive', title: "Error", description: "Failed to load available filters." });
            } finally {
                setIsLoadingFilters(false);
            }
        };
        loadFilters();
    }, [toast]);

    const handleFilterChange = (filterName: keyof typeof selected, value: string) => {
        const newSelected = { ...selected, [filterName]: value };
        if (filterName === 'program') {
            newSelected.branch = '';
            newSelected.section = '';
        }
        setSelected(newSelected);
        setScheduleData(null); // Clear old data when filters change
    };

    const handleFetchSchedule = async () => {
        if (!selected.program || !selected.branch || !selected.semester || !selected.section) {
            toast({ variant: 'destructive', title: 'Incomplete Selection', description: 'Please select program, branch, semester, and section.' });
            return;
        }
        setIsLoadingSchedule(true);
        setScheduleData(null);
        try {
            const data = await getScheduleForClass(selected);
            setScheduleData(data);
            setDraftSchedule(data.studentSchedule);
            setHasUnsavedChanges(false);
            if (data.studentSchedule.length === 0) {
                toast({ title: 'No Classes Found', description: 'No classes have been created for the selected criteria.' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: "Failed to generate timetable." });
        } finally {
            setIsLoadingSchedule(false);
        }
    };

    const availableBranches = filters.branches[selected.program] || [];
    const availableSections = filters.sections[selected.program] || [];

    const isFetchDisabled = !selected.program || !selected.branch || !selected.semester || !selected.section || isLoadingSchedule;

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-500 p-6 mb-6 text-white shadow-lg">
              <div className="relative z-10">
                <h1 className="text-2xl font-bold tracking-tight">View Timetables</h1>
                <p className="text-white/70 text-sm mt-1">Generate and manage timetables for class sections</p>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>
            <Card className="card-elevated">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/20"><SearchIcon className="h-4 w-4" /></div>Timetable Generator</CardTitle>
                    <CardDescription>Select filters to generate a timetable for a specific class section.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <div><Label>Program</Label><Select value={selected.program} onValueChange={(v) => handleFilterChange('program', v)} disabled={isLoadingFilters}><SelectTrigger><SelectValue placeholder="Select Program" /></SelectTrigger><SelectContent>{filters.programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Branch</Label><Select value={selected.branch} onValueChange={(v) => handleFilterChange('branch', v)} disabled={!selected.program}><SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger><SelectContent>{availableBranches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Semester</Label><Select value={selected.semester} onValueChange={(v) => handleFilterChange('semester', v)} disabled={isLoadingFilters}><SelectTrigger><SelectValue placeholder="Select Semester" /></SelectTrigger><SelectContent>{filters.semesters.map(s => <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Section</Label><Select value={selected.section} onValueChange={(v) => handleFilterChange('section', v)} disabled={!selected.program}><SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger><SelectContent>{availableSections.map(s => <SelectItem key={s} value={s}>Sec {s}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    <Button onClick={handleFetchSchedule} disabled={isFetchDisabled} className="gap-2">
                        {isLoadingSchedule ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
                        Fetch Timetable
                    </Button>
                </CardContent>
            </Card>

            {scheduleData && (
                <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 max-w-2xl">
                        <TabsTrigger value="edit" className="gap-2"><Edit className="h-4 w-4" />Edit Timetable</TabsTrigger>
                        <TabsTrigger value="student" className="gap-2"><Users className="h-4 w-4" />Student View</TabsTrigger>
                        <TabsTrigger value="teacher" className="gap-2"><User className="h-4 w-4" />Teacher View</TabsTrigger>
                    </TabsList>

                    <TabsContent value="edit">
                        <div className="flex justify-between items-center mb-4 mt-4">
                            <h3 className="font-semibold">Edit Section Timetable</h3>
                            <div className="flex gap-2">
                                {hasUnsavedChanges && (
                                    <Button size="sm" onClick={async () => {
                                        const slots = draftSchedule.map(s => {
                                            const teacherId = scheduleData.availableCourses.find(c => c.courseId === s.courseCode)?.teacherId || '';
                                            return {
                                                day: s.day,
                                                period: s.period,
                                                courseId: s.courseCode,
                                                teacherId: teacherId
                                            };
                                        }).filter(s => s.courseId && s.teacherId);

                                        setIsLoadingSchedule(true);
                                        try {
                                            const result = await saveTimetableBulk({
                                                program: selected.program,
                                                branch: selected.branch,
                                                semester: selected.semester,
                                                section: selected.section,
                                                slots
                                            });

                                            if (!result.success) {
                                                toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
                                            } else {
                                                toast({ title: 'Timetable Saved', description: 'Changes saved successfully.' });
                                                setHasUnsavedChanges(false);
                                                await handleFetchSchedule();
                                            }
                                        } catch (e) {
                                            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save timetable.' });
                                        } finally {
                                            setIsLoadingSchedule(false);
                                        }
                                    }}>
                                        Save Changes
                                    </Button>
                                )}
                                <Button variant="outline" size="sm" onClick={() => handleFetchSchedule()}>
                                    Discard Changes
                                </Button>
                            </div>
                        </div>
                        <TimetableGrid
                            schedule={draftSchedule}
                            interactive={true}
                            availableCourses={scheduleData.availableCourses}
                            onAssignCourse={(day, period, courseId) => {
                                const updated = [...draftSchedule].filter(s => !(s.day === day && s.period === period));
                                if (courseId) {
                                    const course = scheduleData.availableCourses.find(c => c.courseId === courseId);
                                    if (course) {
                                        updated.push({
                                            id: `draft_${day}_${period}`,
                                            classId: course.teacherId || '',
                                            courseId: course.courseId || '',
                                            teacherId: course.teacherId || '',
                                            day,
                                            period: typeof period === 'string' ? parseInt(period) : period,
                                            courseCode: course.courseId,
                                            courseName: course.courseName,
                                            teacherName: course.teacherName,
                                            class: `${selected.program} ${selected.branch} ${selected.section}`
                                        });
                                    }
                                }
                                setDraftSchedule(updated);
                                setHasUnsavedChanges(true);
                            }}
                        />
                    </TabsContent>

                    <TabsContent value="student">
                        <div className="flex justify-between items-center mb-4 mt-4">
                            <h3 className="font-semibold">Student Schedule View</h3>
                            <Button variant="outline" size="sm" onClick={() => handleFetchSchedule()}>
                                Refresh
                            </Button>
                        </div>
                        <TimetableGrid schedule={scheduleData.studentSchedule} />
                    </TabsContent>

                    <TabsContent value="teacher">
                        {scheduleData.teacherSchedules.length > 0 ? (
                            <div className="space-y-8">
                                {scheduleData.teacherSchedules.map(({ teacher, schedule }) => (
                                    <Card key={teacher.id} className="card-elevated">
                                        <CardHeader>
                                            <CardTitle>{teacher.name}</CardTitle>
                                            <CardDescription>Timetable for this section's classes.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <TimetableGrid schedule={schedule} />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card className="card-elevated">
                                <CardContent className="py-12 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="rounded-2xl bg-muted p-3"><AlertTriangle className="h-5 w-5 text-muted-foreground" /></div>
                                        <p className="font-medium text-muted-foreground">No teachers assigned</p>
                                        <p className="text-sm text-muted-foreground">No teachers are assigned to the classes for this section.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
