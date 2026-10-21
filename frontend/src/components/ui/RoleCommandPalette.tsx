"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Search,
  BookOpen,
  Calendar,
  FileSpreadsheet,
  ArrowRightLeft,
  Users,
  CreditCard,
  Bus,
  MessageSquare,
  FileText,
  Clock,
  Sparkles,
  Zap,
  Tag,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseOmniboxQuery,
  teacherRouteResolver,
  parentRouteResolver,
  type ParsedQuery,
  type RecognizedEntity,
  type TeacherScopeContext,
  type ParentWardContext,
  type ResolvedRoleRoute,
} from "@schoolmitra/entity-engine/query-ner";

export interface RoleCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: "TEACHER" | "PARENT" | "DRIVER";
  scope?: TeacherScopeContext;
  wards?: ParentWardContext[];
}

function entityChipClass(type: RecognizedEntity["type"]): string {
  switch (type) {
    case "CLASS_SECTION":
      return "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300";
    case "SUBJECT":
      return "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300";
    case "EXAM_NAME":
      return "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300";
    case "FEE_HEAD":
      return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300";
    case "BUS_ROUTE":
      return "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300";
    case "DATE_TEMPORAL":
      return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
    default:
      return "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300";
  }
}

export function RoleCommandPalette({
  open,
  onOpenChange,
  role,
  scope,
  wards,
}: RoleCommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !open)) {
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
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Synchronous client-side NER pass (< 5ms, client-safe)
  const parsed: ParsedQuery | null = useMemo(() => {
    if (!query.trim()) return null;
    return parseOmniboxQuery(query);
  }, [query]);

  // Role-scoped intent resolution
  const roleIntent: ResolvedRoleRoute | null = useMemo(() => {
    if (!parsed) return null;
    if (role === "TEACHER") {
      return teacherRouteResolver(parsed, scope);
    }
    if (role === "PARENT") {
      return parentRouteResolver(parsed, wards);
    }
    return null;
  }, [parsed, role, scope, wards]);

  if (!open) return null;

  const handleSelect = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const teacherShortcuts = [
    {
      label: "Class Attendance Register",
      href: "/teacher/attendance",
      icon: <Calendar className="w-4 h-4 text-emerald-400" />,
      badge: "Roll Call",
    },
    {
      label: "Gradebook & Marks Entry",
      href: "/teacher/grading",
      icon: <FileSpreadsheet className="w-4 h-4 text-amber-400" />,
      badge: "Exams",
    },
    {
      label: "My Day Timeline",
      href: "/teacher/classes?tab=myday",
      icon: <Clock className="w-4 h-4 text-blue-400" />,
      badge: "Timetable",
    },
    {
      label: "Section Rosters",
      href: "/teacher/classes?tab=rosters",
      icon: <Users className="w-4 h-4 text-indigo-400" />,
      badge: "Students",
    },
    {
      label: "Substitutions Workbench",
      href: "/teacher/classes?tab=substitutions",
      icon: <ArrowRightLeft className="w-4 h-4 text-purple-400" />,
      badge: "Cover",
    },
    {
      label: "PTM Appointments",
      href: "/teacher/ptm",
      icon: <BookOpen className="w-4 h-4 text-rose-400" />,
      badge: "Parents",
    },
  ];

  const parentShortcuts = [
    {
      label: "Fee Dues & Online Payment",
      href: "/parent/fees",
      icon: <CreditCard className="w-4 h-4 text-indigo-400" />,
      badge: "Finance",
    },
    {
      label: "Live School Bus GPS Tracking",
      href: "/parent/bus",
      icon: <Bus className="w-4 h-4 text-amber-400" />,
      badge: "Transport",
    },
    {
      label: "School Notices & Circulars",
      href: "/parent/messages",
      icon: <MessageSquare className="w-4 h-4 text-blue-400" />,
      badge: "Noticeboard",
    },
    {
      label: "Ward Attendance Calendar",
      href: "/parent/attendance",
      icon: <Calendar className="w-4 h-4 text-emerald-400" />,
      badge: "Attendance",
    },
    {
      label: "Report Cards & Marksheets",
      href: "/parent/documents",
      icon: <FileText className="w-4 h-4 text-purple-400" />,
      badge: "Academics",
    },
    {
      label: "Apply for Student Leave",
      href: "/parent/more/leave",
      icon: <Clock className="w-4 h-4 text-rose-400" />,
      badge: "Request",
    },
  ];

  const shortcuts = role === "TEACHER" ? teacherShortcuts : parentShortcuts;
  const filteredShortcuts = query.trim()
    ? shortcuts.filter((s) =>
        s.label.toLowerCase().includes(query.toLowerCase()) ||
        s.badge.toLowerCase().includes(query.toLowerCase())
      )
    : shortcuts;

  const accentBorder =
    role === "TEACHER"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : "border-indigo-500/40 bg-indigo-500/10 text-indigo-300";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label={`${role} Omnibox`} className="flex flex-col w-full h-full">
          {/* Header Input */}
          <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800 gap-3">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={
                role === "TEACHER"
                  ? "Search classes, marks entry, timetable, attendance (e.g. '10-A marks')..."
                  : "Search fees, bus location, notices, report cards (e.g. 'fees', 'route 4')..."
              }
              className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
              autoFocus
            />
            {isOffline && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
                <WifiOff className="w-3 h-3" />
                Offline
              </span>
            )}
          </div>

          <Command.List className="max-h-[360px] overflow-y-auto p-2 space-y-1">
            {/* Pinned High-Confidence Intent Row (AC-E1 / E6) */}
            {roleIntent && (
              <div className="mb-2">
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Direct Intent Action
                  </span>
                  <span className="text-[9px] font-normal text-slate-400">
                    {Math.round(roleIntent.confidenceScore * 100)}% match
                  </span>
                </div>
                <Command.Item
                  value={`intent-${roleIntent.actionLabel}-${roleIntent.route}`}
                  onSelect={() => handleSelect(roleIntent.route)}
                  className={cn(
                    "flex flex-col p-3 rounded-xl border cursor-pointer select-none transition-all",
                    accentBorder,
                    "hover:shadow-md"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 shrink-0 text-amber-400 animate-pulse" />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {roleIntent.actionLabel}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 bg-white/20 dark:bg-black/30 px-2 py-0.5 rounded-md">
                      Press ↵
                    </span>
                  </div>

                  {/* Entity Chips */}
                  {roleIntent.entityChips.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {roleIntent.entityChips
                        .filter((e) => e.type !== "ACTION_INTENT")
                        .map((e, i) => (
                          <span
                            key={i}
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md",
                              entityChipClass(e.type)
                            )}
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {e.normalized}
                          </span>
                        ))}
                    </div>
                  )}
                </Command.Item>
              </div>
            )}

            {/* Quick Navigation Items */}
            <Command.Group
              heading={
                <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {query.trim() ? "Matching Surfaces" : "Quick Actions"}
                </span>
              }
            >
              {filteredShortcuts.map((item, idx) => (
                <Command.Item
                  key={idx}
                  value={item.label}
                  onSelect={() => handleSelect(item.href)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition select-none"
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    {item.badge}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Empty className="p-6 text-center text-xs text-slate-400">
              No matching screens found.
            </Command.Empty>
          </Command.List>

          {/* Footer Strip */}
          <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">
                  ↵
                </kbd>{" "}
                Open
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">
                  Esc
                </kbd>{" "}
                Close
              </span>
            </div>
            {parsed && (
              <span className="text-[10px] text-slate-400 font-mono">
                parsed in {parsed.parseDurationMs}ms
              </span>
            )}
          </div>
        </Command>
      </div>
    </div>
  );
}
