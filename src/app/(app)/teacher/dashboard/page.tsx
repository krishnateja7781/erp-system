
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarCheck, BookOpen, Loader2, Edit, AlertTriangle, RefreshCw, Clock } from "lucide-react";
import Link from "next/link";
import { getTeacherDashboardData, type TeacherDashboardData } from '@/actions/dashboard-actions';
import { getMyTeacherId } from '@/actions/teacher-actions';
import { Badge } from "@/components/ui/badge";

export default function TeacherDashboardPage() {
    const [dashboardData, setDashboardData] = React.useState<TeacherDashboardData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const teacherProfileId = await getMyTeacherId();
            if (!teacherProfileId) {
                setError("Login information not found. Please log in again.");
                setIsLoading(false);
                return;
            }
            const data = await getTeacherDashboardData(teacherProfileId, {
                staffDocId: null,
                email: null,
            });
            setDashboardData(data);
        } catch (err: any) {
            console.error("Failed to load dashboard data:", err);
            setError("Could not load your dashboard data. Please try refreshing.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);


    if (isLoading) {
        return (
          <div className="flex flex-col justify-center items-center h-64 gap-4 animate-fade-in" role="status" aria-label="Loading dashboard">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-muted" />
              <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Loading your dashboard...</span>
          </div>
        );
    }

    if (error || !dashboardData) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in" role="alert">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mb-4">
                  <AlertTriangle className="h-7 w-7 text-destructive" />
                </div>
                <h2 className="text-lg font-semibold">Failed to Load Dashboard</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">{error || "Dashboard data could not be retrieved."}</p>
                <Button onClick={loadData} className="mt-4" variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* ── Hero Header ── */}
            <div className="dashboard-hero">
              <div className="relative z-10">
                <h1 className="text-3xl font-bold tracking-tight text-white">Welcome back, {dashboardData.name || 'Teacher'}!</h1>
                <p className="text-white/70 mt-2 text-sm leading-relaxed max-w-lg">Here's a summary of your courses, schedule, and tasks.</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <Card className="lg:col-span-2 card-elevated">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-3 text-base font-semibold">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20">
                            <BookOpen className="h-5 w-5"/>
                          </div>
                          Courses You&apos;re Teaching
                        </CardTitle>
                        <CardDescription>Overview of your currently assigned courses.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {dashboardData.coursesTeaching.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border/30">
                                        <TableHead>Course</TableHead>
                                        <TableHead className="text-right">Students</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {dashboardData.coursesTeaching.map(course => (
                                        <TableRow key={course.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors border-border/20">
                                            <TableCell className="font-medium">{course.name}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge className="font-mono bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-0">{course.studentCount}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground">No courses assigned yet.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="card-elevated">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-3 text-base font-semibold">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20">
                            <CalendarCheck className="h-5 w-5"/>
                          </div>
                          Today&apos;s Schedule
                        </CardTitle>
                        <CardDescription>Your upcoming classes for today.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {dashboardData.upcomingClasses.length > 0 ? (
                            dashboardData.upcomingClasses.map((item, index) => (
                                <div key={index} className="flex items-center justify-between text-sm p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors">
                                    <div className="min-w-0">
                                      <p className="font-medium truncate">{item.course} <span className="text-muted-foreground font-normal">({item.class})</span></p>
                                      <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
                                    </div>
                                    <Badge variant="outline" className="ml-2 flex-shrink-0 text-xs">{item.location}</Badge>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                                <CalendarCheck className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground">No classes scheduled for today.</p>
                            </div>
                        )}
                        <Link href="/teacher/profile" passHref>
                          <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground">
                            View Full Timetable →
                          </Button>
                        </Link>
                    </CardContent>
                </Card>
                
                <Card className="card-elevated lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-3 text-base font-semibold">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20">
                            <Edit className="h-5 w-5"/>
                          </div>
                          Pending Tasks
                        </CardTitle>
                        <CardDescription>Action items that need your attention.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* ── Pending Marks (only when exams are published) ── */}
                        {dashboardData.hasPublishedExams && dashboardData.pendingMarksCount > 0 && (
                            <>
                                <div className="flex justify-between items-center text-sm p-3 rounded-xl bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100/50 dark:border-orange-900/20">
                                    <p className="font-medium">Marks to be entered</p>
                                    <Badge className="font-mono bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-0">{dashboardData.pendingMarksCount}</Badge>
                                </div>
                                <Button asChild className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md">
                                    <Link href="/teacher/marks">Enter Marks</Link>
                                </Button>
                            </>
                        )}

                        {/* ── Pending Attendance ── */}
                        {dashboardData.pendingAttendance.length > 0 && (
                            <div className="space-y-2">
                                {dashboardData.pendingAttendance.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/50 dark:border-amber-900/20">
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">
                                                <Clock className="h-3.5 w-3.5 inline mr-1.5 text-amber-600" />
                                                Attendance not taken
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Period {item.period} ({item.periodTitle}) · {item.courseName} · {item.className}
                                            </p>
                                        </div>
                                        <Button asChild size="sm" variant="outline" className="ml-2 flex-shrink-0 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400">
                                            <Link href="/teacher/attendance">Take Attendance</Link>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── No pending tasks ── */}
                        {(!dashboardData.hasPublishedExams || dashboardData.pendingMarksCount === 0) && dashboardData.pendingAttendance.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                                <Edit className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground">No pending tasks. You&apos;re all caught up!</p>
                            </div>
                        )}
                    </CardContent>
                </Card>


            </div>
        </div>
    );
}
