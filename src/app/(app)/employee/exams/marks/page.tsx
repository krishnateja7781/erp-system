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
import { getExamSchedules } from '@/actions/exam-actions';
import { getStudentsForClass } from '@/actions/teacher-actions';
import {
    getClassIdForSection,
    getMarksForClass,
    calculateFinalMarks,
    saveMarksBatch,
    type MarksRecord,
} from '@/actions/marks-actions';
import { formatDate } from '@/lib/utils';

type MarksEntry = MarksRecord & { isModified?: boolean };
type ViewState = 'select' | 'marks_entry';

export default function EmployeeMarksPage() {
    const { toast } = useToast();

    // View state
    const [viewState, setViewState] = React.useState<ViewState>('select');
    const [activeSession, setActiveSession] = React.useState<string | null>(null);

    // Dropdown options
    const [examSchedules, setExamSchedules] = React.useState<any[]>([]);
    const [groupedExams, setGroupedExams] = React.useState<Record<string, any[]>>({});

    // Selections
    const [selectedExam, setSelectedExam] = React.useState<any | null>(null);
    const [section, setSection] = React.useState('');
    const [selectedClassId, setSelectedClassId] = React.useState<string>('');

    // Data
    const [students, setStudents] = React.useState<any[]>([]);
    const [marks, setMarks] = React.useState<Record<string, MarksEntry>>({});

    // Loading states
    const [isLoadingExams, setIsLoadingExams] = React.useState(true);
    const [isLoadingRoster, setIsLoadingRoster] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        const loadExams = async () => {
            setIsLoadingExams(true);
            try {
                const exams = await getExamSchedules();
                const filtered = exams.filter(e => e.status === 'Scheduled' || e.status === 'Expired');
                setExamSchedules(filtered);
                const grouped = filtered.reduce((acc, e) => {
                    const sessionName = e.examSessionName || e.examType || 'Uncategorized';
                    if (!acc[sessionName]) acc[sessionName] = [];
                    acc[sessionName].push(e);
                    return acc;
                }, {} as Record<string, any[]>);
                setGroupedExams(grouped);
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'Error', description: err.message });
            } finally {
                setIsLoadingExams(false);
            }
        };
        loadExams();
    }, [toast]);

    const handleLoadMarks = async () => {
        if (!selectedExam || !section.trim()) {
            toast({ variant: 'destructive', title: 'Missing Info', description: 'Please select an exam and enter a section.' });
            return;
        }

        setIsLoadingRoster(true);
        try {
            const classId = await getClassIdForSection(
                selectedExam.program,
                selectedExam.branch,
                selectedExam.semester,
                section.trim().toUpperCase(),
                selectedExam.courseId
            );

            if (!classId) {
                toast({ variant: 'destructive', title: 'Not Found', description: 'Could not locate a class matching that section.' });
                setIsLoadingRoster(false);
                return;
            }

            setSelectedClassId(classId);
            setActiveSession(selectedExam.examSessionName || selectedExam.examType || 'SEE');

            const fetchedStudents = await getStudentsForClass(classId);
            const fetchedMarks = await getMarksForClass(classId);

            setStudents(fetchedStudents);
            const initialMarksState: Record<string, MarksEntry> = {};
            fetchedStudents.forEach(student => {
                const existingMark = fetchedMarks.find(m => m.studentId === student.id);
                initialMarksState[student.id] = existingMark
                    ? { ...existingMark, isModified: false }
                    : { recordId: `temp-${Math.random()}`, studentId: student.id, studentName: student.name, classId: classId, ia1: null, ia2: null, other: null, see: null, total: null, grade: null, isModified: false };
            });
            setMarks(initialMarksState);
            setViewState('marks_entry');
        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsLoadingRoster(false);
        }
    };

    const handleBackToList = () => {
        if (hasUnsavedChanges) {
            if (!window.confirm("You have unsaved changes. Are you sure you want to go back?")) {
                return;
            }
        }
        setActiveSession(null);
        setSelectedExam(null);
        setSection('');
        setSelectedClassId('');
        setViewState('select');
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
    const isSeeMode = activeSession === 'SEE' || activeSession === 'SEE (semester end examinations)';

    if (isLoadingExams) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading schedules...</span>
            </div>
        );
    }

    if (viewState === 'select') {
        return (
            <div className="space-y-8 animate-fade-in">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 p-6 text-white shadow-lg">
                    <div className="relative z-10">
                        <h1 className="text-2xl font-bold tracking-tight">Admin Marks Entry</h1>
                        <p className="text-white/70 text-sm mt-1">Select an Exam Schedule and target Section to synchronize class grades.</p>
                    </div>
                </div>

                <Card className="card-elevated max-w-xl">
                    <CardHeader>
                        <CardTitle>Select Section Target</CardTitle>
                        <CardDescription>Target a specific class partition for grading.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>1. Scheduled Exam Target</Label>
                            <Select onValueChange={(val) => setSelectedExam(examSchedules.find(e => e.id === val))} disabled={examSchedules.length === 0}>
                                <SelectTrigger><SelectValue placeholder="Select an Exam..." /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(groupedExams).map(([group, exams]) => (
                                        <React.Fragment key={group}>
                                            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/30">{group}</div>
                                            {exams.map(e => (
                                                <SelectItem key={e.id} value={e.id}>
                                                    {e.courseName} ({e.program} - Set {e.semester})
                                                </SelectItem>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>2. Target Section</Label>
                            <Input 
                                placeholder="Enter specific section (e.g., A, B)..." 
                                value={section} 
                                onChange={e => setSection(e.target.value)} 
                                disabled={!selectedExam}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md" onClick={handleLoadMarks} disabled={!selectedExam || !section.trim() || isLoadingRoster}>
                            {isLoadingRoster ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BookOpen className="h-4 w-4 mr-2" />}
                            Connect to Marks System
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white shadow-lg">
                <div className="relative z-10 flex items-center justify-between flex-wrap gap-5">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={handleBackToList} className="text-white hover:bg-white/20"><ArrowLeft className="h-5 w-5" /></Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Marks Entry — Section {section.toUpperCase()}</h1>
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
                                <p className="text-[10px] text-white/50 italic">Requires IA-1, IA-2, Others & SEE</p>
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

            <Card className="card-elevated">
                <CardContent className="pt-6">
                    {isLoadingRoster ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4" role="status">
                            <div className="relative">
                                <div className="h-12 w-12 rounded-full border-4 border-muted" />
                                <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">Fetching synchronized student list and marks...</span>
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
                                        const isOtherDisabled = activeSession !== 'Others' || mark.ia1 === null || mark.ia2 === null;
                                        const isSeeDisabled = !isSeeMode || mark.ia1 === null || mark.ia2 === null || mark.other === null;

                                        const getDisabledLabel = () => {
                                            if (activeSession === 'IA-2' && mark.ia1 === null) return "Enter IA-1 first";
                                            if (activeSession === 'Others' && (mark.ia1 === null || mark.ia2 === null)) return "Enter IA-1 & IA-2 first";
                                            if (isSeeMode && (mark.ia1 === null || mark.ia2 === null || mark.other === null)) return "Enter IA-1, IA-2 & Others first";
                                            return null;
                                        };

                                        return (
                                            <TableRow key={student.id} className={mark.isModified ? "bg-yellow-50 dark:bg-yellow-900/10" : "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border-border/20"}>
                                                <TableCell className="py-4">
                                                    <p className="font-semibold text-sm">{student.name}</p>
                                                    <p className="text-xs text-muted-foreground">{student.collegeId}</p>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <Input
                                                            type="number"
                                                            defaultValue={mark.ia1 ?? ''}
                                                            onChange={e => handleMarkChange(student.id, 'ia1', e.target.value)}
                                                            disabled={isIa1Disabled}
                                                            className="h-9 w-20 mx-auto text-center font-medium"
                                                        />
                                                    </div>
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
                                                            <span className="text-[10px] text-amber-600 font-medium whitespace-nowrap">Req. IA-1</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <Input
                                                            type="number"
                                                            defaultValue={mark.other ?? ''}
                                                            onChange={e => handleMarkChange(student.id, 'other', e.target.value)}
                                                            disabled={isOtherDisabled}
                                                            className="h-9 w-20 mx-auto text-center font-medium"
                                                        />
                                                        {activeSession === 'Others' && (mark.ia1 === null || mark.ia2 === null) && (
                                                            <span className="text-[10px] text-amber-600 font-medium whitespace-nowrap">Req. IA-1 & 2</span>
                                                        )}
                                                    </div>
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
                                                        {isSeeMode && (mark.ia1 === null || mark.ia2 === null || mark.other === null) && (
                                                            <span className="text-[10px] text-amber-600 font-medium whitespace-nowrap">Req. IA-1, 2, Others</span>
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
                                Roster is empty for this section.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
