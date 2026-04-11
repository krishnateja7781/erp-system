
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Users, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-4 pb-2">
                        {students.map(student => (
                          <Card key={student.id} className="flex flex-col overflow-hidden hover:shadow-md transition-all duration-300 group relative bg-card border-border/50">
                            <div className="px-4 py-4 flex flex-col items-center text-center">
                               <Avatar className="h-16 w-16 mb-3 border-2 border-emerald-500/20">
                                 <AvatarImage src={(student as any).avatarUrl} />
                                 <AvatarFallback className="text-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">{student.name?.substring(0,2).toUpperCase()}</AvatarFallback>
                               </Avatar>
                               <h3 className="font-semibold text-base leading-tight truncate w-full group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" title={student.name}>{student.name}</h3>
                               <p className="text-xs font-mono text-muted-foreground mt-1 mb-3">{student.collegeId || student.id}</p>
                               
                               <div className="w-full grid grid-cols-1 gap-2 text-sm text-left bg-muted/30 rounded-lg p-2.5 mb-4">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground text-xs">Section</span>
                                    <span className="font-medium text-xs truncate max-w-[100px]">{student.section || '—'}</span>
                                  </div>
                               </div>
                               
                               <Button 
                                 asChild 
                                 variant="default" 
                                 size="sm" 
                                 className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                               >
                                 <Link href={`/teacher/students/${student.id}`}>
                                   <Eye className="h-4 w-4" /> View Profile
                                 </Link>
                               </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
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
