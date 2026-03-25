
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Search, Calculator, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getMarksRecords, saveAdminMarksUpdates } from '@/actions/marks-actions';
import type { AdminMarksRecord } from '@/actions/marks-actions';


type MarksField = 'internals' | 'externals';

const calculateGrade = (total: number | null): string | null => {
    if (total === null || typeof total !== 'number' || isNaN(total) || total < 0 || total > 100) return null;
    if (total >= 90) return 'O'; if (total >= 80) return 'A+'; if (total >= 70) return 'A';
    if (total >= 60) return 'B+'; if (total >= 50) return 'B'; if (total >= 45) return 'C+';
    if (total >= 40) return 'C'; if (total >= 35) return 'P'; return 'FAIL';
};

export default function AdminMarksPage() {
    const { toast } = useToast();
    const [allRecords, setAllRecords] = React.useState<AdminMarksRecord[]>([]);
    const [modifiedRecords, setModifiedRecords] = React.useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [filters, setFilters] = React.useState({ program: 'all', branch: 'all', year: 'all', semester: 'all' });
    const [error, setError] = React.useState<string | null>(null);

    const loadMarks = React.useCallback(async () => {
        setIsLoading(true); setError(null);
        try {
            const result = await getMarksRecords();
            if (result.success && result.data) {
                setAllRecords(result.data);
            } else {
                setError(result.error || "Failed to load marks data.");
                toast({ variant: "destructive", title: "Loading Error", description: result.error || "Failed to load marks data." });
            }
        } catch (e: any) {
            setError(e.message || "An unknown error occurred while loading marks.");
            toast({ variant: "destructive", title: "Loading Error", description: e.message || "An unknown error occurred." });
        } finally { setIsLoading(false); }
    }, [toast]);

    React.useEffect(() => { loadMarks(); }, [loadMarks]);

    const programs = React.useMemo(() => ['all', ...new Set(allRecords.map(r => r.program).filter(Boolean) as string[])].sort(), [allRecords]);
    const branches = React.useMemo(() => {
        const relevantRecords = filters.program === 'all' ? allRecords : allRecords.filter(r => r.program === filters.program);
        return ['all', ...new Set(relevantRecords.map(r => r.branch).filter(Boolean) as string[])].sort();
    }, [filters.program, allRecords]);
    const years = React.useMemo(() => ['all', ...new Set(allRecords.map(r => r.year?.toString()).filter(Boolean) as string[])].sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : parseInt(a) - parseInt(b)), [allRecords]);
    const semesters = React.useMemo(() => ['all', ...new Set(allRecords.map(r => r.semester?.toString()).filter(Boolean) as string[])].sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : parseInt(a) - parseInt(b)), [allRecords]);

    const filteredRecords = React.useMemo(() => {
        return allRecords.filter(record =>
            (filters.program === 'all' || record.program === filters.program) &&
            (filters.branch === 'all' || record.branch === filters.branch) &&
            (filters.year === 'all' || record.year?.toString() === filters.year) &&
            (filters.semester === 'all' || record.semester?.toString() === filters.semester) &&
            (!searchTerm || record.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) || record.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) || record.courseCode?.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [allRecords, searchTerm, filters]);

    const handleMarkChange = (recordId: string, field: MarksField, value: string | null) => {
        const numericValue = value === null || value.trim() === '' ? null : parseInt(value, 10);
        if (numericValue !== null && (isNaN(numericValue) || numericValue < 0 || numericValue > 100)) { // Allow up to 100 for total
            toast({ variant: "destructive", title: "Invalid Input", description: "Marks must be a number between 0 and 100." });
            return;
        }
        setAllRecords(prev => prev.map(rec => {
            if (rec.id === recordId) {
                const updatedRec = { ...rec, [field]: numericValue };
                if (typeof updatedRec.internals === 'number' && typeof updatedRec.externals === 'number') {
                    updatedRec.total = updatedRec.internals + updatedRec.externals;
                    updatedRec.grade = calculateGrade(updatedRec.total);
                } else {
                    updatedRec.total = null;
                    updatedRec.grade = null;
                }
                return updatedRec;
            }
            return rec;
        }));
        setModifiedRecords(prev => new Set(prev).add(recordId));
    };

    const handleCalculateAllGrades = () => {
        const modifiedIds = new Set<string>();
        const updatedRecordsState = allRecords.map(rec => {
            if (rec.id && typeof rec.internals === 'number' && typeof rec.externals === 'number') {
                const total = rec.internals + rec.externals;
                const grade = calculateGrade(total);
                if (total !== rec.total || grade !== rec.grade) {
                    modifiedIds.add(rec.id);
                    return { ...rec, total, grade };
                }
            }
            return rec;
        });
        setAllRecords(updatedRecordsState);
        setModifiedRecords(prev => new Set([...prev, ...modifiedIds]));
        toast({ title: "Success", description: `Calculated grades for ${modifiedIds.size} records. Please save your changes.` });
    };

    const handleSaveChanges = async () => {
        const recordsToSave = allRecords.filter(r =>
            modifiedRecords.has(r.id) &&
            r.internals !== null &&
            r.externals !== null &&
            r.studentId &&
            r.courseCode &&
            r.semester
        );
        if (recordsToSave.length === 0) {
            toast({ title: "No Complete Changes", description: "There are no modified records with all required fields to save." });
            return;
        }

        setIsSaving(true);
        const payload = recordsToSave.map(rec => ({
            recordId: rec.id,
            studentId: rec.studentId!,
            courseCode: rec.courseCode!,
            semester: rec.semester!,
            marks: {
                internalsMarks: rec.internals!,
                externalsMarks: rec.externals!,
                totalMarks: rec.total!,
                grade: rec.grade!
            }
        }));

        const result = await saveAdminMarksUpdates(payload);

        if (result.success) {
            toast({ title: "Success", description: result.message });
            setModifiedRecords(new Set());
        } else {
            toast({ variant: "destructive", title: "Save Failed", description: result.error });
        }
        setIsSaving(false);
    };


    const handleDownloadCsv = () => {
        if (filteredRecords.length === 0) return;

        const headers = ['Student Name', 'Student ID', 'Program', 'Branch', 'Year', 'Semester', 'Course Code', 'Course Name', 'Internals', 'Externals', 'Total', 'Grade'];
        const csvRows = filteredRecords.map(r => [
            r.studentName,
            r.studentId,
            r.program,
            r.branch,
            r.year,
            r.semester,
            r.courseCode,
            r.courseName,
            r.internals ?? '-',
            r.externals ?? '-',
            r.total ?? '-',
            r.grade ?? '-'
        ].join(','));

        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `marks_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Success", description: "Marks report downloaded successfully." });
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 p-6 mb-6 text-white shadow-lg">
              <div className="relative z-10 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Manage Marks & Grades</h1>
                  <p className="text-white/70 text-sm mt-1">View, edit, and manage student academic records</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={handleDownloadCsv} disabled={isLoading || filteredRecords.length === 0} className="gap-2 border-white/30 text-white hover:bg-white/10 bg-white/10 backdrop-blur-sm">
                        <Search className="h-4 w-4" /> Export CSV
                    </Button>
                    <Button onClick={handleCalculateAllGrades} disabled={isSaving || isLoading || filteredRecords.length === 0} className="gap-2 border-white/30 text-white hover:bg-white/10 bg-white/10 backdrop-blur-sm" variant="outline">
                        <Calculator className="h-4 w-4" /> Calculate All
                    </Button>
                    <Button onClick={handleSaveChanges} disabled={isSaving || isLoading || modifiedRecords.size === 0} className="gap-2 bg-white text-amber-700 hover:bg-white/90 shadow-md">
                        <Save className="h-4 w-4" /> Save {modifiedRecords.size > 0 ? `(${modifiedRecords.size})` : ''} Changes
                    </Button>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>
            <Card className="card-elevated">
                <CardHeader>
                    <CardTitle>Student Marks Records</CardTitle>
                    <CardDescription>View, edit, and manage student marks and grades.</CardDescription>
                    <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        <div className="md:col-span-2 lg:col-span-2">
                            <Input
                                placeholder="Search Student Name, ID, Course..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={filters.program} onValueChange={(v) => setFilters(f => ({ ...f, program: v, branch: 'all', year: 'all', semester: 'all' }))}>
                            <SelectTrigger><SelectValue placeholder="Program" /></SelectTrigger>
                            <SelectContent>{programs.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All Programs' : p}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={filters.branch} onValueChange={(v) => setFilters(f => ({ ...f, branch: v, year: 'all', semester: 'all' }))} disabled={filters.program === 'all'}>
                            <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
                            <SelectContent>{branches.map(b => <SelectItem key={b} value={b}>{b === 'all' ? 'All Branches' : b}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={filters.year} onValueChange={(v) => setFilters(f => ({ ...f, year: v, semester: 'all' }))}>
                            <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y === 'all' ? 'All Years' : `Year ${y}`}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={filters.semester} onValueChange={(v) => setFilters(f => ({ ...f, semester: v }))}>
                            <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
                            <SelectContent>{semesters.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Semesters' : `Semester ${s}`}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? <div className="flex flex-col items-center justify-center py-12 gap-3" role="status"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="text-sm text-muted-foreground">Loading...</span></div> :
                        error ? <div className="text-center text-destructive py-10"><AlertTriangle className="mx-auto h-8 w-8" /><p className="mt-2">{error}</p></div> :
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-border/30">
                                            <TableHead>Student</TableHead>
                                            <TableHead>Course</TableHead>
                                            <TableHead className="text-center">Internals (60)</TableHead>
                                            <TableHead className="text-center">Externals (100)</TableHead>
                                            <TableHead className="text-center">Total (100)</TableHead>
                                            <TableHead className="text-center">Grade</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRecords.length > 0 ? filteredRecords.map((record) => (
                                            <TableRow key={record.id} className={`hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 border-border/20 ${modifiedRecords.has(record.id) ? "bg-yellow-100/50 dark:bg-yellow-900/20" : ""}`}>
                                                <TableCell>
                                                    <div className="font-medium">{record.studentName}</div>
                                                    <div className="text-xs text-muted-foreground">{record.studentId}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{record.courseCode}</div>
                                                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">{record.courseName}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        defaultValue={record.internals ?? ''}
                                                        onBlur={(e) => handleMarkChange(record.id, 'internals', e.target.value)}
                                                        className="h-8 w-20 mx-auto text-center"
                                                        min="0"
                                                        max="60"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        defaultValue={record.externals ?? ''}
                                                        onBlur={(e) => handleMarkChange(record.id, 'externals', e.target.value)}
                                                        className="h-8 w-20 mx-auto text-center"
                                                        min="0"
                                                        max="100"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="h-8 w-20 mx-auto text-center font-bold flex items-center justify-center bg-muted rounded-md">
                                                        {record.total ?? '-'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="h-8 w-12 mx-auto text-center font-bold flex items-center justify-center bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 rounded-md">
                                                        {record.grade ?? '-'}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )) : (<TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No records match your criteria.</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </div>
                    }
                </CardContent>
                <CardFooter className="flex justify-between border-t bg-muted/20 px-6 py-4">
                    <p className="text-xs text-muted-foreground">Showing {filteredRecords.length} records. Total records loaded: {allRecords.length}.</p>
                    <p className="text-xs font-medium text-primary cursor-pointer hover:underline" onClick={loadMarks}>Refresh Data</p>
                </CardFooter>
            </Card>
        </div>
    );
}
