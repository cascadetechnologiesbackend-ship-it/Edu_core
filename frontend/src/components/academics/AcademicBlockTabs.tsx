"use client";

import React from "react";
import { LayoutGrid, Baby, School, BookOpen, GraduationCap } from "lucide-react";

export type AcademicBlockKey =
  | "all"
  | "pre_primary"
  | "primary"
  | "middle_school"
  | "high_school";

export interface AcademicBlockOption {
  key: AcademicBlockKey;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}

export const ACADEMIC_BLOCKS: AcademicBlockOption[] = [
  {
    key: "all",
    label: "All Blocks",
    sublabel: "Nursery – Class 10",
    icon: LayoutGrid,
  },
  {
    key: "pre_primary",
    label: "Pre-Primary",
    sublabel: "Nursery, LKG, UKG",
    icon: Baby,
  },
  {
    key: "primary",
    label: "Primary",
    sublabel: "Class 1 – Class 5",
    icon: School,
  },
  {
    key: "middle_school",
    label: "Middle School",
    sublabel: "Class 6 – Class 8",
    icon: BookOpen,
  },
  {
    key: "high_school",
    label: "High School",
    sublabel: "Class 9 – Class 10",
    icon: GraduationCap,
  },
];

/**
 * Utility helper to classify any classroom into one of the 4 structural blocks.
 */
export function getGradeBlock(gradeLevel: string, displayName: string = ""): AcademicBlockKey {
  const normGrade = (gradeLevel || "").toUpperCase();
  const normName = (displayName || "").toLowerCase();

  if (
    ["NURSERY", "LKG", "UKG"].includes(normGrade) ||
    /nursery|lkg|ukg|playgroup|pp1|pp2|pre-primary|pre primary/.test(normName)
  ) {
    return "pre_primary";
  }

  if (
    ["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4", "CLASS_5"].includes(normGrade) ||
    /class 1|class 2|class 3|class 4|class 5|grade 1|grade 2|grade 3|grade 4|grade 5|std 1|std 2|std 3|std 4|std 5/.test(normName)
  ) {
    return "primary";
  }

  if (
    ["CLASS_6", "CLASS_7", "CLASS_8"].includes(normGrade) ||
    /class 6|class 7|class 8|grade 6|grade 7|grade 8|std 6|std 7|std 8/.test(normName)
  ) {
    return "middle_school";
  }

  if (
    ["CLASS_9", "CLASS_10"].includes(normGrade) ||
    /class 9|class 10|grade 9|grade 10|std 9|std 10|high school|secondary/.test(normName)
  ) {
    return "high_school";
  }

  return "primary";
}

interface AcademicBlockTabsProps {
  activeBlock: AcademicBlockKey;
  onBlockChange: (block: AcademicBlockKey) => void;
  counts?: Record<AcademicBlockKey, number>;
  className?: string;
}

export default function AcademicBlockTabs({
  activeBlock,
  onBlockChange,
  counts,
  className = "",
}: AcademicBlockTabsProps) {
  return (
    <div className={`w-full bg-gray-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-gray-200/80 dark:border-slate-700/80 ${className}`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1">
        {ACADEMIC_BLOCKS.map((block) => {
          const Icon = block.icon;
          const isActive = activeBlock === block.key;
          const count = counts?.[block.key];

          return (
            <button
              key={block.key}
              type="button"
              onClick={() => onBlockChange(block.key)}
              className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 select-none ${
                isActive
                  ? "bg-white dark:bg-slate-900 text-primary shadow-sm shadow-black/5 border border-gray-200/60 dark:border-slate-700/60"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-900/40"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary dark:bg-primary/20"
                    : "bg-gray-200/60 dark:bg-slate-700/60 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 text-left min-w-0">
                <div className="truncate flex items-center justify-between gap-1">
                  <span className="truncate">{block.label}</span>
                  {typeof count === "number" && (
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full font-mono ${
                        isActive
                          ? "bg-primary/15 text-primary dark:bg-primary/30"
                          : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-medium text-gray-400 dark:text-gray-500 truncate">
                  {block.sublabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
