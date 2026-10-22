"use client";

import React from "react";
import { Award, ChevronRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentFeedCard } from "@/lib/studentEventEngine/types";

export interface MarksPublishedCardProps {
  card: StudentFeedCard;
  locale?: string;
  onOpenDetail: (marks: any) => void;
}

export function MarksPublishedCard({
  card,
  locale = "en",
  onOpenDetail,
}: MarksPublishedCardProps) {
  const isHi = locale === "hi";
  const payload = card.payload || {};

  const titleStr = isHi && card.title.hi ? card.title.hi : card.title.en;
  const summaryStr = isHi && card.summary.hi ? card.summary.hi : card.summary.en;

  return (
    <div
      onClick={() => onOpenDetail(payload)}
      className="group relative p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/30 dark:via-emerald-950/15 border border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-200 cursor-pointer shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
            <Award className="w-5 h-5" />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {isHi ? "परीक्षा परिणाम" : "Exam Results"}
              </span>
              {payload.overallGrade && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Grade {payload.overallGrade}
                </span>
              )}
              {payload.percentage !== null && payload.percentage !== undefined && (
                <span className="text-[10px] font-semibold text-slate-500">
                  {payload.percentage}%
                </span>
              )}
              {payload.rank && (
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                  Rank #{payload.rank}
                </span>
              )}
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
              {payload.examName || titleStr}
            </h4>

            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
              {summaryStr}
            </p>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-emerald-500 self-center shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
}
