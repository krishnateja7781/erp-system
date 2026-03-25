

'use client';

import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduleEntry, CourseOption } from '@/lib/types';

export type { ScheduleEntry, CourseOption };

interface TimetableGridProps {
  schedule: ScheduleEntry[];
  interactive?: boolean; // Make cells clickable/editable if true
  availableCourses?: CourseOption[];
  onAssignCourse?: (day: ScheduleEntry['day'], period: ScheduleEntry['period'], courseId: string | null) => void;
  onCellClick?: (day: ScheduleEntry['day'], period: ScheduleEntry['period'], entry: (ScheduleEntry & { classId?: string }) | null) => void;
  className?: string;
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
}

const daysOfWeek: ScheduleEntry['day'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const periods: ScheduleEntry['period'][] = [1, 2, 3, 4, 5, 6]; // 6 periods

const periodTimes: Record<number, string> = {
  1: "9:00 - 10:00",
  2: "10:00 - 11:00",
  3: "11:00 - 12:00",
  4: "12:00 - 1:00",
  5: "1:00 - 2:00",
  6: "2:00 - 3:00",
};

export function TimetableGrid({ schedule, interactive = false, availableCourses = [], onAssignCourse, onCellClick, className, title, description, headerAction }: TimetableGridProps) {

  // Create a lookup map for quick access: key = "Day-Period"
  const scheduleMap = React.useMemo(() => {
    const map = new Map<string, ScheduleEntry>();
    if (Array.isArray(schedule)) {
      schedule.forEach(entry => {
        if (entry && entry.day && entry.period) {
          map.set(`${entry.day}-${entry.period}`, entry);
        }
      });
    }
    return map;
  }, [schedule]);

  const handleAssign = (day: ScheduleEntry['day'], period: ScheduleEntry['period'], courseId: string | null) => {
    if (interactive && onAssignCourse) {
      onAssignCourse(day, period, courseId);
    }
  };

  const handleCellClick = (day: ScheduleEntry['day'], period: ScheduleEntry['period']) => {
    if (interactive && onCellClick) {
      const entry = scheduleMap.get(`${day}-${period}`) || null;
      if (entry) { // Only call handler if there's a class scheduled
        onCellClick(day, period, entry);
      }
    }
  };

  return (
    <Card className={cn("shadow-sm border-border/50", className)}>
      <CardHeader className="flex flex-row items-center justify-between p-4">
        <div>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {headerAction}
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table className="min-w-[800px] border-collapse">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px] text-center font-bold border">Day</TableHead>
              {periods.map(period => (
                <TableHead key={period} className="text-center font-bold border p-2">
                  <div className="flex flex-col items-center">
                    <span>Period {period}</span>
                    <span className="text-[10px] font-normal text-muted-foreground">{periodTimes[period]}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {daysOfWeek.map(day => (
              <TableRow key={day} className="h-24">
                <TableCell className="font-bold text-center align-middle bg-muted/30 border w-[120px]">{day}</TableCell>
                {periods.map(period => {
                  const entry = scheduleMap.get(`${day}-${period}`);

                  const cellContent = entry ? (
                    <div className="flex flex-col items-center justify-center h-full p-2 space-y-1">
                      <span className="font-bold text-primary text-sm block leading-tight">{entry.courseCode}</span>
                      <span className="text-foreground font-medium text-[11px] block leading-tight text-center line-clamp-2">{entry.courseName}</span>
                      {entry.teacherName && <span className="text-muted-foreground text-[10px] italic">({entry.teacherName})</span>}
                      <Badge variant="secondary" className="mt-1 text-[9px] px-1.5 py-0 font-normal">{entry.class}</Badge>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full opacity-30">
                      {interactive ? <Plus className="h-5 w-5 text-muted-foreground" /> : <span className="text-muted-foreground">-</span>}
                    </div>
                  );

                  const isClickable = interactive && (onAssignCourse || (onCellClick && !!entry));

                  return (
                    <TableCell
                      key={`${day}-${period}`}
                      className={cn(
                        "text-center align-middle p-0 border relative",
                        isClickable ? "hover:bg-accent/50 transition-colors cursor-pointer" : "bg-background"
                      )}
                      onClick={(!onAssignCourse && onCellClick) ? () => handleCellClick(day, period) : undefined}
                    >
                      {(interactive && onAssignCourse) ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <div className="w-full h-full cursor-pointer transition-colors flex flex-col justify-center min-h-[96px]">
                              {cellContent}
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-56">
                            <DropdownMenuItem onClick={() => handleAssign(day, period, null)} className="text-destructive focus:text-destructive">
                              <span className="font-medium">Clear Period</span>
                            </DropdownMenuItem>
                            <div className="h-px bg-muted my-1" />
                            {availableCourses.length > 0 ? (
                              availableCourses.map(c => (
                                <DropdownMenuItem key={c.courseId} onClick={() => handleAssign(day, period, c.courseId || null)}>
                                  <div className="flex flex-col items-start gap-0.5">
                                    <span className="font-medium">{c.courseName}</span>
                                    <span className="text-[10px] text-muted-foreground">{c.teacherName}</span>
                                  </div>
                                </DropdownMenuItem>
                              ))
                            ) : (
                              <div className="p-2 text-xs text-muted-foreground text-center italic">No courses available</div>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <div className="w-full h-full flex flex-col justify-center min-h-[96px]">
                          {cellContent}
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
