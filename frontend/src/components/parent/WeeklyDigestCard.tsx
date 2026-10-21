"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  CalendarCheck,
  FileCheck,
  CreditCard,
  Calendar,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { DerivedFeedCard } from "./FeedCard";

interface WeeklyDigestCardProps {
  card: DerivedFeedCard;
  studentName?: string;
  locale?: string;
}

export function WeeklyDigestCard({
  card,
  studentName,
  locale = "en",
}: WeeklyDigestCardProps) {
  const isHi = locale === "hi";
  const {
    weekLabel = "Last Week",
    attendanceDays = 0,
    totalSchoolDays = 5,
    homeworkGradedCount = 0,
    feesStatus = "UP_TO_DATE",
    balanceAmount = 0,
    upcomingEventsCount = 0,
    upcomingEventSummary = "",
  } = card.payload || {};

  const isAttendancePerfect = attendanceDays >= totalSchoolDays && totalSchoolDays > 0;
  const isFeesClear = feesStatus === "UP_TO_DATE";

  return (
    <div
      className="rounded-2xl border border-indigo-100 dark:border-indigo-950/70 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/30 dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900/60 p-4 sm:p-5 shadow-sm transition-all"
      data-testid="weekly-digest-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isHi ? card.title.hi : card.title.en}
              </h3>
              {card.wardName && (
                <span
                  data-testid="ward-chip"
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                >
                  {card.wardName}
                </span>
              )}
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                DIGEST
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {studentName ? `${studentName} • ` : ""}
              {weekLabel}
            </p>
          </div>
        </div>
      </div>

      {/* 4 Metric Highlights Grid */}
      <div className="grid grid-cols-2 gap-2.5 my-3">
        {/* Metric 1: Attendance */}
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-800/50 p-2.5 sm:p-3">
          <div className="flex items-center gap-2">
            <CalendarCheck
              className={`w-4 h-4 ${
                isAttendancePerfect ? "text-emerald-500" : "text-amber-500"
              }`}
            />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isHi ? "उपस्थिति" : "Attendance"}
            </span>
          </div>
          <div className="mt-1 font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
            {attendanceDays}/{totalSchoolDays}{" "}
            <span className="text-[11px] font-normal text-slate-400">
              {isHi ? "दिन उपस्थित" : "days present"}
            </span>
          </div>
        </div>

        {/* Metric 2: Homework Graded */}
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-800/50 p-2.5 sm:p-3">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-500" />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isHi ? "गृहकार्य" : "Homework"}
            </span>
          </div>
          <div className="mt-1 font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
            {homeworkGradedCount}{" "}
            <span className="text-[11px] font-normal text-slate-400">
              {isHi ? "जांचे गए" : "graded"}
            </span>
          </div>
        </div>

        {/* Metric 3: Fees Status */}
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-800/50 p-2.5 sm:p-3">
          <div className="flex items-center gap-2">
            <CreditCard
              className={`w-4 h-4 ${
                isFeesClear ? "text-emerald-500" : "text-amber-500"
              }`}
            />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isHi ? "शुल्क स्थिति" : "Fees Status"}
            </span>
          </div>
          <div className="mt-1 font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
            {isFeesClear ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                {isHi ? "पूर्ण चुकता" : "All Clear"}
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">
                {balanceAmount > 0
                  ? `₹${balanceAmount.toLocaleString("en-IN")}`
                  : isHi
                  ? "देय है"
                  : "Due Soon"}
              </span>
            )}
          </div>
        </div>

        {/* Metric 4: Upcoming Schedule */}
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-800/50 p-2.5 sm:p-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-500" />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isHi ? "आगामी" : "This Week"}
            </span>
          </div>
          <div className="mt-1 font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
            {upcomingEventSummary ||
              (upcomingEventsCount > 0
                ? isHi
                  ? `${upcomingEventsCount} कार्यक्रम`
                  : `${upcomingEventsCount} events scheduled`
                : isHi
                ? "नियमित कक्षाएं"
                : "Regular schedule")}
          </div>
        </div>
      </div>

      {/* Footer link to Profile Records */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          {isHi ? "सोमवार साप्ताहिक बुलेटिन" : "Monday Weekly Bulletin"}
        </span>

        <Link
          href="/parent/profile"
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
        >
          <span>{isHi ? "पूरा रिकॉर्ड देखें" : "View Full Records"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
