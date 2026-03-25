
'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Save, Users, CalendarDays, Loader2, AlertTriangle, Clock, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getTeacherClasses, getStudentsForClass, getAttendanceForSlot, getTeacherSchedule, getTeacherAttendanceLogs, getMyTeacherId, type StudentForClass, type AttendanceLogEntry } from '@/actions/teacher-actions';
import type { ScheduleEntry } from '@/lib/types';
import { saveAttendance } from '@/actions/attendance-actions';
import { TimetableGrid } from '@/components/shared/TimetableGrid';
import { isPeriodActive, PERIOD_SLOTS } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, ClipboardCheck, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type AttendanceStatus = "Present" | "Absent";

interface TeacherClassInfo {
    id: string;
    name: string; // The composite name for display
    courseCode: string;
    courseName: string;
}

export default function TeacherAttendancePage() {
    const { toast } = useToast();
    const searchParams = useSearchParams();

    // State
    const [teacherId, setTeacherId] = React.useState<string | null>(null);
    const [teacherClasses, setTeacherClasses] = React.useState<TeacherClassInfo[]>([]);
    const [schedule, setSchedule] = React.useState<ScheduleEntry[]>([]);
    const [selectedClassId, setSelectedClassId] = React.useState<string | null>(null);
    const [selectedDate, setSelectedDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedPeriod, setSelectedPeriod] = React.useState<number | null>(null);
    const [students, setStudents] = React.useState<StudentForClass[]>([]);
    const [attendanceRecords, setAttendanceRecords] = React.useState<Record<string, AttendanceStatus | null>>({});
    const [originalRecords, setOriginalRecords] = React.useState<Record<string, AttendanceStatus | null>>({});

    // Loading states
    const [isInitialLoading, setIsInitialLoading] = React.useState(true);
    const [isClassDataLoading, setIsClassDataLoading] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    // UI states
    const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
    const [showConfirmationDialog, setShowConfirmationDialog] = React.useState(false);
    const [activeMode, setActiveMode] = React.useState<'take' | 'logs'>('take');
    const [attendanceLogs, setAttendanceLogs] = React.useState<AttendanceLogEntry[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = React.useState(false);

    const fetchLogs = React.useCallback(async () => {
        if (!teacherId) return;
        setIsLoadingLogs(true);
        try {
            const logs = await getTeacherAttendanceLogs(teacherId);
            setAttendanceLogs(logs);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to fetch attendance logs." });
        } finally {
            setIsLoadingLogs(false);
        }
    }, [teacherId, toast]);

    React.useEffect(() => {
        if (activeMode === 'logs' && !selectedClassId) {
            fetchLogs();
        }
    }, [activeMode, fetchLogs, selectedClassId]);

    // --- Data Fetching ---

    // Get current user and fetch their classes and schedule
    React.useEffect(() => {
        async function fetchMyId() {
            const id = await getMyTeacherId();
            if (id) setTeacherId(id);
        }
        fetchMyId();
    }, []);

    React.useEffect(() => {
        if (teacherId) {
            const fetchInitialData = async () => {
                setIsInitialLoading(true);
                try {
                    const [classes, fetchedSchedule] = await Promise.all([
                        getTeacherClasses(teacherId),
                        getTeacherSchedule(teacherId)
                    ]);

                    setTeacherClasses(classes.map((c: any) => ({
                        id: c.id,
                        name: `${c.courseCode} - ${c.courseName} (${c.class})`,
                        courseCode: c.courseCode,
                        courseName: c.courseName,
                    })));
                    
                    const validSchedule = (fetchedSchedule || []).map((s: any) => ({
                        ...s,
                        courseId: s.courseId || '',
                        teacherId: s.teacherId || teacherId
                    }));
                    setSchedule(validSchedule);
                } catch (error) {
                    toast({ variant: "destructive", title: "Error", description: "Failed to fetch your classes or schedule." });
                } finally {
                    setIsInitialLoading(false);
                }
            };
            fetchInitialData();
        }
    }, [teacherId, toast]);

    // Handle direct navigation via query param
    React.useEffect(() => {
        const classIdFromQuery = searchParams.get('classId');
        const periodFromQuery = searchParams.get('period');

        if (classIdFromQuery) {
            setSelectedClassId(classIdFromQuery);
            // If period is also in query, set it, otherwise let user click
            if (periodFromQuery) {
                setSelectedPeriod(parseInt(periodFromQuery, 10));
            } else {
                setSelectedPeriod(null);
            }
        }
    }, [searchParams]);

    // Fetch students and attendance when a session is fully selected
    React.useEffect(() => {
        const fetchClassData = async () => {
            if (!selectedClassId || !selectedDate || selectedPeriod === null) {
                setStudents([]);
                setAttendanceRecords({});
                setOriginalRecords({});
                return;
            }

            if (!isPeriodActive(selectedDate, selectedPeriod)) {
                toast({ variant: 'destructive', title: 'Session Locked', description: `This session has not started yet. It will be available at ${PERIOD_SLOTS[selectedPeriod]?.title || 'the scheduled time'}.` });
                setSelectedClassId(null);
                setSelectedPeriod(null);
                return;
            }

            setIsClassDataLoading(true);
            try {
                const [fetchedStudents, fetchedAttendance] = await Promise.all([
                    getStudentsForClass(selectedClassId),
                    getAttendanceForSlot(selectedClassId, selectedDate, selectedPeriod)
                ]);
                setStudents(fetchedStudents);

                const initialRecords: Record<string, AttendanceStatus | null> = {};
                fetchedStudents.forEach(student => {
                    initialRecords[student.id] = fetchedAttendance[student.id] || null;
                });
                setAttendanceRecords(initialRecords);
                setOriginalRecords(fetchedAttendance);
                setHasUnsavedChanges(false);

            } catch (error: any) {
                toast({ variant: "destructive", title: "Error", description: error.message || "Failed to load data for the class." });
                setStudents([]);
            } finally {
                setIsClassDataLoading(false);
            }
        };
        fetchClassData();
    }, [selectedClassId, selectedDate, selectedPeriod, toast]);

    // --- Handlers ---

    const handleTimetableClick = (day: ScheduleEntry['day'], period: ScheduleEntry['period'], entry: ScheduleEntry | null) => {
        if (entry && entry.classId) {
            if (hasUnsavedChanges) {
                if (!window.confirm("You have unsaved changes. Are you sure you want to switch to a different session? Your changes will be lost.")) {
                    return;
                }
            }

            if (!isPeriodActive(selectedDate, entry.period as number)) {
                toast({ variant: 'destructive', title: 'Session Locked', description: `This session has not started yet. It will be available at ${PERIOD_SLOTS[entry.period as number]?.title || 'the scheduled time'}.` });
                return;
            }

            setSelectedClassId(entry.classId);
            setSelectedPeriod(entry.period as number);
            toast({ title: "Session Selected", description: `${entry.courseName} - Period ${entry.period}` });
        }
    };

    const handleStatusChange = (studentId: string, status: AttendanceStatus | null) => {
        setAttendanceRecords(prev => ({
            ...prev,
            [studentId]: status,
        }));
        setHasUnsavedChanges(true);
    };

    const handleSaveAll = async () => {
        if (students.length === 0) return;
        const allMarked = students.every(s => attendanceRecords[s.id] !== null);
        if (!allMarked) {
            setShowConfirmationDialog(true);
            return;
        }
        await executeSaveAttendance();
    };

    const handleGoBack = () => {
        if (hasUnsavedChanges) {
            if (!window.confirm("You have unsaved changes that will be lost. Are you sure you want to go back?")) {
                return;
            }
        }
        setSelectedClassId(null);
        setSelectedPeriod(null);
        setHasUnsavedChanges(false);
    };

    const executeSaveAttendance = async () => {
        setShowConfirmationDialog(false);
        setIsSaving(true);
        if (!selectedClassId || !teacherId || !selectedDate || selectedPeriod === null) {
            toast({ variant: "destructive", title: "Error", description: "Missing required information to save." });
            setIsSaving(false);
            return;
        }

        const classInfo = teacherClasses.find(c => c.id === selectedClassId);

        const payload = {
            classId: selectedClassId,
            teacherId: teacherId,
            date: selectedDate,
            period: selectedPeriod,
            courseCode: classInfo?.courseCode || '',
            courseName: classInfo?.courseName || '',
            studentRecords: Object.entries(attendanceRecords).filter(([, status]) => status !== null).map(([studentId, status]) => ({ studentId, status: status! })),
        };

        const result = await saveAttendance(payload);

        if (result.success) {
            toast({ title: "Success", description: result.message });
            setHasUnsavedChanges(false);
            setOriginalRecords(attendanceRecords);
        } else {
            toast({ variant: 'destructive', title: "Save Failed", description: result.error });
        }

        setIsSaving(false);
    };

    const { presentCount, absentCount } = React.useMemo(() => {
        return Object.values(attendanceRecords).reduce(
            (counts, status) => {
                if (status === 'Present') counts.presentCount++;
                if (status === 'Absent') counts.absentCount++;
                return counts;
            },
            { presentCount: 0, absentCount: 0 }
        );
    }, [attendanceRecords]);

    const currentClassInfo = teacherClasses.find(c => c.id === selectedClassId);

    if (isInitialLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4" role="status">
                <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-muted" />
                    <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Loading your schedule...</span>
            </div>
        );
    }

    if (!selectedClassId || selectedPeriod === null) {
        return (
            <div className="space-y-8 animate-fade-in">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white shadow-lg">
                    <div className="relative z-10">
                        <h1 className="text-2xl font-bold tracking-tight">Class Attendance</h1>
                        <p className="text-white/70 text-sm mt-1">Take and manage attendance for your scheduled classes</p>
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                </div>

                <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as 'take' | 'logs')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-md">
                        <TabsTrigger value="take" className="flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4" /> Take Attendance
                        </TabsTrigger>
                        <TabsTrigger value="logs" className="flex items-center gap-2">
                            <History className="h-4 w-4" /> Attendance Logs
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="take" className="space-y-4 pt-4">
                        <Card className="card-elevated">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md shadow-green-500/20">
                                        <CalendarDays className="h-5 w-5" />
                                    </div>
                                    1. Select Date & Click Timetable
                                </CardTitle>
                                <CardDescription>Choose a date and then click on a class in your timetable to begin taking attendance.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-5 mb-4">
                                    <Label htmlFor="date-select" className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Date</Label>
                                    <Input
                                        id="date-select"
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-full max-w-xs h-10"
                                    />
                                </div>
                                <TimetableGrid schedule={schedule} interactive onCellClick={handleTimetableClick} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="logs" className="space-y-4 pt-4">
                        <Card className="card-elevated">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md shadow-green-500/20">
                                            <History className="h-5 w-5" />
                                        </div>
                                        Attendance History
                                    </CardTitle>
                                    <CardDescription>Review and edit previously recorded attendance.</CardDescription>
                                </div>
                                <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoadingLogs} className="gap-2">
                                    <RotateCcw className={`h-4 w-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                                    Refresh
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {isLoadingLogs ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading...</span></div>
                                ) : attendanceLogs.length > 0 ? (
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-border/30">
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Period</TableHead>
                                                    <TableHead>Course</TableHead>
                                                    <TableHead>Class</TableHead>
                                                    <TableHead className="text-center">Records</TableHead>
                                                    <TableHead className="text-right">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {attendanceLogs.map((log) => (
                                                    <TableRow key={`${log.classId}_${log.date}_${log.period}`} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border-border/20">
                                                        <TableCell className="font-medium">{log.date}</TableCell>
                                                        <TableCell>P{log.period} ({PERIOD_SLOTS[log.period]?.title})</TableCell>
                                                        <TableCell>
                                                            <div className="font-medium">{log.courseName}</div>
                                                            <div className="text-xs text-muted-foreground">{log.courseCode}</div>
                                                        </TableCell>
                                                        <TableCell>{log.class}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0">{log.studentCount} Students</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="sm" onClick={() => {
                                                                setSelectedDate(log.date);
                                                                setSelectedPeriod(log.period);
                                                                setSelectedClassId(log.classId);
                                                            }}>
                                                                Edit
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 gap-4 text-muted-foreground">
                                        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                                            <History className="h-6 w-6" />
                                        </div>
                                        <p>No attendance logs found for your classes.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        );
    }

    // --- Render Attendance View ---
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white shadow-lg">
                <div className="relative z-10 flex items-center justify-between flex-wrap gap-2">
                    <Button variant="ghost" onClick={handleGoBack} className="gap-2 text-white hover:bg-white/20"><ArrowLeft className="h-4 w-4" /> Change Session</Button>
                    <div className="text-center flex-1">
                        <h1 className="text-xl font-bold truncate">{currentClassInfo?.name}</h1>
                        <p className="text-white/70">{selectedDate} &bull; Period {selectedPeriod}</p>
                    </div>
                    <div className="w-32 h-10"></div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            <Card className="card-elevated">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md shadow-green-500/20">
                            <ClipboardCheck className="h-5 w-5" />
                        </div>
                        Attendance Roster
                    </CardTitle>
                    <CardDescription>Mark each student as Present or Absent.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isClassDataLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading student list...</span></div>
                    ) : students.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table className="min-w-[600px]">
                                <TableHeader>
                                    <TableRow className="border-border/30">
                                        <TableHead className="w-[120px]">Student ID</TableHead>
                                        <TableHead>Student Name</TableHead>
                                        <TableHead className="text-center w-[250px]">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map((student) => {
                                        const currentStatus = attendanceRecords[student.id] ?? null;
                                        const originalStatus = originalRecords[student.id] ?? null;
                                        const isModified = currentStatus !== originalStatus;

                                        return (
                                            <TableRow key={student.id} className={isModified && hasUnsavedChanges ? "bg-yellow-100 dark:bg-yellow-900/30" : ""}>
                                                <TableCell className="font-medium">{student.collegeId}</TableCell>
                                                <TableCell>{student.name}</TableCell>
                                                <TableCell className="text-center">
                                                    <RadioGroup
                                                        value={currentStatus || ""}
                                                        onValueChange={(status) => handleStatusChange(student.id, status as AttendanceStatus)}
                                                        className="flex justify-center gap-2 md:gap-4"
                                                        disabled={isSaving}
                                                    >
                                                        {(["Present", "Absent"] as AttendanceStatus[]).map(statusValue => (
                                                            <div key={statusValue} className="flex items-center space-x-2">
                                                                <RadioGroupItem value={statusValue} id={`${student.id}-${statusValue}`} disabled={isSaving} />
                                                                <Label htmlFor={`${student.id}-${statusValue}`} className="text-sm">{statusValue}</Label>
                                                            </div>
                                                        ))}
                                                    </RadioGroup>
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
                            <p className="text-sm text-muted-foreground">No students found for this class.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 -mx-6 -mb-6 p-4 bg-background/95 backdrop-blur-sm border-t shadow-lg rounded-t-lg">
                <div className="max-w-7xl mx-auto flex justify-between items-center px-6">
                    <div className="flex items-center gap-6 text-sm font-medium">
                        <div className="flex items-center gap-2 text-green-600"><Users className="h-4 w-4" /> Present: <span className="font-bold text-lg">{presentCount}</span></div>
                        <div className="flex items-center gap-2 text-red-600"><Users className="h-4 w-4" /> Absent: <span className="font-bold text-lg">{absentCount}</span></div>
                        <div className="text-muted-foreground">|</div>
                        <div className="flex items-center gap-2">Total: <span className="font-bold text-lg">{students.length}</span></div>
                    </div>
                    <Button onClick={handleSaveAll} disabled={isClassDataLoading || isSaving || !hasUnsavedChanges} size="lg" className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            {showConfirmationDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md p-6 card-elevated">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-md shadow-yellow-500/20">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                Confirm Save
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>Some students have not been marked. Are you sure you want to save the current records?</p>
                            <p className="text-sm text-muted-foreground mt-1">Unmarked students will not be saved.</p>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowConfirmationDialog(false)}>Cancel</Button>
                            <Button onClick={executeSaveAttendance}>Save Anyway</Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}
