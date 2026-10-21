"use client";

import React from "react";
import Link from "next/link";
import { MessageSquare, ArrowRight, Clock } from "lucide-react";
import { DerivedFeedCard } from "./FeedCard";

interface MessageCardProps {
  card: DerivedFeedCard;
  locale?: string;
}

export function MessageCard({ card, locale = "en" }: MessageCardProps) {
  const isHi = locale === "hi";
  const {
    threadId,
    teacherName = "Class Teacher",
    teacherAvatar = null,
    sentAt = new Date().toISOString(),
  } = card.payload || {};

  const initials = teacherName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sentTimeStr = new Date(sentAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-all"
      data-testid="message-card"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-3">
          {/* Teacher Avatar - Law L12 */}
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800 shadow-sm">
            {initials}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {teacherName}
              </h3>
              {card.wardName && (
                <span
                  data-testid="ward-chip"
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                >
                  {card.wardName}
                </span>
              )}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {isHi ? "नया संदेश" : "NEW MESSAGE"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{sentTimeStr}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic">
        &ldquo;{isHi ? card.summary.hi : card.summary.en}&rdquo;
      </div>

      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {isHi ? "सुरक्षित संचार" : "Secure direct conversation"}
        </span>

        <Link
          href={`/parent/messages${threadId ? `?thread=${threadId}` : ""}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{isHi ? "उत्तर दें" : "Reply to Teacher"}</span>
        </Link>
      </div>
    </div>
  );
}
