"use client";

import React from "react";
import { FileCheck2, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentFeedCard } from "@/lib/studentEventEngine/types";

export interface AssessmentCountdownCardProps {
  card: StudentFeedCard;
  locale?: string;
  onOpenDetail: (asmt: any) => void;
}

export function AssessmentCountdownCard({
  card,
  locale = "en",
  onOpenDetail,
}: AssessmentCountdownCardProps) {
  const isHi = locale === "hi";
  const payload = card.payload || {};
  const isUrgent = card.tier === "T1_action_required";

  const titleStr = isHi && card.title.hi ? card.title.hi : card.title.en;
  const summaryStr = isHi && card.summary.hi ? card.summary.hi : card.summary.en;

  return (
    <div
      onClick={() => onOpenDetail(payload)}
      className={cn(
        "group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs",
        isUrgent
          ? "bg-purple-500/5 dark:bg-purple-950/20 border-purple-500/30 hover:border-purple-500/50 hover:shadow-md hover:shadow-purple-500/5"
          : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-purple-500/40 hover:shadow-md hover:shadow-purple-500/5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
            <FileCheck2 className="w-5 h-5" />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                {payload.subjectName || "Exam"}
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  isUrgent
                    ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 animate-pulse"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                )}
              >
                {payload.countdown ? (isHi ? payload.countdown.hi : payload.countdown.en) : ""}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {payload.maxMarks ? `${payload.maxMarks} Marks` : ""}
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-1">
              {payload.title || titleStr}
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
