"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  BookOpen,
  CalendarCheck,
  Award,
  IndianRupee,
  UserCog,
  Library,
  Bus,
  Bell,
  Package,
  Building2,
  BarChart3,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Navigation Config ────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    group: "Core",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/admissions", label: "Admissions", icon: UserPlus },
      { href: "/admin/students", label: "Students", icon: Users },
    ],
  },
  {
    group: "Academic",
    items: [
      { href: "/admin/academics", label: "Academics", icon: BookOpen },
      { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
      { href: "/admin/examinations", label: "Examinations", icon: Award },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/admin/fees", label: "Fees", icon: IndianRupee },
      { href: "/admin/hr", label: "HR & Payroll", icon: UserCog },
      { href: "/admin/library", label: "Library", icon: Library },
      { href: "/admin/transport", label: "Transport", icon: Bus },
      { href: "/admin/communication", label: "Communication", icon: Bell },
      { href: "/admin/inventory", label: "Inventory", icon: Package },
      { href: "/admin/hostel", label: "Hostel", icon: Building2 },
    ],
  },
  {
    group: "Insights",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/dpdp", label: "Privacy & Consent", icon: Shield },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

// ─── Sidebar Component ────────────────────────────────────────────────────────

interface SidebarProps {
  schoolName?: string;
}

export function Sidebar({ schoolName = "SchoolMitra ERP" }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-white/10 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
      aria-label="Main navigation"
    >
      {/* Logo / Brand */}
      <div className="flex items-center h-16 px-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate leading-tight">
                {schoolName}
              </p>
              <p className="text-sidebar-text text-xs">Admin Portal</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6" role="navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.group}>
            {!collapsed && (
              <p className="text-xs font-semibold text-sidebar-text/50 uppercase tracking-wider px-2 mb-1">
                {group.group}
              </p>
            )}
            <ul className="space-y-0.5" role="list">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin/dashboard" &&
                    pathname.startsWith(item.href));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "sidebar-nav-item",
                        isActive && "active",
                        collapsed && "justify-center px-2"
                      )}
                      aria-current={isActive ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon
                        className="w-5 h-5 flex-shrink-0"
                        aria-hidden="true"
                      />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="flex-shrink-0 p-2 border-t border-white/10">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-nav-item w-full justify-center"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
