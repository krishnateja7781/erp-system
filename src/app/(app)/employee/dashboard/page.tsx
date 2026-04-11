'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthProtection } from '@/hooks/useAuthProtection';
import { LayoutDashboard, Users, GraduationCap, Building2, UserPlus, RefreshCw, AlertTriangle, Activity, IndianRupee, Wallet, CreditCard, Home, BedDouble, CalendarCog, FileCheck, Library, BookOpenCheck, Bookmark } from 'lucide-react';
import { getEmployeeDashboardStats, type EmployeeDashboardData } from '@/actions/dashboard-actions';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';

let dashboardCachePromise: Promise<any> | null = null;
let lastDashboardFetch = 0;

export default function EmployeeDashboard() {
  const { currentUser } = useAuthProtection('employee');
  const [stats, setStats] = React.useState<EmployeeDashboardData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const uidRef = React.useRef(currentUser?.uid);
  React.useEffect(() => { uidRef.current = currentUser?.uid; });

  const loadData = React.useCallback(async () => {
    if (!uidRef.current) return;
    setIsLoading(true);
    setError(null);
    try {
      const now = Date.now();
      if (!dashboardCachePromise || now - lastDashboardFetch > 2000) {
          dashboardCachePromise = getEmployeeDashboardStats(uidRef.current);
          lastDashboardFetch = now;
      }
      const data = await dashboardCachePromise;
      setStats(data);
    } catch (err: any) {
      console.error("Failed to load dashboard data:", err);
      setError("Could not load your dashboard data. You might not have an employee record.");
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — uid doesn't change after login

  React.useEffect(() => {
    if (currentUser?.uid) loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-4 animate-fade-in" role="status">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-muted" />
          <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <span className="text-sm text-muted-foreground font-medium">Loading tailored metrics...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mb-4">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold">Failed to Load Data</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{error || "Data could not be loaded."}</p>
        <Button onClick={loadData} className="mt-4" variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" /> Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-500 p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Staff Services Dashboard</h1>
            <p className="text-white/80 text-sm mt-2">
              Welcome {currentUser?.name}. Select your designated module from the sidebar to manage institutional records.
            </p>
          </div>
          <LayoutDashboard className="h-16 w-16 opacity-20" />
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      </div>

      {stats.employeeType === 'student_staff_management' && stats.adminStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="card-elevated border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                <GraduationCap className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.adminStats.totalStudents}</div>
                <p className="text-xs text-muted-foreground mt-1 text-blue-600 dark:text-blue-400">Active enrollments</p>
              </CardContent>
            </Card>
            <Card className="card-elevated border-l-4 border-l-indigo-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Faculty Members</CardTitle>
                <Users className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.adminStats.totalTeachers}</div>
                <p className="text-xs text-muted-foreground mt-1 text-indigo-600 dark:text-indigo-400">Registered teachers</p>
              </CardContent>
            </Card>
            <Card className="card-elevated border-l-4 border-l-violet-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Programs Offered</CardTitle>
                <Building2 className="h-4 w-4 text-violet-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.adminStats.totalPrograms}</div>
                <p className="text-xs text-muted-foreground mt-1 text-violet-600 dark:text-violet-400">Active curriculums</p>
              </CardContent>
            </Card>
            <Card className="card-elevated border-l-4 border-l-teal-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                <Activity className="h-4 w-4 text-teal-500" />
              </CardHeader>
              <CardContent>
                 <div className="text-2xl font-bold">{stats.adminStats.recentLogins.length}</div>
                 <p className="text-xs text-muted-foreground mt-1 text-teal-600 dark:text-teal-400">System logins this week</p>
              </CardContent>
            </Card>
          </div>
      )}

      {stats.employeeType === 'fee_management' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="card-elevated border-l-4 border-l-emerald-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Collected Fees</CardTitle>
                <Wallet className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{stats.collectedFees?.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1 text-emerald-600 dark:text-emerald-400">Total cleared payments</p>
              </CardContent>
            </Card>
            <Card className="card-elevated border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending Dues</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{stats.pendingFees?.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1 text-amber-600 dark:text-amber-400">Outstanding balances</p>
              </CardContent>
            </Card>
            <Card className="card-elevated border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                <Activity className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.collectionRate}%</div>
                <p className="text-xs text-muted-foreground mt-1 text-blue-600 dark:text-blue-400">Overall collection health</p>
              </CardContent>
            </Card>
          </div>
      )}

      {stats.employeeType === 'hostel_management' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="card-elevated border-l-4 border-l-lime-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
                <Home className="h-4 w-4 text-lime-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalRooms?.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1 text-lime-600 dark:text-lime-400">Registered rooms</p>
              </CardContent>
            </Card>
            <Card className="card-elevated border-l-4 border-l-rose-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Occupied Beds</CardTitle>
                <BedDouble className="h-4 w-4 text-rose-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.occupiedRooms?.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1 text-rose-600 dark:text-rose-400">Active boarders</p>
              </CardContent>
            </Card>
            <Card className="card-elevated border-l-4 border-l-cyan-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Available Beds</CardTitle>
                <Activity className="h-4 w-4 text-cyan-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.availableRooms?.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1 text-cyan-600 dark:text-cyan-400">Capacity remaining</p>
              </CardContent>
            </Card>
          </div>
      )}

      {stats.employeeType === 'exam_marks_management' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card className="card-elevated border-l-4 border-l-orange-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
                  <CalendarCog className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalExams?.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1 text-orange-600 dark:text-orange-400">All exam records</p>
                </CardContent>
              </Card>
              <Card className="card-elevated border-l-4 border-l-emerald-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
                  <FileCheck className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.scheduledExams?.toLocaleString() ?? '—'}</div>
                  <p className="text-xs text-muted-foreground mt-1 text-emerald-600 dark:text-emerald-400">Active exam sessions</p>
                </CardContent>
              </Card>
              <Card className="card-elevated border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Classes</CardTitle>
                  <BookOpenCheck className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalClasses?.toLocaleString() ?? '—'}</div>
                  <p className="text-xs text-muted-foreground mt-1 text-blue-600 dark:text-blue-400">Created sections</p>
                </CardContent>
              </Card>
              <Card className="card-elevated border-l-4 border-l-violet-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Courses</CardTitle>
                  <GraduationCap className="h-4 w-4 text-violet-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalCourses?.toLocaleString() ?? '—'}</div>
                  <p className="text-xs text-muted-foreground mt-1 text-violet-600 dark:text-violet-400">Registered courses</p>
                </CardContent>
              </Card>
              <Card className="card-elevated border-l-4 border-l-amber-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Marks Entered</CardTitle>
                  <Bookmark className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.marksEntered?.toLocaleString() ?? '—'}</div>
                  <p className="text-xs text-muted-foreground mt-1 text-amber-600 dark:text-amber-400">Student mark records</p>
                </CardContent>
              </Card>
            </div>
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>Exam &amp; Marks Management Portal</CardTitle>
                <CardDescription>Navigate to the modules below to manage your academic examination workflow.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                  {[
                    { label: 'Dashboard', href: '/employee/exams/dashboard', color: 'from-orange-500 to-red-600', icon: CalendarCog },
                    { label: 'Courses', href: '/employee/exams/courses', color: 'from-blue-500 to-sky-600', icon: BookOpenCheck },
                    { label: 'Classes', href: '/employee/exams/classes', color: 'from-cyan-500 to-teal-600', icon: GraduationCap },
                    { label: 'Exams', href: '/employee/exams/schedule', color: 'from-orange-500 to-amber-600', icon: CalendarCog },
                    { label: 'Marks', href: '/employee/exams/marks', color: 'from-amber-500 to-orange-600', icon: FileCheck },
                    { label: 'Timetables', href: '/employee/exams/timetables', color: 'from-teal-500 to-emerald-600', icon: CalendarCog },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <a key={item.label} href={item.href} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all duration-200 group text-center">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-white shadow-md group-hover:scale-110 transition-transform duration-200`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
                      </a>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
      )}

      {stats.employeeType === 'library_management' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="card-elevated border-l-4 border-l-cyan-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Inventory</CardTitle>
                <Library className="h-4 w-4 text-cyan-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalBooks?.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1 text-cyan-600 dark:text-cyan-400">Books registered</p>
              </CardContent>
            </Card>
            <Card className="card-elevated border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Available Copies</CardTitle>
                <BookOpenCheck className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.availableBooks?.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1 text-purple-600 dark:text-purple-400">Ready to issue</p>
              </CardContent>
            </Card>
            <Card className="card-elevated border-l-4 border-l-pink-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Issued Books</CardTitle>
                <Bookmark className="h-4 w-4 text-pink-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.issuedBooks?.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1 text-pink-600 dark:text-pink-400">Currently circulated</p>
              </CardContent>
            </Card>
          </div>
      )}

      {stats.employeeType === 'student_staff_management' && stats.adminStats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>Student Distribution</CardTitle>
                <CardDescription>Number of students enrolled by branch</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                 {stats.adminStats.studentDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.adminStats.studentDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="branch" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                        <RechartsTooltip cursor={{fill: 'rgba(56, 189, 248, 0.1)'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                        <Bar dataKey="count" fill="url(#colorCount)" radius={[4, 4, 0, 0]} />
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                 ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>
                 )}
              </CardContent>
            </Card>

            <Card className="card-elevated">
                <CardHeader>
                    <CardTitle>Welcome to the Users Management Portal</CardTitle>
                    <CardDescription>Your actions are securely logged against your staff profile.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">
                      <h4 className="font-semibold flex items-center gap-2 mb-2"><UserPlus className="h-4 w-4"/> Management Access</h4>
                      <p className="text-sm">
                          As a Student/Staff Manager, you are authorized to onboard new students, teachers, and curate classroom assignments. Ensure your data entries are accurate, as changes are strictly audited in the background.
                      </p>
                    </div>
                </CardContent>
            </Card>
          </div>
      )}
    </div>
  );
}
