
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import * as Icons from "lucide-react"; 

import { cn } from "@/lib/utils";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

type IconMap = {
  [key: string]: LucideIcon;
};

const iconMap: IconMap = {
  LayoutDashboard: Icons.LayoutDashboard,
  User: Icons.User,
  BookCheck: Icons.BookCheck,
  BarChart3: Icons.BarChart3,
  Users: Icons.Users,
  ClipboardCheck: Icons.ClipboardCheck,
  Edit: Icons.Edit,
  CreditCard: Icons.CreditCard,
  Home: Icons.Home,
  LogOut: Icons.LogOut,
  UserCog: Icons.UserCog,
  CalendarCheck: Icons.CalendarCheck,
  CalendarClock: Icons.CalendarClock,
  CalendarCog: Icons.CalendarCog,
  Ticket: Icons.Ticket,
  Banknote: Icons.Banknote,
  IndianRupee: Icons.IndianRupee,
  MessageSquare: Icons.MessageSquare,
  MessageSquarePlus: Icons.MessageSquarePlus,
  BookOpen: Icons.BookOpen,
  BookOpenCheck: Icons.BookOpenCheck,
  Calendar: Icons.Calendar,
  TrendingUp: Icons.TrendingUp,
  FileText: Icons.FileText,
  FileSignature: Icons.FileSignature,
  Receipt: Icons.Receipt,
  Clipboard: Icons.Clipboard,
  Briefcase: Icons.Briefcase,
  Settings: Icons.Settings,
  Library: Icons.Library,
  Sparkles: Icons.Sparkles,
  Link2: Icons.Link2,
  Edit2: Icons.Edit2,
  PenSquare: Icons.PenSquare,
  GraduationCap: Icons.GraduationCap,
  UserCheck: Icons.UserCheck,
  Bell: Icons.Bell,
  Utensils: Icons.Utensils,
};


export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof iconMap;
  tooltip?: string;
  color?: string; // RGB values for VIBGYOR nav coloring e.g. "139, 92, 246"
  multiColor?: boolean; // Rainbow multi-color glow (Dashboard)
}

interface SidebarNavProps {
  items: NavItem[];
}

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <SidebarMenu className="space-y-0.5">
      {items.map((item) => {
        const IconComponent = iconMap[item.icon] || Icons.HelpCircle;
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={item.tooltip || item.label}
              className={cn(
                "nav-glass-item",
                isActive && item.color && "nav-glass-active",
                isActive && item.multiColor && "nav-glass-multicolor"
              )}
              style={item.color ? {
                '--nav-rgb': item.color,
              } as React.CSSProperties : undefined}
            >
              <Link href={item.href} aria-current={isActive ? 'page' : undefined}>
                <IconComponent 
                  className={cn(
                    "flex-shrink-0 h-[18px] w-[18px] transition-colors duration-300",
                    item.multiColor && "nav-multicolor-icon"
                  )}
                  style={item.color && !item.multiColor ? { color: `rgb(${item.color})` } : undefined}
                />
                <span 
                  className={cn(
                    "transition-colors duration-300",
                    item.multiColor && "nav-multicolor-text"
                  )}
                  style={item.color && !item.multiColor ? {
                    color: `rgb(${item.color})`,
                    fontWeight: isActive ? 600 : 500,
                  } : undefined}
                >
                  {item.label}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
