"use client";

import React from "react";
import { BookOpen, ChevronRight, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentFeedCard } from "@/lib/studentEventEngine/types";

export interface ClassworkRecapCardProps {
  card: StudentFeedCard;
  locale?: string;
  onOpenDetail: (cw: any) => void;
}

export function ClassworkRecapCard({
  card,
  locale = "en",
  onOpenDetail,
}: ClassworkRecapCardProps) {
  const isHi = locale === "hi";
  const payload = card.payload || {};

  const titleStr = isHi && card.title.hi ? card.title.hi : card.title.en;
  const summaryStr = isHi && card.summary.hi ? card.summary.hi : card.summary.en;

  return (
    <div
      onClick={() => onOpenDetail(payload)}
      className="group relative p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-teal-500/40 hover:shadow-md hover:shadow-teal-500/5 transition-all duration-200 cursor-pointer shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
            <BookOpen className="w-5 h-5" />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                {payload.subjectName || "Classwork"}
              </span>
              {payload.chapterName && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 truncate max-w-[160px]">
                  {payload.chapterName}
                </span>
              )}
              {payload.homework && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  <BookmarkCheck className="w-3 h-3" />
                  <span>{isHi ? "गृहकार्य दिया" : "HW Assigned"}</span>
                </span>
              )}
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-1">
              {payload.topicTitle || titleStr}
            </h4>

            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
              {summaryStr}
            </p>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-slate-400 self-center shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
}
