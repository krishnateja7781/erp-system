

'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, BookOpen, CheckCircle, CalendarDays, DollarSign, AlertTriangle, RefreshCw, Download } from "lucide-react";
import { getStudentDashboardData, type StudentDashboardData } from '@/actions/dashboard-actions';
import { getMyStudentProfile } from '@/actions/student-actions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { TimetableGrid } from '@/components/shared/TimetableGrid';

export default function StudentDashboardPage() {
    const [dashboardData, setDashboardData] = React.useState<StudentDashboardData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [userName, setUserName] = React.useState<string | null>(null);
    const { toast } = useToast();

    const loadData = React.useCallback(async (isRefresh = false) => {
        if (!isRefresh) setIsLoading(true); else setIsRefreshing(true);
        setError(null);

        try {
            const profile = await getMyStudentProfile();
            if (!profile) {
                setError("Login information not found. Please log in again.");
                return;
            }
            if (!isRefresh) setUserName(profile.name);
            const data = await getStudentDashboardData(profile.studentId);
            setDashboardData(data);
        } catch (err: any) {
            console.error("Failed to load dashboard data:", err);
            setError("Could not load your dashboard data. Please try refreshing.");
        } finally {
            if (!isRefresh) setIsLoading(false); else setIsRefreshing(false);
        }
    }, []);

    // Initial load
    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDownload = () => {
        toast({
            title: "Feature Not Implemented",
            description: "PDF/iCal download is not yet available.",
        });
    };


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
                <Button onClick={() => loadData()} className="mt-4" variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                </Button>
            </div>
        );
    }

    const { overallAttendance, coursesEnrolledCount, upcomingExam, schedule } = dashboardData;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* ── Hero Header ── */}
            <div className="dashboard-hero">
              <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">Welcome back, {userName || 'Student'}!</h1>
                  <p className="text-white/70 mt-2 text-sm leading-relaxed max-w-lg">Here's an overview of your academic progress and upcoming events.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={isRefreshing} className="gap-2 border-white/30 text-white hover:bg-white/10 hover:text-white bg-white/10 backdrop-blur-sm">
                    <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                    Refresh
                </Button>
              </div>
            </div>

            {/* ── Gradient Stat Cards ── */}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div className="stat-card stat-card-green">
                    <div className="relative z-10">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white/80">Attendance</p>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                          <CheckCircle className="h-6 w-6 text-white"/>
                        </div>
                      </div>
                      <p className="text-4xl font-bold tracking-tight mt-2">{overallAttendance ?? 'N/A'}%</p>
                      <div className="mt-3 h-2 rounded-full bg-white/20 overflow-hidden">
                        <div className="h-full rounded-full bg-white/80 transition-all duration-500" style={{ width: `${overallAttendance ?? 0}%` }} />
                      </div>
                      {overallAttendance !== null && overallAttendance < 75 && (
                        <p className="text-xs text-white/90 mt-2 font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Below minimum requirement (75%)
                        </p>
                      )}
                    </div>
                </div>

                <div className="stat-card stat-card-blue">
                    <div className="relative z-10">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white/80">Courses Enrolled</p>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                          <BookOpen className="h-6 w-6 text-white"/>
                        </div>
                      </div>
                      <p className="text-4xl font-bold tracking-tight mt-2">{coursesEnrolledCount ?? 'N/A'}</p>
                      <p className="text-xs text-white/60 mt-1.5">Active courses this semester</p>
                    </div>
                </div>

                <div className="stat-card stat-card-purple">
                    <div className="relative z-10">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white/80">Next Exam</p>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                          <CalendarDays className="h-6 w-6 text-white"/>
                        </div>
                      </div>
                      {upcomingExam ? (
                          <>
                              <p className="text-lg font-bold tracking-tight mt-2">{upcomingExam.sessionName}</p>
                              <p className="text-sm text-white/70 mt-0.5">{upcomingExam.courseName}</p>
                              <p className="text-xs text-white/60 mt-1 flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" />
                                  {formatDate(upcomingExam.date)}
                              </p>
                          </>
                      ) : (
                          <p className="text-sm text-white/60 mt-2">No upcoming exams scheduled.</p>
                      )}
                    </div>
                </div>
            </div>
            
            <TimetableGrid
                schedule={schedule}
                className="mt-2"
                title="My Weekly Timetable"
                description="An overview of your scheduled classes for the week."
                headerAction={
                    <Button variant="outline" onClick={handleDownload} disabled>
                        <Download className="mr-2 h-4 w-4" /> Download (WIP)
                    </Button>
                }
            />
        </div>
    );
}
