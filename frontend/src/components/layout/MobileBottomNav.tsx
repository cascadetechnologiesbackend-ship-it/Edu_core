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
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-lg pb-safe"
      aria-label="Mobile Navigation"
      role="navigation"
    >
      <div className="grid grid-cols-5 h-16 items-center px-1 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href as any}
              prefetch={false}
              className={cn(
                "flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-all rounded-lg select-none",
                item.isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              )}
              aria-current={item.isActive ? "page" : undefined}
            >
              <div
                className={cn(
                  "p-1 rounded-xl transition-all",
                  item.isActive && "bg-primary/10 text-primary scale-110"
                )}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <span className="text-[11px] tracking-tight mt-0.5 truncate max-w-[56px]">
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
            "flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-all rounded-lg select-none",
            isMenuOpen
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground active:scale-95"
          )}
          aria-label="Open full navigation menu"
          aria-expanded={isMenuOpen}
        >
          <div
            className={cn(
              "p-1 rounded-xl transition-all",
              isMenuOpen && "bg-primary/10 text-primary scale-110"
            )}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </div>
          <span className="text-[11px] tracking-tight mt-0.5 truncate max-w-[56px]">
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
