
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
    ArrowLeft,
    Search,
    Filter,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Users,
    FileText,
    Wallet,
    Percent
} from "lucide-react";
import { getExamById, getTeacherExamStudents, type StudentEligibility } from "@/actions/exam-actions";
import type { ExamSchedule } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

type FilterStatus = 'all' | 'eligible' | 'not_eligible';

export default function TeacherExamDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const examId = params.examId as string;

    const [teacherId, setTeacherId] = React.useState<string | null>(null);
    const [exam, setExam] = React.useState<ExamSchedule | null>(null);
    const [students, setStudents] = React.useState<StudentEligibility[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [filterStatus, setFilterStatus] = React.useState<FilterStatus>('all');

    React.useEffect(() => {
        const user = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        if (user.uid) setTeacherId(user.uid);
    }, []);

    React.useEffect(() => {
        if (!teacherId || !examId) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [examData, studentData] = await Promise.all([
                    getExamById(examId),
                    getTeacherExamStudents(examId, teacherId)
                ]);

                if (!examData) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Exam not found.' });
                    router.push('/teacher/exams');
                    return;
                }

                setExam(examData);
                setStudents(studentData);
            } catch (err) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch exam details.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [teacherId, examId, toast, router]);

    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.collegeId.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' ||
            (filterStatus === 'eligible' && s.isEligible) ||
            (filterStatus === 'not_eligible' && !s.isEligible);
        return matchesSearch && matchesStatus;
    });

    const eligibleCount = students.filter(s => s.isEligible).length;
    const notEligibleCount = students.length - eligibleCount;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-muted" />
                    <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <p className="font-medium text-muted-foreground">Analyzing student eligibility...</p>
            </div>
        );
    }

    if (!exam) return null;

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white shadow-lg">
                <div className="relative z-10 flex items-center gap-5">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/20">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{exam.courseName}</h1>
                        <p className="text-white/70">{exam.courseCode} • {exam.examSessionName}</p>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="stat-card bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-primary/70 font-medium">Total Students</CardDescription>
                        <CardTitle className="text-3xl flex items-center gap-2">
                            <Users className="h-6 w-6 text-primary" />
                            {students.length}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card className="stat-card bg-green-500/5 border-green-500/20">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-green-600 font-medium">Eligible</CardDescription>
                        <CardTitle className="text-3xl text-green-600 flex items-center gap-2">
                            <CheckCircle className="h-6 w-6" />
                            {eligibleCount}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card className="stat-card bg-red-500/5 border-red-500/20">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-red-600 font-medium">Not Eligible</CardDescription>
                        <CardTitle className="text-3xl text-red-600 flex items-center gap-2">
                            <XCircle className="h-6 w-6" />
                            {notEligibleCount}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Card className="shadow-lg border-primary/10">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Student Eligibility Audit</CardTitle>
                            <CardDescription>Review students from your sections and their exam eligibility.</CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search student or ID..."
                                    className="pl-9 w-[250px]"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex border rounded-md p-1 bg-muted/50">
                                <Button
                                    variant={filterStatus === 'all' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setFilterStatus('all')}
                                    className="text-xs h-8"
                                >
                                    All
                                </Button>
                                <Button
                                    variant={filterStatus === 'eligible' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setFilterStatus('eligible')}
                                    className="text-xs h-8"
                                >
                                    Eligible
                                </Button>
                                <Button
                                    variant={filterStatus === 'not_eligible' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setFilterStatus('not_eligible')}
                                    className="text-xs h-8"
                                >
                                    Not Eligible
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="border-border/30">
                                    <TableHead className="w-[300px]">Student Details</TableHead>
                                    <TableHead>Section</TableHead>
                                    <TableHead>Attendance</TableHead>
                                    <TableHead>Fees Balance</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[300px]">Remarks</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                            No students found matching your filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredStudents.map((s) => (
                                        <TableRow key={s.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border-border/20 transition-colors">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground">{s.name}</span>
                                                    <span className="text-xs text-muted-foreground font-mono">{s.collegeId}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0 font-semibold">
                                                    {s.section}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className={s.attendancePercentage < 75 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                                                        {s.attendancePercentage}%
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className={s.feeBalance > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                                                        ₹{s.feeBalance.toLocaleString()}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {s.isEligible ? (
                                                    <Badge className="bg-green-500 hover:bg-green-600">
                                                        <CheckCircle className="mr-1 h-3 w-3" /> Eligible
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="destructive">
                                                        <XCircle className="mr-1 h-3 w-3" /> Blocked
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {s.reasons.length > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        {s.reasons.map((r, i) => (
                                                            <div key={i} className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-1 rounded border border-red-100 italic">
                                                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                                                {r}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">All criteria met</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
