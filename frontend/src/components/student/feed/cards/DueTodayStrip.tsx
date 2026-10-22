"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle, Clock, Send, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentFeedCard } from "@/lib/studentEventEngine/types";
import { FeeHoldCard } from "./FeeHoldCard";

export interface DueTodayStripProps {
  pinnedCards: StudentFeedCard[];
  locale?: string;
  onOpenDetail: (payload: any) => void;
}

export function DueTodayStrip({
  pinnedCards,
  locale = "en",
  onOpenDetail,
}: DueTodayStripProps) {
  if (!pinnedCards || pinnedCards.length === 0) return null;

  const isHi = locale === "hi";

  return (
    <div
      data-testid="due-today-strip"
      className="space-y-3 p-4 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 dark:via-amber-950/15 border border-amber-500/25 shadow-sm"
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
          <Clock className="w-4 h-4 animate-pulse" />
          <span>{isHi ? "आज के जरूरी कार्य (Due Today)" : "Due Today"}</span>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
          {pinnedCards.length} {isHi ? "कार्य" : pinnedCards.length === 1 ? "Item" : "Items"}
        </span>
      </div>

      <div className="space-y-2.5">
        {pinnedCards.map((card) => {
          if (card.cardType === "FeeHoldWarning") {
            return <FeeHoldCard key={card.id} card={card} locale={locale} />;
          }

          const payload = card.payload || {};
          const titleStr = isHi && card.title.hi ? card.title.hi : card.title.en;

          return (
            <div
              key={card.id}
              onClick={() => onOpenDetail(payload)}
              className="group p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 hover:border-amber-500/60 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    {payload.subjectName || "Homework"}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                    {isHi ? "आज देय है" : "Due today"}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-1">
                  {payload.title || titleStr}
                </h4>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {isHi && card.summary.hi ? card.summary.hi : card.summary.en}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Link
                  href={`/student/homework?id=${payload.homeworkId}&action=submit`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition"
                >
                  <Send className="w-3 h-3" />
                  <span>{isHi ? "जमा करें" : "Submit"}</span>
                </Link>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
