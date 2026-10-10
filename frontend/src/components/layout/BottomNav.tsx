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
      className={`fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 shadow-xl safe-area-bottom ${
        isLowTier
          ? "bg-slate-900/98 dark:bg-slate-950/98"
          : "bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md"
      }`}
    >
      <div className="max-w-3xl mx-auto grid grid-flow-col auto-cols-fr items-center h-16 px-2">
        {items.map((item) => {
          const Icon = ICON_MAP[item.icon] || LayoutDashboard;
          const isActive =
            item.href === fullCurrentPath ||
            (!item.href.includes("?") && pathname === item.href && !currentTab);

          let resolvedHref = item.href;
          if (currentStudentId && resolvedHref.startsWith("/parent/dashboard")) {
            const sep = resolvedHref.includes("?") ? "&" : "?";
            resolvedHref = `${resolvedHref}${sep}studentId=${currentStudentId}`;
          }

          return (
            <Link
              key={item.href}
              href={resolvedHref as any}
              prefetch={false}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors relative min-h-[44px] ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-400 font-bold"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 font-medium"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-8 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              )}
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] truncate max-w-[64px]">{item.label}</span>
              {item.badge && (
                <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
