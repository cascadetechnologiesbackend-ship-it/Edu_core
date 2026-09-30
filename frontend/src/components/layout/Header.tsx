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
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  notificationCount?: number;
}

export function Header({
  breadcrumbs = [],
  notificationCount = 0,
}: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
                <a
                  href={crumb.href ?? "#"}
                  className="text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  {crumb.label}
                </a>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Search */}
      <div className="relative hidden md:block">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search students, fees, notices…"
          className="pl-9 pr-4 py-1.5 text-sm bg-muted rounded-lg border border-border
                     focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                     transition-all w-64"
          aria-label="Global search"
          id="global-search"
        />
      </div>

      {/* Notification Bell */}
      <div className="relative">
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
      <div className="relative">
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
            {session?.user?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="hidden md:block text-left min-w-0">
            <p className="text-sm font-medium truncate max-w-[120px]">
              {session?.user?.name ?? "User"}
            </p>
            <p className="text-xs text-muted-foreground">
              {(session?.user as { role?: string })?.role ?? "Admin"}
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
            <button
              className="w-full flex items-center gap-2 px-4 py-2 text-sm
                         hover:bg-muted transition-colors"
              role="menuitem"
              onClick={() => setUserMenuOpen(false)}
            >
              <User className="w-4 h-4" aria-hidden="true" />
              Profile
            </button>
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
