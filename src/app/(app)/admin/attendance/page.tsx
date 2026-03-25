
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Activity, Users, BarChartHorizontal, Loader2, AlertTriangle, RefreshCw, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getAggregatedAttendance, AggregatedData, uploadAttendanceCsv, CsvAttendanceRow, getAttendanceForExport } from '@/actions/attendance-actions';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ── CSV helpers (client-side, no extra libs) ──────────────────────────────────

function parseCsv(text: string): Record<string, string>[] {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
        return obj;
    });
}

function rowsToCsv(headers: string[], rows: Record<string, any>[]): string {
    const escape = (v: any) => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = headers.join(',');
    const body = rows.map(r => headers.map(h => escape(r[h])).join(',')).join('\n');
    return `${head}\n${body}`;
}

function triggerDownload(filename: string, csvString: string) {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── Page component ────────────────────────────────────────────────────────────

export default function AdminAttendanceSummaryPage() {
    const { toast } = useToast();
    const [aggregatedData, setAggregatedData] = React.useState<AggregatedData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [isDownloading, setIsDownloading] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getAggregatedAttendance();
            if (result.success && result.data) {
                setAggregatedData(result.data);
                if (result.data.duplicateCount > 0 || result.data.incompleteCount > 0) {
                    toast({ variant: "destructive", title: "Data Quality Note", description: `${result.data.duplicateCount} duplicate(s) and ${result.data.incompleteCount} incomplete record(s) were found and skipped during aggregation.`, duration: 7000 });
                }
            } else {
                setError(result.error || "Failed to load aggregated data.");
            }
        } catch (err: any) {
            setError("A critical error occurred while fetching attendance data.");
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => { loadData(); }, [loadData]);

    const [filters, setFilters] = React.useState({ program: 'all', course: 'all', year: 'all', section: 'all' });

    const programs = React.useMemo(() => {
        if (!aggregatedData?.byProgram) return ['all'];
        return ['all', ...Object.keys(aggregatedData.byProgram)];
    }, [aggregatedData]);

    const handleFilterChange = (filterName: 'program' | 'course' | 'year' | 'section', value: string) => {
        setFilters(prev => {
            const next = { ...prev };
            if (filterName === 'program') { next.program = value; next.course = 'all'; next.year = 'all'; next.section = 'all'; }
            else if (filterName === 'course') { next.course = value; next.year = 'all'; next.section = 'all'; }
            else if (filterName === 'year') { next.year = value; next.section = 'all'; }
            else { next[filterName] = value; }
            return next;
        });
    };

    const coursesList = React.useMemo(() => {
        if (!aggregatedData?.byProgram || filters.program === 'all') return ['all'];
        const programData = aggregatedData.byProgram[filters.program];
        return programData?.branches ? ['all', ...Object.keys(programData.branches)] : ['all'];
    }, [filters.program, aggregatedData]);

    const years = React.useMemo(() => {
        if (!aggregatedData?.byProgram || filters.program === 'all' || filters.course === 'all') return ['all'];
        const branchData = aggregatedData.byProgram[filters.program]?.branches?.[filters.course];
        return branchData?.classes ? ['all', ...Object.keys(branchData.classes)] : ['all'];
    }, [filters.program, filters.course, aggregatedData]);

    const sections = React.useMemo(() => {
        if (!aggregatedData?.byProgram || filters.program === 'all' || filters.course === 'all' || filters.year === 'all') return ['all'];
        const classData = aggregatedData.byProgram[filters.program]?.branches?.[filters.course]?.classes?.[filters.year];
        return classData?.sections ? ['all', ...Object.keys(classData.sections)] : ['all'];
    }, [filters.program, filters.course, filters.year, aggregatedData]);

    // ── Upload CSV ──────────────────────────────────────────────────────────
    const handleUploadCsv = () => fileInputRef.current?.click();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Reset so same file can be re-uploaded
        e.target.value = '';

        setIsUploading(true);
        toast({ title: "Uploading…", description: `Parsing ${file.name}` });

        try {
            const text = await file.text();
            const rawRows = parseCsv(text);

            if (rawRows.length === 0) {
                toast({ variant: "destructive", title: "Empty file", description: "No data rows found in the CSV." });
                setIsUploading(false);
                return;
            }

            const csvRows: CsvAttendanceRow[] = rawRows.map(r => ({
                classId: r['classId'] || r['class_id'] || '',
                studentId: r['studentId'] || r['student_id'] || '',
                date: r['date'] || '',
                period: parseInt(r['period'] || '1', 10),
                status: (r['status'] || 'Absent') as 'Present' | 'Absent',
            }));

            const result = await uploadAttendanceCsv(csvRows);

            if (result.success) {
                toast({
                    title: "Upload successful",
                    description: `Saved ${result.savedCount} record(s).${result.skippedCount > 0 ? ` Skipped ${result.skippedCount}.` : ''}`,
                });
                await loadData(); // Refresh the aggregated view
            } else {
                toast({
                    variant: "destructive",
                    title: "Upload failed",
                    description: result.errors.slice(0, 3).join(' | '),
                    duration: 8000,
                });
            }
        } catch (err: any) {
            toast({ variant: "destructive", title: "Upload error", description: err.message || 'Could not process the file.' });
        } finally {
            setIsUploading(false);
        }
    };

    // ── Download CSV ────────────────────────────────────────────────────────
    const handleDownloadReport = async () => {
        setIsDownloading(true);
        toast({ title: "Preparing download…", description: "Fetching records from database." });

        try {
            const exportFilters = {
                program: filters.program !== 'all' ? filters.program : undefined,
                branch: filters.course !== 'all' ? filters.course : undefined,
                year: filters.year !== 'all' ? filters.year : undefined,
                section: filters.section !== 'all' ? filters.section : undefined,
            };

            const result = await getAttendanceForExport(exportFilters);

            if (!result.success || !result.rows) {
                toast({ variant: "destructive", title: "Download failed", description: result.error || "No data found." });
                setIsDownloading(false);
                return;
            }

            if (result.rows.length === 0) {
                toast({ title: "No data", description: "No attendance records match the current filters." });
                setIsDownloading(false);
                return;
            }

            const headers = ['date', 'period', 'program', 'branch', 'year', 'section', 'courseName', 'studentId', 'status'];
            const csvString = rowsToCsv(headers, result.rows as any);
            const parts = [
                filters.program !== 'all' ? filters.program : 'all',
                filters.course !== 'all' ? filters.course : '',
                filters.year !== 'all' ? `year${filters.year}` : '',
                filters.section !== 'all' ? `sec${filters.section}` : '',
                new Date().toISOString().slice(0, 10),
            ].filter(Boolean).join('_');
            triggerDownload(`attendance_${parts}.csv`, csvString);

            toast({ title: "Downloaded", description: `${result.rows.length} records exported.` });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Download error", description: err.message || 'Could not generate the report.' });
        } finally {
            setIsDownloading(false);
        }
    };

    // ── Derived display data ────────────────────────────────────────────────
    const displayData = React.useMemo(() => {
        if (!aggregatedData?.byProgram) return [];
        if (filters.program === 'all') return Object.values(aggregatedData.byProgram);
        const prog = aggregatedData.byProgram[filters.program];
        if (!prog?.branches) return [];
        if (filters.course === 'all') return Object.values(prog.branches);
        const branch = prog.branches[filters.course];
        if (!branch?.classes) return [];
        if (filters.year === 'all') return Object.values(branch.classes);
        const cls = branch.classes[filters.year];
        if (!cls?.sections) return [];
        if (filters.section === 'all') return Object.values(cls.sections);
        const sec = cls.sections[filters.section];
        return sec ? [sec] : [];
    }, [filters, aggregatedData]);

    const detailedViewTitle = React.useMemo(() => {
        if (filters.program === 'all') return "Attendance by Program";
        let title = `Program: ${filters.program}`;
        if (filters.course !== 'all') title += ` / Course: ${filters.course}`;
        if (filters.year !== 'all') title += ` / Year: ${filters.year}`;
        if (filters.section !== 'all') title += ` / Section: ${filters.section}`;
        return title;
    }, [filters]);

    const dynamicStats = React.useMemo(() => {
        if (!displayData || displayData.length === 0) return { percentage: 0, totalClasses: 0, totalPresent: 0, itemTypeCount: 0, totalRecords: 0 };
        let totalClasses = 0; let totalPresent = 0;
        displayData.forEach(item => { totalClasses += (item.totalClasses || 0); totalPresent += (item.totalPresent || 0); });
        return {
            percentage: totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0,
            totalClasses, totalPresent,
            itemTypeCount: displayData.length,
            totalRecords: aggregatedData?.totalRecords || 0,
        };
    }, [displayData, aggregatedData]);

    const displayItemType = React.useMemo(() => {
        if (filters.program === 'all') return "Program";
        if (filters.course === 'all') return "Course";
        if (filters.year === 'all') return "Class (Year)";
        return "Section";
    }, [filters]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3" role="status">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading Attendance Data…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-destructive py-10">
                <AlertTriangle className="mx-auto h-12 w-12" />
                <h2 className="mt-4 text-lg font-semibold">Failed to Load Data</h2>
                <p className="text-sm">{error}</p>
                <Button onClick={loadData} className="mt-4 gap-2" variant="outline">
                    <RefreshCw className="h-4 w-4" /> Retry
                </Button>
            </div>
        );
    }

    if (!aggregatedData || !aggregatedData.overall) {
        return <div className="flex flex-col items-center justify-center py-12 gap-4"><div className="rounded-2xl bg-muted p-3"><Activity className="h-6 w-6 text-muted-foreground" /></div><p className="text-sm font-medium text-muted-foreground">No attendance data available to display.</p></div>;
    }

    const { duplicateCount, incompleteCount } = aggregatedData;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
            />

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-600 to-amber-500 p-6 mb-6 text-white shadow-lg">
              <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Overall Attendance Summary</h1>
                  <p className="text-white/70 text-sm mt-1">Monitor and manage student attendance across all programs</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={handleUploadCsv} disabled={isUploading} className="gap-2 border-white/30 text-white hover:bg-white/10 bg-white/10 backdrop-blur-sm">
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {isUploading ? 'Uploading…' : 'Upload Records (.csv)'}
                    </Button>
                    <Button variant="outline" onClick={handleDownloadReport} disabled={isDownloading} className="gap-2 border-white/30 text-white hover:bg-white/10 bg-white/10 backdrop-blur-sm">
                        {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {isDownloading ? 'Downloading…' : 'Download Report (.csv)'}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={loadData} title="Refresh" className="text-white hover:bg-white/10">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            {/* CSV format hint card */}
            <Card className="border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30">
                <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                        <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                            <span className="font-semibold">CSV Upload Format:</span>{' '}
                            <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">classId, studentId, date (YYYY-MM-DD), period, status (Present|Absent)</code>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {(duplicateCount > 0 || incompleteCount > 0) && (
                <Card className="border-yellow-500 bg-yellow-50 dark:border-yellow-400 dark:bg-yellow-900/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" /> Data Quality Note
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-yellow-700 dark:text-yellow-400 px-4 pb-4 space-y-1">
                        {duplicateCount > 0 && <p>- {duplicateCount} duplicate record ID(s) were found and excluded from calculations.</p>}
                        {incompleteCount > 0 && <p>- {incompleteCount} record(s) missing essential data were skipped during aggregation.</p>}
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <Card className="stat-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Filtered Attendance %</CardTitle>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md shadow-green-500/20"><Activity className="h-5 w-5" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dynamicStats.percentage}%</div>
                        <p className="text-xs text-muted-foreground">Based on {dynamicStats.totalClasses.toLocaleString()} recorded classes in view</p>
                        <Progress value={dynamicStats.percentage} className="mt-2 h-2" />
                    </CardContent>
                </Card>
                <Card className="stat-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Items Tracked ({displayItemType}s)</CardTitle>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-md shadow-yellow-500/20"><BarChartHorizontal className="h-5 w-5" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dynamicStats.itemTypeCount}</div>
                        <p className="text-xs text-muted-foreground">Active {displayItemType.toLowerCase()}s in this view</p>
                    </CardContent>
                </Card>
                <Card className="stat-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total System Records</CardTitle>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/20"><Users className="h-5 w-5" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dynamicStats.totalRecords.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total attendance entries in database</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="card-elevated">
                <CardHeader>
                    <CardTitle>{detailedViewTitle}</CardTitle>
                    <CardDescription>Select filters to view attendance breakdown.</CardDescription>
                    <div className="pt-4 flex flex-wrap items-center gap-4">
                        <Select value={filters.program} onValueChange={(v) => handleFilterChange('program', v)}>
                            <SelectTrigger className="w-full sm:w-auto flex-grow min-w-[150px]">
                                <SelectValue placeholder="Select Program" />
                            </SelectTrigger>
                            <SelectContent>
                                {programs.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All Programs' : p}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={filters.course} onValueChange={(v) => handleFilterChange('course', v)} disabled={filters.program === 'all'}>
                            <SelectTrigger className="w-full sm:w-auto flex-grow min-w-[150px]" disabled={filters.program === 'all'}>
                                <SelectValue placeholder="Select Course" />
                            </SelectTrigger>
                            <SelectContent>
                                {coursesList.map(b => <SelectItem key={b} value={b}>{b === 'all' ? 'All Courses' : b}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={filters.year} onValueChange={(v) => handleFilterChange('year', v)} disabled={filters.program === 'all' || filters.course === 'all'}>
                            <SelectTrigger className="w-full sm:w-auto flex-grow min-w-[120px]" disabled={filters.program === 'all' || filters.course === 'all'}>
                                <SelectValue placeholder="Select Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(y => <SelectItem key={y} value={y}>{y === 'all' ? 'All Years' : `Year ${y}`}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={filters.section} onValueChange={(v) => handleFilterChange('section', v)} disabled={filters.program === 'all' || filters.course === 'all' || filters.year === 'all'}>
                            <SelectTrigger className="w-full sm:w-auto flex-grow min-w-[120px]" disabled={filters.program === 'all' || filters.course === 'all' || filters.year === 'all'}>
                                <SelectValue placeholder="Select Section" />
                            </SelectTrigger>
                            <SelectContent>
                                {sections.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Sections' : `Section ${s}`}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {displayData.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {displayData.map((item: any, index: number) => {
                                if (!item) return null;
                                let itemKey = '';
                                let itemName = '';
                                if (displayItemType === "Program") { itemKey = item.program; itemName = item.program; }
                                else if (displayItemType === "Course") { itemKey = item.branch; itemName = item.branch; }
                                else if (displayItemType === "Class (Year)") { itemKey = String(item.year); itemName = `Year ${item.year}`; }
                                else { itemKey = item.section; itemName = `Section ${item.section}`; }

                                if (!itemKey || typeof item.percentage === 'undefined') return null;
                                const itemValue = `${item.percentage}% (${item.totalPresent}/${item.totalClasses})`;
                                const uniqueKey = `${displayItemType}-${itemKey}-${index}`;

                                return (
                                    <AccordionItem key={uniqueKey} value={itemKey}>
                                        <AccordionTrigger className="text-lg font-medium px-4 py-3 hover:bg-muted/50 rounded-md">
                                            <div className="flex justify-between w-full pr-4 items-center">
                                                <span>{itemName}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className='text-sm text-muted-foreground mr-2'>{itemValue}</span>
                                                    <Progress value={item.percentage} className="w-24 h-2" />
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-1 pb-1">
                                            {displayItemType === "Program" && item.branches && Object.keys(item.branches).length > 0 && (
                                                <Table>
                                                    <TableHeader><TableRow><TableHead>Course</TableHead><TableHead className='text-right'>Attendance %</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {Object.values(item.branches as any).sort((a: any, b: any) => a.branch.localeCompare(b.branch)).map((branch: any) => (
                                                            <TableRow key={`${uniqueKey}-${branch.branch}`}>
                                                                <TableCell>{branch.branch}</TableCell>
                                                                <TableCell className='text-right'>{branch.percentage}% ({branch.totalPresent}/{branch.totalClasses})</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            )}
                                            {displayItemType === "Course" && item.classes && Object.keys(item.classes).length > 0 && (
                                                <Table>
                                                    <TableHeader><TableRow><TableHead>Class (Year)</TableHead><TableHead className='text-right'>Attendance %</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {Object.values(item.classes as any).sort((a: any, b: any) => a.year - b.year).map((cls: any) => (
                                                            <TableRow key={`${uniqueKey}-Year-${cls.year}`}>
                                                                <TableCell>Year {cls.year}</TableCell>
                                                                <TableCell className='text-right'>{cls.percentage}% ({cls.totalPresent}/{cls.totalClasses})</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            )}
                                            {displayItemType === "Class (Year)" && item.sections && Object.keys(item.sections).length > 0 && (
                                                <Table>
                                                    <TableHeader><TableRow><TableHead>Section</TableHead><TableHead className='text-right'>Attendance %</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {Object.values(item.sections as any).sort((a: any, b: any) => a.section.localeCompare(b.section)).map((sec: any) => (
                                                            <TableRow key={`${uniqueKey}-Section-${sec.section}`}>
                                                                <TableCell>Section {sec.section}</TableCell>
                                                                <TableCell className='text-right'>{sec.percentage}% ({sec.totalPresent}/{sec.totalClasses})</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            )}
                                            {displayItemType === "Section" && item.courses && Object.keys(item.courses).length > 0 && (
                                                <div className="pt-4 px-2 pb-6 w-full h-[400px]">
                                                    <h4 className="text-md font-medium text-center mb-4">Subject Attendance Breakdown</h4>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            data={Object.values(item.courses as any).sort((a: any, b: any) => a.courseName.localeCompare(b.courseName))}
                                                            margin={{ top: 20, right: 30, left: 20, bottom: 65 }}
                                                        >
                                                            <XAxis dataKey="courseName" angle={-45} textAnchor="end" height={80} interval={0} tick={{ fontSize: 12 }} />
                                                            <YAxis domain={[0, 100]} />
                                                            <Tooltip formatter={(value: number, _: string, props: any) => [`${value}% (${props.payload.totalPresent}/${props.payload.totalClasses})`, 'Attendance']} labelStyle={{ color: 'black' }} />
                                                            <Bar dataKey="percentage" name="Attendance %" radius={[4, 4, 0, 0]}>
                                                                {Object.values(item.courses as any).map((entry: any, i: number) => {
                                                                    const p = entry.percentage;
                                                                    let color = '#ef4444';
                                                                    if (p >= 86) color = '#8b5cf6';
                                                                    else if (p >= 72) color = '#4f46e5';
                                                                    else if (p >= 58) color = '#3b82f6';
                                                                    else if (p >= 43) color = '#22c55e';
                                                                    else if (p >= 29) color = '#eab308';
                                                                    else if (p >= 15) color = '#f97316';
                                                                    return <Cell key={`cell-${i}`} fill={color} />;
                                                                })}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            )}
                                            {displayItemType === "Section" && (!item.courses || Object.keys(item.courses).length === 0) && (
                                                <p className="text-sm text-muted-foreground p-4 text-center">No subject breakdowns recorded for {itemName}.</p>
                                            )}
                                            {((displayItemType === "Program" && (!item.branches || Object.keys(item.branches).length === 0)) ||
                                                (displayItemType === "Course" && (!item.classes || Object.keys(item.classes).length === 0)) ||
                                                (displayItemType === "Class (Year)" && (!item.sections || Object.keys(item.sections).length === 0))) && (
                                                    <p className="text-sm text-muted-foreground p-4 text-center">No further breakdown available for {itemName}.</p>
                                                )}
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="rounded-2xl bg-muted p-3"><Activity className="h-6 w-6 text-muted-foreground" /></div>
                            <p className="text-sm text-muted-foreground">No attendance data found for the selected criteria.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
