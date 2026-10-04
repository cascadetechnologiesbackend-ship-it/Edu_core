"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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

  // Combine pathname and searchParams for matching
  const currentTab = searchParams.get("tab");
  const fullCurrentPath = currentTab ? `${pathname}?tab=${currentTab}` : pathname;

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-800 shadow-xl safe-area-bottom"
    >
      <div className="max-w-3xl mx-auto grid grid-flow-col auto-cols-fr items-center h-16 px-2">
        {items.map((item) => {
          const Icon = ICON_MAP[item.icon] || LayoutDashboard;
          const isActive =
            item.href === fullCurrentPath ||
            (!item.href.includes("?") && pathname === item.href && !currentTab);

          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative min-h-[44px] ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-400 font-bold"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 font-medium"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-8 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              )}
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-rose-500 text-white leading-tight">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-[70px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
