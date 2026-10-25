"use client";

import React from "react";
import { CheckCircle2, AlertCircle, Calendar, Sparkles, Coffee, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TeacherTodayStripProps {
  activeCardsCount: number;
  daySummary?: string | undefined;
  dayCompleteSummary?: string | undefined;
  isDayComplete?: boolean | undefined;
  isRestDay?: boolean | undefined;
  isWorkingDay?: boolean | undefined;
  holidayTitle?: string | undefined;
  isSetupMissing?: boolean | undefined;
  missingAllocationsSummary?: string[] | undefined;
  locale?: string | undefined;
  className?: string | undefined;
}

export function TeacherTodayStrip({
  activeCardsCount,
  daySummary,
  dayCompleteSummary,
  isDayComplete = false,
  isRestDay = false,
  isWorkingDay = true,
  holidayTitle,
  isSetupMissing = false,
  missingAllocationsSummary = [],
  locale = "en",
  className,
}: TeacherTodayStripProps) {
  const now = new Date();

  // Date and weekday formatting
  const weekday = now.toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", {
    weekday: "long",
  });
  const dateFormatted = now.toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Honest state derivation (S19-F03 / Working-feel emotional design)
  if (isRestDay || !isWorkingDay) {
    return (
      <div
        data-testid="teacher-today-strip"
        className={cn(
          "rounded-2xl p-4 transition-all border bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-950 border-indigo-500/30 text-indigo-200 shadow-sm",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors bg-indigo-500/20 border-indigo-400/30 text-indigo-300">
              <Coffee className="w-4 h-4 text-indigo-400" />
            </div>

            <div>
              <div className="text-xs font-medium text-slate-400">
                {weekday}, {dateFormatted}
              </div>

              <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5 mt-0.5">
                <span className="text-indigo-200 font-bold">
                  {holidayTitle
                    ? `${holidayTitle} • ${locale === "hi" ? "अवकाश" : "School Closed"}`
                    : locale === "hi"
                    ? "रविवार • विद्यालय बंद"
                    : "Sunday • Rest Day"}
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  — {locale === "hi" ? "आज कोई शैक्षणिक सत्र नहीं है" : "No instructional sessions scheduled today"}
                </span>
              </div>
            </div>
          </div>

          <span
            data-testid="rest-day-badge"
            className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-400/30 shrink-0 shadow-sm"
          >
            <Coffee className="w-3 h-3 text-indigo-400" />
            {holidayTitle || (locale === "hi" ? "विश्राम दिवस" : "Rest Day")}
          </span>
        </div>
      </div>
    );
  }

  if (isSetupMissing) {
    return (
      <div
        data-testid="teacher-today-strip"
        className={cn(
          "rounded-2xl p-4 transition-all border bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border-amber-500/30 text-amber-200 shadow-sm",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors bg-amber-500/20 border-amber-400/30 text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>

            <div>
              <div className="text-xs font-medium text-slate-400">
                {weekday}, {dateFormatted}
              </div>

              <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5 mt-0.5">
                <span className="text-amber-300 font-bold">
                  {locale === "hi"
                    ? "समय सारिणी अप्रकाशित है — व्यवस्थापक से संपर्क करें"
                    : "Timetable Not Published — Notify Admin"}
                </span>
              </div>
            </div>
          </div>

          <span
            data-testid="setup-missing-badge"
            className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30 shrink-0 shadow-sm"
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            {locale === "hi" ? "सेटअप लंबित" : "Setup Pending"}
          </span>
        </div>
      </div>
    );
  }

  const isCalm = isDayComplete;

  return (
    <div
      data-testid="teacher-today-strip"
      className={cn(
        "rounded-2xl p-4 transition-all border",
        isCalm
          ? "bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-950/30"
          : "bg-slate-900/80 border-slate-800 text-slate-200 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
              isCalm
                ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-400"
                : "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
            )}
          >
            {isCalm ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
          </div>

          <div>
            <div className="text-xs font-medium text-slate-400">
              {weekday}, {dateFormatted}
            </div>

            <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5 mt-0.5">
              {isCalm ? (
                <>
                  <span className="text-emerald-300 font-bold">
                    {dayCompleteSummary ||
                      (locale === "hi"
                        ? "आज का सारा कार्य पूर्ण है। सभी विद्यार्थी दर्ज हैं।"
                        : "All sections marked. All students accounted for.")}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {daySummary ||
                      (locale === "hi"
                        ? `आज ${activeCardsCount} कार्य ध्यान देने की प्रतीक्षा में हैं`
                        : `${activeCardsCount} ${
                            activeCardsCount === 1 ? "task awaits" : "tasks await"
                          } your attention today`)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {isCalm ? (
          <span
            data-testid="day-complete-badge"
            className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 shrink-0 shadow-sm"
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            {locale === "hi" ? "दिन पूर्ण" : "Day Complete"}
          </span>
        ) : (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            {activeCardsCount} {locale === "hi" ? "लंबित" : "Pending"}
          </span>
        )}
      </div>
    </div>
  );
}

export default TeacherTodayStrip;
