"use client";

import React from "react";
import { Bell, ChevronRight, CheckCircle2, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentFeedCard } from "@/lib/studentEventEngine/types";

export interface NoticeCardProps {
  card: StudentFeedCard;
  locale?: string;
  onOpenDetail: (notice: any) => void;
}

export function NoticeCard({
  card,
  locale = "en",
  onOpenDetail,
}: NoticeCardProps) {
  const isHi = locale === "hi";
  const payload = card.payload || {};
  const isUrgent = card.tier === "T1_action_required";
  const isAcked = Boolean(payload.isAcknowledged);

  const titleStr = isHi && card.title.hi ? card.title.hi : card.title.en;
  const summaryStr = isHi && card.summary.hi ? card.summary.hi : card.summary.en;

  return (
    <div
      onClick={() => onOpenDetail(payload)}
      className={cn(
        "group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs",
        isUrgent
          ? "bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/30 hover:border-blue-500/50 hover:shadow-md hover:shadow-blue-500/5"
          : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-blue-500/40 hover:shadow-md hover:shadow-blue-500/5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
              isAcked
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
            )}
          >
            {isAcked ? <CheckCircle2 className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                {isHi ? "स्कूल सूचना" : "School Notice"}
              </span>
              {payload.requiresAcknowledgment && (
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                    isAcked
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  )}
                >
                  {isAcked
                    ? isHi
                      ? "स्वीकृत"
                      : "Acknowledged"
                    : isHi
                    ? "पावती आवश्यक"
                    : "Action Required"}
                </span>
              )}
              {payload.attachmentS3Key && (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <Paperclip className="w-3 h-3" />
                  <span>{isHi ? "परिपत्र" : "Circular"}</span>
                </span>
              )}
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
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
