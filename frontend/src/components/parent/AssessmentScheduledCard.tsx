"use client";

import React from "react";
import {
  Calendar,
  Award,
  BookOpen,
  ChevronRight,
  Clock,
  Sparkles,
} from "lucide-react";
import type { DerivedFeedCard } from "@/lib/parentEventEngine/types";
import { cn } from "@/lib/utils";

export interface AssessmentScheduledCardProps {
  card: DerivedFeedCard;
  locale?: string;
  onOpenDetail?: (payload: any) => void;
}

export function AssessmentScheduledCard({
  card,
  locale = "en",
  onOpenDetail,
}: AssessmentScheduledCardProps) {
  const isHi = locale === "hi";
  const {
    assessmentId,
    title = "Assessment",
    subjectName = "Academics",
    assessmentType = "UNIT_TEST",
    scheduledDate = new Date().toISOString(),
    maxMarks = 50,
    syllabusCoverage = null,
    status = "SCHEDULED",
  } = card.payload || {};

  const typeDisplay = assessmentType.replace(/_/g, " ");
  const dateObj = new Date(scheduledDate);
  const formattedDate = dateObj.toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const handleCardClick = () => {
    if (onOpenDetail) {
      onOpenDetail({
        id: assessmentId || card.id,
        title,
        subjectName,
        assessmentType,
        scheduledDate,
        maxMarks,
        syllabusCoverage,
        status,
      });
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      data-testid="assessment-scheduled-card"
      className="group w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/40"
    >
      <div className="h-1.5 w-full bg-linear-to-r from-purple-500 to-pink-500" />

      <div className="p-4 sm:p-5 space-y-3">
        {/* Top Header: Subject + Ward Chip + Assessment Type Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 truncate">
              {subjectName}
            </span>
            {card.wardName && (
              <span
                data-testid="ward-chip"
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
              >
                {card.wardName}
              </span>
            )}
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800/60 capitalize">
            {typeDisplay}
          </span>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-purple-500" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">{formattedDate}</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
              <Award className="w-3.5 h-3.5" />
              {maxMarks} {isHi ? "अंक" : "Marks"}
            </span>
          </div>
        </div>

        {/* Syllabus Coverage Snippet */}
        {syllabusCoverage && (
          <div className="p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 text-xs text-slate-700 dark:text-slate-300">
            <span className="font-bold text-purple-950 dark:text-purple-200">
              {isHi ? "पाठ्यक्रम: " : "Coverage: "}
            </span>
            <span className="line-clamp-1">{syllabusCoverage}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <span className="text-[11px] text-slate-400">
            {isHi ? "आगामी मूल्यांकन" : "Upcoming Assessment"}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 font-medium">
            <span>{isHi ? "विवरण देखें" : "View Details"}</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
