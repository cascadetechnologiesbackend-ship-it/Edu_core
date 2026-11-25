"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  CalendarCheck,
  FileSpreadsheet,
  BookOpen,
  MapPin,
  Navigation,
  User,
  Receipt,
  Award,
  Bus,
  Calendar,
  FileText,
  MessageSquare,
  MoreHorizontal,
  LucideIcon,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  CalendarCheck,
  FileSpreadsheet,
  BookOpen,
  Map: MapPin,
  MapPin,
  Navigation,
  User,
  Receipt,
  Award,
  Bus,
  Calendar,
  FileText,
  MessageSquare,
  MoreHorizontal,
};

export default function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLowTier, setIsLowTier] = useState(false);

  useEffect(() => {
    // Detect low-tier device to disable expensive backdrop-filter during scrolling (Spec 2.3 item 6)
    if (typeof navigator !== "undefined") {
      const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
      const lowMem = (navigator as any).deviceMemory && (navigator as any).deviceMemory <= 4;
      if (lowCores || lowMem) {
        setIsLowTier(true);
      }
    }
  }, []);

  // Combine pathname and searchParams for matching
  const currentTab = searchParams.get("tab");
  const currentStudentId = searchParams.get("studentId");
  const fullCurrentPath = currentTab ? `${pathname}?tab=${currentTab}` : pathname;

  return (
    <nav
      aria-label="Bottom Navigation"
      className={`fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--glass-border)] shadow-level-3 pb-safe ${
        isLowTier
          ? "bg-slate-900/98 dark:bg-slate-950/98"
          : "bg-slate-900/85 dark:bg-slate-950/85 supports-[backdrop-filter]:bg-[var(--glass-bg)] backdrop-blur-xl"
      }`}
    >
      <div className="max-w-3xl mx-auto grid grid-flow-col auto-cols-fr items-center h-14 px-2">
        {items.map((item) => {
          const Icon = ICON_MAP[item.icon] || LayoutDashboard;
          const isActive =
            item.href === fullCurrentPath ||
            (!item.href.includes("?") && pathname === item.href && !currentTab);

          let resolvedHref = item.href;
          if (currentStudentId && (resolvedHref.startsWith("/parent/dashboard") || resolvedHref.startsWith("/student/"))) {
            const sep = resolvedHref.includes("?") ? "&" : "?";
            resolvedHref = `${resolvedHref}${sep}studentId=${currentStudentId}`;
          }

          return (
            <Link
              key={item.href}
              href={resolvedHref as any}
              prefetch={false}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative min-h-[44px] select-none ${
                isActive
                  ? "text-blue-400 dark:text-blue-400 font-semibold"
                  : "text-slate-400 dark:text-slate-400 hover:text-white dark:hover:text-white font-medium"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-6 h-1 bg-blue-500 rounded-full animate-tab-pill" />
              )}
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight truncate max-w-[64px]">{item.label}</span>
              {item.badge && (
                <span className="absolute top-1 right-3 w-1.5 h-1.5 bg-rose-500 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
