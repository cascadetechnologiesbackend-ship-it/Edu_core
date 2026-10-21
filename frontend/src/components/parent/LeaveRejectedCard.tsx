"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle, Calendar, ArrowRight, RotateCcw } from "lucide-react";
import { DerivedFeedCard } from "./FeedCard";

interface LeaveRejectedCardProps {
  card: DerivedFeedCard;
  studentName?: string;
  locale?: string;
}

export function LeaveRejectedCard({
  card,
  studentName = "Your child",
  locale = "en",
}: LeaveRejectedCardProps) {
  const isHi = locale === "hi";
  const {
    requestId,
    leaveType = "LEAVE",
    startDate,
    endDate,
    decisionNote = null,
  } = card.payload || {};

  const borderClass =
    "border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50";
  const chipClass =
    "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800";

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition-all ${borderClass}`}
      data-testid="leave-rejected-card"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800 shadow-sm">
            <AlertCircle className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isHi ? card.title.hi : card.title.en}
              </h3>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${chipClass}`}
              >
                {isHi ? "अस्वीकृत" : "Rejected"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>
                {startDate === endDate ? startDate : `${startDate} → ${endDate}`} ({leaveType})
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Main explanation line */}
      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
        {isHi ? card.summary.hi : card.summary.en}
      </p>

      {/* Teacher rejection reason */}
      {decisionNote && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200/80 dark:border-amber-900/40 text-xs text-slate-700 dark:text-slate-300">
          <span className="font-semibold text-amber-800 dark:text-amber-300">
            {isHi ? "अस्वीकृति का कारण: " : "Reason for rejection: "}
          </span>
          &ldquo;{decisionNote}&rdquo;
        </div>
      )}

      {/* Action link */}
      <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {isHi
            ? "सामान्य उपस्थिति नियम लागू होंगे।"
            : "Standard attendance rules will apply for these dates."}
        </span>
        <Link
          href="/parent/more/leave"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold shadow-sm transition-all focus:ring-2 focus:ring-slate-500/20"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{isHi ? "पुनः आवेदन / विवरण" : "Re-apply / Details"}</span>
        </Link>
      </div>
    </div>
  );
}
