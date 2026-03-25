
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CalendarDays, Clock, Info, Download, Loader2, AlertTriangle, Ticket } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { HallTicketDisplay } from '@/components/student/hallticket-display';
import type { HallTicketData, ExamStatus, StudentExamScheduleEntry } from '@/actions/exam-actions';
import { getStudentExamSchedules, getHallTicket } from '@/actions/exam-actions';
import { getMyStudentProfile } from '@/actions/student-actions';
import { formatDate } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function StudentExamPage() {
  const [allSchedules, setAllSchedules] = React.useState<StudentExamScheduleEntry[]>([]);
  const [hallTicketData, setHallTicketData] = React.useState<HallTicketData | null>(null);
  const [isHallTicketLoading, setIsHallTicketLoading] = React.useState(false);
  const [hallTicketError, setHallTicketError] = React.useState<string | null>(null);
  const [isHallTicketDialogOpen, setIsHallTicketDialogOpen] = React.useState(false);
  const hallTicketRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentUser, setCurrentUser] = React.useState<{ program: string, branch: string, semester: number, id: string, name: string, collegeId: string, avatarUrl?: string } | null>(null);

  React.useEffect(() => {
    async function fetchUser() {
      const profile = await getMyStudentProfile();
      if (profile) setCurrentUser({
        id: profile.studentId,
        name: profile.name,
        collegeId: profile.collegeId,
        program: profile.program,
        branch: profile.branch,
        semester: profile.semester,
        avatarUrl: profile.avatarUrl,
      });
    }
    fetchUser();
  }, []);

  React.useEffect(() => {
    if (!currentUser) return;
    const loadSchedules = async () => {
      setIsLoading(true);
      try {
        const fetchedSchedules = await getStudentExamSchedules(currentUser.program, currentUser.branch);
        setAllSchedules(fetchedSchedules);
      } catch (error: any) {
        toast({ variant: 'destructive', title: "Error", description: "Failed to load exam schedules." });
      } finally {
        setIsLoading(false);
      }
    };
    loadSchedules();
  }, [currentUser, toast]);

  const groupedSchedules = React.useMemo(() => {
    if (!allSchedules) return {};
    return allSchedules.reduce((acc, schedule) => {
      const sessionName = schedule.examSessionName && schedule.examSessionName.trim() !== '' ? schedule.examSessionName : "Uncategorized Exams";
      if (!acc[sessionName]) {
        acc[sessionName] = [];
      }
      acc[sessionName].push(schedule);
      return acc;
    }, {} as Record<string, StudentExamScheduleEntry[]>);
  }, [allSchedules]);


  const getStatusBadge = (status: ExamStatus) => {
    switch (status) {
      case 'Upcoming': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Upcoming</Badge>;
      case 'Completed': return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200">Completed</Badge>;
      case 'Ongoing': return <Badge variant="destructive">Ongoing</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleViewHallTicket = async (schedules: StudentExamScheduleEntry[]) => {
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not identify current user.' });
      return;
    }
    // Use current user's semester since schedule entries may not have it
    if (!currentUser) return;

    setIsHallTicketLoading(true);
    setHallTicketError(null);
    setHallTicketData(null);
    setIsHallTicketDialogOpen(true);
    try {
      const result = await getHallTicket(
        currentUser.id,
        currentUser.program,
        currentUser.branch,
        currentUser.semester,
        currentUser.name,
        currentUser.collegeId,
        currentUser.avatarUrl
      );

      if (result.success && result.data) {
        setHallTicketData(result.data);
      } else {
        setHallTicketError(result.error || `Your hall ticket for Semester ${currentUser.semester} is not yet available.`);
        setHallTicketData(null);
      }
    } catch (err: any) {
      console.error("Failed to fetch hall ticket:", err);
      setHallTicketError("Could not load your hall ticket due to a server error.");
    } finally {
      setIsHallTicketLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!hallTicketRef.current || !hallTicketData) {
      toast({ variant: "destructive", title: "Error", description: "Hall ticket content is not available for download." });
      return;
    }
    toast({ title: "Info", description: "Generating PDF..." });
    try {
      const canvas = await html2canvas(hallTicketRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const newImgWidth = imgWidth * ratio * 0.9;
      const newImgHeight = imgHeight * ratio * 0.9;

      const xOffset = (pdfWidth - newImgWidth) / 2;
      const yOffset = (pdfHeight - newImgHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, newImgWidth, newImgHeight);
      pdf.save(`hall_ticket_${hallTicketData.studentId}_Sem${hallTicketData.semester}.pdf`);
      toast({ title: "Success", description: "Hall ticket downloaded as PDF." });
    } catch (e) {
      console.error("PDF Generation Error:", e);
      toast({ variant: "destructive", title: "Download Failed", description: "Could not generate PDF." });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-6 mb-6 text-white shadow-lg">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight">Exams</h1>
          <p className="text-white/70 text-sm mt-1">View your exam schedules and download hall tickets</p>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      </div>

      <Card className="card-elevated">
        <CardHeader>
          <div>
            <CardTitle>My Exam Schedule</CardTitle>
            <CardDescription>Schedules are grouped by session. Click to expand and view your hall ticket.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading...</span></div>
          ) : Object.keys(groupedSchedules).length > 0 ? (
            <Accordion type="single" collapsible className="w-full" defaultValue={Object.keys(groupedSchedules)[0]}>
              {Object.entries(groupedSchedules).map(([sessionName, schedules]) => (
                <AccordionItem key={sessionName} value={sessionName}>
                  <AccordionTrigger className="text-lg font-medium">
                    {sessionName}
                    <Badge className="ml-2 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-0">{schedules.length} exams</Badge>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <Table>
                      <TableHeader><TableRow className="border-border/30"><TableHead>Date</TableHead><TableHead>Course</TableHead><TableHead>Time</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {schedules.map((schedule) => (
                          <TableRow key={schedule.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border-border/20">
                            <TableCell className="font-medium flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-muted-foreground" />
                              {formatDate(schedule.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </TableCell>
                            <TableCell>
                              <div>{schedule.courseName}</div>
                              <div className="text-xs text-muted-foreground">{schedule.courseCode}</div>
                            </TableCell>
                            <TableCell className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {schedule.startTime} - {schedule.endTime}
                            </TableCell>
                            <TableCell className="text-right">{getStatusBadge(schedule.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="text-right pt-2">
                      <Button onClick={() => handleViewHallTicket(schedules)} disabled={isHallTicketLoading} className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md">
                        {isHallTicketLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                        Get Hall Ticket
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4"><CalendarDays className="h-8 w-8 text-muted-foreground/40" /></div><p className="text-sm font-medium text-muted-foreground">No exam schedules have been published for you yet.</p></div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isHallTicketDialogOpen} onOpenChange={setIsHallTicketDialogOpen}>
        <DialogContent className="max-w-3xl flex flex-col max-h-[90vh] p-0">
          <DialogHeader className="p-4 sm:p-6 border-b print:hidden">
            <DialogTitle>Hall Ticket</DialogTitle>
            <DialogDescription>
              {hallTicketData ? `Session: ${hallTicketData.examSessionName}` : `Loading...`}
            </DialogDescription>
          </DialogHeader>
          {isHallTicketLoading ? (
            <div className="p-6 text-center flex-grow flex items-center justify-center">
              <div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
              <p>Loading hall ticket...</p>
            </div>
          ) : hallTicketData ? (
            <>
              <div className="flex-grow overflow-y-auto bg-white p-4 sm:p-6 print:p-0">
                <HallTicketDisplay ref={hallTicketRef} hallTicketData={hallTicketData} />
              </div>
              <DialogFooter className="p-4 sm:p-6 border-t print:hidden flex-shrink-0">
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
                <Button onClick={handleDownloadPdf} className="gap-2">
                  <Download className="h-4 w-4" /> Download as PDF
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="p-6 flex-grow flex flex-col items-center justify-center gap-4">
              <div className="flex flex-col items-center text-destructive text-center">
                <AlertTriangle className="h-10 w-10 mb-3" />
                <p className="font-bold text-base">Hall Ticket Not Available</p>
              </div>
              <div className="w-full max-w-md bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-center space-y-1">
                {hallTicketError ? (
                  <>
                    {hallTicketError.toLowerCase().includes('attendance') && (
                      <p className="font-semibold text-destructive">❌ Attendance Criteria Not Met</p>
                    )}
                    {hallTicketError.toLowerCase().includes('fee') && (
                      <p className="font-semibold text-destructive">❌ Fee Payment Criteria Not Met</p>
                    )}
                    {!hallTicketError.toLowerCase().includes('attendance') && !hallTicketError.toLowerCase().includes('fee') && (
                      <p className="font-semibold text-destructive">❌ Hall Ticket Not Issued</p>
                    )}
                    <p className="text-muted-foreground">{hallTicketError}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Could not display hall ticket. Please contact the examination office.</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Contact your coordinator or examination cell for assistance.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
