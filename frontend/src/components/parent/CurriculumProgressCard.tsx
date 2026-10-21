"use client";

import React from "react";
import {
  ChevronRight,
  GraduationCap,
  TrendingUp,
} from "lucide-react";
import type { DerivedFeedCard } from "@/lib/parentEventEngine/types";

export interface CurriculumProgressCardProps {
  card: DerivedFeedCard;
  locale?: string;
  onOpenDetail?: (payload: any) => void;
}

export function CurriculumProgressCard({
  card,
  locale = "en",
  onOpenDetail,
}: CurriculumProgressCardProps) {
  const isHi = locale === "hi";
  const {
    termName,
    averageProgress = 0,
    subjects = [],
  } = card.payload || {};

  const handleCardClick = () => {
    if (onOpenDetail) {
      onOpenDetail({
        termName,
        subjects: subjects.map((sub: any) => ({
          subjectId: sub.subjectId,
          subjectName: sub.subjectName,
          completedTopicsCount: sub.completedTopicsCount || 0,
          totalTopicsCount: sub.totalTopicsCount || 0,
          progressPercent: sub.progressPercent || 0,
          units: [],
        })),
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
      data-testid="curriculum-progress-card"
      className="group w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
    >
      <div className="h-1.5 w-full bg-linear-to-r from-indigo-500 to-sky-500" />

      <div className="p-4 sm:p-5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{isHi ? "पाठ्यक्रम प्रगति" : "Curriculum Progress"}</span>
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

          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
            {averageProgress}% {isHi ? "औसत" : "Avg"}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {isHi ? card.title.hi : card.title.en}
        </h3>

        {/* Progress Bars Per Subject */}
        <div className="space-y-2.5 pt-1">
          {subjects && subjects.length > 0 ? (
            subjects.map((sub: any) => (
              <div key={sub.subjectId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {sub.subjectName}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    {sub.completedTopicsCount}/{sub.totalTopicsCount}{" "}
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 ml-1">
                      {sub.progressPercent}%
                    </span>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-indigo-500 to-sky-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, sub.progressPercent || 0))}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isHi ? card.summary.hi : card.summary.en}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <span className="text-[11px] text-slate-400">
            {termName || (isHi ? "सत्र प्रगति" : "Term Progress")}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
            <span>{isHi ? "विस्तृत रिपोर्ट देखें" : "View Details"}</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
