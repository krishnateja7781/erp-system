
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStudentsByClassForTeacher, type TeacherClassWithStudents } from '@/actions/teacher-actions';
import { Button } from '@/components/ui/button';

export default function TeacherStudentsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<TeacherClassWithStudents[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const storedUserString = localStorage.getItem('loggedInUser');
      if (!storedUserString) {
        toast({ variant: "destructive", title: "Error", description: "Could not identify teacher." });
        setIsLoading(false);
        return;
      }
      const user = JSON.parse(storedUserString);
      try {
        const result = await getStudentsByClassForTeacher(user.uid);
        setData(result);
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: "Failed to load student data." });
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [toast]);

  if (isLoading) {
    return <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading...</span></div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white shadow-lg">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight">My Students</h1>
          <p className="text-white/70 text-sm mt-1">View and manage students across your assigned classes</p>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      </div>
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20">
              <Users className="h-5 w-5" />
            </div>
            Class Rosters
          </CardTitle>
          <CardDescription>View the list of students enrolled in each of your classes. Click a name to view their profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length > 0 ? (
            <Accordion type="single" collapsible className="w-full" defaultValue={data[0]?.classInfo.id}>
              {data.map(({ classInfo, students }) => (
                <AccordionItem key={classInfo?.id} value={classInfo?.id || ''}>
                  <AccordionTrigger>
                    <div className="flex justify-between w-full pr-4">
                      <span>{classInfo?.courseCode} - {classInfo?.courseName} ({classInfo?.class})</span>
                      <span className="text-sm text-muted-foreground">{students?.length || 0} Students</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {students.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/30">
                            <TableHead>College ID</TableHead>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Sec</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map(student => (
                            <TableRow key={student.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border-border/20">
                              <TableCell>{student.collegeId || student.id}</TableCell>
                              <TableCell>{student.name}</TableCell>
                              <TableCell>{student.section || 'N/A'}</TableCell>
                              <TableCell className="text-right">
                                <Button asChild variant="outline" size="sm">
                                  <Link href={`/teacher/students/${student.id}`}>
                                    View Profile
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                          <Users className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">No students are enrolled in this class.</p>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">You are not assigned to any classes.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
