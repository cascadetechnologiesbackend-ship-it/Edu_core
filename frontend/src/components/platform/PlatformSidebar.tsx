"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Bell,
  History,
  ShieldCheck,
  ChevronRight,
  LogOut,
  Terminal,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

interface PlatformSidebarProps {
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
    href: "/dpdp",
    icon: ShieldCheck,
  },
];

export function PlatformSidebar({
  userEmail = "operator@schoolmitra.in",
  userName = "Platform Super Admin",
}: PlatformSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#090d16] border-r border-slate-800/80 flex flex-col h-full text-slate-300 select-none">
      {/* Platform Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <Link href="/super-admin/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
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
          const isActive = pathname === item.href || (item.href !== "/super-admin/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group",
                isActive
                  ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
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
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <div className="min-w-0 pr-2">
            <div className="text-xs font-semibold text-white truncate">{userName}</div>
            <div className="text-[10px] text-slate-400 font-mono truncate">{userEmail}</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
