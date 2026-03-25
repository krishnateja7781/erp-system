
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, BookOpen, GraduationCap, ChevronRight } from "lucide-react";
import { getTeacherExams } from "@/actions/exam-actions";
import type { ExamSchedule } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';

export default function TeacherExamsPage() {
    const { toast } = useToast();
    const [teacherId, setTeacherId] = React.useState<string | null>(null);
    const [exams, setExams] = React.useState<ExamSchedule[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        if (user.uid) setTeacherId(user.uid);
    }, []);

    React.useEffect(() => {
        if (!teacherId) return;

        setIsLoading(true);
        getTeacherExams(teacherId)
            .then(setExams)
            .catch(() => {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Failed to fetch scheduled exams.'
                });
            })
            .finally(() => setIsLoading(false));
    }, [teacherId, toast]);

    const groupedExams = React.useMemo(() => {
        if (!exams) return {};
        return exams.reduce((acc, exam) => {
            const sessionName = exam.examSessionName && exam.examSessionName.trim() !== '' ? exam.examSessionName : "Uncategorized Exams";
            if (!acc[sessionName]) {
                acc[sessionName] = [];
            }
            acc[sessionName].push(exam);
            return acc;
        }, {} as Record<string, ExamSchedule[]>);
    }, [exams]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Scheduled':
                return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Scheduled</Badge>;
            case 'Cancelled':
                return <Badge variant="destructive">Cancelled</Badge>;
            case 'Expired':
                return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200">Expired</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4" role="status">
                <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-muted" />
                    <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Loading scheduled exams...</span>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white shadow-lg">
                <div className="relative z-10">
                    <h1 className="text-2xl font-bold tracking-tight">Scheduled Exams</h1>
                    <p className="text-white/70 text-sm mt-1">Exams scheduled for your assigned programs and branches.</p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            {Object.keys(groupedExams).length === 0 ? (
                <Card className="border-dashed py-12 card-elevated">
                    <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
                        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                            <BookOpen className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-semibold">No Scheduled Exams</h3>
                            <p className="text-muted-foreground max-w-xs mx-auto">
                                There are currently no exams scheduled for the programs or branches you teach.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={Object.keys(groupedExams)[0]}>
                    {Object.entries(groupedExams).map(([sessionName, sessionExams]) => (
                        <AccordionItem key={sessionName} value={sessionName} className="border rounded-lg bg-card overflow-hidden">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20">
                                        <BookOpen className="h-5 w-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-lg font-bold leading-none">{sessionName}</h3>
                                        <p className="text-sm text-muted-foreground mt-1">{sessionExams.length} scheduled subjects</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                                    {sessionExams.map((exam) => (
                                        <Card key={exam.id} className="group hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col card-elevated">
                                            <div className="h-2 w-full bg-primary" />
                                            <CardHeader className="space-y-1">
                                                <div className="flex justify-between items-start">
                                                    <Badge variant="outline" className="font-semibold text-primary border-primary/20">
                                                        {exam.examSessionName}
                                                    </Badge>
                                                    {getStatusBadge(exam.status ?? '')}
                                                </div>
                                                <CardTitle className="text-xl line-clamp-1">{exam.courseName}</CardTitle>
                                                <CardDescription className="text-primary/70 font-medium">
                                                    {exam.courseCode}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex-1 space-y-4">
                                                <div className="space-y-2">
                                                    <div className="flex items-center text-sm gap-2">
                                                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                                        <span>{exam.program} - {exam.branch}</span>
                                                    </div>
                                                    <div className="flex items-center text-sm gap-2 text-muted-foreground">
                                                        <BookOpen className="h-4 w-4" />
                                                        <span>Year {exam.year}, Semester {exam.semester}</span>
                                                    </div>
                                                    <div className="flex items-center text-sm gap-2">
                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                        <span>{new Date(exam.date ?? '').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                    </div>
                                                    <div className="flex items-center text-sm gap-2 text-muted-foreground">
                                                        <Clock className="h-4 w-4" />
                                                        <span>{exam.startTime} - {exam.endTime}</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                            <div className="p-4 pt-0">
                                                <Link href={`/teacher/exams/${exam.id}`}>
                                                    <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md transition-colors gap-2" disabled={exam.status === 'Expired'}>
                                                        {exam.status === 'Expired' ? 'Session Expired' : 'View Student Eligibility'}
                                                        <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                                    </Button>
                                                </Link>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}
        </div>
    );
}
