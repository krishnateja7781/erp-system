
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import * as React from 'react';
import { AlertTriangle, CheckCircle, Loader2, BookOpen } from "lucide-react";
import { fetchStudentBacklogs, getMyStudentProfile } from "@/actions/student-actions";
import { getStudentMarksForDisplay, type SemesterMarksData, type CourseMark } from "@/actions/marks-actions";

type BacklogEntry = { courseCode: string | null; courseName: string | null; semesterAttempted: number | null; status: 'Active' | 'Cleared' | null; gradeAchieved: string | null; };

const getGradePoint = (grade: string | null): number | null => {
    if (!grade || grade === 'N/A' || grade === '-') return null;
    switch (grade.toUpperCase()) {
        case 'O': return 10; case 'A+': return 9; case 'A': return 8; case 'B+': return 7;
        case 'B': return 6; case 'C+': return 5; case 'C': return 4; case 'P': return 3;
        case 'FAIL': return 0; default: return null;
    }
};

const calculateSGPA = (courses: CourseMark[]): number | null => {
    let totalCreditPoints = 0; let totalCreditsAttempted = 0;
    courses.forEach((course) => {
        if (course.credits && typeof course.credits === 'number' && course.credits > 0) {
            const gradePoint = getGradePoint(course.grade);
            if (gradePoint !== null) { totalCreditPoints += gradePoint * course.credits; totalCreditsAttempted += course.credits; }
        }
    });
    if (totalCreditsAttempted === 0) return null;
    return parseFloat((totalCreditPoints / totalCreditsAttempted).toFixed(2));
};

const calculateCGPA = (allSemesterData: SemesterMarksData[]): number | null => {
    let totalCreditPoints = 0; let totalCreditsEarned = 0;
    allSemesterData.forEach((semester) => {
        semester.courses.forEach((course) => {
            if (course.credits && typeof course.credits === 'number' && course.credits > 0) {
                const gradePoint = getGradePoint(course.grade);
                if (gradePoint !== null && gradePoint >= 3) { totalCreditPoints += gradePoint * course.credits; totalCreditsEarned += course.credits; }
            }
        });
    });
    if (totalCreditsEarned === 0) return null;
    return parseFloat((totalCreditPoints / totalCreditsEarned).toFixed(2));
};

