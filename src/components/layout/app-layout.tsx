
"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { Briefcase, Clipboard, GraduationCap, LogOut, Settings, ClipboardCheck, Library, Users, BookOpenCheck, CalendarClock, CalendarCheck, CalendarCog, Sparkles, Banknote, MessageSquare, MessageSquarePlus, FileSignature, Link2, Edit2, PenSquare, Home, ArrowLeft, BookOpen } from "lucide-react";

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarNav, type NavItem } from "./sidebar-nav";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { usePathname, useRouter } from "next/navigation";
import type { AppUser } from "@/hooks/useAuthProtection";
import { LayoutProvider, useLayout } from "./layout-context";
import ChatBot from "@/components/shared/chat-bot";

interface AppLayoutProps {
  children: ReactNode;
  role: 'student' | 'super_admin' | 'teacher' | 'employee';
  user: AppUser;
  onLogout: () => void;
  pageHeaderActions?: React.ReactNode;
}

const studentNavItems: NavItem[] = [
  { href: "/student/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/student/profile", label: "Profile", icon: "User" },
  { href: "/classrooms", label: "Classrooms", icon: "BookOpen" },
  { href: "/student/attendance", label: "Attendance", icon: "CalendarCheck" },
  { href: "/student/marks", label: "Marks", icon: "BarChart3" },
  { href: "/student/exams", label: "Exams", icon: "ClipboardCheck" },
  { href: "/student/fees", label: "Fees", icon: "IndianRupee" },
  { href: "/student/hostel", label: "Hostel", icon: "Home" },
  { href: "/student/opportunities", label: "Opportunities", icon: "Briefcase" },
  { href: "/library", label: "Library Catalog", icon: "Library" },
  { href: "/settings", label: "Settings", icon: "Settings" },
];

const adminNavItems: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "LayoutDashboard", multiColor: true },
  { href: "/admin/students", label: "Students", icon: "Users", color: "167, 139, 250" },
  { href: "/admin/staff", label: "Manage Staff", icon: "UserCog", color: "129, 140, 248" },
  { href: "/admin/courses", label: "Courses", icon: "BookOpenCheck", color: "96, 165, 250" },
  { href: "/admin/classes", label: "Classes", icon: "Library", color: "34, 211, 238" },
  { href: "/admin/timetables", label: "Timetables", icon: "CalendarClock", color: "45, 212, 191" },
  { href: "/admin/fees", label: "Fees", icon: "IndianRupee", color: "74, 222, 128" },
  { href: "/admin/hostels", label: "Hostels", icon: "Home", color: "163, 230, 53" },
  { href: "/admin/attendance", label: "Overall Attendance", icon: "ClipboardCheck", color: "250, 204, 21" },
  { href: "/admin/marks", label: "Overall Marks", icon: "Edit", color: "251, 191, 36" },
  { href: "/admin/exams", label: "Exam Schedules", icon: "CalendarCog", color: "251, 146, 60" },
  { href: "/admin/opportunities", label: "Opportunities", icon: "Briefcase", color: "251, 113, 133" },
  { href: "/library", label: "Library Catalog", icon: "Library", color: "244, 114, 182" },
  { href: "/settings", label: "Settings", icon: "Settings", color: "248, 113, 113" },
];

const teacherNavItems: NavItem[] = [
  { href: "/teacher/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/teacher/profile", label: "My Profile", icon: "User" },
  { href: "/classrooms", label: "Classrooms", icon: "BookOpen" },
  { href: "/teacher/students", label: "My Students", icon: "Users" },
  { href: "/teacher/marks", label: "Manage Marks", icon: "Edit" },
  { href: "/teacher/attendance", label: "Class Attendance", icon: "CalendarCheck" },
  { href: "/teacher/exams", label: "Exams", icon: "ClipboardCheck" },
  { href: "/library", label: "Library Catalog", icon: "Library" },
  { href: "/teacher/other-tools", label: "Other Tools", icon: "Sparkles", color: "167, 139, 250" },
  { href: "/settings", label: "Settings", icon: "Settings" },
];

const employeeNavItems: NavItem[] = [
  { href: "/employee/dashboard", label: "Dashboard", icon: "LayoutDashboard", multiColor: true },
  { href: "/employee/fees", label: "Fees", icon: "IndianRupee", color: "74, 222, 128" },
  { href: "/employee/hostel", label: "Hostels", icon: "Home", color: "163, 230, 53" },
  { href: "/employee/users", label: "Users Mgt", icon: "Users", color: "167, 139, 250" },
  { href: "/employee/exams", label: "Exams & Marks", icon: "ClipboardCheck", color: "251, 146, 60" },
  { href: "/employee/library", label: "Library", icon: "Library", color: "34, 211, 238" },
  { href: "/settings", label: "Settings", icon: "Settings", color: "248, 113, 113" },
];


export function AppLayout(props: AppLayoutProps) {
  return (
    <LayoutProvider>
      <AppLayoutInternal {...props} />
    </LayoutProvider>
  );
}

