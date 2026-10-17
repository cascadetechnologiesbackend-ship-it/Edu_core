"use client";

import React from "react";
import Link from "next/link";
import { Bell, Pin, Clock, ArrowRight } from "lucide-react";
import { DerivedFeedCard } from "./FeedCard";

interface NoticeCardProps {
  card: DerivedFeedCard;
  locale?: string;
}

export function NoticeCard({ card, locale = "en" }: NoticeCardProps) {
  const isHi = locale === "hi";
  const {
    noticeId,
    title = "Official School Notice",
    contentPreview = "",
    isPinned = false,
    publishedAt = new Date().toISOString(),
  } = card.payload || {};

  const publishedDate = new Date(publishedAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-all ${
        isPinned
          ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10"
          : "border-slate-200 dark:border-slate-800"
      }`}
      data-testid="notice-card"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isPinned
                ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            }`}
          >
            {isPinned ? <Pin className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isHi ? card.title.hi : card.title.en}
              </h3>
              {isPinned && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  <Pin className="w-2.5 h-2.5" />
                  PINNED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{publishedDate}</span>
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-2 leading-relaxed">
        {contentPreview || (isHi ? card.summary.hi : card.summary.en)}
      </p>

      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          {isHi ? "प्रशासनिक सूचना" : "Official Circular"}
        </span>

        <Link
          href={`/parent/more?tab=notices&id=${noticeId || card.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          <span>{isHi ? "पूरी सूचना पढ़ें" : "Read Full Notice"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
