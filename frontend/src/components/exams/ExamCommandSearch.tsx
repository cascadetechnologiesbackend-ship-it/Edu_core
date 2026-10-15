"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  FileSpreadsheet,
  Calendar,
  Share2,
  FileCheck,
  TrendingUp,
  Sparkles,
  Layers,
  Search,
  BookOpen,
  Users,
  ShieldAlert,
} from "lucide-react";

export interface ExamCommandSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: string;
}

interface ExamShortcutItem {
  id: string;
  title: string;
  subtitle: string;
  category: "Marks Entry" | "Datesheets & Schedules" | "Results & Cards" | "Setup & Blueprints";
  href: string;
  icon: any;
  allowedRoles: string[];
}

const EXAM_SHORTCUTS: ExamShortcutItem[] = [
  {
    id: "enter-marks-gradebook",
    title: "Enter Scholastic Marks",
    subtitle: "Navigate directly to educator gradebook for assigned subjects",
    category: "Marks Entry",
    href: "/teacher/grading",
    icon: FileSpreadsheet,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"],
  },
  {
    id: "admin-marks-review",
    title: "Review & Lock Class Marks",
    subtitle: "Verify submitted marksheets, draft counts, and lock evaluation status",
    category: "Marks Entry",
    href: "/exams/marks",
    icon: FileSpreadsheet,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
  },
  {
    id: "exam-schedules",
    title: "Manage Datesheets & Examination Timetable",
    subtitle: "Configure paper dates, session timings, invigilators, and rooms",
    category: "Datesheets & Schedules",
    href: "/exams/schedule",
    icon: Calendar,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
  },
  {
    id: "publish-datesheet",
    title: "Publish Examination Datesheet",
    subtitle: "Sync examination dates with calendar and notify guardians",
    category: "Datesheets & Schedules",
    href: "/exams/schedule?action=publish",
    icon: Share2,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
  },
  {
    id: "distribute-marks",
    title: "Automate Mark Distributions",
    subtitle: "Bulk generate component mark distributions according to board blueprint",
    category: "Setup & Blueprints",
    href: "/exams/manage",
    icon: Sparkles,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
  },
  {
    id: "student-electives",
    title: "Student Elective Enrollments Matrix",
    subtitle: "Manage student subject enrollments and elective selections",
    category: "Setup & Blueprints",
    href: "/exams/setup/enrollments",
    icon: Users,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  },
  {
    id: "admit-cards-release",
    title: "Release & Download Admit Cards",
    subtitle: "Manage hall ticket availability windows and fee-clearance locks",
    category: "Results & Cards",
    href: "/exams/admit-cards",
    icon: FileCheck,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"],
  },
  {
    id: "publish-report-cards",
    title: "Publish Term Report Cards & Results",
    subtitle: "Release final snapshots to Parent Portal and trigger result alerts",
    category: "Results & Cards",
    href: "/exams/report-cards",
    icon: Share2,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
  },
  {
    id: "cohort-analytics",
    title: "Cohort Performance Analytics & Leaderboards",
    subtitle: "Deep cohort metrics, CBSE grade distributions, and topper merit lists",
    category: "Results & Cards",
    href: "/exams/analytics",
    icon: TrendingUp,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
  },
  {
    id: "portal-parent-results",
    title: "View Child Examination Results",
    subtitle: "Access published term report cards and grade summaries",
    category: "Results & Cards",
    href: "/portal/report-cards",
    icon: BookOpen,
    allowedRoles: ["PARENT", "STUDENT"],
  },
  {
    id: "portal-parent-admit-card",
    title: "Download Student Admit Card",
    subtitle: "Download official examination hall ticket and seating allocation",
    category: "Results & Cards",
    href: "/portal/admit-cards",
    icon: FileCheck,
    allowedRoles: ["PARENT", "STUDENT"],
  },
];

export function ExamCommandSearch({
  open,
  onOpenChange,
  userRole = "SUPER_ADMIN",
}: ExamCommandSearchProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  // Global keyboard shortcut handler: Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        // Only trigger if not typing in an input or textarea
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  if (!open) return null;

  // Strictly filter by role to uphold RBAC Matrix-First invariant
  const allowedShortcuts = EXAM_SHORTCUTS.filter((s) =>
    s.allowedRoles.includes(userRole),
  );

  const categories = Array.from(
    new Set(allowedShortcuts.map((s) => s.category)),
  );

  const handleSelect = (href: string) => {
    onOpenChange(false);
    router.push(href as any);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          label="Examination Command Search"
          className="w-full flex flex-col focus:outline-none"
        >
          {/* Search Input Bar */}
          <div className="flex items-center px-4 py-3.5 border-b border-gray-100 dark:border-slate-800 gap-2.5">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search exam operations, enter marks, datesheets, results..."
              className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
              autoFocus
            />
            <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-400">
              ESC
            </kbd>
          </div>

          {/* Search Results List */}
          <Command.List className="max-h-80 overflow-y-auto p-2 space-y-2">
            <Command.Empty className="py-8 text-center text-xs text-gray-400">
              No matching examination operations found.
            </Command.Empty>

            {categories.map((category) => {
              const categoryItems = allowedShortcuts.filter(
                (s) => s.category === category,
              );
              if (categoryItems.length === 0) return null;

              return (
                <Command.Group
                  key={category}
                  heading={category}
                  className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1"
                >
                  {categoryItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.id}
                        value={`${item.title} ${item.subtitle}`}
                        onSelect={() => handleSelect(item.href)}
                        className="p-2.5 rounded-xl flex items-center justify-between text-xs cursor-pointer hover:bg-indigo-50 dark:hover:bg-slate-800/80 transition aria-selected:bg-indigo-50 dark:aria-selected:bg-slate-800/80"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-gray-400 line-clamp-1">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400">Jump →</span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              );
            })}
          </Command.List>

          {/* Footer Bar */}
          <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex items-center justify-between text-[11px] text-gray-400">
            <span>Role-scoped • Zero-PII lookup</span>
            <div className="flex items-center gap-2">
              <span>Navigate: ↑↓</span>
              <span>Select: ↵</span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
