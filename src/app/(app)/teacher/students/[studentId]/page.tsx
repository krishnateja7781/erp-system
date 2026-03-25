

'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { getStudentProfileForTeacher } from '@/actions/student-actions';
import type { FullStudentData } from '@/lib/types';
import { StudentProfileView } from '@/components/teacher/student-profile-view';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function TeacherStudentProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();

    const [studentData, setStudentData] = React.useState<FullStudentData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadData = async () => {
            const studentId = params.studentId as string;
            const storedUserString = localStorage.getItem('loggedInUser');

            if (!storedUserString) {
                setError("Could not identify teacher. Please log in again.");
                setIsLoading(false);
                return;
            }

            const teacher = JSON.parse(storedUserString);
            if (!teacher?.uid) {
                setError("Teacher authentication details are missing.");
                setIsLoading(false);
                return;
            }

            try {
                const result = await getStudentProfileForTeacher(studentId, teacher.uid);
                if (result.data) {
                    setStudentData(result.data);
                } else {
                    setError(result.error || "Failed to load student profile.");
                }
            } catch (err: any) {
                setError("An unexpected error occurred.");
            } finally {
                setIsLoading(false);
            }
        };

        if (params.studentId) {
            loadData();
        }

    }, [params.studentId, toast]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-muted" />
                    <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Loading student profile...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4 gap-5">
                <Alert variant="destructive" className="w-full max-w-md">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Access Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
            </div>
        );
    }

    if (!studentData) {
        return <div className="text-center text-muted-foreground py-10">Student data could not be loaded.</div>;
    }

    return (
        <div className="space-y-8">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white shadow-lg">
                <div className="relative z-10 flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back" className="text-white hover:bg-white/20">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-xl font-bold text-right">Viewing Student Profile</h1>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>
            <StudentProfileView studentData={studentData} />
        </div>
    );
}
