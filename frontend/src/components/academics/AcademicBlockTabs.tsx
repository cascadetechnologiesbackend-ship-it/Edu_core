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
    label: "Higher Primary",
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
 * Canonical educational sorting helper.
 * Strictly orders: Pre-Primary (Nursery, LKG, UKG) -> Primary (1-5) -> Higher Primary (6-8) -> High School (9-10) -> Senior Secondary (11-12).
 */
export function getCanonicalSortOrder(gradeLevel: string, displayName: string = ""): number {
  const norm = (gradeLevel || "").toUpperCase().trim();
  const nameNorm = (displayName || "").toLowerCase().trim();

  // 1. Pre-Primary / Foundational
  if (norm === "PLAYGROUP" || /playgroup|pg\b/.test(nameNorm)) return 1;
  if (norm === "PRE_KG" || /pre-kg|prekg/.test(nameNorm)) return 2;
  if (norm === "NURSERY" || /nursery/.test(nameNorm)) return 3;
  if (norm === "LKG" || /lkg|pp1\b|kindergarten 1|kg 1/.test(nameNorm)) return 4;
  if (norm === "UKG" || /ukg|pp2\b|kindergarten 2|kg 2/.test(nameNorm)) return 5;

  // 2. Numerical classes (Class 1 to 12) with word boundary check
  const numMatch = nameNorm.match(/\b(?:class|grade|std|standard)?\s*(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (numMatch && numMatch[1]) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 12) {
      return 10 + n;
    }
  }

  // 3. Fallback by gradeLevel enum
  const gradeLevelOrder: Record<string, number> = {
    PLAYGROUP: 1,
    PRE_KG: 2,
    NURSERY: 3,
    LKG: 4,
    UKG: 5,
    CLASS_1: 11,
    CLASS_2: 12,
    CLASS_3: 13,
    CLASS_4: 14,
    CLASS_5: 15,
    CLASS_6: 16,
    CLASS_7: 17,
    CLASS_8: 18,
    CLASS_9: 19,
    CLASS_10: 20,
    CLASS_11: 21,
    CLASS_12: 22,
  };

  if (gradeLevelOrder[norm]) {
    return gradeLevelOrder[norm];
  }

  return 99;
}

/**
 * Utility helper to classify any classroom into one of the structural blocks.
 * Uses exact standard number parsing with word boundaries to prevent 'Class 10' matching 'Class 1'.
 */
export function getGradeBlock(gradeLevel: string, displayName: string = ""): AcademicBlockKey {
  const normGrade = (gradeLevel || "").toUpperCase().trim();
  const normName = (displayName || "").toLowerCase().trim();

  // 1. Exact gradeLevel enum checks
  if (["NURSERY", "LKG", "UKG", "PRE_KG", "PLAYGROUP"].includes(normGrade)) {
    return "pre_primary";
  }
  if (["CLASS_9", "CLASS_10", "GRADE_9", "GRADE_10"].includes(normGrade)) {
    return "high_school";
  }
  if (["CLASS_6", "CLASS_7", "CLASS_8", "GRADE_6", "GRADE_7", "GRADE_8"].includes(normGrade)) {
    return "middle_school"; // Higher Primary
  }
  if (
    ["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4", "CLASS_5", "GRADE_1", "GRADE_2", "GRADE_3", "GRADE_4", "GRADE_5"].includes(
      normGrade,
    )
  ) {
    return "primary";
  }

  // 2. Pre-primary text detection
  if (/nursery|lkg|ukg|playgroup|pre-kg|prekg|pp1\b|pp2\b|pre-primary|pre primary|foundational/.test(normName)) {
    return "pre_primary";
  }

  // 3. Extract exact integer standard from display name with word boundaries
  const numMatch = normName.match(/\b(?:class|grade|std|standard)?\s*(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (numMatch && numMatch[1]) {
    const num = parseInt(numMatch[1], 10);
    if (num >= 9 && num <= 10) return "high_school";
    if (num >= 6 && num <= 8) return "middle_school"; // Higher Primary
    if (num >= 1 && num <= 5) return "primary";
  }

  // 4. Semantic textual fallback
  if (/high school|secondary|highschool/.test(normName)) return "high_school";
  if (/higher primary|middle school|upper primary|middle/.test(normName)) return "middle_school";
  if (/primary|lower primary/.test(normName)) return "primary";

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
