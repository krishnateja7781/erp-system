
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Phone, Briefcase, GraduationCap, CalendarDays, Home, BookOpen, Building, Link2 } from "lucide-react";
import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { TimetableGrid } from '@/components/shared/TimetableGrid';
import { useRouter } from 'next/navigation';
import { getTeacherProfileDetails } from '@/actions/dashboard-actions';
import type { FullTeacherData, ScheduleEntry } from '@/lib/types';
import Link from "next/link";
import { getMyTeacherId } from '@/actions/teacher-actions';


export default function TeacherProfilePage() {
    const { toast } = useToast();
    const [teacherData, setTeacherData] = React.useState<FullTeacherData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const router = useRouter();

    React.useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const teacherProfileId = await getMyTeacherId();
                if (!teacherProfileId) {
                    if (isMounted) setError("Not logged in. Please log in to view your profile.");
                    return;
                }
                const data = await getTeacherProfileDetails(teacherProfileId, { staffDocId: null, email: null });
                if (isMounted) {
                    if (data) setTeacherData(data);
                    else setError("Could not find profile data.");
                }
            } catch (e) {
                if (isMounted) setError("An error occurred while loading your profile.");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadData();
        return () => { isMounted = false; };
    }, []);

    const handleEditProfile = () => {
        if (teacherData?.profile.id) {
            router.push(`/admin/staff?action=edit&id=${teacherData.profile.id}`);
        } else {
            toast({ title: "Info", description: "Cannot edit profile without a valid ID." });
        }
    };

    const handleTimetableClick = (day: ScheduleEntry['day'], period: ScheduleEntry['period'], entry: (ScheduleEntry & { classId?: string }) | null) => {
        if (entry && entry.classId) {
            const targetUrl = `/teacher/attendance?classId=${entry.classId}`;
            router.push(targetUrl);
        } else {
            toast({
                variant: "destructive",
                title: "Navigation Error",
                description: `Could not find class details for this slot. Please select the class manually.`,
                duration: 4000,
            });
        }
    };

    if (isLoading) {
        return <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading profile...</span></div>;
    }

    if (error) {
        return <div className="text-center text-destructive py-10">{error}</div>;
    }

    if (!teacherData) {
        return <div className="text-center text-muted-foreground py-10">Profile data could not be loaded.</div>;
    }

    const { profile, coursesAssigned, schedule, responsibilities } = teacherData;

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white shadow-lg">
                <div className="relative z-10">
                    <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
                    <p className="text-white/70 text-sm mt-1">View your professional details and schedule</p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            <Card className="card-elevated">
                <CardHeader className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left space-y-4 md:space-y-0 md:space-x-6">
                    <Avatar className="h-24 w-24 border">
                        <AvatarImage src={profile?.avatarUrl || undefined} alt={profile?.name || 'Teacher'} data-ai-hint={`${profile?.department || ''} teacher`} />
                        <AvatarFallback className="text-3xl">{profile?.initials || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <CardTitle className="text-2xl">{profile?.name}</CardTitle>
                        <CardDescription className="text-lg">{profile?.staffId}</CardDescription>
                        <div className="flex items-center gap-2 mt-1 justify-center md:justify-start text-muted-foreground">
                            {profile?.program === 'General Administration' ? <Building className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                            <span>{profile?.program} - {profile?.department}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 justify-center md:justify-start text-muted-foreground">
                            <Briefcase className="h-4 w-4" /> <span>{profile?.position}</span>
                        </div>
                        <div className="flex gap-2 mt-2 justify-center md:justify-start">
                            <Badge variant={profile?.status === 'Active' ? 'default' : 'secondary'}>{profile?.status}</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-5 md:grid-cols-2 pt-4 border-t">
                    <div className="space-y-2">
                        <h3 className="font-semibold text-primary">Contact Information</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Mail className="h-4 w-4" /> <span>{profile?.email}</span> </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Phone className="h-4 w-4" /> <span>{profile?.phone}</span> </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Home className="h-4 w-4" /> <span>Office: {profile?.officeLocation}</span> </div>
                    </div>
                    <div className="space-y-2">
                        <h3 className="font-semibold text-primary">Professional Details</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CalendarDays className="h-4 w-4" /> <span>Joined: {profile?.joinDate}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Qualifications:</span> {profile?.qualifications}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Specialization:</span> {profile?.specialization}
                        </p>
                        <h3 className="font-semibold text-primary pt-2">Responsibilities</h3>
                        {responsibilities && responsibilities.length > 0 ? (
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                {responsibilities.map((resp: string, index: number) => <li key={index}>{resp}</li>)}
                            </ul>
                        ) : <p className="text-sm text-muted-foreground">No specific responsibilities listed.</p>}
                    </div>
                </CardContent>
            </Card>

            <Card className="card-elevated">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20">
                            <BookOpen className="h-5 w-5" />
                        </div>
                        Courses Assigned
                    </CardTitle>
                    <CardDescription>List of courses you are currently handling.</CardDescription>
                </CardHeader>
                <CardContent>
                    {coursesAssigned && coursesAssigned.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border/30">
                                    <TableHead>Course Code</TableHead><TableHead>Course Name</TableHead><TableHead className="text-center">Semester</TableHead><TableHead className="text-right">Class</TableHead><TableHead className="text-right">Classroom</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {coursesAssigned.map((course: any) => (
                                    <TableRow
                                        key={course.id || (course.code + course.class)}
                                        className="cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 border-border/20"
                                    >
                                        <TableCell>{course.code}</TableCell>
                                        <TableCell className="font-medium">{course.name}</TableCell>
                                        <TableCell className="text-center">{course.semester}</TableCell>
                                        <TableCell className="text-right">{course.class}</TableCell>
                                        <TableCell className="text-right">
                                            {course.classroomId ? (
                                                <Button variant="outline" size="sm" asChild className="gap-2">
                                                    <Link href={`/classrooms/${course.classroomId}`}><Link2 className="h-3 w-3" />View</Link>
                                                </Button>
                                            ) : (
                                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0">Not Linked</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                                <BookOpen className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">No courses currently assigned.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <TimetableGrid
                schedule={schedule || []}
                interactive={true}
                onCellClick={handleTimetableClick}
                className="mt-6"
                title="My Weekly Timetable"
                description="Click on a timeslot to take attendance for that class."
            />
        </div>
    );
}
