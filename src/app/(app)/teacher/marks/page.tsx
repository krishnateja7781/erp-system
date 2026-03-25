
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Calculator, Loader2, ArrowLeft, BookOpen, Users, CalendarDays, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    getTeacherSectionsForCourse,
    getStudentsForClass,
    getTeacherCoursesForMarks,
    getTeacherScheduledSessions,
    getMyTeacherId,
    type TeacherScheduledSession,
} from '@/actions/teacher-actions';
import {
    getMarksForClass,
    calculateFinalMarks,
    saveMarksBatch,
    type MarksRecord,
} from '@/actions/marks-actions';
import type { TeacherCourseOption, TeacherSectionOption, StudentForClass } from '@/actions/teacher-actions';
import { formatDate } from '@/lib/utils';

type MarksEntry = MarksRecord & { isModified?: boolean };
type ViewState = 'session_list' | 'marks_entry';

export default function TeacherMarksPage() {
    const { toast } = useToast();
    const [teacherId, setTeacherId] = React.useState<string | null>(null);

    // View state
    const [viewState, setViewState] = React.useState<ViewState>('session_list');
    const [activeSession, setActiveSession] = React.useState<string | null>(null);

    // Dropdown options
    const [courses, setCourses] = React.useState<TeacherCourseOption[]>([]);
    const [sections, setSections] = React.useState<TeacherSectionOption[]>([]);
    const [scheduledSessions, setScheduledSessions] = React.useState<TeacherScheduledSession[]>([]);

    // Selections
    const [selectedCourseId, setSelectedCourseId] = React.useState<string>('');
    const [selectedClassId, setSelectedClassId] = React.useState<string>('');

    // Data
    const [students, setStudents] = React.useState<StudentForClass[]>([]);
    const [marks, setMarks] = React.useState<Record<string, MarksEntry>>({});

    // Loading states
    const [isInitialLoading, setIsInitialLoading] = React.useState(true);
    const [isLoadingCourses, setIsLoadingCourses] = React.useState(false);
    const [isLoadingSections, setIsLoadingSections] = React.useState(false);
    const [isLoadingRoster, setIsLoadingRoster] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    // --- Data Fetching ---

    // 1. Get Teacher ID securely from server session
    React.useEffect(() => {
        async function fetchMyId() {
            const id = await getMyTeacherId();
            if (id) setTeacherId(id);
            else toast({ variant: 'destructive', title: 'Error', description: 'Could not identify teacher. Please log in again.' });
        }
        fetchMyId();
    }, [toast]);

    // 2. Fetch initial scheduled sessions
    React.useEffect(() => {
        if (!teacherId) return;
        setIsInitialLoading(true);
        getTeacherScheduledSessions(teacherId)
            .then(setScheduledSessions)
            .catch(() => toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch scheduled exams.' }))
            .finally(() => setIsInitialLoading(false));
    }, [teacherId, toast]);

    // 3. Fetch courses when a session is selected for entry
    React.useEffect(() => {
        if (viewState === 'marks_entry' && teacherId) {
            setIsLoadingCourses(true);
            getTeacherCoursesForMarks(teacherId, activeSession!)
                .then(setCourses)
                .catch(() => toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch your courses.' }))
                .finally(() => setIsLoadingCourses(false));
        }
    }, [viewState, teacherId, activeSession, toast]);

    // 4. Fetch sections when course is selected
    React.useEffect(() => {
        if (!teacherId || !selectedCourseId) {
            setSections([]); setSelectedClassId(''); return;
        }
        setIsLoadingSections(true);
        getTeacherSectionsForCourse(teacherId, selectedCourseId)
            .then(setSections)
            .catch(() => toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch sections.' }))
            .finally(() => setIsLoadingSections(false));
    }, [teacherId, selectedCourseId, toast]);

    // 5. Fetch students and marks when class is selected
    React.useEffect(() => {
        if (!selectedClassId) {
            setStudents([]); setMarks({}); return;
        }
        setIsLoadingRoster(true);
        Promise.all([
            getStudentsForClass(selectedClassId),
            getMarksForClass(selectedClassId)
        ]).then(([fetchedStudents, fetchedMarks]) => {
            setStudents(fetchedStudents);
            const initialMarksState: Record<string, MarksEntry> = {};
            fetchedStudents.forEach(student => {
                const existingMark = fetchedMarks.find(m => m.studentId === student.id);
                initialMarksState[student.id] = existingMark
                    ? { ...existingMark, isModified: false }
                    : { recordId: ``, studentId: student.id, studentName: student.name, classId: selectedClassId, ia1: null, ia2: null, other: null, see: null, total: null, grade: null, isModified: false };
            });
            setMarks(initialMarksState);
        }).catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to load students or marks." }))
            .finally(() => setIsLoadingRoster(false));
    }, [selectedClassId, toast]);


    // --- Handlers ---

    const handleEnterMarksClick = (session: string) => {
        setActiveSession(session);
        setViewState('marks_entry');
    };

    const handleBackToList = () => {
        if (hasUnsavedChanges) {
            if (!window.confirm("You have unsaved changes. Are you sure you want to go back?")) {
                return;
            }
        }
        setActiveSession(null);
        setSelectedCourseId('');
        setSelectedClassId('');
        setViewState('session_list');
    };

    const handleMarkChange = (studentId: string, field: 'ia1' | 'ia2' | 'other' | 'see', value: string) => {
        const maxMarks = field === 'see' ? 100 : field === 'other' ? 20 : 40;
        const numericValue = value === '' ? null : parseInt(value, 10);
        if (numericValue !== null && (isNaN(numericValue) || numericValue < 0 || numericValue > maxMarks)) {
            toast({ variant: "destructive", title: "Invalid Range", description: `${field.toUpperCase()} marks must be between 0 and ${maxMarks}.` });
            return;
        }
        setMarks(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], [field]: numericValue, isModified: true }
        }));
    };

    const handleCalculateAll = async () => {
        if (students.length === 0) return;

        setIsSaving(true);
        const studentIds = students.map(s => s.id);
        const { success, data, error } = await calculateFinalMarks(selectedClassId, studentIds);

        if (success && data) {
            setMarks(prev => {
                const newMarks = { ...prev };
                data.forEach(result => {
                    if (newMarks[result.studentId]) {
                        newMarks[result.studentId] = {
                            ...newMarks[result.studentId],
                            total: result.total,
                            grade: result.grade,
                            isModified: true
                        };
                    }
                });
                return newMarks;
            });
            toast({ title: 'Success', description: `Calculated grades for ${data.length} students.` });
        } else {
            toast({ variant: 'destructive', title: 'Calculation Failed', description: error });
        }
        setIsSaving(false);
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        const recordsToSave = Object.values(marks).filter(m => m.isModified);
        if (recordsToSave.length === 0) {
            toast({ title: 'No Changes', description: 'There are no unsaved changes.' });
            setIsSaving(false);
            return;
        }

        const result = await saveMarksBatch(recordsToSave);
        if (result.success) {
            toast({ title: 'Success', description: result.message });
            setMarks(prev => {
                const newMarks = { ...prev };
                Object.keys(newMarks).forEach(key => {
                    if (newMarks[key].isModified) {
                        newMarks[key].isModified = false;
                    }
                });
                return newMarks;
            });
        } else {
            toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
        }
        setIsSaving(false);
    };

    const modifiedCount = Object.values(marks).filter(m => m.isModified).length;
    const hasUnsavedChanges = modifiedCount > 0;

    // --- RENDER LOGIC ---

    if (isInitialLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4" role="status">
                <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-muted" />
                    <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Loading scheduled sessions...</span>
            </div>
        );
    }

    if (viewState === 'session_list') {
        return (
            <div className="space-y-8 animate-fade-in">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white shadow-lg">
                    <div className="relative z-10">
                        <h1 className="text-2xl font-bold tracking-tight">Manage Marks</h1>
                        <p className="text-white/70 text-sm mt-1">Enter and manage student marks for exam sessions</p>
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                </div>
                <Card className="card-elevated">
                    <CardHeader>
                        <CardTitle>Scheduled Exam Sessions</CardTitle>
                        <CardDescription>Select an exam session to enter or view marks.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {scheduledSessions && scheduledSessions.length > 0 ? scheduledSessions.map(session => (
                            <Card key={session.name} className="flex flex-col hover:shadow-md transition-shadow card-elevated">
                                <CardHeader className="pb-2">
                                    <Badge className="w-fit mb-2" variant={session.name === 'SEE (semester end examinations)' ? 'default' : 'secondary'}>
                                        {session.name.includes('IA') ? 'Internal' : 'External'}
                                    </Badge>
                                    <CardTitle className="text-xl">{session.name}</CardTitle>
                                    <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                                        <CalendarDays className="h-4 w-4" />
                                        <span>{formatDate(session.startDate)} - {formatDate(session.endDate)}</span>
                                    </div>
                                </CardHeader>
                                <CardFooter className="pt-4 border-t mt-auto">
                                    <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md" onClick={() => handleEnterMarksClick(session.name)}>Select Session</Button>
                                </CardFooter>
                            </Card>
                        )) : (
                            <Card className="col-span-full border-dashed card-elevated">
                                <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                                        <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <p className="text-lg font-medium">No sessions scheduled</p>
                                    <p className="text-sm text-muted-foreground">There are no exam sessions scheduled for your classes at this time.</p>
                                </CardContent>
                            </Card>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isSeeMode = activeSession === 'SEE (semester end examinations)';

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white shadow-lg">
                <div className="relative z-10 flex items-center justify-between flex-wrap gap-5">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={handleBackToList} className="text-white hover:bg-white/20"><ArrowLeft className="h-5 w-5" /></Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Marks Entry</h1>
                            <p className="text-white/70 text-sm flex items-center gap-2">
                                <Badge variant="outline" className="border-white/30 text-white">{activeSession}</Badge>
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                        {hasUnsavedChanges && (
                            <span className="text-xs font-medium text-yellow-200 bg-white/10 px-2 py-1 rounded-full animate-pulse mr-2">
                                {modifiedCount} unsaved changes
                            </span>
                        )}
                        {isSeeMode && (
                            <div className="flex flex-col items-end gap-1">
                                <Button variant="outline" onClick={handleCalculateAll} disabled={isLoadingRoster || isSaving || students.length === 0} className="gap-2 border-white/30 text-white hover:bg-white/20">
                                    <Calculator className="h-4 w-4" /> Calculate Grades
                                </Button>
                                <p className="text-[10px] text-white/50 italic">Requires IA-1, IA-2 & SEE</p>
                            </div>
                        )}
                        <Button onClick={handleSaveAll} disabled={isLoadingRoster || isSaving || !hasUnsavedChanges} className="gap-2 bg-white text-emerald-700 hover:bg-white/90 shadow-md">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save All
                        </Button>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            <Card className="bg-muted/30 card-elevated">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md shadow-purple-500/20">
                            <BookOpen className="h-5 w-5" />
                        </div>
                        Filter Student Roster
                    </CardTitle>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-medium"><BookOpen className="h-4 w-4 text-primary" /> 1. Course</Label>
                            <Select value={selectedCourseId} onValueChange={v => { setSelectedCourseId(v); setSelectedClassId(''); }} disabled={isLoadingCourses}>
                                <SelectTrigger><SelectValue placeholder="Identify Course..." /></SelectTrigger>
                                <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4 text-primary" /> 2. Section</Label>
                            <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={!selectedCourseId || isLoadingSections}>
                                <SelectTrigger><SelectValue placeholder="Identify Section..." /></SelectTrigger>
                                <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="card-elevated">
                <CardContent className="pt-6">
                    {isLoadingRoster ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4" role="status">
                            <div className="relative">
                                <div className="h-12 w-12 rounded-full border-4 border-muted" />
                                <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">Fetching student list and marks...</span>
                        </div>
                    ) : students.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table className="min-w-[900px]">
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="border-border/30">
                                        <TableHead className="w-[200px]">Student Details</TableHead>
                                        <TableHead className="text-center">IA-1 (40)</TableHead>
                                        <TableHead className="text-center">IA-2 (40)</TableHead>
                                        <TableHead className="text-center">Other (20)</TableHead>
                                        <TableHead className="text-center">SEE (100)</TableHead>
                                        <TableHead className="text-center bg-primary/5">Final Score</TableHead>
                                        <TableHead className="text-center bg-primary/5">Grade</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map((student) => {
                                        const mark = marks[student.id] ?? {};
                                        const isIa1Disabled = activeSession !== 'IA-1';
                                        const isIa2Disabled = activeSession !== 'IA-2' || mark.ia1 === null;
                                        const isOtherDisabled = activeSession !== 'Other';
                                        const isSeeDisabled = !isSeeMode || mark.ia1 === null || mark.ia2 === null;

                                        const getDisabledLabel = () => {
                                            if (activeSession === 'IA-2' && mark.ia1 === null) return "Enter IA-1 first";
                                            if (isSeeMode && (mark.ia1 === null || mark.ia2 === null)) return "Enter IA-1 & IA-2 first";
                                            return null;
                                        };
                                        const disabledLabel = getDisabledLabel();

                                        return (
                                            <TableRow key={student.id} className={mark.isModified ? "bg-yellow-50 dark:bg-yellow-900/10" : "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border-border/20"}>
                                                <TableCell className="py-4">
                                                    <p className="font-semibold text-sm">{student.name}</p>
                                                    <p className="text-xs text-muted-foreground">{student.collegeId}</p>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Input
                                                        type="number"
                                                        defaultValue={mark.ia1 ?? ''}
                                                        onChange={e => handleMarkChange(student.id, 'ia1', e.target.value)}
                                                        disabled={isIa1Disabled}
                                                        className="h-9 w-20 mx-auto text-center font-medium"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <Input
                                                            type="number"
                                                            defaultValue={mark.ia2 ?? ''}
                                                            onChange={e => handleMarkChange(student.id, 'ia2', e.target.value)}
                                                            disabled={isIa2Disabled}
                                                            className="h-9 w-20 mx-auto text-center font-medium"
                                                        />
                                                        {activeSession === 'IA-2' && mark.ia1 === null && (
                                                            <span className="text-[10px] text-amber-600 font-medium">Req. IA-1</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Input
                                                        type="number"
                                                        defaultValue={mark.other ?? ''}
                                                        onChange={e => handleMarkChange(student.id, 'other', e.target.value)}
                                                        disabled={isOtherDisabled}
                                                        className="h-9 w-20 mx-auto text-center font-medium"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <Input
                                                            type="number"
                                                            defaultValue={mark.see ?? ''}
                                                            onChange={e => handleMarkChange(student.id, 'see', e.target.value)}
                                                            disabled={isSeeDisabled}
                                                            className="h-9 w-20 mx-auto text-center font-medium"
                                                        />
                                                        {isSeeMode && (mark.ia1 === null || mark.ia2 === null) && (
                                                            <span className="text-[10px] text-amber-600 font-medium whitespace-nowrap">Req. IA-1 & 2</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center bg-primary/5">
                                                    <span className="text-lg font-bold text-primary">{mark.total ?? '-'}</span>
                                                </TableCell>
                                                <TableCell className="text-center bg-primary/5">
                                                    <Badge className="font-bold text-sm" variant={mark.grade === 'FAIL' ? 'destructive' : 'default'}>
                                                        {mark.grade || '-'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                                <Users className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {selectedClassId ? "Roster is empty for this section." : "Select a course and section above to view students."}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
