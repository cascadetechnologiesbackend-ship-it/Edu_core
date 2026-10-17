"use client";

import React from "react";
import Link from "next/link";
import { CalendarCheck, MessageSquare, AlertCircle, Clock } from "lucide-react";
import { DerivedFeedCard } from "./FeedCard";

interface AttendanceCardProps {
  card: DerivedFeedCard;
  studentName?: string;
  locale?: string;
}

export function AttendanceCard({
  card,
  studentName = "Your child",
  locale = "en",
}: AttendanceCardProps) {
  const isHi = locale === "hi";
  const {
    status = "ABSENT",
    severity = "ROSE",
    markedAt = new Date().toISOString(),
    remarks = null,
  } = card.payload || {};

  const isAbsent = status === "ABSENT";
  const borderClass = isAbsent
    ? "border-l-4 border-l-rose-500 bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
    : "border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50";

  const chipClass = isAbsent
    ? "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
    : "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800";

  // Derive initial avatar initials
  const initials = studentName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const markedTimeStr = new Date(markedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition-all ${borderClass}`}
      data-testid="attendance-card"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-3">
          {/* Avatar with deterministic tone per Law L12 */}
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center justify-center shrink-0 border border-white dark:border-slate-800 shadow-sm">
            {initials}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isHi ? card.title.hi : card.title.en}
              </h3>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${chipClass}`}
              >
                {status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>
                {isHi ? `दर्ज समय: ${markedTimeStr}` : `Marked at ${markedTimeStr}`}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Main explanation line */}
      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
        {isHi ? card.summary.hi : card.summary.en}
      </p>

      {/* Teacher remark if provided */}
      {remarks && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 italic">
          <span className="font-semibold text-slate-700 dark:text-slate-300 not-italic">
            {isHi ? "शिक्षक टिप्पणी: " : "Teacher Remark: "}
          </span>
          &ldquo;{remarks}&rdquo;
        </div>
      )}

      {/* Secondary Action: Message Class Teacher (Click budget: 3 clicks) */}
      <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {isHi ? "यदि कोई प्रश्न है तो शिक्षक से संपर्क करें" : "Have a question? Reach out to the teacher."}
        </span>

        <Link
          href={`/parent/messages?reason=attendance&student=${card.studentId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold shadow-sm transition-colors shrink-0"
        >
          <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
          <span>{isHi ? "कक्षा शिक्षक को संदेश भेजें" : "Message class teacher"}</span>
        </Link>
      </div>
    </div>
  );
}
