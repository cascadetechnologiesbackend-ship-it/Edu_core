"use client";

import React from "react";
import { CheckCircle2, AlertCircle, Calendar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TeacherTodayStripProps {
  activeCardsCount: number;
  daySummary?: string | undefined;
  dayCompleteSummary?: string | undefined;
  isDayComplete?: boolean | undefined;
  locale?: string | undefined;
  className?: string | undefined;
}

export function TeacherTodayStrip({
  activeCardsCount,
  daySummary,
  dayCompleteSummary,
  isDayComplete = false,
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

  const isCalm = isDayComplete || activeCardsCount === 0;

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
