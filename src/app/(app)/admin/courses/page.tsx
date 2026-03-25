
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { CourseDialog } from '@/components/admin/courses/course-dialog';
import { getGroupedCourses } from '@/actions/course-actions';

// Define the top-level programs available in the institution.
const PROGRAMS = ["B.Tech", "MBA", "Law", "MBBS", "B.Sc", "B.Com"];

export default function AdminCoursesProgramSelectionPage() {
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    // Dummy handler because the dialog needs it, but it will be handled by the specific page
    const handleCourseSaved = () => {
        toast({ title: 'Action Complete', description: 'Returning to program selection.' });
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 p-6 mb-6 text-white shadow-lg">
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Manage Courses</h1>
                  <p className="text-white/70 text-sm mt-1">Select a program to manage its course catalogue</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)} className="border-white/30 text-white hover:bg-white/10 bg-white/10 backdrop-blur-sm">Add New Course</Button>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>
             <Card className="card-elevated">
                <CardHeader>
                    <CardTitle>Select a Program</CardTitle>
                    <CardDescription>Choose a program to view or manage its course catalogue.</CardDescription>
                </CardHeader>
                <CardContent>
                    {PROGRAMS.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {PROGRAMS.map(program => (
                                <Card key={program} className="flex flex-col card-elevated">
                                    <CardHeader className="flex-grow">
                                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-lg font-medium">{program}</CardTitle>
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 text-white shadow-md shadow-blue-500/20"><GraduationCap className="h-5 w-5" /></div>
                                        </div>
                                         <CardDescription>
                                            Manage courses related to the {program} program.
                                         </CardDescription>
                                    </CardHeader>
                                    <CardFooter>
                                        <Link href={`/admin/courses/${encodeURIComponent(program)}`} passHref className="w-full">
                                            <Button className="w-full">
                                               View Courses
                                            </Button>
                                        </Link>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="rounded-2xl bg-muted p-3"><GraduationCap className="h-6 w-6 text-muted-foreground" /></div>
                            <p className="text-sm text-muted-foreground">No programs are configured in the application.</p>
                        </div>
                    )}
                </CardContent>
             </Card>
             <CourseDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onCourseSaved={handleCourseSaved}
            />
        </div>
    );
}
