

'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Home, Calendar, BedDouble, BookOpen, GraduationCap, Loader2, FileText, AlertTriangle } from "lucide-react";
import Link from 'next/link';
import * as React from 'react';
import { getStudentProfileDetails } from "@/actions/dashboard-actions";
import type { FullStudentData } from '@/lib/types';
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuthProtection } from '@/hooks/useAuthProtection';

const HydrationSafeDOB = ({ dateString }: { dateString: string | null | undefined }) => {
  const [displayDate, setDisplayDate] = React.useState(dateString ? dateString : "[Not Provided]");

  React.useEffect(() => {
    if (dateString) {
      try {
        setDisplayDate(new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
      } catch (e) {
        setDisplayDate("[Invalid Date]");
      }
    } else {
      setDisplayDate("[Not Provided]");
    }
  }, [dateString]);

  return <>{displayDate}</>;
};


export default function StudentProfilePage() {
  const { currentUser, authIsLoading } = useAuthProtection('student');
  const [studentData, setStudentData] = React.useState<FullStudentData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const loadData = React.useCallback(async () => {
    if (!currentUser?.id) {
      setError("Could not identify student from the current session.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await getStudentProfileDetails(currentUser.id);
      if (data) {
        setStudentData(data);
      } else {
        setError("Could not find profile data for the logged-in student. The data may be missing or corrupted.");
        toast({ variant: "destructive", title: "Profile Error", description: "Failed to retrieve your complete profile." });
      }
    } catch (e) {
      console.error("Failed to load profile:", e);
      setError("An error occurred while loading your profile.");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast]);

  React.useEffect(() => {
    if (!authIsLoading && currentUser) {
      loadData();
    } else if (!authIsLoading && !currentUser) {
      setError("Not logged in. Please log in to view your profile.");
      setIsLoading(false);
    }
  }, [authIsLoading, currentUser, loadData]);

  if (authIsLoading || isLoading) {
    return <div className="flex flex-col items-center justify-center py-12 gap-4" role="status"><div className="relative"><div className="h-12 w-12 rounded-full border-4 border-muted" /><div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div><span className="text-sm font-medium text-muted-foreground">Loading profile...</span></div>;
  }

  if (error) {
    return <div className="text-center text-destructive py-10 flex flex-col items-center gap-4">
      <AlertTriangle className="h-10 w-10" />
      <h2 className="text-xl font-semibold">Failed to Load Profile</h2>
      <p>{error}</p>
    </div>;
  }

  if (!studentData?.profile) {
    return <div className="flex flex-col items-center justify-center py-16 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4"><GraduationCap className="h-8 w-8 text-muted-foreground/40" /></div><p className="text-sm font-medium text-muted-foreground">Profile data could not be loaded.</p></div>;
  }

  const { profile, coursesEnrolled, hostelInfo } = studentData;
  const displayInitials = profile.initials || '??';
  const validCourses = coursesEnrolled?.filter((course: any) => course && typeof course === 'string' && course.trim().length > 0) || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-6 mb-6 text-white shadow-lg">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
            <p className="text-white/70 text-sm mt-1">Your personal and academic information</p>
          </div>
          <Button onClick={() => router.push('/student/resume')} className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30">
            <FileText className="h-4 w-4" /> Build Resume
          </Button>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      </div>

      <Card className="card-elevated">
        <CardHeader className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left space-y-4 md:space-y-0 md:space-x-6">
          <Avatar className="h-24 w-24 border">
            <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.name ?? 'Student'} />
            <AvatarFallback className="text-3xl">{displayInitials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-2xl">{profile.name}</CardTitle>
            <CardDescription className="text-lg">{profile.collegeId}</CardDescription>
            <p className="flex items-center gap-1 justify-center md:justify-start text-muted-foreground">
              <GraduationCap className="h-4 w-4" />
              <span>{profile.program} - {profile.branch}</span>
            </p>
            <p className="text-muted-foreground">
              Year {profile.year ?? '?'} | Sec {profile.section ?? '?'} | Batch: {profile.batch}
            </p>
            {profile.type && <Badge variant="outline" className="mt-2">{profile.type}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 pt-4 border-t">
          <div className="space-y-3">
            <h3 className="font-semibold text-primary">Contact Information</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span>{profile.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 flex-shrink-0" />
              <span>{profile.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>Date of Birth: <HydrationSafeDOB dateString={profile.dob} /></span>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Home className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium block">Permanent Address:</span>
                <span>{profile.address}</span>
              </div>
            </div>
            {profile.type === "Hosteler" && hostelInfo && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground pt-2 border-t mt-3">
                <BedDouble className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <span className="font-medium block text-primary">Hostel Address:</span>
                  <span>{hostelInfo.hostelName}, Room {hostelInfo.roomNumber}</span>
                  <br />
                  <Link href="/student/hostel" className="text-xs text-primary hover:underline">View Hostel Details &rarr;</Link>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold text-primary flex items-center gap-2"><BookOpen className="h-4 w-4" /> Courses Enrolled (Current Sem)</h3>
            {validCourses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {validCourses.map((course: string, index: number) => (
                  <Badge key={index} className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-0">{course}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">[No courses listed for current semester]</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
