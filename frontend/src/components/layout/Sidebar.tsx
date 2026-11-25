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
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { secureSignOut } from "@/lib/authClient";
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
  mobileOpen?: boolean | undefined;
  onCloseMobile?: (() => void) | undefined;
}

export function Sidebar({
  schoolName = "SchoolMitra ERP",
  userRole,
  currentUser,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Auto-close mobile drawer when navigating between pages
  useEffect(() => {
    onCloseMobile?.();
  }, [pathname]);

  // Safe Debounced Hover Prefetch (S1-T1 / Closes OPEN-14)
  // Max 2 in-flight prefetches with 150ms debounce prevents hover-sweep connection storms
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightPrefetchesRef = useRef<Set<string>>(new Set());
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());

  const handlePointerEnter = (href: string) => {
    if (prefetchedRoutesRef.current.has(href)) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      // In-flight cap: maximum 2 concurrent prefetches
      if (inFlightPrefetchesRef.current.size >= 2) return;
      inFlightPrefetchesRef.current.add(href);
      prefetchedRoutesRef.current.add(href);
      try {
        router.prefetch(href as any);
      } catch {}
      setTimeout(() => {
        inFlightPrefetchesRef.current.delete(href);
      }, 800);
    }, 150);
  };

  const handlePointerLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

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
          "flex flex-col h-full bg-[#F2F2F7]/95 dark:bg-[#161616]/95 supports-[backdrop-filter]:bg-[var(--glass-bg)] backdrop-blur-xl border-r border-[var(--glass-border)] text-foreground transition-all duration-300",
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] md:static md:z-auto md:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-64"
        )}
        aria-label="Navigation loading"
      >
        <div className="flex items-center h-14 px-4 border-b border-border/40 animate-pulse">
          <div className="w-8 h-8 bg-muted rounded-xl shrink-0" />
          <div className={cn("ml-3 h-4 w-28 bg-muted rounded", collapsed && "md:hidden")} />
        </div>
        <div className="flex-1 p-3 space-y-4 animate-pulse">
          <div className="h-3 w-16 bg-muted rounded" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 bg-muted rounded-xl" />
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
          "flex flex-col h-full bg-[#F2F2F7]/95 dark:bg-[#161616]/95 supports-[backdrop-filter]:bg-[var(--glass-bg)] backdrop-blur-xl border-r border-[var(--glass-border)] text-foreground transition-all duration-300",
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] md:static md:z-auto md:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-64"
        )}
        aria-label="Authentication required"
      >
        <div className="flex items-center h-14 px-4 border-b border-border/40">
          <div className="w-8 h-8 bg-semantic-money-owed/20 text-semantic-money-owed rounded-xl flex items-center justify-center shrink-0">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div className={cn("ml-3 min-w-0", collapsed && "md:hidden")}>
            <p className="text-xs font-bold text-semantic-money-owed truncate">Session Error</p>
            <p className="text-[10px] text-muted-foreground">Role unverified</p>
          </div>
        </div>
        <div className="p-4 space-y-3 text-center">
          <p className={cn("text-xs text-muted-foreground", collapsed && "md:hidden")}>
            Your security role could not be resolved. Please re-authenticate.
          </p>
          <button
            onClick={() => secureSignOut({ callbackUrl: "/login" })}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-semantic-money-owed hover:bg-semantic-money-owed/90 text-white transition shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className={cn(collapsed && "md:hidden")}>Relogin</span>
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
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300 md:hidden",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "flex flex-col h-full bg-[#F2F2F7]/95 dark:bg-[#161616]/95 supports-[backdrop-filter]:bg-[var(--glass-bg)] backdrop-blur-xl border-r border-[var(--glass-border)] text-foreground transition-all duration-300",
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] md:static md:z-auto md:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-64"
        )}
        aria-label="Main navigation"
      >
        {/* Workspace Identity (Spec 4.1.0) */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-border/40 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 bg-semantic-interactive rounded-xl flex items-center justify-center text-white shadow-level-1">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div className={cn("min-w-0", collapsed && "md:hidden")}>
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-foreground font-semibold text-sm truncate leading-tight tracking-tight">
                  {schoolName}
                </p>
                {schoolName?.includes("DEMO") && (
                  <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider bg-semantic-attention/15 text-semantic-attention border border-semantic-attention/30 shrink-0">
                    [DEMO]
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-muted/60 text-muted-foreground border border-border/40">
                  {roleConfig.displayName}
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Drawer Close Button (UX-R21: 44px tap target) */}
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden flex items-center justify-center w-11 h-11 -mr-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-95 transition-all"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Grouped Nav Items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4" role="navigation">
          {groupOrder.map((groupName) => {
            const items = groupsRecord[groupName] || [];
            return (
              <div key={groupName} className="space-y-1">
                <p className={cn("text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2.5 mb-1", collapsed && "md:hidden")}>
                  {groupName}
                </p>
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
                          onClick={() => {
                            setPendingHref(item.href);
                            onCloseMobile?.();
                          }}
                          onPointerEnter={() => handlePointerEnter(item.href)}
                          onPointerLeave={handlePointerLeave}
                          onFocus={() => handlePointerEnter(item.href)}
                          onBlur={handlePointerLeave}
                          className={cn(
                            "transition-all relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium min-h-[38px] sm:min-h-[40px]",
                            isActive
                              ? "bg-semantic-interactive/12 text-semantic-interactive font-semibold border border-semantic-interactive/20 shadow-xs"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                            isPending && "opacity-80 animate-pulse bg-semantic-interactive/10",
                            collapsed ? "md:justify-center md:px-2" : ""
                          )}
                          aria-current={isActive ? "page" : undefined}
                          title={collapsed ? item.label : undefined}
                        >
                          <SidebarIcon
                            name={item.icon}
                            className={cn(
                              "w-4 h-4 flex-shrink-0 transition-transform",
                              isActive ? "text-semantic-interactive" : "text-muted-foreground",
                              isPending && "scale-110 text-semantic-interactive"
                            )}
                            aria-hidden="true"
                          />
                          <span className={cn("truncate flex-1", collapsed && "md:hidden")}>
                            {item.label}
                          </span>
                          {item.kbdHint && (
                            <kbd className={cn("hidden group-hover:inline-block px-1 py-0.5 text-[9px] font-mono text-sidebar-text/60 bg-white/5 rounded border border-white/10", collapsed && "md:hidden")}>
                              C
                            </kbd>
                          )}
                          {isPending && (
                            <span className={cn("ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping", collapsed && "md:hidden")} />
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
                  collapsed ? "md:justify-center" : ""
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
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-semantic-money-in border-2 border-background"
                    title="Online"
                  />
                </div>

                {/* User Name & Role Chip */}
                <div className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
                  <p className="text-foreground font-medium text-xs truncate leading-tight">
                    {userName}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {roleConfig.displayName}
                  </p>
                </div>

                <div className={cn("text-muted-foreground flex-shrink-0", collapsed && "md:hidden")}>
                  {accountMenuOpen ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>

              {/* Quick-Action Popover */}
              {accountMenuOpen && (
                <div
                  className={cn(
                    "absolute bottom-full mb-2 z-50 rounded-2xl bg-card border border-border/40 shadow-level-3 p-2 w-56 text-xs divide-y divide-border/30 animate-fade-scale-in text-card-foreground",
                    collapsed ? "left-2 md:left-14" : "left-2"
                  )}
                  role="menu"
                >
                  <div className="px-3 py-2">
                    <p className="font-semibold text-foreground truncate">{userName}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {sessionUser?.email || ""}
                    </p>
                  </div>

                  <div className="py-1 space-y-0.5">
                    <Link
                      href={profileHref as any}
                      prefetch={false}
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onCloseMobile?.();
                      }}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-foreground hover:bg-muted/60 transition font-medium"
                      role="menuitem"
                    >
                      <span className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-semantic-interactive" /> My Profile
                      </span>
                      <kbd className="px-1 py-0.5 text-[9px] font-mono text-muted-foreground bg-muted/60 rounded border border-border/40">
                        ⌘,
                      </kbd>
                    </Link>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => secureSignOut({ callbackUrl: "/login" })}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-semantic-money-owed hover:bg-semantic-money-owed/10 transition font-medium text-left"
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

        {/* Collapse Toggle - Desktop Only */}
        <div className="hidden md:block flex-shrink-0 p-2 border-t border-border/40">
          <button
            onClick={handleToggleCollapse}
            className="flex items-center gap-2 w-full justify-center px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 text-sm font-medium transition-all"
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
    </>
  );
}
