'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowUpCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getEligibleStudentsForPromotion, promoteStudentsBatch } from '@/actions/promotion-actions';

// Add a mock Checkbox if true components/ui/checkbox is missing
const Checkbox = React.forwardRef<HTMLButtonElement, any>(({ checked, onCheckedChange, disabled, ...props }, ref) => (
  <button 
    type="button" 
    role="checkbox" 
    aria-checked={checked} 
    onClick={() => !disabled && onCheckedChange?.(!checked)}
    disabled={disabled}
    className="h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex items-center justify-center"
    {...props}
  >
    {checked && <CheckCircle className="h-3 w-3" />}
  </button>
));
Checkbox.displayName = "Checkbox";

const PROGRAMS = ["B.Tech", "MBA", "Law", "MBBS", "B.Sc", "B.Com"];
const BRANCHES: Record<string, string[]> = {
    "B.Tech": ["CSE", "ECE", "MECH", "IT", "AI&ML", "DS", "CIVIL", "Other"],
    "MBA": ["Marketing", "Finance", "HR", "Operations", "General", "Other"]
};
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function AdminPromotionPage() {
    const { toast } = useToast();
    const [filters, setFilters] = React.useState({ program: '', branch: '', semester: '' });
    const [students, setStudents] = React.useState<any[]>([]);
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = React.useState(false);
    const [isPromoting, setIsPromoting] = React.useState(false);
    const [results, setResults] = React.useState<any[]>([]);
    
    const fetchStudents = async () => {
        if (!filters.program || !filters.semester) return;
        setIsLoading(true);
        setResults([]);
        try {
            const data = await getEligibleStudentsForPromotion(filters.program, filters.branch, parseInt(filters.semester));
            setStudents(data);
            setSelectedIds(new Set(data.map((s: any) => s.id)));
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch students.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(students.map(s => s.id)));
        else setSelectedIds(new Set());
    };
    
    const handleSelect = (id: string, checked: boolean) => {
        const newSet = new Set(selectedIds);
        if (checked) newSet.add(id);
        else newSet.delete(id);
        setSelectedIds(newSet);
    };
    
    const handlePromote = async () => {
        if (selectedIds.size === 0) return;
        setIsPromoting(true);
        setResults([]);
        try {
            const currentYear = new Date().getFullYear();
            const academicYear = `${currentYear}-${currentYear + 1}`;
            const res = await promoteStudentsBatch(Array.from(selectedIds), academicYear);
            
            if (res.success) {
                toast({ title: 'Success', description: res.message });
            } else {
                toast({ variant: 'destructive', title: 'Promotion Failed', description: res.error });
            }
            if (res.details) setResults(res.details);
            
            fetchStudents(); // Refresh eligible
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Unexpected error during promotion.' });
        } finally {
            setIsPromoting(false);
        }
    };
    
    const getResultForStudent = (id: string) => results.find(r => r.studentId === id);

    return (
        <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-500 p-6 text-white shadow-lg">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Student Promotion</h1>
                        <p className="text-white/70 text-sm mt-1">Atomically evaluate and promote students to the next semester securely.</p>
                    </div>
                    <Button 
                        size="lg" 
                        onClick={handlePromote} 
                        disabled={selectedIds.size === 0 || isPromoting}
                        className="bg-white text-indigo-600 hover:bg-white/90 shadow-md font-bold whitespace-nowrap"
                    >
                        {isPromoting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowUpCircle className="h-5 w-5 mr-2" />}
                        Promote {selectedIds.size} Students
                    </Button>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            <Card className="card-elevated">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Filter Criteria</CardTitle>
                    <CardDescription>Select the exact batch of students to evaluate for promotion.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Program</Label>
                            <Select value={filters.program} onValueChange={(v) => setFilters(prev => ({ ...prev, program: v, branch: '' }))}>
                                <SelectTrigger><SelectValue placeholder="Program" /></SelectTrigger>
                                <SelectContent>{PROGRAMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Branch</Label>
                            <Select value={filters.branch} onValueChange={(v) => setFilters(prev => ({ ...prev, branch: v }))} disabled={!filters.program}>
                                <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
                                <SelectContent>{(BRANCHES[filters.program] || []).map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Current Semester</Label>
                            <Select value={filters.semester} onValueChange={(v) => setFilters(prev => ({ ...prev, semester: v }))}>
                                <SelectTrigger><SelectValue placeholder="Sem" /></SelectTrigger>
                                <SelectContent>{SEMESTERS.map(s => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <Button 
                            className="bg-primary text-primary-foreground w-full" 
                            onClick={fetchStudents} 
                            disabled={!filters.program || !filters.semester || isLoading}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load Eligible Roster"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {(students.length > 0 || results.length > 0) && (
                <Card className="card-elevated overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox 
                                            checked={selectedIds.size === students.length && students.length > 0}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>College ID</TableHead>
                                    <TableHead>Student Name</TableHead>
                                    <TableHead>Program</TableHead>
                                    <TableHead>Target Semester</TableHead>
                                    <TableHead>Status / Logs</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.map(s => {
                                    const res = getResultForStudent(s.id);
                                    return (
                                        <TableRow key={s.id} className="hover:bg-accent/50">
                                            <TableCell>
                                                <Checkbox 
                                                    checked={selectedIds.has(s.id)}
                                                    onCheckedChange={(checked: boolean) => handleSelect(s.id, !!checked)}
                                                    disabled={isPromoting || (res && res.success)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium font-mono text-sm">{s.collegeId}</TableCell>
                                            <TableCell className="font-bold">{s.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{s.program} - {s.branch}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                                    Sem {s.currentSemester} ➔ {s.currentSemester === 8 ? 'Graduate' : `Sem ${s.currentSemester + 1}`}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {res ? (
                                                    res.success ? (
                                                        <span className="flex items-center text-sm text-green-600 font-medium">
                                                            <CheckCircle className="h-4 w-4 mr-1" /> Promoted
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center text-sm text-red-600 font-medium max-w-xs truncate" title={res.error}>
                                                            <AlertTriangle className="h-4 w-4 mr-1 flex-shrink-0" /> {res.error}
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">Ready for evaluation</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {students.length === 0 && results.map(res => (
                                     <TableRow key={res.studentId} className="bg-red-50">
                                         <TableCell colSpan={6} className="text-red-700 py-4 text-center text-sm font-medium">
                                             <AlertTriangle className="h-4 w-4 inline mr-2" /> Error processing ID {res.studentId}: {res.error}
                                         </TableCell>
                                     </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}
        </div>
    );
}
