"use client";

import React from "react";
import { CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TodayStripProps {
  activeCardsCount: number;
  locale?: string;
  className?: string;
}

export function TodayStrip({
  activeCardsCount,
  locale = "en",
  className,
}: TodayStripProps) {
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

  const isAllGood = activeCardsCount === 0;

  return (
    <div
      className={cn(
        "rounded-2xl p-4 transition-all border",
        isAllGood
          ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-300"
          : "bg-slate-900/60 border-slate-800 text-slate-200",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
              isAllGood
                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                : "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
            )}
          >
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">
              {weekday}, {dateFormatted}
            </div>
            <div className="text-sm font-semibold tracking-tight text-slate-100 flex items-center gap-1.5 mt-0.5">
              {isAllGood ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {locale === "hi"
                      ? "आज सब कुछ ठीक है"
                      : "All good today"}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {locale === "hi"
                      ? `आज ${activeCardsCount} मामलों पर ध्यान देने की आवश्यकता है`
                      : `${activeCardsCount} ${
                          activeCardsCount === 1 ? "item needs" : "items need"
                        } your attention`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {isAllGood && (
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {locale === "hi" ? "शांत दिन" : "Peaceful"}
          </span>
        )}
      </div>
    </div>
  );
}

export default TodayStrip;
