"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Award, TrendingUp, TrendingDown, ArrowRight, Sparkles, ExternalLink } from "lucide-react";
import { DerivedFeedCard } from "./FeedCard";

interface ReportCardCardProps {
  card: DerivedFeedCard;
  locale?: string;
}

export function ReportCardCard({ card, locale = "en" }: ReportCardCardProps) {
  const isHi = locale === "hi";
  const [isFestive, setIsFestive] = useState(true);

  // Emotional UX: Celebration is earned and brief (< 8s of shimmer, then settles into a normal card)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFestive(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  const {
    termName = "Term Examination",
    averageScore = 0,
    previousAverageScore = null,
    deltaScore = 0,
    viewedAt = null,
  } = card.payload || {};

  const scoreNum = Number(averageScore);
  const deltaNum = Number(deltaScore || (previousAverageScore != null ? scoreNum - Number(previousAverageScore) : 0));
  const isPositiveDelta = deltaNum >= 0;

  return (
    <div
      className={`rounded-2xl border transition-all duration-700 shadow-md p-4 sm:p-5 overflow-hidden relative ${
        isFestive
          ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-emerald-400"
          : "bg-white dark:bg-slate-900 border-emerald-500/40 text-slate-900 dark:text-slate-100"
      }`}
      data-testid="report-card-card"
    >
      {/* Subtle celebratory shimmer while festive */}
      {isFestive && (
        <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />
      )}

      <div className="relative z-10 flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              isFestive
                ? "bg-white/20 text-white backdrop-blur-sm border border-white/30"
                : "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
            }`}
          >
            <Award className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-base font-bold ${isFestive ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>
                {isHi ? card.title.hi : card.title.en}
              </h3>
              {isFestive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/25 text-white border border-white/40">
                  <Sparkles className="w-3 h-3 text-amber-200" />
                  {isHi ? "नया प्रकाशित" : "PUBLISHED"}
                </span>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${isFestive ? "text-emerald-100" : "text-slate-500 dark:text-slate-400"}`}>
              {termName} &bull; {isHi ? "आधिकारिक रिपोर्ट कार्ड" : "Official Academic Evaluation"}
            </p>
          </div>
        </div>

        {/* Score Display Pill */}
        <div
          className={`text-right px-3 py-1.5 rounded-xl border ${
            isFestive
              ? "bg-white/15 border-white/30 text-white"
              : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
          }`}
        >
          <div className="text-[10px] font-semibold opacity-90 uppercase tracking-wider">
            {isHi ? "औसत प्राप्तांक" : "Average"}
          </div>
          <div className="text-lg font-black">{scoreNum.toFixed(1)}%</div>
        </div>
      </div>

      {/* Summary line with delta comparison */}
      <div className="relative z-10 flex items-center justify-between mt-2 pt-2 border-t border-white/20 dark:border-slate-800">
        <p className={`text-xs leading-relaxed ${isFestive ? "text-emerald-100" : "text-slate-600 dark:text-slate-400"}`}>
          {isHi ? card.summary.hi : card.summary.en}
        </p>

        {previousAverageScore != null && (
          <div
            className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ml-2 ${
              isPositiveDelta
                ? isFestive ? "bg-white/20 text-emerald-100" : "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60"
                : isFestive ? "bg-white/20 text-rose-200" : "text-rose-600 bg-rose-50 dark:bg-rose-950/60"
            }`}
          >
            {isPositiveDelta ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span>{isPositiveDelta ? `+${deltaNum.toFixed(1)}%` : `${deltaNum.toFixed(1)}%`}</span>
          </div>
        )}
      </div>

      {/* Primary Action Button: Open Report Card deep link into /portal/report-cards (offline cached by sw.js) */}
      <div className="relative z-10 mt-3.5 pt-3 border-t border-white/20 dark:border-slate-800 flex items-center justify-between">
        <span className={`text-[11px] ${isFestive ? "text-emerald-200" : "text-slate-400"}`}>
          {isHi ? "ऑफ़लाइन देखने के लिए उपलब्ध" : "Available offline once downloaded"}
        </span>

        <Link
          href="/portal/report-cards"
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-transform active:scale-95 ${
            isFestive
              ? "bg-white text-emerald-800 hover:bg-emerald-50"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          <span>{isHi ? "रिपोर्ट कार्ड खोलें" : "Open Report Card"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