export default function StudentMarksPage() {
    const [marksData, setMarksData] = React.useState<SemesterMarksData[]>([]);
    const [backlogData, setBacklogData] = React.useState<BacklogEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadData = async () => {
            setIsLoading(true); setError(null);
            try {
                const profile = await getMyStudentProfile();
                if (!profile) { setError("Student not logged in."); setIsLoading(false); return; }
                const [fetchedMarks, fetchedBacklogs] = await Promise.all([
                    getStudentMarksForDisplay(profile.studentId),
                    fetchStudentBacklogs(profile.studentId),
                ]);
                const marksWithGPA = fetchedMarks.map((sem) => ({ ...sem, gpa: calculateSGPA(sem.courses) }));
                setMarksData(marksWithGPA);
                setBacklogData(fetchedBacklogs as BacklogEntry[]);
            } catch (e: any) { setError(e.message || "Failed to load academic data."); }
            finally { setIsLoading(false); }
        };
        loadData();
    }, []);

    const validSemesters = React.useMemo(() => marksData.filter((s) => s && s.semester).sort((a, b) => (b.semester || 0) - (a.semester || 0)), [marksData]);
    const calculatedCGPA = React.useMemo(() => calculateCGPA(marksData), [marksData]);
    const activeBacklogs = React.useMemo(() => backlogData.filter((b) => b.status === 'Active'), [backlogData]);
    const clearedBacklogs = React.useMemo(() => backlogData.filter((b) => b.status === 'Cleared'), [backlogData]);

    const getGradeBadgeVariant = (grade: string | null): "default" | "secondary" | "outline" | "destructive" => {
        if (!grade) return "outline";
        const upperGrade = grade.toUpperCase();
        if (['O', 'A+', 'A'].includes(upperGrade)) return "default";
        if (['B+', 'B'].includes(upperGrade)) return "secondary";
        if (['C+', 'C', 'P'].includes(upperGrade)) return "outline";
        if (upperGrade === 'FAIL') return "destructive";
        return "outline";
    };

    if (isLoading) { return <div className="flex flex-col justify-center items-center h-64 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading academic data...</span></div>; }
    if (error) { return <div className="text-center text-destructive py-10">{error}</div>; }


    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-6 mb-6 text-white shadow-lg">
                <div className="relative z-10">
                    <h1 className="text-4xl font-extrabold tracking-tight">Academic Performance</h1>
                    <p className="text-white/70 text-sm mt-1">Track your marks, grades and overall academic progress.</p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-primary text-primary-foreground shadow-lg border-none overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <CheckCircle className="h-24 w-24" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-primary-foreground/80 font-medium">Cumulative GPA</CardDescription>
                        <CardTitle className="text-5xl font-black">{calculatedCGPA?.toFixed(2) ?? 'N/A'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm font-medium bg-white/20 w-fit px-2 py-1 rounded-md">Overall Excellence</p>
                    </CardContent>
                </Card>

                <Card className="shadow-md border-t-4 border-t-destructive">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-medium text-destructive">Active Backlogs</CardDescription>
                        <CardTitle className="text-4xl font-bold">{activeBacklogs.length}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Requires attention</p>
                    </CardContent>
                </Card>

                <Card className="shadow-md border-t-4 border-t-green-500">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-medium text-green-600">Total Credits Earned</CardDescription>
                        <CardTitle className="text-4xl font-bold">
                            {marksData.reduce((total, sem) =>
                                total + sem.courses.reduce((s, c) =>
                                    s + (c.grade && c.grade !== 'FAIL' && c.grade !== 'N/A' ? (c.credits || 0) : 0), 0)
                                , 0)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Across all semesters</p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20"><BookOpen className="h-5 w-5" /></div> Semester-wise Results
                </h2>
                <Accordion type="single" collapsible className="w-full space-y-3" defaultValue={validSemesters[0]?.semester ? `semester-${validSemesters[0].semester}` : undefined}>
                    {validSemesters.map((semesterData) => (
                        <AccordionItem key={`semester-${semesterData.semester}`} value={`semester-${semesterData.semester}`} className="border rounded-xl px-2 shadow-sm bg-card transition-all data-[state=open]:shadow-md">
                            <AccordionTrigger className="text-lg font-bold px-4 py-4 hover:no-underline">
                                <div className="flex justify-between w-full pr-6 items-center">
                                    <span className="flex items-center gap-3">
                                        <Badge className="h-8 w-8 rounded-full flex items-center justify-center p-0 text-base bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-0">{semesterData.semester}</Badge>
                                        Semester {semesterData.semester}
                                    </span>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground font-medium uppercase">Semester GPA</p>
                                            <p className="text-xl font-black text-primary">{semesterData.gpa?.toFixed(2) ?? 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                                <div className="rounded-lg border overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow className="border-border/30">
                                                <TableHead>Course Details</TableHead>
                                                <TableHead className="text-center">IA-1</TableHead>
                                                <TableHead className="text-center">IA-2</TableHead>
                                                <TableHead className="text-center">Other</TableHead>
                                                <TableHead className="text-center">SEE</TableHead>
                                                <TableHead className="text-center bg-primary/5">Total</TableHead>
                                                <TableHead className="text-center bg-primary/5">Grade</TableHead>
                                                <TableHead className="text-right">Credits</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {semesterData.courses.map((course, index) => (
                                                <TableRow key={course.code || index} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border-border/20">
                                                    <TableCell className="py-4">
                                                        <p className="font-bold text-sm">{course.name}</p>
                                                        <p className="text-xs text-muted-foreground font-medium">{course.code}</p>
                                                    </TableCell>
                                                    <TableCell className="text-center font-medium">{course.ia1 ?? '-'}</TableCell>
                                                    <TableCell className="text-center font-medium">{course.ia2 ?? '-'}</TableCell>
                                                    <TableCell className="text-center font-medium">{course.other ?? '-'}</TableCell>
                                                    <TableCell className="text-center font-medium">{course.externals ?? '-'}</TableCell>
                                                    <TableCell className="text-center bg-primary/5 font-bold">
                                                        {course.total ?? '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center bg-primary/5">
                                                        <Badge variant={getGradeBadgeVariant(course.grade)} className="font-bold px-3">
                                                            {course.grade || 'N/A'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-primary">{course.credits ?? '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="shadow-sm border-destructive/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <AlertTriangle className="h-20 w-20 text-destructive" />
                    </div>
                    <CardHeader className="pb-2 border-b">
                        <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" /> Active Backlogs
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {activeBacklogs.length > 0 ? (
                            <Table>
                                <TableHeader><TableRow><TableHead>Course</TableHead><TableHead className="text-right">Sem</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {activeBacklogs.map((b, i) => (
                                        <TableRow key={i}><TableCell className="font-medium text-sm">{b.courseName}</TableCell><TableCell className="text-right font-bold">{b.semesterAttempted}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
                                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
                                <p className="text-sm font-medium">All courses cleared!</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-green-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <CheckCircle className="h-20 w-20 text-green-500" />
                    </div>
                    <CardHeader className="pb-2 border-b">
                        <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-5 w-5" /> Cleared Backlogs
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {clearedBacklogs.length > 0 ? (
                            <Table>
                                <TableHeader><TableRow><TableHead>Course</TableHead><TableHead className="text-right">Grade</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {clearedBacklogs.map((b, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium text-sm">{b.courseName}</TableCell>
                                            <TableCell className="text-right font-bold">
                                                <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">{b.gradeAchieved}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">No historical backlogs to show.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
