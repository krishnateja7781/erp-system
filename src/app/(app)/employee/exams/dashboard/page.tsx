'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthProtection } from '@/hooks/useAuthProtection';
import {
    CalendarCog, BookOpenCheck, Library, ClipboardCheck, TrendingUp,
    AlertTriangle, RefreshCw, Users, Award, BarChart3, CheckCircle2,
    Clock, Calendar, Loader2, FileText, Target
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
    CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';
import { getExamSchedules } from '@/actions/exam-actions';
import { getMarksRecords } from '@/actions/marks-actions';
import { getClassesWithDetails } from '@/actions/class-actions';
import { getGroupedCourses } from '@/actions/course-actions';
import type { ExamSchedule } from '@/lib/types';

const GRADE_COLORS: Record<string, string> = {
    'O': '#10b981', 'A+': '#3b82f6', 'A': '#6366f1',
    'B+': '#8b5cf6', 'B': '#a78bfa', 'C+': '#f59e0b',
    'C': '#fb923c', 'P': '#f97316', 'FAIL': '#ef4444'
};

const STATUS_COLORS: Record<string, string> = {
    'Scheduled': '#10b981', 'Cancelled': '#ef4444', 'Expired': '#f59e0b'
};

export default function EmployeeExamsDashboardPage() {
    const { currentUser } = useAuthProtection('employee');
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [stats, setStats] = React.useState({
        totalExams: 0,
        scheduledExams: 0,
        totalClasses: 0,
        totalCourses: 0,
        marksEntered: 0,
        gradeDist: [] as { grade: string; count: number }[],
        examStatusDist: [] as { name: string; value: number }[],
        recentExams: [] as ExamSchedule[],
        upcomingExams: [] as ExamSchedule[],
    });

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [exams, marksResult, classes, groupedCourses] = await Promise.all([
                getExamSchedules(),
                getMarksRecords(),
                getClassesWithDetails(),
                getGroupedCourses(),
            ]);

            const marks = marksResult.success ? (marksResult.data || []) : [];

            // Grade distribution
            const gradeCounts: Record<string, number> = {};
            marks.forEach(m => {
                if (m.grade) gradeCounts[m.grade] = (gradeCounts[m.grade] || 0) + 1;
            });
            const gradeDist = Object.entries(gradeCounts)
                .map(([grade, count]) => ({ grade, count }))
                .sort((a, b) => {
                    const order = ['O', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'P', 'FAIL'];
                    return order.indexOf(a.grade) - order.indexOf(b.grade);
                });

            // Exam status distribution
            const statusCounts: Record<string, number> = {};
            exams.forEach(e => {
                const s = e.status || 'Unknown';
                statusCounts[s] = (statusCounts[s] || 0) + 1;
            });
            const examStatusDist = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

            // Total courses count
            let totalCourses = 0;
            Object.values(groupedCourses).forEach(program => {
                Object.values(program).forEach(branch => {
                    Object.values(branch).forEach(semCourses => {
                        totalCourses += semCourses.length;
                    });
                });
            });

            const today = new Date().toISOString().split('T')[0];
            const upcomingExams = exams
                .filter(e => e.status === 'Scheduled' && e.date >= today)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 5);
            const recentExams = [...exams]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5);

            setStats({
                totalExams: exams.length,
                scheduledExams: exams.filter(e => e.status === 'Scheduled').length,
                totalClasses: classes.length,
                totalCourses,
                marksEntered: marks.filter(m => m.internals !== null || m.externals !== null).length,
                gradeDist,
                examStatusDist,
                recentExams,
                upcomingExams,
            });
        } catch (err: any) {
            setError(err.message || 'Failed to load dashboard data.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4 animate-fade-in">
                <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-muted" />
                    <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <span className="text-sm text-muted-foreground font-medium">Loading Exam Management Dashboard...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4 animate-fade-in">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
                    <AlertTriangle className="h-7 w-7 text-destructive" />
                </div>
                <h2 className="text-lg font-semibold">Failed to Load Data</h2>
                <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
                <Button onClick={loadData} variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" /> Try Again
                </Button>
            </div>
        );
    }

    const statCards = [
        { label: 'Total Exam Schedules', value: stats.totalExams, icon: CalendarCog, color: 'orange', borderColor: 'border-l-orange-500', textColor: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-950/30', desc: 'All exam sessions' },
        { label: 'Active Scheduled Exams', value: stats.scheduledExams, icon: CheckCircle2, color: 'green', borderColor: 'border-l-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', desc: 'Currently active' },
        { label: 'Total Classes', value: stats.totalClasses, icon: Library, color: 'blue', borderColor: 'border-l-blue-500', textColor: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/30', desc: 'Created class sections' },
        { label: 'Courses Registered', value: stats.totalCourses, icon: BookOpenCheck, color: 'violet', borderColor: 'border-l-violet-500', textColor: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-50 dark:bg-violet-950/30', desc: 'Across all programs' },
        { label: 'Marks Entered', value: stats.marksEntered, icon: ClipboardCheck, color: 'amber', borderColor: 'border-l-amber-500', textColor: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-950/30', desc: 'Student mark entries' },
        { label: 'Grade Distribution', value: stats.gradeDist.length, icon: Target, color: 'pink', borderColor: 'border-l-pink-500', textColor: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-50 dark:bg-pink-950/30', desc: 'Unique grade levels' },
    ];

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 via-red-500 to-pink-500 p-8 text-white shadow-xl">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Exams & Marks Management</h1>
                        <p className="text-white/80 text-sm mt-2">
                            Welcome, {currentUser?.name}. Oversee exam schedules, manage marks, timetables, courses and classes.
                        </p>
                        <div className="flex items-center gap-4 mt-4">
                            <div className="flex items-center gap-2 text-white/90 text-sm bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
                                <Calendar className="h-4 w-4" />
                                <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <CalendarCog className="h-20 w-20 opacity-15" />
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {statCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <Card key={card.label} className={`card-elevated border-l-4 ${card.borderColor} hover:shadow-lg transition-all duration-200`}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.bgColor}`}>
                                    <Icon className={`h-4 w-4 ${card.textColor}`} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{card.value.toLocaleString()}</div>
                                <p className={`text-xs mt-1 ${card.textColor}`}>{card.desc}</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Grade Distribution Bar Chart */}
                <Card className="card-elevated">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>Grade Distribution</CardTitle>
                                <CardDescription>Number of students per grade level</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                        {stats.gradeDist.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.gradeDist} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                    <XAxis dataKey="grade" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                    <RechartsTooltip
                                        cursor={{ fill: 'rgba(99,102,241,0.1)' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)' }}
                                    />
                                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                        {stats.gradeDist.map((entry) => (
                                            <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] || '#6366f1'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                                No grade data available yet
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Exam Status Pie Chart */}
                <Card className="card-elevated">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-md">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>Exam Status Overview</CardTitle>
                                <CardDescription>Breakdown of exam schedule statuses</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                        {stats.examStatusDist.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.examStatusDist}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {stats.examStatusDist.map((entry) => (
                                            <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#6366f1'} />
                                        ))}
                                    </Pie>
                                    <Legend />
                                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                                No exam schedules found
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Upcoming & Recent Exams */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Exams */}
                <Card className="card-elevated">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>Upcoming Exams</CardTitle>
                                <CardDescription>Next scheduled examination sessions</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {stats.upcomingExams.length > 0 ? (
                            <div className="space-y-3">
                                {stats.upcomingExams.map((exam) => (
                                    <div key={exam.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex-shrink-0">
                                            <CalendarCog className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-sm truncate">{exam.courseName || exam.courseCode}</p>
                                            <p className="text-xs text-muted-foreground">{exam.date} • {exam.startTime} - {exam.endTime}</p>
                                        </div>
                                        <div className="text-xs text-right text-muted-foreground flex-shrink-0">
                                            <p>{exam.program}</p>
                                            <p>{exam.branch}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                                <CalendarCog className="h-8 w-8 opacity-40" />
                                <p className="text-sm">No upcoming exams scheduled</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Exams */}
                <Card className="card-elevated">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>Recent Exam Entries</CardTitle>
                                <CardDescription>Latest exam schedule additions</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {stats.recentExams.length > 0 ? (
                            <div className="space-y-3">
                                {stats.recentExams.map((exam) => {
                                    const statusColor =
                                        exam.status === 'Scheduled' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' :
                                        exam.status === 'Cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' :
                                        'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
                                    return (
                                        <div key={exam.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/50 flex-shrink-0">
                                                <Award className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-sm truncate">{exam.courseName || exam.courseCode}</p>
                                                <p className="text-xs text-muted-foreground">{exam.examSessionName} • {exam.date}</p>
                                            </div>
                                            <span className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${statusColor}`}>
                                                {exam.status}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                                <FileText className="h-8 w-8 opacity-40" />
                                <p className="text-sm">No exam records found</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card className="card-elevated">
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Navigate to key management sections</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                        {[
                            { label: 'Courses', href: '/employee/exams/courses', icon: BookOpenCheck, color: 'from-blue-500 to-sky-600' },
                            { label: 'Classes', href: '/employee/exams/classes', icon: Library, color: 'from-cyan-500 to-teal-600' },
                            { label: 'Schedule Exams', href: '/employee/exams/schedule', icon: CalendarCog, color: 'from-orange-500 to-red-600' },
                            { label: 'Enter Marks', href: '/employee/exams/marks', icon: ClipboardCheck, color: 'from-amber-500 to-orange-600' },
                            { label: 'Timetables', href: '/employee/exams/timetables', icon: Users, color: 'from-teal-500 to-emerald-600' },
                            { label: 'Settings', href: '/employee/settings', icon: BarChart3, color: 'from-violet-500 to-purple-600' },
                        ].map(item => {
                            const Icon = item.icon;
                            return (
                                <a
                                    key={item.label}
                                    href={item.href}
                                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all duration-200 group text-center"
                                >
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-white shadow-md group-hover:scale-110 transition-transform duration-200`}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
                                </a>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
