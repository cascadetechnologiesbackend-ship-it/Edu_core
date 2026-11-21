"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CreditCard,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  onOpenMenu: () => void;
  isMenuOpen?: boolean;
}

export function MobileBottomNav({ onOpenMenu, isMenuOpen }: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Home",
      href: "/dashboard",
      icon: LayoutDashboard,
      isActive: pathname === "/dashboard",
    },
    {
      label: "Students",
      href: "/students",
      icon: Users,
      isActive: pathname.startsWith("/students"),
    },
    {
      label: "Attendance",
      href: "/attendance",
      icon: CalendarCheck,
      isActive: pathname.startsWith("/attendance"),
    },
    {
      label: "Fees",
      href: "/school/fees-dashboard",
      icon: CreditCard,
      isActive: pathname.startsWith("/school/fees") || pathname.startsWith("/fees"),
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/85 dark:bg-slate-900/85 backdrop-blur-xl border-t border-border/50 shadow-level-3 pb-safe"
      aria-label="Mobile Navigation"
      role="navigation"
    >
      <div className="grid grid-cols-5 h-14 items-center px-1 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href as any}
              prefetch={false}
              className={cn(
                "flex flex-col items-center justify-center h-full min-h-[44px] py-1 transition-all rounded-xl select-none relative",
                item.isActive
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              )}
              aria-current={item.isActive ? "page" : undefined}
            >
              {item.isActive && (
                <span className="absolute top-0 w-6 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-tab-pill" />
              )}
              <div
                className={cn(
                  "p-1 rounded-xl transition-all",
                  item.isActive && "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                )}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <span className="text-[10px] tracking-tight font-medium mt-0.5 truncate max-w-[56px]">
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More / Menu Drawer Toggle */}
        <button
          type="button"
          onClick={onOpenMenu}
          className={cn(
            "flex flex-col items-center justify-center h-full min-h-[44px] py-1 transition-all rounded-xl select-none relative",
            isMenuOpen
              ? "text-blue-600 dark:text-blue-400 font-semibold"
              : "text-muted-foreground hover:text-foreground active:scale-95"
          )}
          aria-label="Open full navigation menu"
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen && (
            <span className="absolute top-0 w-6 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-tab-pill" />
          )}
          <div
            className={cn(
              "p-1 rounded-xl transition-all",
              isMenuOpen && "bg-blue-500/10 text-blue-600 dark:text-blue-400"
            )}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </div>
          <span className="text-[10px] tracking-tight font-medium mt-0.5 truncate max-w-[56px]">
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
