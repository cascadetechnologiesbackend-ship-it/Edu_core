"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Database,
  Server,
  Menu,
  X,
  Terminal,
  LayoutDashboard,
  Building2,
  Bell,
  History,
  ShieldCheck,
  User,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { secureSignOut } from "@/lib/authClient";

interface PlatformHeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
  userEmail?: string;
  userName?: string;
}

const NAV_ITEMS = [
  {
    label: "Command Center",
    href: "/super-admin/dashboard",
    icon: LayoutDashboard,
    badge: "Live",
  },
  {
    label: "School Tenants",
    href: "/super-admin/schools",
    icon: Building2,
  },
  {
    label: "Broadcast Center",
    href: "/super-admin/announcements",
    icon: Bell,
  },
  {
    label: "Platform Audit Log",
    href: "/super-admin/audit",
    icon: History,
  },
  {
    label: "DPDP Privacy Vault",
    href: "/super-admin/dpdp",
    icon: ShieldCheck,
  },
  {
    label: "Administrator Profile",
    href: "/super-admin/profile",
    icon: User,
  },
];

export function PlatformHeader({
  breadcrumbs = [{ label: "Command Center", href: "/super-admin/dashboard" }],
  userEmail = "operator@schoolmitra.in",
  userName = "Platform Super Admin",
}: PlatformHeaderProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const currentCrumb = breadcrumbs[breadcrumbs.length - 1];

  return (
    <>
      <header className="h-16 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30 text-slate-200">
        {/* Left Section: Mobile Menu Trigger + Breadcrumbs */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Hamburger trigger for phones & tablets */}
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            aria-label="Open platform menu"
            className="md:hidden flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition active:scale-95"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop Breadcrumbs */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Platform</span>
            <span className="text-slate-600">/</span>
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {crumb.href && idx < breadcrumbs.length - 1 ? (
                  <Link
                    href={crumb.href as any}
                    className="text-slate-400 hover:text-white font-medium transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-white font-semibold truncate max-w-[200px]">
                    {crumb.label}
                  </span>
                )}
                {idx < breadcrumbs.length - 1 && <span className="text-slate-600">/</span>}
              </div>
            ))}
          </div>

          {/* Mobile Simplified Breadcrumb */}
          <div className="flex sm:hidden items-center gap-1.5 text-xs truncate">
            <span className="text-indigo-400 font-mono text-[11px] font-semibold">OS</span>
            <span className="text-slate-600">/</span>
            <span className="text-white font-bold truncate max-w-[160px]">
              {currentCrumb?.label || "Super Admin"}
            </span>
          </div>
        </div>

        {/* Right Section: Search & Telemetry */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Search Toggle */}
          <button
            onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
            aria-label="Toggle search"
            className="md:hidden flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition active:scale-95"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Desktop Search Input */}
          <div className="relative hidden md:block">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Quick search schools, UDISE... (⌘K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 lg:w-64 pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          {/* Telemetry pill */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 font-mono">
            <Database className="w-3 h-3 text-cyan-400" />
            <span>Pool: 25 max</span>
            <span className="text-slate-600">|</span>
            <Server className="w-3 h-3 text-indigo-400" />
            <span>Primary: Healthy</span>
          </div>
        </div>
      </header>

      {/* Mobile Collapsible Search Dropdown */}
      {isMobileSearchOpen && (
        <div className="md:hidden px-4 py-3 bg-[#0c121e] border-b border-slate-800 animate-in slide-in-from-top-2 duration-150">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              autoFocus
              placeholder="Search schools, UDISE, or state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Mobile Drawer (Slide-Over Navigation) */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[85vw] bg-[#090d16] border-r border-slate-800 flex flex-col h-full text-slate-300 z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
              <Link
                href="/super-admin/dashboard"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="flex items-center gap-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                    SchoolMitra <span className="text-indigo-400 font-mono text-xs">OS</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
                    Platform Operator
                  </div>
                </div>
              </Link>

              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                aria-label="Close menu"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 min-h-[44px] min-w-[44px] flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cluster Health Beacon */}
            <div className="px-4 py-2.5 mx-3 my-3 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-medium text-emerald-400">All Clusters Normal</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">92ms p95</span>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-3 space-y-1 overflow-y-auto pt-1">
              <div className="px-2 pb-1.5 text-[10px] font-semibold text-slate-500 tracking-wider uppercase">
                Ecosystem Navigation
              </div>
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/super-admin/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href as any}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group min-h-[44px]",
                      isActive
                        ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-sm"
                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          "w-4 h-4 transition-colors",
                          isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"
                        )}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-medium",
                          isActive
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            : "bg-slate-800 text-slate-400"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Operator Profile Footer */}
            <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-semibold text-white truncate">{userName}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{userEmail}</div>
                </div>
                <button
                  onClick={() => secureSignOut({ callbackUrl: "/login" })}
                  title="Sign Out"
                  aria-label="Sign Out"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
