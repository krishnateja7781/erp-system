

'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Mail, Phone, Home, Calendar, ArrowLeft, Edit, Trash2, CheckCircle, BookOpen, BedDouble, GraduationCap } from "lucide-react";
import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { deleteStudent } from '@/actions/student-actions';
import type { FullStudentData } from '@/lib/types';
import { AddStudentDialog } from '@/components/admin/students/add-student-dialog';


interface StudentProfileClientPageProps {
    initialStudentData: FullStudentData;
}

export function StudentProfileClientPage({ initialStudentData }: StudentProfileClientPageProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [studentData] = React.useState<FullStudentData>(initialStudentData);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

    const handleProfileUpdate = () => {
        toast({ title: "Profile Updated", description: "Refreshing student data..." });
        router.refresh();
    };

    const confirmDeleteStudent = async () => {
        if (!studentData?.profile) return;
        const { id, name } = studentData.profile;
        const result = await deleteStudent(id);

        if (result.success) {
            toast({ title: "Student Deleted", description: result.message });
            router.push('/admin/students');
        } else {
            toast({ variant: "destructive", title: "Deletion Failed", description: result.error });
        }
    };

    const handleViewAttendanceLog = () => toast({ title: "Info", description: "Detailed attendance log view not implemented." });
    const handleViewMarksSheet = () => toast({ title: "Info", description: "Detailed marks sheet view not implemented." });

    const { profile, attendance, marks, hostelInfo } = studentData;

    return (
        <>
            <div className="space-y-6">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-purple-500 p-6 text-white shadow-lg">
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back" className="text-white hover:bg-white/10">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setIsEditDialogOpen(true)} className="gap-2 border-white/20 text-white hover:bg-white/10">
                                    <Edit className="h-4 w-4" /> Edit Profile
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="gap-2">
                                            <Trash2 className="h-4 w-4" /> Delete Student
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete the profile for
                                                <span className="font-semibold"> {profile.name} ({profile.collegeId})</span>.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                className="bg-destructive hover:bg-destructive/90"
                                                onClick={confirmDeleteStudent}
                                            >
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">Student Profile: {profile.name}</h1>
                        <p className="text-white/70 text-sm mt-1">Detailed student information and academic records</p>
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                </div>

                <Card className="shadow-sm border-border/50">
                    <CardHeader className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left space-y-4 md:space-y-0 md:space-x-6">
                        <Avatar className="h-24 w-24 border">
                            <AvatarImage src={profile.avatarUrl || undefined} alt={profile.name || 'Student'} />
                            <AvatarFallback className="text-3xl">{profile.initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <CardTitle className="text-2xl">{profile.name}</CardTitle>
                            <CardDescription className="text-lg">{profile.collegeId || profile.id}</CardDescription>
                            <p className="flex items-center justify-center md:justify-start gap-1 text-muted-foreground"><GraduationCap className="h-4 w-4" /> {profile.program} - {profile.branch} (Year {profile.year || 'N/A'})</p>
                            <p className="text-muted-foreground">Batch: {profile.batch}</p>
                            <div className="flex gap-2 mt-2 justify-center md:justify-start">
                                <Badge variant={profile.status === 'Active' ? 'default' : 'destructive'}>{profile.status}</Badge>
                                <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300">{profile.type}</Badge>
                                {profile.type === 'Hosteler' && hostelInfo && (
                                    <Badge variant="outline">{hostelInfo.hostelName} / {hostelInfo.roomNumber}</Badge>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                        <div className="space-y-2">
                            <h3 className="font-semibold text-primary">Contact Information</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Mail className="h-4 w-4" /> <span>{profile.email}</span> </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Phone className="h-4 w-4" /> <span>{profile.phone}</span> </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Calendar className="h-4 w-4" /> <span>DOB: {profile.dob ? new Date(profile.dob).toLocaleDateString() : 'N/A'}</span> </div>
                            <div className="flex items-start gap-2 text-sm text-muted-foreground"> <Home className="h-4 w-4 mt-0.5 flex-shrink-0" /> <span>{profile.address}</span> </div>
                            {profile.type === "Hosteler" && hostelInfo && (
                                <div className="flex items-start gap-2 text-sm text-muted-foreground pt-2 border-t mt-3">
                                    <BedDouble className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                                    <div>
                                        <span className="font-medium block text-primary">Hostel Address:</span>
                                        <span>{hostelInfo.hostelName}, Room {hostelInfo.roomNumber}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-semibold text-primary">Emergency Contact</h3>
                            {profile.emergencyContact && (profile.emergencyContact.name || profile.emergencyContact.phone) ? (
                                <>
                                    <p className="text-sm text-muted-foreground">
                                        <span className="font-medium">Name:</span> {profile.emergencyContact.name || 'N/A'}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        <span className="font-medium">Phone:</span> {profile.emergencyContact.phone || 'N/A'}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        <span className="font-medium">Address:</span> {profile.emergencyContact.address || 'N/A'}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No emergency contact information provided.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>


                <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="shadow-sm border-border/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md shadow-green-500/20"><CheckCircle className="h-5 w-5" /></div> Attendance Summary</CardTitle>
                            <CardDescription>Overall attendance and course-wise breakdown.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Overall Percentage</span>
                                <span className="text-2xl font-bold">{attendance.overallPercentage ?? 'N/A'}%</span>
                            </div>
                            <Progress value={attendance.overallPercentage || 0} aria-label={`${attendance.overallPercentage ?? 0}% Overall Attendance`} />
                            {(attendance.overallPercentage || 0) < 75 && (
                                <p className="text-sm text-destructive">Below minimum requirement (75%)</p>
                            )}
                            <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleViewAttendanceLog}>
                                View Detailed Attendance Log
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-border/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20"><BookOpen className="h-5 w-5" /></div> Marks & Grades Summary</CardTitle>
                            <CardDescription>Overall CGPA and recent performance.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Cumulative GPA (CGPA)</span>
                                <span className="text-2xl font-bold">{marks.cgpa?.toFixed(2) || 'N/A'}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Improved from last semester</p>
                            <h4 className="font-semibold text-sm pt-2">Recent Grades:</h4>
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border/30">
                                        <TableHead>Course</TableHead><TableHead className="text-right">Grade</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {marks.recentGrades.map((grade: any, index: number) => (
                                        <TableRow key={`${grade.course}-${index}`} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 border-border/20">
                                            <TableCell className="font-medium">{grade.course}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge
                                                    variant={grade.grade.startsWith('A') ? 'default' : 'outline'}
                                                    className={grade.grade.startsWith('B') ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300' : ''}
                                                >
                                                    {grade.grade}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleViewMarksSheet}>
                                View Detailed Marks Sheet
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <AddStudentDialog
                isOpen={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                initialData={profile}
                onSave={handleProfileUpdate}
            />
        </>
    );
}
