"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Calendar, CheckCircle2, Clock, FileText, ArrowRight } from "lucide-react";
import { DerivedFeedCard } from "./FeedCard";

interface HomeworkCardProps {
  card: DerivedFeedCard;
  locale?: string;
}

const HOMEWORK_STEPS = [
  { key: "ASSIGNED", labelEn: "Assigned", labelHi: "आवंटित" },
  { key: "SUBMITTED", labelEn: "Submitted", labelHi: "जमा किया" },
  { key: "GRADED", labelEn: "Checked", labelHi: "जाँचा गया" },
];

export function HomeworkCard({ card, locale = "en" }: HomeworkCardProps) {
  const isHi = locale === "hi";
  const {
    homeworkId,
    title = "Homework Assignment",
    subjectName = "Academics",
    dueDate = new Date().toISOString(),
    isSubmitted = false,
    grade = null,
    feedback = null,
    hoursUntilDue = 24,
  } = card.payload || {};

  const isGraded = !!grade;
  const isPending = !isSubmitted;

  // Derive step
  const activeStepIdx = isGraded ? 2 : isSubmitted ? 1 : 0;

  // Determine countdown / status chip
  let chipText = isHi ? "जल्द देय" : "Due Soon";
  let chipColor = "bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";

  if (isGraded) {
    chipText = `${isHi ? "ग्रेड: " : "Grade: "}${grade}`;
    chipColor = "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
  } else if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
    chipText = isHi ? "कल देय" : "Due Tomorrow";
    chipColor = "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800";
  } else if (hoursUntilDue <= 0) {
    chipText = isHi ? "अतिदेय" : "Overdue";
    chipColor = "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800";
  }

  const dueDateFormatted = new Date(dueDate).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-all"
      data-testid="homework-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <BookOpen className="w-5 h-5" />
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
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${chipColor}`}
              >
                {chipText}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>
                {subjectName} &bull; {isHi ? `देय तिथि: ${dueDateFormatted}` : `Due: ${dueDateFormatted}`}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Summary copy */}
      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
        {isHi ? card.summary.hi : card.summary.en}
      </p>

      {/* Teacher feedback if graded */}
      {feedback && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300">
          <span className="font-semibold">{isHi ? "शिक्षक प्रतिक्रिया: " : "Teacher Feedback: "}</span>
          &ldquo;{feedback}&rdquo;
        </div>
      )}

      {/* Micro-Progress Bar: Assigned -> Submitted -> Checked */}
      <div className="my-3 pt-2">
        <div className="relative flex items-center justify-between">
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-slate-100 dark:bg-slate-800 -z-0" />
          <div
            className="absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-blue-500 transition-all duration-300 -z-0"
            style={{ width: `${(activeStepIdx / (HOMEWORK_STEPS.length - 1)) * 100}%` }}
          />

          {HOMEWORK_STEPS.map((step, idx) => {
            const isCompleted = idx < activeStepIdx;
            const isCurrent = idx === activeStepIdx;
            return (
              <div key={step.key} className="flex flex-col items-center relative z-10">
                <div
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCurrent
                      ? "bg-blue-600 border-white dark:border-slate-900 ring-2 ring-blue-400"
                      : isCompleted
                      ? "bg-blue-600 border-blue-600"
                      : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  }`}
                />
                <span
                  className={`text-[9px] mt-1 font-medium ${
                    isCurrent
                      ? "text-blue-700 dark:text-blue-300 font-bold"
                      : isCompleted
                      ? "text-slate-600 dark:text-slate-400"
                      : "text-slate-400 dark:text-slate-600"
                  }`}
                >
                  {isHi ? step.labelHi : step.labelEn}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {isPending
            ? isHi ? "विवरण और निर्देश देखें" : "View instructions & worksheet"
            : isHi ? "सबमिशन की समीक्षा करें" : "Review your submission"}
        </span>

        <Link
          href="/parent/documents?tab=homework"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-colors"
        >
          <span>{isHi ? "गृहकार्य खोलें" : "Open Homework"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
