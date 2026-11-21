"use client";

import {
  Bell,
  Search,
  ChevronRight,
  LogOut,
  User,
  Sun,
  Moon,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { secureSignOut } from "@/lib/authClient";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { ExamCommandSearch } from "@/components/exams/ExamCommandSearch";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface HeaderCurrentUser {
  name?: string | null;
  email?: string | null;
  role?: string | null;
  image?: string | null;
}

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[] | undefined;
  notificationCount?: number | undefined;
  currentUser?: HeaderCurrentUser | null | undefined;
  onOpenMobileMenu?: () => void;
}

function getProfileHref(role?: string | null): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin/dashboard";
    case "DRIVER":
      return "/driver/profile";
    case "TEACHER":
      return "/teacher/dashboard";
    case "PARENT":
      return "/parent/dashboard";
    case "STUDENT":
      return "/student/dashboard";
    case "SCHOOL_ADMIN":
    default:
      return "/settings";
  }
}

export function Header({
  breadcrumbs = [],
  notificationCount = 0,
  currentUser,
  onOpenMobileMenu,
}: HeaderProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const sessionContext = useSession();
  const user = currentUser || sessionContext?.data?.user;
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [examCmdOpen, setExamCmdOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      router.push(`/students?search=${encodeURIComponent(query)}`);
    }
  };

  const role = (user as { role?: string })?.role;
  const profileHref = getProfileHref(role);

  return (
    <header
      className="h-14 bg-background/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-border/40 flex items-center px-3 sm:px-4 md:px-6 gap-2 sm:gap-4 flex-shrink-0 sticky top-0 z-40 transition-colors"
      role="banner"
    >
      {/* Mobile Hamburger Drawer Trigger (UX-R21: min 44px tap target) */}
      {onOpenMobileMenu && (
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden flex items-center justify-center w-11 h-11 -ml-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex-1 min-w-0">
        <ol className="flex items-center gap-1.5 text-sm" role="list">
          {breadcrumbs.map((crumb, idx) => (
            <li key={crumb.label} className="flex items-center gap-1.5">
              {idx > 0 && (
                <ChevronRight
                  className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0"
                  aria-hidden="true"
                />
              )}
              {idx === breadcrumbs.length - 1 ? (
                <span
                  className="font-semibold text-foreground truncate tracking-tight"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={(crumb.href || "#") as any}
                  prefetch={false}
                  className="text-muted-foreground hover:text-foreground transition-colors truncate font-normal"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Command Search Trigger (⌘K) & Search */}
      <button
        type="button"
        onClick={() => setExamCmdOpen(true)}
        className="hidden md:flex items-center justify-between gap-3 pl-3.5 pr-2 py-1.5 text-xs text-muted-foreground bg-muted/40 hover:bg-muted/70 rounded-full border border-border/60 transition-all w-64 text-left shadow-xs"
        title="Academics & General Search (⌘K)"
        aria-label="Command Search"
      >
        <span className="flex items-center gap-2 truncate">
          <Search className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
          <span className="truncate">Search students, exams, actions…</span>
        </span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded-full border border-border/80 bg-background/80 px-2 font-mono text-[10px] font-medium text-muted-foreground shrink-0">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => setExamCmdOpen(true)}
        className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Open Command Search"
      >
        <Search className="w-5 h-5" />
      </button>

      <ExamCommandSearch
        open={examCmdOpen}
        onOpenChange={setExamCmdOpen}
        userRole={role || "SUPER_ADMIN"}
      />

      {/* Notification Bell */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
          aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ""}`}
          aria-haspopup="true"
          aria-expanded={notifOpen}
          id="notification-btn"
        >
          <Bell className="w-4 h-4" aria-hidden="true" />
          {notificationCount > 0 && (
            <span
              className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full"
              aria-hidden="true"
            />
          )}
        </button>

        {/* Notifications Dropdown Panel (Apple popover) */}
        {notifOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-80 bg-card/95 dark:bg-slate-900/95 backdrop-blur-xl border border-border/50
                       rounded-2xl shadow-level-3 py-3 px-4 z-50 animate-fade-scale-in text-sm"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <span className="font-semibold text-foreground tracking-tight">Notifications</span>
              {notificationCount > 0 ? (
                <span className="text-xs bg-blue-500/10 text-blue-500 font-medium px-2 py-0.5 rounded-full">
                  {notificationCount} new
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">All caught up</span>
              )}
            </div>
            <div className="py-6 flex flex-col items-center justify-center text-center text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-30 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">No new alerts</p>
              <p className="text-xs text-muted-foreground mt-1">
                You are completely up to date.
              </p>
            </div>
            <div className="pt-2 border-t border-border/50 mt-2 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Web Push Alerts</span>
              <button
                onClick={async () => {
                  try {
                    if (typeof window !== "undefined" && "Notification" in window) {
                      const perm = await Notification.requestPermission();
                      if (perm === "granted") {
                        alert("Push notifications enabled for this device.");
                      }
                    }
                  } catch {}
                }}
                className="text-xs text-blue-500 font-semibold hover:underline"
              >
                Enable Alerts
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dark Mode Toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        id="theme-toggle"
      >
        {!mounted ? (
          <div className="w-4 h-4" />
        ) : theme === "dark" ? (
          <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
        ) : (
          <Moon className="w-4 h-4 text-slate-700" aria-hidden="true" />
        )}
      </button>

      {/* User Menu */}
      <div className="relative" ref={userMenuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-muted/60 transition-colors"
          aria-haspopup="true"
          aria-expanded={userMenuOpen}
          aria-label="User menu"
          id="user-menu-btn"
        >
          <div
            className="w-7 h-7 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center
                        text-white text-xs font-semibold flex-shrink-0 shadow-xs"
            aria-hidden="true"
          >
            {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="hidden md:block text-left min-w-0">
            <p className="text-sm font-medium truncate max-w-[120px] leading-tight">
              {user?.name ?? "User"}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {role ?? "Admin"}
            </p>
          </div>
        </button>

        {/* Dropdown (Apple menu style) */}
        {userMenuOpen && (
          <div
            className="absolute right-0 top-full mt-1.5 w-52 bg-card/95 dark:bg-slate-900/95 backdrop-blur-xl border border-border/50
                        rounded-2xl shadow-level-3 p-1.5 z-50 animate-fade-scale-in"
            role="menu"
            aria-labelledby="user-menu-btn"
          >
            <div className="px-3 py-2 border-b border-border/40 mb-1">
              <p className="text-xs font-semibold text-foreground truncate">{user?.name ?? "User"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email ?? ""}</p>
            </div>
            <Link
              href={profileHref as any}
              prefetch={false}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-xl
                         hover:bg-muted/70 transition-colors text-foreground font-medium"
              role="menuitem"
              onClick={() => setUserMenuOpen(false)}
            >
              <User className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />
              Profile & Settings
            </Link>
            <hr className="border-border/40 my-1" />
            <button
              onClick={() => {
                setUserMenuOpen(false);
                secureSignOut({ callbackUrl: "/login" });
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-500
                         hover:bg-rose-500/10 rounded-xl transition-colors text-left font-medium"
              role="menuitem"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
