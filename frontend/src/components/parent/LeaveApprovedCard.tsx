"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, Calendar, FileText, ArrowRight } from "lucide-react";
import { DerivedFeedCard } from "./FeedCard";

interface LeaveApprovedCardProps {
  card: DerivedFeedCard;
  studentName?: string;
  locale?: string;
}

export function LeaveApprovedCard({
  card,
  studentName = "Your child",
  locale = "en",
}: LeaveApprovedCardProps) {
  const isHi = locale === "hi";
  const {
    requestId,
    leaveType = "LEAVE",
    startDate,
    endDate,
    decisionNote = null,
  } = card.payload || {};

  const borderClass =
    "border-l-4 border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50";
  const chipClass =
    "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition-all ${borderClass}`}
      data-testid="leave-approved-card"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800 shadow-sm">
            <CheckCircle2 className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isHi ? card.title.hi : card.title.en}
              </h3>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${chipClass}`}
              >
                {isHi ? "स्वीकृत" : "Approved"}
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

      {/* Teacher note if provided */}
      {decisionNote && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 italic">
          <span className="font-semibold text-slate-700 dark:text-slate-300 not-italic">
            {isHi ? "शिक्षक टिप्पणी: " : "Teacher Note: "}
          </span>
          &ldquo;{decisionNote}&rdquo;
        </div>
      )}

      {/* Action link */}
      <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {isHi
            ? "स्वीकृत अवकाश के दिनों में उपस्थिति पर अनुपस्थिति की चेतावनी नहीं भेजी जाएगी।"
            : "Absence alerts are suppressed for approved leave dates."}
        </span>
        <Link
          href="/parent/more/leave"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all focus:ring-2 focus:ring-emerald-500/20"
        >
          <span>{isHi ? "विवरण देखें" : "View Details"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
