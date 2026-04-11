
'use client'; 

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, BarChart2, ListChecks, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as React from 'react';
import { getStudentAttendanceDetails } from '@/actions/student-actions';
import { getMyStudentProfile } from '@/actions/student-actions';

// --- Type Definitions ---
type AttendanceStatusType = "Present" | "Absent" | null;

type DetailedLogEntry = {
  id: string;
  date: string;
  period: number;
  courseCode: string | null;
  courseName: string | null;
  status: AttendanceStatusType;
  semester?: string | number;
};

type CourseSummary = {
  courseCode: string;
  courseName: string;
  attended: number;
  total: number;
};

type SemesterAttendance = {
  semester: number;
  courses: CourseSummary[];
};

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
type DayOfWeek = typeof daysOfWeek[number];
const periodsArray = [1, 2, 3, 4, 5, 6];

// --- Helper Functions ---
const calculatePercentage = (attended: number | null | undefined, total: number | null | undefined): number => {
  const numAttended = typeof attended === 'number' ? attended : 0;
  const numTotal = typeof total === 'number' ? total : 0;
  if (numTotal <= 0 || numAttended < 0 || numAttended > numTotal) {
    return 0;
  }
  return parseFloat(((numAttended / numTotal) * 100).toFixed(2));
};

export default function StudentAttendancePage() {
  const { toast } = useToast();
  const [attendanceSummary, setAttendanceSummary] = React.useState<SemesterAttendance[]>([]);
  const [detailedLog, setDetailedLog] = React.useState<DetailedLogEntry[]>([]);
  const [selectedSemester, setSelectedSemester] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const loadAttendanceData = async () => {
      setIsLoading(true);
      try {
        const profile = await getMyStudentProfile();
        if (!profile) {
            toast({ variant: "destructive", title: "Error", description: "Could not identify student." });
            setIsLoading(false);
            return;
        }
        const data = await getStudentAttendanceDetails(profile.studentId);
        setDetailedLog(data.logs);
        setAttendanceSummary(data.summary);
        if (data.summary.length > 0) {
            const latestSemester = Math.max(...data.summary.map((s: any) => s.semester));
            setSelectedSemester(latestSemester.toString());
        }
      } catch(e: any) {
        toast({ variant: "destructive", title: "Failed to load data", description: e.message });
      } finally {
        setIsLoading(false);
      }
    };
    loadAttendanceData();
  }, [toast]);
  

  const availableSemesters = React.useMemo(() => {
      const semestersSet = new Set<string>();
      attendanceSummary.forEach(s => {
          if (s && typeof s.semester === 'number') {
            semestersSet.add(s.semester.toString());
          }
      });
      return Array.from(semestersSet).sort((a, b) => parseInt(b) - parseInt(a)); 
  }, [attendanceSummary]);

  const currentSemesterData = React.useMemo(() => {
      return attendanceSummary.find(s => s && s.semester.toString() === selectedSemester);
  }, [attendanceSummary, selectedSemester]);

  const dayWiseGridData = React.useMemo(() => {
    const grid = new Map<string, Map<number, { status: AttendanceStatusType; courseName: string | null; courseCode: string | null }>>();

    // Filter detailedLog by selectedSemester
    const filteredLogs = detailedLog.filter(log => log && log.semester?.toString() === selectedSemester);

    filteredLogs.forEach(log => {
        if (log && log.date && typeof log.period === 'number') {
            const dateStr = log.date;
            if (!grid.has(dateStr)) {
                grid.set(dateStr, new Map());
            }
            const dateMap = grid.get(dateStr)!;
            dateMap.set(log.period, { 
                status: log.status, 
                courseName: log.courseName, 
                courseCode: log.courseCode 
            });
        }
    });

    // Sort dates descending
    const sortedGrid = new Map(
      Array.from(grid.entries()).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    );

    return sortedGrid;
  }, [detailedLog, selectedSemester]);


    const getCompactStatusBadge = (status: string | null | undefined) => {
      if (status === 'Present') return <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs px-1 py-0.5">P</Badge>;
      if (status === 'Absent') return <Badge variant="destructive" className="text-xs px-1 py-0.5">A</Badge>;
      return <Badge variant="outline" className="text-xs px-1 py-0.5">?</Badge>;
  };
  
  const subjectWiseTotal = React.useMemo(() => {
    if (!currentSemesterData || !currentSemesterData.courses) return { total: 0, present: 0, percentage: 0 };
    let totalClasses = 0;
    let presentClasses = 0;
    currentSemesterData.courses.forEach(course => {
        if (course && typeof course.total === 'number' && course.total > 0) {
            totalClasses += course.total;
            if (typeof course.attended === 'number' && course.attended >= 0) {
                presentClasses += course.attended;
            }
        }
    });
    return {
        total: totalClasses,
        present: presentClasses,
        percentage: calculatePercentage(presentClasses, totalClasses)
    };
  }, [currentSemesterData]);

  if(isLoading) {
    return <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading...</span></div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-6 mb-6 text-white shadow-lg">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Attendance Detail</h1>
            <p className="text-white/70 text-sm mt-1">Track your attendance across all subjects and semesters</p>
          </div>
          <Select value={selectedSemester} onValueChange={setSelectedSemester}>
            <SelectTrigger className="w-[180px] bg-white/20 border-white/30 text-white">
                <SelectValue placeholder="Select Semester" />
            </SelectTrigger>
            <SelectContent>
                {availableSemesters.map(sem => (
                    <SelectItem key={sem} value={sem}>Semester {sem}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      </div>

      <Tabs defaultValue="subject-wise" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="subject-wise" className="gap-2"><BarChart2 className="h-4 w-4"/>Subject Wise</TabsTrigger>
          <TabsTrigger value="day-wise" className="gap-2"><ListChecks className="h-4 w-4"/>Day Wise</TabsTrigger>
        </TabsList>

        <TabsContent value="subject-wise" className="mt-4">
          <Card className="card-elevated">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Semester {currentSemesterData?.semester || '-'}</CardTitle>
                </div>
              <CardDescription>Attendance summary by subject for the selected semester.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30">
                    <TableHead>Course</TableHead>
                    <TableHead className="text-center">Total (Lect/Lab)</TableHead>
                    <TableHead className="text-center">Present (Lect/Lab)</TableHead>
                    <TableHead className="text-right">Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentSemesterData && currentSemesterData.courses.map((course) => {
                    if (!course || !course.courseName) return null;
                    const percentage = calculatePercentage(course.attended, course.total);
                    return (
                      <TableRow key={course.courseCode} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border-border/20">
                        <TableCell className="font-medium">
                          {course.courseCode ? `${course.courseCode} - ` : ''}
                          {course.courseName || <span className="italic text-muted-foreground">[Unknown Course]</span>}
                        </TableCell>
                        <TableCell className="text-center">{typeof course.total === 'number' ? course.total : '-'}</TableCell>
                        <TableCell className="text-center">{typeof course.attended === 'number' ? course.attended : '-'}</TableCell>
                        <TableCell className="text-right">
                            {typeof course.total === 'number' && course.total > 0 ? (
                                <span className={percentage < 75 ? "text-destructive font-semibold" : "text-green-600 font-semibold"}>
                                    {percentage}%
                                </span>
                            ) : (
                                <Badge variant="outline">N/A</Badge>
                            )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center">{subjectWiseTotal.total}</TableCell>
                    <TableCell className="text-center">{subjectWiseTotal.present}</TableCell>
                    <TableCell className="text-right">
                        <span className={subjectWiseTotal.percentage < 75 ? "text-destructive" : "text-green-600"}>
                            {subjectWiseTotal.percentage}%
                        </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              {(!currentSemesterData || currentSemesterData.courses.length === 0) && (
                <div className="flex flex-col items-center justify-center py-16 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4"><BarChart2 className="h-8 w-8 text-muted-foreground/40" /></div><p className="text-sm font-medium text-muted-foreground">No subject-wise attendance data available for this semester.</p></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="day-wise" className="mt-4">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Daily Log (Semester {currentSemesterData?.semester || '-'})</CardTitle>
              <CardDescription>Chronological attendance grid for the selected semester.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="min-w-[700px] border">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px] text-center border-r">Date</TableHead>
                      {periodsArray.map(period => (
                        <TableHead key={period} className="text-center border-r last:border-r-0">{`Period ${period}`}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from(dayWiseGridData.keys()).map(dateStr => {
                      const d = new Date(dateStr);
                      const formattedDate = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
                      const dayName = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
                      
                      return (
                      <TableRow key={dateStr} className="[&_td]:border-r [&_td:last-child]:border-r-0 hover:bg-blue-50/20 dark:hover:bg-blue-900/10">
                        <TableCell className="font-semibold text-center align-middle h-20">
                            <div>{formattedDate}</div>
                            <div className="text-xs text-muted-foreground font-normal">{dayName}</div>
                        </TableCell>
                        {periodsArray.map(period => {
                          const entry = dayWiseGridData.get(dateStr)?.get(period);
                          return (
                            <TableCell key={`${dateStr}-${period}`} className="text-center align-top p-1.5 h-20">
                              {entry ? (
                                <div className="flex flex-col items-center justify-center h-full text-xs space-y-1">
                                  <span className="font-medium block truncate max-w-[100px]">{entry.courseName || entry.courseCode || 'N/A'}</span>
                                  {getCompactStatusBadge(entry.status)}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
                {dayWiseGridData.size === 0 && (
                 <div className="flex flex-col items-center justify-center py-16 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4"><ListChecks className="h-8 w-8 text-muted-foreground/40" /></div><p className="text-sm font-medium text-muted-foreground">No attendance logs found for this semester.</p></div>
               )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
