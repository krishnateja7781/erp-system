
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScheduleExamDialog } from '@/components/admin/exams/schedule-exam-dialog';
import { getExamSchedules, deleteExamSchedule } from '@/actions/exam-actions';
import type { ExamSchedule, ExamStatus } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


export default function EmployeeExamSchedulePage() {
    const [allSchedules, setAllSchedules] = React.useState<ExamSchedule[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dialogState, setDialogState] = React.useState<{ isOpen: boolean; mode: 'add' | 'edit'; initialData?: ExamSchedule | null }>({ isOpen: false, mode: 'add', initialData: null });
    const { toast } = useToast();

    const loadSchedules = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedSchedules = await getExamSchedules();
            setAllSchedules(fetchedSchedules);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to load exam schedules." });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => { loadSchedules(); }, [loadSchedules]);

    const groupedSchedules = React.useMemo(() => {
        if (!allSchedules) return {};
        return allSchedules.reduce((acc, schedule) => {
            const sessionName = schedule.examSessionName && schedule.examSessionName.trim() !== '' ? schedule.examSessionName : "Uncategorized Exams";
            if (!acc[sessionName]) acc[sessionName] = [];
            acc[sessionName].push(schedule);
            return acc;
        }, {} as Record<string, ExamSchedule[]>);
    }, [allSchedules]);

    const handleOpenAddDialog = () => setDialogState({ isOpen: true, mode: 'add', initialData: null });
    const handleOpenEditDialog = (schedule: ExamSchedule) => setDialogState({ isOpen: true, mode: 'edit', initialData: schedule });

    const confirmDeleteSchedule = async (scheduleId: string, courseCode: string) => {
        const result = await deleteExamSchedule(scheduleId);
        if (result.success) {
            toast({ title: "Schedule Deleted", description: `Exam schedule for ${courseCode} has been removed.` });
            loadSchedules();
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    };

    const getStatusBadge = (status: ExamStatus) => {
        switch (status) {
            case 'Scheduled': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Scheduled</Badge>;
            case 'Cancelled': return <Badge variant="destructive">Cancelled</Badge>;
            case 'Expired': return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200">Expired</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3" role="status">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading Exam Schedules...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 to-red-500 p-6 mb-6 text-white shadow-lg">
                <div className="relative z-10 flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Manage Exam Schedules</h1>
                        <p className="text-white/70 text-sm mt-1">Schedule, edit, and manage examination timetables with custom rules</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Button onClick={handleOpenAddDialog} className="gap-2 bg-white text-orange-700 hover:bg-white/90 shadow-md">
                            <PlusCircle className="h-4 w-4" /> Schedule Exams
                        </Button>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            <Card className="card-elevated">
                <CardHeader>
                    <CardTitle>Exam Timetables</CardTitle>
                    <CardDescription>Schedules are grouped by examination session. Click to expand. Rules set here govern how marks can be entered.</CardDescription>
                </CardHeader>
                <CardContent>
                    {Object.keys(groupedSchedules).length > 0 ? (
                        <Accordion type="single" collapsible className="w-full" defaultValue={Object.keys(groupedSchedules)[0]}>
                            {Object.entries(groupedSchedules).map(([sessionName, schedules]) => (
                                <AccordionItem key={sessionName} value={sessionName}>
                                    <AccordionTrigger className="text-lg font-medium">
                                        {sessionName} <Badge className="ml-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-0">{schedules.length} exams</Badge>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-border/30">
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Time</TableHead>
                                                    <TableHead>Course</TableHead>
                                                    <TableHead>Class</TableHead>
                                                    <TableHead>Max Marks</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {schedules.map((schedule) => (
                                                    <TableRow key={schedule.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 border-border/20">
                                                        <TableCell>{schedule.date}</TableCell>
                                                        <TableCell>{schedule.startTime} - {schedule.endTime}</TableCell>
                                                        <TableCell>
                                                            <div className="font-medium">{schedule.courseName}</div>
                                                            <div className="text-xs text-muted-foreground">{schedule.courseCode}</div>
                                                        </TableCell>
                                                        <TableCell>{schedule.program} {schedule.branch} - Sem {schedule.semester}</TableCell>
                                                        <TableCell>
                                                            <div className="text-xs space-y-0.5">
                                                                {schedule.maxInternalMarks != null && <div className="text-muted-foreground">Int: <span className="font-medium text-foreground">{schedule.maxInternalMarks}</span></div>}
                                                                {schedule.maxExternalMarks != null && <div className="text-muted-foreground">Ext: <span className="font-medium text-foreground">{schedule.maxExternalMarks}</span></div>}
                                                                {schedule.maxInternalMarks == null && schedule.maxExternalMarks == null && <span className="text-muted-foreground">—</span>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{getStatusBadge((schedule.status ?? '') as ExamStatus)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <AlertDialog>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem onClick={() => handleOpenEditDialog(schedule)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                                                                        <AlertDialogTrigger asChild>
                                                                            <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                                                                        </AlertDialogTrigger>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this exam schedule? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => confirmDeleteSchedule(schedule.id!, schedule.courseCode ?? '')}>Delete</AlertDialogAction></AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="rounded-2xl bg-muted p-3"><Ticket className="h-6 w-6 text-muted-foreground" /></div>
                            <p className="text-sm text-muted-foreground">No exam schedules found. Click "Schedule Exams" to create one.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <ScheduleExamDialog
                isOpen={dialogState.isOpen}
                onOpenChange={(open) => setDialogState(s => ({ ...s, isOpen: open }))}
                onScheduleSaved={loadSchedules}
                mode={dialogState.mode}
                initialData={dialogState.initialData}
            />
        </div>
    );
}
