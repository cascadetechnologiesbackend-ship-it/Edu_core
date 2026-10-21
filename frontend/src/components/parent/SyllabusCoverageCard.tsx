"use client";

import React from "react";
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  Layers,
  Sparkles,
} from "lucide-react";
import type { DerivedFeedCard } from "@/lib/parentEventEngine/types";

export interface SyllabusCoverageCardProps {
  card: DerivedFeedCard;
  locale?: string;
  onOpenDetail?: (payload: any) => void;
}

export function SyllabusCoverageCard({
  card,
  locale = "en",
  onOpenDetail,
}: SyllabusCoverageCardProps) {
  const isHi = locale === "hi";
  const {
    termName,
    coverageList = [],
    weekLabel,
  } = card.payload || {};

  const handleCardClick = () => {
    if (onOpenDetail) {
      onOpenDetail({
        termName,
        subjects: coverageList.map((c: any) => ({
          subjectId: c.subjectId,
          subjectName: c.subjectName,
          completedTopicsCount: 1,
          totalTopicsCount: 1,
          progressPercent: 100,
          units: [
            {
              unitNumber: c.unitNumber || 1,
              title: c.unitTitle || (isHi ? "इकाई" : "Unit"),
              chapters: [
                {
                  chapterNumber: c.chapterNumber || 1,
                  title: c.chapterTitle || (isHi ? "अध्याय" : "Chapter"),
                  topics: [
                    {
                      id: `top-${c.subjectId}`,
                      topicNumber: 1,
                      title: c.topicTitle || (isHi ? "विषय" : "Topic"),
                      isTaught: true,
                    },
                  ],
                },
              ],
            },
          ],
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
      data-testid="syllabus-coverage-card"
      className="group w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
    >
      <div className="h-1.5 w-full bg-linear-to-r from-purple-500 to-indigo-600" />

      <div className="p-4 sm:p-5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isHi ? "साप्ताहिक पाठ्यक्रम कवरेज" : "Weekly Syllabus Digest"}</span>
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

          <span className="text-[11px] font-medium text-slate-400">
            {weekLabel || (isHi ? "यह सप्ताह" : "This Week")}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
          {isHi ? card.title.hi : card.title.en}
        </h3>

        {/* Coverage List items */}
        <div className="space-y-2">
          {coverageList && coverageList.length > 0 ? (
            coverageList.map((item: any, idx: number) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5 text-xs"
              >
                <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    {item.subjectName}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                    {item.chapterTitle ? `${item.chapterTitle} • ` : ""}
                    {item.topicTitle}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {isHi ? card.summary.hi : card.summary.en}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <span className="text-[11px] text-slate-400">
            {termName || (isHi ? "सत्र प्रगति" : "Term Progress")}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 font-medium">
            <span>{isHi ? "पूरा पाठ्यक्रम देखें" : "View Full Syllabus"}</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
