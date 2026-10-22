"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  Clock,
  CheckCircle2,
  Award,
  ChevronRight,
  Paperclip,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentFeedCard } from "@/lib/studentEventEngine/types";

export interface HomeworkDueCardProps {
  card: StudentFeedCard;
  locale?: string;
  onOpenDetail: (hw: any) => void;
}

export function HomeworkDueCard({
  card,
  locale = "en",
  onOpenDetail,
}: HomeworkDueCardProps) {
  const isHi = locale === "hi";
  const payload = card.payload || {};
  const isSubmitted = Boolean(payload.isSubmitted);
  const isGraded = payload.submission?.marksAwarded !== null && payload.submission?.marksAwarded !== undefined;
  const marksAwarded = payload.submission?.marksAwarded;
  const isUrgent = card.tier === "T1_action_required";

  const titleStr = isHi && card.title.hi ? card.title.hi : card.title.en;
  const summaryStr = isHi && card.summary.hi ? card.summary.hi : card.summary.en;

  return (
    <div
      onClick={() => onOpenDetail(payload)}
      className={cn(
        "group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs",
        isUrgent
          ? "bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50 hover:shadow-md hover:shadow-amber-500/5"
          : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/40 hover:shadow-md hover:shadow-indigo-500/5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
              isGraded
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : isSubmitted
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : isUrgent
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            )}
          >
            {isGraded ? (
              <Award className="w-5 h-5" />
            ) : isSubmitted ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {payload.subjectName || "Homework"}
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                  isGraded
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : isSubmitted
                    ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                    : isUrgent
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                )}
              >
                {payload.dueBadge ? (isHi ? payload.dueBadge.hi : payload.dueBadge.en) : ""}
              </span>
              {payload.attachmentS3Key && (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <Paperclip className="w-3 h-3" />
                  <span>{isHi ? "फ़ाइल" : "File"}</span>
                </span>
              )}
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
              {payload.title || titleStr}
            </h4>

            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
              {summaryStr}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 self-center">
          {!isSubmitted && (
            <Link
              href={`/student/homework?id=${payload.homeworkId}&action=submit`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition"
            >
              <Send className="w-3 h-3" />
              <span>{isHi ? "जमा करें" : "Submit"}</span>
            </Link>
          )}
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
}
