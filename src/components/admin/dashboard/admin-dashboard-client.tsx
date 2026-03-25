
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Users, LogIn, Loader2, Activity, Banknote, BarChartHorizontal } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer
} from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { AdminDashboardData, LoginEvent } from '@/actions/dashboard-actions';

const attendanceChartConfig = {
  attendance: { label: "Attendance %", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const studentChartConfig = {
  count: { label: "Students", color: "hsl(var(--chart-2))" },
  branch: { label: "Branch" },
} satisfies ChartConfig;

interface AdminDashboardClientProps {
  initialData: AdminDashboardData;
}

export function AdminDashboardClient({ initialData }: AdminDashboardClientProps) {

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Hero Header ── */}
      <div className="dashboard-hero">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-white/70 mt-2 text-sm leading-relaxed max-w-lg">Overview of your institution's key metrics and performance indicators.</p>
        </div>
      </div>

      {/* ── Gradient Stat Cards ── */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card stat-card-blue group">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Total Students</p>
              <p className="text-4xl font-bold mt-2 tracking-tight">{initialData.totalStudents?.toLocaleString() ?? 'N/A'}</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Users className="h-7 w-7 text-white" />
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-green group">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Total Teachers</p>
              <p className="text-4xl font-bold mt-2 tracking-tight">{initialData.totalTeachers?.toLocaleString() ?? 'N/A'}</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Users className="h-7 w-7 text-white" />
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-purple group">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Total Programs</p>
              <p className="text-4xl font-bold mt-2 tracking-tight">{initialData.totalPrograms?.toLocaleString() ?? 'N/A'}</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <BarChartHorizontal className="h-7 w-7 text-white" />
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-amber group">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Overall Attendance</p>
              <p className="text-4xl font-bold mt-2 tracking-tight">{initialData.attendanceTrend[initialData.attendanceTrend.length - 1]?.attendance ?? 0}%</p>
              <p className="text-xs text-white/60 mt-1">Latest month average</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Activity className="h-7 w-7 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2 card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Attendance Trend (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={attendanceChartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={initialData.attendanceTrend || []} margin={{ left: 12, right: 12, top: 5, bottom: 5 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value.slice(0, 3)} interval={0} />
                  <YAxis hide />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <defs>
                    <linearGradient id="fillAttendance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-attendance)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-attendance)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <Area dataKey="attendance" type="natural" fill="url(#fillAttendance)" stroke="var(--color-attendance)" stackId="a" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-base">
              <div className="icon-container-md bg-blue-500/10">
                <LogIn className="h-5 w-5 text-blue-600" />
              </div>
              Recent Login Activity
            </CardTitle>
            <CardDescription>Latest user login events.</CardDescription>
          </CardHeader>
          <CardContent>
            {initialData.recentLogins.length > 0 ? (
              <ul className="space-y-1 max-h-[300px] overflow-y-auto pr-2" role="list" aria-label="Recent logins">
                {initialData.recentLogins.map((login) => (
                  <li key={login.id} className="flex items-center justify-between text-xs p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className='flex-1 overflow-hidden mr-2'>
                      <p className="font-medium truncate">{login.userName}</p>
                      <p className="text-muted-foreground capitalize">{login.userRole}</p>
                    </div>
                    <p className="text-muted-foreground text-right flex-shrink-0 font-mono text-[11px]">{new Date(login.timestamp).toLocaleTimeString()}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <LogIn className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No recent login activity found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Student Distribution by Branch</CardTitle>
          </CardHeader>
          <CardContent>
            {initialData.studentDistribution.length > 0 ? (
              <ChartContainer config={studentChartConfig} className="w-full h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    accessibilityLayer
                    data={initialData.studentDistribution}
                    margin={{ top: 5, right: 20, left: -10, bottom: 40 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="branch"
                      tickLine={false}
                      axisLine={false}
                      stroke="#888888"
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis stroke="#888888" fontSize={12} />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent />}
                    />
                    <Bar
                      dataKey="count"
                      fill="var(--color-count)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChartHorizontal className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No student distribution data available.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button variant="outline" asChild className="h-auto py-4 justify-start rounded-xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all dark:hover:bg-blue-950/30 dark:hover:border-blue-800"><Link href="/admin/students"><Users className="mr-2 h-4 w-4" />Manage Students</Link></Button>
            <Button variant="outline" asChild className="h-auto py-4 justify-start rounded-xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all dark:hover:bg-emerald-950/30 dark:hover:border-emerald-800"><Link href="/admin/staff"><Users className="mr-2 h-4 w-4" />Manage Staff</Link></Button>
            <Button variant="outline" asChild className="h-auto py-4 justify-start rounded-xl hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all dark:hover:bg-purple-950/30 dark:hover:border-purple-800"><Link href="/admin/exams"><Activity className="mr-2 h-4 w-4" />Exam Schedules</Link></Button>
            <Button variant="outline" asChild className="h-auto py-4 justify-start rounded-xl hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-all dark:hover:bg-amber-950/30 dark:hover:border-amber-800"><Link href="/admin/courses"><BarChartHorizontal className="mr-2 h-4 w-4" />Manage Courses</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
