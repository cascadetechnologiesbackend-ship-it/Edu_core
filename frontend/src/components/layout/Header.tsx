"use client";

import {
  Bell,
  Search,
  ChevronRight,
  LogOut,
  User,
  Sun,
  Moon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";

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
}: HeaderProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const sessionContext = useSession();
  const user = currentUser || sessionContext?.data?.user;
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
      className="h-16 bg-card border-b border-border flex items-center px-6 gap-4 flex-shrink-0"
      role="banner"
    >
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex-1 min-w-0">
        <ol className="flex items-center gap-1 text-sm" role="list">
          {breadcrumbs.map((crumb, idx) => (
            <li key={crumb.label} className="flex items-center gap-1">
              {idx > 0 && (
                <ChevronRight
                  className="w-3 h-3 text-muted-foreground flex-shrink-0"
                  aria-hidden="true"
                />
              )}
              {idx === breadcrumbs.length - 1 ? (
                <span
                  className="font-semibold text-foreground truncate"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={(crumb.href || "#") as any}
                  prefetch={false}
                  className="text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search students, fees, notices…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-4 py-1.5 text-sm bg-muted rounded-lg border border-border
                     focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                     transition-all w-64"
          aria-label="Global search"
          id="global-search"
        />
      </form>

      {/* Notification Bell */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ""}`}
          aria-haspopup="true"
          aria-expanded={notifOpen}
          id="notification-btn"
        >
          <Bell className="w-5 h-5" aria-hidden="true" />
          {notificationCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger text-white
                         text-[10px] font-bold rounded-full flex items-center justify-center"
              aria-hidden="true"
            >
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        {/* Notifications Dropdown Panel */}
        {notifOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-80 bg-card border border-border
                       rounded-xl shadow-glass py-3 px-4 z-50 animate-fade-in text-sm"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="font-semibold text-foreground">Notifications</span>
              {notificationCount > 0 ? (
                <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
                  {notificationCount} new
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">0 unread</span>
              )}
            </div>
            <div className="py-6 flex flex-col items-center justify-center text-center text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-30 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">
                No unread announcements or urgent alerts at this time.
              </p>
            </div>
            <div className="pt-2 border-t border-border mt-2 flex items-center justify-between">
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
                className="text-xs text-primary font-semibold hover:underline"
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
        className="p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        id="theme-toggle"
      >
        {!mounted ? (
          <div className="w-5 h-5" />
        ) : theme === "dark" ? (
          <Sun className="w-5 h-5" aria-hidden="true" />
        ) : (
          <Moon className="w-5 h-5" aria-hidden="true" />
        )}
      </button>

      {/* User Menu */}
      <div className="relative" ref={userMenuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
          aria-haspopup="true"
          aria-expanded={userMenuOpen}
          aria-label="User menu"
          id="user-menu-btn"
        >
          <div
            className="w-7 h-7 rounded-full bg-primary flex items-center justify-center
                        text-white text-sm font-semibold flex-shrink-0"
            aria-hidden="true"
          >
            {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="hidden md:block text-left min-w-0">
            <p className="text-sm font-medium truncate max-w-[120px]">
              {user?.name ?? "User"}
            </p>
            <p className="text-xs text-muted-foreground">
              {role ?? "Admin"}
            </p>
          </div>
        </button>

        {/* Dropdown */}
        {userMenuOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-48 bg-card border border-border
                        rounded-lg shadow-glass py-1 z-50 animate-fade-in"
            role="menu"
            aria-labelledby="user-menu-btn"
          >
            <Link
              href={profileHref as any}
              prefetch={false}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm
                         hover:bg-muted transition-colors text-foreground"
              role="menuitem"
              onClick={() => setUserMenuOpen(false)}
            >
              <User className="w-4 h-4" aria-hidden="true" />
              Profile
            </Link>
            <hr className="border-border my-1" />
            <button
              onClick={() => {
                setUserMenuOpen(false);
                signOut({ callbackUrl: "/login" });
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger
                         hover:bg-danger/10 transition-colors text-left"
              role="menuitem"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
