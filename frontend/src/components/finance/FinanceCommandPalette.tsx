"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  Search,
  BookOpen,
  Building2,
  Receipt,
  FileCheck,
  ShieldCheck,
  Percent,
  History,
  TrendingUp,
  RotateCcw,
  IndianRupee,
  AlertCircle,
  Landmark,
  ArrowLeftRight,
  BadgePercent,
  Undo2,
  Grid3x3,
  User,
} from "lucide-react";
import { ROLE_CONFIGS, type UserRole, type NavItem } from "../../lib/roleConfig";
import { useSession } from "next-auth/react";
import type { LucideIcon } from "lucide-react";

export interface RecentStudentItem {
  id: string;
  name: string;
  admissionNumber: string;
  className: string;
}

export interface FinanceCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: string;
  onSelectCollect?: () => void;
  onSelectIncome?: () => void;
  onSelectExpense?: () => void;
  onSelectStudent?: (student: RecentStudentItem) => void;
}

const PALETTE_ICON_MAP: Record<string, LucideIcon | React.ComponentType<any>> = {
  LayoutDashboard: TrendingUp,
  TrendingUp,
  CreditCard,
  IndianRupee,
  FileText,
  AlertCircle,
  Receipt,
  BookOpen,
  Building2,
  Landmark,
  Percent,
  ArrowLeftRight,
  BadgePercent,
  RotateCcw,
  Undo2,
  Grid3x3,
};

export function FinanceCommandPalette({
  open,
  onOpenChange,
  userRole,
  onSelectCollect,
  onSelectIncome,
  onSelectExpense,
  onSelectStudent,
}: FinanceCommandPaletteProps) {
  const router = useRouter();
  const session = useSession();
  const role = (userRole as UserRole) || (session?.data?.user?.role as UserRole) || "ACCOUNTANT";

  const [recentStudents, setRecentStudents] = useState<RecentStudentItem[]>([]);

  // Load recent students looked up from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("edu.recent.students");
        if (stored) {
          setRecentStudents(JSON.parse(stored).slice(0, 5));
        }
      } catch {}
    }
  }, [open]);

  // Listen to Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  if (!open) return null;

  // Strict route scoping derived 100% from ROLE_CONFIGS[role].navItems (GT-04 / Spec 4.1.0)
  const allowedNavItems: NavItem[] = ROLE_CONFIGS[role]?.navItems || [];

  // Group items by group
  const groupedNav: Record<string, NavItem[]> = {};
  allowedNavItems.forEach((item) => {
    const groupName = item.group || "Navigate";
    if (!groupedNav[groupName]) {
      groupedNav[groupName] = [];
    }
    groupedNav[groupName].push(item);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-28 px-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="fixed inset-0 -z-10"
        onClick={() => onOpenChange(false)}
      />

      <div className="w-full max-w-2xl bg-card border border-border/40 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <Command label="Finance Quick Jump & Actions" className="w-full">
          <div className="flex items-center px-4 border-b border-border/40">
            <Search className="w-5 h-5 text-gray-400 mr-2 shrink-0" />
            <Command.Input
              placeholder="Type a screen, command, or student... (e.g. collect, dues, day book)"
              className="w-full py-4 text-base bg-transparent border-0 outline-none text-foreground placeholder:text-gray-400"
              autoFocus
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 space-y-1">
            <Command.Empty className="py-8 text-center text-sm text-gray-500">
              No matching finance screens or commands found.
            </Command.Empty>

            {/* Section 1: Quick Actions (Spec 4.1.0) */}
            <Command.Group heading="Quick Actions" className="text-xs font-semibold text-gray-400 px-2 py-1">
              <Command.Item
                onSelect={() =>
                  runCommand(() => {
                    if (onSelectCollect) onSelectCollect();
                    else router.push("/school/collect-fees");
                  })
                }
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-[#248A3D] dark:hover:text-[#30D158] cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-[#248A3D] dark:text-[#30D158]" />
                <span>Collect fee for a student (Collect Terminal)</span>
              </Command.Item>

              <Command.Item
                onSelect={() =>
                  runCommand(() => {
                    if (onSelectIncome) onSelectIncome();
                    else router.push("/school/fees-dashboard");
                  })
                }
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 cursor-pointer"
              >
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                <span>Record miscellaneous income voucher</span>
              </Command.Item>

              <Command.Item
                onSelect={() =>
                  runCommand(() => {
                    router.push("/school/due-fees");
                  })
                }
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 cursor-pointer"
              >
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Lookup student fee ledger & dues</span>
              </Command.Item>

              <Command.Item
                onSelect={() =>
                  runCommand(() => {
                    router.push("/school/accounting/dashboard");
                  })
                }
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 cursor-pointer"
              >
                <Landmark className="w-4 h-4 text-blue-600" />
                <span>Record contra transfer view (Read-only register)</span>
              </Command.Item>
            </Command.Group>

            {/* Section 2: Scoped Navigation by Groups */}
            {Object.entries(groupedNav).map(([groupTitle, items]) => (
              <Command.Group
                key={groupTitle}
                heading={groupTitle}
                className="text-xs font-semibold text-gray-400 px-2 py-1"
              >
                {items.map((navItem) => {
                  const ItemIcon = PALETTE_ICON_MAP[navItem.icon] || TrendingUp;
                  return (
                    <Command.Item
                      key={navItem.href}
                      onSelect={() => runCommand(() => router.push(navItem.href as any))}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/40 cursor-pointer"
                    >
                      <ItemIcon className="w-4 h-4 text-gray-500" />
                      <span>{navItem.label}</span>
                      {navItem.access === "read-only" && (
                        <span className="ml-auto text-[10px] text-gray-400 px-1.5 py-0.5 rounded bg-muted/60">
                          Read-only
                        </span>
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}

            {/* Section 3: Recent Students */}
            {recentStudents.length > 0 && (
              <Command.Group heading="Recent Students (Ledger View)" className="text-xs font-semibold text-gray-400 px-2 py-1">
                {recentStudents.map((st) => (
                  <Command.Item
                    key={st.id}
                    onSelect={() =>
                      runCommand(() => {
                        if (onSelectStudent) {
                          onSelectStudent(st);
                        } else {
                          router.push(`/school/collect-fees?studentId=${st.id}` as any);
                        }
                      })
                    }
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/40 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg bg-[#248A3D]/10 dark:bg-[#30D158]/10 text-[#248A3D] dark:text-[#30D158] flex items-center justify-center text-xs font-bold">
                        {st.name.charAt(0)}
                      </div>
                      <span>{st.name}</span>
                      <span className="text-xs text-gray-400 font-mono">#{st.admissionNumber}</span>
                    </div>
                    <span className="text-xs text-gray-400">{st.className}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-t border-border/40 text-[11px] text-gray-400">
            <span>Navigation: Use ↑ ↓ and ↵ to select</span>
            <span>ESC to close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
