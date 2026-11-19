'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Eye, Loader2, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStudentsByClassForTeacher, type TeacherClassWithStudents } from '@/actions/teacher-actions';
import { getSession } from '@/actions/auth-actions';

export default function TeacherStudentsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<TeacherClassWithStudents[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const session = await getSession();
        const uid = session?.data?.profile?.id;
        if (!uid) { toast({ variant: 'destructive', title: 'Error', description: 'Could not identify teacher.' }); return; }
        setData(await getStudentsByClassForTeacher(uid));
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load student data.' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [toast]);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="text-sm font-medium">Loading students…</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
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
          <CardDescription>Students enrolled in each of your classes.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length > 0 ? (
            <Accordion type="single" collapsible className="w-full" defaultValue={data[0]?.classInfo?.id}>
              {data.map(({ classInfo, students }) => (
                <AccordionItem key={classInfo?.id} value={classInfo?.id || ''}>
                  <AccordionTrigger>
                    <div className="flex justify-between w-full pr-4 items-center">
                      <span className="font-medium">{classInfo?.courseCode} – {classInfo?.courseName} ({classInfo?.class})</span>
                      <Badge variant="secondary" className="ml-4 text-xs font-medium">{students?.length || 0} students</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {students.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-border/30">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border/40 hover:bg-transparent bg-muted/30">
                              <TableHead className="w-10 pl-4">#</TableHead>
                              <TableHead>Student</TableHead>
                              <TableHead>USN</TableHead>
                              <TableHead>Section</TableHead>
                              <TableHead className="text-right pr-4">Profile</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {students.map((student, idx) => (
                              <TableRow key={student.id} className="border-border/20 hover:bg-muted/30 transition-colors group">
                                <TableCell className="pl-4 text-xs text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                                <TableCell className="min-w-[160px]">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-7 w-7 flex-shrink-0 border border-border/50">
                                      <AvatarImage src={(student as any).avatarUrl} />
                                      <AvatarFallback className="text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                        {student.name?.slice(0, 2).toUpperCase() ?? '??'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                      {student.name || '—'}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {student.collegeId || student.id}
                                </TableCell>
                                <TableCell className="text-sm font-medium">{student.section || '—'}</TableCell>
                                <TableCell className="text-right pr-4">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
                                        View Student <MoreHorizontal className="h-3.5 w-3.5 opacity-60" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                      <DropdownMenuItem className="gap-2 cursor-pointer" asChild>
                                        <Link href={`/teacher/students/${student.id}`}>
                                          <Eye className="h-4 w-4" /> View Profile
                                        </Link>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
                        <Users className="h-8 w-8 opacity-30" />
                        <p className="text-sm">No students are enrolled in this class.</p>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Users className="h-10 w-10 opacity-30" />
              <p className="text-sm">You are not assigned to any classes.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
