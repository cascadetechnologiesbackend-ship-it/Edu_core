"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  LogOut,
  User,
  AlertOctagon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession, signOut } from "next-auth/react";
import { getRoleConfig, type UserRole, type NavItem } from "../../lib/roleConfig";

// Split heavy navigation icon map into dynamic chunk for shell leanliness (<= 100KB gzip)
const SidebarIcon = dynamic(
  () => import("./SidebarIcon").then((m) => m.SidebarIcon),
  {
    ssr: true,
    loading: () => <span className="w-4 h-4 flex-shrink-0 inline-block bg-white/10 rounded" />,
  }
);

export interface SidebarCurrentUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  image?: string | null;
}

interface SidebarProps {
  schoolName?: string | undefined;
  userRole?: string | undefined;
  currentUser?: SidebarCurrentUser | null | undefined;
}

export function Sidebar({
  schoolName = "SchoolMitra ERP",
  userRole,
  currentUser,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Load persisted collapse state
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edu.sidebar.collapsed");
        if (saved !== null) {
          setCollapsed(saved === "true");
        }
      } catch {}
    }
  }, []);

  const handleToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edu.sidebar.collapsed", String(next));
      } catch {}
    }
  };

  let sessionRole: string | undefined = currentUser?.role || undefined;
  let sessionUser: any = currentUser || null;
  let isSessionLoading = false;

  // React cache() and server-side currentUser resolution bypass client fetch waterfall
  const sessionContext = useSession();
  if (!currentUser) {
    sessionRole = sessionContext?.data?.user?.role;
    sessionUser = sessionContext?.data?.user || null;
    isSessionLoading = sessionContext?.status === "loading";
  }

  // FAIL-CLOSED: Determine role strictly without falling back to a privileged role (GT-01)
  const role = (userRole as UserRole) || (sessionRole as UserRole) || undefined;

  // Compute profile destination per role
  const profileHref =
    role === "TEACHER"
      ? "/teacher/profile"
      : role === "PARENT"
        ? "/parent/profile"
        : role === "STUDENT"
          ? "/student/profile"
          : role === "DRIVER"
            ? "/driver/profile"
            : role === "SUPER_ADMIN"
              ? "/super-admin/profile"
              : "/profile";

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Global keyboard shortcut: Cmd/Ctrl + , to open profile
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        router.push(profileHref as any);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, profileHref]);

  // Click outside to close account menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    if (accountMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [accountMenuOpen]);


  // 1. Loading State: Render a skeleton shell while role is resolving (GT-01)
  if (!role && isSessionLoading) {
    return (
      <aside
        className={cn(
          "flex flex-col h-full bg-sidebar border-r border-white/10 transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
        aria-label="Navigation loading"
      >
        <div className="flex items-center h-16 px-4 border-b border-white/10 animate-pulse">
          <div className="w-8 h-8 bg-white/10 rounded-lg shrink-0" />
          {!collapsed && <div className="ml-3 h-4 w-28 bg-white/10 rounded" />}
        </div>
        <div className="flex-1 p-3 space-y-4 animate-pulse">
          <div className="h-3 w-16 bg-white/10 rounded" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 bg-white/10 rounded-xl" />
            ))}
          </div>
        </div>
      </aside>
    );
  }

  // 2. Unresolved Session: Render fail-closed error with relogin affordance (GT-01)
  if (!role) {
    return (
      <aside
        className={cn(
          "flex flex-col h-full bg-sidebar border-r border-white/10 transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
        aria-label="Authentication required"
      >
        <div className="flex items-center h-16 px-4 border-b border-white/10">
          <div className="w-8 h-8 bg-rose-500/20 text-rose-400 rounded-lg flex items-center justify-center shrink-0">
            <AlertOctagon className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="ml-3 min-w-0">
              <p className="text-xs font-bold text-rose-400 truncate">Session Error</p>
              <p className="text-[10px] text-sidebar-text/70">Role unverified</p>
            </div>
          )}
        </div>
        <div className="p-4 space-y-3 text-center">
          {!collapsed && (
            <p className="text-xs text-sidebar-text/70">
              Your security role could not be resolved. Please re-authenticate.
            </p>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            {!collapsed && <span>Relogin</span>}
          </button>
        </div>
      </aside>
    );
  }

  // 3. Render purely from ROLE_CONFIGS[role].navItems (GT-04)
  const roleConfig = getRoleConfig(role);
  const navItems = roleConfig.navItems || [];

  // Group items by item.group (preserving sequence)
  const groupOrder: string[] = [];
  const groupsRecord: Record<string, NavItem[]> = {};

  navItems.forEach((item) => {
    const groupName = item.group || "OVERVIEW";
    if (!groupsRecord[groupName]) {
      groupsRecord[groupName] = [];
      groupOrder.push(groupName);
    }
    groupsRecord[groupName].push(item);
  });

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-white/10",
        collapsed ? "w-16" : "w-64"
      )}
      aria-label="Main navigation"
    >
      {/* Workspace Identity (Spec 4.1.0) */}
      <div className="flex items-center h-16 px-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate leading-tight">
                {schoolName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {roleConfig.displayName}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grouped Nav Items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5" role="navigation">
        {groupOrder.map((groupName) => {
          const items = groupsRecord[groupName] || [];
          return (
            <div key={groupName} className="space-y-1">
              {!collapsed && (
                <p className="text-[10px] font-bold text-sidebar-text/50 uppercase tracking-wider px-2.5 mb-1.5">
                  {groupName}
                </p>
              )}
              <ul className="space-y-0.5" role="list">
                {items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      item.href !== "/school/fees-dashboard" &&
                      pathname.startsWith(item.href));
                  const isPending = pendingHref === item.href;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href as any}
                        prefetch={false}
                        onClick={() => setPendingHref(item.href)}
                        className={cn(
                          "sidebar-nav-item transition-all relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium",
                          isActive
                            ? "bg-indigo-50/10 text-indigo-400 font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-indigo-500 before:rounded-r"
                            : "text-sidebar-text hover:bg-white/5 hover:text-white",
                          isPending && "opacity-80 animate-pulse bg-white/10",
                          collapsed && "justify-center px-2"
                        )}
                        aria-current={isActive ? "page" : undefined}
                        title={collapsed ? item.label : undefined}
                      >
                        <SidebarIcon
                          name={item.icon}
                          className={cn(
                            "w-4 h-4 flex-shrink-0 transition-transform",
                            isActive ? "text-indigo-400" : "text-sidebar-text/80",
                            isPending && "scale-110 text-indigo-400"
                          )}
                          aria-hidden="true"
                        />
                        {!collapsed && (
                          <span className="truncate flex-1">{item.label}</span>
                        )}
                        {!collapsed && item.kbdHint && (
                          <kbd className="hidden group-hover:inline-block px-1 py-0.5 text-[9px] font-mono text-sidebar-text/60 bg-white/5 rounded border border-white/10">
                            C
                          </kbd>
                        )}
                        {!collapsed && isPending && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Fixed 64px Account Section (Spec 5.0.0 Phase 3) */}
      {(() => {
        const userName = sessionUser?.name || "User";
        const userInitials =
          userName
            .split(" ")
            .map((s: string) => s.charAt(0))
            .slice(0, 2)
            .join("")
            .toUpperCase() || "U";
        const avatarColors = [
          "bg-indigo-600",
          "bg-violet-600",
          "bg-emerald-600",
          "bg-blue-600",
          "bg-rose-600",
          "bg-amber-600",
          "bg-teal-600",
        ];
        const charSum = userName
          .split("")
          .reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
        const avatarBg = avatarColors[charSum % avatarColors.length];

        return (
          <div
            ref={accountRef}
            className="relative flex-shrink-0 h-16 border-t border-white/10 px-2 flex items-center"
          >
            <button
              type="button"
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              className={cn(
                "w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/5 transition text-left focus:outline-none focus:ring-1 focus:ring-indigo-500/50",
                collapsed && "justify-center"
              )}
              aria-expanded={accountMenuOpen}
              aria-haspopup="true"
              title={collapsed ? `${userName} (${roleConfig.displayName})` : undefined}
            >
              {/* Avatar with Online Status */}
              <div className="relative flex-shrink-0">
                {sessionUser?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sessionUser.image}
                    alt={userName}
                    className="w-8 h-8 rounded-lg object-cover border border-white/20"
                  />
                ) : (
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm border border-white/20",
                      avatarBg
                    )}
                  >
                    {userInitials}
                  </div>
                )}
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900"
                  title="Online"
                />
              </div>

              {/* User Name & Role Chip */}
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium text-xs truncate leading-tight">
                    {userName}
                  </p>
                  <p className="text-[10px] text-sidebar-text/70 truncate mt-0.5">
                    {roleConfig.displayName}
                  </p>
                </div>
              )}

              {!collapsed && (
                <div className="text-sidebar-text/60 flex-shrink-0">
                  {accountMenuOpen ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" />
                  )}
                </div>
              )}
            </button>

            {/* Quick-Action Popover */}
            {accountMenuOpen && (
              <div
                className={cn(
                  "absolute bottom-full mb-2 z-50 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 w-56 text-xs divide-y divide-slate-800",
                  collapsed ? "left-14" : "left-2"
                )}
                role="menu"
              >
                <div className="px-3 py-2">
                  <p className="font-semibold text-white truncate">{userName}</p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {sessionUser?.email || ""}
                  </p>
                </div>

                <div className="py-1 space-y-0.5">
                  <Link
                    href={profileHref as any}
                    prefetch={false}
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-slate-200 hover:bg-white/10 transition font-medium"
                    role="menuitem"
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-indigo-400" /> My Profile
                    </span>
                    <kbd className="px-1 py-0.5 text-[9px] font-mono text-slate-400 bg-white/5 rounded border border-white/10">
                      ⌘,
                    </kbd>
                  </Link>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition font-medium text-left"
                    role="menuitem"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Collapse Toggle */}
      <div className="flex-shrink-0 p-2 border-t border-white/10">
        <button
          onClick={handleToggleCollapse}
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
