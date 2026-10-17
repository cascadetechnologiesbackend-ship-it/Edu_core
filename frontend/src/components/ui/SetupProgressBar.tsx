"use client";

import React from "react";
import Link from "next/link";
import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type DotStatus = "done" | "partial" | "empty";

export interface SetupProgressState {
  sections: DotStatus | boolean;
  subjects: DotStatus | boolean;
  teachers: DotStatus | boolean;
  timetable: DotStatus | boolean;
}

export interface SetupProgressBarProps {
  classId?: string | undefined;
  progress: SetupProgressState;
  variant?: ("full" | "mini") | undefined;
  onSelectTab?: ((tabKey: string) => void) | undefined;
  className?: string | undefined;
}

interface StepConfig {
  key: keyof SetupProgressState;
  tab: string;
  label: string;
}

const STEPS: StepConfig[] = [
  { key: "sections", tab: "sections", label: "Sections" },
  { key: "subjects", tab: "subjects", label: "Subjects" },
  { key: "teachers", tab: "subjects", label: "Teachers" }, // Maps to subject mapping / teacher assignment
  { key: "timetable", tab: "timetable", label: "Timetable" },
];

function normalizeStatus(value: DotStatus | boolean | undefined): DotStatus {
  if (value === true || value === "done") return "done";
  if (value === "partial") return "partial";
  return "empty";
}

export function SetupProgressBar({
  classId,
  progress,
  variant = "full",
  onSelectTab,
  className,
}: SetupProgressBarProps) {
  if (variant === "mini") {
    // 4-dot compact indicator for cards
    return (
      <div className={cn("inline-flex items-center gap-1.5", className)} title="Setup status: Sections, Subjects, Teachers, Timetable">
        {STEPS.map((step) => {
          const status = normalizeStatus(progress[step.key]);
          return (
            <span
              key={step.key}
              className={cn(
                "w-2 h-2 rounded-full transition-colors duration-150",
                status === "done" && "bg-emerald-500 shadow-xs shadow-emerald-500/30",
                status === "partial" && "bg-amber-500 shadow-xs shadow-amber-500/30",
                status === "empty" && "bg-gray-200 dark:bg-slate-700"
              )}
              title={`${step.label}: ${status}`}
            />
          );
        })}
      </div>
    );
  }

  // Full interactive bar for ClassHub and header cards
  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-3 bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 rounded-2xl p-2.5 sm:px-4 sm:py-2.5 shadow-xs overflow-x-auto",
        className
      )}
    >
      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 shrink-0 mr-1">
        Setup Progress
      </span>

      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        {STEPS.map((step, idx) => {
          const status = normalizeStatus(progress[step.key]);

          const chipContent = (
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all duration-150 border cursor-pointer select-none whitespace-nowrap min-h-[30px]",
                status === "done" &&
                  "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
                status === "partial" &&
                  "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40",
                status === "empty" &&
                  "bg-gray-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
              )}
            >
              <span
                className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                  status === "done" && "bg-emerald-500 text-white",
                  status === "partial" && "bg-amber-500 text-white",
                  status === "empty" && "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400"
                )}
              >
                {status === "done" ? (
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                ) : status === "partial" ? (
                  <AlertCircle className="w-2.5 h-2.5 stroke-[2.5]" />
                ) : (
                  idx + 1
                )}
              </span>
              <span>{step.label}</span>
            </div>
          );

          if (classId) {
            return (
              <Link
                key={step.key}
                href={`/academics/classes/${classId}?tab=${step.tab}`}
                onClick={() => onSelectTab?.(step.tab)}
              >
                {chipContent}
              </Link>
            );
          }

          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onSelectTab?.(step.tab)}
            >
              {chipContent}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SetupProgressBar;