function AppLayoutInternal({ children, role, user, onLogout, pageHeaderActions: pageHeaderActionsProp }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { headerActions: headerActionsFromContext } = useLayout();

  const combinedHeaderActions = pageHeaderActionsProp || headerActionsFromContext;

  let navItems: NavItem[];
  switch (role) {
    case 'super_admin':
      navItems = adminNavItems;
      break;
    case 'teacher':
      navItems = teacherNavItems;
      break;
    case 'employee':
      navItems = employeeNavItems.filter(item => {
        if (item.href === '/settings' || item.href === '/employee/dashboard') return true;
        if (user.type === 'fee_management' && item.href === '/employee/fees') return true;
        if (user.type === 'hostel_management' && item.href === '/employee/hostel') return true;
        if (user.type === 'student_staff_management' && item.href === '/employee/users') return true;
        if (user.type === 'exam_marks_management' && item.href === '/employee/exams') return true;
        if (user.type === 'library_management' && item.href === '/employee/library') return true;
        return false;
      });
      break;
    case 'student':
    default:
      // Filter out 'Hostel' for Day Scholars
      navItems = studentNavItems.filter(item => {
        if (item.href === '/student/hostel' && user.role === 'student') {
          return user.type === 'Hosteler';
        }
        return true;
      });
      break;
  }

  const pageTitle = navItems.find(item => pathname.startsWith(item.href) && item.href !== '/classrooms')?.label;
  const isClassroomRoute = pathname.startsWith('/classrooms');

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon" className="border-r-0">
        <SidebarHeader className="items-center justify-between group-data-[collapsible=icon]:justify-center p-5">
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg shadow-blue-500/30">
              <GraduationCap size={24} />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-sidebar-foreground">SSN Student Hub</span>
              <p className="text-[10px] text-sidebar-muted font-medium tracking-widest uppercase">ERP Portal</p>
            </div>
          </div>
          <SidebarTrigger className="md:hidden text-sidebar-foreground" />
        </SidebarHeader>
        <SidebarContent className="px-3 py-3">
          <nav role="navigation" aria-label="Main navigation">
            <SidebarNav items={navItems} />
          </nav>
        </SidebarContent>
        <div className="mx-4 group-data-[collapsible=icon]:hidden h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
        <SidebarFooter className="p-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0">
          <div className="flex items-center justify-between gap-2.5 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar
                className={cn("h-9 w-9 sidebar-avatar flex-shrink-0 transition-shadow duration-200 ring-2 ring-sidebar-accent")}
                data-role={role}
              >
                <AvatarImage src={user?.avatarUrl} alt={user?.name || ''} />
                <AvatarFallback className="text-xs font-medium bg-sidebar-accent text-sidebar-foreground">{user?.initials || '?'}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate text-sidebar-foreground">{user?.name || 'User'}</p>
                <p className="text-xs text-sidebar-muted capitalize">{role}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Sign out of your account" className="flex-shrink-0 text-sidebar-muted hover:bg-red-500/15 hover:text-red-400 transition-colors">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Sign out of your account" className="hidden group-data-[collapsible=icon]:flex text-sidebar-muted hover:bg-red-500/15 hover:text-red-400 transition-colors">
            <LogOut className="h-5 w-5" />
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-background/70 backdrop-blur-xl px-4 py-2.5 print:hidden" role="banner">
          {/* Mobile Header */}
          <div className="flex items-center gap-2 md:hidden">
            {isClassroomRoute ? (
              <button
                onClick={() => router.push('/classrooms')}
                className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                My Classrooms
              </button>
            ) : (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-600 text-primary-foreground shadow-sm">
                  <GraduationCap size={16} />
                </div>
                <span className="font-semibold text-sm text-foreground truncate max-w-[140px] sm:max-w-none">
                  {pageTitle || "SSN Student Hub"}
                </span>
              </>
            )}
          </div>
          {combinedHeaderActions && <div className="flex items-center gap-2 md:hidden ml-auto mr-1">{combinedHeaderActions}</div>}
          <div className="flex items-center gap-1 sm:gap-1.5 md:hidden">
            <NotificationBell />
            <ThemeToggle />
            <SidebarTrigger />
          </div>

          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              {isClassroomRoute ? (
                <button
                  onClick={() => router.push('/classrooms')}
                  className="flex items-center gap-2 text-base font-bold text-foreground hover:text-primary transition-colors tracking-tight"
                >
                  <ArrowLeft className="h-4 w-4" />
                  My Classrooms
                </button>
              ) : pageTitle ? (
                <h1 className="text-lg font-bold text-foreground tracking-tight">{pageTitle}</h1>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-600 text-primary-foreground shadow-sm">
                    <GraduationCap size={16} />
                  </div>
                  <span className="font-bold text-base tracking-tight">SSN Student Hub</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {combinedHeaderActions && <div className="mr-1.5">{combinedHeaderActions}</div>}
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main id="main-content" className="flex-1 overflow-auto p-4 sm:p-5 md:p-8" role="main">
          {children}
        </main>
        <ChatBot role={role} userName={user?.name || 'User'} />
      </SidebarInset>
    </SidebarProvider>
  );
}
