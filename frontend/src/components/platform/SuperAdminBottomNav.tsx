"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Bell,
  History,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Command",
    href: "/super-admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Tenants",
    href: "/super-admin/schools",
    icon: Building2,
  },
  {
    label: "Broadcast",
    href: "/super-admin/announcements",
    icon: Bell,
  },
  {
    label: "Audit",
    href: "/super-admin/audit",
    icon: History,
  },
  {
    label: "DPDP",
    href: "/super-admin/dpdp",
    icon: ShieldCheck,
  },
];

export function SuperAdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Super Admin Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#090d16]/95 backdrop-blur-lg border-t border-slate-800/90 text-slate-400 shadow-2xl pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="grid grid-cols-5 h-16 items-center px-1 max-w-md mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/super-admin/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={cn(
                "flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-colors relative group",
                isActive ? "text-indigo-400 font-semibold" : "text-slate-400 hover:text-slate-200"
              )}
            >
              {/* Active top highlight bar */}
              {isActive && (
                <span className="absolute top-0 inset-x-3 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-sm shadow-indigo-500/50" />
              )}
              <div
                className={cn(
                  "p-1 rounded-lg transition-transform",
                  isActive ? "bg-indigo-600/15 scale-105" : "group-hover:scale-105"
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[56px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
